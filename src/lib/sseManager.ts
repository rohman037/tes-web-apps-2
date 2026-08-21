// [REALTIME-FIX] Singleton SSE Manager with Observer Pattern, Reference Counting, Long-Polling Hybrid Fallback, Exponential Backoff, and Heartbeat Monitor
import { getUserSession } from './auth';
import { broadcastToOtherTabs } from './crossTabSync';
import { hydrateDataFromServer } from './realtimeSync';

type SSEListener = (data: any) => void;

class SSEManager {
  private static instance: SSEManager;

  private subscribers: Set<SSEListener> = new Set();
  private eventSource: EventSource | null = null;
  private connectionMode: 'sse' | 'long_polling' | 'short_polling' = 'sse';
  
  private lastEventId: string | number = 0;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectTimer: any = null;
  
  private heartbeatIntervalTimer: any = null;
  private lastActivityTime: number = Date.now();
  
  private pollController: AbortController | null = null;
  private sseConnectTimeoutTimer: any = null;
  
  private isConnected = false;

  private constructor() {}

  public static getInstance(): SSEManager {
    if (!SSEManager.instance) {
      SSEManager.instance = new SSEManager();
    }
    return SSEManager.instance;
  }

  /**
   * Subscribe to live real-time updates.
   * Reference counting starts the connection on the first subscriber.
   */
  public subscribe(listener: SSEListener): () => void {
    this.subscribers.add(listener);

    if (this.subscribers.size === 1) {
      this.connect();
    }

    return () => {
      this.subscribers.delete(listener);
      if (this.subscribers.size === 0) {
        this.disconnect();
      }
    };
  }

  /**
   * Returns current subscriber count
   */
  public getSubscriberCount(): number {
    return this.subscribers.size;
  }

  /**
   * Check if connection is currently active
   */
  public isStreamConnected(): boolean {
    return this.isConnected;
  }

  /**
   * Primary connection entry point
   */
  public connect() {
    if (typeof window === 'undefined') return;

    this.clearTimers();

    if (this.connectionMode === 'sse') {
      this.startSSEConnection();
    } else if (this.connectionMode === 'long_polling') {
      this.startLongPollingLoop();
    } else {
      this.startShortPollingLoop();
    }

    this.startHeartbeatMonitor();
  }

  /**
   * Disconnect and cleanup resources
   */
  public disconnect() {
    this.clearTimers();
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    if (this.pollController) {
      this.pollController.abort();
      this.pollController = null;
    }
    this.isConnected = false;
    this.broadcastStatus('offline');
  }

  private clearTimers() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.sseConnectTimeoutTimer) {
      clearTimeout(this.sseConnectTimeoutTimer);
      this.sseConnectTimeoutTimer = null;
    }
    if (this.heartbeatIntervalTimer) {
      clearInterval(this.heartbeatIntervalTimer);
      this.heartbeatIntervalTimer = null;
    }
  }

  /**
   * Connect via EventSource (SSE)
   */
  private startSSEConnection() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    const session = getUserSession();
    const token = session?.code || 'GUEST-ACCESS';
    const sseUrl = `/api/events/stream?token=${encodeURIComponent(token)}&lastEventId=${encodeURIComponent(this.lastEventId)}`;

    this.broadcastStatus('reconnecting');

    try {
      this.eventSource = new EventSource(sseUrl);

      // 5-second timer: If SSE fails to connect or receive initial event within 5s, switch to long-polling
      this.sseConnectTimeoutTimer = setTimeout(() => {
        if (!this.isConnected) {
          console.warn('[SSEManager] SSE connection timeout after 5s. Fallback to long-polling.');
          if (this.eventSource) {
            this.eventSource.close();
            this.eventSource = null;
          }
          this.connectionMode = 'long_polling';
          this.connect();
        }
      }, 5000);

      this.eventSource.onopen = () => {
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.lastActivityTime = Date.now();
        if (this.sseConnectTimeoutTimer) {
          clearTimeout(this.sseConnectTimeoutTimer);
          this.sseConnectTimeoutTimer = null;
        }
        this.broadcastStatus('connected');
      };

      this.eventSource.onmessage = (event) => {
        this.lastActivityTime = Date.now();
        this.isConnected = true;

        if (event.lastEventId) {
          this.lastEventId = event.lastEventId;
        }

        try {
          const parsed = JSON.parse(event.data);
          this.handleIncomingPayload(parsed);
        } catch (e) {
          // Comment line or ping payload
        }
      };

      this.eventSource.onerror = (err) => {
        console.warn('[SSEManager] SSE error encountered:', err);
        if (this.eventSource) {
          this.eventSource.close();
          this.eventSource = null;
        }
        this.isConnected = false;
        this.handleConnectionFailure();
      };
    } catch (e) {
      console.warn('[SSEManager] Failed to construct EventSource:', e);
      this.connectionMode = 'long_polling';
      this.connect();
    }
  }

  /**
   * Connect via Long-Polling
   */
  private async startLongPollingLoop() {
    this.broadcastStatus('reconnecting');

    const session = getUserSession();
    const token = session?.code || 'GUEST-ACCESS';

    while (this.subscribers.size > 0 && this.connectionMode === 'long_polling') {
      try {
        this.pollController = new AbortController();
        const res = await fetch('/api/events/poll', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lastEventId: this.lastEventId, token }),
          signal: this.pollController.signal,
        });

        if (res.ok) {
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this.lastActivityTime = Date.now();
          this.broadcastStatus('connected');

          const data = await res.json();
          if (data.lastEventId !== undefined) {
            this.lastEventId = data.lastEventId;
          }

          if (Array.isArray(data.events) && data.events.length > 0) {
            data.events.forEach((evt: any) => this.handleIncomingPayload(evt));
          }
        } else {
          this.isConnected = false;
          this.handleConnectionFailure();
          break;
        }
      } catch (err: any) {
        if (err.name === 'AbortError') break;
        console.warn('[SSEManager] Long-polling request failed:', err);
        this.isConnected = false;
        this.handleConnectionFailure();
        break;
      }
    }
  }

  /**
   * Fallback Short-Polling Loop
   */
  private async startShortPollingLoop() {
    this.broadcastStatus('reconnecting');

    const fetchSnapshot = async () => {
      if (this.subscribers.size === 0 || this.connectionMode !== 'short_polling') return;

      try {
        const res = await fetch('/api/events/live');
        if (res.ok) {
          this.isConnected = true;
          this.lastActivityTime = Date.now();
          this.broadcastStatus('connected');
          const data = await res.json();
          this.handleIncomingPayload({
            type: 'snapshot',
            events: data.events || [],
            activeGenerations: data.activeGenerations || [],
          });
        }
      } catch (e) {
        this.broadcastStatus('reconnecting');
      }
    };

    await fetchSnapshot();
    if (this.subscribers.size > 0 && this.connectionMode === 'short_polling') {
      this.reconnectTimer = setTimeout(() => this.startShortPollingLoop(), 5000);
    }
  }

  /**
   * Handle connection failures with Exponential Backoff
   */
  private handleConnectionFailure() {
    this.isConnected = false;
    this.broadcastStatus('reconnecting');

    this.reconnectAttempts += 1;

    if (this.reconnectAttempts > this.maxReconnectAttempts) {
      console.warn(`[SSEManager] Max reconnect attempts (${this.maxReconnectAttempts}) reached. Switching to short-polling mode.`);
      this.connectionMode = 'short_polling';
      this.reconnectAttempts = 0;
      this.connect();
      return;
    }

    // Exponential Backoff: 1s, 2s, 4s, 8s ... max 30s
    const backoffMs = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 30000);
    console.log(`[SSEManager] Reconnecting in ${backoffMs}ms (Attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);

    this.reconnectTimer = setTimeout(() => {
      hydrateDataFromServer(); // Full re-sync upon reconnecting
      this.connect();
    }, backoffMs);
  }

  /**
   * Heartbeat & Stagnancy Monitoring
   */
  private startHeartbeatMonitor() {
    if (this.heartbeatIntervalTimer) clearInterval(this.heartbeatIntervalTimer);

    this.heartbeatIntervalTimer = setInterval(() => {
      const now = Date.now();
      // If no activity for 45 seconds (3 missed server pings of 15s), treat connection as stagnant and reconnect
      if (now - this.lastActivityTime > 45000 && this.subscribers.size > 0) {
        console.warn('[SSEManager] Connection stagnant (>45s no message). Triggering reconnect.');
        this.lastActivityTime = Date.now();
        this.isConnected = false;
        if (this.eventSource) {
          this.eventSource.close();
          this.eventSource = null;
        }
        this.handleConnectionFailure();
      }
    }, 15000);
  }

  /**
   * Process incoming JSON payload and notify all observers
   */
  private handleIncomingPayload(payload: any) {
    if (!payload) return;

    // Ignore raw ping heartbeats
    if (payload.type === 'ping') {
      return;
    }

    if (payload.type === 'server_restarted') {
      console.log('[SSEManager] Server restarted event received. Performing full re-sync...');
      hydrateDataFromServer();
      return;
    }

    // Pass to all active component subscribers
    this.subscribers.forEach((listener) => {
      try {
        listener(payload);
      } catch (err) {
        console.warn('[SSEManager] Observer listener error:', err);
      }
    });

    // Pass to cross-tab channel
    broadcastToOtherTabs(payload.type, payload);
  }

  /**
   * Broadcast status to UI components
   */
  private broadcastStatus(status: 'connected' | 'reconnecting' | 'offline') {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('satset_sse_status', { detail: status }));
    }
  }
}

export const sseManager = SSEManager.getInstance();
