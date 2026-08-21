import { GoogleGenAI } from '@google/genai';
import { resolveApiKey } from '../routing/apiKeyResolver';

export interface MotionCameraAnalysisResult {
  shotType: string;
  cameraMotion: string;
  framingComposition: string;
  technicalInstructions: string;
}

export async function analyzeMotionCameraFraming(
  descriptionText: string,
  category: string = 'umum'
): Promise<MotionCameraAnalysisResult> {
  const keyContext = resolveApiKey('');
  const apiKey = keyContext?.key || process.env.GEMINI_API_KEY || '';

  if (!apiKey) {
    return getFallbackResult(descriptionText);
  }

  try {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: { headers: { 'User-Agent': 'satset-motion-camera-agent' } },
    });

    const systemPrompt = `
Anda adalah AGENT ANALISIS GERAKAN KAMERA & FRAMING untuk platform Satset AI.
Tugas Anda adalah mengekstrak jenis shot, gerakan kamera, dan komposisi framing dari deskripsi video/produk, lalu mengubahnya menjadi instruksi teknis siap pakai untuk prompt remix video AI.

INPUT DESKRIPSI KONTEN:
"""
${descriptionText}
Kategori: ${category}
"""

Format output WAJIB JSON persis seperti berikut:
{
  "shotType": "Medium Close-up / Wide Shot / Tracking Shot",
  "cameraMotion": "Slow Pan Left / Smooth Zoom In / Handheld Dynamic",
  "framingComposition": "Rule of Thirds / Center Frame / Low Angle Perspective",
  "technicalInstructions": "Instruksi teknis gerakan kamera untuk prompt AI (misal: Smooth 35mm lens camera panning left with shallow depth of field)"
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
    console.warn('[MotionCameraAgent] Execution notice:', err);
  }

  return getFallbackResult(descriptionText);
}

function getFallbackResult(descriptionText: string): MotionCameraAnalysisResult {
  return {
    shotType: 'Medium Shot & Close-Up Product Angle',
    cameraMotion: 'Smooth Slow Zoom In ke Subjek',
    framingComposition: 'Center Framing dengan Eye-Level Perspective',
    technicalInstructions: `Cinematic 4K 9:16 vertical video, smooth camera zoom-in toward product centered in frame, shallow depth of field, 60fps lighting. ${descriptionText.slice(0, 50)}`,
  };
}
