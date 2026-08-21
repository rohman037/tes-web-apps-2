'use client';

import React, { useState, useEffect, useCallback } from "react";
import { 
  Zap, 
  Key, 
  Copy, 
  Check, 
  Calendar, 
  Sparkles, 
  CheckSquare, 
  Square, 
  Plus, 
  Clock, 
  Trash2, 
  Users,
  Ban,
  RefreshCw
} from 'lucide-react';
import DataTable from '../../components/admin/DataTable';
import { 
  getClients, 
  saveClient, 
  deleteClient, 
  ClientItem, 
  calculateClientStatus,
  extendClientExpiry,
  updateClientStatus
} from '../../lib/admin/clients';
import { getUserSession } from '../../lib/auth';
import { maskAccessCode } from '../../utils/maskAccessCode';
import { generateSecureAccessCode } from '../../lib/admin/codeGenerator';
import { formatRupiah } from '../../lib/payment';

const TOOL_OPTIONS = [
  { id: 'videoToPrompt', label: 'Generator Prompt Video AI 8K', icon: '🎬' },
  { id: 'tiktokDownloader', label: 'TikTok Downloader No Watermark', icon: '🎵' },
  { id: 'contentIdeas', label: 'Generator Ide Konten FYP', icon: '💡' },
  { id: 'photoPrompt', label: 'Photo Prompt Generator Ultra HD', icon: '📸' },
  { id: 'frameExtractor', label: 'Video Frame Extractor', icon: '🖼️' }
];

const PRESET_DURATIONS = [
  { label: '7 Hari', days: 7 },
  { label: '14 Hari', days: 14 },
  { label: '30 Hari', days: 30 },
  { label: '90 Hari', days: 90 },
  { label: 'Lifetime (10 Thn)', days: 3650 }
];

export default function CustomAccessPanel() {
  const [clients, setClients] = useState<ClientItem[]>(() => getClients());
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Form State
  const [clientName, setClientName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [customCodeInput, setCustomCodeInput] = useState('');
  const [notes, setNotes] = useState('Akses Khusus Client Custom VIP');
  const [customDays, setCustomDays] = useState<number>(30);
  const [customPrice, setCustomPrice] = useState<number | string>('');
  const [selectedTools, setSelectedTools] = useState<string[]>([
    'videoToPrompt',
    'tiktokDownloader',
    'contentIdeas',
    'photoPrompt',
    'frameExtractor'
  ]);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const loadClients = useCallback(async () => {
    try {
      const session = getUserSession();
      const code = session?.code || 'SATSET-ADMIN';
      const res = await fetch('/api/admin/clients', {
        headers: { 'x-access-code': code }
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          const processed = data.map((item: any) => ({
            ...item,
            status: calculateClientStatus(item.expiryDate, item.status)
          }));
          setClients(processed);
          localStorage.setItem('satset_clients_data', JSON.stringify(processed));
        }
      }
    } catch (e) {
      // Fallback already rendered from getClients()
    }
  }, []);

  useEffect(() => {
    window.addEventListener('satset_clients_updated', loadClients);
    window.addEventListener('satset_access_codes_updated', loadClients);
    window.addEventListener('storage', loadClients);
    return () => {
      window.removeEventListener('satset_clients_updated', loadClients);
      window.removeEventListener('satset_access_codes_updated', loadClients);
      window.removeEventListener('storage', loadClients);
    };
  }, [loadClients]);

  const safeClients = Array.isArray(clients) ? clients : [];
  const customClients = safeClients.filter((c) => c.type === 'custom');

  const handleToggleTool = (toolId: string) => {
    if (selectedTools.includes(toolId)) {
      setSelectedTools(selectedTools.filter((t) => t !== toolId));
    } else {
      setSelectedTools([...selectedTools, toolId]);
    }
  };

  const handleSelectAllTools = () => {
    if (selectedTools.length === TOOL_OPTIONS.length) {
      setSelectedTools([]);
    } else {
      setSelectedTools(TOOL_OPTIONS.map((t) => t.id));
    }
  };

  const handleCreateAndCopyCustomAccess = (e: React.FormEvent) => {
    e.preventDefault();

    const cleanInputCode = customCodeInput.trim().toUpperCase();
    const finalCode = cleanInputCode || generateSecureAccessCode('CUSTOM');
    const now = new Date();
    const expiry = new Date();
    const days = Number(customDays) || 30;
    expiry.setDate(now.getDate() + days);

    const priceNum = Number(customPrice) || 0;

    const newClient: ClientItem = {
      id: `cli_custom_${Date.now()}`,
      accessCode: finalCode,
      name: clientName.trim() || 'Client Custom VIP',
      whatsapp: whatsapp.trim() || undefined,
      packageId: 'custom',
      packageName: `Custom (${days >= 3650 ? 'Lifetime' : `${days} Hari`})`,
      price: priceNum,
      startDate: now.toISOString(),
      expiryDate: expiry.toISOString(),
      status: calculateClientStatus(expiry.toISOString()),
      type: 'custom',
      notes: notes.trim(),
      customFeatures: selectedTools,
      toolUsage: {
        tiktokDownloader: 0,
        contentIdeas: 0,
        videoToPrompt: 0,
        photoPrompt: 0,
        frameExtractor: 0
      },
      createdAt: now.toISOString()
    };

    saveClient(newClient);

    // Auto copy to clipboard
    try {
      navigator.clipboard.writeText(finalCode);
      setCopiedCode(finalCode);
    } catch (e) {}

    setSuccessMsg(`✅ Akses Custom Berhasil Dibuat & Tersalin ke Clipboard!\nKode: ${finalCode}`);
    setTimeout(() => setSuccessMsg(null), 6000);

    // Reset Form
    setClientName('');
    setWhatsapp('');
    setCustomCodeInput('');
    setCustomPrice('');
    loadClients();
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleExtend = (id: string, days: number) => {
    extendClientExpiry(id, days);
    loadClients();
  };

  const handleToggleSuspend = (client: ClientItem) => {
    const nextStatus = client.status === 'suspended' ? 'active' : 'suspended';
    updateClientStatus(client.id, nextStatus);
    loadClients();
  };

  const handleDeleteCustom = (id: string) => {
    if (confirm('Apakah Anda yakin ingin menghapus catatan akses custom ini?')) {
      deleteClient(id);
      loadClients();
    }
  };

  const columns = [
    {
      header: 'Kode Akses & Client',
      render: (item: ClientItem) => (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-extrabold text-[#3525cd] bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100 select-all">
              {maskAccessCode(item.accessCode)}
            </span>
            <button
              type="button"
              onClick={() => handleCopyCode(item.accessCode)}
              className="p-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors cursor-pointer"
              title="Salin Kode Akses"
            >
              {copiedCode === item.accessCode ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
          <div className="font-bold text-slate-900 text-xs">{item.name}</div>
          {item.whatsapp && <div className="text-[11px] text-slate-500">WA: {item.whatsapp}</div>}
        </div>
      )
    },
    {
      header: 'Durasi & Harga',
      render: (item: ClientItem) => (
        <div className="space-y-0.5">
          <div className="font-bold text-slate-800 text-xs">{item.packageName}</div>
          <div className="text-xs text-slate-500">Harga: <span className="font-bold text-emerald-600">{formatRupiah(item.price)}</span></div>
        </div>
      )
    },
    {
      header: 'Fitur Diizinkan',
      render: (item: ClientItem) => (
        <div className="text-[11px] text-slate-600 font-medium">
          {Array.isArray(item.customFeatures) && item.customFeatures.length > 0
            ? `${item.customFeatures.length} / 5 Tool AI Diizinkan`
            : 'Semua Tool AI (5/5)'}
        </div>
      )
    },
    {
      header: 'Masa Aktif',
      render: (item: ClientItem) => {
        const isSusp = item.status === 'suspended';
        const isExp = new Date(item.expiryDate).getTime() < Date.now();
        return (
          <div className="space-y-0.5">
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
              isSusp
                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                : isExp 
                ? 'bg-rose-50 text-rose-700 border border-rose-200' 
                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            }`}>
              {isSusp ? 'Suspended' : isExp ? 'Expired' : 'Aktif'}
            </span>
            <div className="text-[10px] text-slate-500 mt-0.5">
              Exp: {new Date(item.expiryDate).toLocaleDateString('id-ID')}
            </div>
          </div>
        );
      }
    },
    {
      header: 'Aksi Cepat',
      render: (item: ClientItem) => (
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => handleExtend(item.id, 30)}
            className="px-2 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1"
            title="Perpanjang 30 hari"
          >
            <RefreshCw className="w-3 h-3" />
            <span>+30H</span>
          </button>
          <button
            type="button"
            onClick={() => handleToggleSuspend(item)}
            className={`p-1.5 rounded-lg border text-[11px] font-bold transition-colors cursor-pointer ${
              item.status === 'suspended'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
            }`}
            title={item.status === 'suspended' ? 'Aktifkan Kembali' : 'Suspend Akses'}
          >
            <Ban className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => handleDeleteCustom(item.id)}
            className="p-1.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 transition-colors cursor-pointer"
            title="Hapus Catatan Custom"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6">
      {/* Toast Banner */}
      {successMsg && (
        <div className="p-4 rounded-2xl bg-emerald-500 text-white font-bold text-xs flex items-center justify-between shadow-lg animate-in fade-in">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-200" />
            <span className="whitespace-pre-line text-sm">{successMsg}</span>
          </div>
        </div>
      )}

      {/* Main Fast Creation Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs space-y-5">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <Zap className="w-5 h-5 text-amber-500" />
          <div>
            <h3 className="text-base font-extrabold text-slate-900">
              Buat Akses Custom Instan (1-Click)
            </h3>
            <p className="text-xs text-slate-500">
              Isi data client, pilih preset durasi, dan klik satu tombol untuk langsung generate & menyalin kode akses aman.
            </p>
          </div>
        </div>

        <form onSubmit={handleCreateAndCopyCustomAccess} className="space-y-5">
          {/* Row 1: Client details */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Nama Client / Agensi <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="misal: Agensi Media Digital VIP"
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:border-[#3525cd]"
                required
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Kode Akses (Opsional)</label>
              <input
                type="text"
                value={customCodeInput}
                onChange={(e) => setCustomCodeInput(e.target.value)}
                placeholder="Kosongkan utk auto-generate"
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-mono font-bold text-[#3525cd] uppercase focus:outline-none focus:border-[#3525cd]"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Nomor WhatsApp (Opsional)</label>
              <input
                type="text"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                placeholder="08123456789"
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-[#3525cd]"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Harga Deal / Custom (Rp)</label>
              <input
                type="number"
                min="0"
                value={customPrice}
                onChange={(e) => setCustomPrice(e.target.value)}
                placeholder="0 (Gratis / Testing)"
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:border-[#3525cd]"
              />
            </div>
          </div>

          {/* Row 2: Duration Presets */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700 block">
              Pilih Durasi Akses Cepat:
            </label>
            <div className="flex flex-wrap items-center gap-2">
              {PRESET_DURATIONS.map((preset) => {
                const isActive = customDays === preset.days;
                return (
                  <button
                    key={preset.days}
                    type="button"
                    onClick={() => setCustomDays(preset.days)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                      isActive
                        ? 'bg-[#3525cd] text-white border-[#3525cd] shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}

              <div className="flex items-center gap-1.5 ml-auto">
                <span className="text-xs text-slate-500 font-medium">Atau Custom:</span>
                <input
                  type="number"
                  min="1"
                  max="3650"
                  value={customDays}
                  onChange={(e) => setCustomDays(Number(e.target.value))}
                  className="w-20 px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-center focus:outline-none focus:border-[#3525cd]"
                />
                <span className="text-xs text-slate-500 font-bold">Hari</span>
              </div>
            </div>
          </div>

          {/* Row 3: Feature Permissions (Defaults ALL checked) */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800">
                Fitur Tool AI Diizinkan (Default: Semua Tercentang):
              </label>
              <button
                type="button"
                onClick={handleSelectAllTools}
                className="text-[11px] font-bold text-[#3525cd] hover:underline cursor-pointer"
              >
                {selectedTools.length === TOOL_OPTIONS.length ? 'Batal Pilih Semua' : 'Pilih Semua Fitur'}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {TOOL_OPTIONS.map((tool) => {
                const isChecked = selectedTools.includes(tool.id);
                return (
                  <button
                    key={tool.id}
                    type="button"
                    onClick={() => handleToggleTool(tool.id)}
                    className={`p-2.5 rounded-xl border text-left transition-all flex items-center justify-between cursor-pointer ${
                      isChecked
                        ? 'bg-indigo-50/60 border-[#3525cd] text-slate-900 font-bold'
                        : 'bg-slate-50 border-slate-200 text-slate-400'
                    }`}
                  >
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-sm">{tool.icon}</span>
                      <span>{tool.label}</span>
                    </div>
                    {isChecked ? (
                      <CheckSquare className="w-4 h-4 text-[#3525cd] shrink-0" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-300 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Action Row */}
          <div className="pt-2">
            <button
              type="submit"
              className="w-full py-3.5 rounded-2xl bg-[#3525cd] hover:bg-[#2c1eb3] text-white font-extrabold text-sm transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 cursor-pointer"
            >
              <Sparkles className="w-5 h-5 text-amber-300" />
              <span>Buat & Salin Kode Akses Instan</span>
              <Copy className="w-4 h-4 opacity-80" />
            </button>
          </div>
        </form>
      </div>

      {/* Custom Access History Table */}
      <DataTable
        title="Riwayat Akses Custom Diterbitkan"
        subtitle="Daftar seluruh akun client custom yang telah dibuat."
        columns={columns}
        data={customClients}
        emptyMessage="Belum ada akun akses custom yang diterbitkan."
      />
    </div>
  );
}
