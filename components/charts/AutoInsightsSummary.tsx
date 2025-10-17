'use client';

import React from 'react';
import { AlertCircle, TrendingUp, Target } from 'lucide-react';
import { AutoInsight } from '@/lib/processing/exit_reason_analyzer';

interface AutoInsightsSummaryProps {
  insight: AutoInsight;
}

export function AutoInsightsSummary({ insight }: AutoInsightsSummaryProps) {
  return (
    <div className="w-full space-y-4 rounded-lg border border-zinc-800 bg-zinc-950 p-6">
      <div className="flex items-center gap-3">
        <AlertCircle className="h-6 w-6 text-orange-400" />
        <h3 className="text-lg font-semibold text-white">Auto-Generated Insights</h3>
      </div>

      {/* Main Summary */}
      <div className="rounded-lg bg-gradient-to-r from-zinc-900 to-zinc-800 p-4 border border-zinc-700">
        <p className="text-sm leading-relaxed text-zinc-200">{insight.summary}</p>
      </div>

      {/* Key Findings Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Worst Exit Reason */}
        <div className="rounded-lg border border-red-900/30 bg-red-950/20 p-4">
          <div className="flex items-start gap-3">
            <TrendingUp className="mt-1 h-5 w-5 text-red-400 flex-shrink-0" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-red-300">
                Underperforming Exit Condition
              </p>
              <p className="mt-1 font-semibold text-white">
                {insight.worst_exit_reason.reason}
              </p>
              <p className="mt-1 text-xs text-red-200">
                Efficiency gap: <span className="font-bold">−{insight.worst_exit_reason.efficiency_delta.toFixed(1)}%</span>
              </p>
              <p className="mt-2 text-xs leading-relaxed text-red-100">
                {insight.worst_exit_reason.recommendation}
              </p>
            </div>
          </div>
        </div>

        {/* Missed Profit Opportunity */}
        <div className="rounded-lg border border-orange-900/30 bg-orange-950/20 p-4">
          <div className="flex items-start gap-3">
            <Target className="mt-1 h-5 w-5 text-orange-400 flex-shrink-0" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-orange-300">
                Missed Profit Opportunity
              </p>
              <p className="mt-1 font-semibold text-white">
                {insight.missed_profit_opportunity.total_pct.toFixed(2)}% avg
              </p>
              <p className="mt-1 text-xs text-orange-200">
                Top reason: <span className="font-bold">{insight.missed_profit_opportunity.top_reason}</span>
              </p>
              <p className="mt-1 text-xs text-orange-100">
                {insight.missed_profit_opportunity.top_reason_missed.toFixed(2)}% left on table by this exit condition
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Action Items */}
      <div className="rounded-lg border border-blue-900/30 bg-blue-950/20 p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-blue-300">
          Recommended Actions
        </p>
        <ul className="space-y-2">
          {insight.action_items.map((item, idx) => (
            <li key={idx} className="flex gap-3 text-sm text-blue-100">
              <span className="mt-1 inline-flex h-1.5 w-1.5 flex-shrink-0 rounded-full bg-blue-400" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-md bg-zinc-900 p-3 text-xs text-zinc-400">
        💡 <strong>Tip:</strong> Use these insights to refine your exit logic. Focus on the
        highest-impact improvements first.
      </div>
    </div>
  );
}
