// Realtime Auto-Learning Memory Client Engine
export interface LearningEvent {
  type:
    | 'link_pasted'
    | 'video_downloaded'
    | 'content_ideas_generated'
    | 'video_prompt_generated'
    | 'photo_prompt_generated'
    | 'prompt_copied'
    | 'prompt_edited_manually'
    | 'formula_injected'
    | 'video_uploaded'
    | 'split_duration_selected'
    | 'ai_engine_selected'
    | 'detail_element_toggled'
    | 'prompt_split_generated'
    | 'prompt_clip_copied'
    | 'prompt_sent_to_photo'
    | 'tiktok_link_imported';
  payload: Record<string, any>;
  ts: number;
  sessionId: string;
}

export interface IntelligenceLevelData {
  level: number;
  title: string;
  totalExecutions: number;
  knowledgeCount: number;
  formulasCount?: number;
  learnedWisdom: string[];
  viralHooks: string[];
}

class LearningSyncEngine {
  private buffer: LearningEvent[] = [];
  private apiEndpoint: string = '/api/backend/learn';
  private intervalMs: number = 3000; // Auto-sync every 3 seconds
  private isSending: boolean = false;
  private timer: any = null;

  constructor() {
    this.start();
    this.setupUnloadHandler();
  }

  private getSessionId(): string {
    let id = localStorage.getItem('satset_learning_session_id');
    if (!id) {
      id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      localStorage.setItem('satset_learning_session_id', id);
    }
    return id;
  }

  /**
   * Track any user activity across tools
   */
  public track(type: LearningEvent['type'], payload: Record<string, any> = {}) {
    const event: LearningEvent = {
      type,
      payload,
      ts: Date.now(),
      sessionId: this.getSessionId(),
    };
    this.buffer.push(event);
  }

  public start() {
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => this.flush(), this.intervalMs);
  }

  public async flush() {
    if (this.buffer.length === 0 || this.isSending) return;

    this.isSending = true;
    const batch = [...this.buffer];
    // Clear buffer immediately to prevent duplicate queuing during async call
    this.buffer = [];

    try {
      const res = await fetch(this.apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events: batch }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data && data.intelligence) {
          this.onMemoryUpdated(data.intelligence);
        }
      } else {
        // Put back to buffer if server returned non-200 so it retries
        this.buffer = [...batch, ...this.buffer];
      }
    } catch (err) {
      console.warn('[Learning Sync] Failed to sync batch, re-buffering for next cycle:', err);
      this.buffer = [...batch, ...this.buffer];
    } finally {
      this.isSending = false;
    }
  }

  private onMemoryUpdated(intelligence: IntelligenceLevelData) {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('memory-updated', {
          detail: intelligence,
        })
      );
    }
  }

  private setupUnloadHandler() {
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        if (this.buffer.length > 0) {
          const payload = JSON.stringify({ events: this.buffer });
          if (navigator.sendBeacon) {
            navigator.sendBeacon(this.apiEndpoint, payload);
          } else {
            fetch(this.apiEndpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: payload,
              keepalive: true,
            }).catch(() => {});
          }
        }
      });
    }
  }
}

export const learningSync = new LearningSyncEngine();
