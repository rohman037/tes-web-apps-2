'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Users, 
  Search, 
  Filter, 
  Clock, 
  Calendar, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  MoreHorizontal, 
  Trash2, 
  ShieldAlert, 
  Zap, 
  Eye, 
  Plus, 
  RefreshCw, 
  Edit3,
  X,
  Copy,
  Check
} from 'lucide-react';
import DataTable from '../../components/admin/DataTable';
import StatCard from '../../components/admin/StatCard';
import { 
  getClients, 
  saveClients, 
  saveClient,
  deleteClient, 
  updateClientStatus, 
  extendClientExpiry, 
  updateClientPackage,
  ClientItem,
  calculateClientStatus
} from '../../lib/admin/clients';
import { generateSecureAccessCode } from '../../lib/admin/codeGenerator';
import { getHistory } from '../../lib/history';
import { getPackages, PackageItem } from '../../lib/admin/packages';
import { getUserSession } from '../../lib/auth';
import { formatRupiah } from '../../lib/payment';
import { maskAccessCode } from '../../utils/maskAccessCode';
import { formatRemainingTime } from '../../utils/formatRemainingTime';
import { subscribeLiveGenerationEvents, ActiveGenerationItem } from '../../events/generationEvent';

export default function ClientMonitoringPanel() {
  const [clients, setClients] = useState<ClientItem[]>(() => getClients());
  const [packages, setPackages] = useState<PackageItem[]>(() => getPackages());
  const [activeGenerations, setActiveGenerations] = useState<ActiveGenerationItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Modals state
  const [showAddClientModal, setShowAddClientModal] = useState(false);
  const [addName, setAddName] = useState('');
  const [addWhatsapp, setAddWhatsapp] = useState('');
  const [addEmail, setAddEmail] = useState('');
  const [addPackageId, setAddPackageId] = useState('bulanan');
  const [addCustomCode, setAddCustomCode] = useState('');
  const [addDurationDays, setAddDurationDays] = useState<number>(30);

  const [selectedClientForHistory, setSelectedClientForHistory] = useState<ClientItem | null>(null);
  const [selectedClientForExtend, setSelectedClientForExtend] = useState<ClientItem | null>(null);
  const [extendDaysInput, setExtendDaysInput] = useState<number>(7);

  const [selectedClientForPackage, setSelectedClientForPackage] = useState<ClientItem | null>(null);
  const [targetPackageId, setTargetPackageId] = useState<string>('bulanan');

  const [clientToDelete, setClientToDelete] = useState<ClientItem | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const loadData = useCallback(async () => {
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
    window.addEventListener('satset_clients_updated', loadData);
    window.addEventListener('satset_packages_updated', loadData);
    window.addEventListener('satset_history_updated', loadData);
    window.addEventListener('storage', loadData);

    const unsubscribeLive = subscribeLiveGenerationEvents((data) => {
      if (data.activeGenerations) {
        setActiveGenerations(data.activeGenerations);
      }
    });

    return () => {
      window.removeEventListener('satset_clients_updated', loadData);
      window.removeEventListener('satset_packages_updated', loadData);
      window.removeEventListener('satset_history_updated', loadData);
      window.removeEventListener('storage', loadData);
      unsubscribeLive();
    };
  }, [loadData]);

  const safeClients = Array.isArray(clients) ? clients : [];
  const safePackages = Array.isArray(packages) ? packages : [];

  // Metrics
  const activeCount = safeClients.filter((c) => c.status === 'active').length;
  const expiringSoonCount = safeClients.filter((c) => c.status === 'expiring_soon').length;
  const expiredCount = safeClients.filter((c) => c.status === 'expired').length;

  // Filtering
  const filteredClients = safeClients.filter((client) => {
    // Status filter
    if (statusFilter !== 'all' && client.status !== statusFilter) {
      return false;
    }
    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const nameMatch = (client.name || '').toLowerCase().includes(q);
      const codeMatch = (client.accessCode || '').toLowerCase().includes(q);
      const waMatch = (client.whatsapp || '').toLowerCase().includes(q);
      const emailMatch = (client.email || '').toLowerCase().includes(q);
      return nameMatch || codeMatch || waMatch || emailMatch;
    }
    return true;
  });

  // Action Handlers
  const handleAddClientSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!addName.trim()) {
      alert('Mohon isi nama client.');
      return;
    }

    const pkg = safePackages.find((p) => p.id === addPackageId) || safePackages[0] || {
      id: 'bulanan',
      name: 'Akses Bulanan (VIP)',
      price: 149000,
      durationDays: 30
    };

    const days = Number(addDurationDays) || pkg.durationDays || 30;
    const now = new Date();
    const expiry = new Date();
    expiry.setDate(now.getDate() + days);

    const code = addCustomCode.trim().toUpperCase() || generateSecureAccessCode(pkg.id === 'bulanan' ? 'VIP' : pkg.id === 'lifetime' ? 'ULTRA' : 'PRO');

    const newClient: ClientItem = {
      id: `cli_${Date.now()}`,
      accessCode: code,
      name: addName.trim(),
      whatsapp: addWhatsapp.trim() || undefined,
      email: addEmail.trim() || undefined,
      packageId: pkg.id,
      packageName: pkg.name,
      price: pkg.price || 0,
      startDate: now.toISOString(),
      expiryDate: expiry.toISOString(),
      status: calculateClientStatus(expiry.toISOString()),
      type: 'standard',
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
    setShowAddClientModal(false);

    // Reset form
    setAddName('');
    setAddWhatsapp('');
    setAddEmail('');
    setAddCustomCode('');
    setAddDurationDays(30);

    loadData();
    alert(`✅ Klien "${newClient.name}" berhasil ditambahkan!\nKode Akses: ${newClient.accessCode}`);
  };

  const handleToggleSuspend = (client: ClientItem) => {
    const newStatus = client.status === 'suspended' ? calculateClientStatus(client.expiryDate) : 'suspended';
    const actionLabel = client.status === 'suspended' ? 'mengaktifkan kembali' : 'menangguhkan (suspend)';
    if (confirm(`Apakah Anda yakin ingin ${actionLabel} client "${client.name}"?`)) {
      updateClientStatus(client.id, newStatus);
      loadData();
    }
  };

  const handleConfirmExtend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClientForExtend) return;
    extendClientExpiry(selectedClientForExtend.id, Number(extendDaysInput) || 7);
    setSelectedClientForExtend(null);
    loadData();
    alert(`Masa aktif ${selectedClientForExtend.name} berhasil diperpanjang +${extendDaysInput} hari!`);
  };

  const handleConfirmPackageChange = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClientForPackage) return;
    const targetPkg = safePackages.find((p) => p.id === targetPackageId) || safePackages[0];
    if (targetPkg) {
      updateClientPackage(
        selectedClientForPackage.id,
        targetPkg.id,
        targetPkg.name,
        targetPkg.durationDays,
        targetPkg.price
      );
      setSelectedClientForPackage(null);
      loadData();
      alert(`Paket ${selectedClientForPackage.name} berhasil diubah menjadi "${targetPkg.name}"!`);
    }
  };

  const handleConfirmDelete = () => {
    if (!clientToDelete) return;
    deleteClient(clientToDelete.id);
    setClientToDelete(null);
    loadData();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return (
          <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 w-fit">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>Aktif</span>
          </span>
        );
      case 'expiring_soon':
        return (
          <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 w-fit">
            <AlertTriangle className="w-3 h-3 text-amber-500" />
            <span>Akan Expired</span>
          </span>
        );
      case 'expired':
        return (
          <span className="px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 w-fit">
            <XCircle className="w-3 h-3 text-rose-500" />
            <span>Expired</span>
          </span>
        );
      case 'suspended':
        return (
          <span className="px-2.5 py-1 rounded-full bg-slate-800 text-slate-200 border border-slate-700 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 w-fit">
            <ShieldAlert className="w-3 h-3 text-amber-400" />
            <span>Suspended</span>
          </span>
        );
      default:
        return null;
    }
  };

  const columns = [
    {
      header: 'Nama / Kode Akses',
      render: (item: ClientItem) => {
        const activeGen = activeGenerations.find(g => g.accessCode?.toUpperCase() === item.accessCode?.toUpperCase());
        return (
          <div className="space-y-0.5">
            <div className="font-extrabold text-slate-900 text-sm flex items-center gap-1.5 flex-wrap">
              <span>{item.name || 'Tanpa Nama'}</span>
              {item.type === 'custom' && (
                <span className="px-1.5 py-0.2 rounded bg-purple-100 text-purple-700 text-[9px] font-extrabold uppercase">
                  Custom
                </span>
              )}
              {activeGen && (
                <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider flex items-center gap-1 ${
                  activeGen.status === 'generating' || activeGen.status === 'analyzing'
                    ? 'bg-amber-100 text-amber-800 border border-amber-300'
                    : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                }`}>
                  <span className={`w-2 h-2 rounded-full ${
                    activeGen.status === 'generating' || activeGen.status === 'analyzing'
                      ? 'bg-amber-500 animate-ping'
                      : 'bg-emerald-500 animate-pulse'
                  }`} />
                  <span>{activeGen.status === 'generating' ? `Generating (${activeGen.tool})` : `Online (${activeGen.tool})`}</span>
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-xs font-mono text-[#3525cd] font-bold">
              <span className="bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">{maskAccessCode(item.accessCode)}</span>
              <button
                type="button"
                onClick={() => handleCopyCode(item.accessCode)}
                className="p-1 rounded hover:bg-slate-100 text-slate-500 cursor-pointer"
                title="Salin Kode Akses"
              >
                {copiedCode === item.accessCode ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
            {item.whatsapp && <div className="text-[11px] text-slate-500">WA: {item.whatsapp}</div>}
          </div>
        );
      }
    },
    {
      header: 'Paket & Status',
      render: (item: ClientItem) => {
        const rem = formatRemainingTime(item.expiryDate);
        return (
          <div className="space-y-1">
            <div className="font-bold text-slate-800 text-xs">{item.packageName || 'Paket Standar'}</div>
            {getStatusBadge(item.status)}
            <div className="text-[10px] text-slate-500 flex items-center gap-1">
              <Calendar className="w-3 h-3 text-slate-400" />
              <span>Exp: {item.expiryDate ? new Date(item.expiryDate).toLocaleDateString('id-ID') : '-'} ({rem.label})</span>
            </div>
          </div>
        );
      }
    },
    {
      header: 'Login Terakhir',
      render: (item: ClientItem) => (
        <div className="space-y-0.5 text-xs text-slate-600">
          <div className="flex items-center gap-1 font-medium">
            <Clock className="w-3 h-3 text-slate-400" />
            <span>{item.lastLoginAt ? new Date(item.lastLoginAt).toLocaleString('id-ID') : 'Belum Pernah'}</span>
          </div>
          <div className="text-[10px] text-slate-400">Mulai: {new Date(item.startDate || item.createdAt).toLocaleDateString('id-ID')}</div>
        </div>
      )
    },
    {
      header: 'Total Pemakaian Tool',
      render: (item: ClientItem) => {
        const u = item.toolUsage || { tiktokDownloader: 0, contentIdeas: 0, videoToPrompt: 0, photoPrompt: 0, frameExtractor: 0 };
        const total = (u.tiktokDownloader || 0) + (u.contentIdeas || 0) + (u.videoToPrompt || 0) + (u.photoPrompt || 0) + (u.frameExtractor || 0);
        return (
          <div className="space-y-1">
            <div className="font-extrabold text-slate-900 text-xs">{total} Executions</div>
            <div className="text-[10px] text-slate-500 flex gap-2 flex-wrap">
              <span>🎬 {u.videoToPrompt || 0}</span>
              <span>🎵 {u.tiktokDownloader || 0}</span>
              <span>💡 {u.contentIdeas || 0}</span>
              <span>📸 {u.photoPrompt || 0}</span>
            </div>
          </div>
        );
      }
    },
    {
      header: 'Aksi Management',
      render: (item: ClientItem) => (
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => setSelectedClientForExtend(item)}
            title="Perpanjang Masa Aktif"
            className="px-2.5 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-[#3525cd] font-bold text-xs transition-colors flex items-center gap-1 cursor-pointer border border-indigo-100"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+Hari</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedClientForPackage(item)}
            title="Ganti Paket"
            className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors flex items-center gap-1 cursor-pointer border border-slate-200"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Paket</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedClientForHistory(item)}
            title="Detail Riwayat"
            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
          >
            <Eye className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => handleToggleSuspend(item)}
            title={item.status === 'suspended' ? 'Unsuspend Client' : 'Suspend Client'}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              item.status === 'suspended'
                ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                : 'bg-amber-100 text-amber-800 hover:bg-amber-200'
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => setClientToDelete(item)}
            title="Hapus Client"
            className="p-1.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 transition-colors cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6">
      {/* Top Stat Cards Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Total Client Aktif"
          value={`${activeCount} User`}
          subtext="Memiliki akses penuh saat ini"
          badge={{ text: 'Active', type: 'success' }}
          icon={<Users className="w-4 h-4" />}
          iconBgColor="bg-emerald-50 border-emerald-100"
          iconTextColor="text-emerald-600"
        />

        <StatCard
          title="Expired Dalam 7 Hari"
          value={`${expiringSoonCount} User`}
          subtext="Perlu penawaran perpanjangan"
          badge={{ text: 'Follow Up', type: 'warning' }}
          icon={<Clock className="w-4 h-4" />}
          iconBgColor="bg-amber-50 border-amber-100"
          iconTextColor="text-amber-600"
        />

        <StatCard
          title="Total Expired"
          value={`${expiredCount} User`}
          subtext="Akses telah berakhir"
          badge={{ text: 'Inactive', type: 'danger' }}
          icon={<XCircle className="w-4 h-4" />}
          iconBgColor="bg-rose-50 border-rose-100"
          iconTextColor="text-rose-600"
        />
      </div>

      {/* Main Client Table */}
      <DataTable
        title="Daftar & Monitoring Seluruh Client"
        subtitle="Pantau masa aktif, pemakaian tool, ganti paket, dan status suspend client."
        columns={columns}
        data={filteredClients}
        emptyMessage="Tidak ada client yang cocok dengan filter pencarian."
        filterComponent={
          <div className="flex items-center gap-2 flex-wrap">
            {/* Search Input */}
            <div className="relative min-w-[220px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nama / kode / WA..."
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#3525cd]"
              />
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 focus:outline-none focus:border-[#3525cd]"
            >
              <option value="all">Semua Status</option>
              <option value="active">🟢 Aktif</option>
              <option value="expiring_soon">🟡 Akan Expired (≤ 7 Hari)</option>
              <option value="expired">🔴 Expired</option>
              <option value="suspended">⚫ Suspended</option>
            </select>

            {/* Add Client Button */}
            <button
              type="button"
              onClick={() => setShowAddClientModal(true)}
              className="px-3.5 py-2 rounded-xl bg-[#3525cd] hover:bg-[#2c1eb3] text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer ml-auto"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Klien Manual</span>
            </button>
          </div>
        }
      />

      {/* MODAL 1: Extend Days */}
      {selectedClientForExtend && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-extrabold text-slate-900">
                Perpanjang Masa Aktif Client
              </h3>
              <button
                type="button"
                onClick={() => setSelectedClientForExtend(null)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmExtend} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Client: <span className="text-[#3525cd]">{selectedClientForExtend.name}</span>
                </label>
                <p className="text-xs text-slate-500 mb-3">
                  Kode Akses: <code className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">{maskAccessCode(selectedClientForExtend.accessCode)}</code>
                </p>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Tambahkan Durasi (Hari)
                </label>
                <input
                  type="number"
                  min="1"
                  max="3650"
                  value={extendDaysInput}
                  onChange={(e) => setExtendDaysInput(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-900 focus:outline-none focus:border-[#3525cd]"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setSelectedClientForExtend(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#3525cd] hover:bg-[#2c1eb3] text-white text-xs font-bold transition-colors shadow-xs cursor-pointer"
                >
                  Simpan Perpanjangan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Change Package */}
      {selectedClientForPackage && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-extrabold text-slate-900">
                Ubah Paket Akses Client
              </h3>
              <button
                type="button"
                onClick={() => setSelectedClientForPackage(null)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmPackageChange} className="space-y-4">
              <div>
                <p className="text-xs text-slate-600">
                  Mengubah paket untuk <span className="font-bold text-slate-900">{selectedClientForPackage.name}</span> akan mengatur ulang tanggal kadaluarsa sesuai durasi paket baru.
                </p>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Pilih Paket Baru
                </label>
                <select
                  value={targetPackageId}
                  onChange={(e) => setTargetPackageId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:border-[#3525cd]"
                >
                  {safePackages.map((pkg) => (
                    <option key={pkg.id} value={pkg.id}>
                      {pkg.name} — {formatRupiah(pkg.price)} ({pkg.durationDays} Hari)
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setSelectedClientForPackage(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#3525cd] hover:bg-[#2c1eb3] text-white text-xs font-bold transition-colors shadow-xs cursor-pointer"
                >
                  Simpan Perubahan Paket
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Client History Detail */}
      {selectedClientForHistory && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-extrabold text-slate-900">
                Detail Client & Riwayat Pemakaian
              </h3>
              <button
                type="button"
                onClick={() => setSelectedClientForHistory(null)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs text-slate-700">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                <div className="text-sm font-extrabold text-slate-900">{selectedClientForHistory.name}</div>
                <div>Kode Akses: <code className="font-mono text-[#3525cd] font-bold">{maskAccessCode(selectedClientForHistory.accessCode)}</code></div>
                <div>Email: {selectedClientForHistory.email || '-'}</div>
                <div>WhatsApp: {selectedClientForHistory.whatsapp || '-'}</div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-indigo-50/50 border border-indigo-100">
                  <div className="text-[10px] uppercase font-bold text-indigo-600">Paket Aktif</div>
                  <div className="font-bold text-slate-900 mt-0.5">{selectedClientForHistory.packageName}</div>
                </div>

                <div className="p-3 rounded-xl bg-purple-50/50 border border-purple-100">
                  <div className="text-[10px] uppercase font-bold text-purple-600">Kadaluarsa</div>
                  <div className="font-bold text-slate-900 mt-0.5">{new Date(selectedClientForHistory.expiryDate).toLocaleDateString('id-ID')}</div>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 mb-2">Rincian Eksekusi Tool AI:</h4>
                <div className="space-y-1.5">
                  {Object.entries(selectedClientForHistory.toolUsage || {}).map(([key, count]) => (
                    <div key={key} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
                      <span className="capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                      <span className="font-extrabold text-[#3525cd]">{count as number}x</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 mb-2 flex items-center justify-between">
                  <span>Log Riwayat Terisolasi Klien ({selectedClientForHistory.accessCode}):</span>
                  <span className="text-[10px] bg-indigo-50 text-[#3525cd] px-2 py-0.5 rounded-full font-mono">
                    {getHistory(selectedClientForHistory.accessCode).length} Item
                  </span>
                </h4>
                <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                  {getHistory(selectedClientForHistory.accessCode).length === 0 ? (
                    <div className="p-3 text-center text-slate-400 bg-slate-50 rounded-xl border border-slate-100">
                      Belum ada riwayat aktivitas yang tersimpan untuk klien ini.
                    </div>
                  ) : (
                    getHistory(selectedClientForHistory.accessCode).map((histItem) => (
                      <div key={histItem.id} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900 truncate">{histItem.title}</span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {new Date(histItem.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        {histItem.subtitle && (
                          <div className="text-[11px] text-slate-500 truncate">{histItem.subtitle}</div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setSelectedClientForHistory(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-white text-xs font-bold transition-colors cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: Delete Confirmation */}
      {clientToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-rose-600">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="text-base font-extrabold text-slate-900">
                Konfirmasi Hapus Client
              </h3>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Apakah Anda yakin ingin menghapus data client <span className="font-bold text-slate-900">{clientToDelete.name}</span> dengan Kode Akses <code className="font-mono text-rose-600 font-bold">{maskAccessCode(clientToDelete.accessCode)}</code>?
            </p>

            <div className="flex items-center justify-end gap-2 pt-3">
              <button
                type="button"
                onClick={() => setClientToDelete(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-colors shadow-xs cursor-pointer"
              >
                Hapus Permanen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: Add Client Manual */}
      {showAddClientModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-[#3525cd]" />
                <h3 className="text-base font-extrabold text-slate-900">
                  Tambah Klien Baru
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddClientModal(false)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddClientSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Nama Lengkap Klien <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  placeholder="misal: Rina Syafitri"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:border-[#3525cd]"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">WhatsApp (Opsional)</label>
                  <input
                    type="text"
                    value={addWhatsapp}
                    onChange={(e) => setAddWhatsapp(e.target.value)}
                    placeholder="081234567890"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-[#3525cd]"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Email (Opsional)</label>
                  <input
                    type="email"
                    value={addEmail}
                    onChange={(e) => setAddEmail(e.target.value)}
                    placeholder="klien@gmail.com"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-[#3525cd]"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Pilih Paket Akses</label>
                <select
                  value={addPackageId}
                  onChange={(e) => {
                    const selectedId = e.target.value;
                    setAddPackageId(selectedId);
                    const found = safePackages.find((p) => p.id === selectedId);
                    if (found) {
                      setAddDurationDays(found.durationDays);
                    }
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:border-[#3525cd]"
                >
                  {safePackages.map((pkg) => (
                    <option key={pkg.id} value={pkg.id}>
                      {pkg.name} - {formatRupiah(pkg.price)} ({pkg.durationDays} Hari)
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Kode Akses Custom (Opsional)
                  </label>
                  <input
                    type="text"
                    value={addCustomCode}
                    onChange={(e) => setAddCustomCode(e.target.value)}
                    placeholder="Kosongkan utk auto-generate"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono font-bold text-[#3525cd] uppercase focus:outline-none focus:border-[#3525cd]"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Durasi Masa Aktif (Hari)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="36500"
                    value={addDurationDays}
                    onChange={(e) => setAddDurationDays(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:border-[#3525cd]"
                    required
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddClientModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#3525cd] hover:bg-[#2c1eb3] text-white text-xs font-bold transition-colors shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Simpan Klien</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
