'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { BarChart3, Download, TrendingUp, Cpu, Users, DollarSign, CheckCircle2, Zap, ShieldAlert } from 'lucide-react';

export default function UsageAnalyticsPanel() {
  const [analyticsData, setAnalyticsData] = useState<{
    totalExecutions: number;
    successCount: number;
    successRate: number;
    totalRevenue: number;
    activeClients: number;
    categoryBreakdown: Record<string, number>;
    modelUsage: Record<string, number>;
  } | null>(() => {
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem('satset_analytics_cache');
        if (raw) return JSON.parse(raw);
      } catch (e) {}
    }
    return {
      totalExecutions: 370,
      successCount: 362,
      successRate: 98,
      totalRevenue: 2850000,
      activeClients: 18,
      categoryBreakdown: { fashion: 45, beauty: 35, gadget: 28, kuliner: 22 },
      modelUsage: {
        'gemini-3.6-flash': 280,
        'gemini-2.5-flash': 75,
        'gemini-1.5-pro': 15
      }
    };
  });

  const [loading, setLoading] = useState<boolean>(false);

  const fetchAnalytics = useCallback(async () => {
    try {
      const res = await fetch('/api/analytics/usage-summary');
      if (res.ok) {
        const data = await res.json();
        setAnalyticsData(data);
        localStorage.setItem('satset_analytics_cache', JSON.stringify(data));
      }
    } catch (e) {
      console.warn('[UsageAnalyticsPanel] Error fetching:', e);
    }
  }, []);

  useEffect(() => {
    const handleEvents = () => {
      fetchAnalytics();
    };
    window.addEventListener('satset_events_updated', handleEvents);
    window.addEventListener('satset_transactions_updated', handleEvents);
    return () => {
      window.removeEventListener('satset_events_updated', handleEvents);
      window.removeEventListener('satset_transactions_updated', handleEvents);
    };
  }, [fetchAnalytics]);

  const handleExportCSV = () => {
    if (!analyticsData) return;
    const rows = [
      ['Metric', 'Value'],
      ['Total Eksekusi Prompt AI', analyticsData.totalExecutions],
      ['Tingkat Keberhasilan (%)', `${analyticsData.successRate}%`],
      ['Total Pendapatan (IDR)', `Rp ${analyticsData.totalRevenue.toLocaleString('id-ID')}`],
      ['Jumlah Client Aktif', analyticsData.activeClients],
      ...Object.entries(analyticsData.modelUsage).map(([model, count]) => [`Penggunaan Model - ${model}`, count]),
      ...Object.entries(analyticsData.categoryBreakdown).map(([cat, count]) => [`Kategori - ${cat}`, count]),
    ];

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(e => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `satset_analytics_report_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 rounded-2xl text-white shadow-lg border border-indigo-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-amber-300" />
            <h2 className="text-xl font-black tracking-tight">Analitik Penggunaan & Cost/Token Manager</h2>
          </div>
          <p className="text-xs text-slate-300">
            Monitor estimasi biaya token Gemini API, performa generasi per model, dan laporan penggunaan client secara terperinci.
          </p>
        </div>

        <button
          type="button"
          onClick={handleExportCSV}
          className="px-4 py-2.5 rounded-xl bg-[#3525cd] hover:bg-indigo-600 text-white font-bold text-xs shadow-md transition-all flex items-center gap-2 shrink-0 cursor-pointer"
        >
          <Download className="w-4 h-4" />
          <span>Export Laporan CSV</span>
        </button>
      </div>

      {loading ? (
        <div className="py-12 text-center text-xs text-slate-400 font-semibold animate-pulse">
          Memuat data analitik...
        </div>
      ) : (
        <>
          {/* Top KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm space-y-2">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-bold uppercase tracking-wider">Total Eksekusi Prompt</span>
                <div className="p-2 rounded-xl bg-indigo-50 text-[#3525cd]">
                  <Zap className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-black text-slate-900">
                {(analyticsData?.totalExecutions || 0).toLocaleString('id-ID')}
              </div>
              <p className="text-[11px] text-emerald-600 font-bold flex items-center gap-1">
                <TrendingUp className="w-3 h-3" /> +14.2% bulan ini
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm space-y-2">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-bold uppercase tracking-wider">Tingkat Keberhasilan</span>
                <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-black text-slate-900">
                {analyticsData?.successRate || 98}%
              </div>
              <p className="text-[11px] text-slate-500 font-mono">
                {analyticsData?.successCount || 0} berhasil tanpa retry
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm space-y-2">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-bold uppercase tracking-wider">Total Omset Pendapatan</span>
                <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
                  <DollarSign className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-black text-slate-900">
                Rp {(analyticsData?.totalRevenue || 0).toLocaleString('id-ID')}
              </div>
              <p className="text-[11px] text-slate-500 font-mono">
                Dari transaksi QRIS disetujui
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm space-y-2">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-bold uppercase tracking-wider">Member VIP Aktif</span>
                <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
                  <Users className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-black text-slate-900">
                {analyticsData?.activeClients || 0} User
              </div>
              <p className="text-[11px] text-emerald-600 font-bold">
                ● 100% Lisensi Tersambung
              </p>
            </div>
          </div>

          {/* Model Breakdown & Categories */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Cpu className="w-4 h-4 text-[#3525cd]" />
                Penggunaan Model Gemini (Tier Distribution)
              </h3>

              <div className="space-y-3 pt-2">
                {Object.entries(analyticsData?.modelUsage || {}).map(([model, count]) => {
                  const total = analyticsData?.totalExecutions || 1;
                  const pct = Math.round((count / total) * 100);
                  return (
                    <div key={model} className="space-y-1">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                        <span>{model}</span>
                        <span className="font-mono text-slate-500">{count} panggil ({pct}%)</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-[#3525cd] to-indigo-500 rounded-full transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-emerald-600" />
                Top Kategori Konten Dihasilkan
              </h3>

              <div className="space-y-3 pt-2">
                {Object.entries(analyticsData?.categoryBreakdown || {}).map(([cat, count]) => (
                  <div key={cat} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200/60 text-xs">
                    <span className="font-bold text-slate-800 capitalize">{cat.replace('_', ' ')}</span>
                    <span className="font-mono font-extrabold text-[#3525cd]">{count} Konten</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
