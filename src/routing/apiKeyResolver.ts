import { getAntiLimitConfig } from '../lib/antiLimit';
import { getApiKeys } from '../lib/admin/apiKeys';

export interface ResolvedKeyContext {
  key: string;
  source: 'user_key' | 'flagship' | 'tier2' | 'tier3';
  keyId?: string;
}

function isRealApiKey(key?: string): boolean {
  if (!key || typeof key !== 'string') return false;
  const k = key.trim();
  if (k.length < 10) return false;
  if (k.includes('demo_key') || k.includes('backup_key_satset') || k.includes('satset_01') || k.includes('satset_02')) {
    return false;
  }
  return true;
}

/**
 * Resolves the API key to use based on strict priority order:
 * 1. User's own custom API key (from ApiKeySettingsView / antiLimit config)
 * 2. System environment variable (process.env.GEMINI_API_KEY)
 * 3. Admin Flagship key pool (active real keys in admin pool)
 */
export function resolveApiKey(customApiKeyInput?: string, clientAccessCode?: string): ResolvedKeyContext {
  // 1. User custom key check
  const antiLimitCfg = getAntiLimitConfig(clientAccessCode);
  const userKey = (customApiKeyInput || antiLimitCfg.customApiKey || '').trim();

  if (isRealApiKey(userKey)) {
    return {
      key: userKey,
      source: 'user_key',
    };
  }

  // Check antiLimit multi-keys array if configured by user
  if (Array.isArray(antiLimitCfg.apiKeys) && antiLimitCfg.apiKeys.length > 0) {
    const validUserKey = antiLimitCfg.apiKeys.find((k) => isRealApiKey(k));
    if (validUserKey) {
      return {
        key: validUserKey.trim(),
        source: 'user_key',
      };
    }
  }

  // 2. Fallback to server environment key if available
  const envKey = (typeof process !== 'undefined' && process.env && process.env.GEMINI_API_KEY) || '';
  if (isRealApiKey(envKey)) {
    return {
      key: envKey.trim(),
      source: 'flagship',
    };
  }

  // 3. Admin API key pool resolution with Auto-Rotation (Least-Used)
  const now = Date.now();
  const adminKeys = getApiKeys().filter(
    (k) => k.status === 'active' &&
           isRealApiKey(k.key) &&
           (k.dailyUsage || 0) < (k.dailyLimit || 1000) &&
           (!k.cooldownUntil || now > k.cooldownUntil)
  );

  if (adminKeys.length > 0) {
    const sortedKeys = [...adminKeys].sort(
      (a, b) => (a.dailyUsage || 0) - (b.dailyUsage || 0)
    );
    const selectedKey = sortedKeys[0];
    return {
      key: selectedKey.key,
      source: 'flagship',
      keyId: selectedKey.id,
    };
  }

  // Fallback if all active admin keys hit limit: try any active real key
  const allActiveAdminKeys = getApiKeys().filter((k) => k.status === 'active' && isRealApiKey(k.key));
  if (allActiveAdminKeys.length > 0) {
    const selectedKey = allActiveAdminKeys[0];
    return {
      key: selectedKey.key,
      source: 'flagship',
      keyId: selectedKey.id,
    };
  }

  throw new Error('Semua model dan API key sedang tidak tersedia. Silakan masukkan API Key di menu Anti Limit.');
}

