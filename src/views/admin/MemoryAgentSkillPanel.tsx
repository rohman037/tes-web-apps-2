'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Brain, 
  Sparkles, 
  Plus, 
  Trash2, 
  Code2, 
  Copy, 
  CheckCircle2, 
  Zap, 
  Search, 
  Filter, 
  Layers, 
  Eye, 
  Play, 
  RefreshCw, 
  Sliders, 
  ShieldCheck, 
  Activity, 
  Cpu, 
  Lightbulb, 
  Grid, 
  Circle, 
  Bot, 
  Terminal,
  Check,
  Edit2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export interface MemorySkillBubble {
  id: string;
  title: string;
  category: 'video' | 'photo' | 'ideas' | 'guardrail' | 'splitter';
  confidence: number; // e.g. 95%
  ruleText: string;
  exampleTemplate: string;
  targetAgent: string;
  isActive: boolean;
  usageCount: number;
  bubbleColor: string; // Tailwind color token
  glowColor: string;
  sizePx: number;
  tags: string[];
}

const INITIAL_SKILL_BUBBLES: MemorySkillBubble[] = [
  {
    id: 'skill_01',
    title: '3s Viral Verbal & Visual Hook',
    category: 'ideas',
    confidence: 98,
    ruleText: 'Gunakan Hook verbal 3 detik pertama dengan pertanyaan retoris, statistik emosional, atau aksi visual langsung tanpa basa-basi.',
    exampleTemplate: 'Visual Hook: Tampilkan adegan mengejutkan tanpa konteks selama 2 detik. Overlay teks tebal warna kuning kontras: "Satu kesalahan ini bikin [MASALAH] tambah parah!"',
    targetAgent: 'Content Ideas AI Agent',
    isActive: true,
    usageCount: 248,
    bubbleColor: 'from-amber-500/20 via-orange-500/20 to-amber-600/30 text-amber-300 border-amber-400/50',
    glowColor: 'rgba(245, 158, 11, 0.35)',
    sizePx: 140,
    tags: ['Hook 3s', 'Viral Retention', 'Short-form']
  },
  {
    id: 'skill_02',
    title: 'Cinematic Commercial 8K Lighting',
    category: 'video',
    confidence: 96,
    ruleText: 'Sertakan parameter sinematik 4k/8k commercial softbox diffusion & gerakan kamera pan/zoom halus untuk video AI.',
    exampleTemplate: 'High-end 8k resolution, cinematic lighting, shallow depth of field, natural motion blur. Camera slow push-in to product. Photorealistic, organic textures.',
    targetAgent: 'Video Prompt Generator Agent',
    isActive: true,
    usageCount: 195,
    bubbleColor: 'from-indigo-500/20 via-purple-500/20 to-indigo-600/30 text-indigo-300 border-indigo-400/50',
    glowColor: 'rgba(99, 102, 241, 0.35)',
    sizePx: 155,
    tags: ['8K Commercial', 'Lighting', 'Pan/Zoom']
  },
  {
    id: 'skill_03',
    title: 'Midjourney Editorial Fashion Studio',
    category: 'photo',
    confidence: 94,
    ruleText: 'Gunakan lighting portrait 35mm soft window, tone warna hangat lembut, dan rasio aspek spesifik untuk generasi foto realistis.',
    exampleTemplate: '35mm portrait photography, soft window light, subtle warm tone, ultra detailed fabric texture, award winning fashion magazine shot --ar 9:16 --v 6.0',
    targetAgent: 'Photo Prompt Generator Agent',
    isActive: true,
    usageCount: 162,
    bubbleColor: 'from-cyan-500/20 via-blue-500/20 to-cyan-600/30 text-cyan-300 border-cyan-400/50',
    glowColor: 'rgba(6, 182, 212, 0.35)',
    sizePx: 135,
    tags: ['Fashion Studio', '35mm Portrait', 'High Detail']
  },
  {
    id: 'skill_04',
    title: 'Dynamic Scene Splitter (5-10s)',
    category: 'splitter',
    confidence: 92,
    ruleText: 'Pecah adegan video per 5-10 detik agar pergantian visual tetap dinamis dan retention rate penonton tinggi.',
    exampleTemplate: 'Scene 1 (0-5s): Close-up problema. Scene 2 (5-10s): Demonstrasi solusi instan. Scene 3 (10-15s): Hasil transformasi.',
    targetAgent: 'TikTok Video Splitter Agent',
    isActive: true,
    usageCount: 130,
    bubbleColor: 'from-emerald-500/20 via-teal-500/20 to-emerald-600/30 text-emerald-300 border-emerald-400/50',
    glowColor: 'rgba(16, 185, 129, 0.35)',
    sizePx: 145,
    tags: ['Scene Splitter', 'Dynamic Pacing', 'Retention']
  },
  {
    id: 'skill_05',
    title: 'Herbal Health Safeguard Guardrail',
    category: 'guardrail',
    confidence: 99,
    ruleText: 'MANDATORY: Selalu berikan klaim edukatif non-medis untuk konten kesehatan & herbal agar mematuhi aturan platform.',
    exampleTemplate: 'Sertakan disclaimer: "Suplemen pendukung gaya hidup sehat, bukan obat pengganti resep dokter." Jangan klaim menyembuhkan total.',
    targetAgent: 'Safe Learning Governor Agent',
    isActive: true,
    usageCount: 310,
    bubbleColor: 'from-rose-500/20 via-pink-500/20 to-rose-600/30 text-rose-300 border-rose-400/50',
    glowColor: 'rgba(244, 63, 94, 0.35)',
    sizePx: 160,
    tags: ['Guardrail', 'Compliance', 'Edu-Safety']
  },
  {
    id: 'skill_06',
    title: 'High-Conversion CTA Engine',
    category: 'ideas',
    confidence: 95,
    ruleText: 'Sebutkan pain-point utama audiens di kalimat pertama caption dan tutup dengan Call-to-Action (CTA) jelas ke pembelian.',
    exampleTemplate: 'Caption Structure: [Pain Point Hook] -> [Value Proposition] -> [CTA: "Klik keranjang kuning sebelum promo promo habis!"]',
    targetAgent: 'Content Ideas AI Agent',
    isActive: true,
    usageCount: 220,
    bubbleColor: 'from-purple-500/20 via-fuchsia-500/20 to-purple-600/30 text-fuchsia-300 border-fuchsia-400/50',
    glowColor: 'rgba(217, 70, 239, 0.35)',
    sizePx: 130,
    tags: ['CTA Closing', 'Pain-Point', 'Conversion']
  }
];

export default function MemoryAgentSkillPanel() {
  const [skills, setSkills] = useState<MemorySkillBubble[]>(() => INITIAL_SKILL_BUBBLES);
  const [loading, setLoading] = useState<boolean>(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<'bubble' | 'matrix' | 'lab'>('bubble');
  
  // Modal & Inspector
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [inspectSkill, setInspectSkill] = useState<MemorySkillBubble | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Live Test Laboratory State
  const [testPromptInput, setTestPromptInput] = useState<string>('Buatkan ide video promosi serum wajah glowing untuk TikTok');
  const [isTestingSkill, setIsTestingSkill] = useState<boolean>(false);
  const [testResultOutput, setTestResultOutput] = useState<string | null>(null);

  // Add Skill Form
  const [formData, setFormData] = useState({
    title: '',
    category: 'ideas' as 'video' | 'photo' | 'ideas' | 'guardrail' | 'splitter',
    confidence: 95,
    ruleText: '',
    exampleTemplate: '',
    targetAgent: 'Content Ideas AI Agent',
  });

  const getCategoryColorToken = (cat: string) => {
    switch (cat) {
      case 'video':
        return { bg: 'from-indigo-500/20 via-purple-500/20 to-indigo-600/30 text-indigo-300 border-indigo-400/50', glow: 'rgba(99, 102, 241, 0.35)' };
      case 'photo':
        return { bg: 'from-cyan-500/20 via-blue-500/20 to-cyan-600/30 text-cyan-300 border-cyan-400/50', glow: 'rgba(6, 182, 212, 0.35)' };
      case 'guardrail':
        return { bg: 'from-rose-500/20 via-pink-500/20 to-rose-600/30 text-rose-300 border-rose-400/50', glow: 'rgba(244, 63, 94, 0.35)' };
      case 'splitter':
        return { bg: 'from-emerald-500/20 via-teal-500/20 to-emerald-600/30 text-emerald-300 border-emerald-400/50', glow: 'rgba(16, 185, 129, 0.35)' };
      default:
        return { bg: 'from-amber-500/20 via-orange-500/20 to-amber-600/30 text-amber-300 border-amber-400/50', glow: 'rgba(245, 158, 11, 0.35)' };
    }
  };

  const getTargetAgentName = (cat: string) => {
    switch (cat) {
      case 'video': return 'Video Prompt Generator Agent';
      case 'photo': return 'Photo Prompt Generator Agent';
      case 'guardrail': return 'Safe Learning Governor Agent';
      case 'splitter': return 'TikTok Video Splitter Agent';
      default: return 'Content Ideas AI Agent';
    }
  };

  const loadMemorySkills = useCallback(async () => {
    try {
      const res = await fetch('/api/formulas');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          // Merge custom formulas into skills format
          const mapped: MemorySkillBubble[] = data.map((f: any, idx: number) => {
            const cat = (f.category || 'ideas') as any;
            const colors = getCategoryColorToken(cat);
            return {
              id: f.id || `skill_${idx}`,
              title: f.title || 'Agent Memory Skill',
              category: cat,
              confidence: 90 + (idx % 10),
              ruleText: f.templateText || f.ruleText || 'Memori pola otomasi agen AI.',
              exampleTemplate: f.templateText || '',
              targetAgent: getTargetAgentName(cat),
              isActive: f.isActive !== false,
              usageCount: f.usageCount || Math.floor(Math.random() * 100) + 50,
              bubbleColor: colors.bg,
              glowColor: colors.glow,
              sizePx: 130 + (idx % 3) * 10,
              tags: [cat.toUpperCase(), 'AI Memory']
            };
          });

          // Append mandatory guardrail skill if missing
          const hasGuardrail = mapped.some(m => m.category === 'guardrail');
          const combined = !hasGuardrail ? [...INITIAL_SKILL_BUBBLES, ...mapped] : mapped;
          const seen = new Set<string>();
          const uniqueSkills = combined.filter(s => {
            if (seen.has(s.id)) return false;
            seen.add(s.id);
            return true;
          });
          setSkills(uniqueSkills);
        }
      }
    } catch (e) {
      // Keep default
    }
  }, []);

  // Sync memory skills with backend or system memory
  useEffect(() => {
    const handleUpdated = () => {
      loadMemorySkills();
    };
    window.addEventListener('satset_formulas_updated', handleUpdated);
    window.addEventListener('satset_system_memory_updated', handleUpdated);
    return () => {
      window.removeEventListener('satset_formulas_updated', handleUpdated);
      window.removeEventListener('satset_system_memory_updated', handleUpdated);
    };
  }, [loadMemorySkills]);

  const handleSaveSkill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.ruleText.trim()) return;

    const colors = getCategoryColorToken(formData.category);
    const newSkill: MemorySkillBubble = {
      id: 'skill_' + Date.now(),
      title: formData.title.trim(),
      category: formData.category,
      confidence: Number(formData.confidence) || 95,
      ruleText: formData.ruleText.trim(),
      exampleTemplate: formData.exampleTemplate.trim() || formData.ruleText.trim(),
      targetAgent: formData.targetAgent || getTargetAgentName(formData.category),
      isActive: true,
      usageCount: 1,
      bubbleColor: colors.bg,
      glowColor: colors.glow,
      sizePx: 140,
      tags: [formData.category.toUpperCase(), 'Custom Trained']
    };

    try {
      // Sync to formulas endpoint
      await fetch('/api/formulas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: newSkill.id,
          title: newSkill.title,
          category: newSkill.category,
          targetStyle: newSkill.targetAgent,
          templateText: newSkill.exampleTemplate,
          isActive: true
        }),
      });

      // Track in learning sync
      await fetch('/api/learn-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          insight: `[Memory Skill Injected] ${newSkill.title}: ${newSkill.ruleText}`,
          type: 'contentIdeas'
        })
      });

      setSkills((prev) => [newSkill, ...prev]);
      setShowAddModal(false);
      setToastMessage(`Memory Agent Skill "${newSkill.title}" berhasil diinjeksi ke sistem!`);
      setFormData({
        title: '',
        category: 'ideas',
        confidence: 95,
        ruleText: '',
        exampleTemplate: '',
        targetAgent: 'Content Ideas AI Agent',
      });
    } catch (err) {
      setSkills((prev) => [newSkill, ...prev]);
      setShowAddModal(false);
    } finally {
      setTimeout(() => setToastMessage(null), 3000);
    }
  };

  const toggleSkillActive = (id: string) => {
    setSkills((prev) =>
      prev.map((s) => (s.id === id ? { ...s, isActive: !s.isActive } : s))
    );
  };

  const handleDeleteSkill = (id: string) => {
    if (!confirm('Hapus Memory Agent Skill ini?')) return;
    setSkills((prev) => prev.filter((s) => s.id !== id));
    if (inspectSkill?.id === id) setInspectSkill(null);
    setToastMessage('Skill Memory berhasil dihapus');
    setTimeout(() => setToastMessage(null), 2500);
  };

  const copyRule = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const runTestPromptInLab = () => {
    if (!testPromptInput.trim()) return;
    setIsTestingSkill(true);
    setTestResultOutput(null);

    setTimeout(() => {
      const activeSkills = skills.filter((s) => s.isActive);
      const injectedRules = activeSkills
        .map((s) => `• [Skill: ${s.title} (${s.confidence}%)] -> Rule: ${s.ruleText}`)
        .join('\n');

      const mockInjectedOutput = `[SIMULASI MEMORY AGENT SKILL INJECTION]

PROMPT INPUT USER:
"${testPromptInput}"

SYSTEM MEMORY INJECTED (${activeSkills.length} SKILLS ACTIVE):
${injectedRules}

--------------------------------------------------
HASIL HASIL HASIL OUTPUT AI AGENT (DILENGKAPI SKILL MEMORI):
1. HOOK (0-3s):
   "Jangan beli serum mahal dulu sebelum tahu 3 rahasia glowing instan ini!" (Applied Skill: 3s Viral Verbal Hook)

2. CINEMATIC INSTRUCTION:
   High-end 8k resolution, soft studio light, shallow depth of field, slow push-in to product bottle droplets. (Applied Skill: Cinematic Commercial 8K)

3. CALL TO ACTION:
   "Klik keranjang kuning di bawah sekarang sebelum diskon spesial habis!" (Applied Skill: High-Conversion CTA Engine)`;

      setTestResultOutput(mockInjectedOutput);
      setIsTestingSkill(false);
    }, 1200);
  };

  // Filter skills
  const filteredSkills = skills.filter((s) => {
    const matchesCategory = selectedCategory === 'all' || s.category === selectedCategory;
    const matchesQuery = 
      !searchQuery || 
      s.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      s.ruleText.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.targetAgent.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesQuery;
  });

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center justify-between shadow-xs"
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{toastMessage}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cyberpunk High-Tech Hero Header */}
      <div className="relative overflow-hidden bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-900 p-6 md:p-8 rounded-3xl text-white shadow-2xl border border-indigo-700/60 space-y-6">
        {/* Background Glowing Orbital Bubbles */}
        <div className="absolute -top-10 -right-10 w-48 h-48 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none animate-pulse" />
        <div className="absolute -bottom-10 left-1/3 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#3525cd] to-purple-600 flex items-center justify-center text-amber-300 shadow-lg border border-indigo-400/40">
                <Brain className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h2 className="text-xl md:text-2xl font-black tracking-tight text-white flex items-center gap-2">
                  <span>Memory Agent Skill Cluster</span>
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/40 text-[10px] font-mono font-extrabold uppercase">
                    NEURAL INJECTION LIVE
                  </span>
                </h2>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                  Pusat kontrol memori dan pola keterampilan (*Agent Skills*) yang secara otomatis disuntikkan (*injected*) ke dalam prompt seluruh pengguna secara realtime.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* View Mode Switches */}
            <div className="bg-slate-900/90 p-1 rounded-2xl border border-indigo-900 flex items-center gap-1">
              <button
                type="button"
                onClick={() => setViewMode('bubble')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  viewMode === 'bubble' 
                    ? 'bg-[#3525cd] text-white shadow-md' 
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Circle className="w-3.5 h-3.5" />
                <span>Bubble Canvas</span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode('matrix')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  viewMode === 'matrix' 
                    ? 'bg-[#3525cd] text-white shadow-md' 
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Grid className="w-3.5 h-3.5" />
                <span>Neural Matrix</span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode('lab')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  viewMode === 'lab' 
                    ? 'bg-amber-500 text-slate-950 font-black shadow-md' 
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Terminal className="w-3.5 h-3.5" />
                <span>Test Lab</span>
              </button>
            </div>

            {/* Add Skill Button */}
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs transition-all shadow-lg flex items-center gap-2 cursor-pointer shrink-0 border border-amber-300/60"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Skill Memory</span>
            </button>
          </div>
        </div>

        {/* Realtime Skill Metrics Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-3 border-t border-indigo-900/80">
          <div className="bg-slate-900/80 border border-slate-800 p-3 rounded-xl space-y-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-300 flex items-center gap-1">
              <Cpu className="w-3.5 h-3.5 text-indigo-400" />
              <span>Total Active Memory Skills</span>
            </span>
            <div className="text-xl font-black text-white font-mono">
              {skills.filter(s => s.isActive).length} <span className="text-xs text-slate-400 font-normal">/ {skills.length}</span>
            </div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 p-3 rounded-xl space-y-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-400 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Average Confidence Score</span>
            </span>
            <div className="text-xl font-black text-emerald-300 font-mono">
              {skills.length > 0 ? Math.round(skills.reduce((acc, s) => acc + s.confidence, 0) / skills.length) : 96}%
            </div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 p-3 rounded-xl space-y-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-300 flex items-center gap-1">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>Total Executed Injections</span>
            </span>
            <div className="text-xl font-black text-amber-300 font-mono">
              {skills.reduce((acc, s) => acc + s.usageCount, 0)}x
            </div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 p-3 rounded-xl space-y-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-purple-300 flex items-center gap-1">
              <Bot className="w-3.5 h-3.5 text-purple-400" />
              <span>Safe Governor Sync</span>
            </span>
            <div className="text-xl font-black text-purple-300 font-mono flex items-center gap-1.5">
              <span>CONNECTED</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />
          <span className="text-xs font-extrabold text-slate-600 shrink-0">Filter Category:</span>

          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              selectedCategory === 'all' 
                ? 'bg-slate-900 text-white' 
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Semua Skill ({skills.length})
          </button>

          <button
            type="button"
            onClick={() => setSelectedCategory('ideas')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              selectedCategory === 'ideas' 
                ? 'bg-amber-500 text-slate-950 font-black' 
                : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
            }`}
          >
            Content Ideas
          </button>

          <button
            type="button"
            onClick={() => setSelectedCategory('video')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              selectedCategory === 'video' 
                ? 'bg-[#3525cd] text-white' 
                : 'bg-indigo-50 text-[#3525cd] hover:bg-indigo-100'
            }`}
          >
            Video AI
          </button>

          <button
            type="button"
            onClick={() => setSelectedCategory('photo')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              selectedCategory === 'photo' 
                ? 'bg-cyan-600 text-white' 
                : 'bg-cyan-50 text-cyan-800 hover:bg-cyan-100'
            }`}
          >
            Photo Prompt
          </button>

          <button
            type="button"
            onClick={() => setSelectedCategory('guardrail')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              selectedCategory === 'guardrail' 
                ? 'bg-rose-600 text-white' 
                : 'bg-rose-50 text-rose-800 hover:bg-rose-100'
            }`}
          >
            Guardrail
          </button>

          <button
            type="button"
            onClick={() => setSelectedCategory('splitter')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              selectedCategory === 'splitter' 
                ? 'bg-emerald-600 text-white' 
                : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
            }`}
          >
            Splitter
          </button>
        </div>

        {/* Search */}
        <div className="relative w-full md:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari Memory Skill..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-[#3525cd] outline-none"
          />
        </div>
      </div>

      {/* VIEW MODE 1: INTERACTIVE BUBBLE CLUSTER CANVAS */}
      {viewMode === 'bubble' && (
        <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 rounded-3xl border border-indigo-800/60 p-8 min-h-[480px] shadow-2xl relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between text-white border-b border-indigo-900/60 pb-3 relative z-10">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-extrabold text-white">Interactive Agent Skill Bubble Cluster</h3>
            </div>
            <span className="text-[11px] font-mono text-slate-400">
              Klik / Hover Bubble untuk Inspeksi & Kontrol Status Injeksi
            </span>
          </div>

          {/* Floating Bubble Nodes Field */}
          <div className="py-8 relative z-10 flex flex-wrap items-center justify-center gap-6 md:gap-8">
            {filteredSkills.length === 0 ? (
              <div className="py-16 text-center text-slate-400 text-xs font-bold space-y-2">
                <Brain className="w-8 h-8 text-slate-600 mx-auto animate-bounce" />
                <p>Tidak ada Memory Skill Bubble ditemukan.</p>
              </div>
            ) : (
              filteredSkills.map((skill, index) => (
                <motion.div
                  key={`bubble-${skill.id}-${index}`}
                  whileHover={{ scale: 1.08, y: -6 }}
                  whileTap={{ scale: 0.95 }}
                  animate={{ 
                    y: [0, (index % 2 === 0 ? -8 : 8), 0],
                    rotate: [0, (index % 2 === 0 ? 1.5 : -1.5), 0]
                  }}
                  transition={{
                    duration: 3 + (index % 3),
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                  onClick={() => setInspectSkill(skill)}
                  style={{
                    boxShadow: skill.isActive ? `0 0 25px ${skill.glowColor}` : 'none'
                  }}
                  className={`relative p-5 rounded-full border-2 bg-gradient-to-br ${skill.bubbleColor} cursor-pointer flex flex-col items-center justify-center text-center transition-all select-none backdrop-blur-md group ${
                    !skill.isActive ? 'opacity-40 grayscale' : ''
                  }`}
                  title={`${skill.title} (${skill.confidence}% Confidence)`}
                >
                  {/* Active Pulse Ring */}
                  {skill.isActive && (
                    <span className="absolute inset-0 rounded-full border border-white/20 animate-ping pointer-events-none" />
                  )}

                  <div className="space-y-1 max-w-[130px] z-10">
                    <span className="px-2 py-0.5 rounded-full bg-slate-900/80 text-[9px] font-mono font-black text-amber-300 border border-slate-700 block mx-auto">
                      {skill.confidence}% Match
                    </span>
                    <h4 className="text-xs font-black leading-tight drop-shadow-md group-hover:text-white">
                      {skill.title}
                    </h4>
                    <span className="text-[9px] font-mono uppercase text-slate-300 block opacity-80">
                      {skill.category}
                    </span>
                  </div>

                  {/* Hover Quick Action Badge */}
                  <div className="absolute -bottom-2 bg-slate-900 text-white text-[9px] font-extrabold px-2 py-0.5 rounded-full border border-slate-700 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg">
                    Klik Inspeksi
                  </div>
                </motion.div>
              ))
            )}
          </div>

          <div className="pt-4 border-t border-indigo-900/60 flex items-center justify-between text-[11px] text-slate-400 relative z-10 font-mono">
            <span>✨ Agent Skill Memory Bank: {filteredSkills.length} Neural Bubbles</span>
            <span className="text-emerald-400 font-bold flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              Live Injection Ready
            </span>
          </div>
        </div>
      )}

      {/* VIEW MODE 2: NEURAL MATRIX GRID */}
      {viewMode === 'matrix' && (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-6 space-y-4">
          <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#3525cd]" />
            Daftar Matrix Memory Agent Skills ({filteredSkills.length})
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredSkills.map((skill, index) => (
              <div 
                key={`matrix-${skill.id}-${index}`}
                className={`p-5 rounded-2xl border transition-all space-y-3 relative ${
                  skill.isActive 
                    ? 'border-indigo-200 bg-slate-50/80 hover:bg-white hover:border-indigo-400 shadow-xs' 
                    : 'border-slate-200 bg-slate-100/50 opacity-60'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase bg-indigo-100 text-[#3525cd]">
                        {skill.category}
                      </span>
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-amber-100 text-amber-900">
                        {skill.confidence}% Confidence
                      </span>
                    </div>
                    <h4 className="text-xs font-black text-slate-900 mt-1.5">{skill.title}</h4>
                    <span className="text-[10px] font-mono text-slate-500">Target: {skill.targetAgent}</span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => toggleSkillActive(skill.id)}
                      className={`px-2 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition-all ${
                        skill.isActive 
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                          : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {skill.isActive ? 'INJECTED' : 'PAUSED'}
                    </button>
                    <button
                      type="button"
                      onClick={() => copyRule(skill.ruleText, skill.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 cursor-pointer"
                      title="Salin Aturan Skill"
                    >
                      {copiedId === skill.id ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteSkill(skill.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                      title="Hapus Skill"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Rule Text */}
                <div className="p-3 rounded-xl bg-slate-900 text-slate-200 text-[11px] font-mono leading-relaxed">
                  {skill.ruleText}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 pt-1">
                  <span>Usage Injections: {skill.usageCount}x</span>
                  <button
                    type="button"
                    onClick={() => setInspectSkill(skill)}
                    className="text-[#3525cd] font-bold hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Eye className="w-3 h-3" />
                    <span>Lihat Detail</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* VIEW MODE 3: LIVE SKILL TEST LABORATORY */}
      {viewMode === 'lab' && (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-6 space-y-5">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Terminal className="w-5 h-5 text-amber-500" />
            <div>
              <h3 className="text-base font-extrabold text-slate-900">Live Skill Injection Test Laboratory</h3>
              <p className="text-xs text-slate-500">Uji langsung bagaimana Memory Agent Skills secara realtime menyuntikkan pola jawaban ke prompt pengguna.</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Simulasi Input Prompt Pengguna:</label>
              <textarea
                rows={3}
                value={testPromptInput}
                onChange={(e) => setTestPromptInput(e.target.value)}
                placeholder="Masukkan prompt pengguna yang ingin diuji..."
                className="w-full p-3.5 rounded-2xl border border-slate-300 text-xs font-medium focus:ring-2 focus:ring-[#3525cd] outline-none"
              />
            </div>

            <button
              type="button"
              onClick={runTestPromptInLab}
              disabled={isTestingSkill}
              className="px-5 py-2.5 rounded-xl bg-[#3525cd] hover:bg-indigo-600 text-white font-bold text-xs shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Play className={`w-4 h-4 ${isTestingSkill ? 'animate-spin' : ''}`} />
              <span>{isTestingSkill ? 'Menguji Injeksi Memori...' : 'Jalankan Pengujian Injeksi Skill'}</span>
            </button>

            {testResultOutput && (
              <div className="p-4 rounded-2xl bg-slate-950 text-emerald-400 font-mono text-xs whitespace-pre-wrap leading-relaxed shadow-inner border border-slate-800">
                {testResultOutput}
              </div>
            )}
          </div>
        </div>
      )}

      {/* INSPECT SKILL BUBBLE MODAL */}
      <AnimatePresence>
        {inspectSkill && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 space-y-5"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Brain className="w-5 h-5 text-[#3525cd]" />
                  <h3 className="text-base font-extrabold text-slate-900">Detail Memory Agent Skill</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setInspectSkill(null)}
                  className="text-slate-400 hover:text-slate-600 font-bold text-sm cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4 text-xs">
                <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                  <div>
                    <span className="text-[10px] font-extrabold uppercase text-slate-400">Judul Skill Memory</span>
                    <h4 className="font-black text-slate-900 text-sm">{inspectSkill.title}</h4>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-900 font-mono font-bold text-xs">
                    {inspectSkill.confidence}% Match Confidence
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-[10px] font-extrabold uppercase text-slate-400">Target AI Agent</span>
                    <p className="font-bold text-indigo-900">{inspectSkill.targetAgent}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-extrabold uppercase text-slate-400">Kategori</span>
                    <p className="font-bold text-slate-800 uppercase">{inspectSkill.category}</p>
                  </div>
                </div>

                <div>
                  <span className="text-[10px] font-extrabold uppercase text-slate-400 mb-1 block">Aturan Pola Memori (Injected System Rule)</span>
                  <div className="p-3 rounded-xl bg-slate-900 text-slate-200 font-mono text-xs">
                    {inspectSkill.ruleText}
                  </div>
                </div>

                {inspectSkill.exampleTemplate && (
                  <div>
                    <span className="text-[10px] font-extrabold uppercase text-slate-400 mb-1 block">Contoh Template Prompt Injeksi</span>
                    <div className="p-3 rounded-xl bg-slate-100 text-slate-800 font-mono text-[11px]">
                      {inspectSkill.exampleTemplate}
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-3 flex items-center justify-between border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => toggleSkillActive(inspectSkill.id)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer ${
                    inspectSkill.isActive 
                      ? 'bg-rose-100 text-rose-800 hover:bg-rose-200' 
                      : 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                  }`}
                >
                  {inspectSkill.isActive ? 'Nonaktifkan Injeksi' : 'Aktifkan Injeksi Skill'}
                </button>

                <button
                  type="button"
                  onClick={() => setInspectSkill(null)}
                  className="px-4 py-2 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 cursor-pointer"
                >
                  Tutup Detail
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ADD MEMORY SKILL MODAL */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-5"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Brain className="w-5 h-5 text-[#3525cd]" />
                  <h3 className="text-base font-extrabold text-slate-900">Tambah Memory Agent Skill Baru</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="text-slate-400 hover:text-slate-600 text-sm font-bold cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveSkill} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Nama Skill Memory</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Viral Softsell Storytelling Pattern"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-[#3525cd] outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Kategori Skill</label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value as any })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold bg-white"
                    >
                      <option value="ideas">Content Ideas AI</option>
                      <option value="video">Video Prompt AI</option>
                      <option value="photo">Photo Prompt AI</option>
                      <option value="guardrail">Guardrail Safeguard</option>
                      <option value="splitter">TikTok Splitter</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Confidence Score (%)</label>
                    <input
                      type="number"
                      min={50}
                      max={100}
                      value={formData.confidence}
                      onChange={(e) => setFormData({ ...formData, confidence: Number(e.target.value) })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Aturan Memory Rule (Disuntikkan ke Agent)</label>
                  <textarea
                    required
                    rows={3}
                    placeholder="Contoh: Selalu sertakan 3 adegan pergantian visual dalam 10 detik pertama..."
                    value={formData.ruleText}
                    onChange={(e) => setFormData({ ...formData, ruleText: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs font-mono focus:ring-2 focus:ring-[#3525cd] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Contoh Template Output Prompt (Opsional)</label>
                  <textarea
                    rows={2}
                    placeholder="Contoh template instruksi yang digunakan..."
                    value={formData.exampleTemplate}
                    onChange={(e) => setFormData({ ...formData, exampleTemplate: e.target.value })}
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
                    Injeksi Skill Memory
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
