import { GoogleGenAI } from '@google/genai';
import { resolveApiKey } from '../routing/apiKeyResolver';

export interface TransitionEditingStyleResult {
  transitionTypes: string[];
  editingPacing: string;
  segmentDurations: string[];
  pacingParameters: string;
}

export async function analyzeTransitionEditingStyle(
  descriptionText: string,
  category: string = 'umum'
): Promise<TransitionEditingStyleResult> {
  const keyContext = resolveApiKey('');
  const apiKey = keyContext?.key || process.env.GEMINI_API_KEY || '';

  if (!apiKey) {
    return getFallbackResult();
  }

  try {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: { headers: { 'User-Agent': 'satset-[#3525cd]-agent' } },
    });

    const systemPrompt = `
Anda adalah AGENT GAYA TRANSISI & EDITING untuk platform Satset AI.
Tugas Anda: Identifikasi pola cut/transisi, tempo editing, dan durasi tiap segmen dari deskripsi video, lalu susun sebagai parameter pacing untuk prompt remix.

INPUT KONTEN:
"""
${descriptionText}
Kategori: ${category}
"""

Format output WAJIB JSON persis sesuai struktur ini:
{
  "transitionTypes": ["Quick Jump Cut", "Match Cut Zoom", "Smooth Whip Pan"],
  "editingPacing": "Sangat Cepat (1.5s per cut) / Dynamic High Energy",
  "segmentDurations": ["0-3s Visual Hook", "3-12s Core Demonstration", "12-15s Call to Action"],
  "pacingParameters": "Pacing ritme ritmis tinggi dengan transisi cepat di awal untuk retensi penonton."
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
    console.warn('[TransitionEditingAgent] Execution notice:', err);
  }

  return getFallbackResult();
}

function getFallbackResult(): TransitionEditingStyleResult {
  return {
    transitionTypes: ['Jump Cut Cepat', 'Seamless Zoom Transition'],
    editingPacing: 'Fast Paced (1.8 detik per scene)',
    segmentDurations: ['0-3s Hook pembuka', '3-12s Solusi produk', '12-15s Promo CTA'],
    pacingParameters: 'Ritme editing cepat dengan pemotongan adegan setiap 1.5 - 2 detik untuk memaksimalkan watch-time.',
  };
}
