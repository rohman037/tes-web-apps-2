'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Palette, 
  Type, 
  Image as ImageIcon, 
  Layout, 
  Sparkles, 
  Plus, 
  Trash2, 
  Save, 
  RotateCcw, 
  Eye, 
  CheckCircle2, 
  AlertCircle, 
  MessageCircle, 
  Key, 
  ArrowRight, 
  HelpCircle, 
  Lock, 
  ShieldCheck, 
  Headphones, 
  Lightbulb, 
  Video, 
  Camera, 
  Crop,
  Layers,
  Sliders,
  Check
} from 'lucide-react';
import { 
  LoginUiSettings, 
  DEFAULT_LOGIN_UI_SETTINGS, 
  getLoginUiSettings, 
  saveLoginUiSettings, 
  syncLoginUiSettingsWithBackend, 
  FeaturePoint 
} from '../../lib/admin/loginUiSettings';
import { logAdminAction } from '../../lib/admin/auditLog';
import SafeImage from '../../components/common/SafeImage';

export default function LoginUiCustomizerPanel() {
  const [settings, setSettings] = useState<LoginUiSettings>(() => getLoginUiSettings());
  const [activeTab, setActiveTab] = useState<'header' | 'hero' | 'form' | 'theme' | 'preview'>('header');
  const [isSaving, setIsSaving] = useState(false);
  const [toastMsg, setToastMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadSettings = useCallback(async () => {
    try {
      const synced = await syncLoginUiSettingsWithBackend();
      setSettings(synced);
    } catch (e) {}
  }, []);

  useEffect(() => {
    const handleUpdated = () => {
      loadSettings();
    };
    window.addEventListener('satset_login_ui_settings_updated', handleUpdated);
    window.addEventListener('storage', handleUpdated);
    return () => {
      window.removeEventListener('satset_login_ui_settings_updated', handleUpdated);
      window.removeEventListener('storage', handleUpdated);
    };
  }, [loadSettings]);

  const handleSave = async () => {
    setIsSaving(true);
    setToastMsg(null);
    try {
      const res = await saveLoginUiSettings(settings);
      if (res.success) {
        setToastMsg({ type: 'success', text: 'Tampilan UI Login berhasil diperbarui secara real-time!' });
        logAdminAction(
          'Login UI Customizer',
          'Mengubah kustomisasi tampilan UI Login (judul, warna, gambar banner, dan teks).',
          'system',
          'Custom UI Login'
        );
      } else {
        setToastMsg({ type: 'error', text: res.error || 'Gagal menyimpan kustomisasi UI Login.' });
      }
    } catch (err: any) {
      setToastMsg({ type: 'error', text: 'Terjadi kesalahan sistem saat menyimpan.' });
    } finally {
      setIsSaving(false);
      setTimeout(() => setToastMsg(null), 4000);
    }
  };

  const handleResetDefault = () => {
    if (window.confirm('Apakah Anda yakin ingin mengembalikan seluruh tampilan UI Login ke pengaturan default awal?')) {
      setSettings(DEFAULT_LOGIN_UI_SETTINGS);
      setToastMsg({ type: 'success', text: 'Pengaturan dikembalikan ke default. Klik "Simpan Kustomisasi" untuk menerapkan.' });
    }
  };

  // Feature point handlers
  const handleAddFeaturePoint = () => {
    const newId = `fp_${Date.now()}`;
    const newPoint: FeaturePoint = {
      id: newId,
      icon: 'sparkles',
      title: 'Fitur Baru AI'
    };
    setSettings(prev => ({
      ...prev,
      featurePoints: [...prev.featurePoints, newPoint]
    }));
  };

  const handleUpdateFeaturePoint = (id: string, field: 'title' | 'icon', val: string) => {
    setSettings(prev => ({
      ...prev,
      featurePoints: prev.featurePoints.map(fp => fp.id === id ? { ...fp, [field]: val } : fp)
    }));
  };

  const handleDeleteFeaturePoint = (id: string) => {
    setSettings(prev => ({
      ...prev,
      featurePoints: prev.featurePoints.filter(fp => fp.id !== id)
    }));
  };

  // Footer item handlers
  const handleAddFooterItem = () => {
    setSettings(prev => ({
      ...prev,
      footerItems: [...prev.footerItems, 'Jaminan Keamanan Baru']
    }));
  };

  const handleUpdateFooterItem = (index: number, val: string) => {
    setSettings(prev => ({
      ...prev,
      footerItems: prev.footerItems.map((item, idx) => idx === index ? val : item)
    }));
  };

  const handleDeleteFooterItem = (index: number) => {
    setSettings(prev => ({
      ...prev,
      footerItems: prev.footerItems.filter((_, idx) => idx !== index)
    }));
  };

  const renderIcon = (iconName: string) => {
    switch (iconName) {
      case 'lightbulb': return <Lightbulb className="w-5 h-5" />;
      case 'video': return <Video className="w-5 h-5" />;
      case 'camera': return <Camera className="w-5 h-5" />;
      case 'crop': return <Crop className="w-5 h-5" />;
      case 'sparkles': return <Sparkles className="w-5 h-5" />;
      case 'star': return <Layers className="w-5 h-5" />;
      default: return <Sparkles className="w-5 h-5" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Header */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-6 text-white border border-indigo-900/60 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 text-indigo-400 font-bold text-xs uppercase tracking-wider mb-1">
              <Palette className="w-4 h-4 text-indigo-400" />
              <span>Theme & Branding Engine</span>
            </div>
            <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
              <span>Kustomisasi Tampilan UI Login</span>
            </h1>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
              Atur teks judul, gambar banner, logo brand, warna tema, fitur bento, dan pesan bantuan pada halaman login secara real-time untuk pengguna.
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
              <span>{isSaving ? 'Menyimpan...' : 'Simpan Kustomisasi'}</span>
            </button>
          </div>
        </div>

        {/* Tab Navigation Controls */}
        <div className="flex flex-wrap items-center gap-1.5 mt-6 pt-4 border-t border-slate-800/80">
          {[
            { id: 'header', label: 'Brand & Logo Header', icon: Type },
            { id: 'hero', label: 'Banner & Visual Hero', icon: ImageIcon },
            { id: 'form', label: 'Form Login & Tombol', icon: Key },
            { id: 'theme', label: 'Warna Tema & Footer', icon: Sliders },
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

      {/* MAIN CONFIG EDITORS */}
      {activeTab === 'header' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Type className="w-4 h-4 text-indigo-600" />
              <span>Pengaturan Logo Brand & Header Navigation</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">Atur nama brand, logo gambar/teks badge, dan tombol bantuan di bagian paling atas.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Nama Brand / Judul Header</label>
              <input
                type="text"
                value={settings.logoTitle}
                onChange={(e) => setSettings({ ...settings, logoTitle: e.target.value })}
                placeholder="Tools Satset"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
              />
              <p className="text-[11px] text-slate-400">Teks nama aplikasi di pojok kiri atas header.</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Inisial Badge Logo (Jika Tidak Menggunakan Gambar)</label>
              <input
                type="text"
                value={settings.logoBadgeText}
                onChange={(e) => setSettings({ ...settings, logoBadgeText: e.target.value })}
                placeholder="TS"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
              />
              <p className="text-[11px] text-slate-400">2-3 huruf inisial logo ikon kotak.</p>
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs font-bold text-slate-700">URL Gambar Logo Custom (Opsional)</label>
              <input
                type="text"
                value={settings.logoImageUrl}
                onChange={(e) => setSettings({ ...settings, logoImageUrl: e.target.value })}
                placeholder="https://domain.com/logo.png"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 font-mono focus:ring-2 focus:ring-indigo-500 outline-none"
              />
              <p className="text-[11px] text-slate-400">Kosongkan jika ingin menggunakan logo inisial bawaan.</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Warna Aksen Logo Brand (Hex Color)</label>
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
                  className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-mono font-bold text-slate-900 outline-none uppercase"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Teks Tombol Bantuan Header</label>
              <input
                type="text"
                value={settings.headerHelpText}
                onChange={(e) => setSettings({ ...settings, headerHelpText: e.target.value })}
                placeholder="Bantuan"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
          </div>
        </div>
      )}

      {activeTab === 'hero' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-indigo-600" />
              <span>Pengaturan Banner & Visual Hero (Kolom Kiri)</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">Atur judul besar utama, gambar banner banner khusus, deskripsi, serta poin fitur bento.</p>
          </div>

          <div className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Judul Utama / Tagline Kiri (Hero Title)</label>
              <textarea
                rows={2}
                value={settings.heroTitle}
                onChange={(e) => setSettings({ ...settings, heroTitle: e.target.value })}
                placeholder="Buat lebih banyak konten dari satu video"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs font-bold text-slate-700">URL Gambar Banner Hero Custom (Opsional)</label>
                <input
                  type="text"
                  value={settings.heroImageUrl}
                  onChange={(e) => setSettings({ ...settings, heroImageUrl: e.target.value })}
                  placeholder="https://images.unsplash.com/photo-xxx atau URL gambar produk"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 font-mono focus:ring-2 focus:ring-indigo-500 outline-none"
                />
                <p className="text-[11px] text-slate-400">Jika diisi, gambar ini akan ditampilkan di kartu visual banner kiri menggantikan efek gradient bawaan.</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Judul Kartu Visual Hero</label>
                <input
                  type="text"
                  value={settings.bannerCardTitle}
                  onChange={(e) => setSettings({ ...settings, bannerCardTitle: e.target.value })}
                  placeholder="Workspace AI All-in-One"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Warna Gradient Card (Awal - Akhir)</label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="color"
                    value={settings.bannerGradientFrom}
                    onChange={(e) => setSettings({ ...settings, bannerGradientFrom: e.target.value })}
                    className="w-full h-10 rounded-lg border border-slate-300 cursor-pointer p-1"
                  />
                  <input
                    type="color"
                    value={settings.bannerGradientTo}
                    onChange={(e) => setSettings({ ...settings, bannerGradientTo: e.target.value })}
                    className="w-full h-10 rounded-lg border border-slate-300 cursor-pointer p-1"
                  />
                </div>
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs font-bold text-slate-700">Deskripsi Ringkas Kartu Visual</label>
                <textarea
                  rows={2}
                  value={settings.bannerCardDescription}
                  onChange={(e) => setSettings({ ...settings, bannerCardDescription: e.target.value })}
                  placeholder="Generator Ide Konten, Video-to-Prompt..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
            </div>

            {/* Feature Points Editor */}
            <div className="pt-4 border-t border-slate-100 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-800">Kartu Poin Fitur Bento (Grid 2 Kolom)</h4>
                  <p className="text-[11px] text-slate-400">Tambah atau hapus fitur utama yang ditampilkan di bawah banner.</p>
                </div>

                <button
                  type="button"
                  onClick={handleAddFeaturePoint}
                  className="px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah Poin Fitur</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {settings.featurePoints.map((fp) => (
                  <div key={fp.id} className="p-3 rounded-xl border border-slate-200 bg-slate-50/50 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-1">
                      <select
                        value={fp.icon}
                        onChange={(e) => handleUpdateFeaturePoint(fp.id, 'icon', e.target.value)}
                        className="px-2 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold bg-white cursor-pointer"
                      >
                        <option value="lightbulb">💡 Ide</option>
                        <option value="video">🎬 Video</option>
                        <option value="camera">📷 Foto</option>
                        <option value="crop">✂️ Frame</option>
                        <option value="sparkles">✨ Sparkles</option>
                      </select>

                      <input
                        type="text"
                        value={fp.title}
                        onChange={(e) => handleUpdateFeaturePoint(fp.id, 'title', e.target.value)}
                        className="flex-1 px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-bold text-slate-900 bg-white"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDeleteFeaturePoint(fp.id)}
                      className="p-1.5 rounded-lg hover:bg-rose-100 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                      title="Hapus poin fitur"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'form' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Key className="w-4 h-4 text-indigo-600" />
              <span>Pengaturan Form Login & Tombol Aksi</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">Atur teks pada box login sebelah kanan, placeholder input, tombol utama, dan opsi tombol WhatsApp.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Judul Box Form Login</label>
              <input
                type="text"
                value={settings.formTitle}
                onChange={(e) => setSettings({ ...settings, formTitle: e.target.value })}
                placeholder="Masuk ke workspace Anda"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Sub-judul / Petunjuk Form</label>
              <input
                type="text"
                value={settings.formSubtitle}
                onChange={(e) => setSettings({ ...settings, formSubtitle: e.target.value })}
                placeholder="Gunakan Kode Akses Anda untuk melanjutkan."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Label Input Kode Akses</label>
              <input
                type="text"
                value={settings.inputLabel}
                onChange={(e) => setSettings({ ...settings, inputLabel: e.target.value })}
                placeholder="Kode Akses"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Placeholder Input Text</label>
              <input
                type="text"
                value={settings.inputPlaceholder}
                onChange={(e) => setSettings({ ...settings, inputPlaceholder: e.target.value })}
                placeholder="Masukkan kode akses Anda"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Teks Tombol Masuk Utama</label>
              <input
                type="text"
                value={settings.buttonText}
                onChange={(e) => setSettings({ ...settings, buttonText: e.target.value })}
                placeholder="Masuk ke aplikasi"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Teks Tombol Saat Memverifikasi (Loading)</label>
              <input
                type="text"
                value={settings.buttonLoadingText}
                onChange={(e) => setSettings({ ...settings, buttonLoadingText: e.target.value })}
                placeholder="Memverifikasi..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Warna Utama Tombol Masuk (Hex)</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={settings.buttonColor}
                  onChange={(e) => setSettings({ ...settings, buttonColor: e.target.value })}
                  className="w-10 h-10 rounded-lg border border-slate-300 cursor-pointer p-1"
                />
                <input
                  type="text"
                  value={settings.buttonColor}
                  onChange={(e) => setSettings({ ...settings, buttonColor: e.target.value })}
                  className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-mono font-bold text-slate-900 uppercase outline-none"
                />
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700">Tampilkan Link &quot;Lihat Paket Akses&quot;</label>
                <input
                  type="checkbox"
                  checked={settings.showPaketAksesLink}
                  onChange={(e) => setSettings({ ...settings, showPaketAksesLink: e.target.checked })}
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
              </div>
              <input
                type="text"
                value={settings.paketAksesButtonText}
                onChange={(e) => setSettings({ ...settings, paketAksesButtonText: e.target.value })}
                placeholder="Belum punya kode akses? Lihat paket akses"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>

            <div className="space-y-3 pt-2 md:col-span-2 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700">Tampilkan Tombol Konsultasi WhatsApp</label>
                <input
                  type="checkbox"
                  checked={settings.showWaButton}
                  onChange={(e) => setSettings({ ...settings, showWaButton: e.target.checked })}
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                />
              </div>
              <input
                type="text"
                value={settings.waButtonText}
                onChange={(e) => setSettings({ ...settings, waButtonText: e.target.value })}
                placeholder="Konsultasi melalui WhatsApp"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 font-bold focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>
          </div>
        </div>
      )}

      {activeTab === 'theme' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-indigo-600" />
              <span>Pengaturan Warna Latar Halaman & Badge Footer</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">Kustomisasi warna background halaman dan teks jaminan di bagian paling bawah halaman.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Warna Background Halaman Login (Hex)</label>
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
              <label className="text-xs font-bold text-slate-700">URL Gambar Pattern Background (Opsional)</label>
              <input
                type="text"
                value={settings.bgPatternUrl}
                onChange={(e) => setSettings({ ...settings, bgPatternUrl: e.target.value })}
                placeholder="https://domain.com/bg-pattern.svg"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-mono text-slate-900 outline-none"
              />
            </div>

            {/* Footer Items List */}
            <div className="space-y-3 md:col-span-2 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-800">Badge Jaminan Footer</h4>
                  <p className="text-[11px] text-slate-400">Poin keunggulan singkat di bagian paling bawah.</p>
                </div>

                <button
                  type="button"
                  onClick={handleAddFooterItem}
                  className="px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah Item Footer</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {settings.footerItems.map((item, idx) => (
                  <div key={idx} className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 flex items-center gap-2">
                    <input
                      type="text"
                      value={item}
                      onChange={(e) => handleUpdateFooterItem(idx, e.target.value)}
                      className="flex-1 px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-bold text-slate-900 bg-white"
                    />
                    <button
                      type="button"
                      onClick={() => handleDeleteFooterItem(idx)}
                      className="p-1.5 rounded-lg hover:bg-rose-100 text-slate-400 hover:text-rose-600 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* LIVE PREVIEW SIMULATOR */}
      {activeTab === 'preview' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Eye className="w-4 h-4 text-indigo-600" />
              <span>Simulasi Live Preview Tampilan UI Login</span>
            </h3>
            <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold uppercase tracking-wider">
              Realtime Preview
            </span>
          </div>

          <div 
            className="w-full rounded-2xl p-6 md:p-8 border border-slate-300 shadow-inner overflow-hidden min-h-[500px] flex flex-col justify-between"
            style={{ 
              backgroundColor: settings.pageBgColor || '#fcf8ff',
              backgroundImage: settings.bgPatternUrl ? `url(${settings.bgPatternUrl})` : undefined,
              backgroundSize: 'cover'
            }}
          >
            {/* Header Preview */}
            <div className="flex justify-between items-center pb-6 border-b border-slate-200/40">
              <div className="text-xl font-extrabold tracking-tight flex items-center gap-2" style={{ color: settings.logoThemeColor || '#3525cd' }}>
                {settings.logoImageUrl ? (
                  <SafeImage src={settings.logoImageUrl} alt="Logo" className="h-8 max-w-[120px] object-contain" />
                ) : (
                  <span 
                    className="w-7 h-7 rounded-lg text-white flex items-center justify-center text-xs font-black shadow-sm"
                    style={{ backgroundColor: settings.logoThemeColor || '#3525cd' }}
                  >
                    {settings.logoBadgeText || 'TS'}
                  </span>
                )}
                <span>{settings.logoTitle || 'Tools Satset'}</span>
              </div>

              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                <HelpCircle className="w-3.5 h-3.5" />
                <span>{settings.headerHelpText || 'Bantuan'}</span>
              </div>
            </div>

            {/* Main Content Grid Preview */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center my-6">
              {/* Left Column Preview */}
              <div className="space-y-6">
                <h2 className="text-2xl md:text-3xl font-black text-slate-900 leading-tight">
                  {settings.heroTitle || 'Buat lebih banyak konten dari satu video'}
                </h2>

                <div 
                  className="w-full rounded-2xl p-6 text-white shadow-lg relative overflow-hidden"
                  style={
                    settings.heroImageUrl 
                      ? { backgroundImage: `url(${settings.heroImageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
                      : { background: `linear-gradient(135deg, ${settings.bannerGradientFrom || '#1e1b4b'}, ${settings.bannerGradientTo || '#3525cd'})` }
                  }
                >
                  <div className="relative z-10 space-y-2">
                    <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center">
                      <Sparkles className="w-5 h-5 text-amber-300" />
                    </div>
                    <h3 className="text-lg font-bold">{settings.bannerCardTitle}</h3>
                    <p className="text-xs text-white/80 leading-relaxed">{settings.bannerCardDescription}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  {settings.featurePoints.map(fp => (
                    <div key={fp.id} className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white border border-slate-200/80 shadow-2xs">
                      <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center text-[#3525cd] shrink-0">
                        {renderIcon(fp.icon)}
                      </div>
                      <span className="font-bold text-xs text-slate-800">{fp.title}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right Login Box Preview */}
              <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-lg space-y-4 max-w-sm mx-auto w-full">
                <div className="space-y-1">
                  <h3 className="text-lg font-extrabold text-slate-900">{settings.formTitle}</h3>
                  <p className="text-xs text-slate-500">{settings.formSubtitle}</p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-700 uppercase">{settings.inputLabel}</label>
                  <input
                    type="text"
                    disabled
                    placeholder={settings.inputPlaceholder}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-slate-50"
                  />
                </div>

                <button
                  type="button"
                  style={{ backgroundColor: settings.buttonColor || '#3525cd' }}
                  className="w-full py-2.5 rounded-xl text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md"
                >
                  <span>{settings.buttonText}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>

                {settings.showPaketAksesLink && (
                  <div className="text-center pt-1">
                    <span className="text-[11px] font-bold text-indigo-600 underline">
                      {settings.paketAksesButtonText}
                    </span>
                  </div>
                )}

                {settings.showWaButton && (
                  <div className="pt-2 border-t border-slate-100">
                    <div className="w-full py-2 rounded-xl border border-emerald-300 bg-emerald-50/50 text-[#25D366] font-bold text-xs flex items-center justify-center gap-1.5">
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>{settings.waButtonText}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer Preview */}
            <div className="pt-4 border-t border-slate-200/40 flex justify-center items-center gap-4 text-[11px] font-medium text-slate-500">
              {settings.footerItems.map((fi, idx) => (
                <span key={idx} className="flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-slate-400" />
                  <span>{fi}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
