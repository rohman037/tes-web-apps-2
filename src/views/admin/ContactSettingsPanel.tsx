'use client';

import React, { useState, useEffect, useCallback } from "react";
import { 
  MessageSquare, 
  Phone, 
  Save, 
  CheckCircle, 
  AlertCircle, 
  ExternalLink, 
  HelpCircle,
  Sparkles,
  Smartphone
} from 'lucide-react';
import StatCard from '../../components/admin/StatCard';
import { 
  getContactSettings, 
  saveContactSettings, 
  getWhatsAppUrl, 
  normalizeWhatsAppNumber,
  isValidWhatsAppNumber,
  syncContactSettingsWithBackend,
  ContactSettings 
} from '../../lib/admin/contactSettings';

export default function ContactSettingsPanel() {
  const [whatsappNumber, setWhatsappNumber] = useState<string>(() => getContactSettings().whatsappNumber || '');
  const [whatsappTemplate, setWhatsappTemplate] = useState<string>(() => getContactSettings().whatsappTemplate || '');
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(() => {
    const s = getContactSettings();
    return s.updatedAt ? new Date(s.updatedAt).toLocaleString('id-ID') : null;
  });

  const loadSettings = useCallback(() => {
    const settings = getContactSettings();
    setWhatsappNumber(settings.whatsappNumber);
    setWhatsappTemplate(settings.whatsappTemplate);
    setLastUpdated(settings.updatedAt ? new Date(settings.updatedAt).toLocaleString('id-ID') : null);
  }, []);

  useEffect(() => {
    syncContactSettingsWithBackend().then(() => loadSettings());
    window.addEventListener('satset_contact_settings_updated', loadSettings);
    window.addEventListener('storage', loadSettings);
    return () => {
      window.removeEventListener('satset_contact_settings_updated', loadSettings);
      window.removeEventListener('storage', loadSettings);
    };
  }, [loadSettings]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg(null);

    const normalized = normalizeWhatsAppNumber(whatsappNumber);
    if (!isValidWhatsAppNumber(normalized)) {
      setStatusMsg({
        type: 'error',
        text: 'Nomor WhatsApp tidak valid. Masukkan minimal 10 digit angka (contoh: 081234567890 atau 6281234567890).'
      });
      return;
    }

    const res = saveContactSettings({
      whatsappNumber: normalized,
      whatsappTemplate: whatsappTemplate.trim()
    });

    if (res.success) {
      setStatusMsg({
        type: 'success',
        text: 'Pengaturan nomor WhatsApp berhasil diperbarui!'
      });
      loadSettings();
      setTimeout(() => setStatusMsg(null), 4000);
    } else {
      setStatusMsg({
        type: 'error',
        text: res.error || 'Gagal menyimpan pengaturan WhatsApp.'
      });
    }
  };

  const previewUrl = getWhatsAppUrl({
    whatsappNumber: whatsappNumber || '6281234567890',
    whatsappTemplate: whatsappTemplate || 'Halo Admin...'
  });

  const normalizedPreview = normalizeWhatsAppNumber(whatsappNumber);
  const isNumValid = isValidWhatsAppNumber(normalizedPreview);

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {statusMsg && (
        <div
          className={`p-4 rounded-2xl text-xs font-bold flex items-center justify-between shadow-lg transition-all ${
            statusMsg.type === 'success'
              ? 'bg-emerald-600 text-white'
              : 'bg-rose-600 text-white'
          }`}
        >
          <div className="flex items-center gap-2">
            {statusMsg.type === 'success' ? (
              <CheckCircle className="w-5 h-5 text-emerald-200" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-200" />
            )}
            <span>{statusMsg.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusMsg(null)}
            className="text-white/80 hover:text-white font-extrabold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Top Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StatCard
          title="Nomor WA Aktif"
          value={normalizedPreview ? `+${normalizedPreview}` : 'Belum diatur'}
          subtext={isNumValid ? 'Status: Valid & Terhubung' : 'Nomor tidak valid'}
          icon={<Phone className="w-5 h-5 text-emerald-600" />}
        />
        <StatCard
          title="Terakhir Diperbarui"
          value={lastUpdated || 'Belum pernah'}
          subtext="Tersimpan di Konfigurasi Kontak"
          icon={<MessageSquare className="w-5 h-5 text-indigo-600" />}
        />
      </div>

      {/* Main Settings Form */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900">
                Pengaturan WhatsApp Admin
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Atur nomor WhatsApp &amp; template pesan untuk tombol &quot;Konsultasi melalui WhatsApp&quot; di halaman Login &amp; Paket Akses.
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-5">
          {/* WhatsApp Number Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
              <span>Nomor WhatsApp Admin <span className="text-rose-500">*</span></span>
              {isNumValid ? (
                <span className="text-[11px] text-emerald-600 font-bold flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>Format Valid ({normalizedPreview})</span>
                </span>
              ) : (
                <span className="text-[11px] text-rose-500 font-bold">
                  Format harus angka (min 10 digit)
                </span>
              )}
            </label>
            <div className="relative">
              <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                placeholder="Contoh: 081234567890 atau 6281234567890"
                value={whatsappNumber}
                onChange={(e) => setWhatsappNumber(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:border-[#3525cd]"
                required
              />
            </div>
            <p className="text-[11px] text-slate-500">
              Otomatis mengubah awalan <strong>0</strong> menjadi <strong>62</strong>. Awalan kode negara Indonesia (62) diperlukan agar link wa.me dapat langsung mengarahkan ke WhatsApp.
            </p>
          </div>

          {/* Message Template Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-800 block">
              Template Pesan Default
            </label>
            <textarea
              rows={3}
              placeholder="Contoh: Halo Admin Tools Satset, saya ingin bertanya..."
              value={whatsappTemplate}
              onChange={(e) => setWhatsappTemplate(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 focus:outline-none focus:border-[#3525cd]"
            />
            <p className="text-[11px] text-slate-500">
              Pesan default yang otomatis terisi di obrolan WhatsApp saat pengguna mengeklik tombol konsultasi.
            </p>
          </div>

          {/* Live Preview Card */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                <Smartphone className="w-4 h-4 text-emerald-600" />
                <span>Simulasi Output Link WhatsApp:</span>
              </span>
              <a
                href={previewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] transition-all flex items-center gap-1 cursor-pointer shadow-2xs"
              >
                <span>Uji Coba Link WA</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            <div className="p-3 rounded-lg bg-white border border-slate-200 text-xs font-mono text-slate-700 break-all select-all">
              {previewUrl}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end">
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-[#3525cd] hover:bg-[#2c1eb3] text-white text-xs font-extrabold transition-all shadow-md flex items-center gap-2 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Simpan Pengaturan WA</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
