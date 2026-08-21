// [REALTIME-FIX] Cross-Tab Synchronization Manager using BroadcastChannel API with localStorage fallback
import { getUserSession } from './auth';

const CHANNEL_NAME = 'satset_cross_tab_sync';

interface CrossTabMessage {
  type: string;
  payload?: any;
  senderId: string;
  timestamp: number;
}

const TAB_ID = `tab_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
let channel: BroadcastChannel | null = null;

/**
 * Initialize cross-tab synchronization.
 */
export function initCrossTabSync(): () => void {
  if (typeof window === 'undefined') return () => {};

  try {
    if ('BroadcastChannel' in window) {
      channel = new BroadcastChannel(CHANNEL_NAME);
      channel.onmessage = (event: MessageEvent<CrossTabMessage>) => {
        const data = event.data;
        if (!data || data.senderId === TAB_ID) return; // Ignore own messages

        handleIncomingCrossTabMessage(data);
      };
    }
  } catch (err) {
    console.warn('[CrossTabSync] BroadcastChannel not supported or failed to initialize:', err);
  }

  // Fallback storage event listener for cross-tab localStorage updates
  const handleStorageChange = (e: StorageEvent) => {
    if (!e.key) return;
    
    // Dispatch appropriate UI events when localStorage changes in another tab
    if (e.key === 'satset_transactions_db') {
      window.dispatchEvent(new Event('transactions-updated'));
    } else if (e.key === 'satset_clients_data') {
      window.dispatchEvent(new Event('satset_clients_updated'));
    } else if (e.key === 'satset_valid_access_codes') {
      window.dispatchEvent(new Event('satset_access_codes_updated'));
    } else if (e.key === 'satset_packages_data' || e.key === 'satset_packages_db') {
      window.dispatchEvent(new Event('satset_packages_updated'));
    } else if (e.key === 'satset_qris_config') {
      window.dispatchEvent(new Event('satset_qris_updated'));
    } else if (e.key === 'satset_contact_settings') {
      window.dispatchEvent(new Event('satset_contact_settings_updated'));
    } else if (e.key === 'satset_learning_queue') {
      window.dispatchEvent(new Event('satset_learning_queue_updated'));
    } else if (e.key === 'satset_system_memory') {
      window.dispatchEvent(new Event('satset_system_memory_updated'));
    } else if (e.key === 'satset_growth_scaling') {
      window.dispatchEvent(new Event('satset_growth_scaling_updated'));
    } else if (e.key === 'satset_ai_agents' || e.key === 'satset_ai_agents_data') {
      window.dispatchEvent(new Event('satset_ai_agents_updated'));
    } else if (e.key === 'satset_apikeys_data') {
      window.dispatchEvent(new Event('satset_apikeys_updated'));
    }
  };

  window.addEventListener('storage', handleStorageChange);

  return () => {
    if (channel) {
      channel.close();
      channel = null;
    }
    window.removeEventListener('storage', handleStorageChange);
  };
}

/**
 * Broadcast event or state update to all open browser tabs
 */
export function broadcastToOtherTabs(type: string, payload?: any): void {
  if (typeof window === 'undefined') return;

  const message: CrossTabMessage = {
    type,
    payload,
    senderId: TAB_ID,
    timestamp: Date.now(),
  };

  if (channel) {
    try {
      channel.postMessage(message);
    } catch (e) {
      console.warn('[CrossTabSync] Failed to post message via BroadcastChannel:', e);
    }
  }
}

/**
 * Handle incoming message from another tab
 */
function handleIncomingCrossTabMessage(msg: CrossTabMessage) {
  const { type, payload } = msg;

  try {
    switch (type) {
      case 'transaction_updated':
        if (payload?.transaction) {
          updateLocalStorageArray('satset_transactions_db', payload.transaction);
        }
        window.dispatchEvent(new Event('transactions-updated'));
        
        const currentSession = getUserSession();
        if (currentSession && payload?.event?.accessCode === currentSession.code) {
          window.dispatchEvent(new Event('satset_auth_updated'));
        }
        break;

      case 'clients_updated':
        if (Array.isArray(payload?.clients)) {
          localStorage.setItem('satset_clients_data', JSON.stringify(payload.clients));
        }
        window.dispatchEvent(new Event('satset_clients_updated'));
        break;

      case 'access_codes_updated':
        if (Array.isArray(payload?.accessCodes)) {
          localStorage.setItem('satset_valid_access_codes', JSON.stringify(payload.accessCodes));
        }
        window.dispatchEvent(new Event('satset_access_codes_updated'));
        break;

      case 'packages_updated':
        if (Array.isArray(payload?.packages)) {
          localStorage.setItem('satset_packages_data', JSON.stringify(payload.packages));
          localStorage.setItem('satset_packages_db', JSON.stringify(payload.packages));
        }
        window.dispatchEvent(new Event('satset_packages_updated'));
        break;

      case 'qris_updated':
        if (payload?.qrisConfig) {
          localStorage.setItem('satset_qris_config', JSON.stringify(payload.qrisConfig));
        }
        window.dispatchEvent(new Event('satset_qris_updated'));
        break;

      case 'contact_settings_updated':
        if (payload?.contactSettings) {
          localStorage.setItem('satset_contact_settings', JSON.stringify(payload.contactSettings));
        }
        window.dispatchEvent(new Event('satset_contact_settings_updated'));
        break;

      case 'learning_queue_updated':
        if (payload?.queue) {
          localStorage.setItem('satset_learning_queue', JSON.stringify(payload.queue));
        }
        window.dispatchEvent(new Event('satset_learning_queue_updated'));
        break;

      case 'system_memory_updated':
        if (payload?.memory) {
          localStorage.setItem('satset_system_memory', JSON.stringify(payload.memory));
        }
        window.dispatchEvent(new Event('satset_system_memory_updated'));
        break;

      case 'anomaly_detected':
        window.dispatchEvent(new CustomEvent('satset_anomaly_detected', { detail: payload }));
        break;

      case 'growth_scaling_updated':
        if (payload?.data) {
          localStorage.setItem('satset_growth_scaling', JSON.stringify(payload.data));
        }
        window.dispatchEvent(new Event('satset_growth_scaling_updated'));
        break;

      case 'ai_agents_updated': {
        const agentList = payload?.agents || payload?.data;
        if (agentList) {
          localStorage.setItem('satset_ai_agents_data', JSON.stringify(agentList));
          localStorage.setItem('satset_ai_agents', JSON.stringify(agentList));
        }
        window.dispatchEvent(new Event('satset_ai_agents_updated'));
        break;
      }

      case 'apikeys_updated': {
        if (payload?.keys) {
          localStorage.setItem('satset_apikeys_data', JSON.stringify(payload.keys));
        }
        window.dispatchEvent(new Event('satset_apikeys_updated'));
        break;
      }

      case 'active_status_update':
        window.dispatchEvent(new CustomEvent('satset_active_status_updated', { detail: payload }));
        break;

      case 'generation_event':
        window.dispatchEvent(new CustomEvent('satset_generation_event', { detail: payload }));
        break;

      default:
        // Generic window event trigger
        if (type) {
          window.dispatchEvent(new CustomEvent(`satset_${type}`, { detail: payload }));
        }
        break;
    }
  } catch (err) {
    console.warn('[CrossTabSync] Error processing cross tab message:', err);
  }
}

function updateLocalStorageArray(key: string, newItem: any) {
  try {
    const raw = localStorage.getItem(key);
    let list: any[] = [];
    if (raw) {
      list = JSON.parse(raw);
      if (!Array.isArray(list)) list = [];
    }
    const idx = list.findIndex((i) => i.id === newItem.id);
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...newItem };
    } else {
      list.unshift(newItem);
    }
    localStorage.setItem(key, JSON.stringify(list));
  } catch (e) {
    // ignore
  }
}
