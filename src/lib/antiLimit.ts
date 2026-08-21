import { AntiLimitConfig } from '../types';
import { getUserSession } from './auth';

const BASE_ANTI_LIMIT_KEY = 'videoai_pro_antilimit_config_v1';

function getStorageKey(userCode?: string): string {
  const session = getUserSession();
  const code = (userCode || session?.code || '').trim().toUpperCase();
  if (!code) return `${BASE_ANTI_LIMIT_KEY}_GUEST`;
  return `${BASE_ANTI_LIMIT_KEY}_${code}`;
}

export const getAntiLimitConfig = (userCode?: string): AntiLimitConfig => {
  if (typeof localStorage === 'undefined') {
    return {
      enableCache: true,
      enableAutoRetry: true,
      customApiKey: '',
      apiKeys: [],
    };
  }
  try {
    const key = getStorageKey(userCode);
    let raw = localStorage.getItem(key);

    // Backward compatibility: If scoped key doesn't exist, check legacy un-scoped key
    if (!raw && typeof window !== 'undefined') {
      const legacyRaw = localStorage.getItem(BASE_ANTI_LIMIT_KEY);
      if (legacyRaw) {
        raw = legacyRaw;
        // Migrate legacy to scoped key
        try {
          localStorage.setItem(key, legacyRaw);
        } catch (e) {
          // ignore
        }
      }
    }

    if (!raw) {
      return {
        enableCache: true,
        enableAutoRetry: true,
        customApiKey: '',
        apiKeys: [],
      };
    }
    const parsed = JSON.parse(raw);
    if (!parsed.apiKeys) {
      parsed.apiKeys = parsed.customApiKey ? [parsed.customApiKey] : [];
    }
    return parsed;
  } catch (error) {
    return {
      enableCache: true,
      enableAutoRetry: true,
      customApiKey: '',
      apiKeys: [],
    };
  }
};

export const saveAntiLimitConfig = (config: AntiLimitConfig, userCode?: string): void => {
  if (typeof localStorage === 'undefined') return;
  try {
    const key = getStorageKey(userCode);
    // Ensure customApiKey and apiKeys array stay synchronized
    const keysSet = new Set<string>();
    if (config.apiKeys && Array.isArray(config.apiKeys)) {
      config.apiKeys.forEach(k => {
        if (k && k.trim()) keysSet.add(k.trim());
      });
    }
    if (config.customApiKey && config.customApiKey.trim()) {
      keysSet.add(config.customApiKey.trim());
    }

    const cleanedKeys = Array.from(keysSet);
    const updatedConfig: AntiLimitConfig = {
      ...config,
      customApiKey: cleanedKeys[0] || '',
      apiKeys: cleanedKeys,
    };

    localStorage.setItem(key, JSON.stringify(updatedConfig));
  } catch (error) {
    console.error('Failed to save anti-limit config:', error);
  }
};

export const maskApiKey = (key: string): string => {
  if (!key || !key.trim()) return 'TS-••••-NONE';
  const k = key.trim();
  if (k.startsWith('TS-')) {
    const last4 = k.slice(-4);
    return `TS-••••-${last4.toUpperCase()}`;
  } else if (k.startsWith('AIza')) {
    const last4 = k.slice(-4);
    return `AIza••••${last4.toUpperCase()}`;
  } else {
    if (k.length <= 8) return `TS-••••-${k.slice(-4).toUpperCase()}`;
    const prefix = k.slice(0, 2).toUpperCase();
    const last4 = k.slice(-4).toUpperCase();
    return `${prefix}-••••-${last4}`;
  }
};

export const getActiveKeyDisplay = (userCode?: string): string => {
  const config = getAntiLimitConfig(userCode);
  const keys = config.apiKeys && config.apiKeys.length > 0
    ? config.apiKeys
    : (config.customApiKey ? [config.customApiKey] : []);

  if (keys.length === 0) {
    return 'TS-••••-9K2A'; // Default key format indicator
  }
  return maskApiKey(keys[0]);
};

export const addApiKeysBulk = (rawText: string, userCode?: string): void => {
  const lines = rawText
    .split(/[\n,]+/)
    .map((k) => k.trim())
    .filter(Boolean);

  if (lines.length === 0) return;

  const currentConfig = getAntiLimitConfig(userCode);
  const existingKeys = currentConfig.apiKeys || (currentConfig.customApiKey ? [currentConfig.customApiKey] : []);
  const combined = Array.from(new Set([...existingKeys, ...lines]));

  saveAntiLimitConfig({
    ...currentConfig,
    customApiKey: combined[0] || '',
    apiKeys: combined,
  }, userCode);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('api-keys-updated'));
  }
};

export const removeApiKey = (keyToRemove: string, userCode?: string): void => {
  const currentConfig = getAntiLimitConfig(userCode);
  const existingKeys = currentConfig.apiKeys || (currentConfig.customApiKey ? [currentConfig.customApiKey] : []);
  const filtered = existingKeys.filter((k) => k.trim() !== keyToRemove.trim());

  saveAntiLimitConfig({
    ...currentConfig,
    customApiKey: filtered[0] || '',
    apiKeys: filtered,
  }, userCode);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('api-keys-updated'));
  }
};

export const removeDeadKey = (deadKey: string, userCode?: string): void => {
  if (!deadKey || !deadKey.trim()) return;
  removeApiKey(deadKey, userCode);
};

export const getStoredKeys = (userCode?: string): string[] => {
  const config = getAntiLimitConfig(userCode);
  return config.apiKeys && config.apiKeys.length > 0
    ? config.apiKeys
    : (config.customApiKey ? [config.customApiKey] : []);
};

export const getAntiLimitHeaders = (userCode?: string): Record<string, string> => {
  const config = getAntiLimitConfig(userCode);
  const session = getUserSession();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const activeCode = userCode || session?.code;
  if (activeCode) {
    headers['x-client-access-code'] = activeCode;
  }

  const keys = config.apiKeys && config.apiKeys.length > 0
    ? config.apiKeys
    : (config.customApiKey ? [config.customApiKey] : []);

  if (keys.length > 0) {
    headers['x-custom-api-key'] = keys.join(',');
  }

  if (config.enableCache) {
    headers['x-use-cache'] = 'true';
  }

  return headers;
};

