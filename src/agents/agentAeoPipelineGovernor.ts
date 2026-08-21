import { buildAEOPipelinePrompt, formatAEOOutputToMarkdown, AEOPipelineResult } from './aeoAgentPipeline';
import { logAdminAction } from '../lib/admin/auditLog';

export interface AEOGovernorExecuteResult {
  isConsistent: boolean;
  fanoutQueriesCount: number;
  hasBluffHook: boolean;
  formattedMarkdown: string;
  timestamp: string;
}

export async function governAEOPipelineExecution(
  topicInput: string,
  rawAeoResult?: AEOPipelineResult
): Promise<AEOGovernorExecuteResult> {
  const fanoutQueries = rawAeoResult?.aeo_metadata?.synthetic_fanout_queries || [];
  const hasBluffHook = Boolean(
    rawAeoResult?.content_ideas &&
    rawAeoResult.content_ideas.length > 0 &&
    rawAeoResult.content_ideas[0].bluff_hook_3s
  );

  const hasAeoMappingAndNegativePrompt = Boolean(
    rawAeoResult?.content_ideas &&
    rawAeoResult.content_ideas.every(idea => 
      idea.aeo_query_mapping &&
      (idea.aeo_query_mapping.short?.length > 0 || idea.aeo_query_mapping.long?.length > 0) &&
      idea.scene_prompts &&
      idea.scene_prompts.every(scene => scene.negative_prompt && scene.negative_prompt.trim().length > 0)
    )
  );

  const isConsistent = fanoutQueries.length >= 3 && hasBluffHook && hasAeoMappingAndNegativePrompt;
  const formattedMarkdown = rawAeoResult ? formatAEOOutputToMarkdown(rawAeoResult) : '';

  logAdminAction(
    'Agent AEO Pipeline Governor',
    `Gubernur AEO Verifikasi Pipeline: ${isConsistent ? 'KONSISTEN & VALID' : 'PERLU OPTIMASI'}. Fan-out queries: ${fanoutQueries.length}, BLUFF Hook: ${hasBluffHook ? 'ADA' : 'TIDAK ADA'}.`,
    'system',
    'Agent AEO Pipeline Governor'
  );

  return {
    isConsistent,
    fanoutQueriesCount: fanoutQueries.length,
    hasBluffHook,
    formattedMarkdown,
    timestamp: new Date().toISOString(),
  };
}
