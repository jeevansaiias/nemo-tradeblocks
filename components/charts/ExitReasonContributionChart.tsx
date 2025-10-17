'use client';

import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  type TooltipProps,
} from 'recharts';
import { ExitReasonMetrics } from '@/lib/processing/exit_reason_analyzer';

interface ExitReasonContributionChartProps {
  data: ExitReasonMetrics[];
}

export function ExitReasonContributionChart({
  data,
}: ExitReasonContributionChartProps) {
  // Sort by missed profit for better visualization
  const chartData = [...data]
    .sort((a, b) => b.missed_profit_pct - a.missed_profit_pct)
    .slice(0, 10); // Top 10

  const getEfficiencyColor = (efficiency: number) => {
    if (efficiency >= 80) return '#22c55e'; // Green
    if (efficiency >= 60) return '#eab308'; // Yellow
    return '#ef4444'; // Red
  };

  const CustomTooltip = (props: TooltipProps<number, string>) => {
    const { active, payload } = props;
    if (active && payload && payload[0]) {
      const data = payload[0].payload as ExitReasonMetrics;
      return (
        <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-3 text-xs text-white shadow-lg">
          <p className="font-semibold">{data.reason}</p>
          <p className="text-zinc-300">
            Trades: <span className="text-white">{data.trade_count}</span>
          </p>
          <p className="text-zinc-300">
            Avg MFE: <span className="text-green-400">{data.avg_mfe.toFixed(2)}%</span>
          </p>
          <p className="text-zinc-300">
            Avg MAE: <span className="text-red-400">{data.avg_mae.toFixed(2)}%</span>
          </p>
          <p className="text-zinc-300">
            Win Rate: <span className="text-blue-400">{data.win_rate.toFixed(1)}%</span>
          </p>
          <p className="text-zinc-300">
            Efficiency: <span className="text-orange-400">{data.avg_efficiency.toFixed(1)}%</span>
          </p>
          <p className="text-zinc-300">
            Missed: <span className="text-orange-500 font-semibold">{data.missed_profit_pct.toFixed(2)}%</span>
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full rounded-lg border border-zinc-800 bg-zinc-950 p-6">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-white">
          Exit Reason Impact on Missed Profit
        </h3>
        <p className="mt-1 text-sm text-zinc-400">
          Bar color indicates efficiency (green = good, red = poor)
        </p>
      </div>

      <ResponsiveContainer width="100%" height={400}>
        <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 100 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#333" />
          <XAxis
            dataKey="reason"
            angle={-45}
            textAnchor="end"
            height={100}
            tick={{ fill: '#a1a1a1', fontSize: 12 }}
          />
          <YAxis
            label={{ value: 'Missed Profit %', angle: -90, position: 'insideLeft' }}
            tick={{ fill: '#a1a1a1' }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="missed_profit_pct" radius={[8, 8, 0, 0]}>
            {chartData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={getEfficiencyColor(entry.avg_efficiency)}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <div className="mt-4 flex gap-4 text-xs">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded bg-green-500" />
          <span className="text-zinc-300">Good Efficiency (&gt;80%)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded bg-yellow-500" />
          <span className="text-zinc-300">Moderate (60-80%)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded bg-red-500" />
          <span className="text-zinc-300">Poor (&lt;60%)</span>
        </div>
      </div>
    </div>
  );
}
