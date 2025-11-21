/**
 * Exit Reason Attribution Analyzer
 * 
 * Analyzes trade performance across different exit reasons to understand
 * which exit conditions perform best and which leave the most profit on table.
 */

import { EnrichedTrade } from './tp_optimizer_mae_mfe_service';

export interface ExitReasonMetrics {
  reason: string;
  trade_count: number;
  win_rate: number;
  avg_mfe: number;
  avg_mae: number;
  avg_efficiency: number;
  missed_profit_pct: number;
  recommended_tp: number;
  total_mfe: number;
  total_captured: number;
}

export interface StrategyExitReasonMetric {
  strategy: string;
  exit_reason: string;
  trade_count: number;
  win_rate: number;
  missed_profit_pct: number;
  avg_efficiency: number;
  recommended_tp: number;
}

export interface ExitReasonTPBin {
  reason: string;
  tp_20: number;
  tp_40: number;
  tp_60: number;
  tp_80: number;
  tp_100: number;
}

export interface AutoInsight {
  summary: string;
  worst_exit_reason: {
    reason: string;
    efficiency_delta: number;
    recommendation: string;
  };
  missed_profit_opportunity: {
    total_pct: number;
    top_reason: string;
    top_reason_missed: number;
  };
  action_items: string[];
}

/**
 * Calculate metrics for each exit reason
 */
export function analyzeByExitReason(trades: EnrichedTrade[]): ExitReasonMetrics[] {
  const byReason = new Map<string, EnrichedTrade[]>();

  trades.forEach(trade => {
    const key = trade.exit_reason || 'Unknown';
    if (!byReason.has(key)) {
      byReason.set(key, []);
    }
    byReason.get(key)!.push(trade);
  });

  const metrics: ExitReasonMetrics[] = [];

  byReason.forEach((reasonTrades, reason) => {
    const count = reasonTrades.length;
    const winners = reasonTrades.filter(t => t.actual_pct > 0).length;
    const avgMFE = reasonTrades.reduce((sum, t) => sum + t.mfe_pct, 0) / count;
    const avgMAE = reasonTrades.reduce((sum, t) => sum + t.mae_pct, 0) / count;
    const avgEfficiency = reasonTrades.reduce((sum, t) => sum + t.efficiency, 0) / count;
    const missedProfit = reasonTrades.reduce((sum, t) => sum + t.missed_profit_pct, 0) / count;

    // Recommended TP: median of optimal TPs for this exit reason
    const optimalTps = reasonTrades
      .map(t => t.optimal_tp)
      .sort((a, b) => a - b);
    const recommendedTP = optimalTps[Math.floor(optimalTps.length / 2)];

    // Total MFE and captured
    const totalMFE = reasonTrades.reduce((sum, t) => sum + t.mfe_pct, 0);
    const totalCaptured = reasonTrades.reduce((sum, t) => sum + t.actual_pct, 0);

    metrics.push({
      reason,
      trade_count: count,
      win_rate: (winners / count) * 100,
      avg_mfe: avgMFE,
      avg_mae: avgMAE,
      avg_efficiency: avgEfficiency,
      missed_profit_pct: missedProfit,
      recommended_tp: recommendedTP,
      total_mfe: totalMFE,
      total_captured: totalCaptured,
    });
  });

  return metrics.sort((a, b) => b.trade_count - a.trade_count);
}

/**
 * Cross-tabulation of strategy × exit reason
 */
export function strategyExitReasonCrosstab(
  trades: EnrichedTrade[]
): StrategyExitReasonMetric[] {
  const crossTab = new Map<string, Map<string, EnrichedTrade[]>>();

  trades.forEach(trade => {
    const strategy = trade.strategy || 'Unknown';
    const reason = trade.exit_reason || 'Unknown';

    if (!crossTab.has(strategy)) {
      crossTab.set(strategy, new Map());
    }
    const stratMap = crossTab.get(strategy)!;
    if (!stratMap.has(reason)) {
      stratMap.set(reason, []);
    }
    stratMap.get(reason)!.push(trade);
  });

  const results: StrategyExitReasonMetric[] = [];

  crossTab.forEach((reasonMap, strategy) => {
    reasonMap.forEach((reasonTrades, reason) => {
      const count = reasonTrades.length;
      const winners = reasonTrades.filter(t => t.actual_pct > 0).length;
      const avgEfficiency =
        reasonTrades.reduce((sum, t) => sum + t.efficiency, 0) / count;
      const missedProfit =
        reasonTrades.reduce((sum, t) => sum + t.missed_profit_pct, 0) / count;

      const optimalTps = reasonTrades
        .map(t => t.optimal_tp)
        .sort((a, b) => a - b);
      const recommendedTP = optimalTps[Math.floor(optimalTps.length / 2)];

      results.push({
        strategy,
        exit_reason: reason,
        trade_count: count,
        win_rate: (winners / count) * 100,
        missed_profit_pct: missedProfit,
        avg_efficiency: avgEfficiency,
        recommended_tp: recommendedTP,
      });
    });
  });

  return results;
}

/**
 * Analyze efficiency across TP bins for each exit reason
 */
export function analyzeTPBinsByExitReason(
  trades: EnrichedTrade[]
): ExitReasonTPBin[] {
  const byReason = new Map<string, EnrichedTrade[]>();

  trades.forEach(trade => {
    const key = trade.exit_reason || 'Unknown';
    if (!byReason.has(key)) {
      byReason.set(key, []);
    }
    byReason.get(key)!.push(trade);
  });

  const results: ExitReasonTPBin[] = [];

  byReason.forEach((reasonTrades, reason) => {
    const tp20 = calculateBinEfficiency(reasonTrades, 20);
    const tp40 = calculateBinEfficiency(reasonTrades, 40);
    const tp60 = calculateBinEfficiency(reasonTrades, 60);
    const tp80 = calculateBinEfficiency(reasonTrades, 80);
    const tp100 = calculateBinEfficiency(reasonTrades, 100);

    results.push({
      reason,
      tp_20: tp20,
      tp_40: tp40,
      tp_60: tp60,
      tp_80: tp80,
      tp_100: tp100,
    });
  });

  return results;
}

/**
 * Helper: Calculate average efficiency for trades that would exit at given TP%
 */
function calculateBinEfficiency(trades: EnrichedTrade[], tp_pct: number): number {
  let hits = 0;
  let efficiency_sum = 0;

  trades.forEach(trade => {
    // Would this trade hit the TP at this level?
    const tp_value = trade.entry_price * (1 + tp_pct / 100);
    const max_price = trade.entry_price * (1 + trade.mfe_pct / 100);
    
    if (max_price >= tp_value) {
      // Yes, would hit
      const profit_at_tp = tp_pct;
      const mfe_pct = trade.mfe_pct;
      const efficiency = mfe_pct > 0 ? (profit_at_tp / mfe_pct) * 100 : 100;
      efficiency_sum += efficiency;
      hits++;
    }
  });

  return hits > 0 ? efficiency_sum / hits : 0;
}

/**
 * Generate auto insights based on exit reason analysis
 */
export function generateAutoInsights(
  trades: EnrichedTrade[],
  exitReasonMetrics: ExitReasonMetrics[]
): AutoInsight {
  const globalAvgEfficiency =
    trades.reduce((sum, t) => sum + t.efficiency, 0) / trades.length;

  // Find worst performing exit reason
  const worstExit = exitReasonMetrics.reduce((prev, curr) =>
    curr.avg_efficiency < prev.avg_efficiency ? curr : prev
  );

  const efficiencyDelta = globalAvgEfficiency - worstExit.avg_efficiency;

  // Find highest missed profit reason
  const highestMissedExit = exitReasonMetrics.reduce((prev, curr) =>
    curr.missed_profit_pct > prev.missed_profit_pct ? curr : prev
  );

  // Global missed profit
  const globalMissedProfit =
    trades.reduce((sum, t) => sum + t.missed_profit_pct, 0) / trades.length;

  // Generate summary
  const summary = `Overall efficiency: ${globalAvgEfficiency.toFixed(1)}% of MFE captured. ` +
    `Exit reasons vary from ${worstExit.avg_efficiency.toFixed(1)}% (${worstExit.reason}) ` +
    `to optimal performance. Average trade leaves ${globalMissedProfit.toFixed(1)}% profit on table.`;

  // Recommendation
  let recommendation = '';
  if (efficiencyDelta > 15) {
    recommendation = `${worstExit.reason} exits underperform by ${efficiencyDelta.toFixed(1)}% - ` +
      `consider tightening rules or using alternative exit conditions.`;
  } else {
    recommendation = `${worstExit.reason} exits need optimization to match better-performing conditions.`;
  }

  // Action items
  const actionItems: string[] = [];
  actionItems.push(`Tighten ${worstExit.reason} exits to ${worstExit.recommended_tp}% TP target`);
  actionItems.push(
    `${highestMissedExit.reason} leaves ${highestMissedExit.missed_profit_pct.toFixed(1)}% profit - review exit logic`
  );
  
  const highEfficiencyReasons = exitReasonMetrics
    .filter(m => m.avg_efficiency > globalAvgEfficiency + 5)
    .slice(0, 2);
  
  if (highEfficiencyReasons.length > 0) {
    actionItems.push(
      `Consider applying ${highEfficiencyReasons[0].reason} exit criteria to other strategies`
    );
  }

  return {
    summary,
    worst_exit_reason: {
      reason: worstExit.reason,
      efficiency_delta: efficiencyDelta,
      recommendation,
    },
    missed_profit_opportunity: {
      total_pct: globalMissedProfit,
      top_reason: highestMissedExit.reason,
      top_reason_missed: highestMissedExit.missed_profit_pct,
    },
    action_items: actionItems,
  };
}

/**
 * Format metrics for CSV export
 */
export function formatExitReasonsAsCSV(metrics: ExitReasonMetrics[]): string {
  const headers = [
    'Exit Reason',
    'Trade Count',
    'Win Rate %',
    'Avg MFE %',
    'Avg MAE %',
    'Avg Efficiency %',
    'Missed Profit %',
    'Recommended TP %',
  ];

  const rows = metrics.map(m => [
    m.reason,
    m.trade_count,
    m.win_rate.toFixed(2),
    m.avg_mfe.toFixed(2),
    m.avg_mae.toFixed(2),
    m.avg_efficiency.toFixed(2),
    m.missed_profit_pct.toFixed(2),
    m.recommended_tp,
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
  ].join('\n');

  return csvContent;
}
