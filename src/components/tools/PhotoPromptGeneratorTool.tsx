'use client';

import React, { useState, useRef, useEffect, DragEvent, ChangeEvent } from 'react';
import { Camera, Image as ImageIcon, Sparkles, Copy, Check, Loader2, AlertCircle, RefreshCw, Wand2, Sliders, FileText, Cpu, Layers, Share2, Eye, Download, ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import { getAntiLimitHeaders } from '../../lib/antiLimit';
import { saveHistoryItem } from '../../lib/history';
import { learningSync } from '../../lib/learningSync';
import { safeParseJson } from '../../lib/apiHelper';
import { useGenerationLog } from '../../hooks/useGenerationLog';
import { reportActiveGenerationStatus } from '../../events/generationEvent';
import { SafeImage } from '../common/SafeImage';

interface PhotoPromptGeneratorToolProps {
  initialConcept?: string;
  initialNegativePrompt?: string;
  initialReferenceImage?: File | null;
}

const cleanPromptText = (text: string): string => {
  if (!text) return '';
  return text
    .replace(/^```(?:text|markdown)?\s*/i, '')
    .replace(/```$/i, '')
    .replace(/^\[.*?Photorealistic Master Engine\]\s*/i, '')
    .replace(/^\[.*?Nano Banana.*?\]\s*/i, '')
    .trim();
};

function parsePhotoPromptOutput(rawText: string | null) {
  if (!rawText) {
    return {
      nanobananapro: '',
      analysis: '',
    };
  }

  const cleanCodeFence = (text: string): string => {
    if (!text) return '';
    const match = text.match(/```(?:text|markdown)?\s*\n?([\s\S]*?)\n?```/i);
    if (match && match[1]) {
      return match[1].trim();
    }
    return text.replace(/```(?:text|markdown)?/gi, '').replace(/```/g, '').trim();
  };

  const sections = rawText.split(/(?=###|\n---)/);

  let nanobananapro = '';
  let analysis = '';

  for (const section of sections) {
    const trimmed = section.trim();
    if (!trimmed) continue;

    if (/TIKTOK|GOOGLE|AEO|NANO BANANA|MASTER PROMPT|IMAGEN|AI PROMPT/i.test(trimmed) && !/ANALISIS/i.test(trimmed)) {
      nanobananapro = cleanCodeFence(trimmed);
    } else if (/ANALISIS/i.test(trimmed)) {
      analysis = trimmed
        .replace(/^(?:###|---|\s)*.*ANALISIS.*$/im, '')
        .trim();
    }
  }

  if (!nanobananapro) {
    const nanoMatch = rawText.match(/(?:TIKTOK|GOOGLE|AEO|MASTER PROMPT)[\s\S]*?```(?:text)?\s*([\s\S]*?)```/i);
    if (nanoMatch) nanobananapro = nanoMatch[1].trim();
  }
  if (!analysis) {
    const analMatch = rawText.match(/ANALISIS(?: MENDALAM RELEVANSI SCENE & ALGORITMA| ESTETIKA & RELEVANSI TIKTOK| DETAIL VISUAL FOTO)[\s\S]*?(?=\n###|\n---|$)/i);
    if (analMatch) {
      analysis = analMatch[0].replace(/.*ANALISIS.*/i, '').trim();
    }
  }

  if (!nanobananapro) {
    const codeBlocks = rawText.match(/```(?:text|markdown)?\s*([\s\S]*?)```/gi);
    if (codeBlocks && codeBlocks.length > 0) {
      nanobananapro = cleanCodeFence(codeBlocks[0]);
    } else {
      nanobananapro = rawText.trim();
    }
  }

  return {
    nanobananapro: cleanPromptText(nanobananapro || rawText),
    analysis: analysis || '',
  };
}

export default function PhotoPromptGeneratorTool({ initialConcept, initialNegativePrompt, initialReferenceImage }: PhotoPromptGeneratorToolProps) {
  const { logGeneration } = useGenerationLog();
  const [inputMode, setInputMode] = useState<'image' | 'text'>(() => {
    return initialConcept && initialConcept.trim() ? 'text' : 'image';
  });
  const [imageFile, setImageFile] = useState<File | null>(() => initialReferenceImage || null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(() => {
    return initialReferenceImage ? URL.createObjectURL(initialReferenceImage) : null;
  });
  const [textInput, setTextInput] = useState<string>(() => initialConcept?.trim() || '');
  const [negativeTextInput, setNegativeTextInput] = useState<string>(() => initialNegativePrompt?.trim() || '');
  const [isDragging, setIsDragging] = useState(false);

  // Configuration options
  const [targetGenerator, setTargetGenerator] = useState<string>('nanobananapro');
  const [photoStyle, setPhotoStyle] = useState<string>('commercial');
  const [aspectRatio, setAspectRatio] = useState<string>('--ar 16:9');

  // State for generation
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generatedPrompt, setGeneratedPrompt] = useState<string | null>(null);
  const [activeModelUsed, setActiveModelUsed] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isAnalysisOpen, setIsAnalysisOpen] = useState<boolean>(false);

  // Copy state trackers
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.type.startsWith('image/')) {
      handleFileSelection(droppedFile);
    } else {
      setError('Mohon unggah file gambar yang valid (JPG, PNG, WEBP).');
    }
  };

  const handleFileInput = (e: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (!selectedFile.type.startsWith('image/')) {
        setError('Mohon unggah file gambar yang valid (JPG, PNG, WEBP).');
        return;
      }
      handleFileSelection(selectedFile);
    }
  };

  const handleFileSelection = (file: File) => {
    setError(null);
    setGeneratedPrompt(null);
    
    if (file.size > 20 * 1024 * 1024) {
      setError('Ukuran file gambar terlalu besar (maksimal 20MB). Gunakan gambar dengan resolusi lebih rendah.');
      return;
    }
    
    setImageFile(file);
    const url = URL.createObjectURL(file);
    setImagePreviewUrl(url);
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result.split(',')[1]);
        } else {
          reject(new Error('Gagal mengonversi file gambar'));
        }
      };
      reader.onerror = error => reject(error);
    });
  };

  const handleGeneratePhotoPrompt = async () => {
    setIsGenerating(true);
    setError(null);
    const startTime = Date.now();
    const activeId = `gen_photo_${Date.now()}`;

    const titleName = inputMode === 'image' ? (imageFile?.name || 'Foto Referensi') : (textInput.slice(0, 40) + '...');
    reportActiveGenerationStatus(activeId, 'generating', `Prompt Foto (${targetGenerator})`);

    try {
      let mimeType = 'text/plain';
      let base64Data = '';

      let referenceImageBase64: string | undefined = undefined;
      let referenceImageMimeType: string | undefined = undefined;

      if (inputMode === 'image') {
        if (!imageFile) {
          setError('Silakan unggah foto referensi terlebih dahulu.');
          setIsGenerating(false);
          reportActiveGenerationStatus(activeId, 'completed');
          return;
        }
        mimeType = imageFile.type;
        base64Data = await fileToBase64(imageFile);
      } else {
        if (!textInput.trim()) {
          setError('Silakan ketik deskripsi atau konsep foto yang ingin dibuat.');
          setIsGenerating(false);
          reportActiveGenerationStatus(activeId, 'completed');
          return;
        }
        mimeType = 'text/plain';
        base64Data = btoa(unescape(encodeURIComponent(textInput)));
        
        // Use the imageFile as a reference image if it exists when in text mode
        if (imageFile) {
          referenceImageBase64 = await fileToBase64(imageFile);
          referenceImageMimeType = imageFile.type;
        }
      }

      const response = await fetch('/api/generate-photo-prompt', {
        method: 'POST',
        headers: getAntiLimitHeaders(),
        body: JSON.stringify({
          mimeType,
          base64Data,
          targetGenerator,
          photoStyle,
          aspectRatio,
          negativePrompt: negativeTextInput,
          referenceImageBase64,
          referenceImageMimeType,
        }),
      });

      const data = await safeParseJson(response);

      if (!response.ok || data.error) {
        throw new Error(data.error || 'Terjadi kesalahan saat membuat prompt foto.');
      }

      if (!data.prompt) {
        throw new Error('Hasil prompt foto kosong. Silakan coba lagi.');
      }

      setGeneratedPrompt(data.prompt);
      setActiveModelUsed(data.modelUsed || 'Gemini Auto-Cascade');

      reportActiveGenerationStatus(activeId, 'completed');

      // Log generation to tracking pipeline
      logGeneration({
        tool: 'prompt_foto',
        productName: titleName,
        caption: data.prompt,
        topic: titleName,
        toneOfVoice: photoStyle,
        modelUsed: data.modelUsed || 'Gemini Auto-Cascade',
        latencyMs: Date.now() - startTime,
        outcome: 'success',
      });

      // Track photo prompt generated in learning sync
      learningSync.track('photo_prompt_generated', {
        inputMode,
        targetGenerator,
        photoStyle,
        aspectRatio,
        title: inputMode === 'image' ? imageFile?.name : textInput.slice(0, 30),
      });

      // Auto save to local history
      saveHistoryItem({
        category: 'photo_prompt',
        title: `Prompt Foto: ${titleName}`,
        subtitle: `${targetGenerator.toUpperCase()} • ${photoStyle.toUpperCase()} • ${aspectRatio}`,
        data: {
          prompt: data.prompt,
          modelUsed: data.modelUsed || 'Gemini Auto-Cascade',
          targetGenerator,
          photoStyle,
          aspectRatio,
          sourceText: inputMode === 'text' ? textInput : undefined,
          fileName: inputMode === 'image' ? imageFile?.name : undefined,
        },
      });
    } catch (err: any) {
      console.error(err);
      const errMsg = err.message || 'Terjadi kesalahan saat membuat prompt foto.';
      setError(errMsg);
      reportActiveGenerationStatus(activeId, 'completed');
      logGeneration({
        tool: 'prompt_foto',
        productName: titleName,
        topic: titleName,
        toneOfVoice: photoStyle,
        latencyMs: Date.now() - startTime,
        outcome: 'error',
        errorMessage: errMsg,
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const resetImage = () => {
    setImageFile(null);
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    setImagePreviewUrl(null);
    setGeneratedPrompt(null);
    setError(null);
  };

  const handleCopyOnlyPrompt = (promptText: string, sectionKey: string) => {
    if (!promptText) return;
    const cleaned = cleanPromptText(promptText);

    navigator.clipboard.writeText(cleaned);
    setCopiedSection(sectionKey);

    learningSync.track('prompt_copied', {
      type: 'photo_prompt',
      label: sectionKey,
      text: cleaned,
    });

    setTimeout(() => setCopiedSection(null), 2000);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header Banner */}
      <div className="p-5 sm:p-6 rounded-2xl bg-white border border-slate-200/80 shadow-sm relative overflow-hidden">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-[#5b50e5] shadow-2xs">
              <Camera className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2 flex-wrap">
                Tools Generator Prompt Foto AI
                <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 text-[#5b50e5] border border-indigo-200 text-xs font-semibold flex items-center gap-1">
                  <span>🎬 TikTok Hook & 🌐 Google AEO</span>
                </span>
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Unggah foto referensi atau deskripsi konsep untuk menghasilkan prompt foto sinematik presisi tinggi dengan pemahaman scene dan entitas mendalam.
              </p>
            </div>
          </div>

          {/* Mode Selector Tabs */}
          <div className="flex items-center p-1 bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold self-stretch md:self-auto justify-center">
            <button
              type="button"
              onClick={() => { setInputMode('image'); setGeneratedPrompt(null); setError(null); }}
              className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 cursor-pointer ${
                inputMode === 'image'
                  ? 'bg-[#5b50e5] text-white font-bold shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ImageIcon className="w-4 h-4" />
              <span>Dari Foto Referensi</span>
            </button>
            <button
              type="button"
              onClick={() => { setInputMode('text'); setGeneratedPrompt(null); setError(null); }}
              className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 cursor-pointer ${
                inputMode === 'text'
                  ? 'bg-[#5b50e5] text-white font-bold shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Dari Konsep Teks</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Form & Configuration Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Input Area & Controls */}
        <div className="lg:col-span-2 space-y-5 rounded-2xl bg-white border border-slate-200/80 p-5 sm:p-6 shadow-sm">
          {inputMode === 'image' ? (
            /* Image Upload Area */
            <div className="space-y-4">
              {!imagePreviewUrl ? (
                <div
                  className={`relative group rounded-2xl border-2 border-dashed transition-all duration-300 ease-out bg-slate-50 p-8 text-center cursor-pointer ${
                    isDragging ? 'border-[#5b50e5] bg-indigo-50/50' : 'border-slate-200 hover:border-[#5b50e5] hover:bg-slate-100/80'
                  }`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-[#5b50e5] group-hover:scale-105 transition-transform">
                    <ImageIcon className="w-7 h-7" />
                  </div>
                  <h3 className="text-base font-bold text-slate-900 mb-1">Unggah Foto / Gambar Referensi</h3>
                  <p className="text-xs text-slate-500 mb-4">
                    Tarik & lepas foto di sini (JPG, PNG, WEBP), atau klik untuk memilih file dari galeri.
                  </p>
                  <button type="button" className="px-5 py-2 rounded-xl bg-[#5b50e5] hover:bg-[#4f46e5] text-white font-semibold text-xs transition-all shadow-2xs cursor-pointer">
                    Pilih Berkas Foto
                  </button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileInput}
                    accept="image/*"
                    className="hidden"
                  />
                </div>
              ) : (
                /* Image Preview Row */
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 flex flex-col sm:flex-row items-center gap-4">
                  <div className="relative w-32 h-32 rounded-xl overflow-hidden bg-slate-900 border border-slate-200 shrink-0">
                    <SafeImage src={imagePreviewUrl} alt="Preview" fill className="w-full h-full object-cover" />
                  </div>
                  <div className="space-y-2 flex-1 text-center sm:text-left">
                    <div className="flex items-center gap-2 justify-center sm:justify-start">
                      <ImageIcon className="w-4 h-4 text-[#5b50e5]" />
                      <h4 className="text-xs font-bold text-slate-900 truncate max-w-[200px] sm:max-w-[300px]">{imageFile?.name}</h4>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Ukuran: {((imageFile?.size || 0) / (1024 * 1024)).toFixed(2)} MB • Tipe: {imageFile?.type}
                    </p>
                    <button
                      type="button"
                      onClick={resetImage}
                      className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 transition-colors text-xs font-medium inline-flex items-center gap-1.5 border border-slate-200 cursor-pointer shadow-2xs"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Ganti Foto</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Text Concept Input */
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-[#5b50e5]" /> Konsep / Deskripsi Ide Foto
                </label>
                <textarea
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder="Ketik deskripsi ide foto secara bebas (contoh: 'Model pria mengenakan kemeja linen putih santai di pantai Bali saat matahari terbenam...')"
                  rows={4}
                  className="w-full p-4 rounded-xl bg-white border border-slate-200 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#5b50e5] focus:ring-2 focus:ring-[#5b50e5]/20 leading-relaxed"
                />
              </div>
              {imagePreviewUrl && (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 relative rounded-lg overflow-hidden border border-slate-300">
                      <SafeImage src={imagePreviewUrl} alt="Reference" fill className="object-cover" />
                    </div>
                    <div className="text-xs">
                      <p className="font-bold text-slate-900">Reference Image Terlampir</p>
                      <p className="text-slate-500">Akan digunakan sebagai Identity Anchor</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={resetImage}
                    className="text-xs text-rose-600 hover:text-rose-700 font-semibold px-2 py-1 rounded hover:bg-rose-50"
                  >
                    Hapus
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Negative Prompt (Always Visible) */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 text-rose-500" /> Negative Prompt (Opsional)
            </label>
            <input
              type="text"
              value={negativeTextInput}
              onChange={(e) => setNegativeTextInput(e.target.value)}
              placeholder="Contoh: low quality, blurry, disfigured, text, watermark..."
              className="w-full p-3 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#5b50e5] focus:ring-2 focus:ring-[#5b50e5]/20"
            />
          </div>

          {/* Style & Aspect Ratio Settings */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-100">
            {/* Style Preset */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Wand2 className="w-3.5 h-3.5 text-purple-600" /> Preset Gaya Visual Foto
              </label>
              <select
                value={photoStyle}
                onChange={(e) => setPhotoStyle(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-[#5b50e5] font-medium cursor-pointer"
              >
                <option value="commercial">Commercial E-Commerce (Bersih & Profesional)</option>
                <option value="portrait">Studio Portrait (Hasselblad / Leica 85mm)</option>
                <option value="cinematic">Cinematic Realism (Nuansa Film 35mm)</option>
                <option value="product">Product Photography (Macro Details)</option>
                <option value="architectural">Architectural & Interior Design</option>
                <option value="fashion">Fashion & High-End Editorial</option>
                <option value="anime">Anime / Aesthetic Illustration</option>
                <option value="3d">3D Octane / Unreal Engine Render</option>
              </select>
            </div>

            {/* Target Aspect Ratio */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-[#5b50e5]" /> Rasio Foto (Aspect Ratio)
              </label>
              <div className="grid grid-cols-5 gap-1 p-1 bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold">
                {[
                  { id: '--ar 16:9', label: '16:9' },
                  { id: '--ar 9:16', label: '9:16' },
                  { id: '--ar 1:1', label: '1:1' },
                  { id: '--ar 4:5', label: '4:5' },
                  { id: '--ar 21:9', label: '21:9' },
                ].map((ar) => (
                  <button
                    type="button"
                    key={ar.id}
                    onClick={() => setAspectRatio(ar.id)}
                    className={`py-1.5 rounded-lg text-center transition-all cursor-pointer ${
                      aspectRatio === ar.id
                        ? 'bg-[#5b50e5] text-white font-bold shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {ar.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Action Generate Button */}
          <button
            type="button"
            onClick={handleGeneratePhotoPrompt}
            disabled={isGenerating || (inputMode === 'image' ? !imageFile : !textInput.trim())}
            className="w-full py-3.5 px-6 rounded-xl bg-[#5b50e5] hover:bg-[#4f46e5] disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold flex items-center justify-center gap-2.5 transition-all shadow-md shadow-[#5b50e5]/20 cursor-pointer"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Menganalisis & Membuat Prompt Foto Sinematik...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5 text-amber-300" />
                <span>Hasilkan Prompt Foto Siap Salin</span>
              </>
            )}
          </button>
        </div>

        {/* Right Col: Target Generator */}
        <div className="space-y-4">
          <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Wand2 className="w-4 h-4 text-purple-600" /> Target AI Image Generator
            </h3>

            <div className="p-3.5 rounded-xl bg-indigo-50/80 border border-[#5b50e5] text-slate-900 shadow-2xs space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <span>🎬 TikTok Hook & 🌐 Google AEO</span>
                </div>
                <span className="px-2 py-0.5 rounded-md bg-[#5b50e5] text-white text-[10px] font-bold shrink-0">
                  Aktif
                </span>
              </div>
              <div className="text-[10px] text-slate-600 leading-relaxed">
                Prompt fotorealistik presisi tinggi yang dioptimalkan untuk retensi 3 detik FYP TikTok dan pemahaman semantik entitas Google Search / Lens AEO.
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 space-y-1.5 text-[11px] text-slate-500">
              <p className="font-semibold text-slate-700">Kompatibilitas Penuh:</p>
              <ul className="space-y-1 text-[10px] text-slate-500">
                <li className="flex items-center gap-1.5">✓ Midjourney v6.1 & Raw Style</li>
                <li className="flex items-center gap-1.5">✓ Flux.1 Dev & Schnell Engine</li>
                <li className="flex items-center gap-1.5">✓ Ideogram v2 & DALL-E 3</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-3 text-rose-800 text-xs sm:text-sm"
        >
          <AlertCircle className="w-5 h-5 shrink-0 text-rose-600 mt-0.5" />
          <p>{error}</p>
        </motion.div>
      )}

      {/* Generated Results Output */}
      {generatedPrompt && (() => {
        const parsed = parsePhotoPromptOutput(generatedPrompt);
        const heroPrompt = cleanPromptText(parsed.nanobananapro || generatedPrompt);

        return (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
          >
            {/* HERO CARD: PROMPT UTAMA (TIKTOK OPTIMIZED) */}
            <div className="rounded-2xl bg-slate-900 text-white border border-slate-800 p-5 sm:p-6 shadow-xl relative overflow-hidden space-y-4">
              {/* Ambient Glow */}
              <div className="absolute -top-24 -right-24 w-60 h-60 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 relative z-10 pb-3 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-600/30 border border-indigo-400/30 flex items-center justify-center text-xl shrink-0 shadow-inner">
                    🎬
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-bold text-indigo-300 uppercase tracking-widest bg-indigo-500/20 px-2 py-0.5 rounded border border-indigo-500/30">
                        Target Utama AI
                      </span>
                      <span className="text-xs text-slate-400 font-mono">
                        Midjourney v6 / Flux / DALL-E 3
                      </span>
                    </div>
                    <h3 className="text-base sm:text-lg font-bold text-white mt-0.5">
                      📸 TikTok & Google AEO Master Prompt
                    </h3>
                  </div>
                </div>

                {activeModelUsed && (
                  <span className="px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-[11px] font-medium text-slate-300 flex items-center gap-1.5 self-start sm:self-auto">
                    <Cpu className="w-3.5 h-3.5 text-indigo-400" />
                    <span>{activeModelUsed}</span>
                  </span>
                )}
              </div>

              {/* Main Prompt Text Container */}
              <div className="relative group">
                <div className="p-4 sm:p-5 rounded-xl bg-black/50 border border-white/10 font-mono text-xs sm:text-sm text-indigo-100 leading-relaxed whitespace-pre-wrap max-h-80 overflow-y-auto selection:bg-indigo-500 selection:text-white">
                  {heroPrompt}
                </div>
              </div>

              {/* Hero Action Button: Copy Prompt Only */}
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
                <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>Format presisi tinggi untuk Midjourney v6.1 / Flux.1 / DALL-E 3</span>
                </p>

                <button
                  type="button"
                  onClick={() => handleCopyOnlyPrompt(heroPrompt, 'hero_nanobananapro')}
                  className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-[#5b50e5] to-indigo-600 hover:from-[#4f46e5] hover:to-indigo-700 text-white font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-2.5 shadow-lg shadow-indigo-500/25 cursor-pointer"
                >
                  {copiedSection === 'hero_nanobananapro' ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-300" />
                      <span>Prompt Utama Tersalin!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>📋 Salin Master Prompt</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* ACCORDION COLLAPSIBLE: ANALISIS ESTETIKA & RELEVANSI TIKTOK & GOOGLE AEO */}
            {parsed.analysis && (
              <div className="rounded-2xl bg-white border border-slate-200/80 overflow-hidden shadow-sm transition-all">
                <button
                  type="button"
                  onClick={() => setIsAnalysisOpen(!isAnalysisOpen)}
                  className="w-full px-5 py-4 bg-slate-50 hover:bg-slate-100/80 transition-colors flex items-center justify-between text-left cursor-pointer border-b border-slate-200/60"
                >
                  <div className="flex items-center gap-2.5">
                    <FileText className="w-4 h-4 text-[#5b50e5]" />
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Analisis Relevansi Scene & Algoritma (TikTok FYP & Google AEO)
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-[#5b50e5] text-[10px] font-semibold border border-indigo-100">
                      Laporan Algoritma
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-500 text-xs font-semibold">
                    <span>{isAnalysisOpen ? 'Tutup Analisis' : 'Buka Analisis'}</span>
                    {isAnalysisOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </button>

                {isAnalysisOpen && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    transition={{ duration: 0.2 }}
                    className="p-5 sm:p-6 bg-white text-slate-800 text-xs sm:text-sm leading-relaxed markdown-body border-t border-slate-100"
                  >
                    <Markdown>{parsed.analysis}</Markdown>
                  </motion.div>
                )}
              </div>
            )}
          </motion.div>
        );
      })()}
    </div>
  );
}
