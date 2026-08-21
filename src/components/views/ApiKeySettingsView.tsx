'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Key, Sparkles, Trash2, Check, AlertCircle, Info, ShieldCheck, Lock, UserCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  getAntiLimitConfig, 
  saveAntiLimitConfig, 
  maskApiKey, 
  addApiKeysBulk, 
  removeApiKey 
} from '../../lib/antiLimit';
import { AntiLimitConfig } from '../../types';
import { getUserSession } from '../../lib/auth';

interface ApiKeySettingsViewProps {
  onKeysUpdated?: () => void;
}

export default function ApiKeySettingsView({ onKeysUpdated }: ApiKeySettingsViewProps) {
  const [bulkInput, setBulkInput] = useState('');
  const [config, setConfig] = useState<AntiLimitConfig>(() => getAntiLimitConfig());
  const [registeredKeys, setRegisteredKeys] = useState<string[]>(() => {
    const cfg = getAntiLimitConfig();
    let keys = cfg.apiKeys || [];
    if (keys.length === 0 && cfg.customApiKey) {
      keys = [cfg.customApiKey];
    }
    return keys;
  });
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const session = getUserSession();
  const currentAccessCode = session?.code || 'GUEST';
  const clientName = session?.name || (session?.role === 'admin' ? 'Administrator' : 'Klien Satset');

  const reloadKeys = useCallback(() => {
    const cfg = getAntiLimitConfig();
    setConfig(cfg);
    let keys = cfg.apiKeys || [];
    if (keys.length === 0 && cfg.customApiKey) {
      keys = [cfg.customApiKey];
    }
    setRegisteredKeys(keys);
  }, []);

  useEffect(() => {
    const handleKeysUpdated = () => {
      reloadKeys();
    };

    window.addEventListener('api-keys-updated', handleKeysUpdated);
    window.addEventListener('storage', handleKeysUpdated);
    return () => {
      window.removeEventListener('api-keys-updated', handleKeysUpdated);
      window.removeEventListener('storage', handleKeysUpdated);
    };
  }, [reloadKeys]);

  const handleRegisterKeys = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkInput.trim()) {
      return;
    }

    addApiKeysBulk(bulkInput);
    setBulkInput('');
    reloadKeys();
    if (onKeysUpdated) onKeysUpdated();

    setSuccessMsg('Kunci akses berhasil didaftarkan!');
    setTimeout(() => {
      setSuccessMsg(null);
    }, 3000);
  };

  const handleDeleteKey = (keyToDelete: string) => {
    removeApiKey(keyToDelete);
    reloadKeys();
    if (onKeysUpdated) onKeysUpdated();
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Page Title Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">API Key Setting</h1>
        <p className="text-sm text-slate-500 mt-1">Kelola kunci akses dan pantau status koneksi AI Anda.</p>
      </div>

      {/* Main Settings Card */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
        
        {/* Card Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Key className="w-5 h-5 text-[#5b50e5]" />
              Manajemen API Access Keys (Terisolasi per Klien)
            </h2>
            <p className="text-sm text-slate-500 leading-relaxed">
              Kunci ini disimpan secara khusus dan terisolasi untuk akun Anda ({currentAccessCode}). Tidak akan bercampur dengan klien lain.
            </p>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-mono font-bold flex items-center gap-1.5 shrink-0 self-start sm:self-auto">
            <UserCheck className="w-4 h-4 text-emerald-600" />
            <span>Klien: {clientName} ({currentAccessCode})</span>
          </div>
        </div>

        {/* Success Alert */}
        <AnimatePresence>
          {successMsg && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-medium flex items-center gap-2.5"
            >
              <Check className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              <span>{successMsg}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Info Callout Banner */}
        <div className="p-4 rounded-xl bg-indigo-50/80 border border-indigo-100 text-indigo-950 text-sm leading-relaxed">
          Masukkan satu API key per baris. Setiap baris baru akan didaftarkan sebagai kunci akses yang berbeda.
        </div>

        {/* Registration Form */}
        <form onSubmit={handleRegisterKeys} className="space-y-4 flex flex-col">
          <textarea
            rows={4}
            value={bulkInput}
            onChange={(e) => setBulkInput(e.target.value)}
            placeholder={`TS-XXXX-XXXX-XXXX\nTS-YYYY-YYYY-YYYY`}
            className="w-full p-4 rounded-xl border border-slate-200 text-slate-900 text-sm font-mono placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#5b50e5]/20 focus:border-[#5b50e5] bg-white transition-all resize-none"
          />

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={!bulkInput.trim()}
              className="bg-[#5b50e5] hover:bg-[#4f46e5] disabled:opacity-50 text-white font-medium px-6 py-3 rounded-xl shadow-sm hover:shadow transition-all flex items-center gap-2 text-sm cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>Daftarkan Kunci</span>
            </button>
          </div>
        </form>

        {/* Divider */}
        <div className="border-t border-slate-100 pt-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-900">Kunci Terdaftar</h3>
            <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
              {registeredKeys.length} Key Tersimpan
            </span>
          </div>

          {/* Registered Keys Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-500 font-semibold text-xs">
                  <th className="py-3 px-6">API Key</th>
                  <th className="py-3 px-6 text-center">Status</th>
                  <th className="py-3 px-6 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {registeredKeys.map((keyItem, index) => (
                  <tr key={index} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3.5 px-6 font-mono font-medium text-slate-800">
                      {maskApiKey(keyItem)}
                    </td>
                    <td className="py-3.5 px-6 text-center">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-700 tracking-wider">
                        AKTIF
                      </span>
                    </td>
                    <td className="py-3.5 px-6 text-right">
                      <button
                        type="button"
                        onClick={() => handleDeleteKey(keyItem)}
                        title="Hapus Kunci"
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors inline-flex items-center justify-center cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {registeredKeys.length === 0 && (
                  <tr>
                    <td colSpan={3} className="py-8 text-center text-slate-400 text-sm">
                      Belum ada API key terdaftar. Silakan masukkan kunci akses Anda di atas.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
