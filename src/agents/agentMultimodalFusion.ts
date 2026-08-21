import { ExtractedSignals } from './agentSignalExtractor';
import { logAdminAction } from '../lib/admin/auditLog';

export interface FusionScoreResult {
  captionSignalScore: number;
  hashtagSignalScore: number;
  audioSignalScore: number;
  visualSignalScore: number;
  fusedConfidenceScore: number;
  qualityGrade: 'High' | 'Medium' | 'Low';
  timestamp: string;
}

export async function calculateMultimodalFusionScore(
  signals: ExtractedSignals
): Promise<FusionScoreResult> {
  const captionSignalScore = signals.captionSignal && signals.captionSignal.length > 20 ? 88 : 60;
  const hashtagSignalScore = signals.hashtagsSignal && signals.hashtagsSignal.length >= 3 ? 92 : 65;
  const audioSignalScore = signals.audioTranscriptSignal && signals.audioTranscriptSignal.length > 10 ? 85 : 70;
  const visualSignalScore = signals.visualSummarySignal && signals.visualSummarySignal.length > 10 ? 90 : 70;

  // Weighted average: Caption (30%), Visual (30%), Audio (20%), Hashtag (20%)
  const fusedConfidenceScore = Math.round(
    captionSignalScore * 0.3 +
    visualSignalScore * 0.3 +
    audioSignalScore * 0.2 +
    hashtagSignalScore * 0.2
  );

  const qualityGrade = fusedConfidenceScore >= 85 ? 'High' : fusedConfidenceScore >= 70 ? 'Medium' : 'Low';

  const result: FusionScoreResult = {
    captionSignalScore,
    hashtagSignalScore,
    audioSignalScore,
    visualSignalScore,
    fusedConfidenceScore,
    qualityGrade,
    timestamp: new Date().toISOString(),
  };

  logAdminAction(
    'Agent Multimodal Fusion',
    `Multimodal Fusion Score: ${fusedConfidenceScore}/100 (Grade: ${qualityGrade}).`,
    'system',
    'Agent Multimodal Fusion'
  );

  return result;
}
