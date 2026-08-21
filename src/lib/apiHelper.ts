import { GoogleGenAI } from '@google/genai';
import { getAntiLimitConfig, getStoredKeys, removeDeadKey } from './antiLimit';
import { getModelPriorities, addApiKeyLog } from './admin/apiKeys';

// RANTAI MODEL DEFAULT (SELALU MODEL GEMINI TERBARU DAN PALING CANGGIH DENGAN PRIORITAS TOP MODEL TERATAS)
export const ALL_GEMINI_CASCADING_MODELS = [
  'gemini-3.1-pro-preview',
  'gemini-3.1-pro',
  'gemini-3.6-flash',
  'gemini-2.5-pro',
  'gemini-2.5-flash',
  'gemini-3.1-flash-lite',
  'gemini-2.5-flash-lite'
];

export function getCategoryModelPriority(category: 'text' | 'image' | 'video' = 'text'): string[] {
  try {
    const config = getModelPriorities();
    if (config && Array.isArray(config[category]) && config[category].length > 0) {
      return config[category];
    }
  } catch (e) {}
  return ALL_GEMINI_CASCADING_MODELS;
}

export interface GenerateOptions {
  systemInstruction?: string;
  responseMimeType?: string;
  category?: 'text' | 'image' | 'video';
  endpointName?: string;
  enableSearchGrounding?: boolean;
  enableHighThinking?: boolean;
  lowLatency?: boolean;
}

/**
 * Helper error checker for Rate Limit (429), Permission Denied (403),
 * RESOURCE_EXHAUSTED, or API_KEY_INVALID errors.
 */
export function isRateLimitOrDeadKeyError(err: any): boolean {
  if (!err) return false;
  const errMsg = String(err?.message || err?.error || err || '').toUpperCase();
  const status = err?.status || err?.statusCode || err?.response?.status || 0;

  return (
    status === 429 ||
    status === 403 ||
    errMsg.includes('429') ||
    errMsg.includes('403') ||
    errMsg.includes('RESOURCE_EXHAUSTED') ||
    errMsg.includes('API_KEY_INVALID') ||
    errMsg.includes('QUOTA EXCEEDED') ||
    errMsg.includes('INVALID API KEY') ||
    errMsg.includes('PERMISSION_DENIED') ||
    errMsg.includes('UNAUTHENTICATED')
  );
}

/**
 * Eksekusi dengan Master Cascading Model Fallback (Nested Loop: Keys x Models)
 */
export async function executeGeminiWithFullCascade(
  contents: any,
  options: GenerateOptions = {},
  userCode?: string
): Promise<string> {
  let keys = getStoredKeys(userCode);

  if (keys.length === 0 && typeof process !== 'undefined' && process.env?.GEMINI_API_KEY) {
    keys = [process.env.GEMINI_API_KEY];
  }

  if (keys.length === 0) {
    throw new Error('Tidak ada API Key yang tersedia. Silakan masukkan API Key di Pengaturan.');
  }

  const category = options.category || 'text';
  const modelList = getCategoryModelPriority(category);
  const endpoint = options.endpointName || `/api/generate-${category}`;

  // LOOP 1: Rotasi API Key yang Tersedia
  for (let keyIndex = 0; keyIndex < keys.length; keyIndex++) {
    const currentKey = keys[keyIndex];

    // LOOP 2: Rotasi Cascading Lintas Seluruh Model Gemini dalam Kategori
    for (let modelIndex = 0; modelIndex < modelList.length; modelIndex++) {
      const currentModel = modelList[modelIndex];

      try {
        const ai = new GoogleGenAI({
          apiKey: currentKey,
          httpOptions: {
            headers: {
              'User-Agent': 'aistudio-build',
            },
          },
        });

        const isThinkingModel = currentModel === 'gemini-3.1-pro-preview' || currentModel === 'gemini-3.1-pro' || options.enableHighThinking;
        const requestConfig: any = {
          systemInstruction: options.systemInstruction,
          responseMimeType: options.responseMimeType,
        };

        if (isThinkingModel && (currentModel === 'gemini-3.1-pro-preview' || currentModel === 'gemini-3.1-pro')) {
          requestConfig.thinkingConfig = { thinkingLevel: 'HIGH' };
        }

        if (options.enableSearchGrounding && (currentModel === 'gemini-3.6-flash' || currentModel === 'gemini-3.1-pro-preview' || currentModel === 'gemini-3.1-pro')) {
          requestConfig.tools = [{ googleSearch: {} }];
        }

        const response = await ai.models.generateContent({
          model: currentModel,
          contents: contents,
          config: requestConfig,
        });

        if (response.text) {
          console.log(`[API Success] Berhasil! Key Index: ${keyIndex + 1} | Model: ${currentModel}`);
          // Catat di log pemakaian model mana yang berhasil melayani request
          addApiKeyLog(`key_${keyIndex + 1}`, `${currentKey.slice(0, 6)}...`, endpoint, 'success', currentModel);
          return response.text;
        }

      } catch (error: any) {
        const errorMessage = error?.message || String(error || '');
        const status = error?.status || error?.response?.status || error?.statusCode;

        const isDeadKey =
          status === 403 ||
          errorMessage.includes('API_KEY_INVALID') ||
          errorMessage.includes('API key not found') ||
          errorMessage.includes('INVALID API KEY') ||
          errorMessage.includes('UNAUTHENTICATED');

        const isRateLimitOrQuota =
          status === 429 ||
          errorMessage.includes('429') ||
          errorMessage.includes('RESOURCE_EXHAUSTED') ||
          errorMessage.includes('Quota exceeded') ||
          errorMessage.includes('Rate limit') ||
          errorMessage.includes('QUOTA EXCEEDED');

        if (isDeadKey) {
          console.warn(`[Auto-Prune] API Key ${currentKey.substring(0, 6)}... tidak valid. Menghapus key.`);
          addApiKeyLog(`key_${keyIndex + 1}`, `${currentKey.slice(0, 6)}...`, endpoint, 'error', currentModel);
          removeDeadKey(currentKey);
          break; // Keluar dari loop model, pindah ke Key selanjutnya
        }

        if (isRateLimitOrQuota) {
          console.warn(`[Cascading Fallback] Model ${currentModel} limit pada Key ${currentKey.substring(0, 6)}... Mencoba model berikutnya (${modelList[modelIndex + 1] || 'Habis'})...`);
          addApiKeyLog(`key_${keyIndex + 1}`, `${currentKey.slice(0, 6)}...`, endpoint, 'rate_limited', currentModel);

          if (modelIndex === modelList.length - 1) {
            console.warn(`[Key Exhausted] Seluruh model limit pada Key ${currentKey.substring(0, 6)}... Menghapus key.`);
            removeDeadKey(currentKey);
          }
          continue; // Lanjut ke model berikutnya
        }

        throw error;
      }
    }
  }

  throw new Error('Sistem AI sedang penuh (seluruh kuota & model limit). Coba lagi beberapa saat.');
}

/**
 * Bungkus eksekusi SDK @google/genai fleksibel dengan Auto-Prune & Cascading Models
 */
export async function executeWithGenAI<T = any>(
  fn: (ai: GoogleGenAI, apiKey: string, model: string) => Promise<T>,
  userCode?: string
): Promise<T> {
  const config = getAntiLimitConfig(userCode);
  let keys = config.apiKeys && config.apiKeys.length > 0
    ? [...config.apiKeys]
    : (config.customApiKey ? [config.customApiKey] : []);

  if (keys.length === 0) {
    throw new Error('Tidak ada API Key yang tersedia. Silakan masukkan API Key baru di menu Pengaturan API Key.');
  }

  for (let keyIndex = 0; keyIndex < keys.length; keyIndex++) {
    const currentKey = keys[keyIndex];

    for (let modelIndex = 0; modelIndex < ALL_GEMINI_CASCADING_MODELS.length; modelIndex++) {
      const currentModel = ALL_GEMINI_CASCADING_MODELS[modelIndex];

      try {
        const ai = new GoogleGenAI({
          apiKey: currentKey,
          httpOptions: {
            headers: {
              'User-Agent': 'aistudio-build',
            },
          },
        });
        return await fn(ai, currentKey, currentModel);
      } catch (err: any) {
        if (isRateLimitOrDeadKeyError(err)) {
          const errMsg = String(err?.message || '').toUpperCase();
          const status = err?.status || err?.statusCode || 0;
          const isDead = status === 403 || errMsg.includes('API_KEY_INVALID') || errMsg.includes('UNAUTHENTICATED');

          if (isDead) {
            console.warn(`[Auto-Prune] API Key (${currentKey.slice(0, 8)}...) mati/invalid. Menghapus otomatis...`);
            removeDeadKey(currentKey);
            break; // Ke key berikutnya
          } else {
            console.warn(`[Cascading] Model ${currentModel} limit. Mencoba model berikutnya...`);
            if (modelIndex === ALL_GEMINI_CASCADING_MODELS.length - 1) {
              removeDeadKey(currentKey);
            }
            continue; // Ke model berikutnya
          }
        } else {
          throw err;
        }
      }
    }
  }

  throw new Error('Semua API Key dalam pool telah habis atau terkena limit. Silakan masukkan API Key baru di menu Pengaturan.');
}

/**
 * Safe parser JSON dari Response fetch, juga mendeteksi header 'x-dead-keys'
 * atau status 429/403 untuk auto-pruning.
 */
export async function safeParseJson<T = any>(res: Response): Promise<T> {
  // Prune any dead keys reported back in headers by server
  const deadKeysHeader = res.headers.get('x-dead-keys');
  if (deadKeysHeader) {
    const deadKeys = deadKeysHeader.split(',').map((k) => k.trim()).filter(Boolean);
    deadKeys.forEach((k) => removeDeadKey(k));
  }

  const contentType = res.headers.get('content-type') || '';
  
  if (contentType.includes('application/json')) {
    try {
      const data = await res.json();
      if (!res.ok) {
        if (data.deadKey) {
          removeDeadKey(data.deadKey);
        }
        if (isRateLimitOrDeadKeyError(data) || res.status === 429 || res.status === 403) {
          throw new Error(data.error || 'Semua API Key dalam pool telah habis atau terkena limit (429/403). Silakan masukkan API Key baru di menu Pengaturan API Key.');
        }
        throw new Error(data.error || `HTTP Error ${res.status}`);
      }
      return data;
    } catch (e: any) {
      if (e.message && !e.message.includes('JSON')) {
        throw e;
      }
    }
  }

  const text = await res.text();
  if (!res.ok) {
    if (res.status === 429 || res.status === 403 || text.includes('RESOURCE_EXHAUSTED') || text.includes('API_KEY_INVALID')) {
      throw new Error('Semua API Key dalam pool telah habis atau terkena limit (429/403). Silakan masukkan API Key baru di menu Pengaturan API Key.');
    }
    if (text.trim().startsWith('<') || text.toLowerCase().includes('<!doctype html>') || text.toLowerCase().includes('<html')) {
      if (res.status === 413) {
        throw new Error('Ukuran data file terlalu besar. Silakan gunakan file di bawah 20MB.');
      }
      throw new Error(`Server mengalami masalah (${res.status}). Silakan coba lagi.`);
    }
    
    if (res.status === 413) {
      throw new Error('Ukuran data file terlalu besar. Silakan gunakan file di bawah 20MB.');
    }
    throw new Error(text || `HTTP Error ${res.status}`);
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error('Respon dari server tidak dalam format JSON yang valid.');
  }
}
