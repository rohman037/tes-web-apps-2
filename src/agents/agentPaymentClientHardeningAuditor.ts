import { dbGetTransactions, dbGetClients } from '../db/dbService';
import { logAdminAction } from '../lib/admin/auditLog';

export interface PaymentAuditReport {
  totalTransactionsAudited: number;
  totalClientsAudited: number;
  pendingProofCount: number;
  awaitingVerificationCount: number;
  expiredClientsCount: number;
  issuesFound: string[];
  riskStatus: 'Safe' | 'Attention' | 'Critical';
  timestamp: string;
}

export async function auditPaymentAndClientHardening(): Promise<PaymentAuditReport> {
  const transactions = await dbGetTransactions();
  const clients = await dbGetClients();

  let pendingProofCount = 0;
  let awaitingVerificationCount = 0;
  let expiredClientsCount = 0;
  const issuesFound: string[] = [];

  transactions.forEach((tx) => {
    if (tx.status === 'PENDING_PROOF') pendingProofCount++;
    if (tx.status === 'AWAITING_VERIFICATION') awaitingVerificationCount++;
  });

  const now = new Date();
  clients.forEach((client) => {
    if (client.expiryDate) {
      const exp = new Date(client.expiryDate);
      if (exp < now && client.status === 'active') {
        expiredClientsCount++;
        issuesFound.push(`Klien ${client.name} (${client.accessCode}) telah melewati tanggal kadaluarsa tetapi status masih aktif.`);
      }
    }
  });

  const riskStatus = issuesFound.length > 0 || awaitingVerificationCount > 5 ? 'Attention' : 'Safe';

  const report: PaymentAuditReport = {
    totalTransactionsAudited: transactions.length,
    totalClientsAudited: clients.length,
    pendingProofCount,
    awaitingVerificationCount,
    expiredClientsCount,
    issuesFound,
    riskStatus,
    timestamp: new Date().toISOString(),
  };

  logAdminAction(
    'Agent Payment Auditor',
    `Audit Transaksi & Klien: Status [${riskStatus}]. ${awaitingVerificationCount} transaksi menunggu verifikasi, ${expiredClientsCount} klien kadaluarsa butuh update.`,
    'system',
    'Agent Payment Auditor'
  );

  return report;
}
