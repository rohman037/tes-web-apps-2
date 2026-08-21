'use client';

import React, { useState, useEffect, useRef, useCallback } from "react";
import { 
  Brain, 
  Sparkles, 
  Send, 
  Paperclip, 
  FileText, 
  UploadCloud, 
  Trash2, 
  Search, 
  PlusCircle, 
  CheckCircle2, 
  Cpu, 
  Zap, 
  File, 
  Image as ImageIcon, 
  Code, 
  FileCode, 
  Copy, 
  Check, 
  X, 
  RefreshCw,
  Database,
  ShieldCheck,
  Bot,
  User,
  ArrowRight
} from 'lucide-react';

interface ChatMessage {
  id: string;
  sender: 'admin' | 'ai';
  text: string;
  timestamp: string;
  attachedFile?: {
    name: string;
    size: number;
    type: string;
  };
  extractedInsights?: string[];
}

export default function KnowledgeInjectionPanel() {
  const [knowledgeBase, setKnowledgeBase] = useState<string[]>([]);
  const [intelligenceLevel, setIntelligenceLevel] = useState<any>('Lv. 99 Ultra Neural');
  const [totalExecutions, setTotalExecutions] = useState<number>(350);
  const [loading, setLoading] = useState<boolean>(false);

  const formatIntelligenceDisplay = (intel: any): string => {
    if (!intel) return 'Lv. 99 Ultra Neural';
    if (typeof intel === 'string') return intel;
    if (typeof intel === 'object') {
      if (intel.level && intel.title) {
        return `Lv. ${intel.level} ${intel.title}`;
      }
      if (intel.title) return String(intel.title);
      if (intel.level) return `Lv. ${intel.level}`;
    }
    return 'Lv. 99 Ultra Neural';
  };

  // Chat State
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'ai',
      text: 'Halo Admin! Saya adalah Neural Knowledge Integrator. Silakan kirimkan instruksi, wawasan baru, atau unggah berkas apapun (PDF, TXT, JSON, Gambar, Kode, Dokumen) untuk secara instan disuntikkan ke dalam ingatan sistem AI.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [selectedFile, setSelectedFile] = useState<{ file: File; textContent: string } | null>(null);

  // Quick Direct Inject State
  const [quickText, setQuickText] = useState('');
  const [quickCategory, setQuickCategory] = useState('umum');
  const [isQuickInjecting, setIsQuickInjecting] = useState(false);

  // Knowledge DB Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'file' | 'chat' | 'system'>('all');
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // Modal Detail State
  const [detailItem, setDetailItem] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  const fetchKnowledgeData = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/knowledge');
      if (res.ok) {
        const data = await res.json();
        setKnowledgeBase(data.knowledgeBase || []);
        setIntelligenceLevel(data.intelligenceLevel || 'Lv. 99 Ultra Neural');
        setTotalExecutions(data.totalExecutions || 350);
      }
    } catch (err) {
      console.warn('[KnowledgeInjectionPanel] Error fetching knowledge base:', err);
    }
  }, []);

  useEffect(() => {
    const handleUpdated = () => {
      fetchKnowledgeData();
    };
    window.addEventListener('satset_system_memory_updated', handleUpdated);
    return () => {
      window.removeEventListener('satset_system_memory_updated', handleUpdated);
    };
  }, [fetchKnowledgeData]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const reader = new FileReader();

    if (file.type.startsWith('text/') || file.name.endsWith('.json') || file.name.endsWith('.md') || file.name.endsWith('.txt') || file.name.endsWith('.csv') || file.name.endsWith('.js') || file.name.endsWith('.ts') || file.name.endsWith('.py')) {
      reader.onload = (event) => {
        setSelectedFile({
          file,
          textContent: (event.target?.result as string) || ''
        });
      };
      reader.readAsText(file);
    } else {
      // For binary files (PDF, images, etc.)
      reader.onload = () => {
        setSelectedFile({
          file,
          textContent: `[File Binary: ${file.name} - Ukuran: ${(file.size / 1024).toFixed(1)} KB, Tipe: ${file.type || 'Dokumen'}]`
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if ((!inputText.trim() && !selectedFile) || isSending) return;

    const userMsgText = inputText.trim();
    const currentFile = selectedFile;

    const userMessage: ChatMessage = {
      id: String(Date.now()),
      sender: 'admin',
      text: userMsgText || (currentFile ? `Mengunggah berkas: ${currentFile.file.name}` : ''),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      attachedFile: currentFile ? {
        name: currentFile.file.name,
        size: currentFile.file.size,
        type: currentFile.file.type || 'Dokumen'
      } : undefined
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setSelectedFile(null);
    setIsSending(true);

    try {
      const res = await fetch('/api/admin/knowledge/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMsgText,
          attachedFile: currentFile ? {
            name: currentFile.file.name,
            size: currentFile.file.size,
            type: currentFile.file.type,
            textContent: currentFile.textContent
          } : undefined
        })
      });

      if (res.ok) {
        const data = await res.json();
        const aiMessage: ChatMessage = {
          id: String(Date.now() + 1),
          sender: 'ai',
          text: data.reply || 'Pengetahuan baru berhasil diserap dan diinjeksi ke memori sistem.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          extractedInsights: data.extractedInsights || []
        };
        setMessages(prev => [...prev, aiMessage]);
        if (data.knowledgeBase) {
          setKnowledgeBase(data.knowledgeBase);
        }
        if (data.intelligenceLevel) {
          setIntelligenceLevel(data.intelligenceLevel);
        }
      } else {
        throw new Error('Respon server error');
      }
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: String(Date.now() + 1),
        sender: 'ai',
        text: `Terjadi kendala saat menghubungkan ke AI Engine: ${err.message || 'Error'}. Namun pesan/pengetahuan telah dikirim ke buffer.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsSending(false);
    }
  };

  const handleQuickInject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickText.trim() || isQuickInjecting) return;

    setIsQuickInjecting(true);
    try {
      const res = await fetch('/api/admin/knowledge/inject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          insight: quickText.trim(),
          category: quickCategory
        })
      });

      if (res.ok) {
        const data = await res.json();
        setKnowledgeBase(data.knowledgeBase || []);
        if (data.intelligenceLevel) setIntelligenceLevel(data.intelligenceLevel);
        setQuickText('');
      }
    } catch (err) {
      console.warn('Error quick injecting:', err);
    } finally {
      setIsQuickInjecting(false);
    }
  };

  const handleDeleteKnowledge = async (indexToDelete: number, textToDelete: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus wawasan pengetahuan ini dari memori sistem?')) return;

    try {
      const res = await fetch('/api/admin/knowledge', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ index: indexToDelete, text: textToDelete })
      });

      if (res.ok) {
        const data = await res.json();
        setKnowledgeBase(data.knowledgeBase || []);
      }
    } catch (err) {
      console.warn('Error deleting knowledge item:', err);
    }
  };

  const handleCopyKnowledge = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  // Filtered knowledge
  const filteredKnowledge = (Array.isArray(knowledgeBase) ? knowledgeBase : []).filter(item => {
    const strItem = typeof item === 'string' ? item : typeof item === 'object' && item !== null ? JSON.stringify(item) : String(item);
    const matchesSearch = strItem.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;

    if (selectedFilter === 'file') return strItem.includes('[Injeksi Berkas:');
    if (selectedFilter === 'chat') return strItem.includes('[Injeksi Chat Admin]');
    if (selectedFilter === 'system') return strItem.includes('[Injeksi System');
    return true;
  });

  const getFileIcon = (fileName: string) => {
    if (fileName.endsWith('.pdf')) return <FileText className="w-4 h-4 text-rose-400" />;
    if (fileName.endsWith('.json') || fileName.endsWith('.js') || fileName.endsWith('.ts')) return <FileCode className="w-4 h-4 text-amber-400" />;
    if (fileName.match(/\.(png|jpg|jpeg|webp)$/i)) return <ImageIcon className="w-4 h-4 text-emerald-400" />;
    return <File className="w-4 h-4 text-indigo-400" />;
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-indigo-500/30 p-6 md:p-8 shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 w-64 h-64 bg-violet-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-medium">
              <Brain className="w-3.5 h-3.5 animate-pulse text-indigo-400" />
              <span>System Neural Knowledge Injector Hub</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
              Injeksi Pengetahuan System
            </h1>
            <p className="text-slate-300 text-sm max-w-2xl leading-relaxed">
              Latih dan suntikkan wawasan, panduan strategi, serta berkas apapun (PDF, TXT, JSON, Kode, Gambar) secara interaktif untuk memperluas basis pengetahuan AI Agent di seluruh sistem aplikasi.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-900/80 border border-indigo-500/30 backdrop-blur-md">
              <div className="text-xs text-slate-400 font-medium">Total Wawasan Injeksi</div>
              <div className="text-xl font-black text-white mt-0.5 flex items-center gap-1.5">
                <Database className="w-4 h-4 text-indigo-400" />
                <span>{knowledgeBase.length} Rules</span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900/80 border border-indigo-500/30 backdrop-blur-md">
              <div className="text-xs text-slate-400 font-medium">Kecerdasan System</div>
              <div className="text-xl font-black text-emerald-400 mt-0.5 flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-emerald-400 animate-bounce" />
                <span>{formatIntelligenceDisplay(intelligenceLevel)}</span>
              </div>
            </div>

            <div className="col-span-2 sm:col-span-1 p-3.5 rounded-xl bg-slate-900/80 border border-indigo-500/30 backdrop-blur-md">
              <div className="text-xs text-slate-400 font-medium">Eksekusi Terlatih</div>
              <div className="text-xl font-black text-amber-400 mt-0.5 flex items-center gap-1.5">
                <Cpu className="w-4 h-4 text-amber-400" />
                <span>{totalExecutions}+ Exp</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Chat Assistant & Quick Direct Injector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Interactive Chat & File Trainer (7 cols) */}
        <div className="lg:col-span-7 flex flex-col bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl overflow-hidden h-[600px]">
          {/* Console Header */}
          <div className="px-5 py-4 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center">
                <Bot className="w-4 h-4 text-indigo-400" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  Interactive Knowledge Chat & Trainer
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                </h2>
                <p className="text-xs text-slate-400">Tanya, latih, atau unggah berkas untuk mengekstrak wawasan otomatis</p>
              </div>
            </div>

            <button
              onClick={fetchKnowledgeData}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
              title="Refresh Data Pengetahuan"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-400' : ''}`} />
            </button>
          </div>

          {/* Chat Messages Body */}
          <div className="flex-1 p-4 overflow-y-auto space-y-4 custom-scrollbar">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 ${msg.sender === 'admin' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.sender === 'ai' && (
                  <div className="w-7 h-7 rounded-full bg-indigo-600/30 border border-indigo-500/50 flex items-center justify-center shrink-0 mt-0.5">
                    <Bot className="w-4 h-4 text-indigo-400" />
                  </div>
                )}

                <div className={`max-w-[85%] space-y-2`}>
                  <div
                    className={`p-3.5 rounded-2xl text-xs leading-relaxed shadow-md ${
                      msg.sender === 'admin'
                        ? 'bg-indigo-600 text-white rounded-tr-none'
                        : 'bg-slate-800/90 text-slate-200 border border-slate-700 rounded-tl-none'
                    }`}
                  >
                    {msg.attachedFile && (
                      <div className="mb-2.5 p-2 rounded-xl bg-black/20 border border-white/10 flex items-center gap-2">
                        {getFileIcon(msg.attachedFile.name)}
                        <div className="truncate">
                          <div className="font-semibold text-white truncate">{msg.attachedFile.name}</div>
                          <div className="text-[10px] text-slate-300 opacity-80">
                            {(msg.attachedFile.size / 1024).toFixed(1)} KB • {msg.attachedFile.type}
                          </div>
                        </div>
                      </div>
                    )}

                    <p className="whitespace-pre-wrap">{msg.text}</p>
                  </div>

                  {/* Extracted Insights Pill Badge */}
                  {msg.extractedInsights && msg.extractedInsights.length > 0 && (
                    <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs space-y-1.5">
                      <div className="font-bold flex items-center gap-1.5 text-emerald-400 text-[11px]">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Wawasan Berhasil Diinjeksi Ke Memori:</span>
                      </div>
                      <ul className="space-y-1 list-disc list-inside text-[11px] opacity-90">
                        {msg.extractedInsights.map((ins, i) => (
                          <li key={i} className="truncate">{ins}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className={`text-[10px] text-slate-500 px-1 ${msg.sender === 'admin' ? 'text-right' : 'text-left'}`}>
                    {msg.timestamp}
                  </div>
                </div>

                {msg.sender === 'admin' && (
                  <div className="w-7 h-7 rounded-full bg-slate-700 border border-slate-600 flex items-center justify-center shrink-0 mt-0.5">
                    <User className="w-4 h-4 text-slate-300" />
                  </div>
                )}
              </div>
            ))}

            {isSending && (
              <div className="flex gap-3 justify-start">
                <div className="w-7 h-7 rounded-full bg-indigo-600/30 border border-indigo-500/50 flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4 text-indigo-400 animate-bounce" />
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-800 text-slate-400 border border-slate-700 text-xs flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-400 animate-spin" />
                  <span>AI sedang menganalisis & menginjeksi wawasan ke memori...</span>
                </div>
              </div>
            )}
            <div ref={chatBottomRef} />
          </div>

          {/* Selected File Banner */}
          {selectedFile && (
            <div className="px-4 py-2 bg-indigo-950/60 border-t border-indigo-500/30 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-indigo-300 truncate">
                {getFileIcon(selectedFile.file.name)}
                <span className="font-semibold truncate">{selectedFile.file.name}</span>
                <span className="text-slate-400 text-[10px]">({(selectedFile.file.size / 1024).toFixed(1)} KB)</span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedFile(null)}
                className="text-slate-400 hover:text-rose-400 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Chat Form Controls */}
          <form onSubmit={handleSendMessage} className="p-3 bg-slate-950/90 border-t border-slate-800 flex items-center gap-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer border border-slate-700 shrink-0"
              title="Unggah Berkas Apapun (PDF, TXT, JSON, Gambar, Script)"
            >
              <Paperclip className="w-4 h-4" />
            </button>

            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Tulis wawasan atau instruksi untuk disuntikkan..."
              disabled={isSending}
              className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
            />

            <button
              type="submit"
              disabled={(!inputText.trim() && !selectedFile) || isSending}
              className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold text-xs transition-all flex items-center gap-1.5 cursor-pointer border border-indigo-400/30 shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Injeksi</span>
            </button>
          </form>
        </div>

        {/* Right Column: Direct Fast Injector & File Dropzone (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Quick Direct Inject Box */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
                <Zap className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Injeksi Teks Langsung</h3>
                <p className="text-xs text-slate-400">Suntikkan wawasan/aturan secara langsung tanpa AI Chat</p>
              </div>
            </div>

            <form onSubmit={handleQuickInject} className="space-y-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                  Kategori Wawasan
                </label>
                <select
                  value={quickCategory}
                  onChange={(e) => setQuickCategory(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="umum">💡 Umuma & Formula Strategy</option>
                  <option value="hook">🔥 Hook Verbal & Retention Rate</option>
                  <option value="safeguard">🛡️ Safeguard & Policy Rules</option>
                  <option value="cinematic">🎬 Cinematics & Visual Quality</option>
                  <option value="cta">📈 High-Conversion CTA Engine</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                  Aturan / Wawasan Pengetahuan
                </label>
                <textarea
                  value={quickText}
                  onChange={(e) => setQuickText(e.target.value)}
                  placeholder="Contoh: Selalu masukkan CTA di 5 detik terakhir video dengan kalimat 'Klik keranjang kuning di bawah untuk promo hari ini'."
                  rows={4}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={!quickText.trim() || isQuickInjecting}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg disabled:opacity-50"
              >
                <PlusCircle className="w-4 h-4" />
                <span>{isQuickInjecting ? 'Menginjeksi...' : 'Suntikkan Ke Memori Sistem'}</span>
              </button>
            </form>
          </div>

          {/* Multi-Format File Dropzone Info */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
            <div className="flex items-center gap-2">
              <UploadCloud className="w-4 h-4 text-indigo-400" />
              <h4 className="text-xs font-bold text-white">Dukungan Berkas Luas</h4>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Anda dapat mengunggah berkas apa saja di kolom konsol chat di samping. Sistem secara otomatis akan membaca teks, menganalisis struktur data, dan mengekstrak aturan wawasan.
            </p>
            <div className="grid grid-cols-2 gap-2 text-[10px]">
              <div className="p-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-rose-400" />
                <span>PDF & Dokumen</span>
              </div>
              <div className="p-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 flex items-center gap-1.5">
                <FileCode className="w-3.5 h-3.5 text-amber-400" />
                <span>JSON / CSV / Data</span>
              </div>
              <div className="p-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 flex items-center gap-1.5">
                <Code className="w-3.5 h-3.5 text-cyan-400" />
                <span>Code / Script File</span>
              </div>
              <div className="p-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5 text-emerald-400" />
                <span>Gambar & Panduan</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Active System Knowledge Database Table / Cards */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Database className="w-5 h-5 text-indigo-400" />
              Basis Data Pengetahuan Terinjeksi ({knowledgeBase.length})
            </h2>
            <p className="text-xs text-slate-400">Daftar wawasan aktif yang saat ini diinjeksi ke memori AI Agent</p>
          </div>

          {/* Search & Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari wawasan memori..."
                className="bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 w-48 sm:w-64"
              />
            </div>

            <div className="flex bg-slate-950 border border-slate-800 rounded-xl p-1 gap-1 text-[11px]">
              <button
                type="button"
                onClick={() => setSelectedFilter('all')}
                className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                  selectedFilter === 'all' ? 'bg-indigo-600 text-white font-semibold' : 'text-slate-400 hover:text-white'
                }`}
              >
                Semua
              </button>
              <button
                type="button"
                onClick={() => setSelectedFilter('file')}
                className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                  selectedFilter === 'file' ? 'bg-indigo-600 text-white font-semibold' : 'text-slate-400 hover:text-white'
                }`}
              >
                Berkas
              </button>
              <button
                type="button"
                onClick={() => setSelectedFilter('chat')}
                className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                  selectedFilter === 'chat' ? 'bg-indigo-600 text-white font-semibold' : 'text-slate-400 hover:text-white'
                }`}
              >
                Chat
              </button>
            </div>
          </div>
        </div>

        {/* Knowledge Base List */}
        {filteredKnowledge.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-slate-800 rounded-xl p-6">
            <Brain className="w-10 h-10 text-slate-600 mx-auto mb-2" />
            <p className="text-sm text-slate-400 font-medium">Tidak ada wawasan yang cocok dengan filter pencarian.</p>
            <p className="text-xs text-slate-500 mt-1">Suntikkan wawasan baru di atas atau bersihkan query pencarian.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {filteredKnowledge.map((item, index) => {
              const strItem = typeof item === 'string' ? item : typeof item === 'object' && item !== null ? ((item as any).text || (item as any).insight || (item as any).title || JSON.stringify(item)) : String(item);
              const isFile = strItem.includes('[Injeksi Berkas:');
              const isChat = strItem.includes('[Injeksi Chat Admin]');

              return (
                <div
                  key={index}
                  className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-indigo-500/40 transition-all flex flex-col justify-between gap-3 group"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                        isFile ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' :
                        isChat ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' :
                        'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      }`}>
                        {isFile ? 'Injeksi Berkas' : isChat ? 'Injeksi Chat' : 'Injeksi System'}
                      </span>

                      <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={() => handleCopyKnowledge(strItem, index)}
                          className="p-1 rounded-md hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
                          title="Salin Teks Rule"
                        >
                          {copiedIndex === index ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteKnowledge(index, strItem)}
                          className="p-1 rounded-md hover:bg-slate-800 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                          title="Hapus Dari Memori System"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <p className="text-xs text-slate-200 leading-relaxed font-normal line-clamp-3">
                      {strItem}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-500">
                    <span className="flex items-center gap-1 text-emerald-400">
                      <ShieldCheck className="w-3 h-3" />
                      Status: Aktif Diinjeksi
                    </span>
                    <button
                      type="button"
                      onClick={() => setDetailItem(strItem)}
                      className="text-indigo-400 hover:underline flex items-center gap-0.5 cursor-pointer"
                    >
                      <span>Lihat Detail</span>
                      <ArrowRight className="w-2.5 h-2.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {detailItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-indigo-500/30 rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-2xl relative">
            <button
              onClick={() => setDetailItem(null)}
              className="absolute top-4 right-4 p-1 rounded-lg bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-indigo-400" />
              <h3 className="text-base font-bold text-white">Detail Injeksi Pengetahuan</h3>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 leading-relaxed whitespace-pre-wrap max-h-96 overflow-y-auto">
              {detailItem}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(detailItem);
                  alert('Teks berhasil disalin ke clipboard!');
                }}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs cursor-pointer flex items-center gap-1.5"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Salin Teks</span>
              </button>
              <button
                type="button"
                onClick={() => setDetailItem(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs cursor-pointer"
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
