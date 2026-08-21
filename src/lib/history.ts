import { HistoryItem, HistoryCategory } from '../types';
import { getUserSession } from './auth';
import { getClients } from './admin/clients';

export type { HistoryItem, HistoryCategory };

const BASE_STORAGE_KEY = 'videoai_pro_history_v1';
const MAX_HISTORY_ITEMS = 100;

function getHistoryStorageKey(userCode?: string): string {
  const session = getUserSession();
  const code = (userCode || session?.code || '').trim().toUpperCase();
  if (!code) return `${BASE_STORAGE_KEY}_GUEST`;
  return `${BASE_STORAGE_KEY}_${code}`;
}

export const getHistoryCount = (userCode?: string): number => {
  return getHistory(userCode).length;
};

export const getHistory = (userCode?: string): HistoryItem[] => {
  if (typeof localStorage === 'undefined') return [];
  try {
    const key = getHistoryStorageKey(userCode);
    let raw = localStorage.getItem(key);

    // Backward compatibility check for legacy un-scoped history
    if (!raw && typeof window !== 'undefined') {
      const legacyRaw = localStorage.getItem(BASE_STORAGE_KEY);
      if (legacyRaw) {
        raw = legacyRaw;
        try {
          localStorage.setItem(key, legacyRaw);
        } catch (e) {
          // ignore
        }
      }
    }

    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed;
    }
    return [];
  } catch (error) {
    // console.error('Failed to parse history from localStorage:', error);
    return [];
  }
};

export const saveHistoryItem = (
  item: Omit<HistoryItem, 'id' | 'timestamp'>,
  userCode?: string
): HistoryItem => {
  const session = getUserSession();
  const activeCode = (userCode || session?.code || 'GUEST').trim().toUpperCase();

  // Find client info
  let clientId = 'cli_guest';
  let clientName = 'Guest User';
  const clients = getClients();
  const matched = clients.find((c) => c.accessCode.toUpperCase() === activeCode);
  if (matched) {
    clientId = matched.id;
    clientName = matched.name || 'Klien Satset';
  }

  const newItem: HistoryItem = {
    ...item,
    id: `hist_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    timestamp: Date.now(),
    accessCode: activeCode,
    clientId,
    clientName,
  };

  try {
    const key = getHistoryStorageKey(activeCode);
    const current = getHistory(activeCode);
    
    // Filter out duplicates if exact same prompt or tiktok url exists
    const filtered = current.filter((existing) => {
      if (item.category === 'tiktok_download' && existing.category === 'tiktok_download') {
        return existing.data.tiktokUrl !== item.data.tiktokUrl;
      }
      if (item.category === existing.category && existing.data.prompt && item.data.prompt) {
        return existing.data.prompt !== item.data.prompt;
      }
      return true;
    });

    const updated = [newItem, ...filtered].slice(0, MAX_HISTORY_ITEMS);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, JSON.stringify(updated));
    }

    // Emit event so UI badges update instantly
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('satset_history_updated', { detail: { accessCode: activeCode } }));
    }

    return newItem;
  } catch (error) {
    // console.error('Failed to save item to history:', error);
    return newItem;
  }
};

export const deleteHistoryItem = (id: string, userCode?: string): HistoryItem[] => {
  try {
    const key = getHistoryStorageKey(userCode);
    const current = getHistory(userCode);
    const updated = current.filter((item) => item.id !== id);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, JSON.stringify(updated));
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('satset_history_updated'));
    }

    return updated;
  } catch (error) {
    console.error('Failed to delete history item:', error);
    return getHistory(userCode);
  }
};

export const clearAllHistory = (userCode?: string): void => {
  try {
    const key = getHistoryStorageKey(userCode);
    localStorage.removeItem(key);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('satset_history_updated'));
    }
  } catch (error) {
    console.error('Failed to clear history:', error);
  }
};

export const exportHistoryJSON = (userCode?: string): void => {
  const session = getUserSession();
  const code = userCode || session?.code || 'GUEST';
  const history = getHistory(code);
  const dataStr =
    'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(history, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute('href', dataStr);
  downloadAnchor.setAttribute(
    'download',
    `satset_history_${code}_${new Date().toISOString().slice(0, 10)}.json`
  );
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
};

export const importHistoryJSON = (jsonText: string, userCode?: string): HistoryItem[] => {
  try {
    const parsed = JSON.parse(jsonText);
    if (!Array.isArray(parsed)) throw new Error('Format JSON riwayat tidak valid.');

    const validItems: HistoryItem[] = parsed.filter(
      (item) => item && item.id && item.category && item.title
    );
    const current = getHistory(userCode);

    // Merge without duplicates by ID
    const existingIds = new Set(current.map((i) => i.id));
    const newOnly = validItems.filter((i) => !existingIds.has(i.id));
    const merged = [...newOnly, ...current].slice(0, MAX_HISTORY_ITEMS);

    const key = getHistoryStorageKey(userCode);
    localStorage.setItem(key, JSON.stringify(merged));

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('satset_history_updated'));
    }

    return merged;
  } catch (err: any) {
    console.error('Failed to import history:', err);
    throw new Error('Gagal mengimpor file riwayat JSON. Pastikan format file sesuai.');
  }
};
