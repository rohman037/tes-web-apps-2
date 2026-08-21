'use client';

import React, { useState, useRef, useEffect, useCallback, DragEvent, ChangeEvent } from 'react';
import { 
  Upload, 
  FileVideo, 
  Sparkles, 
  Loader2, 
  RefreshCw, 
  Cpu, 
  Download, 
  Scissors, 
  Camera, 
  History as HistoryIcon, 
  ShieldCheck, 
  Key, 
  Settings, 
  Lightbulb, 
  Menu, 
  X, 
  HelpCircle, 
  CreditCard, 
  RotateCcw,
  Sliders,
  Clapperboard,
  LogOut,
  Copy,
  Check,
  Eye,
  EyeOff,
  Link as LinkIcon,
  Clipboard,
  AlertCircle,
  ShoppingBag,
  Search,
  WifiOff
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import TikTokDownloader from '../tools/TikTokDownloader';
import SplitPromptViewer, { parseClipSegments } from '../tools/view/SplitPromptViewer';
import PhotoPromptGeneratorTool from '../tools/PhotoPromptGeneratorTool';
import ContentIdeasTool from '../tools/ContentIdeasTool';
import TikTokShopToIdeasTool from '../tools/TikTokShopToIdeasTool';
import VideoFrameExtractorTool from '../tools/VideoFrameExtractorTool';
import ApiKeySettingsView from '../views/ApiKeySettingsView';
import PaketAksesView from '../views/PaketAksesView';
import HistoryModal from '../modals/HistoryModal';
import AntiLimitModal from '../modals/AntiLimitModal';
import CommandPaletteModal from '../common/CommandPaletteModal';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { saveHistoryItem, getHistoryCount, HistoryItem } from '../../lib/history';
import { getAntiLimitHeaders, getActiveKeyDisplay } from '../../lib/antiLimit';
import { learningSync } from '../../lib/learningSync';
import { safeParseJson } from '../../lib/apiHelper';
import { UserSession } from '../../types/index';
import { UserUiSettings, DEFAULT_USER_UI_SETTINGS, getUserUiSettings, syncUserUiSettingsWithBackend } from '../../lib/admin/userUiSettings';
import { maskAccessCode } from '../../utils/maskAccessCode';
import { formatRemainingTime } from '../../utils/formatRemainingTime';
import { getClients, ClientItem } from '../../lib/admin/clients';
import { reportActiveGenerationStatus } from '../../events/generationEvent';

interface UserLayoutProps {
  session: UserSession;
  onLogout: () => void;
  onGoToAdmin?: () => void;
  initialTab?: string;
}

export default function UserLayout({ session, onLogout, onGoToAdmin, initialTab }: UserLayoutProps) {
  const getInitialTab = (): 'tiktok' | 'prompt' | 'photo' | 'ideas' | 'shop_ideas' | 'extractor' | 'paket' | 'pengaturan' => {
    if (initialTab && ['tiktok', 'prompt', 'photo', 'ideas', 'shop_ideas', 'extractor', 'paket', 'pengaturan'].includes(initialTab)) {
      return initialTab as any;
    }
    return 'pengaturan';
  };

  const [activeTab, setActiveTab] = useState<'tiktok' | 'prompt' | 'photo' | 'ideas' | 'shop_ideas' | 'extractor' | 'paket' | 'pengaturan'>(getInitialTab);
  const [photoInitialText, setPhotoInitialText] = useState<string>('');
  const [photoInitialNegativePrompt, setPhotoInitialNegativePrompt] = useState<string>('');
  const [photoInitialReferenceImage, setPhotoInitialReferenceImage] = useState<File | null>(null);

  // States for passing data to ContentIdeasTool & Extractor
  const [ideasInitialVideo, setIdeasInitialVideo] = useState<File | null>(null);
  const [ideasInitialTitle, setIdeasInitialTitle] = useState<string>('');
  const [ideasInitialTopic, setIdeasInitialTopic] = useState<string>('');
  const [ideasInitialUrl, setIdeasInitialUrl] = useState<string>('');
  const [extractorInitialVideo, setExtractorInitialVideo] = useState<File | null>(null);

  // Modals state
  const [isHistoryOpen, setIsHistoryOpen] = useState<boolean>(false);
  const [isAntiLimitOpen, setIsAntiLimitOpen] = useState<boolean>(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState<boolean>(false);
  const [historyBadge, setHistoryBadge] = useState<number>(() => getHistoryCount());
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  const [activeKeyText, setActiveKeyText] = useState<string>(() => getActiveKeyDisplay());
  const networkStatus = useNetworkStatus();

  // Global Keyboard Shortcuts (Cmd/Ctrl + K for Command Palette)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  // Client & Access Code Security States
  const [clientData, setClientData] = useState<ClientItem | null>(() => {
    if (session?.code) {
      const clients = getClients();
      const found = clients.find((c) => c.accessCode.toUpperCase() === session.code.toUpperCase());
      if (found) return found;
      return {
        id: 'session_client',
        accessCode: session.code,
        name: session.role === 'admin' ? 'Administrator' : 'Klien Satset',
        packageId: 'bulanan',
        packageName: 'Akses Bulanan (VIP)',
        price: 149000,
        startDate: new Date().toISOString(),
        expiryDate: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
        status: 'active',
        createdAt: new Date().toISOString()
      };
    }
    return null;
  });
  const [showFullCode, setShowFullCode] = useState<boolean>(false);
  const [copiedAccessCode, setCopiedAccessCode] = useState<boolean>(false);

  // User UI Settings State (Controlled by Admin)
  const [uiSettings, setUiSettings] = useState<UserUiSettings>(() => getUserUiSettings());

  useEffect(() => {
    const handleSyncUi = async () => {
      const synced = await syncUserUiSettingsWithBackend();
      if (synced) {
        setUiSettings(synced);
      }
    };

    handleSyncUi();
    window.addEventListener('satset_user_ui_settings_updated', handleSyncUi);
    return () => window.removeEventListener('satset_user_ui_settings_updated', handleSyncUi);
  }, []);

  useEffect(() => {
    const loadClientInfo = () => {
      const clients = getClients();
      const found = clients.find((c) => c.accessCode.toUpperCase() === session.code.toUpperCase());
      if (found) {
        setClientData(found);
      } else {
        setClientData({
          id: 'session_client',
          accessCode: session.code,
          name: session.role === 'admin' ? 'Administrator' : 'Klien Satset',
          packageId: 'bulanan',
          packageName: 'Akses Bulanan (VIP)',
          price: 149000,
          startDate: new Date().toISOString(),
          expiryDate: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
          status: 'active',
          createdAt: new Date().toISOString()
        });
      }
    };

    window.addEventListener('satset_clients_updated', loadClientInfo);
    return () => window.removeEventListener('satset_clients_updated', loadClientInfo);
  }, [session.code, session.role]);

  const handleCopyAccessCode = () => {
    if (!session?.code) return;
    navigator.clipboard.writeText(session.code);
    setCopiedAccessCode(true);
    setTimeout(() => setCopiedAccessCode(false), 2000);
  };

  const handleToggleCodeReveal = () => {
    if (!showFullCode) {
      setShowFullCode(true);
      setTimeout(() => setShowFullCode(false), 5000);
    } else {
      setShowFullCode(false);
    }
  };

  const clientName = session.name || clientData?.name || (session.role === 'admin' ? 'Administrator' : 'Klien Satset');
  const remainingTime = formatRemainingTime(clientData?.expiryDate);

  const updateActiveKey = useCallback(() => {
    setActiveKeyText(getActiveKeyDisplay());
  }, []);

  useEffect(() => {
    const handleHistUpdate = () => {
      setHistoryBadge(getHistoryCount());
    };
    const handleKeysUpdate = () => {
      updateActiveKey();
    };

    window.addEventListener('satset_history_updated', handleHistUpdate);
    window.addEventListener('api-keys-updated', handleKeysUpdate);

    return () => {
      window.removeEventListener('satset_history_updated', handleHistUpdate);
      window.removeEventListener('api-keys-updated', handleKeysUpdate);
    };
  }, [updateActiveKey]);

  useEffect(() => {
    if (!session || session.code === 'GUEST-ACCESS') return;

    const tabNames: Record<string, string> = {
      tiktok: 'TikTok Downloader',
      prompt: 'Video-to-Prompt AI',
      photo: 'Prompt Foto Nano',
      ideas: 'Ide Konten AI (AEO)',
      shop_ideas: 'TikTok Shop to Ideas',
      extractor: 'Video Frame Extractor',
      paket: 'Paket Akses',
      pengaturan: 'Pengaturan System'
    };

    const currentToolLabel = tabNames[activeTab] || 'Workspace Tool';
    const presenceId = `pres_${session.code}`;

    const sendPresence = () => {
      reportActiveGenerationStatus(
        presenceId,
        'active' as any,
        `Aktif mengakses tool: ${currentToolLabel} (${clientName})`
      );
    };

    sendPresence();
    const interval = setInterval(sendPresence, 20000);

    return () => {
      clearInterval(interval);
    };
  }, [activeTab, session, clientName]);

  const refreshHistoryBadge = () => {
    setHistoryBadge(getHistoryCount());
  };

  const handleSendToPhotoPrompt = (text: string, options?: { negativePrompt?: string; referenceImage?: File }) => {
    setPhotoInitialText(text);
    if (options?.negativePrompt) setPhotoInitialNegativePrompt(options.negativePrompt);
    if (options?.referenceImage) setPhotoInitialReferenceImage(options.referenceImage);
    setActiveTab('photo');
  };

  const handleGenerateIdeasFromTikTok = (videoFile?: File, tiktokTitle?: string, tiktokUrl?: string) => {
    if (videoFile) setIdeasInitialVideo(videoFile);
    if (tiktokTitle) setIdeasInitialTitle(tiktokTitle);
    if (tiktokUrl) setIdeasInitialUrl(tiktokUrl);
    setActiveTab('ideas');
  };

  const handleExtractFramesFromTikTok = (videoFile?: File) => {
    if (videoFile) setExtractorInitialVideo(videoFile);
    setActiveTab('extractor');
  };

  const handleRestoreItem = (item: HistoryItem) => {
    if (item.category === 'photo_prompt') {
      if (item.data.sourceText) {
        setPhotoInitialText(item.data.sourceText);
      }
      setActiveTab('photo');
    } else if (item.category === 'video_prompt') {
      if (item.data.prompt) {
        setPrompt(item.data.prompt);
        if (item.data.modelUsed) setActiveModelUsed(item.data.modelUsed);
      }
      setActiveTab('prompt');
    } else if (item.category === 'content_ideas') {
      if (item.data.sourceText) {
        setIdeasInitialTopic(item.data.sourceText);
      }
      setActiveTab('ideas');
    } else if (item.category === 'tiktok_download') {
      setActiveTab('tiktok');
    } else if (item.category === 'frame_extraction') {
      setActiveTab('extractor');
    }
  };

  // Video to Prompt States
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [prompt, setPrompt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<string>('gemini-3.6-flash');
  const [activeModelUsed, setActiveModelUsed] = useState<string | null>(null);

  // Granular Progress States for Video Split Process
  const [progressStep, setProgressStep] = useState<string>('Mengunggah & membaca data video...');
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [currentClipProcessing, setCurrentClipProcessing] = useState<{ current: number; total: number } | null>(null);

  // Advanced Prompt Segmentation & Formatting Options
  const [segmentDuration, setSegmentDuration] = useState<string>('5');
  const [targetAI, setTargetAI] = useState<string>('general');
  const [includeActions, setIncludeActions] = useState<boolean>(true);
  const [includeVoiceOver, setIncludeVoiceOver] = useState<boolean>(true);
  const [includeCinematics, setIncludeCinematics] = useState<boolean>(true);

  // TikTok Link Input States for Video to Prompt
  const [videoInputMode, setVideoInputMode] = useState<'upload' | 'tiktok'>('upload');
  const [tiktokInputUrl, setTiktokInputUrl] = useState<string>('');
  const [isFetchingTikTokVideo, setIsFetchingTikTokVideo] = useState<boolean>(false);
  const [tiktokInputError, setTiktokInputError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAnalyzeFromTikTok = (tiktokVideoFile: File) => {
    handleFileSelection(tiktokVideoFile);
    setActiveTab('prompt');
  };

  const handleFetchTikTokVideo = async (e?: React.FormEvent, overrideUrl?: string) => {
    if (e) e.preventDefault();
    const rawInput = (overrideUrl || tiktokInputUrl).trim();

    if (!rawInput) {
      setTiktokInputError('Silakan masukkan link URL TikTok.');
      return;
    }

    // Auto extract clean URL if user pastes share text containing URL
    let targetUrl = rawInput;
    const urlMatch = rawInput.match(/https?:\/\/[^\s]+/i);
    if (urlMatch) {
      targetUrl = urlMatch[0].replace(/[)\]}>,;."']+$/, '');
    }

    if (!targetUrl.includes('tiktok.com') && !targetUrl.includes('douyin.com')) {
      setTiktokInputError('URL tidak valid. Pastikan menyalin tautan resmi dari TikTok (contoh: https://vt.tiktok.com/xxxx).');
      return;
    }

    setIsFetchingTikTokVideo(true);
    setTiktokInputError(null);

    try {
      const res = await fetch('/api/tiktok/info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: targetUrl }),
      });

      const data = await safeParseJson(res);
      if (data.error && !data.hdplay && !data.play) {
        throw new Error(data.error || 'Gagal memproses link TikTok.');
      }

      const videoSource = data.hdplay || data.play || data.wmplay;

      if (!videoSource) {
        throw new Error('Gagal mendapatkan file video dari tautan TikTok tersebut. Pastikan video publik.');
      }

      const proxyUrl = `/api/tiktok/proxy?url=${encodeURIComponent(videoSource)}`;
      const videoRes = await fetch(proxyUrl);

      if (!videoRes.ok) {
        throw new Error('Gagal mengunduh berkas video TikTok dari proxy.');
      }

      const blob = await videoRes.blob();
      const rawTitle = (data.title || 'tiktok_video').replace(/[^a-zA-Z0-9]/g, '_');
      const safeTitle = rawTitle.slice(0, 30) || 'video';
      const tiktokFile = new File([blob], `@${data.author?.uniqueId || 'tiktok'}_${safeTitle}.mp4`, {
        type: 'video/mp4',
      });

      handleFileSelection(tiktokFile);
      learningSync.track('tiktok_link_imported', { url: targetUrl, title: data.title });
    } catch (err: any) {
      console.error(err);
      setTiktokInputError(err.message || 'Gagal memproses link TikTok. Coba gunakan file lokal.');
    } finally {
      setIsFetchingTikTokVideo(false);
    }
  };

  const handlePasteTikTokUrl = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setTiktokInputUrl(text);
        setTiktokInputError(null);
        if (text.includes('tiktok.com') || text.includes('douyin.com')) {
          handleFetchTikTokVideo(undefined, text);
        }
      }
    } catch (e) {
      setTiktokInputError('Tidak dapat mengakses clipboard secara otomatis. Silakan tempel dengan Ctrl+V.');
    }
  };

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
      handleFileSelection(droppedFile);
    }
  };

  const handleFileInput = (e: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      handleFileSelection(selectedFile);
    }
  };

  const handleFileSelection = (selectedFile: File) => {
    setError(null);
    setPrompt(null);
    setActiveModelUsed(null);
    
    if (!selectedFile.type.startsWith('video/')) {
      setError('Mohon unggah file video yang valid.');
      return;
    }

    setFile(selectedFile);
    const url = URL.createObjectURL(selectedFile);
    setPreviewUrl(url);

    const tempVid = document.createElement('video');
    tempVid.src = url;
    tempVid.onloadedmetadata = () => {
      const durationSec = Math.round(tempVid.duration || 0);
      learningSync.track('video_uploaded', {
        fileName: selectedFile.name,
        fileSize: selectedFile.size,
        fileType: selectedFile.type,
        duration: durationSec,
      });
    };
    tempVid.onerror = () => {
      learningSync.track('video_uploaded', {
        fileName: selectedFile.name,
        fileSize: selectedFile.size,
        fileType: selectedFile.type,
        duration: 0,
      });
    };
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result.split(',')[1]);
        } else {
          reject(new Error('Gagal mengonversi file video'));
        }
      };
      reader.onerror = error => reject(error);
    });
  };

  const generatePrompt = async () => {
    if (!file) return;
    
    setIsGenerating(true);
    setError(null);
    setProgressPercent(10);
    setProgressStep('Membaca & mengonversi data video...');
    setCurrentClipProcessing(null);

    let estimatedClipsCount = 4;
    if (segmentDuration !== 'auto') {
      const sec = parseInt(segmentDuration, 10) || 10;
      estimatedClipsCount = Math.max(1, Math.min(12, Math.ceil(30 / sec)));
    }

    let currPct = 10;
    const progressInterval = setInterval(() => {
      currPct += Math.floor(Math.random() * 8) + 4;
      if (currPct > 92) currPct = 92;
      setProgressPercent(currPct);

      if (currPct < 25) {
        setProgressStep('Menganalisis pergerakan & pencahayaan video...');
        setCurrentClipProcessing(null);
      } else if (currPct < 85) {
        const totalClips = estimatedClipsCount;
        const clipIndex = Math.min(totalClips, Math.max(1, Math.floor(((currPct - 25) / 60) * totalClips) + 1));
        setCurrentClipProcessing({ current: clipIndex, total: totalClips });
        setProgressStep(`Memproses klip ${clipIndex} dari ${totalClips}...`);
      } else {
        setCurrentClipProcessing(null);
        setProgressStep('Menyusun Master Prompt & format tag sinematik...');
      }
    }, 550);
    
    try {
      const base64Data = await fileToBase64(file);
      
      const res = await fetch('/api/generate-prompt', {
        method: 'POST',
        headers: getAntiLimitHeaders(),
        body: JSON.stringify({
          mimeType: file.type,
          base64Data,
          model: selectedModel,
          segmentDuration,
          targetAI,
          includeActions,
          includeVoiceOver,
          includeCinematics,
        }),
      });

      const data = await safeParseJson(res);

      clearInterval(progressInterval);
      setProgressPercent(100);
      setProgressStep('Selesai memecah prompt klip!');

      setPrompt(data.prompt);
      setActiveModelUsed(data.modelUsed || selectedModel);

      const parsedClips = parseClipSegments(data.prompt);
      const exactClipCount = parsedClips.length || estimatedClipsCount;

      learningSync.track('prompt_split_generated', {
        clipCount: exactClipCount,
        parameters: {
          segmentDuration,
          selectedModel,
          targetAI,
          includeActions,
          includeVoiceOver,
          includeCinematics,
          fileName: file.name,
        },
      });

      saveHistoryItem({
        category: 'video_prompt',
        title: `Video Prompt: ${file.name}`,
        subtitle: `Split ${segmentDuration !== 'auto' ? segmentDuration + 's' : 'Penuh'} • Target ${targetAI.toUpperCase()}`,
        data: {
          prompt: data.prompt,
          modelUsed: data.modelUsed || selectedModel,
          segmentDuration,
          targetAI,
          fileName: file.name,
        },
      });
      refreshHistoryBadge();
    } catch (err: any) {
      clearInterval(progressInterval);
      console.error(err);
      setError(err.message || 'An error occurred while generating the prompt.');
    } finally {
      setIsGenerating(false);
    }
  };

  const reset = () => {
    setFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPrompt(null);
    setError(null);
    setActiveModelUsed(null);
    setTiktokInputUrl('');
    setTiktokInputError(null);
  };

  const navItemsTools = [
    { id: 'tiktok', label: 'TikTok Downloader', icon: Download },
    { id: 'shop_ideas', label: 'TikTok Shop Ideas', icon: ShoppingBag },
    { id: 'ideas', label: 'Ide Konten', icon: Lightbulb },
    { id: 'prompt', label: 'Video to Prompt', icon: Clapperboard },
    { id: 'photo', label: 'Prompt Foto', icon: Camera },
    { id: 'extractor', label: 'Ekstraktor Frame', icon: Scissors },
  ];

  const navItemsAccount = [
    { id: 'paket', label: 'Paket & akses', icon: CreditCard },
    { id: 'pengaturan', label: 'Pengaturan', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 font-sans flex flex-col md:flex-row antialiased">
      
      {/* MOBILE TOP BAR */}
      <div className="md:hidden bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between sticky top-0 z-30 shadow-2xs">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#5b50e5] flex items-center justify-center text-white font-bold text-sm">
            TS
          </div>
          <div>
            <span className="text-base font-bold text-[#5b50e5] leading-none block">Tools Satset</span>
            <span className="text-[10px] text-slate-400 font-medium leading-none">Creator Workspace</span>
          </div>
        </div>

        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
        >
          {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* MOBILE SIDEBAR OVERLAY DRAWER */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-40 md:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="w-72 bg-white h-full p-5 flex flex-col justify-between shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="space-y-6">
                {/* Brand */}
                <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[#5b50e5] flex items-center justify-center text-white font-bold text-base">
                      TS
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-[#5b50e5] tracking-tight leading-tight">Tools Satset</h2>
                      <p className="text-xs text-slate-400">Creator Workspace</p>
                    </div>
                  </div>

                  <button
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Navigation Items */}
                <div className="space-y-5">
                  <button
                    onClick={() => {
                      setIsHistoryOpen(true);
                      setIsMobileMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100 transition-all text-left"
                  >
                    <RotateCcw className="w-4 h-4 text-slate-500" />
                    <span>Riwayat</span>
                    {historyBadge > 0 && (
                      <span className="ml-auto bg-indigo-100 text-[#5b50e5] font-bold text-xs px-2 py-0.5 rounded-full">
                        {historyBadge}
                      </span>
                    )}
                  </button>

                  <div>
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-3.5 mb-2">
                      TOOLS
                    </p>
                    <div className="space-y-1">
                      {navItemsTools.map((item) => {
                        const Icon = item.icon;
                        const isActive = activeTab === item.id;
                        return (
                          <button
                            key={item.id}
                            onClick={() => {
                              setActiveTab(item.id as any);
                              setIsMobileMenuOpen(false);
                            }}
                            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all text-left ${
                              isActive
                                ? 'bg-[#5b50e5] text-white shadow-xs font-semibold'
                                : 'text-slate-600 hover:bg-slate-100'
                            }`}
                          >
                            <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                            <span>{item.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-3.5 mb-2">
                      ACCOUNT
                    </p>
                    <div className="space-y-1">
                      {navItemsAccount.map((item) => {
                        const Icon = item.icon;
                        const isActive = activeTab === item.id;
                        return (
                          <button
                            key={item.id}
                            onClick={() => {
                              setActiveTab(item.id as any);
                              setIsMobileMenuOpen(false);
                            }}
                            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all text-left ${
                              isActive
                                ? 'bg-[#5b50e5] text-white shadow-xs font-semibold'
                                : 'text-slate-600 hover:bg-slate-100'
                            }`}
                          >
                            <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                            <span>{item.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Drawer Actions */}
              <div className="space-y-2 pt-4 border-t border-slate-100">
                <button
                  onClick={() => {
                    setActiveTab('pengaturan');
                    setIsMobileMenuOpen(false);
                  }}
                  className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium border border-slate-200 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Key className="w-3.5 h-3.5 text-[#5b50e5]" />
                    <span className="font-mono">{activeKeyText}</span>
                  </div>
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                </button>

                <button
                  onClick={onLogout}
                  className="w-full flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-rose-50 text-rose-700 hover:bg-rose-100 text-xs font-bold transition-colors border border-rose-200/60 cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Keluar Akun ({clientName})</span>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* DESKTOP PERMANENT SIDEBAR */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-r border-slate-200/80 min-h-screen shrink-0 p-5 select-none justify-between">
        <div className="space-y-6">
          {/* Brand Header */}
          <div className="flex items-center gap-3 px-2 pb-2">
            <div className="w-9 h-9 rounded-xl bg-[#5b50e5] flex items-center justify-center text-white font-bold text-base shadow-xs">
              TS
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#5b50e5] tracking-tight leading-none">Tools Satset</h2>
              <p className="text-xs text-slate-400 mt-0.5">Creator Workspace</p>
            </div>
          </div>

          {/* Navigation Links */}
          <div className="space-y-6 pt-2">
            {/* Top Single Item: Riwayat */}
            <button
              onClick={() => setIsHistoryOpen(true)}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100 transition-all text-left cursor-pointer"
            >
              <RotateCcw className="w-4 h-4 text-slate-500" />
              <span>Riwayat</span>
              {historyBadge > 0 && (
                <span className="ml-auto bg-indigo-100 text-[#5b50e5] font-bold text-xs px-2 py-0.5 rounded-full">
                  {historyBadge}
                </span>
              )}
            </button>

            {/* Section: TOOLS */}
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-3.5 mb-2">
                TOOLS
              </p>
              <div className="space-y-1">
                {navItemsTools.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <motion.button
                      key={item.id}
                      whileHover={{ x: 3 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setActiveTab(item.id as any)}
                      className={`relative w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors text-left cursor-pointer ${
                        isActive
                          ? 'bg-[#5b50e5] text-white shadow-sm font-semibold'
                          : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
                      }`}
                    >
                      {isActive && (
                        <motion.div
                          layoutId="activeNavPillDesktop"
                          className="absolute inset-0 bg-[#5b50e5] rounded-xl -z-10"
                          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                        />
                      )}
                      <Icon className={`w-4 h-4 shrink-0 transition-transform ${isActive ? 'text-white scale-110' : 'text-slate-500'}`} />
                      <span className="relative z-10">{item.label}</span>
                    </motion.button>
                  );
                })}
              </div>
            </div>

            {/* Section: ACCOUNT */}
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-3.5 mb-2">
                ACCOUNT
              </p>
              <div className="space-y-1">
                {navItemsAccount.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <motion.button
                      key={item.id}
                      whileHover={{ x: 3 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setActiveTab(item.id as any)}
                      className={`relative w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors text-left cursor-pointer ${
                        isActive
                          ? 'bg-[#5b50e5] text-white shadow-sm font-semibold'
                          : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
                      }`}
                    >
                      {isActive && (
                        <motion.div
                          layoutId="activeNavPillDesktop"
                          className="absolute inset-0 bg-[#5b50e5] rounded-xl -z-10"
                          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                        />
                      )}
                      <Icon className={`w-4 h-4 shrink-0 transition-transform ${isActive ? 'text-white scale-110' : 'text-slate-500'}`} />
                      <span className="relative z-10">{item.label}</span>
                    </motion.button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Desktop Sidebar Footer (Active Key Pill & Session Card) */}
        <div className="space-y-2 pt-4 border-t border-slate-100">
          <button
            onClick={() => setActiveTab('pengaturan')}
            className="w-full flex items-center justify-between px-3.5 py-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium border border-slate-200 transition-colors cursor-pointer"
            title="Klik untuk membuka Pengaturan API Key"
          >
            <div className="flex items-center gap-2">
              <Key className="w-3.5 h-3.5 text-[#5b50e5]" />
              <span className="font-mono">{activeKeyText}</span>
            </div>
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
          </button>

          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/70 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block">Sesi Klien</span>
              <button
                type="button"
                onClick={handleCopyAccessCode}
                className="text-[10px] font-bold text-[#5b50e5] hover:underline flex items-center gap-1 cursor-pointer"
                title="Salin Kode Akses"
              >
                {copiedAccessCode ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-600" />
                    <span className="text-emerald-600">Disalin!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Salin Kode</span>
                  </>
                )}
              </button>
            </div>

            <div className="flex items-center justify-between gap-1">
              <div className="space-y-0.5 min-w-0 flex-1">
                <div className="text-xs font-bold text-slate-900 truncate" title={clientName}>
                  {clientName}
                </div>
                <div className="text-[11px] font-mono text-slate-500 font-semibold truncate">
                  {showFullCode ? session.code : maskAccessCode(session.code)}
                </div>
                <div className={`text-[10px] font-bold ${
                  remainingTime.urgency === 'expired' ? 'text-rose-600' :
                  remainingTime.urgency === 'warning' ? 'text-amber-600' : 'text-emerald-600'
                }`}>
                  {remainingTime.label}
                </div>
              </div>

              <div className="flex flex-col gap-1 shrink-0">
                <button
                  type="button"
                  onClick={handleToggleCodeReveal}
                  className="p-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-500 transition-colors cursor-pointer"
                  title={showFullCode ? "Sembunyikan Kode" : "Tampilkan Kode (5 Detik)"}
                >
                  {showFullCode ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
                <button
                  onClick={onLogout}
                  className="p-1.5 rounded-lg bg-white border border-slate-200 hover:bg-rose-50 hover:text-rose-600 text-slate-500 transition-colors cursor-pointer"
                  title="Keluar dari Akun"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
        
        {/* TOP HEADER BAR */}
        <header className="bg-white border-b border-slate-200/80 px-4 sm:px-6 py-2.5 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            {session.role === 'admin' && onGoToAdmin && (
              <button
                type="button"
                onClick={onGoToAdmin}
                className="px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-900 font-extrabold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
              >
                <ShieldCheck className="w-4 h-4 text-slate-900" />
                <span>Ke Console Admin</span>
              </button>
            )}

            {/* Quick Command Palette Button */}
            <button
              type="button"
              onClick={() => setIsCommandPaletteOpen(true)}
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-medium border border-slate-200 transition-colors cursor-pointer"
            >
              <Search className="w-3.5 h-3.5 text-slate-400" />
              <span>Cari Tool / Aksi...</span>
              <kbd className="text-[10px] font-mono font-bold bg-white px-1.5 py-0.5 rounded border border-slate-300 text-slate-500 shadow-2xs">
                ⌘K
              </kbd>
            </button>
            
            {/* Header Badge: Nama Klien + Sisa Waktu Paket */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 border border-slate-200 text-xs font-medium text-slate-700">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-slate-900">{clientName}</span>
                <span className="text-slate-400">·</span>
                <span className={`font-semibold ${
                  remainingTime.urgency === 'expired' ? 'text-rose-600' :
                  remainingTime.urgency === 'warning' ? 'text-amber-600' : 'text-emerald-600'
                }`}>
                  {remainingTime.label}
                </span>
              </div>

              {/* Salin Kode Akses Button */}
              <button
                type="button"
                onClick={handleCopyAccessCode}
                className="p-1 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-white transition-colors cursor-pointer ml-1"
                title="Salin Kode Akses ke Clipboard"
              >
                {copiedAccessCode ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              </button>

              {/* Reveal Toggle Eye Button */}
              <button
                type="button"
                onClick={handleToggleCodeReveal}
                className="p-1 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-white transition-colors cursor-pointer"
                title={showFullCode ? "Sembunyikan Kode Akses" : "Tampilkan Kode Akses"}
              >
                {showFullCode ? <EyeOff className="w-3.5 h-3.5 text-indigo-600" /> : <Eye className="w-3.5 h-3.5" />}
              </button>

              {showFullCode && (
                <span className="font-mono text-[11px] bg-slate-200/80 px-1.5 py-0.5 rounded text-slate-800 ml-1">
                  {maskAccessCode(session.code)}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setActiveTab('pengaturan')}
              className="p-2 rounded-full text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
              title="Bantuan & FAQ API"
            >
              <HelpCircle className="w-5 h-5" />
            </button>

            <div 
              onClick={() => setActiveTab('paket')}
              className="px-3 py-1.5 rounded-full bg-[#3525cd] text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-2xs hover:bg-[#2c1eb3] transition-colors"
              title={`Akses Aktif: ${maskAccessCode(session.code)}`}
            >
              <span>{session.role === 'admin' ? 'ADMIN' : 'USER'}</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
            </div>

            <button
              type="button"
              onClick={onLogout}
              className="p-2 rounded-full text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
              title="Keluar / Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* OFFLINE STATUS BANNER */}
        {!networkStatus.isOnline && (
          <div className="bg-amber-500 text-white px-4 py-2 text-xs font-semibold flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2">
              <WifiOff className="w-4 h-4 animate-pulse shrink-0" />
              <span>Koneksi internet terputus. Sistem akan otomatis menghubungkan kembali saat online...</span>
            </div>
            <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-bold">Offline Mode</span>
          </div>
        )}

        {/* PAGE VIEW RENDERER */}
        <main className="flex-1 p-4 sm:p-6 md:p-8 overflow-y-auto bg-[#f8fafc]">
          <motion.div 
            initial={false}
            animate={{ opacity: activeTab === 'pengaturan' ? 1 : 0, y: activeTab === 'pengaturan' ? 0 : 8 }} 
            transition={{ duration: 0.25 }}
            className={activeTab === 'pengaturan' ? 'block' : 'hidden'}
          >
            <ApiKeySettingsView onKeysUpdated={updateActiveKey} />
          </motion.div>

          <motion.div 
            initial={false}
            animate={{ opacity: activeTab === 'paket' ? 1 : 0, y: activeTab === 'paket' ? 0 : 8 }} 
            transition={{ duration: 0.25 }}
            className={activeTab === 'paket' ? 'block' : 'hidden'}
          >
            <PaketAksesView />
          </motion.div>

          <motion.div 
            initial={false}
            animate={{ opacity: activeTab === 'tiktok' ? 1 : 0, y: activeTab === 'tiktok' ? 0 : 8 }} 
            transition={{ duration: 0.25 }}
            className={activeTab === 'tiktok' ? 'block' : 'hidden'}
          >
            <TikTokDownloader 
              onAnalyzeVideo={handleAnalyzeFromTikTok} 
              onGenerateContentIdeas={handleGenerateIdeasFromTikTok}
              onExtractFrames={handleExtractFramesFromTikTok}
            />
          </motion.div>

          <motion.div 
            initial={false}
            animate={{ opacity: activeTab === 'shop_ideas' ? 1 : 0, y: activeTab === 'shop_ideas' ? 0 : 8 }} 
            transition={{ duration: 0.25 }}
            className={activeTab === 'shop_ideas' ? 'block' : 'hidden'}
          >
            <TikTokShopToIdeasTool 
              onSendToPhotoPrompt={handleSendToPhotoPrompt}
              onSendToVideoPrompt={(promptText) => {
                setActiveTab('prompt');
              }}
            />
          </motion.div>

          <motion.div 
            initial={false}
            animate={{ opacity: activeTab === 'ideas' ? 1 : 0, y: activeTab === 'ideas' ? 0 : 8 }} 
            transition={{ duration: 0.25 }}
            className={activeTab === 'ideas' ? 'block' : 'hidden'}
          >
            <ContentIdeasTool
              initialVideoFile={ideasInitialVideo}
              initialTikTokTitle={ideasInitialTitle}
              initialTopic={ideasInitialTopic}
              initialTikTokUrl={ideasInitialUrl}
              onSendToPhotoPrompt={handleSendToPhotoPrompt}
            />
          </motion.div>

          <motion.div 
            initial={false}
            animate={{ opacity: activeTab === 'photo' ? 1 : 0, y: activeTab === 'photo' ? 0 : 8 }} 
            transition={{ duration: 0.25 }}
            className={activeTab === 'photo' ? 'block' : 'hidden'}
          >
            <PhotoPromptGeneratorTool 
              initialConcept={photoInitialText} 
              initialNegativePrompt={photoInitialNegativePrompt} 
              initialReferenceImage={photoInitialReferenceImage} 
            />
          </motion.div>

          <motion.div 
            initial={false}
            animate={{ opacity: activeTab === 'extractor' ? 1 : 0, y: activeTab === 'extractor' ? 0 : 8 }} 
            transition={{ duration: 0.25 }}
            className={activeTab === 'extractor' ? 'block' : 'hidden'}
          >
            <VideoFrameExtractorTool initialFile={extractorInitialVideo} />
          </motion.div>

          <motion.div 
            initial={false}
            animate={{ opacity: activeTab === 'prompt' ? 1 : 0, y: activeTab === 'prompt' ? 0 : 8 }} 
            transition={{ duration: 0.25 }}
            className={activeTab === 'prompt' ? 'block' : 'hidden'}
          >
            <div className="max-w-5xl mx-auto space-y-6">
              {/* Page Title */}
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Video to Prompt</h1>
                <p className="text-sm text-slate-500 mt-1">Ubah video menjadi prompt AI sinematik & pecah durasi per klip adegan.</p>
              </div>

              {/* Controls Card */}
              <div className="bg-white border border-slate-200/80 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Option 1: Split Duration */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <Scissors className="w-3.5 h-3.5 text-[#5b50e5]" />
                      Pecah Durasi Prompt Per Klip
                    </label>
                    <div className="grid grid-cols-5 gap-1 p-1 bg-slate-100 border border-slate-200 rounded-xl text-xs font-medium">
                      {[
                        { id: '5', label: '5s' },
                        { id: '8', label: '8s' },
                        { id: '10', label: '10s' },
                        { id: '15', label: '15s' },
                        { id: 'auto', label: 'Penuh' },
                      ].map((item) => (
                        <button
                          type="button"
                          key={item.id}
                          onClick={() => {
                            setSegmentDuration(item.id);
                            learningSync.track('split_duration_selected', { duration: item.id });
                          }}
                          className={`py-2 rounded-lg text-center transition-all cursor-pointer ${
                            segmentDuration === item.id
                              ? 'bg-[#5b50e5] text-white font-bold shadow-2xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Option 2: Engine Model Gemini */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <Cpu className="w-3.5 h-3.5 text-amber-500" />
                      Engine Model AI
                    </label>
                    <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 border border-slate-200 rounded-xl text-xs font-medium">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedModel('gemini-3.6-flash');
                          learningSync.track('ai_engine_selected', { model: 'gemini-3.6-flash' });
                        }}
                        className={`py-2 rounded-lg text-center transition-all cursor-pointer ${
                          selectedModel === 'gemini-3.6-flash'
                            ? 'bg-[#5b50e5] text-white font-bold shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Gemini 3.6 Flash
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedModel('gemini-3.1-pro-preview');
                          learningSync.track('ai_engine_selected', { model: 'gemini-3.1-pro-preview' });
                        }}
                        className={`py-2 rounded-lg text-center transition-all cursor-pointer ${
                          selectedModel === 'gemini-3.1-pro-preview'
                            ? 'bg-[#5b50e5] text-white font-bold shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Gemini 3.1 Pro
                      </button>
                    </div>
                  </div>
                </div>

                {/* Checkboxes */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-100 text-xs">
                  <span className="text-slate-500 font-bold flex items-center gap-1">
                    <Sliders className="w-3.5 h-3.5 text-slate-400" />
                    Elemen Detail Rincian:
                  </span>
                  
                  <div className="flex flex-wrap items-center gap-4">
                    <label className="flex items-center gap-2 cursor-pointer text-slate-700 hover:text-slate-900">
                      <input
                        type="checkbox"
                        checked={includeActions}
                        onChange={(e) => {
                          setIncludeActions(e.target.checked);
                          learningSync.track('detail_element_toggled', { element: 'actions', enabled: e.target.checked });
                        }}
                        className="rounded border-slate-300 text-[#5b50e5] focus:ring-[#5b50e5]"
                      />
                      <span>Aksi & Gerakan (Action)</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer text-slate-700 hover:text-slate-900">
                      <input
                        type="checkbox"
                        checked={includeVoiceOver}
                        onChange={(e) => {
                          setIncludeVoiceOver(e.target.checked);
                          learningSync.track('detail_element_toggled', { element: 'voiceover', enabled: e.target.checked });
                        }}
                        className="rounded border-slate-300 text-[#5b50e5] focus:ring-[#5b50e5]"
                      />
                      <span>Transkrip Voice Over / VO</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer text-slate-700 hover:text-slate-900">
                      <input
                        type="checkbox"
                        checked={includeCinematics}
                        onChange={(e) => {
                          setIncludeCinematics(e.target.checked);
                          learningSync.track('detail_element_toggled', { element: 'cinematics', enabled: e.target.checked });
                        }}
                        className="rounded border-slate-300 text-[#5b50e5] focus:ring-[#5b50e5]"
                      />
                      <span>Kamera & Lighting</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Drag and Drop Upload / TikTok Link Input */}
              {!file ? (
                <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-6 shadow-sm space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                        Pilih Sumber Video:
                      </span>
                    </div>

                    <div className="inline-flex p-1 bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold">
                      <button
                        type="button"
                        onClick={() => {
                          setVideoInputMode('upload');
                          setTiktokInputError(null);
                        }}
                        className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                          videoInputMode === 'upload'
                            ? 'bg-[#5b50e5] text-white shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>Unggah File Video</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setVideoInputMode('tiktok');
                          setError(null);
                        }}
                        className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                          videoInputMode === 'tiktok'
                            ? 'bg-[#5b50e5] text-white shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <LinkIcon className="w-3.5 h-3.5 text-amber-300" />
                        <span>Input Link TikTok</span>
                        <span className="px-1.5 py-0.2 rounded-full bg-emerald-500 text-white text-[9px] font-extrabold uppercase">Direct</span>
                      </button>
                    </div>
                  </div>

                  {videoInputMode === 'upload' ? (
                    <AnimatePresence mode="wait">
                      <motion.div
                        key="upload"
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.98 }}
                        className={`relative rounded-2xl border-2 border-dashed transition-all bg-slate-50/50 p-8 sm:p-12 text-center cursor-pointer shadow-sm
                          ${isDragging ? 'border-[#5b50e5] bg-indigo-50/50' : 'border-slate-200 hover:border-[#5b50e5] hover:bg-slate-50/80'}
                          ${error ? 'border-rose-300 bg-rose-50/50' : ''}
                        `}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <div className="flex flex-col items-center justify-center">
                          <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-[#5b50e5] mb-4 shadow-2xs">
                            <Upload className="w-8 h-8" />
                          </div>
                          <h3 className="text-lg font-bold text-slate-900 mb-1">Unggah Berkas Video Anda</h3>
                          <p className="text-xs sm:text-sm text-slate-500 mb-6 max-w-md">
                            Tarik & lepas berkas video di sini, atau klik untuk memilih file.
                            <br />
                            <span className="text-slate-400 text-xs">Akan dipecah per {segmentDuration !== 'auto' ? `${segmentDuration} detik` : 'keseluruhan durasi'}</span>
                          </p>
                          <button type="button" className="px-6 py-2.5 rounded-xl bg-[#5b50e5] hover:bg-[#4f46e5] text-white font-medium text-sm transition-all shadow-xs cursor-pointer">
                            Pilih File Video
                          </button>
                          <input 
                            type="file" 
                            ref={fileInputRef} 
                            onChange={handleFileInput} 
                            accept="video/*" 
                            className="hidden" 
                          />
                        </div>
                      </motion.div>
                    </AnimatePresence>
                  ) : (
                    <AnimatePresence mode="wait">
                      <motion.div
                        key="tiktok_input"
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.98 }}
                        className="rounded-2xl border border-slate-200 bg-slate-50/50 p-6 sm:p-8 space-y-4"
                      >
                        <div className="space-y-1">
                          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                            <LinkIcon className="w-4 h-4 text-[#5b50e5]" />
                            Tempelkan Link Video TikTok
                          </h3>
                          <p className="text-xs text-slate-500">
                            Sistem akan mengambil video secara otomatis dari link TikTok tersebut untuk langsung diolah menjadi prompt sinematik.
                          </p>
                        </div>

                        <form onSubmit={handleFetchTikTokVideo} className="space-y-3">
                          <div className="relative flex items-center">
                            <input
                              type="text"
                              required
                              placeholder="Contoh: https://vt.tiktok.com/xxxx atau https://www.tiktok.com/@user/video/xxxx"
                              value={tiktokInputUrl}
                              onChange={(e) => setTiktokInputUrl(e.target.value)}
                              className="w-full pl-4 pr-28 py-3 rounded-xl border border-slate-300 text-xs sm:text-sm focus:ring-2 focus:ring-[#5b50e5] focus:border-[#5b50e5] outline-none bg-white shadow-xs font-medium text-slate-900"
                            />

                            <button
                              type="button"
                              onClick={handlePasteTikTokUrl}
                              className="absolute right-2 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                              title="Tempel dari Clipboard"
                            >
                              <Clipboard className="w-3.5 h-3.5" />
                              <span>Tempel</span>
                            </button>
                          </div>

                          {tiktokInputError && (
                            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-2">
                              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                              <span>{tiktokInputError}</span>
                            </div>
                          )}

                          <div className="flex items-center justify-end gap-3 pt-2">
                            <button
                              type="submit"
                              disabled={isFetchingTikTokVideo || !tiktokInputUrl.trim()}
                              className="px-6 py-2.5 rounded-xl bg-[#5b50e5] hover:bg-[#4f46e5] text-white font-bold text-xs sm:text-sm transition-all shadow-xs flex items-center gap-2 cursor-pointer disabled:opacity-50"
                            >
                              {isFetchingTikTokVideo ? (
                                <>
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                  <span>Mengambil Video TikTok...</span>
                                </>
                              ) : (
                                <>
                                  <Sparkles className="w-4 h-4 text-amber-300" />
                                  <span>Import & Analisis Video TikTok</span>
                                </>
                              )}
                            </button>
                          </div>
                        </form>
                      </motion.div>
                    </AnimatePresence>
                  )}
                </div>
              ) : (
                <AnimatePresence mode="wait">
                  <motion.div
                    key="preview"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-6"
                  >
                    <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
                      <div className="flex items-center gap-4 w-full md:w-auto">
                        <div className="relative rounded-xl overflow-hidden bg-slate-900 border border-slate-200 w-32 aspect-video shrink-0">
                          <video 
                            src={previewUrl!} 
                            controls 
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <FileVideo className="w-4 h-4 text-[#5b50e5] shrink-0" />
                            <h4 className="text-sm font-bold text-slate-900 truncate max-w-[200px]">{file.name}</h4>
                          </div>
                          <p className="text-xs text-slate-500">
                            Ukuran: {(file.size / (1024 * 1024)).toFixed(1)} MB
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 w-full md:w-auto justify-end">
                        <button 
                          type="button"
                          onClick={reset}
                          className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors text-xs font-medium flex items-center gap-1.5 border border-slate-200 cursor-pointer"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>Ganti Video</span>
                        </button>

                        <button
                          type="button"
                          onClick={generatePrompt}
                          disabled={isGenerating}
                          className="px-5 py-2.5 rounded-xl bg-[#5b50e5] hover:bg-[#4f46e5] text-white font-medium text-xs sm:text-sm flex items-center gap-2 transition-all shadow-xs cursor-pointer"
                        >
                          {isGenerating ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              <span>Memproses...</span>
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-4 h-4 text-amber-300" />
                              <span>{prompt ? 'Proses Ulang' : 'Analisis & Pecah Prompt'}</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Split Progress */}
                    {isGenerating ? (
                      <div className="p-8 sm:p-12 rounded-2xl border border-slate-200/80 bg-white shadow-sm flex flex-col items-center justify-center text-center space-y-4">
                        <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-[#5b50e5]">
                          <Loader2 className="w-6 h-6 animate-spin" />
                        </div>

                        <div>
                          <h3 className="text-base font-bold text-slate-900 mb-1">Sedang Menganalisis Video</h3>
                          <p className="text-slate-500 text-xs max-w-sm">
                            Engine <span className="text-[#5b50e5] font-semibold">{selectedModel}</span> sedang memproses segmen per <strong className="text-slate-800">{segmentDuration !== 'auto' ? segmentDuration + 's' : 'Penuh'}</strong>
                          </p>
                        </div>

                        <div className="w-full max-w-md p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
                          <div className="flex items-center justify-between text-xs font-semibold">
                            <span className="text-slate-700 flex items-center gap-1.5 truncate">
                              <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                              <span>{progressStep}</span>
                            </span>
                            <span className="text-slate-900 font-mono shrink-0 ml-2">{progressPercent}%</span>
                          </div>

                          <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                            <motion.div
                              className="h-full rounded-full bg-[#5b50e5]"
                              initial={{ width: '0%' }}
                              animate={{ width: `${progressPercent}%` }}
                              transition={{ duration: 0.3 }}
                            />
                          </div>
                        </div>
                      </div>
                    ) : prompt ? (
                      <SplitPromptViewer
                        rawPrompt={prompt}
                        segmentDuration={segmentDuration}
                        targetAI={targetAI}
                        onSendToPhotoPrompt={handleSendToPhotoPrompt}
                      />
                    ) : null}
                  </motion.div>
                </AnimatePresence>
              )}
            </div>
          </motion.div>
        </main>
      </div>

      {/* MODALS */}
      <HistoryModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        onRestoreItem={handleRestoreItem}
      />

      <AntiLimitModal
        isOpen={isAntiLimitOpen}
        onClose={() => setIsAntiLimitOpen(false)}
      />

      <CommandPaletteModal
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onSelectTool={(toolId) => {
          if (toolId === 'tiktok_downloader') setActiveTab('tiktok');
          else if (toolId === 'tiktok_shop_ideas') setActiveTab('shop_ideas');
          else if (toolId === 'content_ideas') setActiveTab('ideas');
          else if (toolId === 'prompt_splitter') setActiveTab('prompt');
          else if (toolId === 'photo_prompt_generator') setActiveTab('photo');
          else if (toolId === 'frame_extractor') setActiveTab('extractor');
          else if (toolId === 'packages') setActiveTab('paket');
          else if (toolId === 'settings') setActiveTab('pengaturan');
        }}
        onOpenHelp={() => setActiveTab('pengaturan')}
      />
    </div>
  );
}
