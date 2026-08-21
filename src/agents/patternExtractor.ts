import { GenerationEvent } from '../events/generationEvent';
import { ContentCategory } from '../events/categorize';

export interface ExtractedPatternCandidate {
  id: string;
  patternCategory: 'hook' | 'pacing' | 'formula' | 'category';
  patternName: string;
  description: string;
  category: ContentCategory;
  clientId: string;
  clientName?: string;
  confidence: number; // 0 - 100
  sourceEventIds: string[];
  extractedAt: string;
}

/**
 * Extracts candidate patterns from a list of GenerationEvents.
 * Looks for recurring patterns (occurring >= 3 times) with outcome === 'success'
 * for the same category and client.
 */
export function extractPatternCandidates(
  events: GenerationEvent[],
  clientMap: Record<string, string> = {}
): ExtractedPatternCandidate[] {
  const successfulEvents = events.filter((e) => e.outcome === 'success');
  const candidates: ExtractedPatternCandidate[] = [];

  // Group events by (clientId + category + toneOfVoice/tool)
  const groups: Record<string, GenerationEvent[]> = {};

  for (const event of successfulEvents) {
    const key = `${event.clientId || 'anonymous'}_${event.category || 'umum'}_${event.toneOfVoice || event.tool}`;
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(event);
  }

  for (const [key, groupEvents] of Object.entries(groups)) {
    if (groupEvents.length >= 3) {
      const sample = groupEvents[0];
      const sourceIds = groupEvents.map((e) => e.id);
      const count = groupEvents.length;

      // Calculate confidence based on frequency and consistency
      const rawConfidence = Math.min(96, 75 + count * 4);
      const clientName = clientMap[sample.clientId] || sample.clientId || 'Klien Satset';

      let patternCategory: ExtractedPatternCandidate['patternCategory'] = 'formula';
      let patternName = `Pola Narasi ${sample.category.toUpperCase()}`;
      let description = `Struktur Hook & Pacing konsisten terbukti sukses ${count}x eksekusi pada kategori ${sample.category}`;

      if (sample.toneOfVoice) {
        patternCategory = 'hook';
        patternName = `Hook Tone ${sample.toneOfVoice.toUpperCase()} (${sample.category})`;
        description = `Penggunaan tone ${sample.toneOfVoice} menghasilkan retention tinggi pada ${count} generasi ide konten`;
      } else if (sample.segmentSplit) {
        patternCategory = 'pacing';
        patternName = `Pacing Klip ${sample.segmentSplit}s (${sample.category})`;
        description = `Fragmentasi video ${sample.segmentSplit} detik per segmen konsisten sukses ${count}x`;
      }

      candidates.push({
        id: `pattern_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        patternCategory,
        patternName,
        description,
        category: sample.category,
        clientId: sample.clientId,
        clientName,
        confidence: rawConfidence,
        sourceEventIds: sourceIds,
        extractedAt: new Date().toISOString(),
      });
    }
  }

  return candidates;
}
