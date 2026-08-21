// [REALTIME-FIX] Live Generation Tracking & Multi-Agent Event Bus using sseManager Singleton
import { ContentCategory } from './categorize';
import { runContentCategorizerPipeline } from '../agents/agentContentCategorizer';
import { sseManager } from '../lib/sseManager';

export interface GenerationEvent {
  id: string;
  timestamp: string;           // ISO 8601
  clientId: string;
  accessCode: string;
  packageTier: 'mingguan' | 'bulanan_vip' | 'lifetime' | 'custom';
  tool: 'idea_konten' | 'video_to_prompt' | 'prompt_foto' | 'tiktok_downloader' | 'ekstraktor_frame';
  category: ContentCategory;
  durationRequested?: number;  // detik
  segmentSplit?: number;       // detik per klip
  toneOfVoice?: string;
  contentSalesType?: string;   // "jualan_afiliasi" | "soft_selling" | ...
  modelUsed: string;
  tierUsed: 'flagship' | 'tier2' | 'tier3' | 'user_key';
  tokensIn?: number;
  tokensOut?: number;
  latencyMs: number;
  outcome: 'success' | 'error' | 'flagged';
  errorMessage?: string;
  sourceSubmissionId?: string;
}

export interface ActiveGenerationItem {
  id: string;
  clientId: string;
  accessCode: string;
  tool: string;
  category: string;
  status: 'generating' | 'analyzing' | 'completed' | 'active';
  startedAt?: string;
  updatedAt?: number;
  details?: string;
  orchestrationResult?: any;
}

/**
 * Report live generation progress step to server and local subscribers
 */
export function reportActiveGenerationStatus(
  id: string,
  status: 'generating' | 'analyzing' | 'completed',
  details?: string
): void {
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(
        new CustomEvent('satset_active_status_updated', {
          detail: { id, status, details },
        })
      );
    } catch (e) {
      // ignore
    }
  }

  fetch('/api/events/active-status', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, status, details }),
  }).catch((err) => console.warn('[GenerationEvent] Report active status notice:', err));
}

/**
 * Emit a generation event to tracking system.
 * Fire-and-forget server sync with 3x exponential backoff retries (500ms, 1500ms, 4500ms).
 */
export function emitGenerationEvent(
  eventInput: Omit<GenerationEvent, 'id' | 'timestamp'> & { id?: string; timestamp?: string }
): void {
  const fullEvent: GenerationEvent = {
    ...eventInput,
    id: eventInput.id || `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: eventInput.timestamp || new Date().toISOString(),
  };

  // Dispatch custom browser event for real-time UI components
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(
        new CustomEvent('satset_generation_event', { detail: fullEvent })
      );
    } catch (e) {
      // Ignore DOM event dispatch issues
    }
  }

  // Fire-and-forget server sync with 3x retry and exponential backoff
  const sendToServer = async (attempt: number = 1): Promise<void> => {
    try {
      const response = await fetch('/api/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(fullEvent),
      });

      if (!response.ok && attempt < 3) {
        const delay = attempt === 1 ? 500 : attempt === 2 ? 1500 : 4500;
        setTimeout(() => sendToServer(attempt + 1), delay);
      }
    } catch (err) {
      if (attempt < 3) {
        const delay = attempt === 1 ? 500 : attempt === 2 ? 1500 : 4500;
        setTimeout(() => sendToServer(attempt + 1), delay);
      } else {
        console.warn('[GenerationEvent] Silent fail after 3 retries:', err);
      }
    }
  };

  // Asynchronously trigger Multi-Agent Categorization Pipeline
  try {
    runContentCategorizerPipeline({
      caption: `${fullEvent.tool} ${fullEvent.contentSalesType || ''} ${fullEvent.toneOfVoice || ''}`,
      title: `Generation Event (${fullEvent.tool})`,
      contentId: fullEvent.id
    }).catch(() => {});
  } catch (e) {}

  sendToServer(1);
}

/**
 * Subscribe to Live Generation Events stream via central sseManager singleton.
 */
export function subscribeLiveGenerationEvents(
  onUpdate: (data: { type: string; events?: GenerationEvent[]; activeGenerations?: ActiveGenerationItem[]; activeGeneration?: any; event?: GenerationEvent; result?: any; [key: string]: any }) => void
): () => void {
  const handleData = (data: any) => {
    try {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('satset_live_stream_received', { detail: data }));
      }
      onUpdate(data);
    } catch (e) {
      console.warn('[GenerationEvent] Live update parse error:', e);
    }
  };

  // Subscribe to central sseManager (no duplicate EventSource!)
  const unsubscribeSSE = sseManager.subscribe((data) => {
    handleData(data);
  });

  // Also listen to window browser events for zero-latency local updates
  const handleLocalEvent = (e: any) => {
    handleData({ type: 'generation_event', event: e.detail });
  };
  const handleLocalStatus = (e: any) => {
    handleData({ type: 'active_status_update', activeGeneration: e.detail });
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('satset_generation_event', handleLocalEvent);
    window.addEventListener('satset_active_status_updated', handleLocalStatus);
  }

  return () => {
    unsubscribeSSE();
    if (typeof window !== 'undefined') {
      window.removeEventListener('satset_generation_event', handleLocalEvent);
      window.removeEventListener('satset_active_status_updated', handleLocalStatus);
    }
  };
}
