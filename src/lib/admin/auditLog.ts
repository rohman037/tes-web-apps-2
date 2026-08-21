export interface AuditLogItem {
  id: string;
  adminName: string;
  action: string;
  details: string;
  timestamp: string;
  category: 'package' | 'client' | 'apikey' | 'qris' | 'system';
}

const LOCAL_STORAGE_AUDIT_LOG_KEY = 'satset_audit_logs';

export const DEFAULT_AUDIT_LOGS: AuditLogItem[] = [
  {
    id: 'log_01',
    adminName: 'Super Admin',
    action: 'Update Paket Akses',
    details: 'Mengubah harga Paket Bulanan VIP',
    timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
    category: 'package'
  },
  {
    id: 'log_02',
    adminName: 'Super Admin',
    action: 'Verifikasi Pembayaran',
    details: 'Menyetujui pembayaran TRX-882194 (Rizky Ramadhan)',
    timestamp: new Date(Date.now() - 3600000 * 5).toISOString(),
    category: 'client'
  }
];

export function getAuditLogs(): AuditLogItem[] {
  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_AUDIT_LOG_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {}

    try {
      localStorage.setItem(LOCAL_STORAGE_AUDIT_LOG_KEY, JSON.stringify(DEFAULT_AUDIT_LOGS));
    } catch (e) {}
  }

  return DEFAULT_AUDIT_LOGS;
}

export function logAdminAction(action: string, details: string, category: 'package' | 'client' | 'apikey' | 'qris' | 'system' = 'system', adminName: string = 'Super Admin'): void {
  try {
    const current = getAuditLogs();
    const newLog: AuditLogItem = {
      id: `audit_${Date.now()}`,
      adminName,
      action,
      details,
      timestamp: new Date().toISOString(),
      category
    };
    const updated = [newLog, ...current].slice(0, 100); // Keep last 100
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      localStorage.setItem(LOCAL_STORAGE_AUDIT_LOG_KEY, JSON.stringify(updated));
      window.dispatchEvent(new Event('satset_audit_logs_updated'));
    }
  } catch (e) {
    console.error('[AuditLog Lib] Failed adding log:', e);
  }
}
