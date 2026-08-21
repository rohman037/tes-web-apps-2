export interface LearningQueueItem {
  id: string;
  sourceSubmissionId?: string;
  sourceUrl?: string;
  clientName?: string;
  patternCategory: 'hook' | 'pacing' | 'formula' | 'category';
  patternName: string;
  description: string;
  confidence: number; // 0 - 100
  extractedByAgentId: string;
  extractedAt: string;
  status: 'pending' | 'approved' | 'rejected';
  editedDescription?: string;
}

const LOCAL_STORAGE_LEARNING_QUEUE_KEY = 'satset_learning_queue';
const LOCAL_STORAGE_AUTO_APPROVE_KEY = 'satset_learning_auto_approve';
const LOCAL_STORAGE_SYSTEM_MEMORY_KEY = 'satset_system_memory_live';

export const DEFAULT_LEARNING_QUEUE: LearningQueueItem[] = [
  {
    id: 'learn_101',
    sourceUrl: 'https://vt.tiktok.com/ZSY2x9A12/',
    clientName: 'Agensi Digital Media',
    patternCategory: 'hook',
    patternName: 'Pertanyaan Provokatif Sisi Gelap Niche',
    description: 'Buka video dengan "Jangan beli [produk] sebelum tau rahasia gelap ini..." (Meningkatkan retention 3 detik pertama +42%)',
    confidence: 94,
    extractedByAgentId: 'agent_hook_analyzer',
    extractedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    status: 'pending'
  },
  {
    id: 'learn_102',
    sourceUrl: 'https://vt.tiktok.com/ZSY8xK19A/',
    clientName: 'Studio Konten Kreator',
    patternCategory: 'pacing',
    patternName: 'Fast Cut 1.5s + Zoom Pop Teks',
    description: 'Potongan scene berubah setiap 1.5 detik disertai efek suara pop pada kata kunci utama.',
    confidence: 88,
    extractedByAgentId: 'agent_caption_pacing',
    extractedAt: new Date(Date.now() - 3600000 * 4).toISOString(),
    status: 'pending'
  },
  {
    id: 'learn_103',
    sourceUrl: 'https://vt.tiktok.com/ZSY792M1L/',
    clientName: 'Ahmad Subagja',
    patternCategory: 'formula',
    patternName: 'Problem -> Agitation -> 3 Langkah Solusi AI',
    description: 'Formula narasi: Tunjukkan masalah riset 5 jam -> Tunjukkan kelelahan -> Berikan solusi 3 klik pakai AI Satset.',
    confidence: 91,
    extractedByAgentId: 'agent_content_idea',
    extractedAt: new Date(Date.now() - 3600000 * 8).toISOString(),
    status: 'pending'
  }
];

export function getLearningQueue(): LearningQueueItem[] {
  if (typeof localStorage === 'undefined') {
    return DEFAULT_LEARNING_QUEUE;
  }
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_LEARNING_QUEUE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {}

  try {
    localStorage.setItem(LOCAL_STORAGE_LEARNING_QUEUE_KEY, JSON.stringify(DEFAULT_LEARNING_QUEUE));
  } catch (e) {}

  return DEFAULT_LEARNING_QUEUE;
}

export function saveLearningQueue(queue: LearningQueueItem[]): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LOCAL_STORAGE_LEARNING_QUEUE_KEY, JSON.stringify(queue));
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('satset_learning_queue_updated'));
    }
  } catch (e) {
    console.error('[LearningQueue Lib] Error saving queue:', e);
  }
}

export function getAutoApproveConfig(): boolean {
  if (typeof localStorage === 'undefined') {
    return false;
  }
  try {
    return localStorage.getItem(LOCAL_STORAGE_AUTO_APPROVE_KEY) === 'true';
  } catch (e) {
    return false;
  }
}

export function setAutoApproveConfig(enabled: boolean): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LOCAL_STORAGE_AUTO_APPROVE_KEY, enabled ? 'true' : 'false');
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('satset_learning_config_updated'));
    }
  } catch (e) {}
}

export function approveLearningItem(id: string, customDesc?: string): void {
  const queue = getLearningQueue();
  const idx = queue.findIndex(q => q.id === id);
  if (idx >= 0) {
    queue[idx].status = 'approved';
    if (customDesc) {
      queue[idx].editedDescription = customDesc;
    }
    saveLearningQueue(queue);

    // Merge into system memory
    mergeItemToSystemMemory(queue[idx]);
  }
}

export function rejectLearningItem(id: string): void {
  const queue = getLearningQueue();
  const idx = queue.findIndex(q => q.id === id);
  if (idx >= 0) {
    queue[idx].status = 'rejected';
    saveLearningQueue(queue);
  }
}

function mergeItemToSystemMemory(item: LearningQueueItem) {
  try {
    let memory: any = { viralHookPatterns: [], formulas: [], memoryLevel: 12 };
    const raw = localStorage.getItem(LOCAL_STORAGE_SYSTEM_MEMORY_KEY);
    if (raw) {
      memory = JSON.parse(raw);
    }

    if (!Array.isArray(memory.viralHookPatterns)) memory.viralHookPatterns = [];
    if (!Array.isArray(memory.formulas)) memory.formulas = [];

    const newPattern = {
      title: item.patternName,
      description: item.editedDescription || item.description,
      approvedAt: new Date().toISOString()
    };

    if (item.patternCategory === 'hook') {
      memory.viralHookPatterns.unshift(newPattern);
    } else {
      memory.formulas.unshift(newPattern);
    }

    memory.memoryLevel = (memory.memoryLevel || 12) + 1;
    localStorage.setItem(LOCAL_STORAGE_SYSTEM_MEMORY_KEY, JSON.stringify(memory));
    window.dispatchEvent(new Event('satset_system_memory_updated'));
  } catch (e) {
    console.error('[LearningQueue] Failed merging to system memory:', e);
  }
}

export function triggerRetrainingNow(): { success: boolean; memoryLevel: number } {
  try {
    let memory: any = { memoryLevel: 15 };
    const raw = localStorage.getItem(LOCAL_STORAGE_SYSTEM_MEMORY_KEY);
    if (raw) {
      memory = JSON.parse(raw);
    }
    memory.lastRetrained = new Date().toISOString();
    memory.memoryLevel = (memory.memoryLevel || 15) + 1;
    localStorage.setItem(LOCAL_STORAGE_SYSTEM_MEMORY_KEY, JSON.stringify(memory));
    window.dispatchEvent(new Event('satset_system_memory_updated'));
    return { success: true, memoryLevel: memory.memoryLevel };
  } catch (e) {
    return { success: false, memoryLevel: 15 };
  }
}
