'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Eye, 
  Search, 
  X, 
  Check, 
  AlertTriangle, 
  Copy, 
  Sparkles,
  RefreshCw
} from 'lucide-react';
import DataTable from '../../components/admin/DataTable';
import { 
  getAllTransactions, 
  approveTransaction, 
  rejectTransaction, 
  Transaction, 
  formatRupiah,
  listenTransactionsUpdated
} from '../../lib/payment';
import SafeImage from '../../components/common/SafeImage';
import { maskAccessCode } from '../../utils/maskAccessCode';

export default function PaymentVerificationPanel() {
  const [transactions, setTransactions] = useState<Transaction[]>(() => getAllTransactions());
  const [selectedProofModalTrx, setSelectedProofModalTrx] = useState<Transaction | null>(null);
  const [rejectReasonInput, setRejectReasonInput] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [tabFilter, setTabFilter] = useState<'queue' | 'all'>('queue');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const refreshData = useCallback(async () => {
    try {
      const res = await fetch('/api/transactions');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          const mapped = data.map((t: any) => ({
            ...t,
            packageName: t.packageName || t.planName || 'Paket Pro',
            amount: t.amount ?? t.totalPrice ?? 0,
            paymentProofBase64: t.paymentProofBase64 || t.proofImageBase64 || '',
            timestamp: t.timestamp || t.createdAt || Date.now()
          }));
          setTransactions(mapped);
          localStorage.setItem('satset_transactions_db', JSON.stringify(mapped));
        }
      }
    } catch (e) {
      // Fallback
    }
  }, []);

  useEffect(() => {
    const unsubscribe = listenTransactionsUpdated(refreshData);
    window.addEventListener('storage', refreshData);
    window.addEventListener('transactions-updated', refreshData);
    const interval = setInterval(refreshData, 3000);
    return () => {
      unsubscribe();
      window.removeEventListener('storage', refreshData);
      window.removeEventListener('transactions-updated', refreshData);
      clearInterval(interval);
    };
  }, [refreshData]);

  const safeTransactions = Array.isArray(transactions) ? transactions : [];

  const handleApproveTrx = (trxId: string) => {
    const updated = approveTransaction(trxId);
    if (updated) {
      refreshData();
      setSelectedProofModalTrx(null);
      alert(`✅ Transaksi ${trxId} Berhasil Disetujui!\nKode Akses baru telah diterbitkan: ${updated.accessCode}`);
    }
  };

  const handleRejectTrx = (trxId: string) => {
    if (!rejectReasonInput.trim()) {
      alert('Mohon masukkan alasan penolakan.');
      return;
    }
    const updated = rejectTransaction(trxId, rejectReasonInput.trim());
    if (updated) {
      refreshData();
      setSelectedProofModalTrx(null);
      setShowRejectForm(false);
      setRejectReasonInput('');
      alert(`❌ Transaksi ${trxId} Telah Ditolak.`);
    }
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const pendingQueue = safeTransactions.filter((t) => t.status === 'AWAITING_VERIFICATION');
  const displayedTransactions = (tabFilter === 'queue' ? pendingQueue : safeTransactions).filter((t) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (t.id || '').toLowerCase().includes(q) ||
      (t.customerName || '').toLowerCase().includes(q) ||
      (t.whatsapp || '').toLowerCase().includes(q) ||
      (t.email || '').toLowerCase().includes(q)
    );
  });

  const columns = [
    {
      header: 'ID / Pembeli',
      render: (t: Transaction) => (
        <div className="space-y-0.5">
          <div className="font-mono text-xs font-bold text-[#3525cd]">{t.id}</div>
          <div className="font-extrabold text-slate-900 text-xs">{t.customerName}</div>
          <div className="text-[11px] text-slate-500">{t.whatsapp}</div>
        </div>
      )
    },
    {
      header: 'Paket & Nominal',
      render: (t: Transaction) => (
        <div className="space-y-0.5">
          <div className="font-bold text-slate-800 text-xs">{t.packageName}</div>
          <div className="font-black text-emerald-600 text-xs">{formatRupiah(t.amount)}</div>
        </div>
      )
    },
    {
      header: 'Status & Tanggal',
      render: (t: Transaction) => (
        <div className="space-y-1">
          {t.status === 'AWAITING_VERIFICATION' && (
            <span className="px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 w-fit">
              <Clock className="w-3 h-3 text-amber-500" />
              <span>Pending</span>
            </span>
          )}
          {t.status === 'APPROVED' && (
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 w-fit">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              <span>Approved</span>
            </span>
          )}
          {t.status === 'REJECTED' && (
            <span className="px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 w-fit">
              <XCircle className="w-3 h-3 text-rose-600" />
              <span>Rejected</span>
            </span>
          )}

          <div className="text-[10px] text-slate-400">
            {t.timestamp ? new Date(t.timestamp).toLocaleString('id-ID') : '-'}
          </div>
        </div>
      )
    },
    {
      header: 'Kode Akses Diterbitkan',
      render: (t: Transaction) => (
        t.accessCode ? (
          <div className="flex items-center gap-1.5">
            <code className="font-mono text-xs font-bold text-[#3525cd] bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
              {maskAccessCode(t.accessCode)}
            </code>
            <button
              type="button"
              onClick={() => handleCopyCode(t.accessCode!)}
              className="p-1 rounded hover:bg-slate-100 text-slate-500"
            >
              {copiedCode === t.accessCode ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        ) : (
          <span className="text-slate-400 italic text-[11px]">-</span>
        )
      )
    },
    {
      header: 'Aksi Verifikasi',
      render: (t: Transaction) => (
        <div className="flex items-center gap-2">
          {t.paymentProofBase64 && (
            <button
              type="button"
              onClick={() => {
                setSelectedProofModalTrx(t);
                setShowRejectForm(false);
              }}
              className="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-[#3525cd] font-bold text-xs transition-colors flex items-center gap-1 cursor-pointer border border-indigo-100"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Cek Bukti</span>
            </button>
          )}

          {t.status === 'AWAITING_VERIFICATION' && (
            <button
              type="button"
              onClick={() => handleApproveTrx(t.id)}
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors shadow-xs cursor-pointer flex items-center gap-1"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Setujui</span>
            </button>
          )}
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <DataTable
        title="Verifikasi Antrean Pembayaran QRIS Pembeli"
        subtitle="Periksa bukti transfer QRIS manual yang diunggah oleh pembeli dan terbitkan Kode Akses otomatis."
        columns={columns}
        data={displayedTransactions}
        emptyMessage={tabFilter === 'queue' ? 'Tidak ada antrean pembayaran pending saat ini.' : 'Belum ada transaksi.'}
        filterComponent={
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex rounded-xl bg-slate-200/80 p-1 text-xs font-bold">
              <button
                type="button"
                onClick={() => setTabFilter('queue')}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  tabFilter === 'queue' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Antrean Pending ({pendingQueue.length})
              </button>
              <button
                type="button"
                onClick={() => setTabFilter('all')}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  tabFilter === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Semua Transaksi ({safeTransactions.length})
              </button>
            </div>

            <div className="relative min-w-[200px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari transaksi..."
                className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#3525cd]"
              />
            </div>
          </div>
        }
      />

      {/* PROOF CHECK MODAL */}
      {selectedProofModalTrx && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 border border-slate-100 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  Bukti Pembayaran QRIS — {selectedProofModalTrx.id}
                </h3>
                <p className="text-xs text-slate-500">
                  {selectedProofModalTrx.customerName} ({selectedProofModalTrx.whatsapp})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedProofModalTrx(null)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs space-y-1">
                <div>Paket Dipesan: <span className="font-bold text-slate-900">{selectedProofModalTrx.packageName}</span></div>
                <div>Total Tagihan: <span className="font-black text-emerald-600">{formatRupiah(selectedProofModalTrx.amount)}</span></div>
                <div>Catatan Pembeli: {selectedProofModalTrx.note || '-'}</div>
              </div>

              {selectedProofModalTrx.paymentProofBase64 ? (
                <div className="border border-slate-200 rounded-xl p-2 bg-slate-950 text-center flex justify-center">
                  <SafeImage
                    src={selectedProofModalTrx.paymentProofBase64}
                    alt="Bukti Transfer QRIS"
                    className="max-h-[320px] mx-auto object-contain rounded-lg"
                    width={400}
                    height={320}
                  />
                </div>
              ) : (
                <div className="p-8 bg-slate-50 rounded-xl text-center text-xs text-slate-400">
                  Tidak ada foto bukti transfer terlampir.
                </div>
              )}

              {showRejectForm ? (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl space-y-2">
                  <label className="text-xs font-bold text-rose-900 block">Alasan Penolakan Transaksi:</label>
                  <textarea
                    rows={2}
                    value={rejectReasonInput}
                    onChange={(e) => setRejectReasonInput(e.target.value)}
                    placeholder="misal: Nominal tidak sesuai / foto buram..."
                    className="w-full p-2 bg-white rounded-lg border border-rose-300 text-xs focus:outline-none"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowRejectForm(false)}
                      className="px-3 py-1 rounded-lg bg-slate-200 text-xs font-bold"
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRejectTrx(selectedProofModalTrx.id)}
                      className="px-3 py-1 rounded-lg bg-rose-600 text-white text-xs font-bold"
                    >
                      Tolak
                    </button>
                  </div>
                </div>
              ) : null}
            </div>

            {selectedProofModalTrx.status === 'AWAITING_VERIFICATION' && !showRejectForm && (
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowRejectForm(true)}
                  className="px-4 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition-colors cursor-pointer"
                >
                  Tolak Transaksi
                </button>
                <button
                  type="button"
                  onClick={() => handleApproveTrx(selectedProofModalTrx.id)}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Setujui & Terbitkan Akses</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
