'use client';

import React, { useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  Edit3,
  ExternalLink,
  ShieldAlert,
  Brain,
  Sparkles,
  User,
  Check,
} from 'lucide-react';
import { SafeLearningItem } from '../../agents/safeLearningQueue';

interface SafeLearningReviewCardProps {
  item: SafeLearningItem;
  onApprove: (id: string, editedDesc?: string) => void;
  onReject: (id: string) => void;
  onViewSourceEvents?: (sourceEventIds: string[]) => void;
}

export default function SafeLearningReviewCard({
  item,
  onApprove,
  onReject,
  onViewSourceEvents,
}: SafeLearningReviewCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedDesc, setEditedDesc] = useState(item.editedDescription || item.description);

  const isHerbal = item.category === 'herbal_kesehatan' || item.requiresManualReviewOnly;

  const handleApprove = () => {
    onApprove(item.id, isEditing ? editedDesc : undefined);
    setIsEditing(false);
  };

  return (
    <div className={`p-5 rounded-2xl bg-white border shadow-2xs space-y-4 transition-all ${
      isHerbal ? 'border-amber-200 bg-amber-50/20' : 'border-slate-200/80 hover:border-slate-300'
    }`}>
      {/* Top Badge & Metadata */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-50 text-[#5b50e5] border border-indigo-100">
            {item.patternCategory.toUpperCase()}
          </span>

          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
            isHerbal
              ? 'bg-amber-100 text-amber-900 border-amber-300'
              : 'bg-emerald-50 text-emerald-800 border-emerald-200'
          }`}>
            {item.category.replace('_', ' ').toUpperCase()}
          </span>

          {isHerbal && (
            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-100 text-rose-900 border border-rose-300 flex items-center gap-1">
              <ShieldAlert className="w-3 h-3 text-rose-600" /> Wajib Review Manual
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
            Score: {item.confidence}%
          </span>
        </div>
      </div>

      {/* Main Content */}
      <div className="space-y-2">
        <h4 className="text-base font-bold text-slate-900 leading-snug flex items-center gap-2">
          <Brain className="w-4 h-4 text-[#5b50e5] shrink-0" />
          <span>{item.patternName}</span>
        </h4>

        {isEditing ? (
          <div className="space-y-2 pt-1">
            <textarea
              value={editedDesc}
              onChange={(e) => setEditedDesc(e.target.value)}
              rows={3}
              className="w-full p-3 text-xs rounded-xl bg-slate-50 border border-indigo-300 focus:outline-none focus:ring-2 focus:ring-[#5b50e5]/20 font-medium text-slate-900"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-3 py-1 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleApprove}
                className="px-3 py-1 rounded-lg text-xs font-bold bg-[#5b50e5] text-white hover:bg-[#4b40d5]"
              >
                Simpan & Setujui
              </button>
            </div>
          </div>
        ) : (
          <p className="text-xs text-slate-600 leading-relaxed font-normal">
            {item.editedDescription || item.description}
          </p>
        )}
      </div>

      {/* Source Event & Agent Attribution */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-[11px] text-slate-500 border-t border-slate-100">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="flex items-center gap-1 font-medium text-slate-700">
            <User className="w-3.5 h-3.5 text-slate-400" />
            {item.clientName || item.clientId || 'Klien Satset'}
          </span>
          <span className="text-slate-400">• Agent: {item.extractedByAgentId}</span>
        </div>

        {item.sourceEventIds && item.sourceEventIds.length > 0 && (
          <button
            type="button"
            onClick={() => onViewSourceEvents?.(item.sourceEventIds)}
            className="text-[#5b50e5] hover:text-[#4b40d5] font-bold flex items-center gap-1 hover:underline cursor-pointer"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Lihat Event Sumber ({item.sourceEventIds.length})</span>
          </button>
        )}
      </div>

      {/* Action Buttons */}
      {item.status === 'pending' && !isEditing && (
        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Edit3 className="w-3.5 h-3.5 text-slate-500" />
            <span>Edit</span>
          </button>

          <button
            type="button"
            onClick={() => onReject(item.id)}
            className="px-3.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <XCircle className="w-3.5 h-3.5 text-rose-600" />
            <span>Tolak</span>
          </button>

          <button
            type="button"
            onClick={handleApprove}
            className="px-4 py-1.5 rounded-xl bg-[#5b50e5] hover:bg-[#4b40d5] text-white text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Setujui Pola</span>
          </button>
        </div>
      )}

      {item.status === 'approved' && (
        <div className="pt-1 flex items-center justify-end">
          <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-xl flex items-center gap-1">
            <Check className="w-3.5 h-3.5" /> Disetujui & Masuk Memori System
          </span>
        </div>
      )}

      {item.status === 'rejected' && (
        <div className="pt-1 flex items-center justify-end">
          <span className="text-xs font-bold text-slate-500 bg-slate-100 border border-slate-200 px-3 py-1 rounded-xl">
            Ditolak
          </span>
        </div>
      )}
    </div>
  );
}
