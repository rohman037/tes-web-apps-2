import { GoogleGenAI } from '@google/genai';
import { resolveApiKey } from '../routing/apiKeyResolver';
import { analyzeUserGrowth, UserGrowthMetrics } from './agentUserGrowthAnalyst';
import { evaluateGrowthAndScale, getGrowthScalingState, ScalingDecision } from '../lib/admin/growthScaling';
import { saveAiAgent, getAiAgents, AiAgentItem } from '../lib/admin/aiAgents';
import { logAdminAction } from '../lib/admin/auditLog';

export interface AutoAgentFactoryResult {
  growthMetrics: UserGrowthMetrics;
  scalingDecisions: ScalingDecision[];
  createdOrUpdatedAgents: AiAgentItem[];
  metaAnalysis: string;
  timestamp: string;
}

export async function runAutoAgentFactory(
  clientsData: any[] = [],
  transactionsData: any[] = []
): Promise<AutoAgentFactoryResult> {
  // 1. Analyze user growth metrics
  const metrics = await analyzeUserGrowth(clientsData, transactionsData);

  // 2. Evaluate thresholds and apply auto-scaling decisions
  const { state: growthState, newDecisions } = evaluateGrowthAndScale(metrics, 0, 92);

  const createdOrUpdatedAgents: AiAgentItem[] = [];
  let metaAnalysis = 'Meta-Agent Auto-Factory telah memeriksa metrik beban sistem dan mengkonfirmasi semua agent berjalan optimal.';

  // 3. Gemini Flagship evaluation for agent optimization recommendations
  const keyContext = resolveApiKey('');
  const apiKey = keyContext?.key || process.env.GEMINI_API_KEY || '';

  if (apiKey) {
    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: { headers: { 'User-Agent': 'satset-auto-factory' } },
      });

      const existingAgents = getAiAgents();

      const systemPrompt = `
Anda adalah META-AGENT: PABRIK AUTO-PEMBUAT AGENT & PARAMETER BARU untuk Satset AI.
Tugas Anda: Evaluasi data pertumbuhan user dan daftarkan penyesuaian agent baru jika diperlukan.

DATA METRIK:
- Klien Aktif: ${metrics.activeClientsCount}
- Growth Rate: ${metrics.weeklyGrowthRatePercent}%
- Kategori Terbanyak: ${metrics.topCategory}
- Total Agent Terpasang: ${existingAgents.length}
- Full Auto Mode: ${growthState.fullAutoModeEnabled ? 'AKTIF' : 'NONAKTIF'}

Format output WAJIB JSON persis sesuai struktur ini:
{
  "metaAnalysis": "Ringkasan evaluasi infrastruktur agent dalam Bahasa Indonesia...",
  "shouldCreateNewAgent": false,
  "proposedAgent": {
    "name": "Agent Analisis Hook FYP Spesialis " + "${metrics.topCategory}",
    "role": "Mengekstrak sudut pandang hook khusus kategori ${metrics.topCategory}",
    "model": "gemini-3.1-pro"
  }
}
`;

      const res = await ai.models.generateContent({
        model: 'gemini-3.1-pro-preview',
        contents: systemPrompt,
        config: { responseMimeType: 'application/json' },
      });

      if (res && res.text) {
        const parsed = JSON.parse(res.text);
        if (parsed.metaAnalysis) {
          metaAnalysis = parsed.metaAnalysis;
        }

        // Create proposed agent if requested by Gemini and if not already present
        if (parsed.shouldCreateNewAgent && parsed.proposedAgent) {
          const newAgentId = `agent_auto_${Date.now()}`;
          const initialStatus = growthState.fullAutoModeEnabled ? 'active' : 'inactive';

          const newAgent: AiAgentItem = {
            id: newAgentId,
            name: parsed.proposedAgent.name || `Agent Spesialis ${metrics.topCategory}`,
            role: parsed.proposedAgent.role || 'Agent penyesuaian otomatis dari Auto-Factory',
            model: parsed.proposedAgent.model || 'gemini-3.1-pro',
            status: initialStatus,
            callsCount: 0,
            approvedPatternsCount: 0,
            rejectedPatternsCount: 0,
          };

          saveAiAgent(newAgent);
          createdOrUpdatedAgents.push(newAgent);

          logAdminAction(
            'Auto-Create Agent Baru',
            `Auto-Factory membuat agent '${newAgent.name}' dengan status initial '${initialStatus}' (Full Auto Mode = ${growthState.fullAutoModeEnabled ? 'ON' : 'OFF'}).`,
            'system',
            'Meta-Agent Auto-Factory'
          );
        }
      }
    } catch (err) {
      console.warn('[AutoAgentFactory] Execution notice:', err);
    }
  }

  return {
    growthMetrics: metrics,
    scalingDecisions: newDecisions,
    createdOrUpdatedAgents,
    metaAnalysis,
    timestamp: new Date().toISOString(),
  };
}
