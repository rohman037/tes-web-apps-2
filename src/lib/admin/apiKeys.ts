export interface ApiKeyItem {
  id: string;
  key: string;
  alias?: string;
  dailyLimit: number;
  dailyUsage: number;
  monthlyLimit: number;
  monthlyUsage: number;
  status: 'active' | 'expired' | 'revoked';
  expiryDate?: string;
  createdAt: string;
  lastUsedAt?: string;
  cooldownUntil?: number;
}

export interface ApiKeyUsageLog {
  id: string;
  keyId: string;
  keyMasked: string;
  endpoint: string;
  timestamp: string;
  status: 'success' | 'error' | 'rate_limited';
  modelUsed?: string;
}

export interface ModelPriorityConfig {
  text: string[];
  image: string[];
  video: string[];
}

export const DEFAULT_MODEL_PRIORITIES: ModelPriorityConfig = {
  text: [
    'gemini-3.1-pro-preview',
    'gemini-3.1-pro',
    'gemini-3.6-flash',
    'gemini-2.5-pro',
    'gemini-2.5-flash',
    'gemini-3.1-flash-lite',
    'gemini-2.5-flash-lite'
  ],
  image: [
    'gemini-3-pro-image',
    'gemini-3.1-flash-image',
    'gemini-3.1-flash-lite-image'
  ],
  video: [
    'veo-3.1-generate-preview',
    'veo-3.1-lite-generate-preview'
  ]
};

const LOCAL_STORAGE_APIKEYS_KEY = 'satset_apikeys_data';
const LOCAL_STORAGE_APIKEY_LOGS_KEY = 'satset_apikey_logs_data';
const LOCAL_STORAGE_MODEL_PRIORITY_KEY = 'satset_model_priority_config';

export const DEFAULT_APIKEYS: ApiKeyItem[] = [
  {
    id: 'key_01',
    key: 'AIzaSyB3_demo_key_satset_01_pro_engine',
    alias: 'Primary Gemini Flash Key',
    dailyLimit: 1000,
    dailyUsage: 142,
    monthlyLimit: 30000,
    monthlyUsage: 2840,
    status: 'active',
    createdAt: '2026-08-01T00:00:00.000Z',
    lastUsedAt: '2026-08-06T12:10:00.000Z'
  },
  {
    id: 'key_02',
    key: 'AIzaSyC7_backup_key_satset_02_rotation',
    alias: 'Backup Gemini Key #2',
    dailyLimit: 1000,
    dailyUsage: 38,
    monthlyLimit: 30000,
    monthlyUsage: 910,
    status: 'active',
    createdAt: '2026-08-01T00:00:00.000Z',
    lastUsedAt: '2026-08-06T11:45:00.000Z'
  }
];

export const DEFAULT_APIKEY_LOGS: ApiKeyUsageLog[] = [
  {
    id: 'log_101',
    keyId: 'key_01',
    keyMasked: 'AIzaSy...01_pro',
    endpoint: '/api/generate-content-ideas',
    timestamp: '2026-08-06T12:10:00.000Z',
    status: 'success'
  },
  {
    id: 'log_102',
    keyId: 'key_01',
    keyMasked: 'AIzaSy...01_pro',
    endpoint: '/api/generate-video-prompt',
    timestamp: '2026-08-06T12:05:00.000Z',
    status: 'success'
  }
];

export function maskApiKey(key: string): string {
  if (!key) return '••••••••';
  if (key.length <= 10) return `${key.slice(0, 3)}••••${key.slice(-2)}`;
  return `${key.slice(0, 6)}••••${key.slice(-4)}`;
}

export function getApiKeys(): ApiKeyItem[] {
  if (typeof localStorage === 'undefined') {
    return DEFAULT_APIKEYS;
  }
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_APIKEYS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    // console.warn('[ApiKeys Lib] Error reading localStorage api keys:', e);
  }

  try {
    localStorage.setItem(LOCAL_STORAGE_APIKEYS_KEY, JSON.stringify(DEFAULT_APIKEYS));
  } catch (e) {}

  return DEFAULT_APIKEYS;
}

export async function syncApiKeysWithBackend(): Promise<ApiKeyItem[]> {
  try {
    const res = await fetch('/api/apikeys');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(LOCAL_STORAGE_APIKEYS_KEY, JSON.stringify(data));
        }
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('satset_apikeys_updated'));
        }
        return data;
      }
    }
  } catch (e) {
    console.warn('[ApiKeys Lib] Error syncing API keys from backend:', e);
  }
  return getApiKeys();
}

export function saveApiKeys(keys: ApiKeyItem[]): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LOCAL_STORAGE_APIKEYS_KEY, JSON.stringify(keys));
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('satset_apikeys_updated'));
    }

    const rawSession = typeof localStorage !== 'undefined' ? localStorage.getItem('satset_user_session') : null;
    let accessCode = 'SATSET-ADMIN';
    if (rawSession) {
      try {
        const parsed = JSON.parse(rawSession);
        if (parsed?.code) accessCode = parsed.code;
      } catch (e) {}
    }

    fetch('/api/admin/apikeys', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-access-code': accessCode
      },
      body: JSON.stringify({ keys, logs: getApiKeyLogs() })
    }).catch(() => {});
  } catch (e) {
    console.error('[ApiKeys Lib] Error saving api keys:', e);
  }
}

export function saveApiKey(item: ApiKeyItem): ApiKeyItem[] {
  const current = getApiKeys();
  const index = current.findIndex((k) => k.id === item.id);
  let updated: ApiKeyItem[];

  if (index >= 0) {
    updated = [...current];
    updated[index] = item;
  } else {
    updated = [item, ...current];
  }

  saveApiKeys(updated);
  return updated;
}

export function revokeApiKey(id: string): ApiKeyItem[] {
  const current = getApiKeys();
  const updated = current.map((k) => {
    if (k.id === id) {
      return { ...k, status: 'revoked' as const };
    }
    return k;
  });
  saveApiKeys(updated);
  return updated;
}

export function rotateApiKey(oldKeyId: string, newKeyStr: string, alias?: string): ApiKeyItem[] {
  const current = getApiKeys();
  const now = new Date().toISOString();

  // Revoke old key
  const updated = current.map((k) => {
    if (k.id === oldKeyId) {
      return { ...k, status: 'revoked' as const };
    }
    return k;
  });

  // Add new key
  const newKeyItem: ApiKeyItem = {
    id: `key_${Date.now()}`,
    key: newKeyStr,
    alias: alias || `Rotated Key ${new Date().toLocaleDateString('id-ID')}`,
    dailyLimit: 1000,
    dailyUsage: 0,
    monthlyLimit: 30000,
    monthlyUsage: 0,
    status: 'active',
    createdAt: now
  };

  const finalKeys = [newKeyItem, ...updated];
  saveApiKeys(finalKeys);
  return finalKeys;
}

export function getApiKeyLogs(): ApiKeyUsageLog[] {
  if (typeof localStorage === 'undefined') {
    return DEFAULT_APIKEY_LOGS;
  }
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_APIKEY_LOGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (e) {}

  try {
    localStorage.setItem(LOCAL_STORAGE_APIKEY_LOGS_KEY, JSON.stringify(DEFAULT_APIKEY_LOGS));
  } catch (e) {}

  return DEFAULT_APIKEY_LOGS;
}

export function addApiKeysBulkAdmin(
  rawText: string,
  defaultLimit: number = 1000
): {
  addedKeys: ApiKeyItem[];
  addedCount: number;
  skippedDuplicatesCount: number;
  invalidLinesCount: number;
} {
  const current = getApiKeys();
  const existingKeysSet = new Set(current.map((k) => k.key.trim()));
  const lines = rawText.split('\n').map((l) => l.trim()).filter(Boolean);

  let addedCount = 0;
  let skippedDuplicatesCount = 0;
  let invalidLinesCount = 0;
  const newItems: ApiKeyItem[] = [];

  lines.forEach((line) => {
    // Validate key pattern (starts with AIza or length >= 20)
    const isValidFormat = line.startsWith('AIza') || line.length >= 20;
    if (!isValidFormat) {
      invalidLinesCount++;
      return;
    }

    if (existingKeysSet.has(line)) {
      skippedDuplicatesCount++;
      return;
    }

    existingKeysSet.add(line);
    addedCount++;

    const item: ApiKeyItem = {
      id: `key_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      key: line,
      alias: `Gemini Key #${current.length + newItems.length + 1}`,
      dailyLimit: defaultLimit,
      dailyUsage: 0,
      monthlyLimit: defaultLimit * 30,
      monthlyUsage: 0,
      status: 'active',
      createdAt: new Date().toISOString()
    };

    newItems.push(item);
  });

  if (newItems.length > 0) {
    saveApiKeys([...newItems, ...current]);
  }

  return {
    addedKeys: newItems,
    addedCount,
    skippedDuplicatesCount,
    invalidLinesCount
  };
}

export function recordApiKeyUsage(keyId: string, modelUsed?: string): void {
  try {
    const current = getApiKeys();
    const idx = current.findIndex((k) => k.id === keyId || k.key === keyId);
    if (idx >= 0) {
      const target = current[idx];
      const updated = [...current];
      updated[idx] = {
        ...target,
        dailyUsage: (target.dailyUsage || 0) + 1,
        monthlyUsage: (target.monthlyUsage || 0) + 1,
        lastUsedAt: new Date().toISOString()
      };
      saveApiKeys(updated);
    }
  } catch (e) {
    console.warn('[ApiKeys Lib] Error recording key usage:', e);
  }
}

export function addApiKeyLog(keyId: string, keyMasked: string, endpoint: string, status: 'success' | 'error' | 'rate_limited' = 'success', modelUsed?: string): void {
  try {
    if (status === 'success') {
      recordApiKeyUsage(keyId, modelUsed);
    }
    const currentLogs = getApiKeyLogs();
    const newLog: ApiKeyUsageLog = {
      id: `log_${Date.now()}`,
      keyId,
      keyMasked,
      endpoint,
      timestamp: new Date().toISOString(),
      status,
      modelUsed
    };
    const updatedLogs = [newLog, ...currentLogs].slice(0, 50); // Keep last 50
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LOCAL_STORAGE_APIKEY_LOGS_KEY, JSON.stringify(updatedLogs));
    }
  } catch (e) {}
}

export function getModelPriorities(): ModelPriorityConfig {
  if (typeof localStorage === 'undefined') {
    return DEFAULT_MODEL_PRIORITIES;
  }
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_MODEL_PRIORITY_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return {
          text: Array.isArray(parsed.text) ? parsed.text : DEFAULT_MODEL_PRIORITIES.text,
          image: Array.isArray(parsed.image) ? parsed.image : DEFAULT_MODEL_PRIORITIES.image,
          video: Array.isArray(parsed.video) ? parsed.video : DEFAULT_MODEL_PRIORITIES.video
        };
      }
    }
  } catch (e) {}

  try {
    localStorage.setItem(LOCAL_STORAGE_MODEL_PRIORITY_KEY, JSON.stringify(DEFAULT_MODEL_PRIORITIES));
  } catch (e) {}

  return DEFAULT_MODEL_PRIORITIES;
}

export function saveModelPriorities(config: ModelPriorityConfig): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LOCAL_STORAGE_MODEL_PRIORITY_KEY, JSON.stringify(config));
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('satset_model_priorities_updated'));
    }
  } catch (e) {
    console.error('[ApiKeys Lib] Failed saving model priorities:', e);
  }
}

