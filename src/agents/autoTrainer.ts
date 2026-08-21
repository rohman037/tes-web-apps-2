import { getSafeLearningQueue, saveSafeLearningQueue } from './safeLearningQueue';
import { learningSync } from '../lib/learningSync';
import { logAdminAction } from '../lib/admin/auditLog';

export interface AutoTrainerState {
  lastRunAt: string | null;
  nextRunAt: string | null;
  totalProcessed: number;
  autoApprovedCount: number;
  manualReviewCount: number;
  isRunning: boolean;
}

const STORAGE_KEY = 'satset_auto_trainer_state';

export function getAutoTrainerState(): AutoTrainerState {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          return {
            lastRunAt: parsed.lastRunAt || null,
            nextRunAt: parsed.nextRunAt || new Date(Date.now() + 3600000).toISOString(),
            totalProcessed: typeof parsed.totalProcessed === 'number' ? parsed.totalProcessed : 0,
            autoApprovedCount: typeof parsed.autoApprovedCount === 'number' ? parsed.autoApprovedCount : 0,
            manualReviewCount: typeof parsed.manualReviewCount === 'number' ? parsed.manualReviewCount : 0,
            isRunning: false
          };
        }
      }
    }
  } catch (e) {}

  return {
    lastRunAt: null,
    nextRunAt: new Date(Date.now() + 3600000).toISOString(),
    totalProcessed: 0,
    autoApprovedCount: 0,
    manualReviewCount: 0,
    isRunning: false
  };
}

export function saveAutoTrainerState(state: Partial<AutoTrainerState>): AutoTrainerState {
  const current = getAutoTrainerState();
  const updated: AutoTrainerState = { ...current, ...state };
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      window.dispatchEvent(new Event('satset_auto_trainer_updated'));
    }
  } catch (e) {}
  return updated;
}

/**
 * Executes 1-Hour Auto-Training Job
 */
export function runAutoTrainingJob(): AutoTrainerState {
  const queue = getSafeLearningQueue();
  let autoApprovedCount = 0;
  let manualReviewCount = 0;
  let updated = false;

  const newQueue = queue.map((item) => {
    if (item.status === 'pending') {
      // MANDATORY RULE: Category herbal_kesehatan NEVER auto-merges!
      const isHerbal = item.category === 'herbal_kesehatan';
      const isHighConfidence = item.confidence > 90;

      if (isHighConfidence && !isHerbal && !item.requiresManualReviewOnly) {
        autoApprovedCount++;
        updated = true;

        // Auto-merge pattern directly into System Memory via learning sync
        const insightText = `[Auto-Trained Pattern - ${item.category.toUpperCase()}] ${item.patternName}: ${item.editedDescription || item.description}`;
        learningSync.track('formula_injected', {
          insight: insightText,
          sourceEventIds: item.sourceEventIds,
          category: item.category,
        });

        // Backend API sync
        fetch('/api/learn-feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            insight: insightText,
            type: 'contentIdeas',
          }),
        }).catch(() => {});

        return { ...item, status: 'approved' as const };
      } else {
        manualReviewCount++;
      }
    }
    return item;
  });

  if (updated) {
    saveSafeLearningQueue(newQueue);
  }

  const newState = saveAutoTrainerState({
    lastRunAt: new Date().toISOString(),
    nextRunAt: new Date(Date.now() + 3600000).toISOString(),
    totalProcessed: autoApprovedCount + manualReviewCount,
    autoApprovedCount,
    manualReviewCount,
    isRunning: false,
  });

  // Record execution details in Audit Log
  logAdminAction(
    'Auto-Training Scheduler Per Jam',
    `Proses auto-training 1 jam: ${newState.totalProcessed} pola diperiksa (${autoApprovedCount} auto-merged ke System Memory, ${manualReviewCount} ditahan untuk review manual/herbal_kesehatan)`,
    'system',
    'Cron Auto-Trainer'
  );

  return newState;
}

let schedulerTimer: any = null;

export function initAutoTrainerScheduler(): void {
  if (typeof window === 'undefined') return;
  if (schedulerTimer) return;

  // Run initial pass
  runAutoTrainingJob();

  // Run every 1 hour (3,600,000 ms)
  schedulerTimer = setInterval(() => {
    runAutoTrainingJob();
  }, 3600000);
}
