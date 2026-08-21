'use client';

import React, { useState, useEffect, useCallback } from "react";
import { ShieldAlert, Search, RefreshCw, CheckCircle2, XCircle, Clock, Key, ShieldCheck, Zap } from 'lucide-react';
import DataTable from '../../components/admin/DataTable';
import StatCard from '../../components/admin/StatCard';
import { getAuditLogs, AuditLogItem } from '../../lib/admin/auditLog';
import { maskAccessCode } from '../../utils/maskAccessCode';
import { subscribeLiveGenerationEvents } from '../../events/generationEvent';

export default function LoginActivityPanel() {
  const [logs, setLogs] = useState<AuditLogItem[]>(() => getAuditLogs());
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'success' | 'failed'>('all');
  const [isLoading, setIsLoading] = useState(false);

  const loadLogs = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/audit-logs');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setLogs(data);
          localStorage.setItem('satset_audit_logs', JSON.stringify(data));
          return;
        }
      }
    } catch (e) {}
    setLogs(getAuditLogs());
  }, []);

  useEffect(() => {
    const handleUpdated = () => {
      loadLogs();
    };
    window.addEventListener('satset_audit_logs_updated', handleUpdated);
    window.addEventListener('storage', handleUpdated);

    const unsubscribe = subscribeLiveGenerationEvents((data) => {
      if (data.type === 'audit_logs_updated' || data.type === 'audit_log_event' || data.type === 'clients_updated') {
        loadLogs();
      }
    });

    return () => {
      window.removeEventListener('satset_audit_logs_updated', handleUpdated);
      window.removeEventListener('storage', handleUpdated);
      unsubscribe();
    };
  }, [loadLogs]);

  const safeLogs = Array.isArray(logs) ? logs : [];

  const loginLogs = safeLogs.filter((log) => {
    const act = (log.action || '').toLowerCase();
    const det = (log.details || '').toLowerCase();
    return act.includes('login') || det.includes('login') || act.includes('kode akses') || log.category === 'system' || log.category === 'client';
  });

  const successCount = loginLogs.filter(l => l.action.toLowerCase().includes('berhasil')).length;
  const failedCount = loginLogs.filter(l => l.action.toLowerCase().includes('ditolak') || l.action.toLowerCase().includes('gagal')).length;

  const filteredLogs = loginLogs.filter((log) => {
    if (filterType === 'success' && !log.action.toLowerCase().includes('berhasil')) return false;
    if (filterType === 'failed' && (log.action.toLowerCase().includes('berhasil'))) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchAction = log.action.toLowerCase().includes(q);
      const matchDetails = log.details.toLowerCase().includes(q);
      const matchAdmin = log.adminName.toLowerCase().includes(q);
      return matchAction || matchDetails || matchAdmin;
    }
    return true;
  });

  // Mask sensitive code patterns inside details text for security
  const sanitizeDetails = (text: string) => {
    return text.replace(/(SATSET-[A-Z0-9]{4,8})/gi, (match) => maskAccessCode(match));
  };

  return (
    <div className="space-y-6 font-sans text-slate-800">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2 flex-wrap">
            <Key className="w-6 h-6 text-[#3525cd]" />
            <span>Aktivitas & Log Login Real-Time</span>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/80 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 ml-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              <span>Live SSE Tracker</span>
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Audit keamanan aktivitas otentikasi user & administrator secara terpusat.
          </p>
        </div>

        <button
          type="button"
          onClick={loadLogs}
          disabled={isLoading}
          className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-2xs self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-[#3525cd] ${isLoading ? 'animate-spin' : ''}`} />
          <span>Muat Ulang Log</span>
        </button>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Total Percobaan Login"
          value={loginLogs.length.toString()}
          subtext="Tercatat di server & client"
          icon={<Clock className="w-5 h-5 text-indigo-600" />}
          iconBgColor="bg-indigo-50"
        />
        <StatCard
          title="Login Berhasil"
          value={successCount.toString()}
          subtext="Akses terotentikasi sah"
          icon={<CheckCircle2 className="w-5 h-5 text-emerald-600" />}
          iconBgColor="bg-emerald-50"
        />
        <StatCard
          title="Login Ditolak / Gagal"
          value={failedCount.toString()}
          subtext="Integritas sistem terjaga"
          icon={<XCircle className="w-5 h-5 text-rose-600" />}
          iconBgColor="bg-rose-50"
        />
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari berdasarkan nama, IP, kode, atau status..."
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#3525cd]/20 focus:border-[#3525cd] transition-all"
          />
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setFilterType('all')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              filterType === 'all'
                ? 'bg-[#3525cd] text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Semua ({loginLogs.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterType('success')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              filterType === 'success'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Sukses ({successCount})
          </button>
          <button
            type="button"
            onClick={() => setFilterType('failed')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              filterType === 'failed'
                ? 'bg-rose-600 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Ditolak ({failedCount})
          </button>
        </div>
      </div>

      {/* Log Data Table */}
      <DataTable
        columns={[
          {
            header: 'Waktu Event',
            render: (row: AuditLogItem) => (
              <span className="text-xs font-mono text-slate-600">
                {new Date(row.timestamp).toLocaleString('id-ID', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit'
                })}
              </span>
            )
          },
          {
            header: 'Pengguna / Aktor',
            render: (row: AuditLogItem) => (
              <span className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                {row.adminName === 'Administrator' ? (
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                ) : (
                  <Key className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                )}
                <span>{row.adminName}</span>
              </span>
            )
          },
          {
            header: 'Aksi Otentikasi',
            render: (row: AuditLogItem) => {
              const isSuccess = row.action.toLowerCase().includes('berhasil');
              const isFailed = row.action.toLowerCase().includes('ditolak') || row.action.toLowerCase().includes('gagal');
              return (
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                    isSuccess
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : isFailed
                      ? 'bg-rose-50 text-rose-700 border border-rose-200'
                      : 'bg-amber-50 text-amber-700 border border-amber-200'
                  }`}
                >
                  {isSuccess ? <CheckCircle2 className="w-3 h-3 text-emerald-600" /> : <XCircle className="w-3 h-3 text-rose-600" />}
                  <span>{row.action}</span>
                </span>
              );
            }
          },
          {
            header: 'Rincian & Informasi IP',
            render: (row: AuditLogItem) => (
              <span className="text-xs text-slate-600 font-mono break-all">
                {sanitizeDetails(row.details)}
              </span>
            )
          }
        ]}
        data={filteredLogs}
        emptyMessage="Belum ada riwayat aktivitas login yang tercatat."
      />
    </div>
  );
}
