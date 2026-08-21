import { GoogleGenAI } from '@google/genai';
import { resolveApiKey } from '../routing/apiKeyResolver';

export interface MultiPlatformVariant {
  platform: 'TikTok' | 'Instagram Reels' | 'YouTube Shorts';
  aspectRatio: string;
  maxDuration: string;
  adaptedPrompt: string;
  platformTips: string;
}

export interface MultiPlatformAdapterResult {
  variants: MultiPlatformVariant[];
}

export async function adaptPromptMultiPlatform(
  basePrompt: string,
  targetPlatforms: string[] = ['TikTok', 'Instagram Reels', 'YouTube Shorts']
): Promise<MultiPlatformAdapterResult> {
  const keyContext = resolveApiKey('');
  const apiKey = keyContext?.key || process.env.GEMINI_API_KEY || '';

  if (!apiKey) {
    return getFallbackResult(basePrompt);
  }

  try {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: { headers: { 'User-Agent': 'satset-multiplatform-adapter' } },
    });

    const systemPrompt = `
Anda adalah AGENT ADAPTASI MULTI-PLATFORM untuk Satset AI.
Tugas Anda: Sesuaikan prompt video dasar agar optimal untuk platform spesifik:
- TikTok: Format 9:16, durasi ideal 15-60 detik, tone trendy & native.
- Instagram Reels: Format 9:16, durasi ≤90 detik, visual estetik & polished.
- YouTube Shorts: Format 9:16, durasi ≤60 detik, struktur to-the-point & engaging.

INPUT PROMPT DASAR:
"""
${basePrompt}
"""

Format output WAJIB JSON persis sesuai struktur ini:
{
  "variants": [
    {
      "platform": "TikTok",
      "aspectRatio": "9:16",
      "maxDuration": "60s",
      "adaptedPrompt": "Prompt teradaptasi untuk TikTok...",
      "platformTips": "Gunakan audio trending TikTok di detik pertama"
    },
    {
      "platform": "Instagram Reels",
      "aspectRatio": "9:16",
      "maxDuration": "90s",
      "adaptedPrompt": "Prompt teradaptasi untuk Reels...",
      "platformTips": "Fokus pada estetika lighting & color grading"
    },
    {
      "platform": "YouTube Shorts",
      "aspectRatio": "9:16",
      "maxDuration": "60s",
      "adaptedPrompt": "Prompt teradaptasi untuk YouTube Shorts...",
      "platformTips": "Sajikan hook langsung tanpa intro berliku"
    }
  ]
}
`;

    const res = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: systemPrompt,
      config: { responseMimeType: 'application/json' },
    });

    if (res && res.text) {
      return JSON.parse(res.text);
    }
  } catch (err) {
    console.warn('[MultiPlatformAdapterAgent] Execution notice:', err);
  }

  return getFallbackResult(basePrompt);
}

function getFallbackResult(basePrompt: string): MultiPlatformAdapterResult {
  return {
    variants: [
      {
        platform: 'TikTok',
        aspectRatio: '9:16',
        maxDuration: '60s',
        adaptedPrompt: `[TikTok 9:16 Native] ${basePrompt}`,
        platformTips: 'Tambahkan sound efek viral di detik ke-1.',
      },
      {
        platform: 'Instagram Reels',
        aspectRatio: '9:16',
        maxDuration: '90s',
        adaptedPrompt: `[Reels Aesthetic 9:16] ${basePrompt}`,
        platformTips: 'Pastikan pencahayaan terang dan bersih.',
      },
      {
        platform: 'YouTube Shorts',
        aspectRatio: '9:16',
        maxDuration: '60s',
        adaptedPrompt: `[Shorts High Retention 9:16] ${basePrompt}`,
        platformTips: 'Tampilkan nilai utama produk di 2 detik awal.',
      },
    ],
  };
}
