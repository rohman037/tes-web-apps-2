// Smart Multi-Tier Cache Manager for AI requests & TikTok metadata
// Caches expensive AI analysis results in browser storage with TTL and hash indexing

const CACHE_PREFIX = 'satset_ai_cache_';
const DEFAULT_TTL_MS = 1000 * 60 * 60 * 24; // 24 hours

export interface CacheEntry<T> {
  key: string;
  data: T;
  timestamp: number;
  expiresAt: number;
  tags?: string[];
}

/**
 * Simple deterministic hash for cache keys
 */
export function hashKey(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  return 'h_' + Math.abs(hash).toString(36);
}

/**
 * Set item in cache with TTL
 */
export function setCachedData<T>(key: string, data: T, ttlMs: number = DEFAULT_TTL_MS, tags?: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    const hashed = hashKey(key);
    const entry: CacheEntry<T> = {
      key,
      data,
      timestamp: Date.now(),
      expiresAt: Date.now() + ttlMs,
      tags,
    };
    localStorage.setItem(CACHE_PREFIX + hashed, JSON.stringify(entry));
  } catch {
    // If quota exceeded, perform lightweight cleanup of expired items
    pruneExpiredCache();
  }
}

/**
 * Get item from cache if still valid
 */
export function getCachedData<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const hashed = hashKey(key);
    const raw = localStorage.getItem(CACHE_PREFIX + hashed);
    if (!raw) return null;

    const entry = JSON.parse(raw) as CacheEntry<T>;
    if (Date.now() > entry.expiresAt) {
      localStorage.removeItem(CACHE_PREFIX + hashed);
      return null;
    }
    return entry.data;
  } catch {
    return null;
  }
}

/**
 * Clear expired entries to save memory and storage
 */
export function pruneExpiredCache(): void {
  if (typeof window === 'undefined') return;
  try {
    const now = Date.now();
    const keysToRemove: string[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(CACHE_PREFIX)) {
        try {
          const item = JSON.parse(localStorage.getItem(key) || '{}');
          if (item.expiresAt && now > item.expiresAt) {
            keysToRemove.push(key);
          }
        } catch {
          keysToRemove.push(key);
        }
      }
    }

    keysToRemove.forEach((k) => localStorage.removeItem(k));
  } catch {
    // Ignore storage iteration errors
  }
}

/**
 * Invalidate cache by tag or clear all AI caches
 */
export function clearAiCache(): void {
  if (typeof window === 'undefined') return;
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(CACHE_PREFIX)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  } catch {
    // Ignore storage errors
  }
}
