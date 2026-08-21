'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Share2, Plus, Trash2, DollarSign, Users, Award, CheckCircle2, Copy } from 'lucide-react';

export interface AffiliateItem {
  id: string;
  name: string;
  code: string;
  commissionRate: number;
  totalReferred: number;
  totalEarnings: number;
  unpaidEarnings: number;
  status: 'active' | 'suspended';
  createdAt: string;
}

const DEFAULT_AFFILIATES: AffiliateItem[] = [
  {
    id: 'aff_01',
    name: 'Budi Creator Agency',
    code: 'BUDIAGENCY',
    commissionRate: 20,
    totalReferred: 18,
    totalEarnings: 880000,
    unpaidEarnings: 240000,
    status: 'active',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'aff_02',
    name: 'Siti Affiliate TikTok',
    code: 'SITITIKTOK',
    commissionRate: 15,
    totalReferred: 9,
    totalEarnings: 350000,
    unpaidEarnings: 150000,
    status: 'active',
    createdAt: new Date().toISOString(),
  }
];

export default function AffiliateReferralPanel() {
  const [affiliates, setAffiliates] = useState<AffiliateItem[]>(() => DEFAULT_AFFILIATES);
  const [loading, setLoading] = useState<boolean>(false);
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    code: '',
    commissionRate: 20,
  });

  const loadAffiliates = useCallback(async () => {
    try {
      const res = await fetch('/api/affiliates');
      if (res.ok) {
        const data = await res.json();
        setAffiliates(Array.isArray(data) && data.length > 0 ? data : DEFAULT_AFFILIATES);
      }
    } catch (e) {
      // Keep default
    }
  }, []);

  useEffect(() => {
    const handleUpdated = () => {
      loadAffiliates();
    };
    window.addEventListener('satset_affiliates_updated', handleUpdated);
    return () => {
      window.removeEventListener('satset_affiliates_updated', handleUpdated);
    };
  }, [loadAffiliates]);

  const handleCreateAffiliate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.code.trim()) return;

    const newItem: AffiliateItem = {
      id: 'aff_' + Date.now(),
      name: formData.name.trim(),
      code: formData.code.trim().toUpperCase(),
      commissionRate: Number(formData.commissionRate) || 20,
      totalReferred: 0,
      totalEarnings: 0,
      unpaidEarnings: 0,
      status: 'active',
      createdAt: new Date().toISOString(),
    };

    try {
      const res = await fetch('/api/affiliates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newItem),
      });

      if (res.ok) {
        setToastMessage('Mitra Afiliasi baru berhasil didaftarkan!');
        setShowAddModal(false);
        setFormData({ name: '', code: '', commissionRate: 20 });
        loadAffiliates();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setTimeout(() => setToastMessage(null), 3000);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus mitra afiliasi ini?')) return;
    try {
      const res = await fetch(`/api/affiliates/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setToastMessage('Mitra Afiliasi dihapus');
        loadAffiliates();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setTimeout(() => setToastMessage(null), 3000);
    }
  };

  const copyRefCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  return (
    <div className="space-y-6">
      {toastMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 rounded-2xl text-white shadow-lg border border-indigo-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Share2 className="w-6 h-6 text-amber-300" />
            <h2 className="text-xl font-black tracking-tight">Sistem Afiliasi & Kode Referral</h2>
          </div>
          <p className="text-xs text-slate-300">
            Kelola mitra afiliasi, komisi komisi rujukan, dan penarikan saldo komisi kreator secara otomatis.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2.5 rounded-xl bg-[#3525cd] hover:bg-indigo-600 text-white font-bold text-xs shadow-md transition-all flex items-center gap-2 shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Daftarkan Mitra Baru</span>
        </button>
      </div>

      {/* Affiliates List */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-4">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <Users className="w-4 h-4 text-[#3525cd]" />
          Daftar Mitra Afiliasi ({affiliates.length})
        </h3>

        {loading ? (
          <div className="py-12 text-center text-xs text-slate-400 font-semibold animate-pulse">
            Memuat data afiliasi...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                <tr>
                  <th className="p-3">Nama Mitra</th>
                  <th className="p-3">Kode Referral</th>
                  <th className="p-3">Komisi (%)</th>
                  <th className="p-3">Total Referral</th>
                  <th className="p-3">Total Komisi</th>
                  <th className="p-3">Saldo Komisi</th>
                  <th className="p-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                {affiliates.map((aff) => (
                  <tr key={aff.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3 font-bold text-slate-900">{aff.name}</td>
                    <td className="p-3 font-mono font-bold text-[#3525cd] flex items-center gap-1.5">
                      <span>{aff.code}</span>
                      <button
                        type="button"
                        onClick={() => copyRefCode(aff.code)}
                        className="text-slate-400 hover:text-indigo-600 cursor-pointer"
                      >
                        {copiedCode === aff.code ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </td>
                    <td className="p-3 font-bold text-amber-600">{aff.commissionRate}%</td>
                    <td className="p-3 font-bold text-slate-700">{aff.totalReferred} User</td>
                    <td className="p-3 font-bold text-slate-900">Rp {aff.totalEarnings.toLocaleString('id-ID')}</td>
                    <td className="p-3 font-bold text-emerald-600">Rp {aff.unpaidEarnings.toLocaleString('id-ID')}</td>
                    <td className="p-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleDelete(aff.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all cursor-pointer"
                        title="Hapus Affiliate"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Award className="w-5 h-5 text-[#3525cd]" />
                <h3 className="text-base font-extrabold text-slate-900">Daftarkan Mitra Afiliasi</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateAffiliate} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Nama Mitra / Kreator</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Budi Studio Creator"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-[#3525cd] outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Kode Referral (Unik)</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: BUDICREATOR"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs font-mono font-bold uppercase focus:ring-2 focus:ring-[#3525cd] outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Persentase Komisi (%)</label>
                <input
                  type="number"
                  required
                  min={1}
                  max={50}
                  value={formData.commissionRate}
                  onChange={(e) => setFormData({ ...formData, commissionRate: Number(e.target.value) })}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs font-bold focus:ring-2 focus:ring-[#3525cd] outline-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-slate-600 font-bold text-xs hover:bg-slate-200 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#3525cd] text-white font-bold text-xs hover:bg-indigo-600 transition-all shadow-md cursor-pointer"
                >
                  Simpan Mitra
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
