'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Key, ArrowRight, HelpCircle, Lock, ShieldCheck, Headphones, Sparkles, Lightbulb, Video, Camera, Crop, MessageCircle } from 'lucide-react';
import { motion } from 'motion/react';
import { SafeImage } from '../common/SafeImage';
import { verifyAccessCode, verifyAccessCodeAsync, setUserSession, UserSession } from '../../lib/auth';
import { getWhatsAppUrl, syncContactSettingsWithBackend } from '../../lib/admin/contactSettings';
import { LoginUiSettings, DEFAULT_LOGIN_UI_SETTINGS, getLoginUiSettings, syncLoginUiSettingsWithBackend } from '../../lib/admin/loginUiSettings';
import { subscribeLiveGenerationEvents } from '../../events/generationEvent';

interface LoginViewProps {
  onLoginSuccess: (session: UserSession) => void;
  onOpenPaketAkses?: () => void;
}

export default function LoginView({ onLoginSuccess, onOpenPaketAkses }: LoginViewProps) {
  const [accessCodeInput, setAccessCodeInput] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uiSettings, setUiSettings] = useState<LoginUiSettings>(() => getLoginUiSettings());

  const loadLoginUiSettings = useCallback(async () => {
    try {
      const synced = await syncLoginUiSettingsWithBackend();
      if (synced) {
        setUiSettings(synced);
      }
    } catch (e) {
      // Keep cached
    }
  }, []);

  useEffect(() => {
    syncContactSettingsWithBackend();

    const handleUpdate = () => {
      setUiSettings(getLoginUiSettings());
    };

    window.addEventListener('satset_login_ui_settings_updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);

    const unsubscribeSse = subscribeLiveGenerationEvents((data) => {
      if (data.type === 'login_ui_settings_updated' && data.loginUiSettings) {
        setUiSettings({
          ...DEFAULT_LOGIN_UI_SETTINGS,
          ...data.loginUiSettings
        });
      }
    });

    return () => {
      window.removeEventListener('satset_login_ui_settings_updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
      unsubscribeSse();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsSubmitting(true);

    try {
      const res = await verifyAccessCodeAsync(accessCodeInput);
      if (res.success && res.role) {
        const session: UserSession = {
          code: res.code || accessCodeInput,
          role: res.role,
          email: res.email,
          loginTime: Date.now(),
        };
        setUserSession(session);
        onLoginSuccess(session);
      } else {
        setErrorMsg(res.error || 'Kode Akses tidak valid.');
      }
    } catch (err) {
      setErrorMsg('Gagal memverifikasi kode akses.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openWhatsApp = () => {
    const url = getWhatsAppUrl();
    window.open(url, '_blank');
  };

  const renderIcon = (iconName: string) => {
    switch (iconName) {
      case 'lightbulb': return <Lightbulb className="w-5 h-5" />;
      case 'video': return <Video className="w-5 h-5" />;
      case 'camera': return <Camera className="w-5 h-5" />;
      case 'crop': return <Crop className="w-5 h-5" />;
      case 'sparkles': return <Sparkles className="w-5 h-5" />;
      default: return <Sparkles className="w-5 h-5" />;
    }
  };

  return (
    <div 
      className="min-h-screen text-[#1b1b24] flex flex-col font-sans selection:bg-[#4f46e5] selection:text-white transition-colors"
      style={{
        backgroundColor: uiSettings.pageBgColor || '#fcf8ff',
        backgroundImage: uiSettings.bgPatternUrl ? `url(${uiSettings.bgPatternUrl})` : undefined,
        backgroundSize: 'cover'
      }}
    >
      {/* Header */}
      <header className="w-full h-20 shrink-0 border-b border-transparent relative z-10">
        <div className="h-full max-w-7xl mx-auto px-4 md:px-10 flex justify-between items-center">
          <div 
            className="text-2xl font-extrabold tracking-tight flex items-center gap-2"
            style={{ color: uiSettings.logoThemeColor || '#3525cd' }}
          >
            {uiSettings.logoImageUrl ? (
              <div className="h-9 max-w-[160px] relative w-32">
                <SafeImage src={uiSettings.logoImageUrl} alt="Brand Logo" fill className="object-contain" />
              </div>
            ) : (
              <span 
                className="w-8 h-8 rounded-xl text-white flex items-center justify-center text-sm font-black shadow-md"
                style={{ backgroundColor: uiSettings.logoThemeColor || '#3525cd' }}
              >
                {uiSettings.logoBadgeText || 'TS'}
              </span>
            )}
            <span>{uiSettings.logoTitle || 'Tools Satset'}</span>
          </div>

          <button
            type="button"
            onClick={openWhatsApp}
            className="flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-[#3525cd] transition-colors cursor-pointer"
          >
            <HelpCircle className="w-4 h-4" />
            <span>{uiSettings.headerHelpText || 'Bantuan'}</span>
          </button>
        </div>
      </header>

      {/* Main Content Grid */}
      <main className="flex-grow flex items-center justify-center py-8 px-4 md:px-10 relative z-0">
        <motion.div 
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="w-full max-w-7xl grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-16 items-center"
        >
          {/* Left Column: Visual Brand */}
          <div className="hidden md:flex flex-col gap-8 pr-4 lg:pr-8">
            <h1 className="text-4xl lg:text-5xl font-extrabold text-[#1b1b24] leading-tight tracking-tight">
              {uiSettings.heroTitle || 'Buat lebih banyak konten dari satu video'}
            </h1>

            {/* Graphic / Visual Element */}
            <motion.div 
              whileHover={{ scale: 1.01 }}
              transition={{ duration: 0.2 }}
              className="w-full aspect-[4/3] rounded-[24px] relative overflow-hidden flex items-center justify-center p-8 shadow-xl border border-indigo-200/40"
              style={
                uiSettings.heroImageUrl 
                  ? { backgroundImage: `url(${uiSettings.heroImageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
                  : { background: `linear-gradient(135deg, ${uiSettings.bannerGradientFrom || '#1e1b4b'}, ${uiSettings.bannerGradientTo || '#3525cd'})` }
              }
            >
              {/* Background ambient lighting */}
              {!uiSettings.heroImageUrl && (
                <>
                  <div className="absolute -top-20 -left-20 w-64 h-64 bg-indigo-400/30 rounded-full blur-3xl" />
                  <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-purple-400/30 rounded-full blur-3xl" />
                </>
              )}

              <div className="relative z-10 text-center text-white space-y-4 max-w-md">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white shadow-inner">
                  <Sparkles className="w-8 h-8 text-amber-300" />
                </div>
                <h3 className="text-xl font-bold">{uiSettings.bannerCardTitle || 'Workspace AI All-in-One'}</h3>
                <p className="text-xs text-indigo-100/90 leading-relaxed font-normal">
                  {uiSettings.bannerCardDescription || 'Generator Ide Konten, Video-to-Prompt, Prompt Foto Nano Banana Ultra, dan Frame Extractor dalam satu platform satset.'}
                </p>
              </div>
            </motion.div>

            {/* Feature Points Bento-style */}
            <div className="grid grid-cols-2 gap-4">
              {(uiSettings.featurePoints && uiSettings.featurePoints.length > 0 ? uiSettings.featurePoints : DEFAULT_LOGIN_UI_SETTINGS.featurePoints).map((fp) => (
                <motion.div key={fp.id} whileHover={{ y: -2 }} className="flex items-center gap-3.5 p-3.5 rounded-2xl bg-white border border-slate-200/80 shadow-2xs">
                  <div className="w-10 h-10 shrink-0 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-[#3525cd]">
                    {renderIcon(fp.icon)}
                  </div>
                  <div className="font-bold text-sm text-slate-900">{fp.title}</div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Right Column: Login Form Panel */}
          <div className="w-full max-w-md mx-auto md:mr-0 md:ml-auto">
            <div className="bg-white rounded-[24px] shadow-xl shadow-indigo-100/50 border border-slate-200/80 p-8 md:p-10 flex flex-col gap-6 relative overflow-hidden">
              {/* Decorative ambient blur top right */}
              <div className="absolute -top-16 -right-16 w-32 h-32 bg-indigo-200/40 blur-3xl rounded-full pointer-events-none" />

              <div className="flex flex-col gap-1.5 relative z-10">
                <h2 className="text-2xl sm:text-3xl font-extrabold text-[#1b1b24] tracking-tight">
                  {uiSettings.formTitle || 'Masuk ke workspace Anda'}
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 font-medium">
                  {uiSettings.formSubtitle || 'Gunakan Kode Akses Anda untuk melanjutkan.'}
                </p>
              </div>

              <form onSubmit={handleSubmit} className="flex flex-col gap-4 relative z-10">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider" htmlFor="access_code">
                    {uiSettings.inputLabel || 'Kode Akses'}
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Key className="w-4 h-4" />
                    </span>
                    <input
                      id="access_code"
                      type="text"
                      value={accessCodeInput}
                      onChange={(e) => setAccessCodeInput(e.target.value)}
                      placeholder={uiSettings.inputPlaceholder || 'Masukkan kode akses Anda'}
                      className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 font-mono text-sm placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-[#3525cd] focus:border-[#3525cd] transition-all outline-none"
                    />
                  </div>
                </div>

                {errorMsg && (
                  <motion.div 
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold"
                  >
                    {errorMsg}
                  </motion.div>
                )}

                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  disabled={isSubmitting}
                  style={{ backgroundColor: uiSettings.buttonColor || '#3525cd' }}
                  className="w-full py-3.5 rounded-xl hover:opacity-95 text-white font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-md shadow-indigo-300/40 cursor-pointer disabled:opacity-60"
                >
                  <span>{isSubmitting ? (uiSettings.buttonLoadingText || 'Memverifikasi...') : (uiSettings.buttonText || 'Masuk ke aplikasi')}</span>
                  <ArrowRight className="w-4 h-4" />
                </motion.button>
              </form>

              <div className="flex flex-col gap-4 relative z-10 pt-2 border-t border-slate-100">
                {onOpenPaketAkses && uiSettings.showPaketAksesLink !== false && (
                  <div className="text-center">
                    <button
                      type="button"
                      onClick={onOpenPaketAkses}
                      className="text-xs font-bold hover:underline cursor-pointer"
                      style={{ color: uiSettings.buttonColor || '#3525cd' }}
                    >
                      {uiSettings.paketAksesButtonText || 'Belum punya kode akses? Lihat paket akses'}
                    </button>
                  </div>
                )}

                {uiSettings.showWaButton !== false && (
                  <>
                    <div className="flex items-center gap-3">
                      <div className="h-px bg-slate-200 flex-grow" />
                      <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">atau</span>
                      <div className="h-px bg-slate-200 flex-grow" />
                    </div>

                    {/* WhatsApp Consultation Button */}
                    <motion.button
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.98 }}
                      type="button"
                      onClick={openWhatsApp}
                      className="w-full py-3 rounded-xl border border-emerald-300 bg-emerald-50/50 hover:bg-emerald-100/60 text-[#25D366] font-bold text-xs sm:text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
                    >
                      <MessageCircle className="w-4 h-4 text-[#25D366]" />
                      <span>{uiSettings.waButtonText || 'Konsultasi melalui WhatsApp'}</span>
                    </motion.button>
                  </>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="w-full shrink-0 border-t border-slate-200/60 bg-white/80 backdrop-blur-sm mt-auto py-4 relative z-10">
        <div className="max-w-7xl mx-auto px-4 flex justify-center items-center">
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-slate-500 font-medium">
            {(uiSettings.footerItems && uiSettings.footerItems.length > 0 ? uiSettings.footerItems : DEFAULT_LOGIN_UI_SETTINGS.footerItems).map((fi, idx) => (
              <React.Fragment key={idx}>
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
                  <span>{fi}</span>
                </span>
                {idx < uiSettings.footerItems.length - 1 && (
                  <span className="w-1 h-1 rounded-full bg-slate-300 hidden sm:block" />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
