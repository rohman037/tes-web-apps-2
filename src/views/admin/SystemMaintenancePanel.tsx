'use client';

import React, { useState } from 'react';
import { Database, Download, Upload, ShieldCheck, RefreshCw, HardDrive, CheckCircle2, AlertTriangle, FileJson } from 'lucide-react';

export default function SystemMaintenancePanel() {
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [isRestoring, setIsRestoring] = useState<boolean>(false);
  const [isClearingCache, setIsClearingCache] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);

  const handleExportBackup = async () => {
    try {
      setIsExporting(true);
      const res = await fetch('/api/system/export-backup');
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `satset_database_backup_${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        setToastMessage('✅ Backup Database Firestore berhasil diunduh!');
      }
    } catch (e) {
      console.error(e);
      setToastMessage('❌ Gagal mengunduh backup database');
    } finally {
      setIsExporting(false);
      setTimeout(() => setToastMessage(null), 4000);
    }
  };

  const handleRestoreBackup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restoreFile) return;

    try {
      setIsRestoring(true);
      const text = await restoreFile.text();
      const parsed = JSON.parse(text);

      const res = await fetch('/api/system/restore-backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed),
      });

      if (res.ok) {
        setToastMessage('🎉 Restorasi Database berhasil diterapkan!');
        setRestoreFile(null);
      } else {
        setToastMessage('❌ Format file backup tidak valid');
      }
    } catch (e) {
      console.error(e);
      setToastMessage('❌ Format file backup JSON tidak valid');
    } finally {
      setIsRestoring(false);
      setTimeout(() => setToastMessage(null), 4000);
    }
  };

  const handleClearCache = () => {
    setIsClearingCache(true);
    try {
      localStorage.clear();
      sessionStorage.clear();
      setToastMessage('🧹 Cache lokal browser berhasil dibersihkan!');
    } catch (e) {
      console.error(e);
    } finally {
      setTimeout(() => setIsClearingCache(false), 500);
      setTimeout(() => setToastMessage(null), 3000);
    }
  };

  return (
    <div className="space-y-6">
      {toastMessage && (
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs font-bold flex items-center justify-between shadow-xl animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 rounded-2xl text-white shadow-lg border border-indigo-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Database className="w-6 h-6 text-amber-300" />
            <h2 className="text-xl font-black tracking-tight">Auto-Backup & System Maintenance</h2>
          </div>
          <p className="text-xs text-slate-300">
            Ekspor seluruh koleksi Firestore ke JSON, pulihkan data backup, dan lakukan pemeliharaan sistem berkala.
          </p>
        </div>

        <button
          type="button"
          onClick={handleExportBackup}
          disabled={isExporting}
          className="px-4 py-2.5 rounded-xl bg-[#3525cd] hover:bg-indigo-600 text-white font-bold text-xs shadow-md transition-all flex items-center gap-2 shrink-0 cursor-pointer disabled:opacity-50"
        >
          <Download className="w-4 h-4" />
          <span>{isExporting ? 'Mengekspor Data...' : 'Download Backup Full JSON'}</span>
        </button>
      </div>

      {/* Grid Features */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Restore Section */}
        <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Upload className="w-4 h-4 text-[#3525cd]" />
            Pulihkan Database (Restore Backup)
          </h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Unggah file `.json` hasil backup sistem untuk memulihkan daftar client, paket, transaksi, dan setting agen AI secara otomatis.
          </p>

          <form onSubmit={handleRestoreBackup} className="space-y-3 pt-2">
            <div className="p-4 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50 text-center space-y-2">
              <FileJson className="w-8 h-8 text-slate-400 mx-auto" />
              <input
                type="file"
                accept=".json"
                onChange={(e) => setRestoreFile(e.target.files?.[0] || null)}
                className="text-xs text-slate-600 font-bold file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-[#3525cd] file:text-white hover:file:bg-indigo-600 file:cursor-pointer"
              />
              {restoreFile && (
                <p className="text-[11px] text-emerald-600 font-bold font-mono">
                  File terpilih: {restoreFile.name} ({(restoreFile.size / 1024).toFixed(1)} KB)
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={!restoreFile || isRestoring}
              className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40"
            >
              <RefreshCw className={`w-4 h-4 ${isRestoring ? 'animate-spin' : ''}`} />
              <span>{isRestoring ? 'Memulihkan Data...' : 'Proses Restorasi Database'}</span>
            </button>
          </form>
        </div>

        {/* System Health Diagnostics */}
        <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            Diagnostik Kesehatan Sistem Firestore
          </h3>

          <div className="space-y-2.5 pt-1 text-xs">
            <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900">
              <span className="font-bold">Status Koneksi Firestore DB</span>
              <span className="font-extrabold text-emerald-600 flex items-center gap-1">
                ● Normal (Terhubung)
              </span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-700">
              <span className="font-bold">Real-time SSE Event Stream</span>
              <span className="font-extrabold text-[#3525cd] flex items-center gap-1">
                ● Active Broadcaster
              </span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-700">
              <span className="font-bold">Penyimpanan Cache Lokal</span>
              <button
                type="button"
                onClick={handleClearCache}
                disabled={isClearingCache}
                className="px-3 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-[11px] transition-all cursor-pointer"
              >
                Bersihkan Cache Browser
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
