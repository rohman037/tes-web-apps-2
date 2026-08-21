'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Brain, 
  Sparkles, 
  ShieldCheck, 
  Filter, 
  Search, 
  AlertTriangle,
  X,
  FileText,
  Clock,
  CheckCircle2,
  Lock
} from 'lucide-react';
import StatCard from '../../components/admin/StatCard';
import SafeLearningReviewCard from '../../components/admin/SafeLearningReviewCard';
import { 
  getSafeLearningQueue, 
  approveSafeLearningItem, 
  rejectSafeLearningItem, 
  getAutoApproveState, 
  setAutoApproveState, 
  SafeLearningItem 
} from '../../agents/safeLearningQueue';
import { GenerationEvent } from '../../events/generationEvent';
import { getAutoTrainerState, runAutoTrainingJob, AutoTrainerState } from '../../agents/autoTrainer';

export default function LearningReviewPanel() {
  const [queue, setQueue] = useState<SafeLearningItem[]>(() => getSafeLearningQueue());
  const [autoApprove, setAutoApprove] = useState<boolean>(() => getAutoApproveState());
  const [trainerState, setTrainerState] = useState<AutoTrainerState>(() => getAutoTrainerState());
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('pending');

  // Modal State for Source Events
  const [sourceModalOpen, setSourceModalOpen] = useState(false);
  const [selectedEventIds, setSelectedEventIds] = useState<string[]>([]);
  const [fetchedEvents, setFetchedEvents] = useState<GenerationEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);

  const loadData = useCallback(() => {
    setQueue(getSafeLearningQueue());
    setAutoApprove(getAutoApproveState());
    setTrainerState(getAutoTrainerState());
  }, []);

  useEffect(() => {
    window.addEventListener('satset_safe_learning_queue_updated', loadData);
    window.addEventListener('satset_learning_config_updated', loadData);
    window.addEventListener('satset_auto_trainer_updated', loadData);
    window.addEventListener('storage', loadData);

    return () => {
      window.removeEventListener('satset_safe_learning_queue_updated', loadData);
      window.removeEventListener('satset_learning_config_updated', loadData);
      window.removeEventListener('satset_auto_trainer_updated', loadData);
      window.removeEventListener('storage', loadData);
    };
  }, [loadData]);

  const handleRunTrainerNow = () => {
    const res = runAutoTrainingJob();
    loadData();
    alert(`Auto-Training Sukses!\n• Pola Di-Scan: ${res.totalProcessed}\n• Auto-Approved & Injected: ${res.autoApprovedCount}\n• Ditahan (Herbal/Low Confidence): ${res.manualReviewCount}`);
  };

  const handleToggleAutoApprove = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.checked;
    setAutoApprove(val);
    setAutoApproveState(val);
    loadData();
  };

  const handleApprove = (id: string, customDesc?: string) => {
    approveSafeLearningItem(id, customDesc);
    loadData();
  };

  const handleReject = (id: string) => {
    rejectSafeLearningItem(id);
    loadData();
  };

  const handleViewSourceEvents = async (sourceEventIds: string[]) => {
    setSelectedEventIds(sourceEventIds);
    setSourceModalOpen(true);
    setLoadingEvents(true);

    try {
      const res = await fetch('/api/events');
      if (res.ok) {
        const allEvents: GenerationEvent[] = await res.json();
        const matched = allEvents.filter((e) => sourceEventIds.includes(e.id));
        setFetchedEvents(matched);
      }
    } catch (e) {
      console.warn('[LearningReviewPanel] Error fetching source events:', e);
    } finally {
      setLoadingEvents(false);
    }
  };

  const filteredQueue = queue.filter((item) => {
    const matchStatus = statusFilter === 'all' || item.status === statusFilter;
    const matchCategory = categoryFilter === 'all' || item.category === categoryFilter;
    const query = search.toLowerCase();
    const matchSearch =
      !query ||
      item.patternName.toLowerCase().includes(query) ||
      item.description.toLowerCase().includes(query) ||
      (item.clientName && item.clientName.toLowerCase().includes(query));

    return matchStatus && matchCategory && matchSearch;
  });

  const pendingCount = queue.filter((i) => i.status === 'pending').length;
  const approvedCount = queue.filter((i) => i.status === 'approved').length;
  const rejectedCount = queue.filter((i) => i.status === 'rejected').length;

  return (
    <div className="space-y-6">
      {/* Top Banner & Control Settings */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-2xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <Brain className="w-5 h-5 text-[#5b50e5]" />
              <span>Safe Learning Queue & Agent Pattern Review</span>
            </h2>
            <p className="text-xs text-slate-500">
              Verifikasi pola narasi yang diekstrak oleh Agent sebelum diinjeksikan ke System Memory.
            </p>
          </div>

          {/* Auto Approve Toggle */}
          <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
            <div className="text-right">
              <div className="text-xs font-bold text-slate-900">Auto-Approve (&gt;90% Confidence)</div>
              <div className="text-[10px] text-slate-500 font-medium">Otomatis setujui pola terverifikasi</div>
            </div>

            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={autoApprove}
                onChange={handleToggleAutoApprove}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#5b50e5]"></div>
            </label>
          </div>
        </div>

        {/* Auto-Training Scheduler Widget */}
        <div className="p-4 rounded-xl bg-indigo-50/70 border border-indigo-100 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
          <div className="space-y-1">
            <div className="font-extrabold text-slate-900 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Cron Auto-Training Per Jam (Scheduled)</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] bg-indigo-100 text-[#3525cd] font-bold">
                Interval 1 Jam
              </span>
            </div>
            <p className="text-slate-600">
              Terakhir dijalankan:{' '}
              <span className="font-bold font-mono">
                {trainerState.lastRunAt ? new Date(trainerState.lastRunAt).toLocaleTimeString('id-ID') : 'Belum pernah'}
              </span>{' '}
              | Hasil:{' '}
              <span className="font-bold text-emerald-700">
                {trainerState.autoApprovedCount} Auto-Merged
              </span>
              ,{' '}
              <span className="font-bold text-amber-700">
                {trainerState.manualReviewCount} Ditahan Manual / Herbal
              </span>
            </p>
          </div>

          <button
            type="button"
            onClick={handleRunTrainerNow}
            className="px-3.5 py-2 rounded-xl bg-[#3525cd] hover:bg-[#2c1eb3] text-white font-bold text-xs shadow-xs transition-all flex items-center gap-1.5 shrink-0 cursor-pointer"
          >
            <Brain className="w-4 h-4" />
            <span>Jalankan Trainer Sekarang</span>
          </button>
        </div>

        {/* Safety Disclaimer Banner */}
        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-300/40 text-amber-950 flex items-center gap-2.5 text-xs font-semibold">
          <Lock className="w-4 h-4 text-amber-700 shrink-0" />
          <span>
            <strong>Aturan Keamanan Medis:</strong> Pola ber-kategori <code>herbal_kesehatan</code> TIDAK AKAN PERNAH di-auto-approve walaupun persentase confidence &gt;90% atau toggle auto-approve diaktifkan. Wajib review manual oleh Admin.
          </span>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Menunggu Review Admin"
          value={`${pendingCount} Pola`}
          subtext="Membutuhkan verifikasi"
          badge={{ text: pendingCount > 0 ? 'Pending Action' : 'Bersih', type: pendingCount > 0 ? 'warning' : 'success' }}
          icon={<Clock className="w-4 h-4" />}
          iconBgColor="bg-amber-50 border-amber-100"
          iconTextColor="text-amber-600"
        />

        <StatCard
          title="Pola Disetujui"
          value={`${approvedCount} Pola`}
          subtext="Masuk ke System Memory"
          badge={{ text: 'Terinjeksi', type: 'success' }}
          icon={<ShieldCheck className="w-4 h-4" />}
          iconBgColor="bg-emerald-50 border-emerald-100"
          iconTextColor="text-emerald-600"
        />

        <StatCard
          title="Pola Ditolak"
          value={`${rejectedCount} Pola`}
          subtext="Diarsipkan"
          badge={{ text: 'Archived', type: 'info' }}
          icon={<X className="w-4 h-4" />}
          iconBgColor="bg-slate-100 border-slate-200"
          iconTextColor="text-slate-600"
        />
      </div>

      {/* Filter & Search Bar */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari pola narasi, hook, atau nama klien..."
            className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#5b50e5]/20 font-medium"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          <div className="flex items-center gap-1 shrink-0 text-xs font-bold text-slate-500 mr-1">
            <Filter className="w-3.5 h-3.5" /> Filter Status:
          </div>

          {(['pending', 'approved', 'rejected', 'all'] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize transition-colors cursor-pointer shrink-0 ${
                statusFilter === st
                  ? 'bg-[#5b50e5] text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Queue Items List */}
      <div className="space-y-4">
        {filteredQueue.length === 0 ? (
          <div className="p-12 rounded-2xl bg-white border border-slate-200/80 shadow-2xs text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-800">Tidak Ada Antrean Pola</h4>
              <p className="text-xs text-slate-500 max-w-xs mx-auto mt-1">
                Semua pola hasil ekstraksi agent telah selesai diverifikasi atau tidak cocok dengan filter.
              </p>
            </div>
          </div>
        ) : (
          filteredQueue.map((item) => (
            <SafeLearningReviewCard
              key={item.id}
              item={item}
              onApprove={handleApprove}
              onReject={handleReject}
              onViewSourceEvents={handleViewSourceEvents}
            />
          ))
        )}
      </div>

      {/* Modal View Source Events */}
      {sourceModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden space-y-0 animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold">Event Sumber Data Ekstraksi</h3>
                  <p className="text-xs text-slate-400">
                    Tracers ID ({selectedEventIds.length} Event Terdaftar)
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSourceModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 max-h-[60vh] overflow-y-auto space-y-3">
              {loadingEvents ? (
                <div className="p-8 text-center text-xs text-slate-500 animate-pulse">
                  Memuat rincian event dari tracking.json...
                </div>
              ) : fetchedEvents.length === 0 ? (
                <div className="p-6 bg-slate-50 rounded-2xl text-center space-y-2">
                  <p className="text-xs font-semibold text-slate-600">ID Event Sumber:</p>
                  <div className="font-mono text-xs text-indigo-600 bg-white p-3 rounded-xl border border-slate-200">
                    {selectedEventIds.join(', ')}
                  </div>
                </div>
              ) : (
                fetchedEvents.map((evt) => (
                  <div
                    key={evt.id}
                    className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between font-mono font-bold text-slate-800">
                      <span>{evt.id}</span>
                      <span className="text-slate-400 text-[10px]">
                        {new Date(evt.timestamp).toLocaleString()}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600">
                      <div>
                        Client: <strong className="text-slate-900">{evt.clientId}</strong>
                      </div>
                      <div>
                        Tool: <strong className="text-slate-900">{evt.tool}</strong>
                      </div>
                      <div>
                        Model: <strong className="text-slate-900">{evt.modelUsed}</strong> ({evt.tierUsed})
                      </div>
                      <div>
                        Latency: <strong className="text-slate-900">{evt.latencyMs}ms</strong>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setSourceModalOpen(false)}
                className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
