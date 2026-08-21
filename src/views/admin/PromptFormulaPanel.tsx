'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Sparkles, Plus, Trash2, Code2, Copy, CheckCircle2, Sliders, Layers } from 'lucide-react';

export interface PromptFormulaItem {
  id: string;
  title: string;
  category: 'video' | 'photo' | 'ideas' | 'splitter';
  targetStyle: string;
  templateText: string;
  isActive: boolean;
  usageCount: number;
}

const DEFAULT_FORMULAS: PromptFormulaItem[] = [
  {
    id: 'fml_01',
    title: 'Cinematic Visual UGC Review (8K High-Key)',
    category: 'video',
    targetStyle: 'Cinematic Commercial',
    templateText: 'High-end 8k resolution, cinematic lighting, shallow depth of field, natural motion blur. Camera slow push-in to product. Photorealistic, organic textures.',
    isActive: true,
    usageCount: 142
  },
  {
    id: 'fml_02',
    title: 'TikTok Viral Softsell Hook (0-3s BLUFF)',
    category: 'ideas',
    targetStyle: 'Viral Short-form',
    templateText: 'Visual Hook: Tampilkan adegan mengejutkan tanpa konteks selama 2 detik. Overlay teks tebal warna kuning kontras: "Satu kesalahan ini bikin [MASALAH] tambah parah!"',
    isActive: true,
    usageCount: 98
  },
  {
    id: 'fml_03',
    title: 'Midjourney Realistic Fashion Portrait Lighting',
    category: 'photo',
    targetStyle: 'Editorial Studio',
    templateText: '35mm portrait photography, soft window light, subtle warm tone, ultra detailed fabric texture, award winning fashion magazine shot --ar 9:16 --v 6.0',
    isActive: true,
    usageCount: 85
  }
];

export default function PromptFormulaPanel() {
  const [formulas, setFormulas] = useState<PromptFormulaItem[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem('satset_prompt_formulas');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch (e) {}
    }
    return DEFAULT_FORMULAS;
  });
  const [loading, setLoading] = useState<boolean>(false);
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [formData, setFormData] = useState<{
    title: string;
    category: 'video' | 'photo' | 'ideas' | 'splitter';
    targetStyle: string;
    templateText: string;
  }>({
    title: '',
    category: 'video',
    targetStyle: 'UGC Review',
    templateText: '',
  });

  const loadFormulas = useCallback(async () => {
    try {
      const res = await fetch('/api/formulas');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setFormulas(data);
          localStorage.setItem('satset_prompt_formulas', JSON.stringify(data));
          return;
        }
      }
    } catch (e) {
      // Fallback
    }
  }, []);

  useEffect(() => {
    const handleUpdated = () => {
      loadFormulas();
    };

    window.addEventListener('satset_formulas_updated', handleUpdated);
    window.addEventListener('storage', handleUpdated);
    return () => {
      window.removeEventListener('satset_formulas_updated', handleUpdated);
      window.removeEventListener('storage', handleUpdated);
    };
  }, [loadFormulas]);

  const handleSaveFormula = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.templateText.trim()) return;

    const newFormula: PromptFormulaItem = {
      id: 'fml_' + Date.now(),
      title: formData.title.trim(),
      category: formData.category,
      targetStyle: formData.targetStyle.trim() || 'General',
      templateText: formData.templateText.trim(),
      isActive: true,
      usageCount: 0,
    };

    try {
      const res = await fetch('/api/formulas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newFormula),
      });

      if (res.ok) {
        setToastMessage('Formula Prompt Master berhasil disimpan!');
        setShowAddModal(false);
        setFormData({ title: '', category: 'video', targetStyle: 'UGC Review', templateText: '' });
        loadFormulas();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setTimeout(() => setToastMessage(null), 3000);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus formula ini?')) return;
    try {
      const res = await fetch(`/api/formulas/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setToastMessage('Formula berhasil dihapus');
        loadFormulas();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setTimeout(() => setToastMessage(null), 3000);
    }
  };

  const copyPrompt = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6">
      {toastMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 rounded-2xl text-white shadow-lg border border-indigo-800/80 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-amber-300" />
            <h2 className="text-xl font-black tracking-tight">Master Prompt Formula & Preset Gallery</h2>
          </div>
          <p className="text-xs text-slate-300">
            Kelola formula prompt standar emas untuk Video Generator, Photo Prompt, dan Content Ideas secara terpusat.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2.5 rounded-xl bg-[#3525cd] hover:bg-indigo-600 text-white font-bold text-xs shadow-md transition-all flex items-center gap-2 shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Formula Baru</span>
        </button>
      </div>

      {/* Formulas List */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-4">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <Layers className="w-4 h-4 text-[#3525cd]" />
          Daftar Preset & Formula Prompt ({formulas.length})
        </h3>

        {loading ? (
          <div className="py-12 text-center text-xs text-slate-400 font-semibold animate-pulse">
            Memuat data formula prompt...
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {formulas.map((f) => (
              <div key={f.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50 hover:bg-white transition-all space-y-3 relative">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase bg-indigo-100 text-[#3525cd]">
                      {f.category} • {f.targetStyle}
                    </span>
                    <h4 className="text-xs font-extrabold text-slate-900 mt-1">{f.title}</h4>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => copyPrompt(f.templateText, f.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all cursor-pointer"
                      title="Salin Formula"
                    >
                      {copiedId === f.id ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(f.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all cursor-pointer"
                      title="Hapus Formula"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-900 text-slate-200 text-[11px] font-mono leading-relaxed overflow-x-auto">
                  {f.templateText}
                </div>

                <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 pt-1">
                  <span>Digunakan: {f.usageCount || 0}x</span>
                  <span className="text-emerald-600 font-bold">● Status: Aktif</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Formula Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Code2 className="w-5 h-5 text-[#3525cd]" />
                <h3 className="text-base font-extrabold text-slate-900">Tambah Formula Prompt Master</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveFormula} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Judul Formula</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Cinematic Product Commercial 4K"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-[#3525cd] outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Kategori Tool</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold bg-white"
                  >
                    <option value="video">Video Prompt Generator</option>
                    <option value="photo">Photo Prompt Generator</option>
                    <option value="ideas">Content Ideas AI</option>
                    <option value="splitter">Prompt Splitter</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Gaya / Style Preset</label>
                  <input
                    type="text"
                    placeholder="Contoh: UGC Review, Cinematic, Softsell"
                    value={formData.targetStyle}
                    onChange={(e) => setFormData({ ...formData, targetStyle: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-[#3525cd] outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Template Teks Prompt Formula</label>
                <textarea
                  required
                  rows={4}
                  placeholder="Masukkan template struktur prompt master..."
                  value={formData.templateText}
                  onChange={(e) => setFormData({ ...formData, templateText: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs font-mono focus:ring-2 focus:ring-[#3525cd] outline-none"
                />
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
                  className="px-5 py-2 rounded-xl bg-[#3525cd] text-white font-bold text-xs hover:bg-indigo-600 transition-all shadow-md cursor-pointer"
                >
                  Simpan Formula
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
