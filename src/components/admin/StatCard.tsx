'use client';

import React, { ReactNode } from 'react';

interface StatCardProps {
  title: string;
  value?: string | number | null;
  subtext?: string;
  badge?: {
    text: string;
    type?: 'success' | 'warning' | 'danger' | 'info';
  };
  icon?: ReactNode;
  iconBgColor?: string;
  iconTextColor?: string;
  isLoading?: boolean;
}

export default function StatCard({
  title,
  value,
  subtext,
  badge,
  icon,
  iconBgColor = 'bg-indigo-50 border-indigo-100',
  iconTextColor = 'text-[#3525cd]',
  isLoading = false,
}: StatCardProps) {
  const badgeClasses = {
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    warning: 'bg-amber-50 text-amber-700 border-amber-200',
    danger: 'bg-rose-50 text-rose-700 border-rose-200',
    info: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  };

  const displayValue =
    value === undefined || value === null || (typeof value === 'number' && isNaN(value))
      ? 'Belum ada data'
      : value;

  return (
    <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-2xs space-y-2 hover:border-slate-300 transition-colors">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
          {title}
        </span>
        {icon && (
          <div className={`w-9 h-9 rounded-xl border flex items-center justify-center ${iconBgColor} ${iconTextColor}`}>
            {icon}
          </div>
        )}
      </div>

      <div>
        {isLoading ? (
          <div className="h-8 w-24 bg-slate-100 animate-pulse rounded-lg my-1" />
        ) : (
          <div className={`text-2xl font-black tracking-tight ${typeof displayValue === 'string' && displayValue === 'Belum ada data' ? 'text-slate-400 text-sm font-medium' : 'text-slate-900'}`}>
            {displayValue}
          </div>
        )}
        
        <div className="flex items-center gap-2 mt-1">
          {badge && !isLoading && (
            <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider ${badgeClasses[badge.type || 'info']}`}>
              {badge.text}
            </span>
          )}
          {subtext && !isLoading && (
            <p className="text-[11px] text-slate-500 font-medium truncate">
              {subtext}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

