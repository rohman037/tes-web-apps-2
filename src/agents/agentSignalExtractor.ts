import { GoogleGenAI } from '@google/genai';
import { logAdminAction } from '../lib/admin/auditLog';

export interface ExtractedSignals {
  captionSignal: string;
  hashtagsSignal: string[];
  audioTranscriptSignal: string;
  visualSummarySignal: string;
  extractedAt: string;
}

export async function extractMultiModalSignals(
  inputData: { caption?: string; hashtags?: string[]; audioTranscript?: string; visualSummary?: string; rawText?: string },
  apiKey?: string
): Promise<ExtractedSignals> {
  const captionSignal = inputData.caption || inputData.rawText || 'Tidak ada caption.';
  
  // Extract hashtags from text if not provided explicitly
  let hashtagsSignal = inputData.hashtags || [];
  if (hashtagsSignal.length === 0 && captionSignal) {
    const matched = captionSignal.match(/#[a-zA-Z0-9_]+/g);
    if (matched) {
      hashtagsSignal = matched;
    }
  }

  const audioTranscriptSignal = inputData.audioTranscript || 'Transkrip audio diekstrak dari voiceover.';
  const visualSummarySignal = inputData.visualSummary || 'Visual ringkasan adegan utama 3s pertama.';

  const signals: ExtractedSignals = {
    captionSignal,
    hashtagsSignal,
    audioTranscriptSignal,
    visualSummarySignal,
    extractedAt: new Date().toISOString(),
  };

  logAdminAction(
    'Agent Signal Extractor',
    `Ekstraksi sinyal selesai. Caption: ${captionSignal.slice(0, 40)}... Hashtags: ${hashtagsSignal.length} tag.`,
    'system',
    'Agent Signal Extractor'
  );

  return signals;
}
