import { logAdminAction } from '../lib/admin/auditLog';

export interface AbuseAnomalyReport {
  suspiciousActivityCount: number;
  flaggedClients: string[];
  riskLevel: 'Normal' | 'Peringatan' | 'Bahaya';
  actionTaken: string;
  timestamp: string;
}

export async function detectAbuseAndAnomalies(
  logs: any[] = []
): Promise<AbuseAnomalyReport> {
  const flaggedClients: string[] = [];
  let suspiciousCount = 0;

  if (Array.isArray(logs)) {
    const codeAttempts: Record<string, number> = {};
    logs.forEach((log) => {
      if (log && log.client) {
        codeAttempts[log.client] = (codeAttempts[log.client] || 0) + 1;
        if (codeAttempts[log.client] > 20) {
          if (!flaggedClients.includes(log.client)) {
            flaggedClients.push(log.client);
          }
          suspiciousCount++;
        }
      }
    });
  }

  const riskLevel = suspiciousCount > 5 ? 'Bahaya' : suspiciousCount > 0 ? 'Peringatan' : 'Normal';
  const actionTaken =
    riskLevel === 'Bahaya'
      ? 'Terdeteksi >5 percobaan mencurigakan. Notifikasi keamanan dikirim ke Super Admin.'
      : 'Sistem dalam batas wajar & aman.';

  const report: AbuseAnomalyReport = {
    suspiciousActivityCount: suspiciousCount,
    flaggedClients,
    riskLevel,
    actionTaken,
    timestamp: new Date().toISOString(),
  };

  if (suspiciousCount > 0) {
    logAdminAction(
      'Deteksi Anomali & Penyalahgunaan',
      `Deteksi 15m: Terdeteksi ${suspiciousCount} anomali request dari ${flaggedClients.length} klien. Status: ${riskLevel}. ${actionTaken}`,
      'system',
      'Agent Abuse Detector'
    );
  }

  return report;
}
