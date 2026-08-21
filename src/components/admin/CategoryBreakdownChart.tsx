'use client';

import React from 'react';
import { PieChart, Tag, AlertCircle } from 'lucide-react';
import { ContentCategory } from '../../events/categorize';

export interface CategoryBreakdownData {
  category: ContentCategory;
  label: string;
  count: number;
  percentage: number;
  color: string;
}

interface CategoryBreakdownChartProps {
  data: CategoryBreakdownData[];
  totalExecutions: number;
  isLoading?: boolean;
  error?: string | null;
}

export const CATEGORY_LABELS: Record<ContentCategory, { label: string; color: string }> = {
  fashion_beauty: { label: 'Fashion & Beauty', color: '#ec4899' },
  herbal_kesehatan: { label: 'Herbal & Kesehatan (Manual Review)', color: '#10b981' },
  rumah_tangga: { label: 'Rumah Tangga', color: '#f59e0b' },
  teknologi: { label: 'Teknologi & AI', color: '#6366f1' },
  makanan_minuman: { label: 'Makanan & Minuman', color: '#8b5cf6' },
  umum: { label: 'Umum & Flagged', color: '#64748b' },
};

export default function CategoryBreakdownChart({
  data,
  totalExecutions,
  isLoading = false,
  error = null,
}: CategoryBreakdownChartProps) {
  if (isLoading) {
    return (
      <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-2xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="h-5 w-48 bg-slate-100 animate-pulse rounded-md" />
          <div className="h-4 w-16 bg-slate-100 animate-pulse rounded-md" />
        </div>
        <div className="space-y-3 pt-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-10 bg-slate-50 animate-pulse rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 rounded-2xl bg-white border border-rose-200 bg-rose-50/50 text-rose-800 space-y-2">
        <div className="flex items-center gap-2 font-bold text-sm">
          <AlertCircle className="w-4 h-4 text-rose-600" />
          <span>Gagal memuat statistik kategori</span>
        </div>
        <p className="text-xs text-rose-600">{error}</p>
      </div>
    );
  }

  if (!data || data.length === 0 || totalExecutions === 0) {
    return (
      <div className="p-8 rounded-2xl bg-white border border-slate-200/80 shadow-2xs text-center space-y-3">
        <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
          <PieChart className="w-6 h-6" />
        </div>
        <div>
          <h4 className="text-sm font-bold text-slate-800">Belum Ada Data Eksekusi</h4>
          <p className="text-xs text-slate-500 max-w-xs mx-auto mt-1">
            Data kategori konten akan muncul otomatis setelah user melakukan pembuatan prompt.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-2xs space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100 text-[#5b50e5] flex items-center justify-center">
            <Tag className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Breakdown Kategori Konten</h3>
            <p className="text-[11px] text-slate-500">Agregasi riwayat eksekusi per niche produk</p>
          </div>
        </div>

        <span className="text-xs font-bold text-slate-600 px-2.5 py-1 rounded-full bg-slate-100 border border-slate-200">
          Total: {totalExecutions} Event
        </span>
      </div>

      {/* Visual Bar Distribution */}
      <div className="h-3.5 w-full bg-slate-100 rounded-full overflow-hidden flex p-0.5 gap-0.5">
        {data.map((item) => (
          <div
            key={item.category}
            className="h-full rounded-xs transition-all duration-500 relative group"
            style={{
              width: `${Math.max(4, item.percentage)}%`,
              backgroundColor: item.color,
            }}
            title={`${item.label}: ${item.count} (${item.percentage.toFixed(1)}%)`}
          />
        ))}
      </div>

      {/* Category Details List */}
      <div className="space-y-2.5 pt-1">
        {data.map((item) => (
          <div
            key={item.category}
            className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100 hover:border-slate-200 transition-colors text-xs"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: item.color }}
              />
              <span className="font-semibold text-slate-800 truncate">{item.label}</span>
            </div>

            <div className="flex items-center gap-3 shrink-0 text-slate-600 font-mono">
              <span className="font-bold text-slate-900">{item.count}</span>
              <span className="text-[11px] text-slate-400">({item.percentage.toFixed(1)}%)</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
