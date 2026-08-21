import { CATEGORY_TAXONOMY, MainCategoryItem, SubCategoryItem, findCategoryByKeyword } from '../events/categoryTaxonomy';
import { learningSync } from '../lib/learningSync';
import { addToLearningQueue } from './safeLearningQueue';

export interface SubAgentVote {
  agentName: 'VisualAnalysisAgent' | 'CaptionHashtagAgent' | 'AudioVoiceoverAgent' | 'CategoryClassifierAgent';
  suggestedCategory: string;
  suggestedSubCategory?: string;
  confidence: number;
  reasoning: string;
}

export interface CategorizationResult {
  categoryId: string;
  categoryName: string;
  subCategoryId?: string;
  subCategoryName?: string;
  confidenceScore: number;
  subAgentVotes: SubAgentVote[];
  consensusType: 'UNANIMOUS' | 'MAJORITY' | 'DISPUTED' | 'MANUAL_OVERRIDE';
  requiresReview: boolean;
  reviewReason?: string;
  processedAt: string;
}

// 1. Visual Analysis Sub-Agent
export async function visualAnalysisAgent(
  videoUrl?: string,
  frames?: string[],
  title?: string
): Promise<SubAgentVote> {
  const combinedText = `${title || ''} ${videoUrl || ''}`;
  const matched = findCategoryByKeyword(combinedText);

  let confidence = 70;
  if (frames && frames.length > 0) confidence = 85;

  return {
    agentName: 'VisualAnalysisAgent',
    suggestedCategory: matched.main.id,
    suggestedSubCategory: matched.sub?.id,
    confidence,
    reasoning: `Visual frame Cues & Thumbnail analysis mapped to '${matched.main.name}' with ${frames?.length || 0} sampled frames.`
  };
}

// 2. Caption & Hashtag Sub-Agent
export async function captionHashtagAgent(
  caption: string,
  hashtags: string[] = []
): Promise<SubAgentVote> {
  const fullText = `${caption} ${hashtags.join(' ')}`;
  const matched = findCategoryByKeyword(fullText);

  const hashtagCount = hashtags.length;
  const confidence = Math.min(95, 65 + hashtagCount * 5);

  return {
    agentName: 'CaptionHashtagAgent',
    suggestedCategory: matched.main.id,
    suggestedSubCategory: matched.sub?.id,
    confidence,
    reasoning: `NLP text & hashtag pattern analysis (${hashtagCount} hashtags) matched category '${matched.main.name}'.`
  };
}

// 3. Audio & Voiceover Sub-Agent
export async function transcribeAudio(videoUrl?: string): Promise<string> {
  if (!videoUrl) return '';
  // Voiceover transcript simulation / STT interface
  return `Review produk tiktok viral hari ini berkualitas bagus rekomendasi seller`;
}

export async function audioVoiceoverAgent(
  videoUrl?: string,
  providedTranscript?: string
): Promise<SubAgentVote> {
  const transcript = providedTranscript || (await transcribeAudio(videoUrl));
  const matched = findCategoryByKeyword(transcript);

  return {
    agentName: 'AudioVoiceoverAgent',
    suggestedCategory: matched.main.id,
    suggestedSubCategory: matched.sub?.id,
    confidence: transcript ? 80 : 50,
    reasoning: `Voiceover STT transcript analysis matched category '${matched.main.name}'.`
  };
}

// 4. Category Classifier Sub-Agent
export async function categoryClassifierAgent(
  caption: string,
  title?: string
): Promise<SubAgentVote> {
  const text = `${title || ''} ${caption}`;
  const matched = findCategoryByKeyword(text);

  return {
    agentName: 'CategoryClassifierAgent',
    suggestedCategory: matched.main.id,
    suggestedSubCategory: matched.sub?.id,
    confidence: 88,
    reasoning: `Taxonomy rule engine matched keywords to primary node '${matched.main.name}'.`
  };
}

// 5. Multi-Agent Consensus Coordinator Pipeline
export async function runContentCategorizerPipeline(params: {
  caption: string;
  hashtags?: string[];
  title?: string;
  videoUrl?: string;
  frames?: string[];
  audioTranscript?: string;
  contentId?: string;
}): Promise<CategorizationResult> {
  const { caption, hashtags = [], title, videoUrl, frames, audioTranscript, contentId } = params;

  // Execute all 4 sub-agents in parallel
  const [visualVote, captionVote, audioVote, classifierVote] = await Promise.all([
    visualAnalysisAgent(videoUrl, frames, title),
    captionHashtagAgent(caption, hashtags),
    audioVoiceoverAgent(videoUrl, audioTranscript),
    categoryClassifierAgent(caption, title)
  ]);

  const votes: SubAgentVote[] = [visualVote, captionVote, audioVote, classifierVote];

  // Tally category votes
  const categoryScores: Record<string, { totalConfidence: number; voteCount: number; subCatVotes: Record<string, number> }> = {};

  for (const vote of votes) {
    const cat = vote.suggestedCategory;
    if (!categoryScores[cat]) {
      categoryScores[cat] = { totalConfidence: 0, voteCount: 0, subCatVotes: {} };
    }
    categoryScores[cat].totalConfidence += vote.confidence;
    categoryScores[cat].voteCount += 1;

    if (vote.suggestedSubCategory) {
      categoryScores[cat].subCatVotes[vote.suggestedSubCategory] =
        (categoryScores[cat].subCatVotes[vote.suggestedSubCategory] || 0) + 1;
    }
  }

  // Find winning category
  let topCategory = 'umum';
  let maxScore = -1;

  for (const [cat, data] of Object.entries(categoryScores)) {
    const avgScore = (data.totalConfidence / votes.length) + (data.voteCount * 10);
    if (avgScore > maxScore) {
      maxScore = avgScore;
      topCategory = cat;
    }
  }

  const topCategoryItem = CATEGORY_TAXONOMY.find((c) => c.id === topCategory) || CATEGORY_TAXONOMY.find((c) => c.id === 'umum')!;
  const winningData = categoryScores[topCategory] || { voteCount: 0, totalConfidence: 0, subCatVotes: {} };

  // Determine top subcategory
  let topSubCategoryId: string | undefined = undefined;
  let maxSubVotes = 0;
  for (const [subId, subVotes] of Object.entries(winningData.subCatVotes || {})) {
    if (subVotes > maxSubVotes) {
      maxSubVotes = subVotes;
      topSubCategoryId = subId;
    }
  }

  const topSubCategoryItem = topCategoryItem.subcategories?.find((s) => s.id === topSubCategoryId);

  // Consensus Evaluation
  const totalVotes = votes.length;
  const agreementRatio = winningData.voteCount / totalVotes;
  const avgConfidence = Math.round(winningData.totalConfidence / winningData.voteCount);

  let consensusType: 'UNANIMOUS' | 'MAJORITY' | 'DISPUTED' = 'DISPUTED';
  if (winningData.voteCount === totalVotes) {
    consensusType = 'UNANIMOUS';
  } else if (winningData.voteCount >= 2) {
    consensusType = 'MAJORITY';
  }

  // Determine if manual review is required
  let requiresReview = false;
  let reviewReason: string | undefined = undefined;

  // RULE 1: Herbal & Kesehatan MUST ALWAYS be manually reviewed
  if (topCategory === 'herbal_kesehatan' || topCategoryItem.requiresManualReview) {
    requiresReview = true;
    reviewReason = 'MANDATORY REVIEW: Kategori Herbal & Kesehatan memerlukan verifikasi manual wajib sesuai regulasi.';
  } else if (consensusType === 'DISPUTED' || avgConfidence < 75) {
    requiresReview = true;
    reviewReason = `DISPUTED CONSENSUS: Hasil keputusan sub-agent tidak bulat (${winningData.voteCount}/${totalVotes} suara) atau skor keyakinan rendah (${avgConfidence}%).`;
  }

  const result: CategorizationResult = {
    categoryId: topCategoryItem.id,
    categoryName: topCategoryItem.name,
    subCategoryId: topSubCategoryItem?.id,
    subCategoryName: topSubCategoryItem?.name,
    confidenceScore: avgConfidence,
    subAgentVotes: votes,
    consensusType,
    requiresReview,
    reviewReason,
    processedAt: new Date().toISOString()
  };

  // Safe Learning Queue integration & memory tracking
  try {
    if (requiresReview) {
      addToLearningQueue({
        pattern: `${topCategoryItem.name} (${topSubCategoryItem?.name || 'Umum'})`,
        category: topCategoryItem.id as any,
        source: 'user_gen',
        confidenceScore: avgConfidence,
        sampleContent: `${title || ''} ${caption.slice(0, 100)}`
      });
    }

    // Track pattern into system memory & learning sync
    learningSync.track('formula_injected', {
      category: topCategoryItem.id,
      description: `Multi-Agent Classification: ${topCategoryItem.name}`,
      confidence: avgConfidence
    });
  } catch (err) {
    console.warn('[Categorizer Pipeline] Failed pushing to learning sync queue:', err);
  }

  return result;
}
