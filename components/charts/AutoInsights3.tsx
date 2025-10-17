'use client';

import React from 'react';
import { AutoInsight3 } from '@/lib/processing/strategy_exit_matrix';

interface AutoInsights3Props {
  insights: AutoInsight3;
}

export function AutoInsights3({ insights }: AutoInsights3Props) {
  return (
    <div className="w-full space-y-4 rounded-lg border border-zinc-800 bg-zinc-950 p-6">
      <div>
        <h3 className="text-lg font-semibold text-white">Strategy × Exit Reason AI Insights</h3>
        <p className="mt-1 text-sm text-zinc-400">Auto-generated analysis and recommendations</p>
      </div>

      {/* Summary Card */}
      <div className="rounded-lg border border-blue-900 bg-blue-950 p-4">
        <div className="flex gap-3">
          <div className="text-2xl">💡</div>
          <div>
            <p className="font-semibold text-blue-100">Overall Analysis</p>
            <p className="mt-1 text-sm text-blue-200">{insights.summary}</p>
          </div>
        </div>
      </div>

      {/* Per-Strategy Insights */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-zinc-400 uppercase">Per-Strategy Insights</p>
        <div className="grid gap-2 md:grid-cols-2">
          {insights.per_strategy_insights.map((item, idx) => (
            <div key={idx} className="rounded bg-zinc-900 p-3 border-l-2 border-orange-500">
              <p className="text-xs font-semibold text-orange-400 mb-1">{item.strategy}</p>
              <p className="text-xs text-zinc-300">
                {item.insight.split('**').map((part, i) =>
                  i % 2 === 1 ? (
                    <span key={i} className="font-semibold text-white">
                      {part}
                    </span>
                  ) : (
                    part
                  )
                )}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Diminishing Returns Analysis */}
      {insights.diminishing_returns.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-zinc-400 uppercase">Diminishing Returns Detected</p>
          <div className="space-y-2">
            {insights.diminishing_returns.map((item, idx) => (
              <div key={idx} className="rounded bg-yellow-950 border border-yellow-900 p-3">
                <div className="flex items-start gap-3">
                  <div className="text-lg">⚠️</div>
                  <div>
                    <p className="text-xs font-semibold text-yellow-400">
                      {item.exit_reason}
                    </p>
                    <p className="mt-1 text-xs text-yellow-200">
                      Efficiency plateaus at <span className="font-semibold">{item.efficiency_plateau.toFixed(1)}%</span> beyond{' '}
                      <span className="font-semibold">{item.threshold_tp.toFixed(0)}% MFE</span> TP. Consider tightening TP at this level.
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top Opportunities */}
      {insights.top_opportunities.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-zinc-400 uppercase">Top Improvement Opportunities</p>
          <div className="space-y-2">
            {insights.top_opportunities.map((item, idx) => (
              <div key={idx} className="rounded bg-red-950 border border-red-900 p-3">
                <div className="flex items-start gap-3">
                  <div className="text-lg">🎯</div>
                  <div>
                    <p className="text-xs font-semibold text-red-400">
                      {item.strategy} / {item.exit_reason}
                    </p>
                    <p className="mt-1 text-xs text-red-200">
                      Potential improvement: <span className="font-semibold">{item.potential_improvement.toFixed(2)}%</span> additional profit
                      if optimized. Priority focus area.
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Items */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-zinc-400 uppercase">Recommended Actions</p>
        <div className="space-y-2">
          {insights.diminishing_returns.length > 0 && (
            <div className="rounded bg-zinc-900 p-3">
              <p className="text-xs font-semibold text-cyan-400 mb-1">1. Review TP Placement</p>
              <p className="text-xs text-zinc-300">
                {insights.diminishing_returns[0]?.exit_reason} exits show diminishing returns. Consider adjusting TP closer to{' '}
                {insights.diminishing_returns[0]?.threshold_tp.toFixed(0)}% MFE for better entry/exit ratios.
              </p>
            </div>
          )}
          {insights.top_opportunities.length > 0 && (
            <div className="rounded bg-zinc-900 p-3">
              <p className="text-xs font-semibold text-cyan-400 mb-1">2. Focus on Outliers</p>
              <p className="text-xs text-zinc-300">
                {insights.top_opportunities[0]?.strategy} / {insights.top_opportunities[0]?.exit_reason} combination is underperforming.
                Backtest alternative TP levels and entry/exit rules.
              </p>
            </div>
          )}
          <div className="rounded bg-zinc-900 p-3">
            <p className="text-xs font-semibold text-cyan-400 mb-1">3. Cross-Validate Findings</p>
            <p className="text-xs text-zinc-300">
              Use the TP Performance charts above to confirm plateau points and optimize exit timing across all strategies.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
