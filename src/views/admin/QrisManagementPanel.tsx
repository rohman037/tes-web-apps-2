'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { QrCode, Upload, Check, RefreshCw, Sparkles } from 'lucide-react';
import { getQrisConfig, updateQrisConfig, QrisConfig } from '../../lib/payment';
import SafeImage from '../../components/common/SafeImage';

export default function QrisManagementPanel() {
  const [qrisConfig, setQrisConfig] = useState<QrisConfig>(() => getQrisConfig());
  const [newQrisFile, setNewQrisFile] = useState<File | null>(null);
  const [newQrisBase64, setNewQrisBase64] = useState<string | null>(null);
  const [merchantNameInput, setMerchantNameInput] = useState(qrisConfig.merchantName || 'Tools Satset Official');
  const [qrisSavedMsg, setQrisSavedMsg] = useState<string | null>(null);

  const loadQrisData = useCallback(async () => {
    try {
      const res = await fetch('/api/qris');
      if (res.ok) {
        const data = await res.json();
        if (data && typeof data === 'object' && data.imageBase64) {
          setQrisConfig(data);
          setMerchantNameInput(data.merchantName || 'Tools Satset Official');
          localStorage.setItem('satset_qris_config', JSON.stringify(data));
        }
      }
    } catch (e) {
      // Local config loaded
    }
  }, []);

  useEffect(() => {
    window.addEventListener('satset_qris_updated', loadQrisData);
    window.addEventListener('storage', loadQrisData);
    return () => {
      window.removeEventListener('satset_qris_updated', loadQrisData);
      window.removeEventListener('storage', loadQrisData);
    };
  }, [loadQrisData]);

  const handleQrisFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setNewQrisFile(file);
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setNewQrisBase64(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveQris = (e: React.FormEvent) => {
    e.preventDefault();
    const targetImage = newQrisBase64 || qrisConfig.imageBase64;
    if (!targetImage) {
      alert('Mohon pilih foto QRIS terlebih dahulu.');
      return;
    }
    updateQrisConfig(targetImage, merchantNameInput.trim() || 'Tools Satset Official');
    setQrisConfig({
      imageBase64: targetImage,
      merchantName: merchantNameInput.trim() || 'Tools Satset Official',
    });
    setNewQrisFile(null);
    setNewQrisBase64(null);
    setQrisSavedMsg('Foto & Nama Merchant QRIS Resmi Berhasil Diperbarui!');
    setTimeout(() => setQrisSavedMsg(null), 4000);
  };

  const currentDisplayImage = newQrisBase64 || qrisConfig.imageBase64;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs space-y-6">
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div>
          <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
            <QrCode className="w-5 h-5 text-[#3525cd]" />
            <span>Pengaturan QRIS Pembayaran Resmi</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Unggah foto barcode QRIS All Payment Anda agar otomatis tampil di Checkout pembeli.
          </p>
        </div>

        {qrisSavedMsg && (
          <div className="px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold flex items-center gap-1.5 animate-in fade-in">
            <Check className="w-4 h-4 text-emerald-600" />
            <span>{qrisSavedMsg}</span>
          </div>
        )}
      </div>

      <form onSubmit={handleSaveQris} className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
        {/* Left: Form Controls */}
        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1.5">
              Nama Merchant / Toko QRIS
            </label>
            <input
              type="text"
              value={merchantNameInput}
              onChange={(e) => setMerchantNameInput(e.target.value)}
              placeholder="misal: Tools Satset Official (QRIS ALL PAYMENT)"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:border-[#3525cd]"
              required
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1.5">
              File Barcode QRIS (JPG / PNG)
            </label>
            <label className="border-2 border-dashed border-slate-200 hover:border-[#3525cd] rounded-2xl p-6 text-center block cursor-pointer bg-slate-50/50 hover:bg-indigo-50/30 transition-all">
              <Upload className="w-6 h-6 text-[#3525cd] mx-auto mb-2" />
              <span className="text-xs font-bold text-slate-800 block">
                {newQrisFile ? newQrisFile.name : 'Pilih Foto Barcode QRIS Baru'}
              </span>
              <span className="text-[10px] text-slate-400 mt-1 block">
                Format disarankan: PNG / JPG, maksimal 5MB
              </span>
              <input
                type="file"
                accept="image/*"
                onChange={handleQrisFileChange}
                className="hidden"
              />
            </label>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-[#3525cd] hover:bg-[#2c1eb3] text-white text-xs font-bold transition-all shadow-md cursor-pointer flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              <span>Simpan QRIS Resmi</span>
            </button>
          </div>
        </div>

        {/* Right: Live Preview Box */}
        <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col items-center justify-center space-y-3">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Preview QRIS Tampil
          </span>

          {currentDisplayImage ? (
            <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm max-w-[220px] w-full text-center space-y-2 flex flex-col items-center">
              <SafeImage
                src={currentDisplayImage}
                alt="QRIS Preview"
                className="w-full h-auto rounded-xl object-contain max-h-[220px] mx-auto"
                width={220}
                height={220}
              />
              <div className="text-[11px] font-extrabold text-slate-800 border-t border-slate-100 pt-2 w-full">
                {merchantNameInput || 'Merchant Satset'}
              </div>
            </div>
          ) : (
            <div className="w-48 h-48 rounded-2xl border-2 border-dashed border-slate-300 flex items-center justify-center text-slate-400 text-xs font-medium text-center p-4">
              Belum ada barcode QRIS diunggah
            </div>
          )}
        </div>
      </form>
    </div>
  );
}
