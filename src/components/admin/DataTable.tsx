'use client';

import React, { ReactNode } from 'react';

interface Column<T> {
  header: string;
  accessor?: keyof T;
  render?: (item: T, index: number) => ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  title?: string;
  subtitle?: string;
  columns: Column<T>[];
  data: T[];
  emptyMessage?: string;
  headerActions?: ReactNode;
  filterComponent?: ReactNode;
}

export default function DataTable<T extends { id?: string | number }>({
  title,
  subtitle,
  columns,
  data = [],
  emptyMessage = 'Belum ada data tersedia.',
  headerActions,
  filterComponent
}: DataTableProps<T>) {
  const safeData = Array.isArray(data) ? data : [];

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
      {/* Header bar */}
      {(title || headerActions || filterComponent) && (
        <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/50">
          <div>
            {title && <h3 className="text-base font-extrabold text-slate-900">{title}</h3>}
            {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {filterComponent}
            {headerActions}
          </div>
        </div>
      )}

      {/* Table responsive */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-100/70 text-slate-600 font-bold uppercase tracking-wider border-b border-slate-200/60">
            <tr>
              {columns.map((col, idx) => (
                <th key={idx} className={`px-4 py-3.5 ${col.className || ''}`}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {safeData.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-slate-400 font-medium">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              safeData.map((item, rowIdx) => (
                <tr key={item.id || rowIdx} className="hover:bg-indigo-50/30 transition-colors">
                  {columns.map((col, colIdx) => (
                    <td key={colIdx} className={`px-4 py-3.5 align-middle text-slate-700 ${col.className || ''}`}>
                      {col.render ? col.render(item, rowIdx) : (col.accessor ? String(item[col.accessor] ?? '') : '')}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
