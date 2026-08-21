'use client';

import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import { Activity } from 'lucide-react';
import { formatRupiah } from '../../lib/payment';

export interface TrendDataPoint {
  date: string;
  revenue: number;
  users: number;
}

interface ActivityTrendChartProps {
  data: TrendDataPoint[];
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-md text-sm">
        <p className="font-bold text-slate-800 mb-1">{label}</p>
        <p className="text-emerald-600 font-semibold">
          Revenue: {formatRupiah(payload[0].value)}
        </p>
        {payload[1] && (
          <p className="text-indigo-600 font-semibold">
            New Users: {payload[1].value}
          </p>
        )}
      </div>
    );
  }
  return null;
};

export default function ActivityTrendChart({ data }: ActivityTrendChartProps) {
  // If no data, use some default sample data for visual demonstration
  const chartData = data && data.length > 0 ? data : [
    { date: 'Sen', revenue: 450000, users: 12 },
    { date: 'Sel', revenue: 650000, users: 18 },
    { date: 'Rab', revenue: 300000, users: 8 },
    { date: 'Kam', revenue: 950000, users: 24 },
    { date: 'Jum', revenue: 1200000, users: 30 },
    { date: 'Sab', revenue: 800000, users: 20 },
    { date: 'Min', revenue: 1050000, users: 28 },
  ];

  const formatYAxis = (tickItem: number) => {
    if (tickItem === 0) return '0';
    if (tickItem >= 1000000) return `${(tickItem / 1000000).toFixed(1)}M`;
    if (tickItem >= 1000) return `${(tickItem / 1000).toFixed(0)}k`;
    return tickItem.toString();
  };

  return (
    <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-2xs h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100 text-[#3525cd] flex items-center justify-center">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Trend Aktivitas & Pendapatan</h3>
            <p className="text-[11px] text-slate-500">Statistik transaksi 7 hari terakhir</p>
          </div>
        </div>
      </div>

      <div className="flex-1 w-full min-h-[250px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3525cd" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#3525cd" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis 
              dataKey="date" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fontSize: 12, fill: '#64748b' }} 
              dy={10}
            />
            <YAxis 
              yAxisId="left"
              axisLine={false} 
              tickLine={false} 
              tick={{ fontSize: 12, fill: '#64748b' }}
              tickFormatter={formatYAxis}
              width={50}
            />
            <YAxis 
              yAxisId="right"
              orientation="right"
              axisLine={false} 
              tickLine={false} 
              tick={{ fontSize: 12, fill: '#64748b' }}
              width={30}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area 
              yAxisId="left"
              type="monotone" 
              dataKey="revenue" 
              stroke="#10b981" 
              strokeWidth={3}
              fillOpacity={1} 
              fill="url(#colorRevenue)" 
            />
            <Area 
              yAxisId="right"
              type="monotone" 
              dataKey="users" 
              stroke="#3525cd" 
              strokeWidth={2}
              fillOpacity={1} 
              fill="url(#colorUsers)" 
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
