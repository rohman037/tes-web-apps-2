'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Bot, 
  Plus, 
  Trash2, 
  CheckCircle, 
  XCircle, 
  RefreshCw, 
  Activity, 
  Cpu, 
  Zap,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  TrendingUp,
  RotateCcw,
  Sliders,
  ShieldAlert,
  Clock
} from 'lucide-react';
import StatCard from '../../components/admin/StatCard';
import DataTable from '../../components/admin/DataTable';
import { 
  getAiAgents, 
  syncAiAgentsWithBackend,
  saveAiAgents, 
  deleteAiAgent, 
  AiAgentItem, 
  DEFAULT_AI_AGENTS 
} from '../../lib/admin/aiAgents';
import { 
  triggerRetrainingNow, 
  getAutoApproveConfig, 
  setAutoApproveConfig 
} from '../../lib/admin/learningQueue';
import { getModelPriorities } from '../../lib/admin/apiKeys';
import { subscribeLiveGenerationEvents } from '../../events/generationEvent';
import {
  getGrowthScalingState,
  rollbackGrowthScalingVersion,
  setFullAutoMode,
  evaluateGrowthAndScale,
  GrowthScalingState
} from '../../lib/admin/growthScaling';

export default function AiAgentPanel() {
  const [agents, setAgents] = useState<AiAgentItem[]>(() => getAiAgents());
  const [autoApprove, setAutoApprove] = useState<boolean>(() => getAutoApproveConfig());
  const [retrainingStatus, setRetrainingStatus] = useState<string | null>(null);
  const [liveAgentLog, setLiveAgentLog] = useState<string | null>(null);
  const [growthState, setGrowthState] = useState<GrowthScalingState>(() => getGrowthScalingState());
  const [evaluatingFactory, setEvaluatingFactory] = useState(false);

  // Form Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [agentName, setAgentName] = useState('');
  const [agentRole, setAgentRole] = useState('');
  const [selectedModel, setSelectedModel] = useState('gemini-3.6-flash');

  const textModels = getModelPriorities().text || ['gemini-3.6-flash', 'gemini-3.1-pro-preview', 'gemini-3.1-pro', 'gemini-3.1-flash-lite'];

  const loadAgents = useCallback(() => {
    setAgents(getAiAgents());
  }, []);

  const loadGrowth = useCallback(() => {
    setGrowthState(getGrowthScalingState());
  }, []);

  useEffect(() => {
    syncAiAgentsWithBackend().then(() => loadAgents());
    window.addEventListener('satset_ai_agents_updated', loadAgents);
    window.addEventListener('satset_growth_scaling_updated', loadGrowth);
    window.addEventListener('storage', () => {
      loadAgents();
      loadGrowth();
    });

    const unsubscribeLive = subscribeLiveGenerationEvents((data) => {
      if (data.type === 'agent_orchestrated' && data.result) {
        const res = data.result;
        setLiveAgentLog(`⚡ Multi-Agent Pipeline Completed: ${res.passed ? 'Relevance Audit PASSED' : 'Audit Flagged Issues'}`);
        setTimeout(() => setLiveAgentLog(null), 6000);
      } else if (data.type === 'growth_scaling_updated') {
        loadGrowth();
        loadAgents();
      }
    });

    return () => {
      window.removeEventListener('satset_ai_agents_updated', loadAgents);
      window.removeEventListener('satset_growth_scaling_updated', loadGrowth);
      unsubscribeLive();
    };
  }, [loadAgents, loadGrowth]);

  const handleToggleAutoApprove = () => {
    const next = !autoApprove;
    setAutoApprove(next);
    setAutoApproveConfig(next);
  };

  const handleToggleFullAutoMode = () => {
    const updated = setFullAutoMode(!growthState.fullAutoModeEnabled);
    setGrowthState(updated);
  };

  const handleManualFactoryEvaluation = () => {
    setEvaluatingFactory(true);
    setTimeout(() => {
      const mockMetrics = {
        activeClientsCount: safeAgents.length * 15,
        totalTransactionsCount: 120,
        weeklyGrowthRatePercent: 18,
        topCategory: 'fashion_beauty',
        dailyGenerationEventsEstimate: 450,
        summaryNarrative: 'Evaluasi manual Auto-Factory berhasil dijalankan.',
        calculatedAt: new Date().toISOString()
      };
      const res = evaluateGrowthAndScale(mockMetrics, 0, 93);
      setGrowthState(res.state);
      loadAgents();
      setEvaluatingFactory(false);
      setRetrainingStatus('✅ Evaluasi Auto-Factory selesai! Parameter sistem telah disesuaikan.');
      setTimeout(() => setRetrainingStatus(null), 5000);
    }, 1200);
  };

  const handleRollbackVersion = (versionNum: number) => {
    if (confirm(`Apakah Anda yakin ingin melakukan rollback konfigurasi parameter ke Versi #${versionNum}?`)) {
      try {
        const updated = rollbackGrowthScalingVersion(versionNum);
        setGrowthState(updated);
        loadAgents();
        setRetrainingStatus(`✅ Rollback ke Versi #${versionNum} Berhasil!`);
        setTimeout(() => setRetrainingStatus(null), 5000);
      } catch (e: any) {
        alert(e.message || 'Gagal melakukan rollback.');
      }
    }
  };

  const handleTriggerRetraining = () => {
    setRetrainingStatus('Sedang re-indexing seluruh memory patterns...');
    setTimeout(() => {
      const res = triggerRetrainingNow();
      setRetrainingStatus(`✅ Retraining Selesai! Level Memory AI meningkat ke Level ${res.memoryLevel}`);
      setTimeout(() => setRetrainingStatus(null), 5000);
    }, 1500);
  };

  const handleToggleStatus = (id: string) => {
    const list = getAiAgents();
    const idx = list.findIndex(a => a.id === id);
    if (idx >= 0) {
      list[idx].status = list[idx].status === 'active' ? 'inactive' : 'active';
      saveAiAgents(list);
      loadAgents();
    }
  };

  const handleDelete = (id: string) => {
    if (confirm('Apakah Anda yakin ingin menghapus AI Agent ini?')) {
      deleteAiAgent(id);
      loadAgents();
    }
  };

  const handleAddAgent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!agentName.trim()) return;

    const newAgent: AiAgentItem = {
      id: `agent_${Date.now()}`,
      name: agentName.trim(),
      role: agentRole.trim() || 'Agent ekstraksi & analisis otomatis',
      model: selectedModel,
      status: 'active',
      callsCount: 0,
      approvedPatternsCount: 0,
      rejectedPatternsCount: 0
    };

    const list = getAiAgents();
    list.push(newAgent);
    saveAiAgents(list);
    loadAgents();

    // Reset Form
    setAgentName('');
    setAgentRole('');
    setShowAddModal(false);
  };

  const safeAgents = Array.isArray(agents) ? agents : DEFAULT_AI_AGENTS;
  const activeCount = safeAgents.filter(a => a.status === 'active').length;
  const totalCalls = safeAgents.reduce((acc, curr) => acc + (curr.callsCount || 0), 0);
  const totalApproved = safeAgents.reduce((acc, curr) => acc + (curr.approvedPatternsCount || 0), 0);

  const columns = [
    {
      header: 'Nama Agent & Peran',
      render: (item: AiAgentItem) => (
        <div className="space-y-1">
          <div className="flex items-center gap-2 font-extrabold text-xs text-slate-900">
            <Bot className="w-4 h-4 text-[#3525cd]" />
            <span>{item.name}</span>
          </div>
          <div className="text-[11px] text-slate-500 max-w-xs leading-tight">
            {item.role}
          </div>
        </div>
      )
    },
    {
      header: 'AI Model',
      render: (item: AiAgentItem) => (
        <span className="px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-700 font-mono text-[11px] font-bold">
          {item.model}
        </span>
      )
    },
    {
      header: 'Statistik Panggilan',
      render: (item: AiAgentItem) => (
        <div className="text-xs space-y-0.5">
          <div className="font-extrabold text-slate-800">{item.callsCount || 0} Calls</div>
          <div className="text-[10px] text-slate-400">
            {item.approvedPatternsCount || 0} Disetujui • {item.rejectedPatternsCount || 0} Ditolak
          </div>
        </div>
      )
    },
    {
      header: 'Status',
      render: (item: AiAgentItem) => (
        <button
          type="button"
          onClick={() => handleToggleStatus(item.id)}
          className={`px-2.5 py-1 rounded-full text-[10px] font-bold border transition-colors cursor-pointer ${
            item.status === 'active'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
              : 'bg-slate-100 border-slate-200 text-slate-500 hover:bg-slate-200'
          }`}
        >
          {item.status === 'active' ? '● Aktif' : 'Nonaktif'}
        </button>
      )
    },
    {
      header: 'Aksi',
      render: (item: AiAgentItem) => (
        <button
          type="button"
          onClick={() => handleDelete(item.id)}
          className="p-1.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 transition-colors cursor-pointer"
          title="Hapus Agent"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      )
    }
  ];

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {retrainingStatus && (
        <div className="p-4 rounded-2xl bg-[#3525cd] text-white font-bold text-xs flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-amber-300" />
            <span>{retrainingStatus}</span>
          </div>
        </div>
      )}

      {/* Real-time Agent Pipeline Broadcast Toast */}
      {liveAgentLog && (
        <div className="p-4 rounded-2xl bg-slate-900 border border-indigo-500/40 text-white font-bold text-xs flex items-center justify-between shadow-lg animate-in fade-in zoom-in-95 duration-200">
          <div className="flex items-center gap-2.5">
            <Zap className="w-4 h-4 text-amber-400 animate-bounce" />
            <span className="text-indigo-200">{liveAgentLog}</span>
          </div>
          <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 text-[10px] uppercase font-mono font-extrabold">
            Live Stream
          </span>
        </div>
      )}

      {/* Top Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="AI Agents Terpasang"
          value={safeAgents.length}
          subtext={`${activeCount} Agent Aktif Beroperasi`}
          icon={<Bot className="w-5 h-5" />}
        />
        <StatCard
          title="Total Panggilan Ekstraksi"
          value={totalCalls}
          subtext="Dari submission TikTok klien"
          icon={<Activity className="w-5 h-5" />}
        />
        <StatCard
          title="Pola Berhasil Diserap"
          value={totalApproved}
          subtext="Tergabung di System Memory"
          icon={<Sparkles className="w-5 h-5" />}
        />
      </div>

      {/* Control Banner: Training & Auto Approve */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-500" />
            <h3 className="text-sm font-extrabold text-slate-900">
              Training & Auto-Approve Control
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Jalankan re-index memori sistem atau aktifkan auto-approve untuk pola dengan confidence di atas 90%.
          </p>
        </div>

        <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
          {/* Auto Approve Toggle */}
          <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
            <span className="text-xs font-bold text-slate-700">Auto-Approve (&gt;90%):</span>
            <button
              type="button"
              onClick={handleToggleAutoApprove}
              className="text-[#3525cd] cursor-pointer"
            >
              {autoApprove ? (
                <ToggleRight className="w-7 h-7 text-emerald-600" />
              ) : (
                <ToggleLeft className="w-7 h-7 text-slate-400" />
              )}
            </button>
          </div>

          {/* Retrain Button */}
          <button
            type="button"
            onClick={handleTriggerRetraining}
            className="px-4 py-2 rounded-xl bg-[#3525cd] hover:bg-[#2c1eb3] text-white text-xs font-extrabold transition-all shadow-xs flex items-center gap-2 cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Jalankan Training Ulang</span>
          </button>
        </div>
      </div>

      {/* Agent List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
            <Cpu className="w-5 h-5 text-[#3525cd]" />
            <span>Daftar AI Agents Aktif</span>
          </h3>

          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="px-3.5 py-2 rounded-xl bg-[#3525cd] hover:bg-[#2c1eb3] text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah AI Agent</span>
          </button>
        </div>

        <DataTable
          columns={columns}
          data={safeAgents}
          emptyMessage="Belum ada AI Agent yang terkonfigurasi."
        />
      </div>

      {/* AUTO-SCALING PARAMETER & META-FACTORY HISTORY PANEL */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Sliders className="w-5 h-5 text-[#3525cd]" />
              <h3 className="text-base font-extrabold text-slate-900">
                Riwayat Versioning Auto-Scaling & Parameter Auto-Factory
              </h3>
              <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-[#3525cd] font-mono text-[11px] font-extrabold">
                Versi Aktif #{growthState.configVersion || 1}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Sistem meta-agent mengevaluasi metrik pertumbuhan user 24/7 dan menyesuaikan parameter confidence threshold, frekuensi cron, serta status agent secara otomatis.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Full Auto Mode Toggle */}
            <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
              <span className="text-xs font-bold text-slate-700">Full Auto Mode:</span>
              <button
                type="button"
                onClick={handleToggleFullAutoMode}
                className="text-[#3525cd] cursor-pointer"
                title="Sistem akan otomatis mendeploy agent baru tanpa approval manual jika aktif"
              >
                {growthState.fullAutoModeEnabled ? (
                  <ToggleRight className="w-7 h-7 text-emerald-600" />
                ) : (
                  <ToggleLeft className="w-7 h-7 text-slate-400" />
                )}
              </button>
            </div>

            {/* Manual Evaluation Trigger */}
            <button
              type="button"
              onClick={handleManualFactoryEvaluation}
              disabled={evaluatingFactory}
              className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-extrabold transition-all shadow-xs flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <TrendingUp className={`w-4 h-4 text-emerald-400 ${evaluatingFactory ? 'animate-bounce' : ''}`} />
              <span>{evaluatingFactory ? 'Menevaluasi Metrik...' : 'Evaluasi Auto-Factory Sekarang'}</span>
            </button>
          </div>
        </div>

        {/* Current Active Parameters Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200/60">
          <div className="space-y-0.5">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Confidence Threshold Auto-Approve</div>
            <div className="text-sm font-extrabold text-slate-900">{growthState.autoApproveConfidenceThreshold || 90}% (Wajib Review Manual untuk Kategori Herbal)</div>
          </div>
          <div className="space-y-0.5">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Frekuensi Cron Auto-Trainer</div>
            <div className="text-sm font-extrabold text-slate-900">Setiap {growthState.autoTrainerIntervalMinutes || 60} Menit (24/7 Server Worker)</div>
          </div>
          <div className="space-y-0.5">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Mode Deteksi Anomali</div>
            <div className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5">
              <ShieldAlert className={`w-4 h-4 ${growthState.strictAbuseModeEnabled ? 'text-amber-500' : 'text-emerald-500'}`} />
              <span>{growthState.strictAbuseModeEnabled ? 'Strict Mode (Terdeteksi Anomali)' : 'Normal Protection Mode'}</span>
            </div>
          </div>
        </div>

        {/* Versioning History Table */}
        <div className="space-y-2">
          <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-slate-400" />
            <span>Riwayat Perubahan Versi Konfigurasi & Decision Log</span>
          </h4>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-2.5">Versi</th>
                  <th className="px-4 py-2.5">Tanggal & Waktu</th>
                  <th className="px-4 py-2.5">Trigger Metrik Pertumbuhan</th>
                  <th className="px-4 py-2.5">Aksi Parameter & Agent</th>
                  <th className="px-4 py-2.5 text-right">Opsi Rollback</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {(growthState.history || []).map((h) => (
                  <tr key={h.version} className={h.version === growthState.configVersion ? 'bg-indigo-50/40' : 'hover:bg-slate-50/60'}>
                    <td className="px-4 py-3 font-mono font-extrabold text-[#3525cd]">
                      #{h.version}
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-[11px]">
                      {new Date(h.timestamp).toLocaleString('id-ID')}
                    </td>
                    <td className="px-4 py-3 text-slate-800 font-bold max-w-xs">
                      {h.decisions && h.decisions.length > 0
                        ? h.decisions.map((d) => d.metricTrigger).join(' | ')
                        : 'Penyesuaian Manual Admin'}
                    </td>
                    <td className="px-4 py-3 text-slate-700 max-w-md">
                      {h.decisions && h.decisions.length > 0
                        ? h.decisions.map((d) => d.actionTaken).join('; ')
                        : 'Konfigurasi Parameter Versi'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {h.version === growthState.configVersion ? (
                        <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-extrabold text-[10px]">
                          Versi Aktif
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleRollbackVersion(h.version)}
                          className="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 font-bold text-[11px] transition-colors inline-flex items-center gap-1 cursor-pointer"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Rollback ke Versi ini</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ADD AGENT MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <Bot className="w-5 h-5 text-[#3525cd]" />
                <span>Tambah AI Agent Baru</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddAgent} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Nama AI Agent <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="misal: Agent Analisis Call To Action"
                  value={agentName}
                  onChange={(e) => setAgentName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:border-[#3525cd]"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Tugas / Peran Agent
                </label>
                <textarea
                  rows={3}
                  placeholder="Jelaskan instruksi spesifik agent ini..."
                  value={agentRole}
                  onChange={(e) => setAgentRole(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-[#3525cd]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Pilih AI Model
                </label>
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono font-bold text-slate-800 focus:outline-none focus:border-[#3525cd]"
                >
                  {textModels.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#3525cd] hover:bg-[#2c1eb3] text-white text-xs font-bold transition-all cursor-pointer"
                >
                  Simpan Agent
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
