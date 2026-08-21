import { GoogleGenAI } from '@google/genai';
import { resolveApiKey } from '../routing/apiKeyResolver';

export interface StructuredPromptArchitectResult {
  isOptimized: boolean;
  finalPrompt: string;
  qualityScore: number;
  cinematicScore: number;
  coherenceScore: number;
  optimizationNotes: string;
  targetAI?: string;
}

/**
 * Validates structural consistency between the original draft prompt and the architect's output.
 * Ensures critical markdown headers, bracket tags, and codeblocks are preserved so frontend regex parsers don't break.
 */
export function isStructureSchemaConsistent(original: string, optimized: string): boolean {
  if (!original || !optimized) return false;
  if (typeof optimized !== 'string' || optimized.trim().length === 0) return false;

  // Sanity check: optimized prompt shouldn't lose more than 50% of the original content
  if (optimized.length < original.length * 0.4) {
    return false;
  }

  // Key markdown headers check
  const criticalPatterns = [
    { name: 'Video Klip Header', regex: /(?:^|\n)#{2,4}\s*(?:🎬|🎥|📹)?\s*(?:KLIP|SEGMEN|CLIP|PART|\d+\.)/i },
    { name: 'Master Video Header', regex: /###\s*(?:🎬)?\s*MASTER PROMPT/i },
    { name: 'Photo Prompt Header', regex: /###\s*📸\s*TIKTOK-OPTIMIZED AI PROMPT/i },
    { name: 'Photo Analysis Header', regex: /###\s*🔍\s*ANALISIS MENDALAM/i },
    { name: '[Style] Tag', regex: /\[Style\]:/i },
    { name: '[Camera] Tag', regex: /\[Camera\]:/i },
    { name: '[Actions] Tag', regex: /\[Actions\]:/i },
    { name: '[Lighting] Tag', regex: /\[Lighting\]:/i },
    { name: '[Master Shot] Tag', regex: /\[Master Shot\]:/i },
    { name: '[Subject & Identity] Tag', regex: /\[Subject & Identity\]:/i },
    { name: 'Codeblock Wrapper', regex: /```(?:text|markdown|prompt)?/i },
  ];

  for (const pattern of criticalPatterns) {
    const originalHas = pattern.regex.test(original);
    const optimizedHas = pattern.regex.test(optimized);

    // If original contained this crucial pattern but optimized stripped it, structure is broken
    if (originalHas && !optimizedHas) {
      return false;
    }
  }

  return true;
}

/**
 * Runs the Structured Prompt Architect agent to refine, enrich, and harmonize prompt semantics
 * without altering the markdown tags or structural contract expected by the frontend.
 */
export async function runStructuredPromptArchitect(
  draftPrompt: string,
  targetAI: string = 'general',
  candidateCount: number = 1
): Promise<StructuredPromptArchitectResult> {
  // If draft is trivial, return as-is
  if (!draftPrompt || draftPrompt.trim().length < 20) {
    return getFallbackResult(draftPrompt, targetAI);
  }

  const keyContext = resolveApiKey('');
  const apiKey = keyContext?.key || process.env.GEMINI_API_KEY || '';

  if (!apiKey) {
    return getFallbackResult(draftPrompt, targetAI);
  }

  try {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: { headers: { 'User-Agent': 'satset-structured-prompt-architect-agent' } },
    });

    const systemPrompt = `
Anda adalah SENIOR STRUCTURED PROMPT ARCHITECT untuk Satset AI (Video & Photo AI Prompt Synthesis Engine).

TUGAS UTAMA:
Sempurnakan dan perkaya draft prompt AI di bawah ini untuk platform target "${targetAI.toUpperCase()}".
Perdalam deskripsi visual, detail fisika pencahayaan, arah lensa kamera sinematik, kejelasan ekspresi subjek, dan akurasi aksi.

ATURAN STRUKTURAL SANGAT KETAT (WAJIB DIIKUTI 100%):
1. DRAFT ASLI ADALAH ACUAN SKEMA FORMAT MUTLAK.
2. DILARANG KERAS MENGUBAH, MENAMBAH, MENGURANGI, ATAU MENGACIK NAMA/URUTAN HEADER MARKDOWN DAN TAG KURUNG SIKU.
   - Pertahankan semua header seperti '### 🎬 KLIP PROMPT SEGMEN ...', '### 🎬 MASTER PROMPT ...', '### 📸 TIKTOK-OPTIMIZED AI PROMPT ...', '### 🔍 ANALISIS MENDALAM ...'.
   - Pertahankan semua tag kurung siku seperti '[Style]:', '[Environment]:', '[Tone & Pacing]:', '[Camera]:', '[Lighting]:', '[Actions]:', '[Background Sound]:', '[Transition / Editing]:', '[Call to Action]:', '[Master Shot]:', '[Subject & Identity]:', '[Negative Prompt]:'.
   - Pertahankan blok kode \`\`\`text ... \`\`\` persis di tempatnya semula.
3. Anda HANYA diperbolehkan memperkaya KONTEN/ISI teks di dalam setiap tag/bagian tersebut agar lebih sinematik, fotorealistik, dan presisi tinggi untuk AI Generator.
4. JANGAN menghapus nomor segmen atau timestamp yang sudah ada di draft asli.

DRAFT PROMPT ASLI YANG HARUS DISEMPURNAKAN:
"""
${draftPrompt}
"""

Format output WAJIB JSON persis sesuai struktur ini:
{
  "isOptimized": true,
  "finalPrompt": "Isi lengkap seluruh prompt yang sudah disempurnakan dengan tetap mempertahankan 100% struktur tag dan header markdown asli",
  "qualityScore": 95,
  "cinematicScore": 94,
  "coherenceScore": 96,
  "optimizationNotes": "Peningkatan pencahayaan volumetrik, stabilitas framing kamera, dan kejelasan aksi karakter."
}
`;

    const res = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: systemPrompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    if (res && res.text) {
      const parsed = JSON.parse(res.text);
      if (parsed && typeof parsed.finalPrompt === 'string' && parsed.finalPrompt.trim()) {
        const consistent = isStructureSchemaConsistent(draftPrompt, parsed.finalPrompt);
        if (consistent) {
          return {
            isOptimized: Boolean(parsed.isOptimized ?? true),
            finalPrompt: parsed.finalPrompt.trim(),
            qualityScore: Number(parsed.qualityScore) || 92,
            cinematicScore: Number(parsed.cinematicScore) || 90,
            coherenceScore: Number(parsed.coherenceScore) || 94,
            optimizationNotes: String(parsed.optimizationNotes || 'Struktur prompt dan detail sinematik disempurnakan.'),
            targetAI,
          };
        }
      }
    }
  } catch (err) {
    // Non-blocking catch
    console.warn('[StructuredPromptArchitect] Execution notice:', err);
  }

  return getFallbackResult(draftPrompt, targetAI);
}

function getFallbackResult(draftPrompt: string, targetAI?: string): StructuredPromptArchitectResult {
  return {
    isOptimized: false,
    finalPrompt: draftPrompt,
    qualityScore: 88,
    cinematicScore: 88,
    coherenceScore: 90,
    optimizationNotes: 'Menggunakan draft prompt asli (fallback standar).',
    targetAI,
  };
}
