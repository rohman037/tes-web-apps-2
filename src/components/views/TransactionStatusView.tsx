'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Search, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Copy, 
  Check, 
  ArrowRight, 
  ChevronLeft, 
  Upload, 
  RefreshCw,
  ShieldCheck,
  FileText,
  Eye,
  EyeOff
} from 'lucide-react';
import { 
  Transaction, 
  getTransactionById, 
  uploadPaymentProof, 
  formatRupiah,
  listenTransactionsUpdated
} from '../../lib/payment';
import { setUserSession } from '../../lib/auth';
import { getWhatsAppUrl } from '../../lib/admin/contactSettings';
import { maskAccessCode } from '../../utils/maskAccessCode';

interface TransactionStatusViewProps {
  initialTrxId?: string;
  onBackToPlans: () => void;
  onSuccessLogin?: () => void;
}

export default function TransactionStatusView({
  initialTrxId = '',
  onBackToPlans,
  onSuccessLogin,
}: TransactionStatusViewProps) {
  const [trxIdInput, setTrxIdInput] = useState(initialTrxId);
  const [searchedTrx, setSearchedTrx] = useState<Transaction | null>(() => {
    if (initialTrxId) {
      return getTransactionById(initialTrxId.trim()) || null;
    }
    return null;
  });
  const [hasSearched, setHasSearched] = useState(() => Boolean(initialTrxId));
  const [copiedCode, setCopiedCode] = useState(false);
  const [showCode, setShowCode] = useState(false);

  // Upload proof fallback if status is PENDING_PROOF
  const [proofBase64, setProofBase64] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleSearch = useCallback(async (queryId?: string) => {
    const target = (queryId || trxIdInput).trim();
    setHasSearched(true);
    if (!target) {
      setSearchedTrx(null);
      return;
    }
    let found = getTransactionById(target);
    if (!found) {
      try {
        const res = await fetch('/api/transactions');
        if (res.ok) {
          const list = await res.json();
          if (Array.isArray(list)) {
            localStorage.setItem('satset_transactions_db', JSON.stringify(list));
            found = list.find((t: any) => t.id && t.id.toLowerCase() === target.toLowerCase()) || null;
          }
        }
      } catch (err) {
        console.warn('Fallback transaction search error:', err);
      }
    }
    setSearchedTrx(found || null);
  }, [trxIdInput]);

  // Realtime polling listener
  useEffect(() => {
    if (!searchedTrx) return;

    const refresh = () => {
      const updated = getTransactionById(searchedTrx.id);
      if (updated) {
        setSearchedTrx(updated);
      }
    };

    const unsubscribe = listenTransactionsUpdated(refresh);
    const interval = setInterval(refresh, 3000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [searchedTrx]);

  const handleCopyCode = () => {
    if (!searchedTrx?.accessCode) return;
    navigator.clipboard.writeText(searchedTrx.accessCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleProofFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setProofBase64(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUploadProof = () => {
    if (!searchedTrx || !proofBase64) return;
    setIsUploading(true);
    setTimeout(() => {
      const updated = uploadPaymentProof(searchedTrx.id, proofBase64);
      if (updated) {
        setSearchedTrx(updated);
      }
      setIsUploading(false);
    }, 600);
  };

  const handleEnterWorkspace = () => {
    if (!searchedTrx?.accessCode) return;
    setUserSession({
      code: searchedTrx.accessCode,
      role: 'user',
      email: searchedTrx.email,
      loginTime: Date.now(),
    });
    if (onSuccessLogin) {
      onSuccessLogin();
    } else {
      window.location.reload();
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12 font-sans text-slate-800">
      {/* Header Bar */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBackToPlans}
          className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-200 transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
        >
          <ChevronLeft className="w-4 h-4 text-slate-500" />
          <span>Kembali ke Paket & Akses</span>
        </button>
      </div>

      {/* Main Search Card */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <Search className="w-6 h-6 text-[#3525cd]" />
            <span>Cek Status Transaksi</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Masukkan Nomor Transaksi (TRX ID) Anda untuk memeriksa status verifikasi dan mengambil Kode Akses.
          </p>
        </div>

        {/* Input Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSearch();
          }}
          className="flex flex-col sm:flex-row items-stretch gap-3"
        >
          <input
            type="text"
            value={trxIdInput}
            onChange={(e) => setTrxIdInput(e.target.value)}
            placeholder="Masukkan ID Transaksi (Contoh: TRX-829104-SAT)"
            className="flex-grow px-4 py-3 rounded-xl bg-slate-50 border border-slate-300 text-sm font-mono text-slate-900 focus:bg-white focus:ring-2 focus:ring-[#3525cd] outline-none"
          />
          <button
            type="submit"
            className="px-6 py-3 rounded-xl bg-[#3525cd] hover:bg-[#2c1eb3] text-white font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-md shadow-indigo-200 shrink-0 cursor-pointer"
          >
            <Search className="w-4 h-4" />
            <span>Periksa Status 🔍</span>
          </button>
        </form>

        {/* Search Results */}
        {hasSearched && !searchedTrx && (
          <div className="p-6 rounded-2xl bg-rose-50 border border-rose-200 text-center space-y-2">
            <AlertCircle className="w-8 h-8 text-rose-600 mx-auto" />
            <h3 className="text-sm font-bold text-rose-900">Transaksi Tidak Ditemukan</h3>
            <p className="text-xs text-rose-700">
              Pastikan Anda memasukkan TRX ID yang tepat (Contoh: <code className="font-mono bg-rose-100 px-1 py-0.5 rounded">TRX-829104-SAT</code>).
            </p>
          </div>
        )}

        {searchedTrx && (
          <div className="space-y-6 pt-4 border-t border-slate-100">
            {/* Transaction Header Info Box */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div>
                <span className="text-slate-400 text-[10px] uppercase font-bold block">ID Transaksi</span>
                <span className="font-mono font-bold text-slate-900 text-sm">{searchedTrx.id}</span>
              </div>

              <div>
                <span className="text-slate-400 text-[10px] uppercase font-bold block">Pelanggan</span>
                <span className="font-bold text-slate-800">{searchedTrx.customerName}</span>
              </div>

              <div>
                <span className="text-slate-400 text-[10px] uppercase font-bold block">Paket Pilih</span>
                <span className="font-bold text-[#3525cd]">{searchedTrx.planName}</span>
              </div>

              <div>
                <span className="text-slate-400 text-[10px] uppercase font-bold block">Total Tagihan</span>
                <span className="font-bold text-slate-900">{formatRupiah(searchedTrx.totalPrice)}</span>
              </div>
            </div>

            {/* STATUS CASE 1: PENDING_PROOF */}
            {searchedTrx.status === 'PENDING_PROOF' && (
              <div className="p-6 rounded-2xl bg-amber-50 border border-amber-200 space-y-4">
                <div className="flex items-center gap-2.5 text-amber-900 font-extrabold text-sm">
                  <AlertCircle className="w-5 h-5 text-amber-600" />
                  <span>Belum Mengunggah Bukti Pembayaran</span>
                </div>
                <p className="text-xs text-amber-800 leading-relaxed">
                  Transaksi ini telah dibuat namun belum menyertakan bukti transfer. Silakan unggah foto bukti pembayaran di bawah ini.
                </p>

                <div className="space-y-3 pt-2">
                  <label className="block p-4 rounded-xl border border-dashed border-amber-300 bg-white text-center cursor-pointer">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleProofFileChange}
                      className="hidden"
                    />
                    {proofBase64 ? (
                      <span className="text-xs font-bold text-emerald-600">✓ Bukti Transfer Dipilih (Klik untuk mengganti)</span>
                    ) : (
                      <span className="text-xs font-bold text-amber-900">📷 Pilih Foto Struk / Bukti Transfer</span>
                    )}
                  </label>

                  <button
                    type="button"
                    onClick={handleUploadProof}
                    disabled={!proofBase64 || isUploading}
                    className="w-full py-3 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm disabled:opacity-50"
                  >
                    <Upload className="w-4 h-4" />
                    <span>Kirim Bukti Pembayaran</span>
                  </button>
                </div>
              </div>
            )}

            {/* STATUS CASE 2: AWAITING_VERIFICATION */}
            {searchedTrx.status === 'AWAITING_VERIFICATION' && (
              <div className="p-6 rounded-2xl bg-amber-50 border border-amber-200 space-y-3 text-center">
                <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto">
                  <Clock className="w-6 h-6 animate-spin" />
                </div>
                <span className="px-3 py-1 rounded-full bg-amber-200 text-amber-900 text-xs font-black uppercase tracking-wider">
                  ⏳ Menunggu Verifikasi oleh Admin
                </span>
                <h3 className="text-lg font-bold text-amber-950">Bukti Transfer Sedang Ditinjau</h3>
                <p className="text-xs text-amber-800 max-w-md mx-auto">
                  Bukti transfer Anda sudah diterima oleh sistem. Admin sedang mencocokkan pembayaran.
                  Status halaman ini akan otomatis berubah menjadi &quot;APPROVED&quot; setelah diverifikasi.
                </p>
              </div>
            )}

            {/* STATUS CASE 3: APPROVED */}
            {searchedTrx.status === 'APPROVED' && (
              <div className="p-6 rounded-2xl bg-emerald-50 border border-emerald-200 text-center space-y-6">
                <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-sm">
                  <CheckCircle2 className="w-8 h-8" />
                </div>

                <div>
                  <span className="px-3 py-1 rounded-full bg-emerald-200 text-emerald-900 text-xs font-black uppercase tracking-wider">
                    VERIFIKASI TERKONFIRMASI
                  </span>
                  <h3 className="text-xl font-extrabold text-slate-900 mt-2">
                    Pembayaran Lunas & Kode Akses Diterbitkan!
                  </h3>
                </div>

                {/* Access Code Box */}
                <div className="p-5 rounded-2xl bg-slate-900 text-white space-y-2 border border-slate-800">
                  <span className="text-[10px] font-bold uppercase text-amber-300">KODE AKSES RESMI ANDA</span>
                  <div className="flex items-center justify-center gap-3">
                    <span className="text-xl sm:text-2xl font-mono font-black text-amber-300">
                      {showCode ? searchedTrx.accessCode : maskAccessCode(searchedTrx.accessCode)}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        if (!showCode) {
                          setShowCode(true);
                          setTimeout(() => setShowCode(false), 5000);
                        } else {
                          setShowCode(false);
                        }
                      }}
                      className="p-2 rounded-xl bg-slate-800 text-slate-200 hover:text-white cursor-pointer"
                      title={showCode ? "Sembunyikan Kode" : "Tampilkan Kode (5 Detik)"}
                    >
                      {showCode ? <EyeOff className="w-4 h-4 text-indigo-400" /> : <Eye className="w-4 h-4" />}
                    </button>
                    <button
                      type="button"
                      onClick={handleCopyCode}
                      className="p-2 rounded-xl bg-slate-800 text-slate-200 hover:text-white cursor-pointer"
                      title="Salin Kode Akses ke Clipboard"
                    >
                      {copiedCode ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-slate-400 pt-1">
                    Masa Berlaku: {searchedTrx.validUntil || 'Aktif'}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleEnterWorkspace}
                  className="w-full py-3.5 px-6 rounded-xl bg-[#3525cd] hover:bg-[#2c1eb3] text-white font-bold text-sm transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Masuk ke Aplikasi Sekarang</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* STATUS CASE 4: REJECTED */}
            {searchedTrx.status === 'REJECTED' && (
              <div className="p-6 rounded-2xl bg-rose-50 border border-rose-200 text-center space-y-4">
                <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
                  <XCircle className="w-6 h-6" />
                </div>
                <span className="px-3 py-1 rounded-full bg-rose-200 text-rose-900 text-xs font-black uppercase tracking-wider">
                  ❌ Pembayaran Ditolak
                </span>
                <p className="text-xs text-rose-800 leading-relaxed max-w-md mx-auto">
                  Alasan Penolakan: <strong>&quot;{searchedTrx.rejectReason || 'Bukti transfer tidak valid'}&quot;</strong>
                  <br />
                  Silakan hubungi admin via WhatsApp jika ada pertanyaan.
                </p>

                <a
                  href={getWhatsAppUrl({
                    whatsappNumber: '',
                    whatsappTemplate: `Halo Admin, saya ingin bertanya terkait Transaksi Ditolak (${searchedTrx.id})`
                  })}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-sm"
                >
                  <span>Hubungi Admin via WhatsApp</span>
                </a>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
