'use client';

import React, { useState, useEffect, useCallback } from "react";
import { 
  Activity, 
  Radio, 
  Zap, 
  Users, 
  Bot, 
  Clock, 
  Search, 
  Filter, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  ShieldAlert, 
  RefreshCw, 
  Volume2, 
  VolumeX, 
  Cpu, 
  Layers, 
  Copy, 
  Check, 
  Eye, 
  Download,
  Trash2,
  Lock,
  Sparkles,
  ArrowUpRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GenerationEvent, ActiveGenerationItem, subscribeLiveGenerationEvents } from '../../events/generationEvent';
import { sseManager } from '../../lib/sseManager';
import { getClients, ClientItem } from '../../lib/admin/clients';

export default function LiveUserGenerationMonitorPanel() {
  const [activeGenerations, setActiveGenerations] = useState<ActiveGenerationItem[]>([]);
  const [events, setEvents] = useState<GenerationEvent[]>([]);
  const [clients, setClients] = useState<ClientItem[]>(() => {
    try {
      return getClients();
    } catch (e) {
      return [];
    }
  });
  const [loading, setLoading] = useState<boolean>(false);
  const [sseConnected, setSseConnected] = useState<boolean>(true);
  
  // Search & Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedToolFilter, setSelectedToolFilter] = useState<string>('all');
  const [selectedOutcomeFilter, setSelectedOutcomeFilter] = useState<string>('all');
  
  // Audio & Inspector State
  const [soundEnabled, setSoundEnabled] = useState<boolean>(false);
  const [inspectEvent, setInspectEvent] = useState<GenerationEvent | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const playNotificationBeep = useCallback(() => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime); // A5 note
      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    } catch (e) {
      // AudioContext not allowed without user interaction
    }
  }, []);

  const loadClients = useCallback(() => {
    try {
      const list = getClients();
      setClients(list);
    } catch (e) {
      console.warn('Failed loading clients', e);
    }
  }, []);

  const fetchInitialEvents = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/events/live');
      if (res.ok) {
        const data = await res.json();
        if (data.activeGenerations) setActiveGenerations(data.activeGenerations);
        if (data.events) setEvents(data.events);
      }
    } catch (e) {
      console.warn('Failed fetching live events', e);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load initial snapshot data & connect live listener
  useEffect(() => {
    // Subscribe to SSE Live Stream
    const unsubscribe = subscribeLiveGenerationEvents((data) => {
      setLoading(false);
      setSseConnected(true);

      if (data.activeGenerations) {
        setActiveGenerations(data.activeGenerations);
      }

      if (data.events) {
        setEvents(data.events);
      }

      if (data.type === 'active_status_update' && data.activeGeneration) {
        const item = data.activeGeneration;
        setActiveGenerations((prev) => {
          const exists = prev.some((g) => g.id === item.id);
          if (exists) {
            return prev.map((g) => (g.id === item.id ? { ...g, ...item } : g));
          }
          return [item, ...prev];
        });

        if (soundEnabled && item.status === 'generating') {
          playNotificationBeep();
        }
      }

      if (data.type === 'generation_event' && data.event) {
        const newEvt = data.event;
        setEvents((prev) => [newEvt, ...prev.filter((e) => e.id !== newEvt.id)]);
        
        // Remove from active generations when completed
        if (newEvt.outcome === 'success' || newEvt.outcome === 'error') {
          setActiveGenerations((prev) => prev.filter((g) => g.id !== newEvt.id));
        }

        if (soundEnabled) {
          playNotificationBeep();
        }
      }
    });

    const handleSseStatus = (e: any) => {
      setSseConnected(e.detail?.status === 'connected');
    };
    window.addEventListener('satset_sse_status', handleSseStatus);

    return () => {
      unsubscribe();
      window.removeEventListener('satset_sse_status', handleSseStatus);
    };
  }, [soundEnabled, fetchInitialEvents, playNotificationBeep]);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(text);
    setToastMessage(`Kode ${label} (${text}) tersalin!`);
    setTimeout(() => {
      setCopiedCode(null);
      setToastMessage(null);
    }, 2500);
  };

  // Filter events
  const filteredEvents = events.filter((evt) => {
    const matchesQuery = 
      !searchQuery ||
      evt.accessCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      evt.clientId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      evt.tool.toLowerCase().includes(searchQuery.toLowerCase()) ||
      evt.category.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesTool = selectedToolFilter === 'all' || evt.tool === selectedToolFilter;
    const matchesOutcome = selectedOutcomeFilter === 'all' || evt.outcome === selectedOutcomeFilter;

    return matchesQuery && matchesTool && matchesOutcome;
  });

  const activeGenCount = activeGenerations.filter(g => g.status === 'generating' || g.status === 'analyzing').length;
  const successCount = events.filter(e => e.outcome === 'success').length;
  const avgLatency = events.length > 0 
    ? Math.round(events.reduce((acc, e) => acc + (e.latencyMs || 0), 0) / events.length) 
    : 1450;

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center justify-between shadow-sm"
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{toastMessage}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Banner - Pemantauan Real-time */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 rounded-2xl text-white shadow-xl border border-indigo-800/80 space-y-5">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="w-8 h-8 rounded-xl bg-indigo-600/80 border border-indigo-400/30 flex items-center justify-center text-amber-300 shadow-xs">
                <Radio className="w-4 h-4 animate-pulse" />
              </div>
              <h2 className="text-xl font-black tracking-tight text-white">Pemantau Generasi Real-time User</h2>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 border ${
                sseConnected 
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30' 
                  : 'bg-rose-500/20 text-rose-300 border-rose-400/30'
              }`}>
                <span className={`w-2 h-2 rounded-full ${sseConnected ? 'bg-emerald-400 animate-ping' : 'bg-rose-400'}`} />
                {sseConnected ? 'LIVE STREAM ACTIVE' : 'RECONNECTING SSE...'}
              </span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Pantau siapa saja pengguna yang sedang memproses generasi AI (Idea Konten, Prompt Foto, Video-to-Prompt, TikTok Downloader) secara langsung 24/7.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Audio Toggle */}
            <button
              type="button"
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${
                soundEnabled 
                  ? 'bg-amber-400/20 text-amber-300 border-amber-400/40' 
                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
              }`}
              title={soundEnabled ? 'Suara Notifikasi Aktif' : 'Suara Notifikasi Senyap'}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4 text-amber-300" /> : <VolumeX className="w-4 h-4" />}
              <span className="hidden sm:inline">{soundEnabled ? 'Notifikasi Suara ON' : 'Suara Mute'}</span>
            </button>

            {/* Manual Refresh */}
            <button
              type="button"
              onClick={fetchInitialEvents}
              disabled={loading}
              className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-sm border border-indigo-400/30 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh Data</span>
            </button>
          </div>
        </div>

        {/* Real-time Summary Cards Bento */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 pt-2 border-t border-indigo-900/80">
          <div className="bg-slate-900/90 border border-slate-800 p-3.5 rounded-xl space-y-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-300 flex items-center gap-1">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>User Aktif Generasi</span>
            </span>
            <div className="text-2xl font-extrabold text-white font-mono flex items-center gap-2">
              <span>{activeGenCount}</span>
              {activeGenCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-sans font-bold animate-pulse">
                  PROSES LIVE
                </span>
              )}
            </div>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 p-3.5 rounded-xl space-y-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1">
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
              <span>Total Request Berhasil</span>
            </span>
            <div className="text-2xl font-extrabold text-emerald-400 font-mono">
              {successCount} <span className="text-xs text-slate-400 font-normal">/ {events.length}</span>
            </div>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 p-3.5 rounded-xl space-y-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-indigo-400" />
              <span>Rata-Rata Latensi AI</span>
            </span>
            <div className="text-2xl font-extrabold text-indigo-300 font-mono">
              {avgLatency} <span className="text-xs text-slate-400 font-normal">ms</span>
            </div>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 p-3.5 rounded-xl space-y-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1">
              <Cpu className="w-3.5 h-3.5 text-purple-400" />
              <span>Multi-Agent Governor</span>
            </span>
            <div className="text-2xl font-extrabold text-purple-300 font-mono">
              100% <span className="text-xs text-emerald-400 font-normal">Active</span>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 1: LIVE USER GENERATING NOW */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
            <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
              <span>Pengguna yang Sedang Generasi</span>
              <span className="px-2 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-[#3525cd] text-xs font-mono font-bold">
                {activeGenerations.length} User
              </span>
            </h3>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">
            Auto-Updated via SSE Stream
          </span>
        </div>

        {activeGenerations.length === 0 ? (
          <div className="py-12 text-center space-y-2 border-2 border-dashed border-slate-200/80 rounded-2xl bg-slate-50/50">
            <Bot className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-xs font-bold text-slate-700">Tidak Ada Antrean Generasi Aktif Saat Ini</p>
            <p className="text-[11px] text-slate-400 max-w-md mx-auto">
              Sistem AI Agent berada dalam mode standby. Begitu pengguna menekan tombol generasi di tool manapun, statusnya akan muncul secara live di sini.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeGenerations.map((gen) => (
              <motion.div
                key={gen.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-4 rounded-2xl border border-indigo-200/80 bg-gradient-to-br from-indigo-50/40 via-white to-purple-50/20 shadow-xs space-y-3 relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-xl pointer-events-none" />

                {/* Top User Info Bar */}
                <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2.5">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="px-2 py-0.5 rounded-md bg-[#3525cd] text-white text-[10px] font-mono font-bold">
                        {gen.accessCode || 'GUEST-ACCESS'}
                      </span>
                      <span className="text-[10px] font-semibold text-slate-500">
                        ID: {gen.clientId ? gen.clientId.substring(0, 10) : 'Anon'}
                      </span>
                    </div>
                    <span className="text-xs font-black text-slate-900 mt-1 block">
                      Tool: {gen.tool || 'Generasi Content'}
                    </span>
                  </div>

                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold flex items-center gap-1 shrink-0 ${
                    gen.status === 'analyzing'
                      ? 'bg-purple-100 text-purple-800 border border-purple-200 animate-pulse'
                      : gen.status === 'active'
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      : 'bg-amber-100 text-amber-800 border border-amber-200 animate-pulse'
                  }`}>
                    <Zap className={`w-3 h-3 ${gen.status === 'active' ? 'text-emerald-600' : 'text-amber-500'}`} />
                    {gen.status === 'analyzing' ? 'Agent Analysing...' : gen.status === 'active' ? 'Aktif Online' : 'Generating...'}
                  </span>
                </div>

                {/* Details / Category */}
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center justify-between text-slate-500 text-[11px]">
                    <span>Kategori: <strong className="text-slate-800">{gen.category || 'General'}</strong></span>
                    <span className="font-mono text-slate-400">
                      {gen.startedAt ? new Date(gen.startedAt).toLocaleTimeString('id-ID') : 'Baru saja'}
                    </span>
                  </div>

                  {gen.details && (
                    <p className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/60 text-[11px] text-slate-600 line-clamp-2 italic font-mono">
                      &quot;{gen.details}&quot;
                    </p>
                  )}
                </div>

                {/* Action footer */}
                <div className="pt-1 flex items-center justify-between border-t border-slate-100 text-[10px]">
                  <button
                    type="button"
                    onClick={() => copyToClipboard(gen.accessCode, 'Akses')}
                    className="text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Copy className="w-3 h-3" />
                    <span>Salin Kode Akses</span>
                  </button>

                  <span className="text-emerald-600 font-bold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                    Live Connection
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* SECTION 2: REALTIME GENERATION LOG FEED */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-5">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <Layers className="w-5 h-5 text-[#3525cd]" />
              <span>Log Event Generasi User Terkini</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Daftar riwayat eksekusi AI tool seluruh user beserta detail model, latensi, dan token.
            </p>
          </div>

          <div className="text-xs font-mono font-bold text-slate-600 px-3 py-1.5 bg-slate-100 rounded-xl">
            Total Event Log: {filteredEvents.length} / {events.length}
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari Kode Akses / Tool / Client..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-[#3525cd] outline-none"
            />
          </div>

          {/* Filter Tool */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400 shrink-0" />
            <select
              value={selectedToolFilter}
              onChange={(e) => setSelectedToolFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold bg-white"
            >
              <option value="all">Semua AI Tool</option>
              <option value="idea_konten">Idea Konten AI</option>
              <option value="video_to_prompt">Video-to-Prompt</option>
              <option value="prompt_foto">Prompt Foto Nano</option>
              <option value="tiktok_downloader">TikTok Downloader</option>
              <option value="ekstraktor_frame">Frame Extractor</option>
            </select>
          </div>

          {/* Filter Outcome */}
          <div>
            <select
              value={selectedOutcomeFilter}
              onChange={(e) => setSelectedOutcomeFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold bg-white"
            >
              <option value="all">Semua Status Hasil</option>
              <option value="success">Sukses (SUCCESS)</option>
              <option value="error">Gagal (ERROR)</option>
              <option value="flagged">Di-Flag (FLAGGED)</option>
            </select>
          </div>
        </div>

        {/* Table Log Feed */}
        {loading ? (
          <div className="py-12 text-center text-xs text-slate-400 font-semibold animate-pulse">
            Memuat data log generasi real-time...
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="py-12 text-center space-y-2 border border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
            <Activity className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-xs font-bold text-slate-600">Tidak Ada Log Event Generasi Ditemukan</p>
            <p className="text-[11px] text-slate-400">Belum ada event generasi yang sesuai dengan kata kunci atau filter pencarian.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900 text-slate-300 text-[11px] uppercase tracking-wider font-extrabold border-b border-slate-800">
                <tr>
                  <th className="p-3.5">Waktu</th>
                  <th className="p-3.5">Pengguna / Kode</th>
                  <th className="p-3.5">AI Tool</th>
                  <th className="p-3.5">Kategori</th>
                  <th className="p-3.5">Model Used</th>
                  <th className="p-3.5">Latensi</th>
                  <th className="p-3.5 text-center">Status</th>
                  <th className="p-3.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredEvents.map((evt) => (
                  <tr key={evt.id} className="hover:bg-indigo-50/30 transition-colors">
                    <td className="p-3.5 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                      {new Date(evt.timestamp).toLocaleTimeString('id-ID')}
                    </td>

                    <td className="p-3.5">
                      <div className="font-bold text-slate-900 font-mono text-xs">
                        {evt.accessCode || 'GUEST'}
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono">
                        Tier: {evt.packageTier || 'standard'}
                      </span>
                    </td>

                    <td className="p-3.5 font-semibold text-indigo-900">
                      <span className="px-2 py-0.5 rounded-md bg-indigo-50 border border-indigo-100 text-[#3525cd] text-[11px]">
                        {evt.tool}
                      </span>
                    </td>

                    <td className="p-3.5 text-slate-600">
                      {evt.category || 'General'}
                    </td>

                    <td className="p-3.5 font-mono text-[11px] text-slate-600">
                      {evt.modelUsed || 'Gemini 2.5 Flash'}
                    </td>

                    <td className="p-3.5 font-mono text-[11px] text-slate-600">
                      {evt.latencyMs ? `${evt.latencyMs}ms` : '1.2s'}
                    </td>

                    <td className="p-3.5 text-center whitespace-nowrap">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
                        evt.outcome === 'success' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                        evt.outcome === 'error' ? 'bg-rose-100 text-rose-800 border border-rose-200' :
                        'bg-amber-100 text-amber-800 border border-amber-200'
                      }`}>
                        {evt.outcome}
                      </span>
                    </td>

                    <td className="p-3.5 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setInspectEvent(evt)}
                        className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-[#3525cd] font-bold text-xs transition-all cursor-pointer flex items-center gap-1 ml-auto"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Inspect</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* INSPECT EVENT MODAL */}
      <AnimatePresence>
        {inspectEvent && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 space-y-5"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Cpu className="w-5 h-5 text-[#3525cd]" />
                  <h3 className="text-base font-extrabold text-slate-900">Detail Event Generasi AI</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setInspectEvent(null)}
                  className="text-slate-400 hover:text-slate-600 font-bold text-sm cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div>
                    <span className="text-[10px] uppercase font-extrabold text-slate-400">Kode Akses</span>
                    <p className="font-mono font-bold text-slate-900 text-sm">{inspectEvent.accessCode}</p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-extrabold text-slate-400">Waktu Eksekusi</span>
                    <p className="font-mono text-slate-700">{new Date(inspectEvent.timestamp).toLocaleString('id-ID')}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-[10px] uppercase font-extrabold text-slate-400">Tool</span>
                    <p className="font-bold text-indigo-900">{inspectEvent.tool}</p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-extrabold text-slate-400">Kategori</span>
                    <p className="font-bold text-slate-800">{inspectEvent.category}</p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-extrabold text-slate-400">AI Model</span>
                    <p className="font-mono text-slate-800">{inspectEvent.modelUsed}</p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-extrabold text-slate-400">Latensi System</span>
                    <p className="font-mono text-emerald-600 font-bold">{inspectEvent.latencyMs} ms</p>
                  </div>
                </div>

                {inspectEvent.toneOfVoice && (
                  <div>
                    <span className="text-[10px] uppercase font-extrabold text-slate-400">Tone of Voice</span>
                    <p className="p-2 rounded-lg bg-slate-100 text-slate-700 font-mono text-[11px]">{inspectEvent.toneOfVoice}</p>
                  </div>
                )}

                <div>
                  <span className="text-[10px] uppercase font-extrabold text-slate-400">Hasil Status</span>
                  <p className="font-mono font-bold text-slate-800 uppercase">{inspectEvent.outcome}</p>
                </div>
              </div>

              <div className="pt-2 flex justify-end border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setInspectEvent(null)}
                  className="px-4 py-2 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 cursor-pointer"
                >
                  Tutup Inspection
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
