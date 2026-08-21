'use client';

import React, { useState, useEffect } from 'react';
import { 
  Download, 
  Music, 
  Sparkles, 
  Copy, 
  Check, 
  Loader2, 
  AlertCircle, 
  Heart, 
  MessageCircle, 
  Share2, 
  Eye, 
  ExternalLink, 
  Trash2, 
  History, 
  Film, 
  Image as ImageIcon,
  Play,
  Clipboard,
  X,
  Lightbulb,
  Scissors
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { saveHistoryItem } from '../../lib/history';
import { learningSync } from '../../lib/learningSync';
import { safeParseJson } from '../../lib/apiHelper';
import { useGenerationLog } from '../../hooks/useGenerationLog';
import { reportActiveGenerationStatus } from '../../events/generationEvent';
import { SafeImage } from '../common/SafeImage';
import { getCachedData, setCachedData } from '../../lib/cache/aiCacheManager';

export interface TikTokData {
  id: string;
  title: string;
  cover: string;
  play: string;
  wmplay: string;
  hdplay: string;
  music: string;
  musicTitle: string;
  musicAuthor: string;
  author: {
    id: string;
    uniqueId: string;
    nickname: string;
    avatar: string;
  };
  stats: {
    playCount: number;
    diggCount: number;
    commentCount: number;
    shareCount: number;
  };
  images?: string[] | null;
}

interface TikTokDownloaderProps {
  onAnalyzeVideo: (file: File) => void;
  onGenerateContentIdeas?: (videoFile?: File, tiktokTitle?: string, tiktokUrl?: string) => void;
  onExtractFrames?: (videoFile?: File, tiktokUrl?: string) => void;
}

export default function TikTokDownloader({ onAnalyzeVideo, onGenerateContentIdeas, onExtractFrames }: TikTokDownloaderProps) {
  const { logGeneration } = useGenerationLog();
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [videoData, setVideoData] = useState<TikTokData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedCaption, setCopiedCaption] = useState(false);
  const [isDownloading, setIsDownloading] = useState<string | null>(null);
  const [isSendingToAI, setIsSendingToAI] = useState(false);
  const [isFromCache, setIsFromCache] = useState(false);
  const [history, setHistory] = useState<TikTokData[]>(() => {
    try {
      const saved = localStorage.getItem('tiktok_download_history');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  const saveToHistory = (item: TikTokData) => {
    try {
      const filtered = history.filter(h => h.id !== item.id);
      const updated = [item, ...filtered].slice(0, 10);
      setHistory(updated);
      localStorage.setItem('tiktok_download_history', JSON.stringify(updated));

      // Also sync to unified global local storage history
      saveHistoryItem({
        category: 'tiktok_download',
        title: `TikTok: ${item.title.slice(0, 40)}...`,
        subtitle: `@${item.author.uniqueId} • HD Media`,
        data: {
          tiktokTitle: item.title,
          tiktokCover: item.cover,
          tiktokPlay: item.play,
          tiktokAuthor: item.author.uniqueId,
        },
      });
    } catch (e) {
      console.error('Failed to save history', e);
    }
  };

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem('tiktok_download_history');
  };

  const removeFromHistory = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = history.filter(h => h.id !== id);
    setHistory(updated);
    localStorage.setItem('tiktok_download_history', JSON.stringify(updated));
  };

  const handleFetchInfo = async (e?: React.FormEvent, customUrl?: string) => {
    if (e) e.preventDefault();
    const targetUrl = (customUrl || url).trim();

    if (!targetUrl) {
      setError('Silakan masukkan URL TikTok terlebih dahulu.');
      return;
    }

    if (!targetUrl.includes('tiktok.com')) {
      setError('URL tidak valid. Pastikan menyalin tautan dari TikTok.');
      return;
    }

    // Track user link pasted event
    learningSync.track('link_pasted', { url: targetUrl });

    // Check fast cache first
    const cached = getCachedData<TikTokData>(`tt_info_${targetUrl}`);
    if (cached) {
      setVideoData(cached);
      setIsFromCache(true);
      setError(null);
      saveToHistory(cached);
      return;
    }

    setIsLoading(true);
    setIsFromCache(false);
    setError(null);
    setVideoData(null);

    const startTime = Date.now();
    const activeId = `gen_tt_${Date.now()}`;
    reportActiveGenerationStatus(activeId, 'generating', `TikTok Downloader (${targetUrl.slice(0, 30)})`);

    try {
      const res = await fetch('/api/tiktok/info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: targetUrl }),
      });

      const data = await safeParseJson(res);

      setVideoData(data);
      saveToHistory(data);
      setCachedData(`tt_info_${targetUrl}`, data);

      reportActiveGenerationStatus(activeId, 'completed');

      logGeneration({
        tool: 'tiktok_downloader',
        productName: data.title || targetUrl,
        topic: data.title || targetUrl,
        caption: data.title,
        latencyMs: Date.now() - startTime,
        outcome: 'success',
      });
    } catch (err: any) {
      console.error(err);
      const errMsg = err.message || 'Gagal memproses URL TikTok.';
      setError(errMsg);
      reportActiveGenerationStatus(activeId, 'completed');

      logGeneration({
        tool: 'tiktok_downloader',
        productName: targetUrl,
        topic: targetUrl,
        latencyMs: Date.now() - startTime,
        outcome: 'error',
        errorMessage: errMsg,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setUrl(text);
        if (text.includes('tiktok.com')) {
          handleFetchInfo(undefined, text);
        }
      }
    } catch (e) {
      setError('Tidak dapat mengakses clipboard secara otomatis. Tempel manual dengan Ctrl+V.');
    }
  };

  const formatNumber = (num: number) => {
    if (!num) return '0';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toLocaleString();
  };

  const handleDownloadMedia = (mediaUrl: string, typeName: string, ext = 'mp4') => {
    if (!videoData) return;
    setIsDownloading(typeName);

    // Track user video download activity
    learningSync.track('video_downloaded', {
      typeName,
      title: videoData.title,
      author: videoData.author.uniqueId,
    });

    const safeTitle = (videoData.title || 'tiktok_video')
      .replace(/[^a-zA-Z0-9]/g, '_')
      .slice(0, 30);
    const filename = `@${videoData.author.uniqueId || 'user'}_${safeTitle}_${typeName}.${ext}`;

    const proxyUrl = `/api/tiktok/proxy?url=${encodeURIComponent(mediaUrl)}&filename=${encodeURIComponent(filename)}&download=true`;

    const a = document.createElement('a');
    a.href = proxyUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    setTimeout(() => {
      setIsDownloading(null);
    }, 1500);
  };

  const copyCaption = () => {
    if (videoData?.title) {
      navigator.clipboard.writeText(videoData.title);
      setCopiedCaption(true);

      // Track positive signal when user copies caption
      learningSync.track('prompt_copied', {
        type: 'tiktok_caption',
        text: videoData.title,
      });

      setTimeout(() => setCopiedCaption(false), 2000);
    }
  };

  const handleSendToAIPrompt = async () => {
    if (!videoData) return;
    setIsSendingToAI(true);
    setError(null);

    try {
      // Stream video via backend proxy to avoid CORS
      const videoSource = videoData.hdplay || videoData.play || videoData.wmplay;
      const proxyUrl = `/api/tiktok/proxy?url=${encodeURIComponent(videoSource)}`;

      const response = await fetch(proxyUrl);
      if (!response.ok) {
        throw new Error('Gagal mengunduh berkas video TikTok untuk dikirim ke Gemini AI.');
      }

      const blob = await response.blob();
      const safeTitle = (videoData.title || 'tiktok_video')
        .replace(/[^a-zA-Z0-9]/g, '_')
        .slice(0, 30);
      const file = new File([blob], `@${videoData.author.uniqueId}_${safeTitle}.mp4`, {
        type: 'video/mp4',
      });

      onAnalyzeVideo(file);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Gagal mengirimkan video ke analisis AI.');
    } finally {
      setIsSendingToAI(false);
    }
  };

  const handleSendToIdeas = async () => {
    if (!videoData || !onGenerateContentIdeas) return;
    setIsSendingToAI(true);
    setError(null);

    try {
      const videoSource = videoData.hdplay || videoData.play || videoData.wmplay;
      const proxyUrl = `/api/tiktok/proxy?url=${encodeURIComponent(videoSource)}`;

      const response = await fetch(proxyUrl);
      if (!response.ok) {
        onGenerateContentIdeas(undefined, videoData.title, url);
        return;
      }

      const blob = await response.blob();
      const safeTitle = (videoData.title || 'tiktok_video')
        .replace(/[^a-zA-Z0-9]/g, '_')
        .slice(0, 30);
      const file = new File([blob], `@${videoData.author.uniqueId}_${safeTitle}.mp4`, {
        type: 'video/mp4',
      });

      onGenerateContentIdeas(file, videoData.title, url);
    } catch (err: any) {
      console.error(err);
      onGenerateContentIdeas(undefined, videoData.title, url);
    } finally {
      setIsSendingToAI(false);
    }
  };

  const handleSendToExtractor = async () => {
    if (!videoData || !onExtractFrames) return;
    setIsSendingToAI(true);
    setError(null);

    try {
      const videoSource = videoData.hdplay || videoData.play || videoData.wmplay;
      const proxyUrl = `/api/tiktok/proxy?url=${encodeURIComponent(videoSource)}`;

      const response = await fetch(proxyUrl);
      if (!response.ok) {
        onExtractFrames(undefined, url);
        return;
      }

      const blob = await response.blob();
      const safeTitle = (videoData.title || 'tiktok_video')
        .replace(/[^a-zA-Z0-9]/g, '_')
        .slice(0, 30);
      const file = new File([blob], `@${videoData.author.uniqueId}_${safeTitle}.mp4`, {
        type: 'video/mp4',
      });

      onExtractFrames(file, url);
    } catch (err: any) {
      console.error(err);
      onExtractFrames(undefined, url);
    } finally {
      setIsSendingToAI(false);
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Input Section */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 sm:p-8 shadow-sm">
        <form onSubmit={handleFetchInfo} className="space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch gap-3">
            <div className="relative flex-1">
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Tempel tautan video TikTok di sini (contoh: https://vt.tiktok.com/...)"
                className="w-full h-12 sm:h-13 pl-4 pr-28 rounded-xl bg-white border border-slate-200 focus:border-[#5b50e5] focus:ring-2 focus:ring-[#5b50e5]/20 focus:outline-none text-slate-900 placeholder:text-slate-400 text-xs sm:text-sm transition-all"
              />
              {url && (
                <button
                  type="button"
                  onClick={() => setUrl('')}
                  className="absolute right-20 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
              <button
                type="button"
                onClick={handlePaste}
                className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 transition-colors flex items-center gap-1.5 border border-slate-200 cursor-pointer"
                title="Tempel dari Clipboard"
              >
                <Clipboard className="w-3.5 h-3.5 text-slate-500" />
                <span>Tempel</span>
              </button>
            </div>

            <button
              type="submit"
              disabled={isLoading || !url.trim()}
              className="h-12 sm:h-13 px-7 rounded-xl bg-[#5b50e5] hover:bg-[#4f46e5] disabled:opacity-50 text-white font-medium flex items-center justify-center gap-2 transition-all shadow-sm shrink-0 text-xs sm:text-sm cursor-pointer"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                  <span>Memproses...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span>Cari Video</span>
                </>
              )}
            </button>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-500 px-1 pt-1">
            <span className="flex items-center gap-1.5 text-[11px] sm:text-xs text-slate-600">
              <Sparkles className="w-3.5 h-3.5 text-[#5b50e5]" />
              <span>Bebas Watermark • Kualitas HD • Ekstrak Musik MP3</span>
            </span>
            <button
              type="button"
              onClick={() => {
                const sample = 'https://www.tiktok.com/@tiktok/video/7123456789101112131';
                setUrl(sample);
              }}
              className="hover:text-[#5b50e5] transition-colors underline text-[11px] sm:text-xs text-slate-500 cursor-pointer"
            >
              Contoh Tautan
            </button>
          </div>
        </form>

        {error && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-3 text-rose-800 text-xs sm:text-sm"
          >
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-rose-600" />
            <div>
              <p className="font-semibold text-rose-900">Gagal Memproses Video</p>
              <p className="text-rose-700 text-xs mt-0.5">{error}</p>
            </div>
          </motion.div>
        )}
      </div>

      {/* Main Result Card */}
      <AnimatePresence mode="wait">
        {videoData && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="bg-white border border-slate-200/80 rounded-2xl p-6 sm:p-8 shadow-sm"
          >
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-start">
              {/* Left Column: Media Preview */}
              <div className="lg:col-span-5 space-y-4">
                <div className="relative rounded-2xl overflow-hidden bg-slate-900 border border-slate-200 aspect-[9/16] max-h-[480px] sm:max-h-[520px] mx-auto group shadow-md">
                  {videoData.images && videoData.images.length > 0 ? (
                    <div className="w-full h-full overflow-y-auto p-2 space-y-2 custom-scrollbar">
                      <div className="text-xs font-semibold text-slate-300 p-2 flex items-center gap-2">
                        <ImageIcon className="w-4 h-4 text-[#5b50e5]" />
                        <span>Foto Slide ({videoData.images.length} Gambar)</span>
                      </div>
                      {videoData.images.map((img, idx) => (
                        <div key={idx} className="relative rounded-xl overflow-hidden group/img min-h-[160px]">
                          <SafeImage src={img} alt={`Slide ${idx + 1}`} width={400} height={400} className="w-full h-auto object-cover" />
                          <button
                            onClick={() => handleDownloadMedia(img, `slide_${idx + 1}`, 'jpg')}
                            className="absolute bottom-2 right-2 p-2 rounded-lg bg-black/80 hover:bg-black backdrop-blur-md text-white text-xs font-semibold flex items-center gap-1.5 opacity-90 transition-opacity border border-white/10"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Unduh #{idx + 1}</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <video
                      src={`/api/tiktok/proxy?url=${encodeURIComponent(videoData.hdplay || videoData.play || videoData.wmplay)}`}
                      poster={videoData.cover}
                      controls
                      className="w-full h-full object-contain"
                    />
                  )}
                </div>

                {/* AI Integration Buttons */}
                <div className="space-y-2">
                  <button
                    onClick={handleSendToIdeas}
                    disabled={isSendingToAI}
                    className="w-full py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold flex items-center justify-center gap-2 transition-all shadow-sm text-xs sm:text-sm group cursor-pointer"
                  >
                    {isSendingToAI ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Menyiapkan Video untuk Ide Konten...</span>
                      </>
                    ) : (
                      <>
                        <Lightbulb className="w-4 h-4 text-amber-100 group-hover:rotate-12 transition-transform" />
                        <span>Buat 5 Ide Konten, Caption & Hashtag AI</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={handleSendToAIPrompt}
                    disabled={isSendingToAI}
                    className="w-full py-3 px-4 rounded-xl bg-[#5b50e5] hover:bg-[#4f46e5] text-white font-semibold flex items-center justify-center gap-2 transition-all shadow-sm text-xs sm:text-sm group cursor-pointer"
                  >
                    {isSendingToAI ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Menyiapkan Video untuk Gemini AI...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 text-amber-300 group-hover:rotate-12 transition-transform" />
                        <span>Analisis Video Ini dengan AI Prompt Generator</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={handleSendToExtractor}
                    disabled={isSendingToAI}
                    className="w-full py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-semibold flex items-center justify-center gap-2 transition-all shadow-sm text-xs sm:text-sm group cursor-pointer"
                  >
                    {isSendingToAI ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Menyiapkan Ekstraktor Frame...</span>
                      </>
                    ) : (
                      <>
                        <Scissors className="w-4 h-4 text-cyan-300 group-hover:scale-110 transition-transform" />
                        <span>Ekstrak Frame Video Ini (Manual & Otomatis)</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Right Column: Metadata & Downloads */}
              <div className="lg:col-span-7 space-y-5 flex flex-col justify-between h-full">
                {/* Author Info & Stats */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                      {videoData.author.avatar ? (
                        <div className="w-11 h-11 sm:w-12 sm:h-12 relative rounded-full overflow-hidden border border-slate-200 shadow-2xs">
                          <SafeImage
                            src={videoData.author.avatar}
                            alt={videoData.author.nickname}
                            fill
                            className="object-cover"
                          />
                        </div>
                      ) : (
                        <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center font-bold text-[#5b50e5]">
                          {videoData.author.nickname?.charAt(0) || 'T'}
                        </div>
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-slate-900 text-sm sm:text-base leading-tight">
                            {videoData.author.nickname}
                          </h4>
                          {isFromCache && (
                            <span className="text-[10px] bg-indigo-50 border border-indigo-200 text-[#5b50e5] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
                              <Sparkles className="w-3 h-3 text-amber-500" />
                              <span>Instan Cache</span>
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          @{videoData.author.uniqueId}
                        </p>
                      </div>
                    </div>

                    <a
                      href={`https://www.tiktok.com/@${videoData.author.uniqueId}/video/${videoData.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
                      title="Buka di TikTok"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>

                  {/* Caption & Copy */}
                  <div className="relative rounded-xl sm:rounded-2xl bg-slate-50 border border-slate-200/80 p-3.5 sm:p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                        Deskripsi / Caption
                      </span>
                      <button
                        onClick={copyCaption}
                        className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 text-xs font-semibold text-slate-700 transition-colors flex items-center gap-1.5 border border-slate-200 cursor-pointer shadow-2xs"
                      >
                        {copiedCaption ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
                        <span>{copiedCaption ? 'Tersalin' : 'Salin Caption'}</span>
                      </button>
                    </div>
                    <p className="text-xs sm:text-sm text-slate-800 leading-relaxed whitespace-pre-line line-clamp-4 hover:line-clamp-none transition-all">
                      {videoData.title || 'Tidak ada deskripsi.'}
                    </p>
                  </div>

                  {/* Engagement Stats */}
                  <div className="grid grid-cols-4 gap-2 text-center">
                    <div className="p-2.5 sm:p-3 rounded-xl sm:rounded-2xl bg-slate-50 border border-slate-200/80">
                      <Eye className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600 mx-auto mb-1" />
                      <div className="text-xs font-bold text-slate-900">{formatNumber(videoData.stats.playCount)}</div>
                      <div className="text-[10px] text-slate-500 font-medium">Tayangan</div>
                    </div>
                    <div className="p-2.5 sm:p-3 rounded-xl sm:rounded-2xl bg-slate-50 border border-slate-200/80">
                      <Heart className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-rose-600 mx-auto mb-1" />
                      <div className="text-xs font-bold text-slate-900">{formatNumber(videoData.stats.diggCount)}</div>
                      <div className="text-[10px] text-slate-500 font-medium">Suka</div>
                    </div>
                    <div className="p-2.5 sm:p-3 rounded-xl sm:rounded-2xl bg-slate-50 border border-slate-200/80">
                      <MessageCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600 mx-auto mb-1" />
                      <div className="text-xs font-bold text-slate-900">{formatNumber(videoData.stats.commentCount)}</div>
                      <div className="text-[10px] text-slate-500 font-medium">Komentar</div>
                    </div>
                    <div className="p-2.5 sm:p-3 rounded-xl sm:rounded-2xl bg-slate-50 border border-slate-200/80">
                      <Share2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-600 mx-auto mb-1" />
                      <div className="text-xs font-bold text-slate-900">{formatNumber(videoData.stats.shareCount)}</div>
                      <div className="text-[10px] text-slate-500 font-medium">Bagikan</div>
                    </div>
                  </div>
                </div>

                {/* Download Action Buttons */}
                <div className="space-y-2.5 pt-3 border-t border-slate-100">
                  <h5 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    Pilihan Unduhan Media
                  </h5>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {/* No Watermark HD */}
                    <button
                      onClick={() => handleDownloadMedia(videoData.hdplay || videoData.play, 'no_watermark_hd')}
                      disabled={isDownloading === 'no_watermark_hd'}
                      className="py-3 px-4 rounded-xl sm:rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold flex items-center justify-center gap-2 transition-all shadow-2xs text-xs sm:text-sm cursor-pointer"
                    >
                      {isDownloading === 'no_watermark_hd' ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Film className="w-4 h-4" />
                      )}
                      <span>Unduh Tanpa Watermark (HD)</span>
                    </button>

                    {/* Watermarked */}
                    {videoData.wmplay && (
                      <button
                        onClick={() => handleDownloadMedia(videoData.wmplay, 'watermarked')}
                        disabled={isDownloading === 'watermarked'}
                        className="py-3 px-4 rounded-xl sm:rounded-2xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-800 font-semibold flex items-center justify-center gap-2 transition-all text-xs sm:text-sm cursor-pointer"
                      >
                        {isDownloading === 'watermarked' ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Download className="w-4 h-4 text-slate-500" />
                        )}
                        <span>Unduh Dengan Watermark</span>
                      </button>
                    )}

                    {/* MP3 Music */}
                    {videoData.music && (
                      <button
                        onClick={() => handleDownloadMedia(videoData.music, 'audio', 'mp3')}
                        disabled={isDownloading === 'audio'}
                        className="py-3 px-4 rounded-xl sm:rounded-2xl bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-900 font-semibold flex items-center justify-center gap-2 transition-all text-xs sm:text-sm sm:col-span-2 cursor-pointer"
                      >
                        {isDownloading === 'audio' ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Music className="w-4 h-4 text-purple-600" />
                        )}
                        <span>Unduh Audio MP3 ({videoData.musicTitle || 'Musik Asli'})</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* History Section */}
      {history.length > 0 && (
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-2">
              <History className="w-4 h-4 text-[#5b50e5]" />
              <span>Riwayat Unduhan Terakhir</span>
            </h4>
            <button
              onClick={clearHistory}
              className="text-xs text-slate-500 hover:text-rose-600 transition-colors flex items-center gap-1 font-medium cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Hapus Riwayat</span>
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {history.map((item) => (
              <div
                key={item.id}
                onClick={() => {
                  setVideoData(item);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="group relative rounded-xl sm:rounded-2xl bg-slate-50 border border-slate-200/80 hover:border-[#5b50e5] p-2 cursor-pointer transition-all hover:scale-[1.02] flex flex-col justify-between shadow-2xs"
              >
                <div className="relative aspect-[9/16] rounded-lg sm:rounded-xl overflow-hidden bg-slate-900 mb-2">
                  <SafeImage src={item.cover} alt={item.title} fill className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent flex items-end p-2">
                    <span className="text-[10px] text-white font-semibold line-clamp-1">
                      @{item.author.uniqueId}
                    </span>
                  </div>
                  <button
                    onClick={(e) => removeFromHistory(item.id, e)}
                    className="absolute top-1.5 right-1.5 p-1 rounded-md bg-slate-900/80 hover:bg-rose-500 text-white/80 hover:text-white transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
                <div className="px-1 pb-1">
                  <p className="text-[11px] text-slate-800 line-clamp-1 font-medium">
                    {item.title || 'TikTok Video'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
