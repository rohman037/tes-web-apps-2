import { UserGrowthMetrics } from '../../agents/agentUserGrowthAnalyst';
import { AiAgentItem, getAiAgents, saveAiAgents } from './aiAgents';
import { logAdminAction } from './auditLog';

export interface ScalingDecision {
  metricTrigger: string;
  actionTaken: string;
  appliedAt: string;
}

export interface GrowthScalingState {
  configVersion: number;
  autoApproveConfidenceThreshold: number; // default 90, can go down to 85
  autoTrainerIntervalMinutes: number; // default 60, can go down to 30
  fullAutoModeEnabled: boolean; // toggle for auto-activating new agents without manual approval
  strictAbuseModeEnabled: boolean;
  history: {
    version: number;
    timestamp: string;
    metricsSnapshot: Partial<UserGrowthMetrics>;
    decisions: ScalingDecision[];
  }[];
}

const STORAGE_GROWTH_STATE_KEY = 'satset_growth_scaling_state';

export const DEFAULT_GROWTH_STATE: GrowthScalingState = {
  configVersion: 1,
  autoApproveConfidenceThreshold: 90,
  autoTrainerIntervalMinutes: 60,
  fullAutoModeEnabled: false,
  strictAbuseModeEnabled: false,
  history: [
    {
      version: 1,
      timestamp: new Date().toISOString(),
      metricsSnapshot: { activeClientsCount: 15, weeklyGrowthRatePercent: 10 },
      decisions: [{ metricTrigger: 'Inisialisasi Sistem', actionTaken: 'Konfigurasi bawaan versi 1 diterapkan', appliedAt: new Date().toISOString() }],
    },
  ],
};

export function getGrowthScalingState(): GrowthScalingState {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(STORAGE_GROWTH_STATE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.configVersion === 'number') {
          return parsed;
        }
      }
    }
  } catch (e) {}
  return DEFAULT_GROWTH_STATE;
}

export function saveGrowthScalingState(state: GrowthScalingState): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_GROWTH_STATE_KEY, JSON.stringify(state));
      window.dispatchEvent(new Event('satset_growth_scaling_updated'));
    }
  } catch (e) {
    console.error('[GrowthScaling] Error saving state:', e);
  }
}

/**
 * Evaluates growth metrics against the threshold rules and scales system parameters & agent statuses.
 * Idempotent execution: repeated calls with same metrics result in same state.
 */
export function evaluateGrowthAndScale(
  metrics: UserGrowthMetrics,
  anomalyCount: number = 0,
  approvalRatioPercent: number = 95
): { state: GrowthScalingState; newDecisions: ScalingDecision[] } {
  const currentState = getGrowthScalingState();
  const agents = getAiAgents();
  const decisions: ScalingDecision[] = [];

  let nextConfidenceThreshold = currentState.autoApproveConfidenceThreshold;
  let nextTrainerIntervalMinutes = currentState.autoTrainerIntervalMinutes;
  let nextStrictAbuseMode = currentState.strictAbuseModeEnabled;
  let agentsModified = false;

  const activeClients = metrics.activeClientsCount || 0;
  const dailyGenEvents = metrics.dailyGenerationEventsEstimate || 0;

  // RULE 1: Clients >= 50 -> Activate multi-platform adapter & prompt quality selfcritic
  if (activeClients >= 50) {
    const targetIds = ['agent_multi_platform_adapter', 'agent_prompt_quality_selfcritic'];
    targetIds.forEach((id) => {
      const idx = agents.findIndex((a) => a.id === id);
      if (idx >= 0 && agents[idx].status !== 'active') {
        agents[idx].status = 'active';
        agentsModified = true;
        decisions.push({
          metricTrigger: `Jumlah Klien Aktif = ${activeClients} (≥ 50)`,
          actionTaken: `Mengaktifkan agent ${agents[idx].name} (${id})`,
          appliedAt: new Date().toISOString(),
        });
      }
    });
  }

  // RULE 2: Clients >= 200 -> Activate viral gap benchmark & elevate hook analyzer tier to flagship
  if (activeClients >= 200) {
    const benchmarkIdx = agents.findIndex((a) => a.id === 'agent_viral_gap_benchmark');
    if (benchmarkIdx >= 0 && agents[benchmarkIdx].status !== 'active') {
      agents[benchmarkIdx].status = 'active';
      agentsModified = true;
      decisions.push({
        metricTrigger: `Jumlah Klien Aktif = ${activeClients} (≥ 200)`,
        actionTaken: `Mengaktifkan agent ${agents[benchmarkIdx].name} (agent_viral_gap_benchmark)`,
        appliedAt: new Date().toISOString(),
      });
    }

    const hookIdx = agents.findIndex((a) => a.id === 'agent_hook_analyzer');
    if (hookIdx >= 0 && agents[hookIdx].model !== 'gemini-3.1-pro') {
      agents[hookIdx].model = 'gemini-3.1-pro';
      agentsModified = true;
      decisions.push({
        metricTrigger: `Jumlah Klien Aktif = ${activeClients} (≥ 200)`,
        actionTaken: `Menaikkan tier agent_hook_analyzer ke model Flagship gemini-3.1-pro`,
        appliedAt: new Date().toISOString(),
      });
    }
  }

  // RULE 3: Clients >= 500 -> Activate brand safety compliance full-time & cost tier optimizer
  if (activeClients >= 500) {
    const targetIds = ['agent_compliance_brand_safety', 'agent_cost_tier_optimizer'];
    targetIds.forEach((id) => {
      const idx = agents.findIndex((a) => a.id === id);
      if (idx >= 0 && agents[idx].status !== 'active') {
        agents[idx].status = 'active';
        agentsModified = true;
        decisions.push({
          metricTrigger: `Jumlah Klien Aktif = ${activeClients} (≥ 500)`,
          actionTaken: `Mengaktifkan agent ${agents[idx].name} (${id}) secara full-time`,
          appliedAt: new Date().toISOString(),
        });
      }
    });
  }

  // RULE 4: Generation events >= 1000/day -> Increase auto-trainer cron frequency (60m -> 30m)
  if (dailyGenEvents >= 1000 && nextTrainerIntervalMinutes > 30) {
    nextTrainerIntervalMinutes = 30;
    decisions.push({
      metricTrigger: `Generasi Event/Hari = ${dailyGenEvents} (≥ 1000/hari)`,
      actionTaken: 'Meningkatkan frekuensi cron auto-trainer dari 60 menit menjadi 30 menit',
      appliedAt: new Date().toISOString(),
    });
  }

  // RULE 5: Approval ratio > 90% -> Lower auto-approve threshold by 2 points (max down to 85)
  // MANDATORY CONSTRAINT: herbal_kesehatan is ALWAYS excluded from auto-approve in all code paths!
  if (approvalRatioPercent > 90 && nextConfidenceThreshold > 85) {
    nextConfidenceThreshold = Math.max(85, nextConfidenceThreshold - 2);
    decisions.push({
      metricTrigger: `Rasio Approval Pola = ${approvalRatioPercent}% (> 90%)`,
      actionTaken: `Menurunkan ambang confidence auto-approve menjadi ${nextConfidenceThreshold}% (tetap terkunci wajib review manual untuk kategori herbal_kesehatan)`,
      appliedAt: new Date().toISOString(),
    });
  }

  // RULE 6: Anomaly count > 5x in 24 hours -> Activate strict mode
  if (anomalyCount > 5 && !nextStrictAbuseMode) {
    nextStrictAbuseMode = true;
    decisions.push({
      metricTrigger: `Terdeteksi ${anomalyCount} anomali request (> 5x dalam 24j)`,
      actionTaken: 'Mengaktifkan Mode Ketat Deteksi Anomali & Notifikasi Keamanan Admin',
      appliedAt: new Date().toISOString(),
    });
  }

  if (agentsModified) {
    saveAiAgents(agents);
  }

  if (decisions.length > 0) {
    const nextVersion = currentState.configVersion + 1;
    const newState: GrowthScalingState = {
      ...currentState,
      configVersion: nextVersion,
      autoApproveConfidenceThreshold: nextConfidenceThreshold,
      autoTrainerIntervalMinutes: nextTrainerIntervalMinutes,
      strictAbuseModeEnabled: nextStrictAbuseMode,
      history: [
        {
          version: nextVersion,
          timestamp: new Date().toISOString(),
          metricsSnapshot: metrics,
          decisions,
        },
        ...currentState.history,
      ].slice(0, 50), // Keep last 50 history entries
    };

    saveGrowthScalingState(newState);

    decisions.forEach((d) => {
      logAdminAction(
        'Auto-Scaling Parameter Sistem',
        `${d.metricTrigger} → ${d.actionTaken}`,
        'system',
        'Meta-Agent Auto-Factory'
      );
    });

    return { state: newState, newDecisions: decisions };
  }

  return { state: currentState, newDecisions: [] };
}

/**
 * Rollback system parameter configuration to a specified version in history
 */
export function rollbackGrowthScalingVersion(targetVersion: number): GrowthScalingState {
  const current = getGrowthScalingState();
  const targetHistory = current.history.find((h) => h.version === targetVersion);

  if (!targetHistory) {
    throw new Error(`Versi konfigurasi ${targetVersion} tidak ditemukan dalam riwayat.`);
  }

  const nextVersion = current.configVersion + 1;
  const rollbackDecision: ScalingDecision = {
    metricTrigger: 'Rollback Manual Admin',
    actionTaken: `Mengembalikan konfigurasi sistem ke Versi ${targetVersion}`,
    appliedAt: new Date().toISOString(),
  };

  const newState: GrowthScalingState = {
    ...current,
    configVersion: nextVersion,
    history: [
      {
        version: nextVersion,
        timestamp: new Date().toISOString(),
        metricsSnapshot: targetHistory.metricsSnapshot,
        decisions: [rollbackDecision],
      },
      ...current.history,
    ],
  };

  saveGrowthScalingState(newState);

  logAdminAction(
    'Rollback Auto-Scaling',
    `Admin mengembalikan konfigurasi auto-scaling dari Versi ${current.configVersion} ke Versi ${targetVersion}`,
    'system',
    'Super Admin'
  );

  return newState;
}

export function setFullAutoMode(enabled: boolean): GrowthScalingState {
  const current = getGrowthScalingState();
  const updated: GrowthScalingState = {
    ...current,
    fullAutoModeEnabled: enabled,
  };
  saveGrowthScalingState(updated);

  logAdminAction(
    'Toggle Full Auto Mode',
    `Admin ${enabled ? 'MENGAKTIFKAN' : 'MENONAKTIFKAN'} Full Auto Mode untuk Agent Auto-Factory`,
    'system',
    'Super Admin'
  );

  return updated;
}
