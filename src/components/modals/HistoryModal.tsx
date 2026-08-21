'use client';

import React, { useState, useEffect } from 'react';
import { 
  History, 
  Search, 
  Trash2, 
  Download, 
  Upload, 
  X, 
  Copy, 
  Check, 
  Video, 
  Camera, 
  Scissors, 
  Sparkles, 
  FileText,
  Clock,
  ExternalLink,
  RefreshCw,
  AlertCircle,
  Lightbulb,
  Clapperboard,
  ChevronLeft,
  UserCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { HistoryItem, HistoryCategory } from '../../types';
import { 
  getHistory, 
  deleteHistoryItem, 
  clearAllHistory, 
  exportHistoryJSON, 
  importHistoryJSON 
} from '../../lib/history';
import { getUserSession } from '../../lib/auth';

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRestoreItem?: (item: HistoryItem) => void;
}

export default function HistoryModal({ isOpen, onClose, onRestoreItem }: HistoryModalProps) {
  const [items, setItems] = useState<HistoryItem[]>(() => getHistory());
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<HistoryItem | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const session = getUserSession();
  const currentAccessCode = session?.code || 'GUEST';

  useEffect(() => {
    const handleUpdate = () => {
      setItems(getHistory());
    };

    window.addEventListener('satset_history_updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener('satset_history_updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  if (!isOpen) return null;

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = deleteHistoryItem(id);
    setItems(updated);
    if (selectedItem?.id === id) {
      setSelectedItem(null);
    }
  };

  const handleClearAll = () => {
    if (window.confirm('Apakah Anda yakin ingin menghapus SELURUH riwayat lokal? Tindakan ini tidak dapat dibatalkan.')) {
      clearAllHistory();
      setItems([]);
      setSelectedItem(null);
    }
  };

  const handleCopyPrompt = (text: string, id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const updated = importHistoryJSON(text);
        setItems(updated);
        setImportError(null);
      } catch (err: any) {
        setImportError(err.message || 'Gagal membaca file JSON.');
      }
    };
    reader.readAsText(file);
  };

  const filteredItems = items.filter(item => {
    const matchesCategory = activeCategory === 'all' || item.category === activeCategory;
    const query = searchQuery.toLowerCase().trim();
    if (!query) return matchesCategory;

    const matchesTitle = item.title.toLowerCase().includes(query);
    const matchesSubtitle = item.subtitle?.toLowerCase().includes(query);
    const matchesPrompt = item.data.prompt?.toLowerCase().includes(query);
    const matchesTiktok = item.data.tiktokTitle?.toLowerCase().includes(query);

    return matchesCategory && (matchesTitle || matchesSubtitle || matchesPrompt || matchesTiktok);
  });

  const getCategoryBadge = (category: HistoryCategory) => {
    switch (category) {
      case 'video_prompt':
        return (
          <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 text-[#5b50e5] border border-indigo-200 text-[11px] font-semibold flex items-center gap-1">
            <Clapperboard className="w-3 h-3" /> Video Prompt
          </span>
        );
      case 'photo_prompt':
        return (
          <span className="px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200 text-[11px] font-semibold flex items-center gap-1">
            <Camera className="w-3 h-3" /> Photo Prompt
          </span>
        );
      case 'splitter_result':
        return (
          <span className="px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[11px] font-semibold flex items-center gap-1">
            <Scissors className="w-3 h-3" /> Splitter
          </span>
        );
      case 'tiktok_download':
        return (
          <span className="px-2.5 py-0.5 rounded-full bg-pink-50 text-pink-700 border border-pink-200 text-[11px] font-semibold flex items-center gap-1">
            <Download className="w-3 h-3" /> TikTok
          </span>
        );
      case 'content_ideas':
        return (
          <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-semibold flex items-center gap-1">
            <Lightbulb className="w-3 h-3 text-amber-500" /> Ide Konten
          </span>
        );
      case 'frame_extraction':
        return (
          <span className="px-2.5 py-0.5 rounded-full bg-cyan-50 text-cyan-700 border border-cyan-200 text-[11px] font-semibold flex items-center gap-1">
            <Scissors className="w-3 h-3" /> Ekstrak Frame
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-900/50 backdrop-blur-xs overflow-y-auto"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-4xl max-h-[92vh] sm:max-h-[90vh] bg-white border border-slate-200/80 rounded-2xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden text-slate-800 my-auto"
      >
        {/* Modal Header */}
        <div className="p-3.5 sm:p-5 border-b border-slate-100 bg-white space-y-2 sm:space-y-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors flex items-center gap-1 text-xs font-bold shrink-0 cursor-pointer"
                title="Kembali"
              >
                <ChevronLeft className="w-5 h-5 text-slate-700" />
                <span className="hidden xs:inline">Kembali</span>
              </button>

              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-[#5b50e5] font-bold shadow-2xs shrink-0">
                <History className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>

              <div className="min-w-0">
                <h2 className="text-sm sm:text-base md:text-lg font-bold text-slate-900 flex items-center gap-2 truncate">
                  <span>Riwayat Lokal</span>
                  <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-[#5b50e5] border border-indigo-200 text-[10px] sm:text-xs font-semibold shrink-0">
                    {items.length} Item
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] sm:text-xs font-mono font-bold shrink-0 flex items-center gap-1">
                    <UserCheck className="w-3 h-3 text-emerald-600" />
                    <span>Akses: {currentAccessCode}</span>
                  </span>
                </h2>
                <p className="text-[11px] text-slate-500 hidden sm:block truncate">Tersimpan khusus untuk akun {currentAccessCode}. Tidak bercampur dengan user/klien lain.</p>
              </div>
            </div>

            {/* Desktop / Tablet Header Actions */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => exportHistoryJSON()}
                disabled={items.length === 0}
                className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-xs font-medium text-slate-700 transition-all flex items-center gap-1 disabled:opacity-40 cursor-pointer"
                title="Ekspor Riwayat ke file JSON"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Ekspor JSON</span>
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-xs font-medium text-slate-700 transition-all flex items-center gap-1 cursor-pointer"
                title="Impor file JSON Riwayat"
              >
                <Upload className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Impor JSON</span>
              </button>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImportFile}
                accept=".json"
                className="hidden"
              />
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                title="Tutup Modal Riwayat"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Search & Category Toolbar */}
        <div className="p-3 sm:p-5 border-b border-slate-100 bg-slate-50/50 space-y-2.5">
          {importError && (
            <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{importError}</span>
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-center gap-2.5">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari riwayat prompt, konsep, judul TikTok, kata kunci..."
                className="w-full pl-10 pr-9 py-2 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs sm:text-sm placeholder:text-slate-400 focus:outline-none focus:border-[#5b50e5] focus:ring-2 focus:ring-[#5b50e5]/20"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {items.length > 0 && (
              <button
                type="button"
                onClick={handleClearAll}
                className="w-full sm:w-auto px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs font-medium transition-all flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Kosongkan Riwayat</span>
              </button>
            )}
          </div>

          {/* Category Filter Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
            {[
              { id: 'all', label: 'Semua Riwayat' },
              { id: 'tiktok_shop_ideas', label: 'TikTok Shop Ideas' },
              { id: 'content_ideas', label: 'Ide Konten' },
              { id: 'video_prompt', label: 'Video to Prompt' },
              { id: 'photo_prompt', label: 'Photo Prompt' },
              { id: 'tiktok_download', label: 'TikTok Downloader' },
              { id: 'frame_extraction', label: 'Ekstraktor Frame' },
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveCategory(tab.id)}
                className={`px-3 py-1.5 rounded-xl font-medium whitespace-nowrap transition-all cursor-pointer ${
                  activeCategory === tab.id
                    ? 'bg-[#5b50e5] text-white font-semibold shadow-2xs'
                    : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* History Item List */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-3 bg-[#f8fafc]">
          {filteredItems.length === 0 ? (
            <div className="text-center py-12 sm:py-16 space-y-3">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-white border border-slate-200 flex items-center justify-center mx-auto text-slate-400 shadow-2xs">
                <History className="w-6 h-6 sm:w-7 sm:h-7" />
              </div>
              <h3 className="text-sm sm:text-base font-bold text-slate-800">Belum ada riwayat tersimpan</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                {searchQuery ? 'Tidak ada hasil riwayat yang sesuai dengan pencarian Anda.' : 'Setiap kali Anda membuat prompt AI atau mengunduh media, riwayat akan otomatis tersimpan di sini.'}
              </p>
            </div>
          ) : (
            filteredItems.map((item) => (
              <div
                key={item.id}
                onClick={() => setSelectedItem(selectedItem?.id === item.id ? null : item)}
                className={`p-3.5 sm:p-4 rounded-2xl border transition-all cursor-pointer ${
                  selectedItem?.id === item.id
                    ? 'bg-indigo-50/50 border-[#5b50e5] shadow-xs'
                    : 'bg-white border-slate-200/80 hover:border-slate-300 shadow-2xs'
                }`}
              >
                <div className="flex flex-col sm:flex-row items-start justify-between gap-3">
                  <div className="space-y-1.5 flex-1 min-w-0 w-full">
                    <div className="flex items-center gap-2 flex-wrap">
                      {getCategoryBadge(item.category)}
                      <span className="text-[11px] text-slate-500 flex items-center gap-1 font-mono">
                        <Clock className="w-3 h-3 text-slate-400" />
                        {new Date(item.timestamp).toLocaleString('id-ID', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      {item.data.modelUsed && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-mono border border-slate-200">
                          {item.data.modelUsed}
                        </span>
                      )}
                    </div>

                    <h4 className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                      {item.title}
                    </h4>

                    {item.subtitle && (
                      <p className="text-xs text-slate-500 line-clamp-1">
                        {item.subtitle}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-start pt-1 sm:pt-0">
                    {item.data.prompt && (
                      <button
                        type="button"
                        onClick={(e) => handleCopyPrompt(item.data.prompt!, item.id, e)}
                        className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors text-xs font-semibold border border-slate-200 cursor-pointer"
                        title="Salin Prompt"
                      >
                        {copiedId === item.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    )}

                    {onRestoreItem && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRestoreItem(item);
                          onClose();
                        }}
                        className="px-3 py-1.5 rounded-xl bg-[#5b50e5] hover:bg-[#4f46e5] text-white transition-colors text-xs font-bold flex items-center gap-1 shadow-2xs cursor-pointer"
                        title="Buka kembali item ini di tools"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Gunakan</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={(e) => handleDelete(item.id, e)}
                      className="p-2 rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors border border-slate-200 cursor-pointer"
                      title="Hapus dari riwayat"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Expanded Details preview */}
                {selectedItem?.id === item.id && item.data.prompt && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="mt-3 pt-3 border-t border-slate-200/80 space-y-2 text-xs"
                  >
                    <div className="text-[11px] font-bold text-[#5b50e5] uppercase tracking-wider flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5" /> Pratinjau Prompt Hasil:
                    </div>
                    <pre className="p-3 rounded-xl bg-slate-100 border border-slate-200 text-slate-800 whitespace-pre-wrap font-mono text-[11px] max-h-48 overflow-y-auto leading-relaxed">
                      {item.data.prompt}
                    </pre>
                  </motion.div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Modal Footer Bottom Return Bar */}
        <div className="p-3 sm:p-4 border-t border-slate-100 bg-white flex items-center justify-between gap-3">
          <span className="text-xs text-slate-500">
            {filteredItems.length} dari {items.length} riwayat ditampilkan
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Kembali ke Aplikasi</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
}

