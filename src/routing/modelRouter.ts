import { resolveApiKey, ResolvedKeyContext } from './apiKeyResolver';

export type ModelTier = 'flagship' | 'tier2' | 'tier3' | 'user_key';

export interface ModelRoutingResult {
  modelUsed: string;
  tierUsed: ModelTier;
  text?: string;
}

export const MODEL_TIERS: Record<Exclude<ModelTier, 'user_key'>, string[]> = {
  flagship: ['gemini-3.1-pro-preview', 'gemini-3.1-pro', 'gemini-2.5-pro'],
  tier2: ['gemini-3.6-flash', 'gemini-2.5-flash'],
  tier3: ['gemini-3.1-flash-lite', 'gemini-2.5-flash-lite'],
};

export const TOP_MODEL_ORDER: string[] = [
  'gemini-3.1-pro-preview',
  'gemini-3.1-pro',
  'gemini-3.6-flash',
  'gemini-2.5-pro',
  'gemini-2.5-flash',
  'gemini-3.1-flash-lite',
  'gemini-2.5-flash-lite',
];

/**
 * Evaluates the initial routing tier based on the complexity of the requested task.
 */
export function getInitialTierForTask(aeoQueryMode?: string, hasVideo?: boolean): ModelTier {
  if (aeoQueryMode === 'short' && !hasVideo) {
    return 'tier2';
  }
  return 'flagship';
}

/**
 * Evaluates the model to use and maps execution tier based on user choice,
 * cascading fallback state, and API key source, prioritizing the top model first.
 */
export function getModelRoutingPlan(
  userRequestedModel?: string,
  customApiKeyInput?: string
): { keyContext: ResolvedKeyContext; targetModels: string[]; primaryTier: ModelTier } {
  const keyContext = resolveApiKey(customApiKeyInput);
  const normalizedRequested = (userRequestedModel || '').trim();

  // Build target candidate list with TOP model priority first
  const baseCandidates = normalizedRequested
    ? [normalizedRequested, ...TOP_MODEL_ORDER]
    : [...TOP_MODEL_ORDER];

  const targetModels = Array.from(new Set(baseCandidates)).filter(Boolean);

  if (keyContext.source === 'user_key') {
    return {
      keyContext,
      targetModels,
      primaryTier: 'user_key',
    };
  }

  // Determine primary tier based on the leading model
  const leadingModel = targetModels[0] || 'gemini-3.1-pro-preview';
  let primaryTier: ModelTier = 'flagship';
  if (MODEL_TIERS.tier3.some((m) => m === leadingModel)) {
    primaryTier = 'tier3';
  } else if (MODEL_TIERS.tier2.some((m) => m === leadingModel)) {
    primaryTier = 'tier2';
  }

  return {
    keyContext,
    targetModels,
    primaryTier,
  };
}

/**
 * Maps a specific model used to its corresponding execution tier
 */
export function getTierForModel(modelName: string, isUserKey: boolean): ModelTier {
  if (isUserKey) return 'user_key';
  if (MODEL_TIERS.flagship.includes(modelName)) return 'flagship';
  if (MODEL_TIERS.tier3.includes(modelName)) return 'tier3';
  return 'tier2';
}
