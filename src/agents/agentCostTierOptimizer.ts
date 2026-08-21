import { logAdminAction } from '../lib/admin/auditLog';

export interface CostTierOptimizationReport {
  totalKeysMonitored: number;
  averageUsagePercent: number;
  recommendedAction: string;
  timestamp: string;
}

export async function optimizeCostAndTiers(
  apiKeys: any[] = []
): Promise<CostTierOptimizationReport> {
  const activeKeys = Array.isArray(apiKeys) ? apiKeys.filter((k) => k.status === 'active') : [];
  const totalKeysMonitored = activeKeys.length;

  let totalUsage = 0;
  let totalLimit = 0;
  activeKeys.forEach((k) => {
    totalUsage += k.dailyUsage || 0;
    totalLimit += k.dailyLimit || 1000;
  });

  const averageUsagePercent = totalLimit > 0 ? Math.round((totalUsage / totalLimit) * 100) : 0;

  let recommendedAction = 'Penggunaan API key berada pada tingkat normal & seimbang.';
  if (averageUsagePercent > 75) {
    recommendedAction = 'Penggunaan API key cukup tinggi (>75%). Direkomendasikan menambah key cadangan di Admin API Keys.';
  } else if (totalKeysMonitored === 0) {
    recommendedAction = 'Tidak ada API Key aktif terdeteksi. Sistem menggunakan fallback server environment key.';
  }

  const report: CostTierOptimizationReport = {
    totalKeysMonitored,
    averageUsagePercent,
    recommendedAction,
    timestamp: new Date().toISOString(),
  };

  logAdminAction(
    'Optimasi Biaya & Tier Model',
    `Laporan jam-an: ${totalKeysMonitored} API keys dipantau. Rata-rata kuota terpakai: ${averageUsagePercent}%. Rekomendasi: ${recommendedAction}`,
    'apikey',
    'Agent Cost Tier Optimizer'
  );

  return report;
}
