import { GoogleGenAI } from '@google/genai';
import { resolveApiKey } from '../routing/apiKeyResolver';

export interface UserGrowthMetrics {
  activeClientsCount: number;
  totalTransactionsCount: number;
  weeklyGrowthRatePercent: number;
  topCategory: string;
  dailyGenerationEventsEstimate: number;
  summaryNarrative: string;
  calculatedAt: string;
}

export async function analyzeUserGrowth(
  clients: any[] = [],
  transactions: any[] = []
): Promise<UserGrowthMetrics> {
  const activeClientsCount = Array.isArray(clients) ? clients.length : 0;
  const totalTransactionsCount = Array.isArray(transactions) ? transactions.length : 0;

  // Calculate top category directly in code
  const categoryCounts: Record<string, number> = {};
  if (Array.isArray(transactions)) {
    transactions.forEach((t) => {
      const cat = t.category || t.packageId || 'fashion_beauty';
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    });
  }
  let topCategory = 'fashion_beauty';
  let maxCatCount = 0;
  Object.entries(categoryCounts).forEach(([cat, count]) => {
    if (count > maxCatCount) {
      maxCatCount = count;
      topCategory = cat;
    }
  });

  // Calculate weekly growth estimate
  const weeklyGrowthRatePercent = activeClientsCount > 0 ? Math.min(25, Math.max(5, activeClientsCount * 1.5)) : 0;
  const dailyGenerationEventsEstimate = activeClientsCount * 12;

  let narrative = `Platform saat ini melayani ${activeClientsCount} klien aktif dengan total ${totalTransactionsCount} transaksi. Kategori paling populer adalah '${topCategory}'. Estimasi generasi harian mencapai ${dailyGenerationEventsEstimate} event.`;

  const keyContext = resolveApiKey('');
  const apiKey = keyContext?.key || process.env.GEMINI_API_KEY || '';

  if (apiKey) {
    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: { headers: { 'User-Agent': 'satset-growth-analyst' } },
      });

      const systemPrompt = `
Anda adalah AGENT ANALISIS PERTUMBUHAN & PERILAKU USER untuk Satset AI.
Buat narasi ringkasan eksekutif 2 kalimat dalam Bahasa Indonesia profesional berdasarkan angka metrik berikut:
- Jumlah Klien Aktif: ${activeClientsCount}
- Total Transaksi: ${totalTransactionsCount}
- Growth Rate Mingguan: ${weeklyGrowthRatePercent}%
- Kategori Terlaris: ${topCategory}
- Estimasi Generasi Konten/Hari: ${dailyGenerationEventsEstimate}

Output WAJIB teks ringkasan murni tanpa JSON (maksimal 2-3 kalimat).
`;

      const res = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents: systemPrompt,
      });

      if (res && res.text) {
        narrative = res.text.trim();
      }
    } catch (err) {
      console.warn('[UserGrowthAnalystAgent] Execution notice:', err);
    }
  }

  return {
    activeClientsCount,
    totalTransactionsCount,
    weeklyGrowthRatePercent,
    topCategory,
    dailyGenerationEventsEstimate,
    summaryNarrative: narrative,
    calculatedAt: new Date().toISOString(),
  };
}
