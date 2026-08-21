'use client';

import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  LogOut, 
  Users, 
  Tag, 
  Zap, 
  Key, 
  QrCode, 
  Clock, 
  BarChart2, 
  Bot,
  Brain,
  MessageSquare,
  Sparkles,
  Radio,
  Activity,
  Megaphone,
  BarChart3,
  Share2,
  Database,
  Cpu,
  AppWindow,
  Menu,
  X,
  Palette,
  Sliders
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ErrorBoundary from '../../components/admin/ErrorBoundary';
import DashboardOverviewPanel from './DashboardOverviewPanel';
import ClientMonitoringPanel from './ClientMonitoringPanel';
import PackagePricingPanel from './PackagePricingPanel';
import CustomAccessPanel from './CustomAccessPanel';
import ApiKeyManagementPanel from './ApiKeyManagementPanel';
import QrisManagementPanel from './QrisManagementPanel';
import PaymentVerificationPanel from './PaymentVerificationPanel';
import ContactSettingsPanel from './ContactSettingsPanel';
import AiAgentPanel from './AiAgentPanel';
import LearningReviewPanel from './LearningReviewPanel';
import LoginActivityPanel from './LoginActivityPanel';
import LiveUserGenerationMonitorPanel from './LiveUserGenerationMonitorPanel';
import MemoryAgentSkillPanel from './MemoryAgentSkillPanel';
import KnowledgeInjectionPanel from './KnowledgeInjectionPanel';
import LoginUiCustomizerPanel from './LoginUiCustomizerPanel';
import UserUiCustomizerPanel from './UserUiCustomizerPanel';
import SystemMaintenancePanel from './SystemMaintenancePanel';
import { logoutUser, MASTER_ADMIN_EMAIL } from '../../lib/auth';
import { subscribeLiveGenerationEvents, ActiveGenerationItem } from '../../events/generationEvent';
import { getAllTransactions, listenTransactionsUpdated } from '../../lib/payment';

interface AdminDashboardViewProps {
  onGoToWorkspace: () => void;
  onLogout: () => void;
  onOpenApiKeySettings?: () => void;
}

export default function AdminDashboardView({
  onGoToWorkspace,
  onLogout
}: AdminDashboardViewProps) {
  const [activeTab, setActiveTab] = useState<
    | 'overview'
    | 'clients'
    | 'login_activity'
    | 'packages'
    | 'custom_access'
    | 'apikeys'
    | 'ai_agents'
    | 'safe_learning'
    | 'payment_queue'
    | 'qris'
    | 'contact'
    | 'announcements'
    | 'live_generation'
    | 'prompt_formulas'
    | 'analytics_cost'
    | 'affiliates'
    | 'custom_login_ui'
    | 'system_backup'
  >('overview');

  const [liveActiveGenerations, setLiveActiveGenerations] = useState<ActiveGenerationItem[]>([]);
  const [isLiveStreamActive, setIsLiveStreamActive] = useState<boolean>(true);
  const [sseStatus, setSseStatus] = useState<'connected' | 'reconnecting' | 'offline'>('connected');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);
  const [pendingPaymentCount, setPendingPaymentCount] = useState<number>(() => {
    return getAllTransactions().filter((t) => t.status === 'AWAITING_VERIFICATION').length;
  });

  useEffect(() => {
    const handleSseStatus = (e: Event) => {
      const customEvt = e as CustomEvent;
      if (customEvt.detail) {
        setSseStatus(customEvt.detail);
      }
    };
    window.addEventListener('satset_sse_status', handleSseStatus);

    const updatePendingCount = () => {
      const count = getAllTransactions().filter((t) => t.status === 'AWAITING_VERIFICATION').length;
      setPendingPaymentCount(count);
    };

    updatePendingCount();
    const unsubTrx = listenTransactionsUpdated(updatePendingCount);
    window.addEventListener('storage', updatePendingCount);
    window.addEventListener('satset_transactions_updated', updatePendingCount);

    const unsubscribe = subscribeLiveGenerationEvents((data) => {
      setIsLiveStreamActive(true);
      if (data.activeGenerations) {
        setLiveActiveGenerations(data.activeGenerations);
      } else if (data.type === 'active_status_update' && data.activeGenerations) {
        setLiveActiveGenerations(data.activeGenerations);
      }
    });

    return () => {
      window.removeEventListener('satset_sse_status', handleSseStatus);
      window.removeEventListener('storage', updatePendingCount);
      window.removeEventListener('satset_transactions_updated', updatePendingCount);
      unsubTrx();
      unsubscribe();
    };
  }, []);

  const activeGenCount = liveActiveGenerations.filter(g => g.status === 'generating' || g.status === 'analyzing').length;

  const navSections = [
    {
      title: 'UTAMA & PERFORMA',
      items: [
        { id: 'overview', label: 'Ringkasan', icon: BarChart2 },
        { id: 'live_generation', label: 'Pemantau Generasi Realtime', icon: Radio },
        { id: 'prompt_formulas', label: 'Memory Agent Skill', icon: Brain },
        { id: 'analytics_cost', label: 'Injeksi Pengetahuan System', icon: Cpu },
        { id: 'custom_login_ui', label: 'Custom UI Login', icon: Palette },
      ]
    },
    {
      title: 'KLIEN & TRANSAKSI',
      items: [
        { id: 'clients', label: 'Monitoring Client', icon: Users },
        { id: 'login_activity', label: 'Log Login', icon: Key },
        { id: 'payment_queue', label: 'Verifikasi Bayar', icon: Clock, badgeCount: pendingPaymentCount },
      ]
    },
    {
      title: 'AKSES & LISENSI',
      items: [
        { id: 'packages', label: 'Manajemen Paket', icon: Tag },
        { id: 'custom_access', label: 'Control Semua UI User', icon: Sliders },
        { id: 'apikeys', label: 'API Keys', icon: Key },
      ]
    },
    {
      title: 'AI ENGINE & SISTEM',
      items: [
        { id: 'ai_agents', label: 'AI Agents', icon: Bot },
        { id: 'safe_learning', label: 'Safe Learning', icon: Brain },
        { id: 'qris', label: 'Pengaturan QRIS', icon: QrCode },
        { id: 'contact', label: 'Pengaturan WA', icon: MessageSquare },
        { id: 'system_backup', label: 'Backup & Restore', icon: Database },
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-sans selection:bg-[#3525cd] selection:text-white pb-16">
      {/* Top Navigation Header */}
      <header className="sticky top-0 z-40 bg-slate-900 text-white border-b border-slate-800 shadow-md">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Mobile Sidebar Toggle */}
            <button
              type="button"
              onClick={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
              className="lg:hidden p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white border border-slate-700 cursor-pointer"
              aria-label="Toggle Menu"
            >
              {isMobileSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#3525cd] to-indigo-500 text-white font-extrabold flex items-center justify-center shadow-md shrink-0">
              <ShieldCheck className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-extrabold tracking-tight">Console Admin Tools Satset</h1>
                <span className="hidden sm:inline-block px-2 py-0.5 rounded-full bg-amber-400/20 border border-amber-400/30 text-amber-300 text-[10px] font-bold uppercase tracking-wider">
                  Super Admin
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono hidden sm:block">{MASTER_ADMIN_EMAIL}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">

            {/* Live SSE Stream Status Indicator */}
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-xs font-semibold">
              <Radio className={`w-3.5 h-3.5 ${sseStatus === 'connected' ? 'text-emerald-400 animate-pulse' : sseStatus === 'reconnecting' ? 'text-amber-400 animate-ping' : 'text-rose-400'}`} />
              <span className={`text-[11px] font-mono ${sseStatus === 'connected' ? 'text-emerald-300' : sseStatus === 'reconnecting' ? 'text-amber-300' : 'text-rose-300'}`}>
                {sseStatus === 'connected' ? 'SSE Live' : sseStatus === 'reconnecting' ? 'Connecting...' : 'SSE Offline'}
              </span>
              {activeGenCount > 0 && (
                <span className="ml-1 px-2 py-0.5 rounded-full bg-indigo-500/30 border border-indigo-400/40 text-indigo-300 text-[10px] font-extrabold animate-bounce">
                  ⚡ {activeGenCount} Active
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                logoutUser();
                onLogout();
              }}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-semibold text-xs transition-colors flex items-center gap-1.5 cursor-pointer border border-slate-700"
            >
              <LogOut className="w-4 h-4 text-rose-400" />
              <span className="hidden sm:inline">Keluar</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Dashboard Layout with Left Sidebar */}
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        {/* Mobile Navigation Drawer */}
        <AnimatePresence>
          {isMobileSidebarOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="lg:hidden w-full bg-white rounded-2xl border border-slate-200/80 p-4 shadow-md space-y-4 mb-4 overflow-hidden"
            >
              {navSections.map((section, idx) => (
                <div key={idx} className="space-y-1">
                  <h3 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">
                    {section.title}
                  </h3>
                  <div className="grid grid-cols-2 gap-1.5">
                    {section.items.map((tab) => {
                      const Icon = tab.icon;
                      const isActive = activeTab === tab.id;
                      return (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => {
                            setActiveTab(tab.id as any);
                            setIsMobileSidebarOpen(false);
                          }}
                          className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-left transition-all cursor-pointer ${
                            isActive
                              ? 'bg-[#3525cd] text-white shadow-xs'
                              : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200/60'
                          }`}
                        >
                          <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-amber-300' : 'text-slate-500'}`} />
                          <span className="truncate">{tab.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex flex-col lg:flex-row gap-6 items-start">
          
          {/* DESKTOP LEFT SIDEBAR */}
          <aside className="hidden lg:block w-64 xl:w-72 shrink-0 sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto custom-scrollbar bg-white rounded-2xl border border-slate-200/80 p-3.5 shadow-sm space-y-5">
            <div className="px-2 py-1 border-b border-slate-100 pb-2.5">
              <p className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider">Navigasi Admin</p>
              <p className="text-xs text-slate-600 font-semibold mt-0.5">Daftar Fitur Dashboard</p>
            </div>

            {navSections.map((section, idx) => (
              <div key={idx} className="space-y-1">
                <h3 className="px-2 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1.5">
                  {section.title}
                </h3>
                <div className="space-y-1">
                  {section.items.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                      <motion.button
                        key={tab.id}
                        whileHover={{ x: 3 }}
                        whileTap={{ scale: 0.98 }}
                        type="button"
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all text-left cursor-pointer ${
                          isActive
                            ? 'bg-[#3525cd] text-white shadow-md shadow-indigo-200'
                            : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 shrink-0 min-w-0">
                          <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-amber-300' : 'text-slate-400'}`} />
                          <span className="truncate">{tab.label}</span>
                          {(tab as any).badgeCount > 0 && (
                            <span className="px-1.5 py-0.5 rounded-full bg-amber-400 text-slate-900 text-[10px] font-black animate-pulse">
                              {(tab as any).badgeCount}
                            </span>
                          )}
                        </div>
                        {isActive && (
                          <motion.div 
                            layoutId="activeAdminTabIndicator" 
                            className="w-1.5 h-4 bg-amber-400 rounded-full shrink-0" 
                          />
                        )}
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            ))}
          </aside>

          {/* RIGHT MAIN CONTENT PANEL */}
          <div className="flex-1 w-full min-w-0">
            {activeTab === 'overview' && (
              <ErrorBoundary panelName="Ringkasan Dashboard">
                <DashboardOverviewPanel onNavigateTab={(tab) => setActiveTab(tab as any)} />
              </ErrorBoundary>
            )}

            {activeTab === 'clients' && (
              <ErrorBoundary panelName="Monitoring Client">
                <ClientMonitoringPanel />
              </ErrorBoundary>
            )}

            {activeTab === 'login_activity' && (
              <ErrorBoundary panelName="Log Aktivitas Login">
                <LoginActivityPanel />
              </ErrorBoundary>
            )}

            {activeTab === 'packages' && (
              <ErrorBoundary panelName="Manajemen Paket & Harga">
                <PackagePricingPanel />
              </ErrorBoundary>
            )}

            {activeTab === 'custom_access' && (
              <ErrorBoundary panelName="Control Semua UI User">
                <UserUiCustomizerPanel />
              </ErrorBoundary>
            )}

            {activeTab === 'apikeys' && (
              <ErrorBoundary panelName="Manajemen API Key">
                <ApiKeyManagementPanel />
              </ErrorBoundary>
            )}

            {activeTab === 'ai_agents' && (
              <ErrorBoundary panelName="Manajemen AI Agents">
                <AiAgentPanel />
              </ErrorBoundary>
            )}

            {activeTab === 'safe_learning' && (
              <ErrorBoundary panelName="Safe Learning & Review">
                <LearningReviewPanel />
              </ErrorBoundary>
            )}

            {activeTab === 'payment_queue' && (
              <ErrorBoundary panelName="Verifikasi Pembayaran">
                <PaymentVerificationPanel />
              </ErrorBoundary>
            )}

            {activeTab === 'qris' && (
              <ErrorBoundary panelName="Pengaturan QRIS">
                <QrisManagementPanel />
              </ErrorBoundary>
            )}

            {activeTab === 'contact' && (
              <ErrorBoundary panelName="Pengaturan WhatsApp & Kontak">
                <ContactSettingsPanel />
              </ErrorBoundary>
            )}

            {(activeTab === 'live_generation' || activeTab === 'announcements') && (
              <ErrorBoundary panelName="Pemantau Generasi Realtime">
                <LiveUserGenerationMonitorPanel />
              </ErrorBoundary>
            )}

            {activeTab === 'prompt_formulas' && (
              <ErrorBoundary panelName="Memory Agent Skill Cluster">
                <MemoryAgentSkillPanel />
              </ErrorBoundary>
            )}

            {activeTab === 'analytics_cost' && (
              <ErrorBoundary panelName="Injeksi Pengetahuan System Hub">
                <KnowledgeInjectionPanel />
              </ErrorBoundary>
            )}

            {(activeTab === 'custom_login_ui' || (activeTab as string) === 'affiliates') && (
              <ErrorBoundary panelName="Custom UI Login">
                <LoginUiCustomizerPanel />
              </ErrorBoundary>
            )}

            {activeTab === 'system_backup' && (
              <ErrorBoundary panelName="Backup & Maintenance System">
                <SystemMaintenancePanel />
              </ErrorBoundary>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
