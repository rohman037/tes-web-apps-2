'use client';

import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Key, 
  Database, 
  RotateCcw, 
  X, 
  Check, 
  AlertTriangle, 
  Info,
  Sparkles,
  Zap,
  Lock
} from 'lucide-react';
import { motion } from 'motion/react';
import { AntiLimitConfig } from '../../types';
import { getAntiLimitConfig, saveAntiLimitConfig } from '../../lib/antiLimit';

interface AntiLimitModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AntiLimitModal({ isOpen, onClose }: AntiLimitModalProps) {
  const [config, setConfig] = useState<AntiLimitConfig>(() => getAntiLimitConfig());
  const [showSavedMsg, setShowSavedMsg] = useState(false);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    saveAntiLimitConfig(config);
    setShowSavedMsg(true);
    setTimeout(() => {
      setShowSavedMsg(false);
      onClose();
    }, 1200);
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/40 backdrop-blur-xs overflow-y-auto"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-white border border-slate-200/80 rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden text-slate-800 my-auto"
      >
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-slate-100 flex items-center justify-between gap-4 bg-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shadow-2xs">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                Sistem Anti Limit API Key
                <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                  Aktif
                </span>
              </h2>
              <p className="text-xs text-slate-500">Proteksi kuota & rate limit otomatis untuk menjaga kestabilan generator.</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Tutup Modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSave} className="p-4 sm:p-6 space-y-4">
          {showSavedMsg && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600" />
              <span>Pengaturan Anti-Limit Berhasil Disimpan!</span>
            </div>
          )}

          {/* Custom API Key Section */}
          <div className="space-y-3 p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Key className="w-4 h-4 text-amber-500" /> API Keys Gemini (Multi-Key Rotation)
              </label>
              <span className="text-[10px] text-emerald-700 font-semibold px-2 py-0.5 bg-emerald-50 rounded-full border border-emerald-200">
                {(config.apiKeys?.length || (config.customApiKey ? 1 : 0))} Key Tersimpan
              </span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Anda dapat memasukkan satu atau banyak Gemini API Key pribadi (pisahkan dengan koma atau baris baru). Sistem akan memutar key secara otomatis jika salah satu key terkena Rate Limit / 429.
            </p>
            <div className="relative mt-2">
              <textarea
                rows={3}
                value={
                  config.apiKeys && config.apiKeys.length > 0
                    ? config.apiKeys.join('\n')
                    : config.customApiKey
                }
                onChange={(e) => {
                  const val = e.target.value;
                  const keys = val
                    .split(/[\n,]+/)
                    .map((k) => k.trim())
                    .filter(Boolean);
                  setConfig({
                    ...config,
                    customApiKey: keys[0] || '',
                    apiKeys: keys,
                  });
                }}
                placeholder="AIzaSy1...\nAIzaSy2...\n(Atau pisahkan dengan koma)"
                className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 font-mono placeholder:text-slate-400 focus:outline-none focus:border-[#5b50e5] focus:ring-2 focus:ring-[#5b50e5]/20 resize-none"
              />
              {((config.apiKeys && config.apiKeys.length > 0) || config.customApiKey) && (
                <button
                  type="button"
                  onClick={() => setConfig({ ...config, customApiKey: '', apiKeys: [] })}
                  className="absolute right-3 top-3 text-xs text-slate-400 hover:text-rose-600 font-medium cursor-pointer"
                >
                  Hapus Semua
                </button>
              )}
            </div>
            <div className="flex items-center justify-between text-[10px] text-slate-500">
              <div className="flex items-center gap-1.5">
                <Lock className="w-3 h-3 text-emerald-600" />
                <span>Selalu tersimpan privat di LocalStorage browser Anda.</span>
              </div>
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="text-[#5b50e5] hover:underline font-semibold flex items-center gap-1"
              >
                Dapatkan API Key Gratis
              </a>
            </div>
          </div>

          {/* Features Toggles */}
          <div className="space-y-2.5">
            {/* Caching toggle */}
            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80">
              <div className="space-y-0.5">
                <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5 text-[#5b50e5]" /> Caching Respon Cerdas (Save Quota)
                </div>
                <div className="text-[11px] text-slate-500">
                  Menyimpan hasil generasi sama tanpa memanggil ulang API Gemini.
                </div>
              </div>
              <input
                type="checkbox"
                checked={config.enableCache}
                onChange={(e) => setConfig({ ...config, enableCache: e.target.checked })}
                className="w-4 h-4 accent-[#5b50e5] cursor-pointer"
              />
            </div>

            {/* Auto retry toggle */}
            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80">
              <div className="space-y-0.5">
                <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <RotateCcw className="w-3.5 h-3.5 text-purple-600" /> Auto Multi-Model Fallback & Retry
                </div>
                <div className="text-[11px] text-slate-500">
                  Otomatis beralih ke model cadangan jika 429 Rate Limit / 503 Overloaded.
                </div>
              </div>
              <input
                type="checkbox"
                checked={config.enableAutoRetry}
                onChange={(e) => setConfig({ ...config, enableAutoRetry: e.target.checked })}
                className="w-4 h-4 accent-[#5b50e5] cursor-pointer"
              />
            </div>
          </div>

          {/* Anti Limit Info Box */}
          <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200 text-xs text-emerald-900 space-y-1.5">
            <div className="font-bold flex items-center gap-1.5 text-emerald-800">
              <Zap className="w-4 h-4 text-emerald-600" /> Fitur Perlindungan Anti Limit Aktif:
            </div>
            <ul className="list-disc list-inside text-[11px] space-y-1 text-emerald-800">
              <li>Pencegahan double click & throttling otomatis.</li>
              <li>Exponential backoff jitter (jeda cerdas 1.5s - 5s).</li>
              <li>Pemberitahuan ramah jika kuota terlampaui.</li>
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-[#5b50e5] hover:bg-[#4f46e5] text-white text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Simpan Pengaturan</span>
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
