'use client';

import React, { useState } from 'react';
import { Scissors, Clock, Sparkles, Copy, Check, Loader2, AlertCircle, RefreshCw, Wand2, Sliders, Play, FileText, Lock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import SplitPromptViewer from './view/SplitPromptViewer';
import { getAntiLimitHeaders } from '../../lib/antiLimit';
import { saveHistoryItem } from '../../lib/history';
import { learningSync } from '../../lib/learningSync';
import { safeParseJson } from '../../lib/apiHelper';
import { useAccessGate } from '../../hooks/useAccessGate';
import { useGenerationLog } from '../../hooks/useGenerationLog';
import { reportActiveGenerationStatus } from '../../events/generationEvent';

export default function PromptSplitterTool() {
  const accessGate = useAccessGate();
  const { logGeneration } = useGenerationLog();

  const [videoDuration, setVideoDuration] = useState<number>(30); // in seconds
  const [segmentDuration, setSegmentDuration] = useState<string>('5'); // 5, 8, 10, 15
  const [targetAI, setTargetAI] = useState<string>('general');
  const [sourceText, setSourceText] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [splitResult, setSplitResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Standardized duration presets
  const durationPresets = [15, 30, 60];

  // Calculate calculated clip count
  const sec = parseInt(segmentDuration, 10) || 5;
  const clipCount = Math.max(1, Math.ceil(videoDuration / sec));

  const isAllowed = accessGate.isAllowed('video_to_prompt');
  const accessReason = accessGate.getReason('video_to_prompt');

  const handleSplitPrompt = async () => {
    if (!isAllowed) {
      setError(accessReason || 'Akses ditolak. Silakan perpanjang paket Anda.');
      return;
    }

    if (!sourceText.trim()) {
      setError('Masukkan teks deskripsi, konsep adegan, atau prompt video yang ingin dipecah.');
      return;
    }

    setIsProcessing(true);
    setError(null);
    const startTime = Date.now();
    const activeId = `gen_split_${Date.now()}`;
    reportActiveGenerationStatus(activeId, 'generating', `Pecah Prompt (${targetAI.toUpperCase()})`);

    try {
      // Call backend API with text input prompt payload
      const response = await fetch('/api/generate-prompt', {
        method: 'POST',
        headers: getAntiLimitHeaders(),
        body: JSON.stringify({
          mimeType: 'text/plain',
          base64Data: btoa(unescape(encodeURIComponent(sourceText))),
          targetAI: targetAI,
          segmentDuration: segmentDuration,
          includeActions: true,
          includeVoiceOver: true,
          includeCinematics: true,
        }),
      });

      const data = await safeParseJson(response);
      const latencyMs = Date.now() - startTime;

      if (!response.ok || data.error) {
        throw new Error(data.error || 'Terjadi kesalahan saat memproses Video to Prompt.');
      }

      if (!data.prompt) {
        throw new Error('Hasil Video to Prompt kosong. Silakan coba lagi.');
      }

      setSplitResult(data.prompt);
      reportActiveGenerationStatus(activeId, 'completed');

      // Emit generation event to tracking pipeline
      logGeneration({
        tool: 'video_to_prompt',
        topic: sourceText.slice(0, 100),
        durationRequested: videoDuration,
        segmentSplit: sec,
        modelUsed: data.modelUsed || 'gemini-3.6-flash',
        latencyMs,
        outcome: 'success',
      });

      // Track video prompt generated in learning sync
      learningSync.track('video_prompt_generated', {
        videoDuration,
        segmentDuration,
        clipCount,
        targetAI,
        sourceTextSnippet: sourceText.slice(0, 50),
      });

      // Auto save to local history
      saveHistoryItem({
        category: 'splitter_result',
        title: `Pecah Prompt: ${sourceText.slice(0, 40)}...`,
        subtitle: `${clipCount} Klip (${segmentDuration}s) • Target ${targetAI.toUpperCase()}`,
        data: {
          prompt: data.prompt,
          modelUsed: data.modelUsed || 'Gemini Auto-Cascade',
          targetAI,
          segmentDuration,
          sourceText,
        },
      });
    } catch (err: any) {
      console.error(err);
      reportActiveGenerationStatus(activeId, 'completed');
      const latencyMs = Date.now() - startTime;
      const errMsg = err.message || 'Terjadi kesalahan saat memecah prompt.';
      setError(errMsg);

      logGeneration({
        tool: 'video_to_prompt',
        topic: sourceText.slice(0, 100),
        durationRequested: videoDuration,
        segmentSplit: sec,
        modelUsed: 'gemini-3.6-flash',
        latencyMs,
        outcome: 'error',
        errorMessage: errMsg,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClear = () => {
    setSourceText('');
    setSplitResult(null);
    setError(null);
  };

  return (
    <div className="space-y-6">
      {/* Tool Intro Header */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-white/10 backdrop-blur-md relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/25 ring-1 ring-white/20">
              <Scissors className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                Tools Pecah / Split Prompt AI
                <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-semibold">
                  Custom Duration
                </span>
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                Pecah adegan video atau skrip deskripsi menjadi beberapa klip prompt berdurasi 5, 8, 10, atau 15 detik yang siap disalin!
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-stretch md:self-auto justify-end">
            <span className="text-xs text-indigo-300 font-semibold bg-indigo-950/60 border border-indigo-500/30 px-3 py-1.5 rounded-xl flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-indigo-400" />
              Estimasi: {clipCount} Klip ({videoDuration}s ÷ {sec}s)
            </span>
          </div>
        </div>
      </div>

      {/* Control Configuration Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Form Input & Duration Options */}
        <div className="lg:col-span-2 space-y-5 rounded-3xl bg-slate-900/60 border border-white/10 p-5 sm:p-6 backdrop-blur-md">
          {/* Preset & Custom Duration selection */}
          <div className="space-y-3">
            <label className="text-xs font-semibold text-white uppercase tracking-wider flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-indigo-400" /> Total Durasi Video Utama
              </span>
              <span className="text-indigo-400 font-bold">{videoDuration} Detik</span>
            </label>
            
            <div className="flex flex-wrap items-center gap-2">
              {durationPresets.map((preset) => (
                <button
                  type="button"
                  key={preset}
                  onClick={() => setVideoDuration(preset)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                    videoDuration === preset
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 ring-1 ring-indigo-400'
                      : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {preset} Detik
                </button>
              ))}
              <div className="flex items-center gap-1 ml-auto">
                <input
                  type="number"
                  min="5"
                  max="300"
                  value={videoDuration}
                  onChange={(e) => setVideoDuration(Math.max(5, parseInt(e.target.value) || 5))}
                  className="w-20 px-3 py-1 rounded-xl bg-black/40 border border-white/10 text-xs font-mono text-white focus:outline-none focus:border-indigo-500 text-center"
                />
                <span className="text-xs text-slate-400 font-medium">detik</span>
              </div>
            </div>
          </div>

          {/* Opsi Pecah Durasi Segmen (5, 8, 10, 15 Detik) */}
          <div className="space-y-3 pt-3 border-t border-white/10">
            <label className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-1.5">
              <Scissors className="w-4 h-4 text-purple-400" /> Pilih Pecah Durasi Segmen Prompt
            </label>
            
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {[
                { value: '5', label: '5 Detik', desc: 'Cocok untuk Sora, Runway, Kling' },
                { value: '8', label: '8 Detik', desc: 'Standar Luma, Hailuo, Pika' },
                { value: '10', label: '10 Detik', desc: 'Sora 10s Extended' },
                { value: '15', label: '15 Detik', desc: 'Adegan Panjang / Cinematic' },
              ].map((opt) => (
                <button
                  type="button"
                  key={opt.value}
                  onClick={() => setSegmentDuration(opt.value)}
                  className={`p-3 rounded-2xl border text-left transition-all ${
                    segmentDuration === opt.value
                      ? 'bg-gradient-to-br from-indigo-600/20 to-purple-600/20 border-indigo-500 text-white ring-1 ring-indigo-500/50'
                      : 'bg-white/5 border-white/10 text-slate-400 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <div className="text-sm font-bold text-white mb-0.5">{opt.label}</div>
                  <div className="text-[10px] text-slate-400 leading-tight">{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Target Generator AI */}
          <div className="space-y-3 pt-3 border-t border-white/10">
            <label className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-1.5">
              <Wand2 className="w-4 h-4 text-amber-400" /> Target Video AI Generator
            </label>
            <div className="flex flex-wrap gap-2">
              {[
                { id: 'general', name: 'Universal AI Prompt' },
                { id: 'sora', name: 'OpenAI Sora' },
                { id: 'runway', name: 'Runway Gen-3' },
                { id: 'kling', name: 'Kling AI' },
                { id: 'luma', name: 'Luma Dream Machine' },
              ].map((ai) => (
                <button
                  type="button"
                  key={ai.id}
                  onClick={() => setTargetAI(ai.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                    targetAI === ai.id
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                      : 'bg-black/30 border border-white/10 text-slate-400 hover:text-white'
                  }`}
                >
                  {ai.name}
                </button>
              ))}
            </div>
          </div>

          {/* Text Input Prompt Source */}
          <div className="space-y-2 pt-3 border-t border-white/10">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <label className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-indigo-400" /> Deskripsi Video / Skrip / Master Prompt
              </label>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Contoh Praktis:</span>
                <button
                  type="button"
                  onClick={() => {
                    setVideoDuration(30);
                    setSegmentDuration('5');
                    setSourceText("A 30-second cinematic video advertising an artisan espresso coffee shop. Opening with a close-up macro shot of roasted coffee beans dropping into a grinder, rich crema pouring into a clear glass cup, steam rising softly, a friendly barista smiling and handing the cup to a customer in a warm cozy cafe atmosphere with ambient jazz music.");
                  }}
                  className="px-2 py-0.5 rounded-md bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/20 text-[11px] font-medium transition-colors"
                >
                  30s Kopi (Pecah 5s = 6 Klip)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setVideoDuration(40);
                    setSegmentDuration('8');
                    setSourceText("A 40-second luxurious skincare commercial. Starting with a serene woman waking up at golden hour, applying a sparkling hydrating face serum in slow motion, water droplets splashing on glowing skin, close-up of natural botanical ingredients like aloe and rosehip oil, ending with her radiant smiling face against a minimalist glass vanity setup.");
                  }}
                  className="px-2 py-0.5 rounded-md bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/20 text-[11px] font-medium transition-colors"
                >
                  40s Skincare (Pecah 8s = 5 Klip)
                </button>
                {sourceText && (
                  <button
                    type="button"
                    onClick={handleClear}
                    className="text-[11px] text-slate-400 hover:text-rose-400 transition-colors ml-1"
                  >
                    Bersihkan
                  </button>
                )}
              </div>
            </div>
            <textarea
              value={sourceText}
              onChange={(e) => setSourceText(e.target.value)}
              placeholder="Tempelkan skrip video, narasi, atau konsep adegan lengkap di sini (contoh: 'Video 30 detik tentang seorang koki membuat pasta creamy di dapur restoran Italia mewah, diiringi suara desisan saus dan musik jazz...')"
              rows={5}
              className="w-full p-4 rounded-2xl bg-black/50 border border-white/10 text-xs sm:text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 custom-scrollbar leading-relaxed"
            />
          </div>

          {/* Action Button */}
          <button
            type="button"
            onClick={handleSplitPrompt}
            disabled={isProcessing || !sourceText.trim()}
            className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:from-slate-800 disabled:to-slate-800 text-white font-semibold flex items-center justify-center gap-2.5 transition-all shadow-lg shadow-indigo-600/25"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Memecah Prompt Menjadi {clipCount} Klip ({segmentDuration}s/klip)...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5 text-amber-300" />
                <span>Pecah Menjadi {clipCount} Prompt Klip Siap Salin</span>
              </>
            )}
          </button>
        </div>

        {/* Right Col: Info & Tips */}
        <div className="space-y-4">
          <div className="p-5 rounded-3xl bg-indigo-950/20 border border-indigo-500/20 backdrop-blur-md space-y-3">
            <h4 className="text-xs font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
              💡 Tips Pemecahan Prompt
            </h4>
            <ul className="text-xs text-slate-300 space-y-2 leading-relaxed list-disc list-inside">
              <li>
                <strong>Video 30 Detik</strong> jika dipecah 5s akan menghasilkan <strong>6 prompt klip berurutan</strong>.
              </li>
              <li>
                Setiap prompt klip menyertakan rincian aksi, transkrip voice over, dan lighting khusus segmen tersebut.
              </li>
              <li>
                Klik tombol <strong>&quot;Salin Prompt Klip Ini&quot;</strong> pada masing-masing kartu klip untuk disalin ke AI Video Generator favorit Anda.
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-start gap-3 text-rose-300 text-xs sm:text-sm"
        >
          <AlertCircle className="w-5 h-5 shrink-0 text-rose-400 mt-0.5" />
          <p>{error}</p>
        </motion.div>
      )}

      {/* Results View */}
      {splitResult && (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <SplitPromptViewer
            rawPrompt={splitResult}
            segmentDuration={segmentDuration}
            targetAI={targetAI}
          />
        </motion.div>
      )}
    </div>
  );
}
