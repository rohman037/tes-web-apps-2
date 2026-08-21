import { dbGetSystemMemory, dbSaveSystemMemory } from '../db/dbService';
import { logAdminAction } from '../lib/admin/auditLog';
import { dispatchRealtimeBroadcast } from './agentRealtimeBroadcastDispatcher';

export interface HookPatternUpdateResult {
  updatedPatternsCount: number;
  newHookPatternAdded?: string;
  timestamp: string;
}

export async function updateHookPatternSystemMemory(
  newHookPattern: string,
  category: string = 'umum'
): Promise<HookPatternUpdateResult> {
  const currentMemory = await dbGetSystemMemory();
  const viralHooks = Array.isArray(currentMemory.viralHookPatterns) ? currentMemory.viralHookPatterns : [];

  const exists = viralHooks.some(
    (hk: any) => typeof hk === 'string' ? hk === newHookPattern : hk.pattern === newHookPattern
  );

  if (!exists && newHookPattern && newHookPattern.trim().length > 5) {
    viralHooks.push({
      id: `hk_${Date.now()}`,
      pattern: newHookPattern.trim(),
      category,
      confidence: 90,
    });

    currentMemory.viralHookPatterns = viralHooks;
    currentMemory.lastUpdated = new Date().toISOString();
    await dbSaveSystemMemory(currentMemory);

    // Mirror update to Firestore live_state and SSE
    await dispatchRealtimeBroadcast('system_memory_updated', {
      totalExecutions: currentMemory.totalExecutions,
      viralHooksCount: viralHooks.length,
      lastUpdated: currentMemory.lastUpdated,
    });

    logAdminAction(
      'Agent Hook Pattern Updater',
      `Pola Hook Baru berhasil ditambahkan ke Memori Kolektif Sistem: "${newHookPattern}"`,
      'system',
      'Agent Hook Pattern Updater'
    );

    return {
      updatedPatternsCount: viralHooks.length,
      newHookPatternAdded: newHookPattern,
      timestamp: currentMemory.lastUpdated,
    };
  }

  return {
    updatedPatternsCount: viralHooks.length,
    timestamp: new Date().toISOString(),
  };
}
