import { GoogleGenAI } from '@google/genai';
import { resolveApiKey } from '../routing/apiKeyResolver';

export interface ComplianceBrandSafetyResult {
  isCompliant: boolean;
  riskLevel: 'Aman' | 'Sedang' | 'Tinggi';
  flaggedClaims: string[];
  requiresManualReviewOnly: boolean;
  complianceNotes: string;
}

export async function auditComplianceBrandSafety(
  contentText: string,
  category: string = 'umum'
): Promise<ComplianceBrandSafetyResult> {
  const isHerbalCategory = category === 'herbal_kesehatan';

  const keyContext = resolveApiKey('');
  const apiKey = keyContext?.key || process.env.GEMINI_API_KEY || '';

  if (!apiKey) {
    return getFallbackResult(isHerbalCategory);
  }

  try {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: { headers: { 'User-Agent': 'satset-compliance-agent' } },
    });

    const systemPrompt = `
Anda adalah AGENT KEPATUHAN & KEAMANAN MEREK (Brand Safety Compliance) untuk Satset AI.
Tugas Anda: Audit klaim konten (khususnya herbal_kesehatan, obat, kosmetik, makanan_minuman) dari klaim klaim berlebihan/menyesatkan (overclaim) dan garansi berlebihan.

INPUT KONTEN:
"""
${contentText}
Kategori: ${category}
"""

ATURAN HUKUM & HAK PATEN SANGAT KETAT:
1. Jika Kategori adalah 'herbal_kesehatan', 'requiresManualReviewOnly' HARUS SELALU true.
2. Deteksi kata-kata seperti "pasti sembuh 100%", "langsung langsing 1 hari", "menghilangkan penyakit kronis seketika".
3. Berikan nilai riskLevel: 'Aman', 'Sedang', atau 'Tinggi'.

Format output WAJIB JSON persis sesuai struktur ini:
{
  "isCompliant": false,
  "riskLevel": "Sedang",
  "flaggedClaims": ["Klaim hasil instan 1 hari"],
  "requiresManualReviewOnly": true,
  "complianceNotes": "Terdapat klaim khasiat herbal yang membutuhkan klarifikasi BPOM / review manual."
}
`;

    const res = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite',
      contents: systemPrompt,
      config: { responseMimeType: 'application/json' },
    });

    if (res && res.text) {
      const parsed: ComplianceBrandSafetyResult = JSON.parse(res.text);
      // HARD SECURITY RULE OVERRIDE: herbal_kesehatan ALWAYS requiresManualReviewOnly = true!
      if (isHerbalCategory) {
        parsed.requiresManualReviewOnly = true;
      }
      return parsed;
    }
  } catch (err) {
    console.warn('[ComplianceBrandSafetyAgent] Execution notice:', err);
  }

  return getFallbackResult(isHerbalCategory);
}

function getFallbackResult(isHerbalCategory: boolean): ComplianceBrandSafetyResult {
  return {
    isCompliant: !isHerbalCategory,
    riskLevel: isHerbalCategory ? 'Sedang' : 'Aman',
    flaggedClaims: isHerbalCategory ? ['Klaim khasiat herbal/kesehatan'] : [],
    requiresManualReviewOnly: isHerbalCategory,
    complianceNotes: isHerbalCategory
      ? 'Kategori herbal/kesehatan diwajibkan melalui verifikasi manual admin.'
      : 'Konten memenuhi standar keamanan brand dasar.',
  };
}
