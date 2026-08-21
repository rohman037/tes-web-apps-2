'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Palette, 
  Type, 
  ImageIcon, 
  Sliders, 
  Sparkles, 
  Save, 
  RotateCcw, 
  Eye, 
  CheckCircle2, 
  AlertCircle, 
  Layout, 
  Check, 
  Plus, 
  Trash2, 
  Megaphone, 
  LayoutGrid, 
  Layers, 
  HelpCircle, 
  Key, 
  Download, 
  Video, 
  Camera, 
  Lightbulb, 
  ShoppingBag, 
  Scissors, 
  CreditCard,
  ToggleLeft,
  ToggleRight,
  ShieldCheck,
  MessageCircle
} from 'lucide-react';
import { 
  UserUiSettings, 
  DEFAULT_USER_UI_SETTINGS, 
  getUserUiSettings, 
  saveUserUiSettings, 
  syncUserUiSettingsWithBackend, 
  ToolTabConfig 
} from '../../lib/admin/userUiSettings';
import { logAdminAction } from '../../lib/admin/auditLog';
import SafeImage from '../../components/common/SafeImage';

export default function UserUiCustomizerPanel() {
  const [settings, setSettings] = useState<UserUiSettings>(() => getUserUiSettings());
  const [activeTab, setActiveTab] = useState<'branding' | 'announcement' | 'tools' | 'hero' | 'theme' | 'preview'>('branding');
  const [isSaving, setIsSaving] = useState(false);
  const [toastMsg, setToastMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadSettings = useCallback(async () => {
    try {
      const synced = await syncUserUiSettingsWithBackend();
      setSettings(synced);
    } catch (e) {}
  }, []);

  useEffect(() => {
    const handleUpdated = () => {
      loadSettings();
    };
    window.addEventListener('satset_user_ui_settings_updated', handleUpdated);
    window.addEventListener('storage', handleUpdated);
    return () => {
      window.removeEventListener('satset_user_ui_settings_updated', handleUpdated);
      window.removeEventListener('storage', handleUpdated);
    };
  }, [loadSettings]);

  const handleSave = async () => {
    setIsSaving(true);
    setToastMsg(null);
    try {
      const res = await saveUserUiSettings(settings);
      if (res.success) {
        setToastMsg({ type: 'success', text: 'Tampilan & Kontrol UI User berhasil diperbarui secara real-time!' });
        logAdminAction(
          'User UI Control',
          'Mengubah kontrol tampilan UI User (menu tools, logo brand, pengumuman, dan tema).',
          'system',
          'Kustom UI User'
        );
      } else {
        setToastMsg({ type: 'error', text: res.error || 'Gagal menyimpan kontrol UI User.' });
      }
    } catch (err: any) {
      setToastMsg({ type: 'error', text: 'Terjadi kesalahan sistem saat menyimpan.' });
    } finally {
      setIsSaving(false);
      setTimeout(() => setToastMsg(null), 4000);
    }
  };

  const handleResetDefault = () => {
    if (window.confirm('Apakah Anda yakin ingin mengembalikan seluruh kontrol UI User ke konfigurasi default awal?')) {
      setSettings(DEFAULT_USER_UI_SETTINGS);
      setToastMsg({ type: 'success', text: 'Pengaturan dikembalikan ke default. Klik "Simpan Kontrol UI" untuk menerapkan.' });
    }
  };

  const handleToggleTool = (id: string) => {
    setSettings(prev => ({
      ...prev,
      toolsConfig: prev.toolsConfig.map(t => t.id === id ? { ...t, enabled: !t.enabled } : t)
    }));
  };

  const handleUpdateTool = (id: string, field: 'label' | 'badge', val: string) => {
    setSettings(prev => ({
      ...prev,
      toolsConfig: prev.toolsConfig.map(t => t.id === id ? { ...t, [field]: val } : t)
    }));
  };

  const getToolIcon = (id: string) => {
    switch (id) {
      case 'pengaturan': return <Key className="w-4 h-4" />;
      case 'tiktok': return <Download className="w-4 h-4" />;
      case 'prompt': return <Video className="w-4 h-4" />;
      case 'photo': return <Camera className="w-4 h-4" />;
      case 'ideas': return <Lightbulb className="w-4 h-4" />;
      case 'shop_ideas': return <ShoppingBag className="w-4 h-4" />;
      case 'extractor': return <Scissors className="w-4 h-4" />;
      case 'paket': return <CreditCard className="w-4 h-4" />;
      default: return <Sparkles className="w-4 h-4" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-6 text-white border border-indigo-900/60 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 text-indigo-400 font-bold text-xs uppercase tracking-wider mb-1">
              <Sliders className="w-4 h-4 text-indigo-400" />
              <span>Full Control User Interface Engine</span>
            </div>
            <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
              <span>Kustomisasi & Kontrol Semua UI User</span>
            </h1>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
              Atur seluruh tampilan dashboard pengguna secara terpusat: logo brand, running banner pengumuman, aktif/nonaktifkan menu tool, ubah label & badge, hero card, hingga warna tema.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleResetDefault}
              className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Default</span>
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-extrabold text-xs transition-all flex items-center gap-2 shadow-lg shadow-indigo-600/30 cursor-pointer disabled:opacity-60"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'Menyimpan...' : 'Simpan Kontrol UI'}</span>
            </button>
          </div>
        </div>

        {/* Tab Nav Controls */}
        <div className="flex flex-wrap items-center gap-1.5 mt-6 pt-4 border-t border-slate-800/80">
          {[
            { id: 'branding', label: 'Brand & Header', icon: Type },
            { id: 'announcement', label: 'Running Announcement', icon: Megaphone },
            { id: 'tools', label: 'Kontrol Menu Tool AI', icon: LayoutGrid },
            { id: 'hero', label: 'Welcome Card Hero', icon: Sparkles },
            { id: 'theme', label: 'Warna & Layout Tema', icon: Palette },
            { id: 'preview', label: 'Pratinjau Live Preview', icon: Eye },
          ].map((tab) => {
            const IconComp = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'bg-slate-800/70 hover:bg-slate-800 text-slate-300'
                }`}
              >
                <IconComp className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Toast Notification */}
      {toastMsg && (
        <div className={`p-4 rounded-xl border text-xs font-bold flex items-center gap-2.5 transition-all ${
          toastMsg.type === 'success' 
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
            : 'bg-rose-50 border-rose-200 text-rose-800'
        }`}>
          {toastMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-rose-600" />}
          <span>{toastMsg.text}</span>
        </div>
      )}

      {/* TAB 1: BRANDING & HEADER */}
      {activeTab === 'branding' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Type className="w-4 h-4 text-indigo-600" />
              <span>Pengaturan Logo Brand & Top Navigation User</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">Atur nama brand aplikasi pengguna, logo gambar/inisial, warna aksen logo, dan badge anti-limit.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Nama Brand Header User</label>
              <input
                type="text"
                value={settings.logoTitle}
                onChange={(e) => setSettings({ ...settings, logoTitle: e.target.value })}
                placeholder="Tools Satset AI"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Inisial Badge Logo (Kotak Ikon)</label>
              <input
                type="text"
                value={settings.logoBadgeText}
                onChange={(e) => setSettings({ ...settings, logoBadgeText: e.target.value })}
                placeholder="TS"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs font-bold text-slate-700">URL Gambar Logo Custom (Opsional)</label>
              <input
                type="text"
                value={settings.logoImageUrl}
                onChange={(e) => setSettings({ ...settings, logoImageUrl: e.target.value })}
                placeholder="https://domain.com/user-logo.png"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 font-mono focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Warna Aksen Logo Brand (Hex)</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={settings.logoThemeColor}
                  onChange={(e) => setSettings({ ...settings, logoThemeColor: e.target.value })}
                  className="w-10 h-10 rounded-lg border border-slate-300 cursor-pointer p-1"
                />
                <input
                  type="text"
                  value={settings.logoThemeColor}
                  onChange={(e) => setSettings({ ...settings, logoThemeColor: e.target.value })}
                  className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-mono font-bold text-slate-900 uppercase outline-none"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Teks Tombol Bantuan & CS Header</label>
              <input
                type="text"
                value={settings.headerHelpText}
                onChange={(e) => setSettings({ ...settings, headerHelpText: e.target.value })}
                placeholder="Bantuan & CS"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>

            <div className="space-y-3 pt-2 md:col-span-2 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700">Tampilkan Badge &quot;Anti-Limit Engine&quot;</label>
                <input
                  type="checkbox"
                  checked={settings.showAntiLimitBadge}
                  onChange={(e) => setSettings({ ...settings, showAntiLimitBadge: e.target.checked })}
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
              </div>
              <input
                type="text"
                value={settings.antiLimitBadgeText}
                onChange={(e) => setSettings({ ...settings, antiLimitBadgeText: e.target.value })}
                placeholder="Anti-Limit AI Engine Active"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: RUNNING ANNOUNCEMENT */}
      {activeTab === 'announcement' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-indigo-600" />
              <span>Pengaturan Banner Running Announcement Ticker</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">Tampilkan pesan berjalan/informasi penting untuk semua pengguna aktif di bagian atas dashboard.</p>
          </div>

          <div className="space-y-5">
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-indigo-50/60 border border-indigo-100">
              <div>
                <span className="text-xs font-bold text-indigo-950">Aktifkan Banner Pengumuman</span>
                <p className="text-[11px] text-indigo-800/80">Jika dicentang, banner ticker pengumuman akan muncul di paling atas dashboard user.</p>
              </div>
              <input
                type="checkbox"
                checked={settings.showAnnouncement}
                onChange={(e) => setSettings({ ...settings, showAnnouncement: e.target.checked })}
                className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Teks Pesan Pengumuman Ticker</label>
              <textarea
                rows={3}
                value={settings.announcementText}
                onChange={(e) => setSettings({ ...settings, announcementText: e.target.value })}
                placeholder="🔥 Informasi update fitur atau promo..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Warna Background Banner (Hex)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={settings.announcementBg}
                    onChange={(e) => setSettings({ ...settings, announcementBg: e.target.value })}
                    className="w-10 h-10 rounded-lg border border-slate-300 cursor-pointer p-1"
                  />
                  <input
                    type="text"
                    value={settings.announcementBg}
                    onChange={(e) => setSettings({ ...settings, announcementBg: e.target.value })}
                    className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-mono font-bold text-slate-900 uppercase outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Warna Teks Banner (Hex)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={settings.announcementTextColor}
                    onChange={(e) => setSettings({ ...settings, announcementTextColor: e.target.value })}
                    className="w-10 h-10 rounded-lg border border-slate-300 cursor-pointer p-1"
                  />
                  <input
                    type="text"
                    value={settings.announcementTextColor}
                    onChange={(e) => setSettings({ ...settings, announcementTextColor: e.target.value })}
                    className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-mono font-bold text-slate-900 uppercase outline-none"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: CONTROL TOOLS & TABS */}
      {activeTab === 'tools' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <LayoutGrid className="w-4 h-4 text-indigo-600" />
              <span>Kontrol Lengkap Menu Tool AI & Tab Sidebar User</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">Atur fitur mana yang boleh diakses pengguna (aktif/nonaktif), ganti nama menu tool, dan ganti badge highlight (misal: FREE, HOT, PRO, 8K).</p>
          </div>

          <div className="space-y-3">
            {settings.toolsConfig.map((tool) => (
              <div 
                key={tool.id} 
                className={`p-4 rounded-xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                  tool.enabled 
                    ? 'bg-white border-slate-200 shadow-2xs' 
                    : 'bg-slate-50/80 border-slate-200 opacity-60'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    tool.enabled ? 'bg-indigo-50 text-[#3525cd]' : 'bg-slate-200 text-slate-500'
                  }`}>
                    {getToolIcon(tool.id)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-sm text-slate-900">{tool.label}</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                        ID: {tool.id}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400">
                      Status: {tool.enabled ? 'Tampil & Diizinkan Akses' : 'Disembunyikan dari Dashboard User'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Label Menu</span>
                    <input
                      type="text"
                      value={tool.label}
                      onChange={(e) => handleUpdateTool(tool.id, 'label', e.target.value)}
                      className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-bold text-slate-900 outline-none w-44"
                    />
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Badge Label</span>
                    <input
                      type="text"
                      value={tool.badge || ''}
                      onChange={(e) => handleUpdateTool(tool.id, 'badge', e.target.value)}
                      placeholder="HOT, FREE, dll"
                      className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-bold text-indigo-700 outline-none w-24"
                    />
                  </div>

                  <div className="pt-4">
                    <button
                      type="button"
                      onClick={() => handleToggleTool(tool.id)}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                        tool.enabled 
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 hover:bg-emerald-200' 
                          : 'bg-slate-200 text-slate-700 border border-slate-300 hover:bg-slate-300'
                      }`}
                    >
                      {tool.enabled ? <ToggleRight className="w-4 h-4 text-emerald-600" /> : <ToggleLeft className="w-4 h-4 text-slate-500" />}
                      <span>{tool.enabled ? 'Aktif' : 'Nonaktif'}</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: WELCOME HERO CARD */}
      {activeTab === 'hero' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              <span>Pengaturan Kartu Ucapan Selamat Datang (Welcome Card Hero)</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">Atur pesan sambutan utama saat pengguna membuka dashboard.</p>
          </div>

          <div className="space-y-5">
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-indigo-50/60 border border-indigo-100">
              <div>
                <span className="text-xs font-bold text-indigo-950">Tampilkan Welcome Card Hero</span>
                <p className="text-[11px] text-indigo-800/80">Menampilkan kartu sambutan berwarna ungu indigo di atas workspace tools.</p>
              </div>
              <input
                type="checkbox"
                checked={settings.showWelcomeCard}
                onChange={(e) => setSettings({ ...settings, showWelcomeCard: e.target.checked })}
                className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Judul Ucapan Sambutan</label>
              <input
                type="text"
                value={settings.welcomeTitle}
                onChange={(e) => setSettings({ ...settings, welcomeTitle: e.target.value })}
                placeholder="Selamat Datang di Workspace Tools Satset AI"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Sub-judul / Deskripsi Sambutan</label>
              <textarea
                rows={3}
                value={settings.welcomeSubtitle}
                onChange={(e) => setSettings({ ...settings, welcomeSubtitle: e.target.value })}
                placeholder="Kelola & ciptakan konten viral..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: THEME & FOOTER */}
      {activeTab === 'theme' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Palette className="w-4 h-4 text-indigo-600" />
              <span>Pengaturan Warna Tema & Footer</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">Atur skema warna background, warna aksen utama, dan teks copyright footer.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Warna Background Halaman User (Hex)</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={settings.pageBgColor}
                  onChange={(e) => setSettings({ ...settings, pageBgColor: e.target.value })}
                  className="w-10 h-10 rounded-lg border border-slate-300 cursor-pointer p-1"
                />
                <input
                  type="text"
                  value={settings.pageBgColor}
                  onChange={(e) => setSettings({ ...settings, pageBgColor: e.target.value })}
                  className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-mono font-bold text-slate-900 uppercase outline-none"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Warna Aksen Utama (Hex)</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={settings.primaryColor}
                  onChange={(e) => setSettings({ ...settings, primaryColor: e.target.value })}
                  className="w-10 h-10 rounded-lg border border-slate-300 cursor-pointer p-1"
                />
                <input
                  type="text"
                  value={settings.primaryColor}
                  onChange={(e) => setSettings({ ...settings, primaryColor: e.target.value })}
                  className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-mono font-bold text-slate-900 uppercase outline-none"
                />
              </div>
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs font-bold text-slate-700">Teks Copyright Footer</label>
              <input
                type="text"
                value={settings.footerText}
                onChange={(e) => setSettings({ ...settings, footerText: e.target.value })}
                placeholder="© 2026 Tools Satset AI - Multi-Engine Content Suite"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: LIVE PREVIEW SIMULATOR */}
      {activeTab === 'preview' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Eye className="w-4 h-4 text-indigo-600" />
              <span>Simulasi Live Preview Tampilan Dashboard User</span>
            </h3>
            <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold uppercase tracking-wider">
              Realtime Preview
            </span>
          </div>

          <div 
            className="w-full rounded-2xl p-6 border border-slate-300 shadow-inner overflow-hidden min-h-[550px] flex flex-col justify-between"
            style={{ backgroundColor: settings.pageBgColor || '#fcf8ff' }}
          >
            {/* Header Preview */}
            <div className="flex justify-between items-center pb-4 border-b border-slate-200/60 bg-white/80 p-4 rounded-xl shadow-2xs">
              <div className="text-lg font-extrabold tracking-tight flex items-center gap-2" style={{ color: settings.logoThemeColor || '#3525cd' }}>
                {settings.logoImageUrl ? (
                  <SafeImage
                    src={settings.logoImageUrl}
                    alt="Logo"
                    className="h-7 max-w-[120px] object-contain"
                    width={120}
                    height={28}
                  />
                ) : (
                  <span 
                    className="w-7 h-7 rounded-lg text-white flex items-center justify-center text-xs font-black"
                    style={{ backgroundColor: settings.logoThemeColor || '#3525cd' }}
                  >
                    {settings.logoBadgeText || 'TS'}
                  </span>
                )}
                <span>{settings.logoTitle || 'Tools Satset AI'}</span>
              </div>

              <div className="flex items-center gap-3">
                {settings.showAntiLimitBadge && (
                  <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold flex items-center gap-1 border border-emerald-200">
                    <ShieldCheck className="w-3 h-3 text-emerald-600" />
                    <span>{settings.antiLimitBadgeText}</span>
                  </span>
                )}
                <span className="text-xs font-semibold text-slate-600 flex items-center gap-1">
                  <HelpCircle className="w-3.5 h-3.5" />
                  <span>{settings.headerHelpText}</span>
                </span>
              </div>
            </div>

            {/* Announcement Ticker Preview */}
            {settings.showAnnouncement && (
              <div 
                className="my-3 py-2 px-4 rounded-xl text-xs font-bold text-center shadow-xs"
                style={{ backgroundColor: settings.announcementBg, color: settings.announcementTextColor }}
              >
                {settings.announcementText}
              </div>
            )}

            {/* Welcome Hero Preview */}
            {settings.showWelcomeCard && (
              <div className="my-3 p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white border border-indigo-900/50 shadow-md">
                <h2 className="text-lg font-black flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span>{settings.welcomeTitle}</span>
                </h2>
                <p className="text-xs text-slate-300 mt-1">{settings.welcomeSubtitle}</p>
              </div>
            )}

            {/* Tools Tabs Menu Preview */}
            <div className="my-4">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2 block">
                Menu Tool Diizinkan & Ditampilkan untuk Pengguna:
              </span>
              <div className="flex flex-wrap items-center gap-2">
                {settings.toolsConfig.filter(t => t.enabled).map((tool) => (
                  <div 
                    key={tool.id}
                    className="px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-800 flex items-center gap-2 shadow-2xs"
                  >
                    {getToolIcon(tool.id)}
                    <span>{tool.label}</span>
                    {tool.badge && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-indigo-100 text-[#3525cd]">
                        {tool.badge}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Footer Preview */}
            <div className="pt-4 border-t border-slate-200/60 flex justify-between items-center text-[11px] font-medium text-slate-500">
              <span>{settings.footerText}</span>
              <span className="flex items-center gap-1 font-bold text-indigo-600">
                <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                <span>{settings.supportWaText}</span>
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
