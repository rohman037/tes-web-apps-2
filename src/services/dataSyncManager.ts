'use client';

/**
 * DataSyncManager: Stale-While-Revalidate synchronization manager
 * Provides zero-delay local cache rendering while synchronizing latest server state in background.
 */

type SyncListener<T> = (data: T) => void;

class DataSyncManager {
  private listeners: Map<string, Set<SyncListener<any>>> = new Map();
  private inFlightRequests: Map<string, Promise<any>> = new Map();

  /**
   * Subscribe to real-time local / remote updates for a given key
   */
  public subscribe<T>(key: string, listener: SyncListener<T>): () => void {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    this.listeners.get(key)!.add(listener);

    return () => {
      const set = this.listeners.get(key);
      if (set) {
        set.delete(listener);
        if (set.size === 0) {
          this.listeners.delete(key);
        }
      }
    };
  }

  /**
   * Broadcast change event to all active listeners and dispatch window custom events
   */
  public notify<T>(key: string, data: T, eventName?: string): void {
    const set = this.listeners.get(key);
    if (set) {
      set.forEach((fn) => {
        try {
          fn(data);
        } catch (err) {
          console.warn(`[DataSyncManager] Error in listener for ${key}:`, err);
        }
      });
    }

    if (typeof window !== 'undefined' && eventName) {
      window.dispatchEvent(new CustomEvent(eventName, { detail: data }));
    }
  }

  /**
   * Stale-While-Revalidate fetch helper:
   * 1. Reads instant local storage cache
   * 2. Fetches fresh remote data in the background (deduplicating concurrent requests)
   * 3. Calls onSuccess and updates cache if changed
   */
  public async fetchWithSWR<T>({
    key,
    apiEndpoint,
    localStorageKey,
    fallbackData,
    onSuccess,
    eventName,
  }: {
    key: string;
    apiEndpoint: string;
    localStorageKey?: string;
    fallbackData: T;
    onSuccess?: (data: T) => void;
    eventName?: string;
  }): Promise<T> {
    // 1. Instant Cache retrieval
    let cachedData: T = fallbackData;
    if (typeof localStorage !== 'undefined' && localStorageKey) {
      try {
        const raw = localStorage.getItem(localStorageKey);
        if (raw) {
          cachedData = JSON.parse(raw);
        }
      } catch {
        // Ignore JSON parse error, use fallback
      }
    }

    // 2. Deduped remote fetch
    if (!this.inFlightRequests.has(key)) {
      const fetchPromise = (async () => {
        try {
          const res = await fetch(apiEndpoint);
          if (res.ok) {
            const freshData: T = await res.json();
            if (freshData !== undefined && freshData !== null) {
              if (typeof localStorage !== 'undefined' && localStorageKey) {
                try {
                  localStorage.setItem(localStorageKey, JSON.stringify(freshData));
                } catch {
                  // Storage quota or private mode safe catch
                }
              }
              if (onSuccess) {
                onSuccess(freshData);
              }
              this.notify(key, freshData, eventName);
              return freshData;
            }
          }
        } catch (err) {
          // Network or offline fallback
          // console.debug(`[DataSyncManager] Fetch fallback for ${key}`);
        } finally {
          this.inFlightRequests.delete(key);
        }
        return cachedData;
      })();

      this.inFlightRequests.set(key, fetchPromise);
    }

    return cachedData;
  }
}

export const dataSyncManager = new DataSyncManager();
