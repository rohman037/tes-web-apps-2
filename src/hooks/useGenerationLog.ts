import { useCallback } from 'react';
import { emitGenerationEvent, GenerationEvent } from '../events/generationEvent';
import { getUserSession } from '../lib/auth';
import { getClients } from '../lib/admin/clients';
import { categorizeContent } from '../events/categorize';
import { getTierForModel } from '../routing/modelRouter';
import { getAntiLimitConfig } from '../lib/antiLimit';
import { runContentAnalysisJob } from '../agents/contentAnalysisJob';

export interface LogGenerationParams {
  tool: 'idea_konten' | 'video_to_prompt' | 'prompt_foto' | 'tiktok_downloader' | 'ekstraktor_frame';
  productName?: string;
  caption?: string;
  topic?: string;
  durationRequested?: number;
  segmentSplit?: number;
  toneOfVoice?: string;
  contentSalesType?: string;
  modelUsed?: string;
  latencyMs: number;
  outcome: 'success' | 'error' | 'flagged';
  errorMessage?: string;
  sourceSubmissionId?: string;
}

export function useGenerationLog() {
  const logGeneration = useCallback((params: LogGenerationParams) => {
    const session = getUserSession();
    const accessCode = session?.code || 'GUEST-ACCESS';
    
    // Resolve client
    let clientId = 'cli_guest';
    let packageTier: GenerationEvent['packageTier'] = 'bulanan_vip';

    if (session && session.code) {
      const clients = getClients();
      const matched = clients.find(
        (c) => c.accessCode.toUpperCase() === session.code.toUpperCase()
      );
      if (matched) {
        clientId = matched.id;
        if (matched.packageId === 'mingguan') packageTier = 'mingguan';
        else if (matched.packageId === 'lifetime') packageTier = 'lifetime';
        else if (matched.packageId === 'custom') packageTier = 'custom';
        else packageTier = 'bulanan_vip';
      }
    }

    // Auto categorize
    const catResult = categorizeContent({
      productName: params.productName,
      caption: params.caption,
      topic: params.topic,
    });

    const category = catResult.category;
    let outcome = params.outcome;
    if (outcome === 'success' && catResult.requiresReview) {
      outcome = 'flagged';
    }

    // Check key source
    const antiLimit = getAntiLimitConfig();
    const isUserKey = Boolean(antiLimit.customApiKey && antiLimit.customApiKey.trim().length > 5);

    const modelUsed = params.modelUsed || 'gemini-3.6-flash';
    const tierUsed = getTierForModel(modelUsed, isUserKey);

    const fullEvent: GenerationEvent = {
      id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      clientId,
      accessCode,
      packageTier,
      tool: params.tool,
      category,
      durationRequested: params.durationRequested,
      segmentSplit: params.segmentSplit,
      toneOfVoice: params.toneOfVoice,
      contentSalesType: params.contentSalesType,
      modelUsed,
      tierUsed,
      latencyMs: params.latencyMs,
      outcome,
      errorMessage: params.errorMessage,
      sourceSubmissionId: params.sourceSubmissionId,
    };

    emitGenerationEvent(fullEvent);

    // Trigger async background content analysis job using Tier 2 keys
    if (outcome === 'success') {
      const textToAnalyze = params.caption || params.topic || params.productName || '';
      runContentAnalysisJob(fullEvent, textToAnalyze);
    }
  }, []);

  return { logGeneration };
}
