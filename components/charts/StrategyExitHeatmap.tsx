'use client';

import React, { useState } from 'react';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { StrategyExitHeatmapData, formatHeatmapAsCSV } from '@/lib/processing/strategy_exit_matrix';

interface StrategyExitHeatmapProps {
  data: StrategyExitHeatmapData[];
}

type ViewMode = 'efficiency' | 'missed_profit' | 'optimal_tp';

export function StrategyExitHeatmap({ data }: StrategyExitHeatmapProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('efficiency');
  const [sortBy, setSortBy] = useState<'efficiency' | 'missed_profit'>('efficiency');

  // Sort data
  const sortedData = [...data].sort((a, b) => {
    if (sortBy === 'efficiency') {
      return b.avg_efficiency - a.avg_efficiency;
    }
    return b.missed_profit_pct - a.missed_profit_pct;
  });

  // Get color based on view mode
  const getColor = (item: StrategyExitHeatmapData): string => {
    let value = 0;
    if (viewMode === 'efficiency') {
      value = item.avg_efficiency;
      if (value >= 80) return '#22c55e'; // Green
      if (value >= 60) return '#eab308'; // Yellow
      return '#ef4444'; // Red
    } else if (viewMode === 'missed_profit') {
      value = item.missed_profit_pct;
      if (value <= 5) return '#22c55e'; // Green (low missed profit)
      if (value <= 15) return '#eab308'; // Yellow
      return '#ef4444'; // Red (high missed profit)
    } else {
      // optimal_tp color based on TP value (lower is better, but not too low)
      value = item.optimal_tp;
      if (value >= 50 && value <= 150) return '#22c55e'; // Good range
      if (value > 150) return '#eab308'; // Higher TP
      return '#f97316'; // Lower TP
    }
  };

  const handleExportCSV = () => {
    const csv = formatHeatmapAsCSV(data);
    const element = document.createElement('a');
    element.setAttribute('href', 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv));
    element.setAttribute('download', `strategy-exit-heatmap-${new Date().toISOString().split('T')[0]}.csv`);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const CustomTooltip = (props: {
    active?: boolean;
    payload?: Array<{ payload: StrategyExitHeatmapData }>;
  }) => {
    if (props.active && props.payload && props.payload[0]) {
      const item = props.payload[0].payload;
      return (
        <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-3 text-xs text-white shadow-lg">
          <p className="font-semibold">{item.strategy}</p>
          <p className="text-zinc-300 text-xs">{item.exit_reason}</p>
          <div className="mt-2 border-t border-zinc-700 pt-2">
            <p className="text-zinc-300">
              Trades: <span className="text-white">{item.trade_count}</span>
            </p>
            <p className="text-zinc-300">
              Efficiency: <span className="text-green-400">{item.avg_efficiency.toFixed(1)}%</span>
            </p>
            <p className="text-zinc-300">
              Missed Profit: <span className="text-orange-400">{item.missed_profit_pct.toFixed(2)}%</span>
            </p>
            <p className="text-zinc-300">
              Optimal TP: <span className="text-blue-400">{item.optimal_tp.toFixed(0)}%</span>
            </p>
            <p className="text-zinc-300">
              Win Rate: <span className="text-cyan-400">{item.win_rate.toFixed(1)}%</span>
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  // Prepare chart data with positioning
  const uniqueStrategies = [...new Set(sortedData.map((d) => d.strategy))];
  const uniqueReasons = [...new Set(sortedData.map((d) => d.exit_reason))];

  const chartData = sortedData.map((item) => ({
    ...item,
    x: uniqueReasons.indexOf(item.exit_reason),
    y: uniqueStrategies.indexOf(item.strategy),
    value:
      viewMode === 'efficiency'
        ? item.avg_efficiency
        : viewMode === 'missed_profit'
          ? item.missed_profit_pct
          : item.optimal_tp,
  }));

  return (
    <div className="w-full space-y-6 rounded-lg border border-zinc-800 bg-zinc-950 p-6">
      <div>
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h3 className="text-lg font-semibold text-white">Strategy × Exit Reason Heatmap</h3>
            <p className="mt-1 text-sm text-zinc-400">Performance matrix across all combinations</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleExportCSV}
              className="rounded bg-zinc-800 px-3 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-700"
            >
              Export CSV
            </button>
          </div>
        </div>

        {/* View Mode Toggle */}
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => setViewMode('efficiency')}
            className={`rounded px-3 py-1.5 text-xs font-medium transition ${
              viewMode === 'efficiency'
                ? 'bg-orange-500 text-white'
                : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
            }`}
          >
            Efficiency %
          </button>
          <button
            onClick={() => setViewMode('missed_profit')}
            className={`rounded px-3 py-1.5 text-xs font-medium transition ${
              viewMode === 'missed_profit'
                ? 'bg-orange-500 text-white'
                : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
            }`}
          >
            Missed Profit %
          </button>
          <button
            onClick={() => setViewMode('optimal_tp')}
            className={`rounded px-3 py-1.5 text-xs font-medium transition ${
              viewMode === 'optimal_tp'
                ? 'bg-orange-500 text-white'
                : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
            }`}
          >
            Optimal TP %
          </button>
        </div>

        {/* Sort Options */}
        <div className="mt-3 flex gap-2">
          <span className="text-xs text-zinc-500">Sort by:</span>
          <button
            onClick={() => setSortBy('efficiency')}
            className={`text-xs ${
              sortBy === 'efficiency'
                ? 'text-orange-400 font-semibold'
                : 'text-zinc-400 hover:text-zinc-300'
            }`}
          >
            Efficiency
          </button>
          <span className="text-xs text-zinc-600">/</span>
          <button
            onClick={() => setSortBy('missed_profit')}
            className={`text-xs ${
              sortBy === 'missed_profit'
                ? 'text-orange-400 font-semibold'
                : 'text-zinc-400 hover:text-zinc-300'
            }`}
          >
            Missed Profit
          </button>
        </div>
      </div>

      {/* Heatmap Chart */}
      <ResponsiveContainer width="100%" height={400}>
        <ScatterChart margin={{ top: 20, right: 20, bottom: 100, left: 150 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#333" />
          <XAxis
            type="number"
            dataKey="x"
            domain={[0, uniqueReasons.length - 1]}
            label={{
              value: 'Exit Reasons',
              position: 'bottom',
              offset: 80,
              fill: '#a1a1a1',
            }}
            tick={false}
          />
          <YAxis
            type="number"
            dataKey="y"
            domain={[0, uniqueStrategies.length - 1]}
            label={{
              value: 'Strategies',
              angle: -90,
              position: 'insideLeft',
              fill: '#a1a1a1',
            }}
            tick={false}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
          <Scatter name="Heatmap" data={chartData} fill="#8884d8">
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={getColor(entry)} />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>

      {/* Legend for Exit Reasons and Strategies */}
      <div className="grid grid-cols-2 gap-6 rounded bg-zinc-900 p-4">
        <div>
          <p className="text-xs font-semibold text-zinc-400 uppercase">Exit Reasons (X-axis)</p>
          <div className="mt-2 space-y-1">
            {uniqueReasons.map((reason, idx) => (
              <p key={idx} className="text-xs text-zinc-300">
                {idx}: {reason}
              </p>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold text-zinc-400 uppercase">Strategies (Y-axis)</p>
          <div className="mt-2 space-y-1">
            {uniqueStrategies.map((strategy, idx) => (
              <p key={idx} className="text-xs text-zinc-300">
                {idx}: {strategy}
              </p>
            ))}
          </div>
        </div>
      </div>

      {/* Color Legend */}
      <div className="rounded bg-zinc-900 p-4">
        <p className="text-xs font-semibold text-zinc-400 uppercase mb-2">
          Color Legend ({viewMode === 'efficiency' ? 'Efficiency %' : viewMode === 'missed_profit' ? 'Missed Profit %' : 'Optimal TP %'})
        </p>
        <div className="flex gap-4 flex-wrap">
          {viewMode === 'efficiency' && (
            <>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded bg-green-500" />
                <span className="text-xs text-zinc-300">&gt;80% (Good)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded bg-yellow-500" />
                <span className="text-xs text-zinc-300">60-80% (Moderate)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded bg-red-500" />
                <span className="text-xs text-zinc-300">&lt;60% (Poor)</span>
              </div>
            </>
          )}
          {viewMode === 'missed_profit' && (
            <>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded bg-green-500" />
                <span className="text-xs text-zinc-300">&lt;5% (Good)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded bg-yellow-500" />
                <span className="text-xs text-zinc-300">5-15% (Moderate)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded bg-red-500" />
                <span className="text-xs text-zinc-300">&gt;15% (High)</span>
              </div>
            </>
          )}
          {viewMode === 'optimal_tp' && (
            <>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded bg-green-500" />
                <span className="text-xs text-zinc-300">50-150% MFE (Ideal)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded bg-yellow-500" />
                <span className="text-xs text-zinc-300">&gt;150% MFE (High)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded bg-orange-500" />
                <span className="text-xs text-zinc-300">&lt;50% MFE (Low)</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
