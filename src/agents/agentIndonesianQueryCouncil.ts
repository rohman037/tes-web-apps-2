export interface QueryCouncilPersonaResult {
  persona_breakdown: Record<string, string[]>;
  final_short_query_targets: string[];
  final_long_tail_queries: string[];
  seed_queries_used: string[];
}

export function buildQueryCouncilPrompt(
  topic: string,
  groundingContext: string,
  userSeedQueries: string[],
  aeoQueryMode: 'short' | 'long' | 'both'
): string {
  const seedQueriesText = userSeedQueries.length > 0 
    ? `QUERY SEED DARI USER (GROUND TRUTH WAJIB DIPAKAI - JANGAN DIABAIKAN):\n${userSeedQueries.map((q, i) => `${i + 1}. "${q}"`).join('\n')}\n\nATURAN KETAT: 10 persona di bawah WAJIB memperluas/memvariasikan dari seed di atas (sinonim, kombinasi kebutuhan, gaya bahasa berbeda). DILARANG KERAS membuat query yang sama sekali tidak berakar dari seed & topik di atas. Ini untuk mencegah halusinasi.`
    : `TIDAK ADA SEED DARI USER — hasilkan murni dari topik & grounding di atas. WAJIB terasa seperti pencarian nyata orang Indonesia, DILARANG membuat query template generik AI.`;

  return `Anda adalah "Dewan Riset Query 10-Persona Indonesia" — simulasikan 10 gaya pencarian online yang BENAR-BENAR umum dilakukan orang Indonesia untuk topik/produk berikut.

TOPIK/PRODUK: "${topic}"
KONTEKS GROUNDING (jika ada): """${groundingContext || '-'}"""

${seedQueriesText}

SIMULASIKAN 10 PERSONA BERIKUT, MASING-MASING 2-3 QUERY:
1. Pemburu Harga — fokus harga/promo/diskon.
2. Pembanding/Rekomendasi — mencari perbandingan produk.
3. Problem-First — mulai dari keluhan/masalah, bukan nama produk.
4. Review Jujur — mencari validasi sosial/testimoni.
5. Tutorial Pemula — butuh panduan cara pakai/pasang.
6. Casual/Gaul — gaya ngetik santai khas HP orang Indonesia (boleh singkatan wajar: "yg", "ga", "bgt", "gasih").
7. Lokal/Marketplace — menyebut platform (Shopee/Tokopedia/TikTok Shop) atau lokasi.
8. Voice Search — kalimat natural penuh, gaya bicara ke asisten suara.
9. Niche Spesifik — long-tail sangat spesifik ke kondisi/kebutuhan personal.
10. Tren/FYP — terkait sesuatu yang lagi viral/ramai dibahas.

SETELAH 10 PERSONA SELESAI, LAKUKAN GOVERNANCE:
- Hapus duplikat/near-duplikat.
- Hapus query generik yang tidak nyambung ke topik (anti-halusinasi).
- Klasifikasikan tiap query final: "short" (≤4 kata) atau "long" (konversasional).
- Target AEO Query Mode: ${aeoQueryMode.toUpperCase()}. Filter output agar sesuai dengan prioritas ini (tapi tetap sediakan beberapa fallback di kategori lain jika masuk akal).

OUTPUT WAJIB JSON VALID (TANPA MARKDOWN FORMATTING SEPERTI \`\`\`json):
{
  "persona_breakdown": {
    "pemburu_harga": ["..."], "pembanding": ["..."], "problem_first": ["..."],
    "review_jujur": ["..."], "tutorial_pemula": ["..."], "casual_gaul": ["..."],
    "lokal_marketplace": ["..."], "voice_search": ["..."], "niche_spesifik": ["..."],
    "tren_fyp": ["..."]
  },
  "final_short_query_targets": ["..."],
  "final_long_tail_queries": ["..."],
  "seed_queries_used": ${JSON.stringify(userSeedQueries)}
}`;
}

export async function runIndonesianQueryCouncil(
  topic: string,
  groundingContext: string,
  userSeedQueries: string[],
  aeoQueryMode: 'short' | 'long' | 'both',
  callGeminiFn: (model: string, payload: any, customKey?: string, clientAccessCode?: string, tier?: any) => Promise<{ text: string }>,
  userSelectedModel: string,
  customApiKey: string | undefined,
  clientAccessCode: string | undefined,
  councilTier: any
): Promise<QueryCouncilPersonaResult> {
  const queryCouncilPrompt = buildQueryCouncilPrompt(
     topic || 'Topik tidak spesifik, gunakan konteks video',
     groundingContext,
     userSeedQueries,
     aeoQueryMode
  );
  
  const queryCouncilPayload = {
     contents: [{ parts: [{ text: queryCouncilPrompt }] }],
     config: {
         systemInstruction: "You are an expert Indonesian SEO & Search Behavior Analyst.",
         temperature: 0.7,
     }
  };
  
  const queryCouncilResultText = await callGeminiFn(userSelectedModel, queryCouncilPayload, customApiKey, clientAccessCode, councilTier);
  const cleanedText = queryCouncilResultText.text.replace(/```json/gi, '').replace(/```/g, '').trim();
  const queryCouncilResult = JSON.parse(cleanedText) as QueryCouncilPersonaResult;
  return queryCouncilResult;
}
