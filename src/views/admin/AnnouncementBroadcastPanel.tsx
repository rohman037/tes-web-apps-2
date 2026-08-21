'use client';

import React, { useState, useEffect, useCallback } from "react";
import { Megaphone, Plus, Trash2, Send, Radio, CheckCircle2, AlertCircle, BellRing, Sparkles } from 'lucide-react';
import { sseManager } from '../../lib/sseManager';

export interface AnnouncementItem {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'promo' | 'warning' | 'update';
  isActive: boolean;
  targetRole: 'all' | 'vip' | 'public';
  createdAt: string;
}

export default function AnnouncementBroadcastPanel() {
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>(() => {
    try {
      const cached = localStorage.getItem('satset_announcements');
      return cached ? JSON.parse(cached) : [];
    } catch (e) {
      return [];
    }
  });
  const [loading, setLoading] = useState<boolean>(false);
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [formData, setFormData] = useState<{
    title: string;
    message: string;
    type: 'info' | 'promo' | 'warning' | 'update';
    targetRole: 'all' | 'vip' | 'public';
  }>({
    title: '',
    message: '',
    type: 'info',
    targetRole: 'all',
  });

  const loadAnnouncements = useCallback(async () => {
    try {
      const res = await fetch('/api/announcements');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setAnnouncements(data);
          localStorage.setItem('satset_announcements', JSON.stringify(data));
        }
      }
    } catch (e) {
      console.warn('[AnnouncementBroadcastPanel] Error fetching:', e);
    }
  }, []);

  useEffect(() => {
    const unsub = sseManager.subscribe((data) => {
      if (data && (data.type === 'announcement_broadcast' || data.type === 'announcements_updated')) {
        if (Array.isArray(data.announcements)) {
          setAnnouncements(data.announcements);
        }
      }
    });
    window.addEventListener('satset_announcements_updated', loadAnnouncements);
    return () => {
      unsub();
      window.removeEventListener('satset_announcements_updated', loadAnnouncements);
    };
  }, [loadAnnouncements]);

  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.message.trim()) return;

    setIsSubmitting(true);
    const newItem: AnnouncementItem = {
      id: 'ann_' + Date.now(),
      title: formData.title.trim(),
      message: formData.message.trim(),
      type: formData.type,
      isActive: true,
      targetRole: formData.targetRole,
      createdAt: new Date().toISOString(),
    };

    try {
      const res = await fetch('/api/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newItem),
      });

      if (res.ok) {
        setToastMessage('📢 Pengumuman berhasil disiarkan secara Real-time!');
        setShowAddModal(false);
        setFormData({ title: '', message: '', type: 'info', targetRole: 'all' });
        loadAnnouncements();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmitting(false);
      setTimeout(() => setToastMessage(null), 4000);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus pengumuman ini?')) return;
    try {
      const res = await fetch(`/api/announcements/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setToastMessage('Pengumuman berhasil dihapus');
        loadAnnouncements();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setTimeout(() => setToastMessage(null), 3000);
    }
  };

  return (
    <div className="space-y-6">
      {toastMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center justify-between animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-indigo-900 via-slate-900 to-indigo-950 p-6 rounded-2xl text-white shadow-lg border border-indigo-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Megaphone className="w-6 h-6 text-amber-300" />
            <h2 className="text-xl font-black tracking-tight">Pengumuman & Broadcast Real-time</h2>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
              <Radio className="w-3 h-3 animate-pulse text-emerald-400" /> Live Broadcast
            </span>
          </div>
          <p className="text-xs text-slate-300">
            Kirimkan notifikasi dan pengumuman instan ke seluruh tab user yang sedang aktif secara langsung via SSE Stream.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2.5 rounded-xl bg-[#3525cd] hover:bg-indigo-600 text-white font-bold text-xs shadow-md transition-all flex items-center gap-2 shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Buat Pengumuman Baru</span>
        </button>
      </div>

      {/* Announcements List */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-4">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <BellRing className="w-4 h-4 text-[#3525cd]" />
          Daftar Pengumuman Aktif ({announcements.length})
        </h3>

        {loading ? (
          <div className="py-12 text-center text-xs text-slate-400 font-semibold animate-pulse">
            Memuat data pengumuman...
          </div>
        ) : announcements.length === 0 ? (
          <div className="py-12 text-center space-y-2 border-2 border-dashed border-slate-200 rounded-xl">
            <Megaphone className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-xs font-bold text-slate-600">Belum Ada Pengumuman Siaran</p>
            <p className="text-[11px] text-slate-400">Klik tombol di atas untuk membuat siaran pengumuman ke seluruh pengguna.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {announcements.map((ann) => (
              <div key={ann.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50 hover:bg-white transition-all space-y-3 relative group">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase ${
                      ann.type === 'promo' ? 'bg-amber-100 text-amber-800' :
                      ann.type === 'warning' ? 'bg-rose-100 text-rose-800' :
                      ann.type === 'update' ? 'bg-indigo-100 text-[#3525cd]' :
                      'bg-slate-200 text-slate-700'
                    }`}>
                      {ann.type}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">
                      Target: {ann.targetRole.toUpperCase()}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDelete(ann.id)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all cursor-pointer"
                    title="Hapus"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div>
                  <h4 className="text-xs font-extrabold text-slate-900">{ann.title}</h4>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">{ann.message}</p>
                </div>

                <div className="text-[10px] font-mono text-slate-400 border-t border-slate-200/60 pt-2 flex items-center justify-between">
                  <span>Dibuat: {new Date(ann.createdAt).toLocaleString('id-ID')}</span>
                  <span className="text-emerald-600 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Live
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Announcement Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Megaphone className="w-5 h-5 text-[#3525cd]" />
                <h3 className="text-base font-extrabold text-slate-900">Siarkan Pengumuman Baru</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleBroadcast} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Judul Pengumuman</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Update Sistem v2.5 & Promo Diskon VIP"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-[#3525cd] outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Pesan Pengumuman</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Tuliskan detail pengumuman yang akan dikirim langsung ke pengguna..."
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-[#3525cd] outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Kategori Tipe</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold bg-white"
                  >
                    <option value="info">Informasi (Info)</option>
                    <option value="promo">Promo Diskon 🎁</option>
                    <option value="update">Update Fitur 🚀</option>
                    <option value="warning">Penting / Maintenance ⚠️</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Target Pengguna</label>
                  <select
                    value={formData.targetRole}
                    onChange={(e) => setFormData({ ...formData, targetRole: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold bg-white"
                  >
                    <option value="all">Semua Pengguna</option>
                    <option value="vip">Khusus Member VIP</option>
                    <option value="public">Calon Pembeli / Public</option>
                  </select>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-slate-600 font-bold text-xs hover:bg-slate-200 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-[#3525cd] text-white font-bold text-xs hover:bg-indigo-600 transition-all shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isSubmitting ? 'Meniarkan...' : 'Siarkan Sekarang'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
