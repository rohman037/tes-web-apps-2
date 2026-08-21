'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Search, 
  Video, 
  ShoppingBag, 
  Sparkles, 
  Split, 
  Camera, 
  Layers, 
  CreditCard, 
  Settings, 
  ArrowRight,
  Command,
  X,
  Zap,
  HelpCircle
} from 'lucide-react';

interface CommandPaletteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTool: (toolId: string) => void;
  onOpenHelp?: () => void;
}

interface CommandItem {
  id: string;
  name: string;
  category: 'TOOLS' | 'ACCOUNT' | 'ACTIONS';
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  action: () => void;
  shortcut?: string;
}

export const CommandPaletteModal: React.FC<CommandPaletteModalProps> = ({
  isOpen,
  onClose,
  onSelectTool,
  onOpenHelp,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const commandItems: CommandItem[] = [
    {
      id: 'tiktok_downloader',
      name: 'TikTok Downloader',
      category: 'TOOLS',
      icon: Video,
      description: 'Download video HD tanpa watermark, audio & carousel slide',
      action: () => {
        onSelectTool('tiktok_downloader');
        onClose();
      },
      shortcut: '1',
    },
    {
      id: 'tiktok_shop_ideas',
      name: 'TikTok Shop to Ideas',
      category: 'TOOLS',
      icon: ShoppingBag,
      description: 'Riset tren produk viral, hook jualan & CTA konversi',
      action: () => {
        onSelectTool('tiktok_shop_ideas');
        onClose();
      },
      shortcut: '2',
    },
    {
      id: 'content_ideas',
      name: 'Ide Konten Kreator',
      category: 'TOOLS',
      icon: Sparkles,
      description: 'Analisis visual video & generate naskah kreatif AI',
      action: () => {
        onSelectTool('content_ideas');
        onClose();
      },
      shortcut: '3',
    },
    {
      id: 'prompt_splitter',
      name: 'Video to Prompt (Splitter)',
      category: 'TOOLS',
      icon: Split,
      description: 'Dekonstruksi adegan & generator multi-prompt per klip',
      action: () => {
        onSelectTool('prompt_splitter');
        onClose();
      },
      shortcut: '4',
    },
    {
      id: 'photo_prompt_generator',
      name: 'Prompt Foto AI',
      category: 'TOOLS',
      icon: Camera,
      description: 'Generator prompt fotografi studio, commercial & model',
      action: () => {
        onSelectTool('photo_prompt_generator');
        onClose();
      },
      shortcut: '5',
    },
    {
      id: 'frame_extractor',
      name: 'Ekstraktor Frame Video',
      category: 'TOOLS',
      icon: Layers,
      description: 'Ekstrak ratusan frame video beresolusi tinggi & batch ZIP',
      action: () => {
        onSelectTool('frame_extractor');
        onClose();
      },
      shortcut: '6',
    },
    {
      id: 'packages',
      name: 'Paket & Akses Akun',
      category: 'ACCOUNT',
      icon: CreditCard,
      description: 'Lihat masa aktif, upgrade VIP & perpanjangan paket',
      action: () => {
        onSelectTool('packages');
        onClose();
      },
      shortcut: 'P',
    },
    {
      id: 'settings',
      name: 'Pengaturan',
      category: 'ACCOUNT',
      icon: Settings,
      description: 'Konfigurasi tema, antarmuka & preferensi pengguna',
      action: () => {
        onSelectTool('settings');
        onClose();
      },
      shortcut: 'S',
    },
    {
      id: 'help_wa',
      name: 'Bantuan CS WhatsApp',
      category: 'ACTIONS',
      icon: HelpCircle,
      description: 'Hubungi tim support Satset Tools untuk panduan & kendala',
      action: () => {
        if (onOpenHelp) onOpenHelp();
        onClose();
      },
      shortcut: 'H',
    },
  ];

  const filteredItems = commandItems.filter((item) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return item.name.toLowerCase().includes(q) || item.description.toLowerCase().includes(q);
  });

  const handleQueryChange = (val: string) => {
    setQuery(val);
    setSelectedIndex(0);
  };

  const handleClose = useCallback(() => {
    setQuery('');
    setSelectedIndex(0);
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev < filteredItems.length - 1 ? prev + 1 : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : filteredItems.length - 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredItems[selectedIndex]) {
          filteredItems[selectedIndex].action();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredItems, selectedIndex, handleClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-slate-900/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-150">
      <div 
        className="w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[80vh] transition-all transform animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Header */}
        <div className="flex items-center px-4 py-3.5 border-b border-slate-100 bg-slate-50/50">
          <Search className="w-5 h-5 text-slate-400 shrink-0 mr-3" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            placeholder="Cari tool, aksi, atau navigasi cepat..."
            className="w-full bg-transparent text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-hidden"
          />
          <div className="flex items-center gap-1.5 shrink-0 pl-2">
            <kbd className="hidden sm:inline-flex items-center gap-0.5 px-2 py-0.5 text-[10px] font-mono font-semibold text-slate-500 bg-slate-200/80 rounded-md border border-slate-300">
              ESC
            </kbd>
            <button
              onClick={handleClose}
              className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/50 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Command List */}
        <div className="overflow-y-auto p-2 divide-y divide-slate-100 flex-1">
          {filteredItems.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <Command className="w-8 h-8 mx-auto mb-2 opacity-40 text-slate-400" />
              <p className="text-sm font-medium">Tidak ada hasil untuk &ldquo;{query}&rdquo;</p>
              <p className="text-xs text-slate-400 mt-1">Coba kata kunci seperti &quot;TikTok&quot;, &quot;Prompt&quot;, atau &quot;Frame&quot;</p>
            </div>
          ) : (
            <div className="space-y-1 py-1">
              {filteredItems.map((item, idx) => {
                const Icon = item.icon;
                const isSelected = idx === selectedIndex;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={item.action}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left transition-all ${
                      isSelected
                        ? 'bg-[#5b50e5] text-white shadow-xs'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                          isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-[#5b50e5]'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-semibold ${isSelected ? 'text-white' : 'text-slate-900'}`}>
                            {item.name}
                          </span>
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wider ${
                              isSelected
                                ? 'bg-white/20 text-white'
                                : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {item.category}
                          </span>
                        </div>
                        <p className={`text-[11px] truncate mt-0.5 ${isSelected ? 'text-white/80' : 'text-slate-500'}`}>
                          {item.description}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      {item.shortcut && (
                        <span
                          className={`hidden sm:inline-block text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded border ${
                            isSelected
                              ? 'bg-white/20 text-white border-white/30'
                              : 'bg-slate-100 text-slate-500 border-slate-200'
                          }`}
                        >
                          {item.shortcut}
                        </span>
                      )}
                      <ArrowRight className={`w-3.5 h-3.5 ${isSelected ? 'text-white' : 'text-slate-400'}`} />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer Quick Hints */}
        <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-[10px] font-mono shadow-2xs">↑↓</kbd>
              <span>Navigasi</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-[10px] font-mono shadow-2xs">↵</kbd>
              <span>Pilih</span>
            </span>
          </div>
          <div className="flex items-center gap-1 text-[#5b50e5] font-medium">
            <Zap className="w-3 h-3" />
            <span>Satset Creator Workspace</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CommandPaletteModal;
