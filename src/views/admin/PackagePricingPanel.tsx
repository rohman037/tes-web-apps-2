'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Plus, 
  Edit3, 
  Trash2, 
  Check, 
  Sparkles, 
  Eye, 
  ShieldCheck, 
  X, 
  ToggleLeft, 
  ToggleRight, 
  AlertTriangle,
  ArrowRight
} from 'lucide-react';
import DataTable from '../../components/admin/DataTable';
import { 
  getPackages, 
  savePackage, 
  deletePackage, 
  togglePackageActive, 
  PackageItem 
} from '../../lib/admin/packages';
import { formatRupiah } from '../../lib/payment';

export default function PackagePricingPanel() {
  const [packages, setPackages] = useState<PackageItem[]>(() => getPackages());
  const [editingPackage, setEditingPackage] = useState<PackageItem | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [packageToDelete, setPackageToDelete] = useState<PackageItem | null>(null);

  // Form State
  const [formName, setFormName] = useState('');
  const [formTagline, setFormTagline] = useState('');
  const [formPrice, setFormPrice] = useState<number>(49000);
  const [formDurationDays, setFormDurationDays] = useState<number>(30);
  const [formBadgeLabel, setFormBadgeLabel] = useState('');
  const [formIsPopular, setFormIsPopular] = useState(false);
  const [formIsActive, setFormIsActive] = useState(true);
  const [formTargetCategory, setFormTargetCategory] = useState<'public' | 'member'>('public');
  const [formFeatures, setFormFeatures] = useState<string[]>([
    'Akses 5 Tool AI Satset',
    'Generator Prompt Video 8K',
    'Bypass Kuota & Anti Limit'
  ]);
  const [newFeatureInput, setNewFeatureInput] = useState('');

  const loadPackages = useCallback(async () => {
    try {
      const res = await fetch('/api/packages');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setPackages(data);
          try {
            localStorage.setItem('satset_packages_data', JSON.stringify(data));
            localStorage.setItem('satset_packages_db', JSON.stringify(data));
          } catch (e) {}
        }
      }
    } catch (e) {
      console.warn('[PackagePricingPanel] Error fetching /api/packages:', e);
    }
  }, []);

  useEffect(() => {
    window.addEventListener('satset_packages_updated', loadPackages);
    window.addEventListener('storage', loadPackages);
    return () => {
      window.removeEventListener('satset_packages_updated', loadPackages);
      window.removeEventListener('storage', loadPackages);
    };
  }, [loadPackages]);

  const safePackages = Array.isArray(packages) ? packages : [];

  const handleOpenCreate = () => {
    setEditingPackage(null);
    setIsCreatingNew(true);
    setFormName('Paket Baru Pro');
    setFormTagline('Nikmati fitur lengkap tanpa batas.');
    setFormPrice(99000);
    setFormDurationDays(14);
    setFormBadgeLabel('Hot Deal');
    setFormIsPopular(false);
    setFormIsActive(true);
    setFormTargetCategory('public');
    setFormFeatures([
      'Akses 5 Tool AI Satset',
      'Generator Prompt Video 8K',
      'Prioritas Server VVIP'
    ]);
  };

  const handleOpenEdit = (pkg: PackageItem) => {
    setIsCreatingNew(false);
    setEditingPackage(pkg);
    setFormName(pkg.name);
    setFormTagline(pkg.tagline || '');
    setFormPrice(pkg.price);
    setFormDurationDays(pkg.durationDays);
    setFormBadgeLabel(pkg.badgeLabel || '');
    setFormIsPopular(!!pkg.isPopular);
    setFormIsActive(pkg.isActive);
    setFormTargetCategory(pkg.targetCategory || 'public');
    setFormFeatures(Array.isArray(pkg.features) ? [...pkg.features] : []);
  };

  const handleAddFeature = () => {
    if (newFeatureInput.trim()) {
      setFormFeatures([...formFeatures, newFeatureInput.trim()]);
      setNewFeatureInput('');
    }
  };

  const handleRemoveFeature = (index: number) => {
    setFormFeatures(formFeatures.filter((_, idx) => idx !== index));
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      alert('Mohon isi nama paket.');
      return;
    }

    const pkgItem: PackageItem = {
      id: editingPackage ? editingPackage.id : `pkg_${Date.now()}`,
      name: formName.trim(),
      tagline: formTagline.trim(),
      price: Number(formPrice) || 0,
      durationDays: Number(formDurationDays) || 1,
      features: formFeatures,
      badgeLabel: formBadgeLabel.trim(),
      isPopular: formIsPopular,
      isActive: formIsActive,
      targetCategory: formTargetCategory
    };

    savePackage(pkgItem);
    setEditingPackage(null);
    setIsCreatingNew(false);
    loadPackages();
  };

  const handleToggleActive = (pkg: PackageItem) => {
    togglePackageActive(pkg.id);
    loadPackages();
  };

  const handleConfirmDelete = () => {
    if (!packageToDelete) return;
    deletePackage(packageToDelete.id);
    setPackageToDelete(null);
    loadPackages();
  };

  const columns = [
    {
      header: 'Nama Paket & Tagline',
      render: (pkg: PackageItem) => (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-slate-900 text-sm">{pkg.name}</span>
            {pkg.badgeLabel && (
              <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[9px] font-bold uppercase">
                {pkg.badgeLabel}
              </span>
            )}
            {pkg.isPopular && (
              <span className="px-2 py-0.5 rounded-full bg-[#3525cd] text-white text-[9px] font-bold uppercase">
                Populer
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 max-w-sm">{pkg.tagline || 'Tanpa deskripsi'}</p>
        </div>
      )
    },
    {
      header: 'Harga & Durasi',
      render: (pkg: PackageItem) => (
        <div className="space-y-0.5">
          <div className="font-black text-[#3525cd] text-sm">{formatRupiah(pkg.price)}</div>
          <div className="text-xs text-slate-600 font-medium">{pkg.durationDays} Hari Akses</div>
        </div>
      )
    },
    {
      header: 'Jumlah Fitur',
      render: (pkg: PackageItem) => (
        <div className="text-xs font-bold text-slate-700">
          {(pkg.features || []).length} Fitur
        </div>
      )
    },
    {
      header: 'Target Kategori',
      render: (pkg: PackageItem) => (
        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
          pkg.targetCategory === 'member'
            ? 'bg-purple-50 text-purple-700 border-purple-200'
            : 'bg-blue-50 text-blue-700 border-blue-200'
        }`}>
          {pkg.targetCategory === 'member' ? 'Member VIP' : 'Public'}
        </span>
      )
    },
    {
      header: 'Status',
      render: (pkg: PackageItem) => (
        <button
          type="button"
          onClick={() => handleToggleActive(pkg)}
          className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer border transition-colors ${
            pkg.isActive
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
              : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'
          }`}
        >
          {pkg.isActive ? <ToggleRight className="w-4 h-4 text-emerald-600" /> : <ToggleLeft className="w-4 h-4 text-slate-400" />}
          <span>{pkg.isActive ? 'Aktif' : 'Nonaktif'}</span>
        </button>
      )
    },
    {
      header: 'Aksi',
      render: (pkg: PackageItem) => (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleOpenEdit(pkg)}
            className="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-[#3525cd] font-bold text-xs transition-colors flex items-center gap-1 cursor-pointer border border-indigo-100"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Edit</span>
          </button>

          <button
            type="button"
            onClick={() => setPackageToDelete(pkg)}
            className="p-1.5 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-100 transition-colors cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <DataTable
        title="Manajemen Paket & Harga"
        subtitle="Atur daftar paket berlangganan, ubah harga, durasi, dan fitur secara dinamis."
        columns={columns}
        data={safePackages}
        emptyMessage="Belum ada paket tersimpan."
        headerActions={
          <button
            type="button"
            onClick={handleOpenCreate}
            className="px-4 py-2 rounded-xl bg-[#3525cd] hover:bg-[#2c1eb3] text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Paket Baru</span>
          </button>
        }
      />

      {/* EDIT / CREATE FORM MODAL WITH LIVE PREVIEW */}
      {(isCreatingNew || editingPackage) && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-4xl w-full p-6 shadow-2xl space-y-6 border border-slate-100 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-500" />
                <span>{isCreatingNew ? 'Buat Paket Akses Baru' : `Edit Paket "${editingPackage?.name}"`}</span>
              </h3>
              <button
                type="button"
                onClick={() => {
                  setIsCreatingNew(false);
                  setEditingPackage(null);
                }}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Left Column: Form Inputs */}
              <form onSubmit={handleSaveForm} className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Nama Paket</label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="misal: Akses Bulanan VIP"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:border-[#3525cd]"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Tagline / Deskripsi Singkat</label>
                  <input
                    type="text"
                    value={formTagline}
                    onChange={(e) => setFormTagline(e.target.value)}
                    placeholder="misal: Pilihan terbaik kreator konten"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-[#3525cd]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Harga (Rp)</label>
                    <input
                      type="number"
                      min="0"
                      value={formPrice}
                      onChange={(e) => setFormPrice(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:border-[#3525cd]"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Durasi (Hari)</label>
                    <input
                      type="number"
                      min="1"
                      value={formDurationDays}
                      onChange={(e) => setFormDurationDays(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:border-[#3525cd]"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Badge Label</label>
                    <input
                      type="text"
                      value={formBadgeLabel}
                      onChange={(e) => setFormBadgeLabel(e.target.value)}
                      placeholder="misal: Paling Populer / Hemat 50%"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-[#3525cd]"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Target Kategori Paket</label>
                    <select
                      value={formTargetCategory}
                      onChange={(e) => setFormTargetCategory(e.target.value as 'public' | 'member')}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:border-[#3525cd]"
                    >
                      <option value="public">Public (Calon Pembeli)</option>
                      <option value="member">Member (Khusus Pengguna Terdaftar)</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-4 pt-2">
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formIsPopular}
                      onChange={(e) => setFormIsPopular(e.target.checked)}
                      className="rounded text-[#3525cd] focus:ring-0"
                    />
                    <span>Highlight Populer</span>
                  </label>

                  <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formIsActive}
                      onChange={(e) => setFormIsActive(e.target.checked)}
                      className="rounded text-[#3525cd] focus:ring-0"
                    />
                    <span>Status Aktif</span>
                  </label>
                </div>

                {/* Features List */}
                <div className="space-y-2 pt-2">
                  <label className="text-xs font-bold text-slate-700 block">Fitur-fitur Paket:</label>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto p-2 bg-slate-50 border border-slate-200 rounded-xl">
                    {formFeatures.map((feat, idx) => (
                      <div key={idx} className="flex items-center justify-between gap-2 p-1.5 bg-white rounded-lg border border-slate-200 text-xs">
                        <span className="text-slate-800 font-medium">{feat}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveFeature(idx)}
                          className="text-rose-500 hover:text-rose-700 p-0.5"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newFeatureInput}
                      onChange={(e) => setNewFeatureInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddFeature();
                        }
                      }}
                      placeholder="Tambah poin fitur..."
                      className="flex-1 px-3 py-1.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-[#3525cd]"
                    />
                    <button
                      type="button"
                      onClick={handleAddFeature}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 text-white text-xs font-bold cursor-pointer"
                    >
                      + Fitur
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreatingNew(false);
                      setEditingPackage(null);
                    }}
                    className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-[#3525cd] hover:bg-[#2c1eb3] text-white text-xs font-bold shadow-xs cursor-pointer"
                  >
                    Simpan Paket
                  </button>
                </div>
              </form>

              {/* Right Column: Live Card Preview */}
              <div className="space-y-3">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 uppercase tracking-wider">
                  <Eye className="w-4 h-4 text-[#3525cd]" />
                  <span>Preview Card di PaketAksesView</span>
                </div>

                <div className={`p-6 rounded-3xl border-2 transition-all relative space-y-5 bg-white ${
                  formIsPopular ? 'border-[#3525cd] shadow-xl' : 'border-slate-200 shadow-sm'
                }`}>
                  {formBadgeLabel && (
                    <div className="absolute -top-3.5 left-6 px-3 py-1 rounded-full bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-black text-[10px] uppercase tracking-wider shadow-sm">
                      {formBadgeLabel}
                    </div>
                  )}

                  <div className="space-y-1">
                    <h4 className="text-lg font-black text-slate-900">{formName || 'Nama Paket'}</h4>
                    <p className="text-xs text-slate-500 min-h-[32px]">{formTagline || 'Tagline deskripsi paket'}</p>
                  </div>

                  <div className="flex items-baseline gap-1 border-y border-slate-100 py-3">
                    <span className="text-2xl font-black text-[#3525cd]">{formatRupiah(formPrice || 0)}</span>
                    <span className="text-xs text-slate-500 font-bold">/ {formDurationDays} Hari</span>
                  </div>

                  <div className="space-y-2">
                    <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">Termasuk Fitur:</div>
                    <ul className="space-y-2 text-xs text-slate-700">
                      {formFeatures.map((f, i) => (
                        <li key={i} className="flex items-center gap-2">
                          <div className="w-4 h-4 rounded-full bg-indigo-50 text-[#3525cd] flex items-center justify-center text-[10px] shrink-0 font-bold">
                            ✓
                          </div>
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <button
                    type="button"
                    disabled
                    className="w-full py-2.5 rounded-xl bg-[#3525cd] text-white font-bold text-xs flex items-center justify-center gap-2 opacity-90"
                  >
                    <span>Pilih Paket Ini</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {packageToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-rose-600">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="text-base font-extrabold text-slate-900">Konfirmasi Hapus Paket</h3>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Apakah Anda yakin ingin menghapus paket <span className="font-bold text-slate-900">{packageToDelete.name}</span>? Menghapus tidak akan membatalkan client yang sudah berlangganan paket ini sebelumnya.
            </p>

            <div className="flex items-center justify-end gap-2 pt-3">
              <button
                type="button"
                onClick={() => setPackageToDelete(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer"
              >
                Hapus Paket
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
