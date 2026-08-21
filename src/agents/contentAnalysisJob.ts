import { GenerationEvent } from '../events/generationEvent';
import { ContentCategory } from '../events/categorize';
import { resolveApiKey } from '../routing/apiKeyResolver';
import { GoogleGenAI } from '@google/genai';
import { enqueueNewCandidate } from './safeLearningQueue';
import { extractPatternCandidates } from './patternExtractor';
import { runOrchestratorPipeline } from './orchestratorAgent';

/**
 * Background Content Analysis & Multi-Agent Orchestration Job:
 * Triggered asynchronously after generation_event.
 * Executes:
 * 1. Orchestrator agent (picks model tier per task)
 * 2. Metadata + caption SEO sub-agent
 * 3. Overlay + voice-over SEO sub-agent
 * 4. Query / trend agent
 * 5. Relevance auditor (visual vs caption vs audio)
 * 6. System memory auto-injection
 */
export async function runContentAnalysisJob(
  event: GenerationEvent,
  generatedContentText?: string
): Promise<void> {
  // Fire-and-forget async execution
  setTimeout(async () => {
    try {
      // 1. Run full Multi-Agent Orchestration Pipeline
      const textToAnalyze = generatedContentText || event.category || '';
      const orchestrationResult = await runOrchestratorPipeline(event, textToAnalyze);

      // 2. Resolve Admin Key for deep categorization
      const keyContext = resolveApiKey('');
      if (!keyContext || !keyContext.key) return;

      const ai = new GoogleGenAI({
        apiKey: keyContext.key,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
      });

      // 3. Call Tier 2 model (gemini-3.6-flash) for deep content analysis & categorization
      const analysisPrompt = `
Anda adalah AI Content Analyzer & Categorizer. Analisis konten hasil generasi berikut secara mendalam:

KONTEN HASIL GENERASI:
"""
${textToAnalyze || event.category || 'Konten umum'}
"""

Hasil Audit Orchestration:
${JSON.stringify(orchestrationResult.relevanceAudit)}

TUGAS ANDA:
1. Tentukan kategori final dari 6 opsi berikut:
   - fashion_beauty (pakaian, baju, kosmetik, perawatan kulit, aksesoris)
   - herbal_kesehatan (suplemen, obat herbal, kesehatan, terapi)
   - rumah_tangga (alat dapur, perabotan, pembersih, dekorasi)
   - teknologi (gadget, hp, elektronik, aplikasi, software)
   - makanan_minuman (kuliner, resep, makanan, jajanan)
   - umum (konten hiburan, lifestyle, umum)

2. Ekstrak sumber referensi jika disebutkan (contoh: URL TikTok / video ID).

Jawab HANYA dalam JSON valid:
{
  "finalCategory": "fashion_beauty",
  "confidence": 92,
  "sourceUrl": "${event.sourceSubmissionId || ''}",
  "reasoning": "Penjelasan singkat"
}
`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: analysisPrompt,
        config: {
          responseMimeType: 'application/json',
        },
      });

      if (!response || !response.text) return;

      const parsed = JSON.parse(response.text);
      const finalCategory: ContentCategory = (parsed.finalCategory as ContentCategory) || event.category || 'umum';
      const confidence = typeof parsed.confidence === 'number' ? parsed.confidence : 88;

      // Enriched event
      const enrichedEvent: GenerationEvent = {
        ...event,
        category: finalCategory,
      };

      // 4. Extract candidate patterns and enqueue to Safe Learning Queue
      const candidates = extractPatternCandidates([enrichedEvent]);
      candidates.forEach((cand) => {
        enqueueNewCandidate({
          sourceEventIds: cand.sourceEventIds,
          sourceUrl: parsed.sourceUrl || event.sourceSubmissionId,
          clientId: cand.clientId,
          clientName: cand.clientName,
          category: cand.category,
          patternCategory: cand.patternCategory,
          patternName: cand.patternName,
          description: cand.description,
          confidence: Math.max(cand.confidence, confidence),
          extractedByAgentId: 'agent_content_analyzer_tier2',
          extractedAt: new Date().toISOString(),
          requiresManualReviewOnly: cand.category === 'herbal_kesehatan',
        });
      });
    } catch (e) {
      console.warn('[ContentAnalysisJob] Background analysis completed with notice:', e);
    }
  }, 100);
}

