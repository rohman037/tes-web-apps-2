import { addSpecificAccessCode } from './auth';
import { getPackages } from './admin/packages';

export type TransactionStatus = 'PENDING_PROOF' | 'AWAITING_VERIFICATION' | 'APPROVED' | 'REJECTED';

export interface PlanItem {
  id: string;
  name: string;
  price: number;
  durationLabel: string;
  durationDays?: number;
  badge?: string;
  description: string;
  features?: string[];
}

export const PLANS: Record<'mingguan' | 'bulanan' | 'lifetime', PlanItem> = {
  mingguan: {
    id: 'mingguan',
    name: 'Paket Mingguan Pro',
    price: 49000,
    durationLabel: '7 Hari',
    durationDays: 7,
    description: 'Akses penuh 7 hari ke seluruh fitur AI Tools Satset.',
    features: ['Akses Penuh Seluruh Fitur AI', 'TikTok Downloader HD No Watermark', '5 Generator Ide Konten FYP']
  },
  bulanan: {
    id: 'bulanan',
    name: 'Paket Bulanan Pro',
    price: 149000,
    durationLabel: '30 Hari',
    durationDays: 30,
    badge: 'Paling Populer',
    description: 'Akses penuh 30 hari + prioritas kuota AI Anti-Limit.',
    features: ['Akses Penuh 30 Hari Tanpa Batas', 'Prioritas Kuota AI Anti-429 Rate Limit', 'Video Splitter Sora, Kling & Runway']
  },
  lifetime: {
    id: 'lifetime',
    name: 'Paket Ultra VIP Lifetime',
    price: 999000,
    durationLabel: 'Lifetime (Selamanya)',
    badge: 'Hemat Best Value',
    description: 'Sekali bayar, akses selamanya tanpa iuran bulanan.',
    features: ['Akses Selamanya Tanpa Iuran', 'Update Fitur & Model AI Gratis', 'Akses VIP Support & Komunitas']
  },
};

export interface QrisConfig {
  imageBase64: string;
  merchantName: string;
}

export interface Transaction {
  id: string; // TRX-XXXXXX-SAT
  customerName: string;
  whatsapp: string;
  email: string;
  planId: string;
  planName: string;
  packageName?: string;
  planPrice: number;
  serviceFee: number; // 2500
  totalPrice: number;
  amount?: number;
  status: TransactionStatus;
  proofImageBase64?: string;
  paymentProofBase64?: string;
  accessCode?: string;
  validUntil?: string; // e.g., "04 September 2026" or "Lifetime (Akses Selamanya)"
  createdAt: number;
  updatedAt: number;
  timestamp?: number;
  note?: string;
  rejectReason?: string;
}

const STORAGE_TRX_KEY = 'satset_transactions_db';
const STORAGE_QRIS_KEY = 'satset_qris_config';

// Default SVG QRIS mock image if none uploaded yet
const DEFAULT_QRIS_SVG = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300"><rect width="300" height="300" fill="%23ffffff"/><rect x="20" y="20" width="260" height="260" fill="none" stroke="%233525cd" stroke-width="4"/><path d="M40 40h70v70H40zM190 40h70v70h-70zM40 190h70v70H40z" fill="%233525cd"/><path d="M55 55h40v40H55zM205 55h40v40h-40zM55 205h40v40H55z" fill="%23ffffff"/><path d="M130 40h30v30h-30zM130 90h40v40h-40zM180 130h30v30h-30zM130 180h40v40h-40zM190 190h30v30h-30zM230 220h30v30h-30zM150 240h30v30h-30z" fill="%233525cd"/><text x="150" y="280" font-family="sans-serif" font-size="12" font-weight="bold" fill="%233525cd" text-anchor="middle">QRIS SATSET OFFICIAL</text></svg>`;

export function getQrisConfig(): QrisConfig {
  try {
    const raw = localStorage.getItem(STORAGE_QRIS_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error('Failed reading QRIS config:', err);
  }
  return {
    imageBase64: DEFAULT_QRIS_SVG,
    merchantName: 'Tools Satset Official (QRIS ALL PAYMENT)',
  };
}

export function updateQrisConfig(newImageBase64: string, merchantName: string = 'Tools Satset Official') {
  const config: QrisConfig = {
    imageBase64: newImageBase64,
    merchantName,
  };
  try {
    localStorage.setItem(STORAGE_QRIS_KEY, JSON.stringify(config));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('satset_qris_updated'));
    }
  } catch (err) {
    console.error('Failed saving QRIS config:', err);
  }
  
  // Also send to backend API
  try {
    const rawSession = localStorage.getItem('satset_user_session');
    const accessCode = rawSession ? JSON.parse(rawSession)?.code || 'SATSET-ADMIN' : 'SATSET-ADMIN';
    fetch('/api/admin/qris', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-access-code': accessCode
      },
      body: JSON.stringify(config),
    }).catch(() => {});
  } catch (e) {
    fetch('/api/admin/qris', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    }).catch(() => {});
  }

  notifyTransactionsUpdated();
}

export function getAllTransactions(): Transaction[] {
  try {
    const raw = localStorage.getItem(STORAGE_TRX_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map((t: any) => ({
          ...t,
          packageName: t.packageName || t.planName || 'Paket Pro',
          amount: t.amount ?? t.totalPrice ?? 0,
          paymentProofBase64: t.paymentProofBase64 || t.proofImageBase64 || '',
          timestamp: t.timestamp || t.createdAt || Date.now()
        }));
      }
    }
  } catch (err) {
    console.error('Failed reading transactions:', err);
  }
  return [];
}

export function saveTransactions(list: Transaction[]) {
  try {
    localStorage.setItem(STORAGE_TRX_KEY, JSON.stringify(list));
  } catch (err) {
    console.error('Failed saving transactions:', err);
  }
  notifyTransactionsUpdated();
}

export function getTransactionById(trxId: string): Transaction | null {
  const list = getAllTransactions();
  const cleaned = trxId.trim().toUpperCase();
  if (!cleaned) return null;
  return list.find((t) => 
    (t.id && t.id.toUpperCase() === cleaned) ||
    (t.whatsapp && t.whatsapp.trim().toUpperCase() === cleaned) ||
    (t.email && t.email.trim().toUpperCase() === cleaned)
  ) || null;
}

export function findTransaction(query: string): Transaction | null {
  return getTransactionById(query);
}

export function createTransaction(params: {
  customerName: string;
  whatsapp: string;
  email: string;
  planId: string;
}): Transaction {
  let planName = 'Paket Pro';
  let planPrice = 149000;

  // Always check current dynamic package list first!
  try {
    const pkgs = getPackages();
    const foundPkg = pkgs.find((p) => p.id === params.planId);
    if (foundPkg) {
      planName = foundPkg.name;
      planPrice = foundPkg.price;
    } else if (PLANS[params.planId as keyof typeof PLANS]) {
      const p = PLANS[params.planId as keyof typeof PLANS];
      planName = p.name;
      planPrice = p.price;
    }
  } catch (e) {
    if (PLANS[params.planId as keyof typeof PLANS]) {
      const p = PLANS[params.planId as keyof typeof PLANS];
      planName = p.name;
      planPrice = p.price;
    }
  }

  const randomNum = Math.floor(100000 + Math.random() * 900000);
  const trxId = `TRX-${randomNum}-SAT`;

  const now = Date.now();
  const newTrx: Transaction = {
    id: trxId,
    customerName: params.customerName.trim(),
    whatsapp: params.whatsapp.trim(),
    email: params.email.trim(),
    planId: params.planId,
    planName: planName,
    packageName: planName,
    planPrice: planPrice,
    serviceFee: 2500,
    totalPrice: planPrice + 2500,
    amount: planPrice + 2500,
    status: 'PENDING_PROOF',
    createdAt: now,
    updatedAt: now,
    timestamp: now
  };

  const current = getAllTransactions();
  saveTransactions([newTrx, ...current]);

  // Sync to server backend
  fetch('/api/transactions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newTrx),
  }).catch(() => {});

  return newTrx;
}

export function uploadPaymentProof(trxId: string, proofImageBase64: string): Transaction | null {
  const current = getAllTransactions();
  const index = current.findIndex((t) => t.id.toUpperCase() === trxId.trim().toUpperCase());
  if (index === -1) return null;

  const now = Date.now();
  const updatedTrx = {
    ...current[index],
    proofImageBase64,
    paymentProofBase64: proofImageBase64,
    status: 'AWAITING_VERIFICATION' as TransactionStatus,
    updatedAt: now,
  };
  current[index] = updatedTrx;

  saveTransactions(current);

  // Sync to server with full transaction payload to handle any potential server-side upserts
  fetch('/api/transactions/proof', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: trxId,
      proofImageBase64,
      transaction: updatedTrx
    }),
  }).catch(() => {});

  return current[index];
}

function generateAccessCodeString(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const group = () => {
    let res = '';
    for (let i = 0; i < 4; i++) {
      res += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return res;
  };
  return `SATSET-${group()}-${group()}-${group()}`;
}

export function approveTransaction(trxId: string): Transaction | null {
  const current = getAllTransactions();
  const index = current.findIndex((t) => t.id.toUpperCase() === trxId.trim().toUpperCase());
  if (index === -1) return null;

  const trx = current[index];
  const accessCode = generateAccessCodeString();

  // Calculate validity
  let validUntilLabel = 'Lifetime (Akses Selamanya)';
  if (trx.planId === 'mingguan') {
    const d = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    validUntilLabel = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  } else if (trx.planId === 'bulanan') {
    const d = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    validUntilLabel = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  // Register access code in auth system
  addSpecificAccessCode(accessCode, `Paket ${trx.planName} - ${trx.customerName}`);

  const now = Date.now();
  current[index] = {
    ...trx,
    status: 'APPROVED',
    accessCode,
    validUntil: validUntilLabel,
    updatedAt: now,
  };

  saveTransactions(current);

  // Sync to server
  fetch('/api/transactions/approve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: trxId, accessCode, validUntil: validUntilLabel }),
  }).catch(() => {});

  return current[index];
}

export function rejectTransaction(trxId: string, reason: string): Transaction | null {
  const current = getAllTransactions();
  const index = current.findIndex((t) => t.id.toUpperCase() === trxId.trim().toUpperCase());
  if (index === -1) return null;

  const targetTrx = current[index];
  const revokedCode = (targetTrx.accessCode || '').trim().toUpperCase();

  // If there was an access code issued, remove it from local storage auth codes
  if (revokedCode) {
    try {
      const rawCodes = localStorage.getItem('satset_valid_access_codes');
      if (rawCodes) {
        const parsed = JSON.parse(rawCodes);
        if (Array.isArray(parsed)) {
          const filtered = parsed.filter((item: any) => (item.code || '').trim().toUpperCase() !== revokedCode);
          localStorage.setItem('satset_valid_access_codes', JSON.stringify(filtered));
          window.dispatchEvent(new Event('satset_access_codes_updated'));
        }
      }
    } catch (e) {}
  }

  const now = Date.now();
  current[index] = {
    ...targetTrx,
    status: 'REJECTED',
    rejectReason: reason.trim() || 'Bukti pembayaran tidak dapat diverifikasi atau tidak sesuai.',
    updatedAt: now,
  };

  saveTransactions(current);

  // Sync to server
  fetch('/api/transactions/reject', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: trxId, rejectReason: reason }),
  }).catch(() => {});

  return current[index];
}

export function notifyTransactionsUpdated() {
  window.dispatchEvent(new Event('transactions-updated'));
}

export function listenTransactionsUpdated(callback: () => void): () => void {
  window.addEventListener('transactions-updated', callback);
  return () => {
    window.removeEventListener('transactions-updated', callback);
  };
}

export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(amount);
}
