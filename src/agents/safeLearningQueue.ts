import { ContentCategory } from '../events/categorize';
import { learningSync } from '../lib/learningSync';

export interface SafeLearningItem {
  id: string;
  sourceEventIds: string[];
  sourceUrl?: string;
  clientId?: string;
  clientName?: string;
  category: ContentCategory;
  patternCategory: 'hook' | 'pacing' | 'formula' | 'category';
  patternName: string;
  description: string;
  confidence: number; // 0 - 100
  extractedByAgentId: string;
  extractedAt: string;
  status: 'pending' | 'approved' | 'rejected';
  editedDescription?: string;
  requiresManualReviewOnly?: boolean;
}

const LOCAL_STORAGE_SAFE_QUEUE_KEY = 'satset_safe_learning_queue';
const LOCAL_STORAGE_AUTO_APPROVE_KEY = 'satset_learning_auto_approve';

export const INITIAL_SAFE_QUEUE: SafeLearningItem[] = [
  {
    id: 'learn_101',
    sourceEventIds: ['evt_mock_001', 'evt_mock_002', 'evt_mock_003'],
    sourceUrl: 'https://vt.tiktok.com/ZSY2x9A12/',
    clientId: 'cli_001',
    clientName: 'Rizky Ramadhan (Agensi Digital)',
    category: 'fashion_beauty',
    patternCategory: 'hook',
    patternName: 'Pertanyaan Provokatif Visual Outfit',
    description: 'Buka video dengan "Jangan beli [produk] sebelum tau rahasia bahan ini..." (Meningkatkan retention 3 detik pertama +42%)',
    confidence: 94,
    extractedByAgentId: 'agent_hook_analyzer',
    extractedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    status: 'pending',
  },
  {
    id: 'learn_102',
    sourceEventIds: ['evt_mock_004', 'evt_mock_005'],
    sourceUrl: 'https://vt.tiktok.com/ZSY8xK19A/',
    clientId: 'cli_002',
    clientName: 'Budi Santoso',
    category: 'herbal_kesehatan',
    patternCategory: 'formula',
    patternName: 'Review Manfaat Suplemen Organik',
    description: 'Formula narasi seputar testimoni pengalaman mengonsumsi herbal (Wajib Verifikasi Manual oleh Admin)',
    confidence: 92,
    extractedByAgentId: 'agent_medical_review',
    extractedAt: new Date(Date.now() - 3600000 * 4).toISOString(),
    status: 'pending',
    requiresManualReviewOnly: true, // Herbal kesehatan forced review!
  },
  {
    id: 'learn_103',
    sourceEventIds: ['evt_mock_006', 'evt_mock_007', 'evt_mock_008'],
    sourceUrl: 'https://vt.tiktok.com/ZSY792M1L/',
    clientId: 'cli_001',
    clientName: 'Rizky Ramadhan',
    category: 'rumah_tangga',
    patternCategory: 'pacing',
    patternName: 'Fast Cut 1.5s + Zoom Pop Teks Alat Dapur',
    description: 'Potongan scene berubah setiap 1.5 detik disertai efek suara pop pada kata kunci utama.',
    confidence: 88,
    extractedByAgentId: 'agent_caption_pacing',
    extractedAt: new Date(Date.now() - 3600000 * 8).toISOString(),
    status: 'pending',
  },
];

export function getSafeLearningQueue(): SafeLearningItem[] {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(LOCAL_STORAGE_SAFE_QUEUE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    }
  } catch (e) {
    console.warn('[SafeLearningQueue] Error reading storage:', e);
  }

  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LOCAL_STORAGE_SAFE_QUEUE_KEY, JSON.stringify(INITIAL_SAFE_QUEUE));
    }
  } catch (e) {}

  return INITIAL_SAFE_QUEUE;
}

export function saveSafeLearningQueue(queue: SafeLearningItem[]): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LOCAL_STORAGE_SAFE_QUEUE_KEY, JSON.stringify(queue));
      window.dispatchEvent(new Event('satset_safe_learning_queue_updated'));
    }
  } catch (e) {
    console.error('[SafeLearningQueue] Error saving queue:', e);
  }
}

export function getAutoApproveState(): boolean {
  try {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(LOCAL_STORAGE_AUTO_APPROVE_KEY) === 'true';
    }
  } catch (e) {}
  return false;
}

export function setAutoApproveState(enabled: boolean): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LOCAL_STORAGE_AUTO_APPROVE_KEY, enabled ? 'true' : 'false');
      window.dispatchEvent(new Event('satset_learning_config_updated'));

      // If enabled, process auto-approve for candidates with confidence > 90%
      // EXCEPT category === 'herbal_kesehatan'!
      if (enabled) {
        const queue = getSafeLearningQueue();
        let updated = false;

        const newQueue = queue.map((item) => {
          // MANDATORY EXCLUSION: herbal_kesehatan can NEVER be auto-approved!
          if (
            item.status === 'pending' &&
            item.confidence > 90 &&
            item.category !== 'herbal_kesehatan' &&
            !item.requiresManualReviewOnly
          ) {
            updated = true;
            syncApprovedPatternToBackend(item);
            return { ...item, status: 'approved' as const };
          }
          return item;
        });

        if (updated) {
          saveSafeLearningQueue(newQueue);
        }
      }
    }
  } catch (e) {}
}

export function approveSafeLearningItem(id: string, customDesc?: string): void {
  const queue = getSafeLearningQueue();
  const idx = queue.findIndex((q) => q.id === id);
  if (idx >= 0) {
    queue[idx].status = 'approved';
    if (customDesc) {
      queue[idx].editedDescription = customDesc;
    }
    saveSafeLearningQueue(queue);
    syncApprovedPatternToBackend(queue[idx]);
  }
}

export function rejectSafeLearningItem(id: string): void {
  const queue = getSafeLearningQueue();
  const idx = queue.findIndex((q) => q.id === id);
  if (idx >= 0) {
    queue[idx].status = 'rejected';
    saveSafeLearningQueue(queue);
  }
}

export function enqueueNewCandidate(itemInput: Omit<SafeLearningItem, 'id' | 'status'>): void {
  const queue = getSafeLearningQueue();

  // Check if category is herbal_kesehatan
  const isHerbal = itemInput.category === 'herbal_kesehatan';
  const autoApproveOn = getAutoApproveState();

  // Determine initial status:
  // If autoApproveOn is true, confidence > 90, AND NOT herbal_kesehatan -> auto approve.
  // Otherwise -> pending.
  let initialStatus: 'pending' | 'approved' = 'pending';
  if (autoApproveOn && itemInput.confidence > 90 && !isHerbal && !itemInput.requiresManualReviewOnly) {
    initialStatus = 'approved';
  }

  const newItem: SafeLearningItem = {
    ...itemInput,
    id: `learn_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    status: initialStatus,
    requiresManualReviewOnly: isHerbal || itemInput.requiresManualReviewOnly,
  };

  const updatedQueue = [newItem, ...queue];
  saveSafeLearningQueue(updatedQueue);

  if (initialStatus === 'approved') {
    syncApprovedPatternToBackend(newItem);
  }
}

export function addToLearningQueue(params: {
  pattern: string;
  category: ContentCategory;
  source: string;
  confidenceScore: number;
  sampleContent: string;
}): void {
  enqueueNewCandidate({
    sourceEventIds: [`evt_auto_${Date.now()}`],
    category: params.category,
    patternCategory: 'formula',
    patternName: params.pattern,
    description: params.sampleContent,
    confidence: params.confidenceScore,
    extractedByAgentId: 'agent_multi_classifier',
    extractedAt: new Date().toISOString()
  });
}

function syncApprovedPatternToBackend(item: SafeLearningItem) {
  const insightText = `[Approved Pattern - ${item.category.toUpperCase()}] ${item.patternName}: ${item.editedDescription || item.description}`;
  
  // Track to learning sync engine so backend updates system_memory.json
  learningSync.track('formula_injected', {
    insight: insightText,
    sourceEventIds: item.sourceEventIds,
    category: item.category,
  });

  // Call API learn feedback endpoint
  fetch('/api/learn-feedback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      insight: insightText,
      type: 'contentIdeas',
    }),
  }).catch((e) => console.warn('[SafeLearningQueue] Backend sync notice:', e));
}
