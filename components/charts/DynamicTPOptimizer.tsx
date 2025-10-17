'use client';

import React, { useState, useMemo } from 'react';
import { TPCluster, TPOptimizationInsight, generate_optimal_tp_table, export_optimal_tp_csv, export_optimal_tp_json } from '@/lib/processing/tp_optimizer_engine';
import { StrategyTrade } from '@/lib/processing/tp_optimizer_service';

interface DynamicTPOptimizerProps {
  clusters: TPCluster[];
  trades: StrategyTrade[];
  insights: TPOptimizationInsight[];
}

type RecommendationColor = 'red' | 'yellow' | 'green';

interface RecommendationInfo {
  color: RecommendationColor;
  label: string;
  icon: string;
}

const getRecommendationInfo = (recommendation: string): RecommendationInfo => {
  if (recommendation.includes('🟢')) {
    return { color: 'green', label: 'Strong', icon: '🟢' };
  } else if (recommendation.includes('🟡')) {
    return { color: 'yellow', label: 'Moderate', icon: '🟡' };
  }
  return { color: 'red', label: 'Caution', icon: '🔴' };
};

const colorClasses: Record<RecommendationColor, string> = {
  red: 'border-red-900/50 bg-red-950/20',
  yellow: 'border-yellow-900/50 bg-yellow-950/20',
  green: 'border-green-900/50 bg-green-950/20',
};

const textColorClasses: Record<RecommendationColor, string> = {
  red: 'text-red-300',
  yellow: 'text-yellow-300',
  green: 'text-green-300',
};

export function DynamicTPOptimizer({ clusters, trades, insights }: DynamicTPOptimizerProps) {
  const [sliderValues, setSliderValues] = useState<Record<number, number>>(
    Object.fromEntries(clusters.map((c) => [c.cluster_id, c.optimal_tp]))
  );

  const optimalTPTable = useMemo(() => {
    return generate_optimal_tp_table(clusters, trades);
  }, [clusters, trades]);

  const handleSliderChange = (clusterId: number, value: number) => {
    setSliderValues((prev) => ({ ...prev, [clusterId]: value }));
  };

  const handleExportCSV = () => {
    const csv = export_optimal_tp_csv(optimalTPTable);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `optimal-tp-${new Date().toISOString().split('T')[0]}.csv`);
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExportJSON = () => {
    const json = export_optimal_tp_json(optimalTPTable);
    const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `optimal-tp-${new Date().toISOString().split('T')[0]}.json`);
    link.click();
    URL.revokeObjectURL(url);
  };

  const totalPotentialImprovement = clusters.reduce((sum, c) => sum + c.potential_improvement * c.trade_count, 0) / trades.length;

  return (
    <div className="w-full space-y-6 rounded-lg border border-zinc-800 bg-zinc-950 p-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-white">Dynamic Take-Profit Optimizer</h2>
        <p className="mt-1 text-sm text-zinc-400">Adjust take-profit levels per cluster and simulate performance</p>
      </div>

      {/* Export Buttons */}
      <div className="flex gap-2">
        <button
          onClick={handleExportCSV}
          className="flex-1 rounded bg-orange-600 px-3 py-2 text-xs font-semibold text-white hover:bg-orange-700 transition-colors"
        >
          📥 Export CSV
        </button>
        <button
          onClick={handleExportJSON}
          className="flex-1 rounded bg-purple-600 px-3 py-2 text-xs font-semibold text-white hover:bg-purple-700 transition-colors"
        >
          📥 Export JSON
        </button>
      </div>

      {/* Overall Summary */}
      <div className="rounded border border-blue-900/50 bg-blue-950/20 p-4">
        <p className="text-xs font-semibold text-blue-300">Overall Optimization Potential</p>
        <p className="mt-2 text-lg font-bold text-blue-100">+{totalPotentialImprovement.toFixed(2)}% Average P/L Improvement</p>
        <p className="mt-1 text-xs text-blue-300/80">Across {trades.length.toLocaleString()} trades in {clusters.length} clusters</p>
      </div>

      {/* Cluster Sliders */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-zinc-300">Per-Cluster Take-Profit Adjustment</h3>
        
        {clusters.map((cluster) => {
          const insight = insights.find((i) => i.cluster_id === cluster.cluster_id);
          const currentTP = sliderValues[cluster.cluster_id];
          const recommendationInfo = insight ? getRecommendationInfo(insight.recommendation) : null;

          return (
            <div key={cluster.cluster_id} className={`rounded border p-4 ${colorClasses[recommendationInfo?.color || 'yellow']}`}>
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-white">{cluster.name}</p>
                    <span className="text-xs font-semibold text-orange-400">{cluster.trade_count} trades</span>
                    {recommendationInfo && (
                      <span className={`text-xs font-semibold ${textColorClasses[recommendationInfo.color]}`}>
                        {recommendationInfo.icon} {recommendationInfo.label}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-zinc-400">Efficiency: {cluster.avg_efficiency.toFixed(1)}%</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-orange-400">{currentTP}%</p>
                  <p className="text-xs text-zinc-500">Current TP</p>
                </div>
              </div>

              {/* Slider */}
              <div className="mt-4">
                <input
                  type="range"
                  min="20"
                  max="500"
                  step="5"
                  value={currentTP}
                  onChange={(e) => handleSliderChange(cluster.cluster_id, parseInt(e.target.value))}
                  className="w-full cursor-pointer"
                />
                <div className="mt-2 flex justify-between text-xs text-zinc-500">
                  <span>20%</span>
                  <span>Optimal: {cluster.optimal_tp}%</span>
                  <span>500%</span>
                </div>
              </div>

              {/* Insights */}
              {insight && (
                <div className="mt-3 space-y-1 rounded bg-zinc-900/50 p-2 text-xs">
                  <p className="text-zinc-400">
                    Expected P/L Delta: <span className="font-semibold text-white">{insight.expected_pl_delta.toFixed(2)}</span> ({insight.expected_pl_delta_pct.toFixed(2)}%)
                  </p>
                  <p className="text-zinc-400">
                    Diminishing Returns Threshold: <span className="font-semibold text-white">{insight.diminishing_return_threshold}%</span>
                  </p>
                  <p className="mt-1 text-zinc-300">{insight.recommendation}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Strategy Breakdown Table */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-zinc-300">Strategy Performance Breakdown</h3>
        
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-zinc-700">
                <th className="px-3 py-2 text-left font-semibold text-zinc-400">Strategy</th>
                <th className="px-3 py-2 text-right font-semibold text-zinc-400">Trades</th>
                <th className="px-3 py-2 text-right font-semibold text-zinc-400">Current TP</th>
                <th className="px-3 py-2 text-right font-semibold text-zinc-400">Optimal TP</th>
                <th className="px-3 py-2 text-right font-semibold text-zinc-400">Improvement</th>
              </tr>
            </thead>
            <tbody>
              {optimalTPTable.map((row, idx) => (
                <tr key={idx} className="border-b border-zinc-800 hover:bg-zinc-900/50">
                  <td className="px-3 py-2 text-zinc-300">{row.strategy}</td>
                  <td className="px-3 py-2 text-right text-zinc-400">{row.trade_count}</td>
                  <td className="px-3 py-2 text-right text-zinc-400">-</td>
                  <td className="px-3 py-2 text-right font-semibold text-orange-400">{row.optimal_tp}%</td>
                  <td className="px-3 py-2 text-right font-semibold text-green-400">{row.expected_improvement.toFixed(2)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer Info */}
      <div className="rounded bg-zinc-900 p-3 text-xs text-zinc-400">
        <p>
          💡 Use sliders to simulate different take-profit levels. Export results to CSV or JSON for further analysis.
        </p>
      </div>
    </div>
  );
}
