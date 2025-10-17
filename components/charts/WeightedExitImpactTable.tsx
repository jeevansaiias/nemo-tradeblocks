'use client';

import React, { useState } from 'react';
import { WeightedExitImpact } from '@/lib/processing/strategy_exit_matrix';

interface WeightedExitImpactTableProps {
  data: WeightedExitImpact[];
}

type SortKey = 'efficiency' | 'missed_profit' | 'impact_score';

export function WeightedExitImpactTable({ data }: WeightedExitImpactTableProps) {
  const [sortBy, setSortBy] = useState<SortKey>('impact_score');
  const [sortAsc, setSortAsc] = useState(false);

  const sortedData = [...data].sort((a, b) => {
    let aVal = 0,
      bVal = 0;
    if (sortBy === 'efficiency') {
      aVal = a.avg_efficiency;
      bVal = b.avg_efficiency;
    } else if (sortBy === 'missed_profit') {
      aVal = a.missed_profit_pct;
      bVal = b.missed_profit_pct;
    } else {
      aVal = a.impact_score;
      bVal = b.impact_score;
    }
    return sortAsc ? aVal - bVal : bVal - aVal;
  });

  const handleSort = (key: SortKey) => {
    if (sortBy === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortBy(key);
      setSortAsc(false);
    }
  };

  // Calculate global average efficiency for comparison
  const globalAvgEfficiency =
    data.reduce((sum, d) => sum + d.avg_efficiency, 0) / (data.length || 1);

  const getEfficiencyColor = (efficiency: number): string => {
    if (efficiency >= 80) return 'text-green-400';
    if (efficiency >= 60) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getDeltaColor = (delta: number): string => {
    if (delta > 10) return 'text-green-400';
    if (delta > 0) return 'text-blue-400';
    if (delta > -10) return 'text-orange-400';
    return 'text-red-400';
  };

  const getSortIcon = (key: SortKey): string => {
    if (sortBy !== key) return '↕';
    return sortAsc ? '↑' : '↓';
  };

  return (
    <div className="w-full space-y-4 rounded-lg border border-zinc-800 bg-zinc-950 p-6">
      <div>
        <h3 className="text-lg font-semibold text-white">Weighted Exit Impact Analysis</h3>
        <p className="mt-1 text-sm text-zinc-400">
          Impact vs Global Avg Efficiency ({globalAvgEfficiency.toFixed(1)}%)
        </p>
      </div>

      {/* Sortable Table */}
      <div className="overflow-x-auto rounded border border-zinc-800">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-900">
              <th className="px-4 py-2 text-left text-zinc-300 font-semibold">Strategy</th>
              <th className="px-4 py-2 text-left text-zinc-300 font-semibold">Exit Reason</th>
              <th
                className="px-4 py-2 text-center text-zinc-300 font-semibold cursor-pointer hover:text-white"
                onClick={() => handleSort('efficiency')}
              >
                Efficiency % {sortBy === 'efficiency' && getSortIcon('efficiency')}
              </th>
              <th className="px-4 py-2 text-center text-zinc-300 font-semibold">
                Impact Δ {sortBy !== 'efficiency' && '(vs Avg)'}
              </th>
              <th
                className="px-4 py-2 text-center text-zinc-300 font-semibold cursor-pointer hover:text-white"
                onClick={() => handleSort('missed_profit')}
              >
                Missed % {sortBy === 'missed_profit' && getSortIcon('missed_profit')}
              </th>
              <th className="px-4 py-2 text-center text-zinc-300 font-semibold">Trade Count</th>
              <th className="px-4 py-2 text-center text-zinc-300 font-semibold">Win Rate %</th>
              <th
                className="px-4 py-2 text-center text-zinc-300 font-semibold cursor-pointer hover:text-white"
                onClick={() => handleSort('impact_score')}
              >
                Impact Score {sortBy === 'impact_score' && getSortIcon('impact_score')}
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedData.map((row, idx) => (
              <tr key={idx} className="border-b border-zinc-800 hover:bg-zinc-900 transition">
                <td className="px-4 py-2 font-medium text-white">{row.strategy}</td>
                <td className="px-4 py-2 text-zinc-300">{row.exit_reason}</td>
                <td className={`px-4 py-2 text-center font-semibold ${getEfficiencyColor(row.avg_efficiency)}`}>
                  {row.avg_efficiency.toFixed(1)}%
                </td>
                <td className={`px-4 py-2 text-center font-semibold ${getDeltaColor(row.efficiency_delta)}`}>
                  {row.efficiency_delta > 0 ? '+' : ''}
                  {row.efficiency_delta.toFixed(1)}%
                </td>
                <td className="px-4 py-2 text-center text-orange-400">
                  {row.missed_profit_pct.toFixed(2)}%
                </td>
                <td className="px-4 py-2 text-center text-zinc-300">{row.trade_count}</td>
                <td className="px-4 py-2 text-center text-blue-400">{row.win_rate.toFixed(1)}%</td>
                <td className="px-4 py-2 text-center font-semibold text-white">
                  {(row.impact_score * 100).toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend and Notes */}
      <div className="grid gap-4 rounded bg-zinc-900 p-4 text-xs text-zinc-400 md:grid-cols-2">
        <div>
          <p className="font-semibold text-white mb-2">Efficiency Color Guide</p>
          <div className="space-y-1">
            <p>
              <span className="text-green-400">●</span> ≥80% = Excellent
            </p>
            <p>
              <span className="text-yellow-400">●</span> 60-80% = Good
            </p>
            <p>
              <span className="text-red-400">●</span> &lt;60% = Poor
            </p>
          </div>
        </div>
        <div>
          <p className="font-semibold text-white mb-2">Impact Delta (vs Avg)</p>
          <div className="space-y-1">
            <p>
              <span className="text-green-400">●</span> &gt;+10% = Significantly Better
            </p>
            <p>
              <span className="text-blue-400">●</span> 0 to +10% = Slightly Better
            </p>
            <p>
              <span className="text-orange-400">●</span> -10% to 0% = Slightly Worse
            </p>
            <p>
              <span className="text-red-400">●</span> &lt;-10% = Significantly Worse
            </p>
          </div>
        </div>
      </div>

      {/* Summary Statistics */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded bg-zinc-900 p-3">
          <p className="text-xs text-zinc-500">Total Combinations</p>
          <p className="text-xl font-bold text-white">{data.length}</p>
        </div>
        <div className="rounded bg-zinc-900 p-3">
          <p className="text-xs text-zinc-500">Avg Efficiency</p>
          <p className="text-xl font-bold text-white">{globalAvgEfficiency.toFixed(1)}%</p>
        </div>
        <div className="rounded bg-zinc-900 p-3">
          <p className="text-xs text-zinc-500">Best Performer</p>
          <p className="text-sm font-semibold text-green-400">
            {data.length > 0 ? `${data.reduce((p, c) => (c.avg_efficiency > p.avg_efficiency ? c : p)).exit_reason}` : 'N/A'}
          </p>
        </div>
        <div className="rounded bg-zinc-900 p-3">
          <p className="text-xs text-zinc-500">Avg Missed Profit</p>
          <p className="text-xl font-bold text-orange-400">
            {(data.reduce((sum, d) => sum + d.missed_profit_pct, 0) / (data.length || 1)).toFixed(2)}%
          </p>
        </div>
      </div>
    </div>
  );
}
