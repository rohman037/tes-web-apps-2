'use client';

import React, { useState, useEffect, useCallback } from "react";
import { 
  Key, 
  Plus, 
  RefreshCw, 
  ShieldAlert, 
  Check, 
  Copy, 
  Clock, 
  RotateCw, 
  Trash2, 
  Activity, 
  Zap, 
  X,
  ArrowUp,
  ArrowDown,
  Cpu
} from 'lucide-react';
import DataTable from '../../components/admin/DataTable';
import StatCard from '../../components/admin/StatCard';
import { 
  getApiKeys, 
  syncApiKeysWithBackend,
  saveApiKey, 
  revokeApiKey, 
  rotateApiKey, 
  getApiKeyLogs, 
  maskApiKey, 
  ApiKeyItem, 
  ApiKeyUsageLog,
  getModelPriorities,
  saveModelPriorities,
  ModelPriorityConfig,
  addApiKeysBulkAdmin
} from '../../lib/admin/apiKeys';

export default function ApiKeyManagementPanel() {
  const [apiKeys, setApiKeys] = useState<ApiKeyItem[]>(() => getApiKeys());
  const [logs, setLogs] = useState<ApiKeyUsageLog[]>(() => getApiKeyLogs());
  const [priorities, setPriorities] = useState<ModelPriorityConfig>(() => getModelPriorities());
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);

  // New model state
  const [newModelCategory, setNewModelCategory] = useState<'text' | 'image' | 'video'>('text');
  const [newModelName, setNewModelName] = useState('');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [addMode, setAddMode] = useState<'single' | 'bulk'>('single');
  const [newKeyInput, setNewKeyInput] = useState('');
  const [bulkText, setBulkText] = useState('');
  const [newAliasInput, setNewAliasInput] = useState('Gemini Engine Satset');
  const [newDailyLimitInput, setNewDailyLimitInput] = useState<number>(1000);

  const [keyToRotate, setKeyToRotate] = useState<ApiKeyItem | null>(null);
  const [rotateNewKeyInput, setRotateNewKeyInput] = useState('');

  const loadData = useCallback(() => {
    setApiKeys(getApiKeys());
    setLogs(getApiKeyLogs());
  }, []);

  const loadPriorities = useCallback(() => {
    setPriorities(getModelPriorities());
  }, []);

  useEffect(() => {
    syncApiKeysWithBackend().then(() => loadData());
    window.addEventListener('satset_apikeys_updated', loadData);
    window.addEventListener('api-keys-updated', loadData);
    window.addEventListener('satset_model_priorities_updated', loadPriorities);
    window.addEventListener('storage', loadData);
    return () => {
      window.removeEventListener('satset_apikeys_updated', loadData);
      window.removeEventListener('api-keys-updated', loadData);
      window.removeEventListener('satset_model_priorities_updated', loadPriorities);
      window.removeEventListener('storage', loadData);
    };
  }, [loadData, loadPriorities]);

  const handleMoveModel = (category: 'text' | 'image' | 'video', index: number, direction: 'up' | 'down') => {
    const list = [...priorities[category]];
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= list.length) return;

    const temp = list[index];
    list[index] = list[targetIdx];
    list[targetIdx] = temp;

    const updated = { ...priorities, [category]: list };
    setPriorities(updated);
    saveModelPriorities(updated);
  };

  const handleRemoveModel = (category: 'text' | 'image' | 'video', index: number) => {
    const list = [...priorities[category]];
    if (list.length <= 1) {
      alert('Kategori harus memiliki minimal 1 model prioritas.');
      return;
    }
    list.splice(index, 1);
    const updated = { ...priorities, [category]: list };
    setPriorities(updated);
    saveModelPriorities(updated);
  };

  const handleAddModel = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newModelName.trim()) return;
    const model = newModelName.trim().toLowerCase();
    const list = priorities[newModelCategory];
    if (list.includes(model)) {
      alert('Model ini sudah ada dalam daftar prioritas.');
      return;
    }

    const updated = { ...priorities, [newModelCategory]: [...list, model] };
    setPriorities(updated);
    saveModelPriorities(updated);
    setNewModelName('');
  };

  const safeKeys = Array.isArray(apiKeys) ? apiKeys : [];
  const safeLogs = Array.isArray(logs) ? logs : [];

  const activeKeysCount = safeKeys.filter((k) => k.status === 'active').length;

  const handleCopyKey = (id: string, keyStr: string) => {
    navigator.clipboard.writeText(keyStr);
    setCopiedKeyId(id);
    setTimeout(() => setCopiedKeyId(null), 2000);
  };

  const handleAddKey = (e: React.FormEvent) => {
    e.preventDefault();

    if (addMode === 'bulk') {
      if (!bulkText.trim()) {
        alert('Mohon masukkan minimal 1 baris API Key.');
        return;
      }

      const result = addApiKeysBulkAdmin(bulkText, Number(newDailyLimitInput) || 1000);
      let msg = `Berhasil menambahkan ${result.addedCount} API Key baru!`;
      if (result.skippedDuplicatesCount > 0) {
        msg += ` (${result.skippedDuplicatesCount} key duplikat di-skip)`;
      }
      if (result.invalidLinesCount > 0) {
        msg += ` (${result.invalidLinesCount} baris tidak valid di-skip)`;
      }

      alert(msg);
      setShowAddModal(false);
      setBulkText('');
      loadData();
      return;
    }

    // Single Key Mode
    const trimmedKey = newKeyInput.trim();
    if (!trimmedKey) {
      alert('Mohon masukkan string API Key.');
      return;
    }

    // Format validation
    if (!trimmedKey.startsWith('AIza') && trimmedKey.length < 20) {
      alert('Format API Key Gemini tidak valid (harus diawali AIza... atau minimal 20 karakter).');
      return;
    }

    // Duplicate check
    const existingKeys = getApiKeys();
    if (existingKeys.some((k) => k.key.trim() === trimmedKey)) {
      alert('API Key ini sudah terdaftar sebelumnya.');
      return;
    }

    const item: ApiKeyItem = {
      id: `key_${Date.now()}`,
      key: trimmedKey,
      alias: newAliasInput.trim() || 'Gemini Key',
      dailyLimit: Number(newDailyLimitInput) || 1000,
      dailyUsage: 0,
      monthlyLimit: (Number(newDailyLimitInput) || 1000) * 30,
      monthlyUsage: 0,
      status: 'active',
      createdAt: new Date().toISOString()
    };

    saveApiKey(item);
    setShowAddModal(false);
    setNewKeyInput('');
    loadData();
  };

  const handleRevokeKey = (id: string) => {
    if (confirm('Apakah Anda yakin ingin menrevokasi (menonaktifkan) API Key ini? Key yang direvokasi tidak bisa digunakan kembali.')) {
      revokeApiKey(id);
      loadData();
    }
  };

  const handleConfirmRotate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyToRotate || !rotateNewKeyInput.trim()) return;

    rotateApiKey(keyToRotate.id, rotateNewKeyInput.trim(), `${keyToRotate.alias || 'Key'} (Rotated)`);
    setKeyToRotate(null);
    setRotateNewKeyInput('');
    loadData();
    alert('API Key berhasil dirotasi! Key lama telah direvokasi dan key baru telah diaktifkan.');
  };

  const keyColumns = [
    {
      header: 'Alias & API Key',
      render: (item: ApiKeyItem) => (
        <div className="space-y-1">
          <div className="font-extrabold text-slate-900 text-xs">{item.alias || 'Gemini Key'}</div>
          <div className="flex items-center gap-1.5 font-mono text-xs text-slate-600 bg-slate-50 px-2 py-0.5 rounded border border-slate-200 w-fit">
            <span>{maskApiKey(item.key)}</span>
            <button
              type="button"
              onClick={() => handleCopyKey(item.id, item.key)}
              className="p-1 text-slate-400 hover:text-slate-600 transition-colors"
            >
              {copiedKeyId === item.id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      )
    },
    {
      header: 'Pemakaian Harian',
      render: (item: ApiKeyItem) => {
        const pct = Math.min(100, Math.round((item.dailyUsage / (item.dailyLimit || 1000)) * 100));
        return (
          <div className="space-y-1 min-w-[140px]">
            <div className="flex justify-between text-[11px] font-bold">
              <span>{item.dailyUsage} / {item.dailyLimit} req</span>
              <span>{pct}%</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
              <div
                className={`h-1.5 rounded-full ${pct > 80 ? 'bg-rose-500' : 'bg-emerald-500'}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      }
    },
    {
      header: 'Status',
      render: (item: ApiKeyItem) => (
        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
          item.status === 'active'
            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            : 'bg-rose-50 text-rose-700 border border-rose-200'
        }`}>
          {item.status}
        </span>
      )
    },
    {
      header: 'Aksi',
      render: (item: ApiKeyItem) => (
        <div className="flex items-center gap-1.5">
          {item.status === 'active' && (
            <>
              <button
                type="button"
                onClick={() => setKeyToRotate(item)}
                className="px-2.5 py-1 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-[#3525cd] font-bold text-xs transition-colors flex items-center gap-1 border border-indigo-100 cursor-pointer"
              >
                <RotateCw className="w-3.5 h-3.5" />
                <span>Rotate</span>
              </button>

              <button
                type="button"
                onClick={() => handleRevokeKey(item.id)}
                className="p-1.5 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-100 transition-colors cursor-pointer"
                title="Revoke Key"
              >
                <ShieldAlert className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      )
    }
  ];

  const logColumns = [
    {
      header: 'Waktu',
      render: (log: ApiKeyUsageLog) => (
        <div className="text-[11px] text-slate-500 font-mono">
          {new Date(log.timestamp).toLocaleTimeString('id-ID')}
        </div>
      )
    },
    {
      header: 'Endpoint Called',
      accessor: 'endpoint' as keyof ApiKeyUsageLog
    },
    {
      header: 'Key Masked',
      render: (log: ApiKeyUsageLog) => (
        <code className="text-[10px] font-mono text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
          {log.keyMasked}
        </code>
      )
    },
    {
      header: 'Status',
      render: (log: ApiKeyUsageLog) => (
        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
          log.status === 'success' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
        }`}>
          {log.status}
        </span>
      )
    }
  ];

  return (
    <div className="space-y-6">
      {/* Top Stat Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Active Gemini API Keys"
          value={`${activeKeysCount} Key`}
          subtext="Siap digunakan oleh AI engine"
          badge={{ text: 'Rotasi Aktif', type: 'success' }}
          icon={<Key className="w-4 h-4" />}
          iconBgColor="bg-indigo-50 border-indigo-100"
          iconTextColor="text-[#3525cd]"
        />

        <StatCard
          title="Total Request Hari Ini"
          value="180 Calls"
          subtext="Beban penggunaan rata-rata normal"
          badge={{ text: 'Lancar', type: 'info' }}
          icon={<Activity className="w-4 h-4" />}
          iconBgColor="bg-purple-50 border-purple-100"
          iconTextColor="text-purple-600"
        />

        <StatCard
          title="Revoked / Deprecated Keys"
          value={`${safeKeys.filter((k) => k.status === 'revoked').length} Key`}
          subtext="Tidak dapat menerima request"
          badge={{ text: 'Revoked', type: 'danger' }}
          icon={<ShieldAlert className="w-4 h-4" />}
          iconBgColor="bg-rose-50 border-rose-100"
          iconTextColor="text-rose-600"
        />
      </div>

      {/* Main Keys Table */}
      <DataTable
        title="Daftar & Kuota API Key Gemini AI"
        subtitle="Kelola API Key, pantau limit kuota request harian/bulanan, dan lakukan rotasi key."
        columns={keyColumns}
        data={safeKeys}
        emptyMessage="Belum ada API Key tersimpan."
        headerActions={
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 rounded-xl bg-[#3525cd] hover:bg-[#2c1eb3] text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah API Key Baru</span>
          </button>
        }
      />

      {/* Usage Logs Table */}
      <DataTable
        title="Log 20 Pemakaian API Key Terakhir"
        subtitle="Riwayat pemanggilan endpoint API secara realtime."
        columns={logColumns}
        data={safeLogs.slice(0, 20)}
        emptyMessage="Belum ada log pemanggilan API."
      />

      {/* Model Priority Routing Panel (G2) */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Cpu className="w-5 h-5 text-[#3525cd]" />
              <h3 className="text-base font-extrabold text-slate-900">
                Model Priority Routing (Cascading Fallback)
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Urutan eksekusi AI engine per kategori. Jika model peringkat teratas terkena rate limit (429), sistem akan otomatis berpindah ke model berikutnya secara transparan.
            </p>
          </div>

          <form onSubmit={handleAddModel} className="flex items-center gap-2">
            <select
              value={newModelCategory}
              onChange={(e) => setNewModelCategory(e.target.value as any)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 focus:outline-none focus:border-[#3525cd] bg-slate-50"
            >
              <option value="text">Text Model</option>
              <option value="image">Image Model</option>
              <option value="video">Video Model</option>
            </select>

            <input
              type="text"
              placeholder="Nama model baru..."
              value={newModelName}
              onChange={(e) => setNewModelName(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-[#3525cd]"
            />

            <button
              type="submit"
              className="px-3 py-1.5 rounded-xl bg-[#3525cd] hover:bg-[#2c1eb3] text-white text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tambah</span>
            </button>
          </form>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {(['text', 'image', 'video'] as const).map((category) => {
            const labelMap = {
              text: 'Text Models (Ide Konten, Script, Prompt)',
              image: 'Image Models (Prompt Foto, Image AI)',
              video: 'Video Models (Video Splitter, Veo)'
            };
            const badgeBg = {
              text: 'bg-indigo-50 border-indigo-200 text-indigo-700',
              image: 'bg-emerald-50 border-emerald-200 text-emerald-700',
              video: 'bg-purple-50 border-purple-200 text-purple-700'
            };

            const modelList = priorities[category] || [];

            return (
              <div key={category} className="bg-slate-50/60 rounded-xl p-4 border border-slate-200/80 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5">
                    <span className={`px-2 py-0.5 rounded-md text-[10px] uppercase font-bold border ${badgeBg[category]}`}>
                      {category}
                    </span>
                    <span className="truncate">{labelMap[category]}</span>
                  </h4>
                  <span className="text-[10px] text-slate-400 font-bold">{modelList.length} Model</span>
                </div>

                <div className="space-y-1.5">
                  {modelList.map((model, idx) => (
                    <div
                      key={`${model}-${idx}`}
                      className="bg-white px-3 py-2 rounded-xl border border-slate-200 flex items-center justify-between text-xs font-mono text-slate-800 shadow-2xs group"
                    >
                      <div className="flex items-center gap-2">
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                          idx === 0 ? 'bg-[#3525cd] text-white' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {idx + 1}
                        </span>
                        <span className="font-semibold text-slate-900">{model}</span>
                        {idx === 0 && (
                          <span className="text-[9px] bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.2 rounded font-sans font-bold">
                            Utama
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => handleMoveModel(category, idx, 'up')}
                          className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer"
                          title="Naikkan prioritas"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === modelList.length - 1}
                          onClick={() => handleMoveModel(category, idx, 'down')}
                          className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer"
                          title="Turunkan prioritas"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveModel(category, idx)}
                          className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                          title="Hapus dari rantai"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ADD KEY MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-extrabold text-slate-900">
                Tambah API Key Gemini Baru
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mode Switcher Tabs */}
            <div className="flex rounded-xl bg-slate-100 p-1 text-xs font-bold">
              <button
                type="button"
                onClick={() => setAddMode('single')}
                className={`flex-1 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  addMode === 'single'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Input Satu per Satu
              </button>
              <button
                type="button"
                onClick={() => setAddMode('bulk')}
                className={`flex-1 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  addMode === 'bulk'
                    ? 'bg-[#3525cd] text-white shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Tambah Massal (Multi-Baris)
              </button>
            </div>

            <form onSubmit={handleAddKey} className="space-y-4">
              {addMode === 'single' ? (
                <>
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">API Key (String Key Gemini)</label>
                    <input
                      type="text"
                      value={newKeyInput}
                      onChange={(e) => setNewKeyInput(e.target.value)}
                      placeholder="AIzaSy..."
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono text-slate-900 focus:outline-none focus:border-[#3525cd]"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Alias / Catatan</label>
                    <input
                      type="text"
                      value={newAliasInput}
                      onChange={(e) => setNewAliasInput(e.target.value)}
                      placeholder="misal: Gemini Key #3"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-[#3525cd]"
                    />
                  </div>
                </>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700 block">
                      Daftar API Key (1 Key per Baris)
                    </label>
                    <span className="text-[10px] text-slate-500 font-medium">Auto-alias #1, #2...</span>
                  </div>
                  <textarea
                    rows={6}
                    value={bulkText}
                    onChange={(e) => setBulkText(e.target.value)}
                    placeholder={`Paste banyak API Key Gemini di sini (satu key per baris):\n\nAIzaSyA123...\nAIzaSyB456...\nAIzaSyC789...`}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-mono text-slate-900 focus:outline-none focus:border-[#3525cd] resize-y"
                    required
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Sistem otomatis mem-parse tiap baris, men-check duplikasi, dan mengenerate alias otomatis.
                  </p>
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Limit Request Harian per Key</label>
                <input
                  type="number"
                  min="100"
                  max="100000"
                  value={newDailyLimitInput}
                  onChange={(e) => setNewDailyLimitInput(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:border-[#3525cd]"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#3525cd] hover:bg-[#2c1eb3] text-white text-xs font-bold shadow-xs cursor-pointer"
                >
                  {addMode === 'bulk' ? 'Simpan Semua Key' : 'Simpan Key'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ROTATE KEY MODAL */}
      {keyToRotate && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-extrabold text-slate-900">
                Rotasi API Key
              </h3>
              <button
                type="button"
                onClick={() => setKeyToRotate(null)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmRotate} className="space-y-4">
              <p className="text-xs text-slate-600">
                Memutar key <span className="font-bold text-slate-900">{keyToRotate.alias}</span> akan menonaktifkan key lama ini dan menggantikannya dengan key string baru.
              </p>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">API Key Baru</label>
                <input
                  type="text"
                  value={rotateNewKeyInput}
                  onChange={(e) => setRotateNewKeyInput(e.target.value)}
                  placeholder="AIzaSy..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono text-slate-900 focus:outline-none focus:border-[#3525cd]"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setKeyToRotate(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#3525cd] hover:bg-[#2c1eb3] text-white text-xs font-bold cursor-pointer"
                >
                  Proses Rotasi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
