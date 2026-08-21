'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Activity, Server, Zap, AlertCircle, RefreshCw, Database } from 'lucide-react';
import { getApiKeys } from '../../lib/admin/apiKeys';

export default function SystemHealthWidget() {
  const [latency, setLatency] = useState<number>(0.3);
  const [activeKeysCount, setActiveKeysCount] = useState<number>(() => {
    try {
      const keys = getApiKeys();
      return keys.filter(k => k.status === 'active').length;
    } catch (e) {
      return 0;
    }
  });
  const [storageUsed, setStorageUsed] = useState<string>('2.4 MB');
  const [statusText, setStatusText] = useState<string>('Operational');
  const [isHealthy, setIsHealthy] = useState<boolean>(true);
  const [dbStatus, setDbStatus] = useState<{ ok: boolean; statusText: string; detail?: string }>({
    ok: true,
    statusText: 'Checking DB...',
  });

  const checkHealth = useCallback(async () => {
    const startTime = performance.now();
    try {
      const res = await fetch('/api/health');
      const endTime = performance.now();
      const measuredLatency = ((endTime - startTime) / 1000).toFixed(2);
      setLatency(Number(measuredLatency));

      if (res.ok) {
        const data = await res.json();
        setIsHealthy(true);
        setStatusText(data.status === 'ok' ? '100% Operational' : 'Degraded');
      } else {
        setIsHealthy(false);
        setStatusText('API Warning');
      }
    } catch (e) {
      setIsHealthy(false);
      setStatusText('Offline / Error');
    }

    // Check Firestore Health
    try {
      const dbRes = await fetch('/api/health/firestore');
      const dbData = await dbRes.json();
      if (dbRes.ok && dbData.ok) {
        setDbStatus({ ok: true, statusText: 'Firestore Connected (OK)' });
      } else {
        const errorMsg = dbData.status === 'QUOTA_EXCEEDED'
          ? 'Quota Exceeded (Memory Cache Active)'
          : dbData.status === 'PERMISSION_DENIED'
          ? 'Permission Denied (IAM Role Missing)'
          : `DB Status: ${dbData.status || 'Fallback Active'}`;
        setDbStatus({ ok: false, statusText: errorMsg, detail: dbData.message });
      }
    } catch (dbErr) {
      setDbStatus({ ok: false, statusText: 'Firestore Unreachable' });
    }

    const keys = getApiKeys();
    const active = keys.filter(k => k.status === 'active').length;
    setActiveKeysCount(active);

    // Calculate approximate local storage size
    let totalBytes = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k) {
        totalBytes += (localStorage.getItem(k) || '').length * 2;
      }
    }
    const kb = (totalBytes / 1024).toFixed(1);
    setStorageUsed(`${kb} KB`);
  }, []);

  useEffect(() => {
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, [checkHealth]);

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <Activity className={`w-5 h-5 ${isHealthy && dbStatus.ok ? 'text-emerald-500 animate-pulse' : 'text-rose-500'}`} />
          <h3 className="text-sm font-extrabold text-slate-900">System Health & Database Node</h3>
        </div>
        <button
          type="button"
          onClick={checkHealth}
          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
          title="Refresh Status"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
          <div className="text-[10px] font-bold uppercase text-slate-400 flex items-center gap-1">
            <Server className="w-3 h-3 text-emerald-500" />
            <span>AI Gateway Status</span>
          </div>
          <div className={`text-xs font-extrabold flex items-center gap-1.5 ${isHealthy ? 'text-emerald-600' : 'text-rose-600'}`}>
            <span className={`w-2 h-2 rounded-full ${isHealthy ? 'bg-emerald-500 animate-ping' : 'bg-rose-500'}`} />
            <span>{statusText}</span>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
          <div className="text-[10px] font-bold uppercase text-slate-400 flex items-center gap-1">
            <Database className="w-3 h-3 text-indigo-500" />
            <span>Firestore Node</span>
          </div>
          <div className={`text-xs font-extrabold flex items-center gap-1.5 ${dbStatus.ok ? 'text-emerald-600' : 'text-rose-600'}`}>
            <span className={`w-2 h-2 rounded-full ${dbStatus.ok ? 'bg-emerald-500' : 'bg-rose-500'}`} />
            <span className="truncate" title={dbStatus.detail}>{dbStatus.statusText}</span>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
          <div className="text-[10px] font-bold uppercase text-slate-400 flex items-center gap-1">
            <Zap className="w-3 h-3 text-amber-500" />
            <span>Ping / Latency</span>
          </div>
          <div className="text-xs font-extrabold text-slate-800">
            {latency}s <span className="text-[10px] font-normal text-slate-400">(Live Node)</span>
          </div>
        </div>
      </div>

      {!dbStatus.ok && (
        <div className="p-3 bg-rose-50 border border-rose-200/80 rounded-xl flex items-start gap-2.5 text-rose-800 text-xs">
          <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-extrabold">Firestore Authorization Warning</p>
            <p className="text-[11px] leading-relaxed text-rose-700">
              {dbStatus.detail || 'The Cloud Run runtime service account lacks IAM permissions (roles/datastore.user or roles/firebase.admin) on GCP.'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
