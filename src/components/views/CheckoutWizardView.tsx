'use client';

import React, { useState, useEffect } from 'react';
import { 
  Check, 
  Copy, 
  QrCode, 
  Upload, 
  ArrowRight, 
  ShieldCheck, 
  Clock, 
  Download, 
  Sparkles, 
  ChevronLeft, 
  Phone, 
  Mail, 
  User, 
  FileText, 
  CheckCircle2, 
  AlertCircle,
  HelpCircle,
  ArrowUpRight,
  Loader2,
  Eye,
  EyeOff
} from 'lucide-react';
import SafeImage from '../common/SafeImage';
import { maskAccessCode } from '../../utils/maskAccessCode';
import { 
  PLANS, 
  PlanItem, 
  Transaction, 
  createTransaction, 
  uploadPaymentProof, 
  getQrisConfig, 
  getTransactionById,
  listenTransactionsUpdated,
  formatRupiah 
} from '../../lib/payment';
import { setUserSession } from '../../lib/auth';
import { getPackages } from '../../lib/admin/packages';

interface CheckoutWizardViewProps {
  selectedPlanId: string;
  onBackToPlans: () => void;
  onOpenStatusCheck: (trxId?: string) => void;
  onSuccessLogin?: () => void;
}

export default function CheckoutWizardView({
  selectedPlanId,
  onBackToPlans,
  onOpenStatusCheck,
  onSuccessLogin,
}: CheckoutWizardViewProps) {
  const [allPkgs, setAllPkgs] = useState(() => getPackages());

  useEffect(() => {
    const handlePkgUpdate = () => {
      setAllPkgs(getPackages());
    };
    window.addEventListener('satset_packages_updated', handlePkgUpdate);
    window.addEventListener('storage', handlePkgUpdate);
    return () => {
      window.removeEventListener('satset_packages_updated', handlePkgUpdate);
      window.removeEventListener('storage', handlePkgUpdate);
    };
  }, []);

  const dynamicPkg = allPkgs.find((p) => p.id === selectedPlanId);
  const isPkgDeactivated = dynamicPkg && !dynamicPkg.isActive;

  const plan: PlanItem = dynamicPkg
    ? {
        id: dynamicPkg.id,
        name: dynamicPkg.name,
        price: dynamicPkg.price,
        durationLabel: `${dynamicPkg.durationDays} Hari`,
        durationDays: dynamicPkg.durationDays,
        description: dynamicPkg.tagline || '',
        features: dynamicPkg.features || []
      }
    : PLANS[selectedPlanId as keyof typeof PLANS] || PLANS.bulanan;

  // Step 1: Customer info form state
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [customerName, setCustomerName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Active Transaction State
  const [activeTrx, setActiveTrx] = useState<Transaction | null>(null);

  // Step 2: Payment Proof Upload state
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofBase64, setProofBase64] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [copiedTrxId, setCopiedTrxId] = useState(false);
  const [copiedAccessCode, setCopiedAccessCode] = useState(false);
  const [showCode, setShowCode] = useState(false);

  // QRIS Config
  const [qrisConfig, setQrisConfig] = useState(() => getQrisConfig());

  useEffect(() => {
    // Fetch latest QRIS config from backend API
    fetch('/api/admin/qris')
      .then((res) => res.json())
      .then((data) => {
        if (data && data.imageBase64) {
          setQrisConfig(data);
        }
      })
      .catch(() => {});
  }, []);

  // Poll transaction status if in Step 2 awaiting verification
  useEffect(() => {
    if (!activeTrx || currentStep !== 2) return;

    const checkStatus = () => {
      const updated = getTransactionById(activeTrx.id);
      if (updated) {
        setActiveTrx(updated);
        if (updated.status === 'APPROVED') {
          setCurrentStep(3);
        }
      }
    };

    const unsubscribe = listenTransactionsUpdated(checkStatus);
    const interval = setInterval(checkStatus, 3000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [activeTrx, currentStep]);

  // Handle Step 1 Submit -> Create Transaction & Go to Step 2
  const handleStep1Submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim()) {
      setFormError('Mohon masukkan Nama Lengkap Anda.');
      return;
    }
    if (!whatsapp.trim() || whatsapp.trim().length < 8) {
      setFormError('Mohon masukkan Nomor WhatsApp yang valid (min. 8 digit).');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setFormError('Mohon masukkan Alamat Gmail/Email yang valid.');
      return;
    }

    setFormError(null);
    const trx = createTransaction({
      customerName,
      whatsapp,
      email,
      planId: selectedPlanId,
    });
    setActiveTrx(trx);
    setCurrentStep(2);
  };

  // Handle Proof File Selection
  const handleProofFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setProofFile(file);
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setProofBase64(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle Step 2 Submit Proof -> Send to Admin Queue
  const handleStep2SubmitProof = () => {
    if (!activeTrx) return;
    if (!proofBase64) {
      alert('Mohon unggah foto bukti pembayaran / struk transfer terlebih dahulu.');
      return;
    }

    setIsUploading(true);
    setTimeout(() => {
      const updated = uploadPaymentProof(activeTrx.id, proofBase64);
      if (updated) {
        setActiveTrx(updated);
      }
      setIsUploading(false);
    }, 600);
  };

  const handleCopyTrxId = () => {
    if (!activeTrx) return;
    navigator.clipboard.writeText(activeTrx.id);
    setCopiedTrxId(true);
    setTimeout(() => setCopiedTrxId(false), 2000);
  };

  const handleCopyAccessCode = () => {
    if (!activeTrx?.accessCode) return;
    navigator.clipboard.writeText(activeTrx.accessCode);
    setCopiedAccessCode(true);
    setTimeout(() => setCopiedAccessCode(false), 2000);
  };

  const handleDownloadQris = () => {
    if (!qrisConfig.imageBase64) return;
    const link = document.createElement('a');
    link.href = qrisConfig.imageBase64;
    link.download = `QRIS-Payment-${plan.name.replace(/\s+/g, '-')}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleEnterWorkspace = () => {
    if (!activeTrx?.accessCode) return;
    // Set user session automatically
    setUserSession({
      code: activeTrx.accessCode,
      role: 'user',
      email: activeTrx.email,
      loginTime: Date.now(),
    });
    if (onSuccessLogin) {
      onSuccessLogin();
    } else {
      window.location.reload();
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12 font-sans text-slate-800">
      {/* Top Navigation */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBackToPlans}
          className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-200 transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
        >
          <ChevronLeft className="w-4 h-4 text-slate-500" />
          <span>Kembali ke Pilihan Paket</span>
        </button>

        <button
          type="button"
          onClick={() => onOpenStatusCheck(activeTrx?.id)}
          className="text-xs font-bold text-[#3525cd] hover:underline flex items-center gap-1 cursor-pointer"
        >
          <span>Sudah Bayar? Cek Status Transaksi</span>
          <ArrowUpRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Stepper Header Bar */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-6 shadow-sm">
        <div className="grid grid-cols-3 gap-2 relative">
          {/* Step 1 Indicator */}
          <div className={`flex flex-col sm:flex-row items-center gap-2 sm:gap-3 p-2 rounded-xl text-center sm:text-left transition-all ${
            currentStep === 1 ? 'bg-indigo-50/80 border border-indigo-100 text-[#3525cd]' : 'text-slate-400'
          }`}>
            <div className={`w-8 h-8 rounded-xl font-black text-xs flex items-center justify-center shrink-0 ${
              currentStep === 1 ? 'bg-[#3525cd] text-white shadow-xs' : currentStep > 1 ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-500'
            }`}>
              {currentStep > 1 ? <Check className="w-4 h-4 stroke-[3]" /> : '1'}
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider hidden sm:block">Langkah 1</p>
              <p className="text-xs font-extrabold truncate">Data Pelanggan</p>
            </div>
          </div>

          {/* Step 2 Indicator */}
          <div className={`flex flex-col sm:flex-row items-center gap-2 sm:gap-3 p-2 rounded-xl text-center sm:text-left transition-all ${
            currentStep === 2 ? 'bg-indigo-50/80 border border-indigo-100 text-[#3525cd]' : 'text-slate-400'
          }`}>
            <div className={`w-8 h-8 rounded-xl font-black text-xs flex items-center justify-center shrink-0 ${
              currentStep === 2 ? 'bg-[#3525cd] text-white shadow-xs' : currentStep > 2 ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-500'
            }`}>
              {currentStep > 2 ? <Check className="w-4 h-4 stroke-[3]" /> : '2'}
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider hidden sm:block">Langkah 2</p>
              <p className="text-xs font-extrabold truncate">Pembayaran QRIS</p>
            </div>
          </div>

          {/* Step 3 Indicator */}
          <div className={`flex flex-col sm:flex-row items-center gap-2 sm:gap-3 p-2 rounded-xl text-center sm:text-left transition-all ${
            currentStep === 3 ? 'bg-indigo-50/80 border border-indigo-100 text-[#3525cd]' : 'text-slate-400'
          }`}>
            <div className={`w-8 h-8 rounded-xl font-black text-xs flex items-center justify-center shrink-0 ${
              currentStep === 3 ? 'bg-emerald-500 text-white shadow-xs' : 'bg-slate-100 text-slate-500'
            }`}>
              <Check className="w-4 h-4 stroke-[3]" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider hidden sm:block">Langkah 3</p>
              <p className="text-xs font-extrabold truncate">Konfirmasi & Kode</p>
            </div>
          </div>
        </div>
      </div>

      {/* STEP 1: CUSTOMER INFO FORM */}
      {currentStep === 1 && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Customer Input Form (8 cols) */}
          <div className="lg:col-span-7 bg-white border border-slate-200/80 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
            <div>
              <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                <User className="w-5 h-5 text-[#3525cd]" />
                <span>1. Isikan Data Pelanggan</span>
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Data ini digunakan untuk pengiriman Notifikasi WhatsApp dan Penerbitan Lisensi Kode Akses.
              </p>
            </div>

            <form onSubmit={handleStep1Submit} className="space-y-4">
              {formError && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Nama Lengkap */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-slate-500" />
                  Nama Lengkap
                </label>
                <input
                  type="text"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Contoh: Budi Santoso"
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-300 text-xs sm:text-sm text-slate-900 focus:bg-white focus:ring-2 focus:ring-[#3525cd] outline-none transition-all"
                />
              </div>

              {/* WhatsApp */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-emerald-600" />
                  Nomor WhatsApp Aktif
                </label>
                <input
                  type="tel"
                  required
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  placeholder="Contoh: 081234567890"
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-300 text-xs sm:text-sm text-slate-900 focus:bg-white focus:ring-2 focus:ring-[#3525cd] outline-none transition-all"
                />
                <p className="text-[11px] text-slate-400">
                  *Notifikasi lisensi & pengingat paket akan dikirimkan langsung ke nomor WhatsApp ini.
                </p>
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-indigo-500" />
                  Alamat Gmail / Email
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Contoh: budi@gmail.com"
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-300 text-xs sm:text-sm text-slate-900 focus:bg-white focus:ring-2 focus:ring-[#3525cd] outline-none transition-all"
                />
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  className="w-full py-3.5 px-6 rounded-xl bg-[#3525cd] hover:bg-[#2c1eb3] text-white font-bold text-sm transition-all shadow-md shadow-indigo-200 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Lanjut ke Pembayaran QRIS</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          </div>

          {/* Order Summary Sidebar Box (5 cols) */}
          <div className="lg:col-span-5 bg-gradient-to-b from-slate-900 to-indigo-950 text-white rounded-2xl p-6 sm:p-8 shadow-lg space-y-6 border border-slate-800">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-300 bg-indigo-500/20 px-2.5 py-1 rounded-full border border-indigo-400/20">
                Ringkasan Pesanan
              </span>
              <h3 className="text-xl font-extrabold mt-3 tracking-tight">{plan.name}</h3>
              <p className="text-xs text-slate-300 mt-1">{plan.description}</p>
            </div>

            <div className="space-y-3 pt-4 border-t border-slate-800 text-xs">
              <div className="flex items-center justify-between text-slate-300">
                <span>Harga Paket ({plan.durationLabel}):</span>
                <span className="font-semibold text-white">{formatRupiah(plan.price)}</span>
              </div>

              <div className="flex items-center justify-between text-slate-300">
                <span>Biaya Layanan Admin QRIS:</span>
                <span className="font-semibold text-white">{formatRupiah(2500)}</span>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-800 text-sm font-black">
                <span className="text-amber-300">Total Pembayaran:</span>
                <span className="text-xl font-extrabold text-amber-300">{formatRupiah(plan.price + 2500)}</span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-800/80 border border-slate-700/80 space-y-2 text-[11px] text-slate-300">
              <div className="flex items-center gap-2 text-emerald-400 font-bold">
                <ShieldCheck className="w-4 h-4" />
                <span>Jaminan Akses Langsung Aktif</span>
              </div>
              <p>
                Setelah bukti transfer dikonfirmasi oleh Admin, Kode Akses unik akan diterbitkan dalam hitungan detik.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* STEP 2: PAYMENT QRIS & UPLOAD PROOF */}
      {currentStep === 2 && activeTrx && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* QRIS Display Box (6 cols) */}
          <div className="lg:col-span-6 bg-white border border-slate-200/80 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6 text-center">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-100">
                Langkah 2 dari 3
              </span>
              <h2 className="text-xl font-extrabold text-slate-900 tracking-tight mt-2">
                Scan QRIS untuk Membayar
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Gunakan GoPay, OVO, Dana, ShopeePay, BCA, Mandiri, atau m-Banking pilihan Anda.
              </p>
            </div>

            {/* Total Amount Box */}
            <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-100 text-center space-y-1">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Total Tagihan yang Harus Ditransfer
              </span>
              <div className="text-2xl sm:text-3xl font-black text-[#3525cd]">
                {formatRupiah(activeTrx.totalPrice)}
              </div>
              <p className="text-[11px] text-slate-500 font-medium">
                Sesuai TRX ID: <span className="font-mono font-bold text-slate-800">{activeTrx.id}</span>
              </p>
            </div>

            {/* QRIS Image Frame */}
            <div className="relative mx-auto w-64 h-64 p-3 bg-white border-2 border-dashed border-[#3525cd]/40 rounded-2xl shadow-md flex items-center justify-center">
              {qrisConfig.imageBase64 ? (
                <SafeImage
                  src={qrisConfig.imageBase64}
                  alt="QRIS Payment"
                  className="w-full h-full object-contain rounded-lg"
                  width={240}
                  height={240}
                />
              ) : (
                <div className="text-center p-4">
                  <QrCode className="w-16 h-16 text-[#3525cd] mx-auto animate-pulse" />
                  <p className="text-xs text-slate-500 mt-2 font-medium">Memuat QRIS Resmi...</p>
                </div>
              )}
            </div>

            <p className="text-xs font-bold text-slate-700">
              {qrisConfig.merchantName || 'Tools Satset Official'}
            </p>

            {/* Action Buttons: Copy TRX ID & Download QRIS */}
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={handleCopyTrxId}
                className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer border border-slate-200"
              >
                {copiedTrxId ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span>TRX ID Tersalin</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-slate-500" />
                    <span>Salin TRX ID</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleDownloadQris}
                className="px-3.5 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-[#3525cd] text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer border border-indigo-100"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Unduh Gambar QRIS</span>
              </button>
            </div>
          </div>

          {/* Upload Proof & Status Box (6 cols) */}
          <div className="lg:col-span-6 bg-white border border-slate-200/80 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
            <div>
              <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                <Upload className="w-5 h-5 text-[#3525cd]" />
                <span>Unggah Bukti Pembayaran</span>
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Foto struk transfer / tangkapan layar m-Banking untuk verifikasi cepat oleh Admin.
              </p>
            </div>

            {/* Status Status Banner */}
            {activeTrx.status === 'AWAITING_VERIFICATION' ? (
              <div className="p-5 rounded-2xl bg-amber-50 border border-amber-200 space-y-3">
                <div className="flex items-center gap-2.5 text-amber-900 font-extrabold text-sm">
                  <Clock className="w-5 h-5 text-amber-600 animate-spin" />
                  <span>⏳ Menunggu Verifikasi oleh Admin</span>
                </div>
                <p className="text-xs text-amber-800 leading-relaxed">
                  Bukti pembayaran Anda sudah diterima! Admin sedang memverifikasi transaksi <strong className="font-mono">{activeTrx.id}</strong>.
                  <br />
                  Halaman ini akan otomatis diperbarui begitu pembayaran disetujui.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Proof Upload Area */}
                <label className="block p-6 rounded-2xl border-2 border-dashed border-slate-300 hover:border-[#3525cd] bg-slate-50/50 hover:bg-indigo-50/30 text-center cursor-pointer transition-all">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleProofFileChange}
                    className="hidden"
                  />
                  {proofBase64 ? (
                    <div className="space-y-3">
                      <div className="max-h-48 h-48 w-full relative mx-auto rounded-lg overflow-hidden shadow-sm border border-slate-200">
                        <SafeImage
                          src={proofBase64}
                          alt="Bukti Transfer"
                          fill
                          className="object-contain"
                        />
                      </div>
                      <span className="text-xs font-bold text-emerald-600 flex items-center justify-center gap-1">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Foto Berhasil Dipilih (Klik untuk mengganti)</span>
                      </span>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 text-[#3525cd] flex items-center justify-center mx-auto shadow-2xs">
                        <Upload className="w-6 h-6" />
                      </div>
                      <p className="text-xs font-bold text-slate-800">📷 Klik di sini untuk memilih Foto Bukti Transfer</p>
                      <p className="text-[11px] text-slate-400">Format JPG/PNG/JPEG dari galeri HP Anda</p>
                    </div>
                  )}
                </label>

                <button
                  type="button"
                  onClick={handleStep2SubmitProof}
                  disabled={!proofBase64 || isUploading}
                  className={`w-full py-3.5 px-6 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md ${
                    proofBase64 && !isUploading
                      ? 'bg-[#3525cd] hover:bg-[#2c1eb3] text-white shadow-indigo-200'
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Mengunggah Bukti Transfer...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Saya Sudah Membayar</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Check Status Link */}
            <div className="pt-4 border-t border-slate-100 text-center">
              <button
                type="button"
                onClick={() => onOpenStatusCheck(activeTrx.id)}
                className="text-xs font-bold text-slate-600 hover:text-[#3525cd] transition-colors cursor-pointer"
              >
                Sudah bayar sebelumnya? <u>Cek status transaksi di sini</u>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 3: CONFIRMATION & ACCESS CODE */}
      {currentStep === 3 && activeTrx && (
        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 sm:p-10 shadow-lg max-w-2xl mx-auto text-center space-y-6">
          {/* Big Green Checkmark */}
          <div className="w-20 h-20 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-md border-4 border-white">
            <Check className="w-10 h-10 stroke-[3]" />
          </div>

          <div>
            <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-extrabold uppercase tracking-wider">
              VERIFIKASI BERHASIL
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mt-2">
              Pembayaran Berhasil Dikonfirmasi!
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-md mx-auto">
              Selamat, transaksi <strong className="font-mono text-slate-800">{activeTrx.id}</strong> telah diverifikasi.
              Lisensi Anda sudah aktif!
            </p>
          </div>

          {/* Special Box: Access Code Display */}
          <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white shadow-md space-y-3 border border-slate-800">
            <span className="text-[10px] font-bold uppercase tracking-widest text-amber-300">
              KODE AKSES RESMI ANDA
            </span>

            <div className="flex items-center justify-center gap-3">
              <span className="text-xl sm:text-2xl font-mono font-black text-amber-300 tracking-wider">
                {showCode ? activeTrx.accessCode : maskAccessCode(activeTrx.accessCode)}
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
                className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white transition-colors cursor-pointer border border-slate-700"
                title={showCode ? "Sembunyikan Kode" : "Tampilkan Kode (5 Detik)"}
              >
                {showCode ? <EyeOff className="w-5 h-5 text-indigo-400" /> : <Eye className="w-5 h-5" />}
              </button>
              <button
                type="button"
                onClick={handleCopyAccessCode}
                className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white transition-colors cursor-pointer border border-slate-700"
                title="Salin Kode Akses ke Clipboard"
              >
                {copiedAccessCode ? (
                  <Check className="w-5 h-5 text-emerald-400" />
                ) : (
                  <Copy className="w-5 h-5" />
                )}
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-4 pt-2 text-xs text-slate-300 border-t border-slate-800/80">
              <span>Masa Berlaku: <strong className="text-white">{plan.durationLabel}</strong></span>
              <span>•</span>
              <span>Berlaku Sampai: <strong className="text-white">{activeTrx.validUntil || 'Aktif'}</strong></span>
            </div>
          </div>

          {/* Action: Enter Workspace Button */}
          <div className="pt-2">
            <button
              type="button"
              onClick={handleEnterWorkspace}
              className="w-full py-4 px-8 rounded-xl bg-[#3525cd] hover:bg-[#2c1eb3] text-white font-black text-base transition-all shadow-lg shadow-indigo-200 flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Masuk ke Workspace Aplikasi</span>
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
