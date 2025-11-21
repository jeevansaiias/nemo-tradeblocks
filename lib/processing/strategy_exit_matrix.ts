/**
 * Strategy × Exit Reason Matrix Analysis
 * 
 * Generates comprehensive heatmap data, TP curves, weighted impact metrics,
 * and AI-style insights for strategy × exit reason combinations.
 */

import { EnrichedTrade } from './tp_optimizer_mae_mfe_service';

export interface StrategyExitHeatmapData {
  strategy: string;
  exit_reason: string;
  trade_count: number;
  avg_efficiency: number;
  missed_profit_pct: number;
  optimal_tp: number;
  win_rate: number;
}

export interface PerStrategyTPCurve {
  strategy: string;
  exit_reason: string;
  tp_levels: number[]; // 20, 40, 60, 80, 100, 200, 300, 400, 500, 750, 1000, 1500 (as % of MFE)
  efficiencies: number[]; // efficiency at each TP level
  optimal_tp: number;
  trades: number;
}

export interface WeightedExitImpact {
  strategy: string;
  exit_reason: string;
  trade_count: number;
  avg_efficiency: number;
  efficiency_delta: number; // vs global avg
  missed_profit_pct: number;
  win_rate: number;
  impact_score: number; // composite score
}

export interface AutoInsight3 {
  summary: string;
  per_strategy_insights: {
    strategy: string;
    insight: string;
  }[];
  diminishing_returns: {
    exit_reason: string;
    threshold_tp: number;
    efficiency_plateau: number;
  }[];
  top_opportunities: {
    strategy: string;
    exit_reason: string;
    potential_improvement: number;
  }[];
}

/**
 * Generate heatmap data for strategy × exit reason combinations
 */
export function strategyExitHeatmapData(
  trades: EnrichedTrade[]
): StrategyExitHeatmapData[] {
  const byStrategyExit = new Map<string, EnrichedTrade[]>();

  trades.forEach((trade) => {
    const key = `${trade.strategy || 'Unknown'}|${trade.exit_reason || 'Unknown'}`;
    if (!byStrategyExit.has(key)) {
      byStrategyExit.set(key, []);
    }
    byStrategyExit.get(key)!.push(trade);
  });

  const heatmapData: StrategyExitHeatmapData[] = [];

  byStrategyExit.forEach((groupTrades, key) => {
    const [strategy, exit_reason] = key.split('|');
    const count = groupTrades.length;
    const winners = groupTrades.filter((t) => t.actual_pct > 0).length;
    const avgEfficiency = groupTrades.reduce((sum, t) => sum + t.efficiency, 0) / count;
    const missedProfit = groupTrades.reduce((sum, t) => sum + t.missed_profit_pct, 0) / count;

    // Optimal TP: median of optimal TPs
    const optimalTps = groupTrades.map((t) => t.optimal_tp).sort((a, b) => a - b);
    const optimalTP = optimalTps[Math.floor(optimalTps.length / 2)];

    heatmapData.push({
      strategy,
      exit_reason,
      trade_count: count,
      avg_efficiency: avgEfficiency,
      missed_profit_pct: missedProfit,
      optimal_tp: optimalTP,
      win_rate: (winners / count) * 100,
    });
  });

  return heatmapData.sort((a, b) => b.avg_efficiency - a.avg_efficiency);
}

/**
 * Generate TP curves for each strategy × exit reason
 * Shows efficiency at different TP levels (20% to 1500% of MFE)
 */
export function perStrategyTPCurves(
  trades: EnrichedTrade[]
): PerStrategyTPCurve[] {
  const byStrategyExit = new Map<string, EnrichedTrade[]>();

  trades.forEach((trade) => {
    const key = `${trade.strategy || 'Unknown'}|${trade.exit_reason || 'Unknown'}`;
    if (!byStrategyExit.has(key)) {
      byStrategyExit.set(key, []);
    }
    byStrategyExit.get(key)!.push(trade);
  });

  const tpLevels = [20, 40, 60, 80, 100, 200, 300, 400, 500, 750, 1000, 1500];
  const curves: PerStrategyTPCurve[] = [];

  byStrategyExit.forEach((groupTrades, key) => {
    const [strategy, exit_reason] = key.split('|');

    // Calculate efficiency at each TP level
    const efficiencies = tpLevels.map((tpPercent) => {
      const avgEfficiency = groupTrades.reduce((sum, trade) => {
        const tp_absolute = (trade.mfe_pct * tpPercent) / 100;
        const captured = Math.min(trade.actual_pct, tp_absolute);
        const eff = (captured / trade.mfe_pct) * 100;
        return sum + Math.max(0, Math.min(100, eff));
      }, 0) / groupTrades.length;
      return avgEfficiency;
    });

    // Find optimal TP
    const optimalTps = groupTrades.map((t) => t.optimal_tp).sort((a, b) => a - b);
    const optimalTP = optimalTps[Math.floor(optimalTps.length / 2)];

    curves.push({
      strategy,
      exit_reason,
      tp_levels: tpLevels,
      efficiencies,
      optimal_tp: optimalTP,
      trades: groupTrades.length,
    });
  });

  return curves;
}

/**
 * Generate weighted exit impact table
 * Shows impact delta vs global average efficiency
 */
export function weightedExitImpactTable(
  trades: EnrichedTrade[]
): WeightedExitImpact[] {
  const globalAvgEfficiency = trades.reduce((sum, t) => sum + t.efficiency, 0) / trades.length;

  const byStrategyExit = new Map<string, EnrichedTrade[]>();

  trades.forEach((trade) => {
    const key = `${trade.strategy || 'Unknown'}|${trade.exit_reason || 'Unknown'}`;
    if (!byStrategyExit.has(key)) {
      byStrategyExit.set(key, []);
    }
    byStrategyExit.get(key)!.push(trade);
  });

  const impacts: WeightedExitImpact[] = [];

  byStrategyExit.forEach((groupTrades, key) => {
    const [strategy, exit_reason] = key.split('|');
    const count = groupTrades.length;
    const winners = groupTrades.filter((t) => t.actual_pct > 0).length;
    const avgEfficiency = groupTrades.reduce((sum, t) => sum + t.efficiency, 0) / count;
    const missedProfit = groupTrades.reduce((sum, t) => sum + t.missed_profit_pct, 0) / count;
    const efficiencyDelta = avgEfficiency - globalAvgEfficiency;

    // Impact score: weighted by trade count and efficiency delta
    const impactScore = (count / trades.length) * Math.abs(efficiencyDelta);

    impacts.push({
      strategy,
      exit_reason,
      trade_count: count,
      avg_efficiency: avgEfficiency,
      efficiency_delta: efficiencyDelta,
      missed_profit_pct: missedProfit,
      win_rate: (winners / count) * 100,
      impact_score: impactScore,
    });
  });

  return impacts.sort((a, b) => b.impact_score - a.impact_score);
}

/**
 * Generate AI-style insights for strategy × exit reason analysis
 */
export function generateAutoInsights3(
  trades: EnrichedTrade[],
  heatmapData: StrategyExitHeatmapData[]
): AutoInsight3 {
  const globalAvgEfficiency = trades.reduce((sum, t) => sum + t.efficiency, 0) / trades.length;
  const globalMissedProfit = trades.reduce((sum, t) => sum + t.missed_profit_pct, 0) / trades.length;

  // Group by strategy
  const byStrategy = new Map<string, EnrichedTrade[]>();
  trades.forEach((trade) => {
    const strategy = trade.strategy || 'Unknown';
    if (!byStrategy.has(strategy)) {
      byStrategy.set(strategy, []);
    }
    byStrategy.get(strategy)!.push(trade);
  });

  // Per-strategy insights
  const per_strategy_insights = Array.from(byStrategy.entries()).map(([strategy, stratTrades]) => {
    const avgEfficiency = stratTrades.reduce((sum, t) => sum + t.efficiency, 0) / stratTrades.length;
    const avgMissedProfit = stratTrades.reduce((sum, t) => sum + t.missed_profit_pct, 0) / stratTrades.length;

    const worstExit = heatmapData
      .filter((h) => h.strategy === strategy)
      .reduce((prev, curr) => (curr.avg_efficiency < prev.avg_efficiency ? curr : prev));

    const insight =
      avgMissedProfit > globalMissedProfit * 1.5
        ? `${strategy}: **${worstExit.exit_reason}** exits leave ${avgMissedProfit.toFixed(1)}% potential profit unclaimed; optimal TP near ${worstExit.optimal_tp.toFixed(0)}% MFE.`
        : `${strategy}: Efficiency at ${avgEfficiency.toFixed(1)}%, above average. Focus on **${worstExit.exit_reason}** refinement.`;

    return { strategy, insight };
  });

  // Detect diminishing returns
  const curves = perStrategyTPCurves(trades);
  const diminishing_returns = curves
    .filter((curve) => {
      // Find where efficiency plateaus (change < 1% over 2x TP increase)
      for (let i = 0; i < curve.efficiencies.length - 1; i++) {
        const currentEff = curve.efficiencies[i];
        const nextEff = curve.efficiencies[i + 1];
        if (Math.abs(nextEff - currentEff) < 1) {
          return true;
        }
      }
      return false;
    })
    .slice(0, 5)
    .map((curve) => {
      // Find plateau point
      let plateauIdx = 0;
      for (let i = 0; i < curve.efficiencies.length - 1; i++) {
        if (Math.abs(curve.efficiencies[i + 1] - curve.efficiencies[i]) < 1) {
          plateauIdx = i;
          break;
        }
      }
      return {
        exit_reason: curve.exit_reason,
        threshold_tp: curve.tp_levels[plateauIdx],
        efficiency_plateau: curve.efficiencies[plateauIdx],
      };
    });

  // Top opportunities (highest missed profit + low efficiency)
  const top_opportunities = heatmapData
    .filter((h) => h.missed_profit_pct > globalMissedProfit * 1.2)
    .sort((a, b) => b.missed_profit_pct - a.missed_profit_pct)
    .slice(0, 3)
    .map((h) => ({
      strategy: h.strategy,
      exit_reason: h.exit_reason,
      potential_improvement: (h.missed_profit_pct - globalMissedProfit),
    }));

  const summary = `Portfolio analysis: ${trades.length} trades across ${byStrategy.size} strategies. ` +
    `Global efficiency at ${globalAvgEfficiency.toFixed(1)}%, leaving ${globalMissedProfit.toFixed(1)}% profit unclaimed. ` +
    `${diminishing_returns.length > 0 ? `Diminishing returns detected at ${diminishing_returns[0].threshold_tp}% MFE for ${diminishing_returns[0].exit_reason}.` : 'No significant diminishing returns detected.'} ` +
    `Top opportunity: ${top_opportunities[0]?.strategy || 'N/A'} / ${top_opportunities[0]?.exit_reason || 'N/A'} exits.`;

  return {
    summary,
    per_strategy_insights,
    diminishing_returns,
    top_opportunities,
  };
}

/**
 * Export heatmap data as CSV
 */
export function formatHeatmapAsCSV(data: StrategyExitHeatmapData[]): string {
  const headers = ['Strategy', 'Exit Reason', 'Trades', 'Avg Efficiency %', 'Missed Profit %', 'Optimal TP %', 'Win Rate %'];
  const rows = data.map((row) => [
    row.strategy,
    row.exit_reason,
    row.trade_count,
    row.avg_efficiency.toFixed(2),
    row.missed_profit_pct.toFixed(2),
    row.optimal_tp.toFixed(0),
    row.win_rate.toFixed(1),
  ]);

  return [headers, ...rows].map((row) => row.join(',')).join('\n');
}
