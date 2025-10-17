'use client';

import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TPCluster } from '@/lib/processing/tp_optimizer_engine';

interface TPClusterMapProps {
  clusters: TPCluster[];
}

export function TPClusterMap({ clusters }: TPClusterMapProps) {
  const chartData = clusters.map((cluster) => ({
    name: `C${cluster.cluster_id + 1}`,
    efficiency: Math.round(cluster.avg_efficiency),
    trades: cluster.trade_count,
    improvement: Math.round(cluster.potential_improvement),
    tp: cluster.optimal_tp,
  }));

  const getColorByEfficiency = (eff: number): string => {
    if (eff >= 80) return '#22c55e';
    if (eff >= 60) return '#eab308';
    return '#ef4444';
  };

  return (
    <div className="w-full space-y-4 rounded-lg border border-zinc-800 bg-zinc-950 p-6">
      <div>
        <h3 className="text-lg font-semibold text-white">Trade Clusters Analysis</h3>
        <p className="mt-1 text-sm text-zinc-400">Grouped by MFE/MAE behavior patterns</p>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 60 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#333" />
          <XAxis dataKey="name" tick={{ fill: '#a1a1a1' }} />
          <YAxis label={{ value: 'Efficiency %', angle: -90, position: 'insideLeft' }} tick={{ fill: '#a1a1a1' }} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #444', borderRadius: '6px' }}
            formatter={(value: number, name: string) => {
              if (name === 'efficiency') return `${value}%`;
              if (name === 'improvement') return `${value}%`;
              return value;
            }}
          />
          <Legend />
          <Bar dataKey="efficiency" fill="#ff9f43" name="Avg Efficiency %" />
          <Bar dataKey="improvement" fill="#5f27cd" name="Potential Improvement %" />
        </BarChart>
      </ResponsiveContainer>

      {/* Cluster Grid */}
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {clusters.map((cluster) => (
          <div key={cluster.cluster_id} className="rounded bg-zinc-900 p-3 border-l-4" style={{ borderColor: getColorByEfficiency(cluster.avg_efficiency) }}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold text-orange-400">{cluster.name}</p>
                <p className="mt-1 text-xs text-zinc-400">{cluster.trade_count} trades</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold" style={{ color: getColorByEfficiency(cluster.avg_efficiency) }}>
                  {cluster.avg_efficiency.toFixed(1)}%
                </p>
                <p className="text-xs text-zinc-500">Optimal TP: {cluster.optimal_tp}%</p>
              </div>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-zinc-500">Avg MFE:</span> <span className="text-white">{cluster.avg_mfe.toFixed(2)}%</span>
              </div>
              <div>
                <span className="text-zinc-500">Win Rate:</span> <span className="text-white">{cluster.win_rate.toFixed(1)}%</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="rounded bg-zinc-900 p-3 text-xs text-zinc-400">
        <p>
          Total clusters: <span className="font-semibold text-white">{clusters.length}</span> | 
          {' '}Total trades: <span className="font-semibold text-white">{clusters.reduce((sum, c) => sum + c.trade_count, 0)}</span>
        </p>
      </div>
    </div>
  );
}
