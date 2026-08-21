'use client';

import React, { useState, useRef, useEffect, useCallback, ChangeEvent, DragEvent } from 'react';
import {
  Scissors,
  Upload,
  Link as LinkIcon,
  Play,
  Pause,
  Camera,
  Layers,
  Download,
  Trash2,
  CheckSquare,
  Square,
  AlertTriangle,
  FileVideo,
  Clock,
  Sparkles,
  Loader2,
  X,
  Maximize2,
  Info,
  ChevronLeft,
  ChevronRight,
  Filter,
  ArrowUpDown,
  Grid,
  List,
  Check,
  RefreshCw,
  Zap,
  HardDrive,
  Clipboard as ClipboardIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import JSZip from 'jszip';
import { saveHistoryItem } from '../../lib/history';
import { learningSync } from '../../lib/learningSync';
import { safeParseJson } from '../../lib/apiHelper';
import { useGenerationLog } from '../../hooks/useGenerationLog';
import { reportActiveGenerationStatus } from '../../events/generationEvent';
import { SafeImage } from '../common/SafeImage';

export interface ExtractedFrame {
  id: string;
  dataUrl: string;
  timestamp: number; // seconds
  timestampFormatted: string; // "00:03.42"
  type: 'manual' | 'automatic';
  width: number;
  height: number;
  fileSizeApproxKB: number;
  createdAt: number;
}

interface VideoFrameExtractorToolProps {
  initialVideoFile?: File | null;
  initialFile?: File | null;
  onSendToPromptTool?: (file: File) => void;
}

export default function VideoFrameExtractorTool({
  initialVideoFile,
  initialFile,
  onSendToPromptTool,
}: VideoFrameExtractorToolProps) {
  const { logGeneration } = useGenerationLog();
  const activeInitialFile = initialVideoFile || initialFile;
  // --- STATE: Video Source ---
  const [sourceMethod, setSourceMethod] = useState<'upload' | 'link'>('upload');
  const [videoFile, setVideoFile] = useState<File | null>(() => activeInitialFile || null);
  const [tiktokUrl, setTiktokUrl] = useState<string>('');
  const [videoObjectUrl, setVideoObjectUrl] = useState<string | null>(() => {
    return activeInitialFile ? URL.createObjectURL(activeInitialFile) : null;
  });
  const [videoName, setVideoName] = useState<string>(() => activeInitialFile?.name || '');
  const [videoDuration, setVideoDuration] = useState<number>(0);
  const [videoDimensions, setVideoDimensions] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [isFetchingLink, setIsFetchingLink] = useState<boolean>(false);
  const [inputError, setInputError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  // --- STATE: Video Player & Manual Capture ---
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [playbackRate, setPlaybackRate] = useState<number>(1.0);
  const [capturedFlash, setCapturedFlash] = useState<boolean>(false);

  // --- STATE: Automatic Extraction Config ---
  const [extractionMode, setExtractionMode] = useState<'interval' | 'fps'>('interval');
  const [intervalValue, setIntervalValue] = useState<number>(1); // Default every 1 second
  const [fpsValue, setFpsValue] = useState<number>(1); // Default 1 FPS (1 frame per second)
  const [customInterval, setCustomInterval] = useState<string>('1');

  // --- STATE: Extraction Process Lifecycle ---
  const [isExtracting, setIsExtracting] = useState<boolean>(false);
  const [extractionProgress, setExtractionProgress] = useState<{ current: number; total: number }>({ current: 0, total: 0 });
  const abortExtractRef = useRef<boolean>(false);

  // --- STATE: Frame Gallery ---
  const [frames, setFrames] = useState<ExtractedFrame[]>([]);
  const [selectedFrameIds, setSelectedFrameIds] = useState<Set<string>>(new Set());
  const [galleryFilter, setGalleryFilter] = useState<'all' | 'manual' | 'automatic'>('all');
  const [gallerySort, setGallerySort] = useState<'asc' | 'desc'>('asc');
  const [galleryDensity, setGalleryDensity] = useState<'compact' | 'normal' | 'list'>('normal');
  const [previewFrame, setPreviewFrame] = useState<ExtractedFrame | null>(null);
  const [isZipping, setIsZipping] = useState<boolean>(false);

  // Load initial video file if passed as prop
  // --- HELPER: Format Time (00:03.42) ---
  const formatTimestamp = (seconds: number): string => {
    if (isNaN(seconds) || seconds < 0) return '00:00.00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    const mm = String(mins).padStart(2, '0');
    const ss = String(secs).padStart(2, '0');
    const msm = String(ms).padStart(2, '0');
    return `${mm}:${ss}.${msm}`;
  };

  // --- HANDLE: Local Video File Select ---
  const handleVideoFileSelect = useCallback((file: File) => {
    setInputError(null);
    if (!file.type.startsWith('video/')) {
      setInputError('Mohon unggah file video yang valid (MP4, WEBM, MOV).');
      return;
    }

    if (videoObjectUrl && videoObjectUrl.startsWith('blob:')) {
      URL.revokeObjectURL(videoObjectUrl);
    }

    const url = URL.createObjectURL(file);
    setVideoFile(file);
    setVideoName(file.name);
    setVideoObjectUrl(url);
    setCurrentTime(0);
    setIsPlaying(false);

    learningSync.track('formula_injected', { action: 'video_uploaded_for_extraction', fileName: file.name });
  }, [videoObjectUrl]);

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      if (videoObjectUrl && videoObjectUrl.startsWith('blob:')) {
        URL.revokeObjectURL(videoObjectUrl);
      }
    };
  }, [videoObjectUrl]);

  // Sync playback rate when changed
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  // --- HANDLE: Drag & Drop ---
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
    if (droppedFile) {
      handleVideoFileSelect(droppedFile);
    }
  };

  // --- HANDLE: TikTok / Link Import ---
  const handleFetchLink = async (overrideUrl?: string) => {
    const rawInput = (overrideUrl || tiktokUrl).trim();
    if (!rawInput) {
      setInputError('Masukkan tautan video TikTok atau URL video langsung.');
      return;
    }

    // Extract clean URL from text if user pasted share text containing URL
    let targetUrl = rawInput;
    const urlMatch = rawInput.match(/https?:\/\/[^\s]+/i);
    if (urlMatch) {
      targetUrl = urlMatch[0].replace(/[)\]}>,;."']+$/, '');
    }

    setIsFetchingLink(true);
    setInputError(null);

    try {
      if (targetUrl.includes('tiktok.com') || targetUrl.includes('douyin.com')) {
        const res = await fetch('/api/tiktok/info', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: targetUrl }),
        });

        const data = await safeParseJson(res);
        if (data.error && !data.hdplay && !data.play) {
          throw new Error(data.error || 'Gagal memproses video TikTok.');
        }

        const playUrl = data.hdplay || data.play || data.wmplay;
        if (!playUrl) throw new Error('URL stream video TikTok tidak ditemukan.');

        const safeTitle = (data.title || 'TikTok Video').replace(/[^a-zA-Z0-9 ]/g, ' ').trim() || 'TikTok Video';
        const displayTitle = `TikTok: ${safeTitle.slice(0, 32)}...`;

        // Pre-fetch blob via proxy for instant lag-free local seeking in canvas
        const proxiedUrl = `/api/tiktok/proxy?url=${encodeURIComponent(playUrl)}`;
        try {
          const videoRes = await fetch(proxiedUrl);
          if (videoRes.ok) {
            const blob = await videoRes.blob();
            const localBlobUrl = URL.createObjectURL(blob);
            const downloadedFile = new File([blob], `${safeTitle.replace(/\s+/g, '_').slice(0, 30)}.mp4`, { type: 'video/mp4' });
            setVideoFile(downloadedFile);
            setVideoName(displayTitle);
            setVideoObjectUrl(localBlobUrl);
            setCurrentTime(0);
            setIsPlaying(false);
            learningSync.track('link_pasted', { url: targetUrl, title: safeTitle });
            return;
          }
        } catch (fetchBlobErr) {
          console.warn('Fallback to direct proxied stream URL:', fetchBlobErr);
        }

        // Fallback to streaming proxy URL if blob creation failed
        setVideoFile(null);
        setVideoName(displayTitle);
        setVideoObjectUrl(proxiedUrl);
        setCurrentTime(0);
        setIsPlaying(false);
      } else {
        // Direct video link
        const proxiedUrl = `/api/tiktok/proxy?url=${encodeURIComponent(targetUrl)}`;
        setVideoFile(null);
        setVideoName('Video Tautan Web');
        setVideoObjectUrl(proxiedUrl);
        setCurrentTime(0);
        setIsPlaying(false);
      }
      learningSync.track('link_pasted', { url: targetUrl });
    } catch (err: any) {
      console.error(err);
      setInputError(err.message || 'Gagal memuat video dari tautan. Pastikan link valid dan dapat diakses.');
    } finally {
      setIsFetchingLink(false);
    }
  };

  const handlePasteClipboardUrl = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setSourceMethod('link');
        setTiktokUrl(text);
        setInputError(null);
        if (text.includes('tiktok.com')) {
          handleFetchLink(text);
        }
      }
    } catch (e) {
      setInputError('Gagal mengakses clipboard otomatis. Silakan tempel secara manual dengan Ctrl+V.');
    }
  };

  // --- HANDLE: Video Metadata Loaded ---
  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setVideoDuration(videoRef.current.duration || 0);
      setVideoDimensions({
        width: videoRef.current.videoWidth || 1920,
        height: videoRef.current.videoHeight || 1080,
      });
    }
  };

  // --- CONTROL: Frame Navigation Controls ---
  const stepTime = (deltaSeconds: number) => {
    if (!videoRef.current) return;
    const newTime = Math.max(0, Math.min(videoDuration, videoRef.current.currentTime + deltaSeconds));
    videoRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const stepFrame = (frameCount: number) => {
    // Standard ~30fps frame duration = ~0.0333s
    const frameDuration = 1 / 30;
    stepTime(frameCount * frameDuration);
  };

  // --- HANDLE: Manual Frame Capture ---
  const captureCurrentFrame = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;

    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, width, height);

    try {
      const dataUrl = canvas.toDataURL('image/png');
      const timeSec = video.currentTime;
      const formatted = formatTimestamp(timeSec);

      // Estimate PNG base64 size in KB
      const sizeKB = Math.round((dataUrl.length * (3 / 4)) / 1024);

      const newFrame: ExtractedFrame = {
        id: `frame_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        dataUrl,
        timestamp: timeSec,
        timestampFormatted: formatted,
        type: 'manual',
        width,
        height,
        fileSizeApproxKB: sizeKB,
        createdAt: Date.now(),
      };

      setFrames(prev => [newFrame, ...prev]);

      // Trigger flash visual feedback
      setCapturedFlash(true);
      setTimeout(() => setCapturedFlash(false), 200);

      // Save history summary
      saveHistoryItem({
        category: 'frame_extraction',
        title: `Frame Manual: ${videoName}`,
        subtitle: `Timestamp ${formatted} • ${width}x${height}px`,
        data: {
          frameCount: 1,
          extractionMode: 'manual',
          videoName,
        },
      });
    } catch (e) {
      console.error('Failed to capture canvas frame:', e);
      setInputError('Gagal mengambil frame. Pastikan video dimuat sepenuhnya tanpa batasan CORS.');
    }
  };

  // --- CALCULATION: Estimate Total Frames & Download Size ---
  const calculateEstimates = () => {
    if (!videoDuration || videoDuration <= 0) {
      return { totalFrames: 0, estimatedMB: 0 };
    }

    let frameCount = 0;
    if (extractionMode === 'interval') {
      const step = Math.max(0.1, intervalValue);
      frameCount = Math.floor(videoDuration / step) + 1;
    } else {
      const fps = Math.max(0.1, fpsValue);
      frameCount = Math.floor(videoDuration * fps);
    }

    // Estimate ~200KB per 1080p frame PNG
    const approxKBPerFrame = videoDimensions.width > 1280 ? 250 : 150;
    const totalMB = Math.round((frameCount * approxKBPerFrame) / 1024);

    return { totalFrames: frameCount, estimatedMB: totalMB };
  };

  const estimates = calculateEstimates();

  // --- HANDLE: Automatic Sequential Frame Extraction ---
  const startBatchExtraction = async () => {
    if (!videoRef.current || !canvasRef.current || !videoObjectUrl) return;

    const { totalFrames } = calculateEstimates();
    if (totalFrames <= 0) return;

    setIsExtracting(true);
    setExtractionProgress({ current: 0, total: totalFrames });
    abortExtractRef.current = false;

    const startTime = Date.now();
    const activeId = `gen_frames_${Date.now()}`;
    reportActiveGenerationStatus(activeId, 'generating', `Ekstraksi Frame (${videoName || 'Video'})`);

    // Pause player during batch extraction
    if (videoRef.current) videoRef.current.pause();
    setIsPlaying(false);

    // Create a dedicated offscreen video element for clean sequential extraction
    const offVideo = document.createElement('video');
    offVideo.crossOrigin = 'anonymous';
    offVideo.muted = true;
    offVideo.playsInline = true;
    offVideo.src = videoObjectUrl;

    await new Promise((resolve) => {
      offVideo.onloadeddata = resolve;
      offVideo.onerror = resolve;
    });

    const canvas = canvasRef.current;
    const width = offVideo.videoWidth || videoDimensions.width || 1280;
    const height = offVideo.videoHeight || videoDimensions.height || 720;
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    const newFrames: ExtractedFrame[] = [];

    // Calculate timestamps array
    const timestamps: number[] = [];
    if (extractionMode === 'interval') {
      const step = Math.max(0.1, intervalValue);
      for (let t = 0; t <= videoDuration; t += step) {
        timestamps.push(t);
      }
    } else {
      const step = 1 / Math.max(0.1, fpsValue);
      for (let t = 0; t < videoDuration; t += step) {
        timestamps.push(t);
      }
    }

    setExtractionProgress({ current: 0, total: timestamps.length });

    for (let i = 0; i < timestamps.length; i++) {
      if (abortExtractRef.current) {
        console.log('Extraction process aborted by user.');
        break;
      }

      const targetTime = Math.min(videoDuration, timestamps[i]);

      // Seek offscreen video
      offVideo.currentTime = targetTime;

      // Wait for seeked event
      await new Promise((resolve) => {
        const handleSeeked = () => {
          offVideo.removeEventListener('seeked', handleSeeked);
          resolve(true);
        };
        offVideo.addEventListener('seeked', handleSeeked);
        // Timeout safety
        setTimeout(handleSeeked, 300);
      });

      if (ctx) {
        ctx.drawImage(offVideo, 0, 0, width, height);
        try {
          const dataUrl = canvas.toDataURL('image/png');
          const formatted = formatTimestamp(targetTime);
          const sizeKB = Math.round((dataUrl.length * (3 / 4)) / 1024);

          newFrames.push({
            id: `frame_auto_${Date.now()}_${i}`,
            dataUrl,
            timestamp: targetTime,
            timestampFormatted: formatted,
            type: 'automatic',
            width,
            height,
            fileSizeApproxKB: sizeKB,
            createdAt: Date.now(),
          });
        } catch (e) {
          console.error('Canvas capture failed at time:', targetTime, e);
        }
      }

      setExtractionProgress({ current: i + 1, total: timestamps.length });
    }

    // Append new frames to gallery
    setFrames(prev => [...newFrames, ...prev]);
    setIsExtracting(false);

    reportActiveGenerationStatus(activeId, 'completed');

    logGeneration({
      tool: 'ekstraktor_frame',
      productName: videoName || 'Ekstraksi Video Frame',
      topic: videoName,
      durationRequested: Math.round(videoDuration),
      latencyMs: Date.now() - startTime,
      outcome: 'success',
    });

    // Clean up offscreen video
    offVideo.src = '';

    // Save history
    if (newFrames.length > 0) {
      saveHistoryItem({
        category: 'frame_extraction',
        title: `Ekstraksi Otomatis: ${videoName}`,
        subtitle: `${newFrames.length} Frame • ${extractionMode === 'interval' ? `Tiap ${intervalValue}s` : `${fpsValue} FPS`}`,
        data: {
          frameCount: newFrames.length,
          extractionMode,
          videoName,
        },
      });
    }
  };

  const cancelExtraction = () => {
    abortExtractRef.current = true;
    setIsExtracting(false);
  };

  // --- GALLERY SELECTION & ACTIONS ---
  const toggleSelectFrame = (id: string) => {
    setSelectedFrameIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllFrames = () => {
    const allIds = filteredFrames.map(f => f.id);
    setSelectedFrameIds(new Set(allIds));
  };

  const clearSelection = () => {
    setSelectedFrameIds(new Set());
  };

  const deleteSelectedFrames = () => {
    if (selectedFrameIds.size === 0) return;
    setFrames(prev => prev.filter(f => !selectedFrameIds.has(f.id)));
    setSelectedFrameIds(new Set());
  };

  const deleteSingleFrame = (id: string) => {
    setFrames(prev => prev.filter(f => f.id !== id));
    setSelectedFrameIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const downloadSingleFrame = (frame: ExtractedFrame) => {
    const a = document.createElement('a');
    a.href = frame.dataUrl;
    const cleanTime = frame.timestampFormatted.replace(/[:.]/g, '_');
    a.download = `frame_${cleanTime}_${frame.type}.png`;
    a.click();
  };

  const downloadFramesZip = async (targetFrames: ExtractedFrame[]) => {
    if (targetFrames.length === 0) return;
    setIsZipping(true);

    try {
      const zip = new JSZip();
      const folder = zip.folder('extracted_video_frames');

      targetFrames.forEach((frame, idx) => {
        const base64Data = frame.dataUrl.split(',')[1];
        const cleanTime = frame.timestampFormatted.replace(/[:.]/g, '_');
        const filename = `frame_${String(idx + 1).padStart(4, '0')}_${cleanTime}_${frame.type}.png`;
        folder?.file(filename, base64Data, { base64: true });
      });

      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = `galeri_frame_${videoName ? videoName.replace(/[^a-zA-Z0-9]/g, '_') : 'video'}_${Date.now()}.zip`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 3000);
    } catch (e) {
      console.error('Failed to generate ZIP archive:', e);
      setInputError('Gagal membuat paket file ZIP.');
    } finally {
      setIsZipping(false);
    }
  };

  // --- FILTERED & SORTED FRAMES ---
  const filteredFrames = frames
    .filter(f => {
      if (galleryFilter === 'manual') return f.type === 'manual';
      if (galleryFilter === 'automatic') return f.type === 'automatic';
      return true;
    })
    .sort((a, b) => {
      return gallerySort === 'asc' ? a.timestamp - b.timestamp : b.timestamp - a.timestamp;
    });

  return (
    <div className="space-y-8">
      {/* Hidden Canvas for Frame Captures */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Progressive Step Header Bar */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center md:text-left">
          <div className={`p-3 rounded-xl border transition-all ${videoObjectUrl ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-indigo-50 border-indigo-100 text-indigo-900'}`}>
            <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider mb-1">
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${videoObjectUrl ? 'bg-emerald-600 text-white' : 'bg-[#5b50e5] text-white'}`}>1</span>
              <span>Langkah 1: Sumber Video</span>
            </div>
            <p className="text-xs opacity-80">
              {videoObjectUrl ? `Aktif: ${videoName.slice(0, 25)}...` : 'Unggah file video atau tempel link TikTok'}
            </p>
          </div>

          <div className={`p-3 rounded-xl border transition-all ${videoObjectUrl ? 'bg-indigo-50 border-indigo-100 text-indigo-900' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
            <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider mb-1">
              <span className="w-5 h-5 rounded-full bg-indigo-100 text-[#5b50e5] flex items-center justify-center text-[10px] font-bold">2</span>
              <span>Langkah 2: Ekstraksi Frame</span>
            </div>
            <p className="text-xs opacity-80">
              {isExtracting ? `Proses: ${extractionProgress.current}/${extractionProgress.total}` : 'Ambil manual detik aktif atau ekstrak otomatis'}
            </p>
          </div>

          <div className={`p-3 rounded-xl border transition-all ${frames.length > 0 ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
            <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider mb-1">
              <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-[10px] font-bold">3</span>
              <span>Langkah 3: Galeri Frame ({frames.length})</span>
            </div>
            <p className="text-xs opacity-80">
              {frames.length > 0 ? `${frames.length} Frame Siap di-ZIP / Unduh` : 'Galeri masih kosong'}
            </p>
          </div>
        </div>
      </div>

      {/* SECTION 1: Dual Input Source Picker */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-[#5b50e5]">
              <FileVideo className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                Pilih Sumber Video
                {videoObjectUrl && (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-semibold flex items-center gap-1">
                    <Check className="w-3 h-3" /> Video Siap
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-500">Pilih salah satu metode input: Unggah berkas video lokal atau tempel tautan TikTok.</p>
            </div>
          </div>

          {/* Active Source Banner & Switch Button */}
          {videoObjectUrl && (
            <div className="w-full sm:w-auto flex items-center gap-3 bg-emerald-50 border border-emerald-200 px-3.5 py-2 rounded-xl text-xs text-emerald-800">
              <div className="truncate max-w-[200px]">
                <span className="font-bold">Sumber Aktif: </span>
                <span className="text-slate-900">{videoName}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setVideoObjectUrl(null);
                  setVideoFile(null);
                }}
                className="px-2 py-1 bg-emerald-200 hover:bg-emerald-300 text-emerald-900 rounded-lg text-[10px] font-semibold transition-all shrink-0 cursor-pointer"
              >
                Ganti Video
              </button>
            </div>
          )}
        </div>

        {/* Input Methods Tabs */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* METHOD A: Upload Local File */}
          <div className={`p-4 rounded-xl border transition-all ${sourceMethod === 'upload' ? 'bg-indigo-50/50 border-indigo-200 ring-1 ring-indigo-200' : 'bg-slate-50/50 border-slate-200 opacity-80 hover:opacity-100'}`}>
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-bold uppercase tracking-wider text-indigo-900 flex items-center gap-1.5">
                <Upload className="w-4 h-4 text-[#5b50e5]" />
                Metode A: Unggah Berkas Video
              </label>
              {sourceMethod === 'upload' && <span className="text-[10px] bg-indigo-100 text-[#5b50e5] px-2 py-0.5 rounded-full font-bold">Dipilih</span>}
            </div>

            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => setSourceMethod('upload')}
              className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
                isDragging
                  ? 'border-[#5b50e5] bg-indigo-50/80 scale-[0.99]'
                  : 'border-slate-200 hover:border-[#5b50e5] bg-white'
              }`}
            >
              <input
                type="file"
                accept="video/*"
                onChange={(e) => {
                  setSourceMethod('upload');
                  const file = e.target.files?.[0];
                  if (file) handleVideoFileSelect(file);
                }}
                className="hidden"
                id="frame-video-upload"
              />
              <label htmlFor="frame-video-upload" className="cursor-pointer space-y-2 block">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 text-[#5b50e5] flex items-center justify-center mx-auto shadow-2xs">
                  <Upload className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs sm:text-sm font-bold text-slate-800">Klik atau Seret Video ke Sini</p>
                  <p className="text-[11px] text-slate-500">Format MP4, WEBM, MOV, MKV (Tanpa Batas Ukuran)</p>
                </div>
              </label>
            </div>
          </div>

          {/* METHOD B: Paste TikTok / Direct URL */}
          <div className={`p-4 rounded-xl border transition-all ${sourceMethod === 'link' ? 'bg-cyan-50/50 border-cyan-200 ring-1 ring-cyan-200' : 'bg-slate-50/50 border-slate-200 opacity-80 hover:opacity-100'}`}>
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-bold uppercase tracking-wider text-cyan-900 flex items-center gap-1.5">
                <LinkIcon className="w-4 h-4 text-cyan-600" />
                Metode B: Tempel Tautan TikTok / Web
              </label>
              {sourceMethod === 'link' && <span className="text-[10px] bg-cyan-100 text-cyan-800 px-2 py-0.5 rounded-full font-bold">Dipilih</span>}
            </div>

            <div className="space-y-3 bg-white p-4 rounded-xl border border-slate-200">
              <p className="text-xs text-slate-600">Tempel URL video TikTok atau MP4 web untuk diekstrak langsung dari server proxy.</p>
              <div className="flex gap-2">
                <div className="relative flex-1 flex items-center">
                  <input
                    type="text"
                    placeholder="https://vt.tiktok.com/ZS... atau URL MP4"
                    value={tiktokUrl}
                    onChange={(e) => {
                      setSourceMethod('link');
                      setTiktokUrl(e.target.value);
                    }}
                    onFocus={() => setSourceMethod('link')}
                    className="w-full bg-white border border-slate-200 rounded-xl pl-3.5 pr-20 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#5b50e5] focus:ring-2 focus:ring-[#5b50e5]/20"
                  />
                  <button
                    type="button"
                    onClick={handlePasteClipboardUrl}
                    className="absolute right-1.5 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                    title="Tempel dari Clipboard"
                  >
                    <ClipboardIcon className="w-3 h-3" />
                    <span>Tempel</span>
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSourceMethod('link');
                    handleFetchLink();
                  }}
                  disabled={isFetchingLink || !tiktokUrl.trim()}
                  className="px-4 py-2.5 rounded-xl bg-[#5b50e5] hover:bg-[#4f46e5] text-white font-bold text-xs flex items-center gap-2 shadow-2xs disabled:opacity-50 transition-all shrink-0 cursor-pointer"
                >
                  {isFetchingLink ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Memuat...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-3.5 h-3.5" />
                      <span>Muat Video</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Input Error Banner */}
        {inputError && (
          <div className="mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{inputError}</span>
          </div>
        )}
      </div>

      {/* MAIN EXTRACTOR WORKSPACE (When Video Object URL exists) */}
      {videoObjectUrl ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* LEFT COLUMN (7 Cols): Video Player & Precision Manual Extraction */}
          <div className="lg:col-span-7 space-y-6">
            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm relative overflow-hidden">
              {/* Flash overlay feedback on frame capture */}
              <AnimatePresence>
                {capturedFlash && (
                  <motion.div
                    initial={{ opacity: 0.8 }}
                    animate={{ opacity: 0 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-[#5b50e5]/30 z-30 pointer-events-none"
                  />
                )}
              </AnimatePresence>

              {/* Video Player Header Spec Badge */}
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100 text-xs">
                <span className="font-bold text-slate-800 flex items-center gap-1.5">
                  <Play className="w-3.5 h-3.5 text-[#5b50e5]" /> Preview Video
                </span>
                <div className="flex items-center gap-2 text-[11px] text-slate-500">
                  <span className="px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-700 font-mono font-medium">
                    {videoDimensions.width}×{videoDimensions.height}px
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-indigo-50 border border-indigo-100 text-[#5b50e5] font-mono font-bold">
                    {formatTimestamp(videoDuration)}
                  </span>
                </div>
              </div>

              {/* Video Player Container */}
              <div className="relative aspect-video bg-slate-900 rounded-xl overflow-hidden border border-slate-200 shadow-inner group">
                <video
                  ref={videoRef}
                  src={videoObjectUrl}
                  crossOrigin="anonymous"
                  onLoadedMetadata={handleLoadedMetadata}
                  onTimeUpdate={() => {
                    if (videoRef.current) setCurrentTime(videoRef.current.currentTime);
                  }}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  className="w-full h-full object-contain"
                />

                {/* Big Play Overlay Button when paused */}
                {!isPlaying && (
                  <button
                    type="button"
                    onClick={() => videoRef.current?.play()}
                    className="absolute inset-0 m-auto w-14 h-14 rounded-2xl bg-[#5b50e5]/90 hover:bg-[#5b50e5] backdrop-blur-md text-white flex items-center justify-center shadow-xl shadow-[#5b50e5]/30 transition-all scale-95 hover:scale-100 cursor-pointer"
                  >
                    <Play className="w-7 h-7 fill-current ml-0.5" />
                  </button>
                )}
              </div>

              {/* Video Timeline Scrubber */}
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between text-xs font-mono font-bold">
                  <span className="text-[#5b50e5] text-sm">{formatTimestamp(currentTime)}</span>
                  <span className="text-slate-500">{formatTimestamp(videoDuration)}</span>
                </div>

                <input
                  type="range"
                  min="0"
                  max={videoDuration || 100}
                  step="0.01"
                  value={currentTime}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    if (videoRef.current) videoRef.current.currentTime = val;
                    setCurrentTime(val);
                  }}
                  className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-[#5b50e5]"
                />

                {/* Precision Step Buttons (-1s, +1s, -1 frame, +1 frame) */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => stepTime(-1)}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-mono flex items-center gap-1 border border-slate-200 cursor-pointer"
                      title="Mundur 1 detik"
                    >
                      -1s
                    </button>
                    <button
                      type="button"
                      onClick={() => stepFrame(-1)}
                      className="px-2.5 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-[#5b50e5] text-xs font-mono font-bold flex items-center gap-1 border border-indigo-200 cursor-pointer"
                      title="Mundur 1 frame (~33ms)"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" /> -1 Frame
                    </button>
                  </div>

                  {/* Playback Speed Switcher */}
                  <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
                    {[0.5, 1.0, 1.5, 2.0].map((rate) => (
                      <button
                        key={rate}
                        type="button"
                        onClick={() => setPlaybackRate(rate)}
                        className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold transition-all cursor-pointer ${
                          playbackRate === rate ? 'bg-[#5b50e5] text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {rate}x
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => stepFrame(1)}
                      className="px-2.5 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-[#5b50e5] text-xs font-mono font-bold flex items-center gap-1 border border-indigo-200 cursor-pointer"
                      title="Maju 1 frame (~33ms)"
                    >
                      +1 Frame <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => stepTime(1)}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-mono flex items-center gap-1 border border-slate-200 cursor-pointer"
                      title="Maju 1 detik"
                    >
                      +1s
                    </button>
                  </div>
                </div>
              </div>

              {/* MANUAL ACTION CTA BUTTON: Ambil Frame Detik Ini */}
              <div className="mt-6 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={captureCurrentFrame}
                  className="w-full py-3.5 px-5 rounded-xl bg-[#5b50e5] hover:bg-[#4f46e5] text-white font-bold text-sm flex items-center justify-center gap-3 shadow-md shadow-[#5b50e5]/20 transition-all cursor-pointer"
                >
                  <Camera className="w-5 h-5 text-indigo-100" />
                  <span>Ambil Frame Detik Ini ({formatTimestamp(currentTime)})</span>
                </button>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN (5 Cols): Automatic Extraction Settings Panel */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-5">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                <Scissors className="w-5 h-5 text-amber-600" />
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Setelan Ekstraksi Otomatis</h4>
                  <p className="text-[11px] text-slate-500">Pilih frekuensi pengambilan frame secara beruntun.</p>
                </div>
              </div>

              {/* FREQUENCY MODE SELECTOR */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-slate-800 uppercase tracking-wider block">Mode Frekuensi</label>
                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setExtractionMode('interval')}
                    className={`py-2 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      extractionMode === 'interval'
                        ? 'bg-[#5b50e5] text-white font-bold shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Berdasarkan Interval
                  </button>
                  <button
                    type="button"
                    onClick={() => setExtractionMode('fps')}
                    className={`py-2 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      extractionMode === 'fps'
                        ? 'bg-[#5b50e5] text-white font-bold shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Berdasarkan FPS
                  </button>
                </div>
              </div>

              {/* MODE A OPTIONS: Interval Waktu */}
              {extractionMode === 'interval' && (
                <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200/80">
                  <label className="text-xs font-bold text-slate-800 block">Ambil Frame Setiap:</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: 'Tiap 10 Detik', val: 10 },
                      { label: 'Tiap 5 Detik', val: 5 },
                      { label: 'Tiap 2 Detik', val: 2 },
                      { label: 'Tiap 1 Detik', val: 1 },
                      { label: 'Tiap 0.5 Detik', val: 0.5 },
                    ].map((opt) => (
                      <button
                        key={opt.val}
                        type="button"
                        onClick={() => setIntervalValue(opt.val)}
                        className={`py-2 px-2.5 rounded-lg text-xs font-semibold border transition-all text-center cursor-pointer ${
                          intervalValue === opt.val
                            ? 'bg-indigo-50 border-[#5b50e5] text-[#5b50e5] font-bold shadow-2xs'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  {/* Custom Interval Input */}
                  <div className="pt-2 flex items-center gap-2">
                    <span className="text-xs text-slate-600 shrink-0">Atau kustom (detik):</span>
                    <input
                      type="number"
                      min="0.1"
                      step="0.1"
                      value={intervalValue}
                      onChange={(e) => setIntervalValue(Math.max(0.1, parseFloat(e.target.value) || 1))}
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-900 text-center font-mono focus:outline-none focus:border-[#5b50e5]"
                    />
                  </div>
                </div>
              )}

              {/* MODE B OPTIONS: FPS Rate */}
              {extractionMode === 'fps' && (
                <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200/80">
                  <label className="text-xs font-bold text-slate-800 block">Frame Per Detik (FPS):</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: '1 FPS (1 frame/s)', val: 1 },
                      { label: '5 FPS (5 frame/s)', val: 5 },
                      { label: '10 FPS (10 frame/s)', val: 10 },
                      { label: '30 FPS (Semua Frame)', val: 30 },
                    ].map((opt) => (
                      <button
                        key={opt.val}
                        type="button"
                        onClick={() => setFpsValue(opt.val)}
                        className={`py-2 px-2.5 rounded-lg text-xs font-semibold border transition-all text-center cursor-pointer ${
                          fpsValue === opt.val
                            ? 'bg-indigo-50 border-[#5b50e5] text-[#5b50e5] font-bold shadow-2xs'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* REAL-TIME ESTIMATION GUARDRAILS BOX */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 space-y-2 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Panjang Video:</span>
                  <span className="font-mono font-bold text-slate-900">{videoDuration.toFixed(1)} detik</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Estimasi Jumlah Frame:</span>
                  <span className="font-mono font-bold text-amber-700">~{estimates.totalFrames} PNG</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Perkiraan Ukuran Unduhan:</span>
                  <span className="font-mono font-bold text-[#5b50e5]">±{estimates.estimatedMB} MB</span>
                </div>

                {/* CONTEXTUAL HIGH-VOLUME WARNING */}
                {estimates.totalFrames > 300 && (
                  <div className="mt-3 p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-[11px] leading-relaxed flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <span>
                      Pengaturan ini akan menghasilkan sekitar <strong>{estimates.totalFrames} frame</strong>. Proses mungkin memerlukan waktu & memori browser cukup besar.
                    </span>
                  </div>
                )}
              </div>

              {/* PRIMARY ACTION CTA BUTTON: Mulai Ekstrak Frame Beruntun */}
              <div>
                {!isExtracting ? (
                  <button
                    type="button"
                    onClick={startBatchExtraction}
                    disabled={estimates.totalFrames <= 0}
                    className="w-full py-3.5 px-5 rounded-xl bg-[#5b50e5] hover:bg-[#4f46e5] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md shadow-[#5b50e5]/20 disabled:opacity-50 transition-all cursor-pointer"
                  >
                    <Scissors className="w-5 h-5 text-white" />
                    <span>Mulai Ekstrak {estimates.totalFrames} Frame</span>
                  </button>
                ) : (
                  <div className="space-y-3 bg-amber-50 p-4 rounded-xl border border-amber-200 text-center">
                    <div className="flex items-center justify-between text-xs font-bold text-amber-900">
                      <span className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin text-amber-600" />
                        Mengekstrak {extractionProgress.current}/{extractionProgress.total} Frame...
                      </span>
                      <span>
                        {Math.round((extractionProgress.current / Math.max(1, extractionProgress.total)) * 100)}%
                      </span>
                    </div>

                    {/* Glowing Progress Bar */}
                    <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
                      <div
                        className="bg-[#5b50e5] h-full transition-all duration-150"
                        style={{
                          width: `${(extractionProgress.current / Math.max(1, extractionProgress.total)) * 100}%`,
                        }}
                      />
                    </div>

                    <button
                      type="button"
                      onClick={cancelExtraction}
                      className="px-4 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition-all cursor-pointer"
                    >
                      Batal Ekstraksi
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* SECTION 3: UNIFIED SCALABLE FRAME GALLERY */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 sm:p-6 shadow-sm space-y-6">
        {/* Gallery Header Toolbar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-700">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                Galeri Hasil Frame
                <span className="px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-xs font-mono font-bold">
                  {filteredFrames.length} Frame
                </span>
              </h3>
              <p className="text-xs text-slate-500">Semua frame hasil pengambilan manual maupun ekstraksi otomatis.</p>
            </div>
          </div>

          {/* Gallery Controls & Batch Actions */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Filter Pills */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setGalleryFilter('all')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  galleryFilter === 'all' ? 'bg-[#5b50e5] text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Semua ({frames.length})
              </button>
              <button
                type="button"
                onClick={() => setGalleryFilter('manual')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  galleryFilter === 'manual' ? 'bg-[#5b50e5] text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Manual ({frames.filter(f => f.type === 'manual').length})
              </button>
              <button
                type="button"
                onClick={() => setGalleryFilter('automatic')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  galleryFilter === 'automatic' ? 'bg-[#5b50e5] text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Otomatis ({frames.filter(f => f.type === 'automatic').length})
              </button>
            </div>

            {/* Sort Toggle */}
            <button
              type="button"
              onClick={() => setGallerySort(prev => (prev === 'asc' ? 'desc' : 'asc'))}
              className="px-3 py-2 rounded-xl bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700 hover:text-slate-900 flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowUpDown className="w-3.5 h-3.5 text-[#5b50e5]" />
              <span>{gallerySort === 'asc' ? 'Awal -> Akhir' : 'Akhir -> Awal'}</span>
            </button>

            {/* Density View Toggle */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setGalleryDensity('normal')}
                className={`p-1.5 rounded-lg cursor-pointer ${galleryDensity === 'normal' ? 'bg-white text-[#5b50e5] shadow-2xs' : 'text-slate-500'}`}
                title="Grid Standar"
              >
                <Grid className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setGalleryDensity('compact')}
                className={`p-1.5 rounded-lg cursor-pointer ${galleryDensity === 'compact' ? 'bg-white text-[#5b50e5] shadow-2xs' : 'text-slate-500'}`}
                title="Grid Padat"
              >
                <Grid className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setGalleryDensity('list')}
                className={`p-1.5 rounded-lg cursor-pointer ${galleryDensity === 'list' ? 'bg-white text-[#5b50e5] shadow-2xs' : 'text-slate-500'}`}
                title="Tampilan List"
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* BATCH ACTION BAR (When frames exist) */}
        {frames.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={selectedFrameIds.size === filteredFrames.length ? clearSelection : selectAllFrames}
                className="flex items-center gap-1.5 font-bold text-slate-700 hover:text-slate-900 cursor-pointer"
              >
                {selectedFrameIds.size === filteredFrames.length ? (
                  <CheckSquare className="w-4 h-4 text-[#5b50e5]" />
                ) : (
                  <Square className="w-4 h-4 text-slate-400" />
                )}
                <span>Pilih Semua ({selectedFrameIds.size}/{filteredFrames.length})</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              {selectedFrameIds.size > 0 && (
                <button
                  type="button"
                  onClick={deleteSelectedFrames}
                  className="px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                  <span>Hapus Terpilih ({selectedFrameIds.size})</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => downloadFramesZip(selectedFrameIds.size > 0 ? filteredFrames.filter(f => selectedFrameIds.has(f.id)) : filteredFrames)}
                disabled={isZipping || filteredFrames.length === 0}
                className="px-4 py-2 rounded-xl bg-[#5b50e5] hover:bg-[#4f46e5] text-white font-bold flex items-center gap-2 shadow-2xs disabled:opacity-50 transition-all cursor-pointer"
              >
                {isZipping ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Membuat ZIP...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 text-indigo-100" />
                    <span>Unduh {selectedFrameIds.size > 0 ? `${selectedFrameIds.size} PNG` : 'Semua'} sebagai ZIP</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* GALLERY GRID DISPLAY */}
        {filteredFrames.length > 0 ? (
          <div
            className={`grid gap-4 ${
              galleryDensity === 'compact'
                ? 'grid-cols-2 sm:grid-cols-4 md:grid-cols-6'
                : galleryDensity === 'list'
                ? 'grid-cols-1'
                : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4'
            }`}
          >
            {filteredFrames.map((frame) => {
              const isSelected = selectedFrameIds.has(frame.id);

              if (galleryDensity === 'list') {
                return (
                  <div
                    key={frame.id}
                    className={`flex items-center justify-between p-3 rounded-xl border transition-all bg-white ${
                      isSelected ? 'border-[#5b50e5] ring-2 ring-[#5b50e5]/20 shadow-2xs' : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <button type="button" onClick={() => toggleSelectFrame(frame.id)} className="cursor-pointer">
                        {isSelected ? <CheckSquare className="w-4 h-4 text-[#5b50e5]" /> : <Square className="w-4 h-4 text-slate-400" />}
                      </button>
                      <div className="w-16 h-10 relative rounded-lg overflow-hidden border border-slate-200 cursor-pointer" onClick={() => setPreviewFrame(frame)}>
                        <SafeImage
                          src={frame.dataUrl}
                          alt={`Frame ${frame.timestampFormatted}`}
                          fill
                          className="object-cover"
                        />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-xs text-slate-900">{frame.timestampFormatted}</span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              frame.type === 'manual' ? 'bg-indigo-50 text-[#5b50e5]' : 'bg-amber-50 text-amber-700'
                            }`}
                          >
                            {frame.type === 'manual' ? 'Manual' : 'Otomatis'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500">{frame.width}×{frame.height}px • ±{frame.fileSizeApproxKB} KB</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => downloadSingleFrame(frame)}
                        className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 cursor-pointer"
                        title="Unduh PNG"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteSingleFrame(frame.id)}
                        className="p-2 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 cursor-pointer"
                        title="Hapus Frame"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={frame.id}
                  className={`group relative bg-white rounded-xl overflow-hidden border transition-all ${
                    isSelected ? 'border-[#5b50e5] ring-2 ring-[#5b50e5]/20 shadow-2xs' : 'border-slate-200 hover:border-[#5b50e5]/50'
                  }`}
                >
                  {/* Select Checkbox Overlay */}
                  <button
                    type="button"
                    onClick={() => toggleSelectFrame(frame.id)}
                    className="absolute top-2 left-2 z-10 p-1 rounded-lg bg-white/90 backdrop-blur-md text-slate-800 border border-slate-200 shadow-2xs cursor-pointer"
                  >
                    {isSelected ? <CheckSquare className="w-4 h-4 text-[#5b50e5]" /> : <Square className="w-4 h-4 text-slate-400" />}
                  </button>

                  {/* Badge Manual / Otomatis */}
                  <span
                    className={`absolute top-2 right-2 z-10 px-2 py-0.5 rounded-full text-[10px] font-bold backdrop-blur-md shadow-2xs ${
                      frame.type === 'manual' ? 'bg-[#5b50e5] text-white' : 'bg-amber-600 text-white'
                    }`}
                  >
                    {frame.type === 'manual' ? 'Manual' : 'Otomatis'}
                  </span>

                  {/* Image Container with Hover Zoom */}
                  <div className="aspect-video bg-slate-900 relative overflow-hidden cursor-pointer" onClick={() => setPreviewFrame(frame)}>
                    <SafeImage
                      src={frame.dataUrl}
                      alt={`Frame ${frame.timestampFormatted}`}
                      fill
                      className="w-full h-full object-cover transition-all duration-300 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center">
                      <Maximize2 className="w-6 h-6 text-white" />
                    </div>
                  </div>

                  {/* Frame Footer Bar */}
                  <div className="p-3 bg-white border-t border-slate-100 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-mono font-bold text-slate-900 block">{frame.timestampFormatted}</span>
                      <span className="text-[10px] text-slate-500 block">{frame.width}×{frame.height}px</span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => downloadSingleFrame(frame)}
                        className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                        title="Unduh PNG"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteSingleFrame(frame.id)}
                        className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 cursor-pointer"
                        title="Hapus Frame"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12 bg-slate-50 rounded-xl border border-slate-200/80 space-y-3">
            <Layers className="w-10 h-10 text-slate-400 mx-auto" />
            <p className="text-sm font-bold text-slate-800">Belum Ada Frame di Galeri</p>
            <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
              Muat video di atas lalu tekan &quot;Ambil Frame Detik Ini&quot; atau jalankan &quot;Mulai Ekstrak Frame Beruntun&quot;.
            </p>
          </div>
        )}
      </div>

      {/* LIGHTBOX MODAL PREVIEW */}
      <AnimatePresence>
        {previewFrame && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4"
            onClick={() => setPreviewFrame(null)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="max-w-4xl w-full bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xl space-y-4 p-5 relative"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    Detail Frame: {previewFrame.timestampFormatted}
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        previewFrame.type === 'manual' ? 'bg-indigo-50 text-[#5b50e5]' : 'bg-amber-50 text-amber-700'
                      }`}
                    >
                      {previewFrame.type === 'manual' ? 'Manual' : 'Otomatis'}
                    </span>
                  </h4>
                  <p className="text-xs text-slate-500">Dimensi: {previewFrame.width}×{previewFrame.height}px • Ukuran: ±{previewFrame.fileSizeApproxKB} KB</p>
                </div>
                <button
                  type="button"
                  onClick={() => setPreviewFrame(null)}
                  className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="aspect-video bg-slate-900 rounded-xl overflow-hidden border border-slate-200 relative flex items-center justify-center">
                <SafeImage src={previewFrame.dataUrl} alt="Frame Full" fill className="object-contain" />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => downloadSingleFrame(previewFrame)}
                  className="px-4 py-2.5 rounded-xl bg-[#5b50e5] hover:bg-[#4f46e5] text-white text-xs font-bold flex items-center gap-2 cursor-pointer shadow-2xs"
                >
                  <Download className="w-4 h-4" /> Unduh PNG Ini
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
