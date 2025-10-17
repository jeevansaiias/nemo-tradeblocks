/**
 * Dynamic Take-Profit Optimizer Engine
 * 
 * Provides clustering-based analysis and TP simulation for optimizing
 * take-profit levels based on actual trade behavior and exit patterns.
 */

import { StrategyTrade, TPSimulationPoint } from './tp_optimizer_service';

export interface TradeWithCluster extends StrategyTrade {
  cluster_id?: number;
  mfe_pct: number;
  mae_pct: number;
  efficiency: number;
}

export interface TPCluster {
  cluster_id: number;
  name: string;
  trade_count: number;
  avg_mfe: number;
  avg_mae: number;
  avg_efficiency: number;
  strategies: string[];
  optimal_tp: number;
  win_rate: number;
  current_tp_efficiency: number;
  potential_improvement: number;
}

export interface TPOptimizationInsight {
  cluster_id: number;
  cluster_name: string;
  current_tp: number;
  optimal_tp: number;
  expected_pl_delta: number;
  expected_pl_delta_pct: number;
  diminishing_return_threshold: number;
  recommendation: string;
  trades_affected: number;
}

export interface OptimalTPTable {
  strategy: string;
  trade_count: number;
  current_tp: number;
  optimal_tp: number;
  expected_improvement: number;
  win_rate: number;
  efficiency: number;
}

/**
 * Enrich trades with MFE/MAE/Efficiency metrics
 */
function enrichTradesWithMetrics(trades: StrategyTrade[]): TradeWithCluster[] {
  return trades.map((trade) => {
    // Calculate MFE and MAE
    const mfe_pct = trade.maxProfitPct;
    const mae_pct = trade.maxLossPct;
    
    // Calculate efficiency: how much of MFE was captured relative to actual result
    const efficiency = mfe_pct > 0 ? (trade.resultPct / mfe_pct) * 100 : 0;

    return {
      ...trade,
      mfe_pct,
      mae_pct,
      efficiency: Math.max(0, Math.min(100, efficiency)),
    };
  });
}

/**
 * K-means style clustering based on MFE/MAE/Trade characteristics
 * Groups trades into similar behavioral clusters
 */
export function cluster_exit_behavior(
  trades: StrategyTrade[],
  num_clusters: number = 5
): TPCluster[] {
  if (trades.length === 0) return [];

  const enrichedTrades = enrichTradesWithMetrics(trades);
  
  // Initialize clusters with stratified selection
  const sortedByMFE = [...enrichedTrades].sort((a, b) => a.mfe_pct - b.mfe_pct);
  let clusterCenters: TradeWithCluster[] = [];

  for (let i = 0; i < Math.min(num_clusters, trades.length); i++) {
    const idx = Math.floor((i / num_clusters) * enrichedTrades.length);
    clusterCenters.push(sortedByMFE[idx]);
  }

  // Iterative clustering (simplified k-means)
  const initialClusters: Map<number, TradeWithCluster[]> = new Map();
  let clusters = initialClusters;
  let converged = false;
  let iterations = 0;
  const maxIterations = 10;

  while (!converged && iterations < maxIterations) {
    clusters = new Map();

    // Assign trades to nearest cluster
    enrichedTrades.forEach((trade) => {
      let minDist = Infinity;
      let closestCluster = 0;

      clusterCenters.forEach((center, idx) => {
        const dist = Math.sqrt(
          Math.pow(trade.mfe_pct - center.mfe_pct, 2) +
            Math.pow(trade.mae_pct - center.mae_pct, 2) +
            Math.pow(trade.efficiency - center.efficiency, 2) * 0.1
        );

        if (dist < minDist) {
          minDist = dist;
          closestCluster = idx;
        }
      });

      if (!clusters.has(closestCluster)) {
        clusters.set(closestCluster, []);
      }
      clusters.get(closestCluster)!.push(trade);
    });

    // Update centers
    const newCenters: TradeWithCluster[] = [];
    clusters.forEach((clusterTrades) => {
      const avgMFE = clusterTrades.reduce((sum, t) => sum + t.mfe_pct, 0) / clusterTrades.length;
      const avgMAE = clusterTrades.reduce((sum, t) => sum + t.mae_pct, 0) / clusterTrades.length;
      const avgEfficiency = clusterTrades.reduce((sum, t) => sum + t.efficiency, 0) / clusterTrades.length;

      newCenters.push({
        ...clusterTrades[0],
        mfe_pct: avgMFE,
        mae_pct: avgMAE,
        efficiency: avgEfficiency,
      });
    });

    // Check convergence
    converged = newCenters.every((newCenter, idx) => {
      if (idx >= clusterCenters.length) return false;
      const oldCenter = clusterCenters[idx];
      return (
        Math.abs(newCenter.mfe_pct - oldCenter.mfe_pct) < 0.1 &&
        Math.abs(newCenter.mae_pct - oldCenter.mae_pct) < 0.1 &&
        Math.abs(newCenter.efficiency - oldCenter.efficiency) < 0.1
      );
    });

    clusterCenters = newCenters;
    iterations++;
  }

  // Generate cluster summaries
  const clusterResults: TPCluster[] = [];

  clusters.forEach((clusterTrades, idx) => {
    const count = clusterTrades.length;
    const winners = clusterTrades.filter((t) => t.resultPct > 0).length;
    const avgMFE = clusterTrades.reduce((sum, t) => sum + t.mfe_pct, 0) / count;
    const avgMAE = clusterTrades.reduce((sum, t) => sum + t.mae_pct, 0) / count;
    const avgEfficiency = clusterTrades.reduce((sum, t) => sum + t.efficiency, 0) / count;

    // Get unique strategies in cluster
    const strategies = [...new Set(clusterTrades.map((t) => t.strategy))];

    // Median TP estimate (optimal TP is typically 80-120% of MFE)
    const optimalTP = Math.round(avgMFE * 1.0);

    clusterResults.push({
      cluster_id: idx,
      name: `Cluster ${idx + 1}: ${strategies.join('/')}`.substring(0, 50),
      trade_count: count,
      avg_mfe: avgMFE,
      avg_mae: avgMAE,
      avg_efficiency: avgEfficiency,
      strategies,
      optimal_tp: optimalTP,
      win_rate: (winners / count) * 100,
      current_tp_efficiency: avgEfficiency,
      potential_improvement: Math.max(0, 100 - avgEfficiency),
    });
  });

  return clusterResults.sort((a, b) => b.trade_count - a.trade_count);
}

/**
 * Simulate TP performance across different TP levels
 * Returns efficiency and win metrics for each TP percentage
 */
export function simulate_tp_performance(
  trades: StrategyTrade[],
  tp_percentages: number[]
): TPSimulationPoint[] {
  if (trades.length === 0) return [];

  const enrichedTrades = enrichTradesWithMetrics(trades);
  const results: TPSimulationPoint[] = [];

  tp_percentages.forEach((tp_pct) => {
    let totalEfficiency = 0;
    let winCount = 0;
    let profitSum = 0;
    let lossSum = 0;

    enrichedTrades.forEach((trade) => {
      // Calculate TP in absolute terms relative to MFE
      const tp_absolute = (trade.mfe_pct * tp_pct) / 100;

      // Calculate captured P/L at this TP (capped at actual MFE)
      const captured_pct = Math.min(trade.resultPct, tp_absolute);

      // Efficiency at this TP level
      const eff = trade.mfe_pct > 0 ? (captured_pct / trade.mfe_pct) * 100 : 0;
      totalEfficiency += Math.max(0, Math.min(100, eff));

      // Track wins and losses
      if (captured_pct > 0) {
        winCount++;
        profitSum += captured_pct;
      } else {
        lossSum += captured_pct;
      }
    });

    const tradeCount = enrichedTrades.length;
    const lossCount = tradeCount - winCount;
    const winRate = (winCount / tradeCount) * 100;
    const avgWin = winCount > 0 ? profitSum / winCount : 0;
    const avgLoss = lossCount > 0 ? lossSum / lossCount : 0;
    const profitFactor = Math.abs(avgLoss) > 0 ? avgWin / Math.abs(avgLoss) : avgWin > 0 ? 10 : 0;

    results.push({
      tp: tp_pct,
      pl: profitSum + lossSum,
      plPct: (totalEfficiency / tradeCount),
      winRate,
      expectancy: (avgWin * winRate - Math.abs(avgLoss) * (100 - winRate)) / 100,
      profitFactor,
      trades: tradeCount,
      missedProfitAvg: enrichedTrades.reduce((sum, t) => sum + (t.mfe_pct - t.resultPct), 0) / tradeCount,
    });
  });

  return results.sort((a, b) => b.plPct - a.plPct);
}

/**
 * Generate optimization insights for each cluster
 */
export function generate_optimization_insights(
  clusters: TPCluster[],
  trades: StrategyTrade[]
): TPOptimizationInsight[] {
  const insights: TPOptimizationInsight[] = [];

  clusters.forEach((cluster) => {
    // Get trades for this cluster
    const clusterTrades = trades.filter((t) => cluster.strategies.includes(t.strategy));

    if (clusterTrades.length === 0) return;

    // Simulate across range to find diminishing returns
    const tp_range = [50, 75, 100, 125, 150, 175, 200, 250, 300, 400, 500];
    const sims = simulate_tp_performance(clusterTrades, tp_range);

    // Find where efficiency gains flatten
    let diminishingThreshold = 100;
    for (let i = 1; i < sims.length; i++) {
      const improvement = sims[i].plPct - sims[i - 1].plPct;
      if (Math.abs(improvement) < 1) {
        diminishingThreshold = sims[i].tp;
        break;
      }
    }

    const optimalSim = sims[0];
    const currentSim = sims.find((s) => Math.abs(s.tp - cluster.current_tp_efficiency) < 20) || sims[sims.length - 1];

    const expectedDelta = optimalSim.plPct - (currentSim?.plPct || cluster.current_tp_efficiency);

    let recommendation = '';
    if (expectedDelta > 5) {
      recommendation = `🔴 Critical: Adjust TP to ${optimalSim.tp}% to gain ${expectedDelta.toFixed(1)}% efficiency.`;
    } else if (expectedDelta > 2) {
      recommendation = `🟡 Optimize TP to ${optimalSim.tp}% for ${expectedDelta.toFixed(1)}% improvement.`;
    } else {
      recommendation = `🟢 Current TP near optimal. Monitor beyond ${diminishingThreshold}% MFE for diminishing returns.`;
    }

    insights.push({
      cluster_id: cluster.cluster_id,
      cluster_name: cluster.name,
      current_tp: Math.round(cluster.current_tp_efficiency),
      optimal_tp: Math.round(optimalSim.tp),
      expected_pl_delta: optimalSim.pl - (currentSim?.pl || 0),
      expected_pl_delta_pct: expectedDelta,
      diminishing_return_threshold: diminishingThreshold,
      recommendation,
      trades_affected: cluster.trade_count,
    });
  });

  return insights;
}

/**
 * Generate optimal TP table for export
 */
export function generate_optimal_tp_table(
  clusters: TPCluster[],
  trades: StrategyTrade[]
): OptimalTPTable[] {
  const table: OptimalTPTable[] = [];

  clusters.forEach((cluster) => {
    const clusterTrades = trades.filter((t) => cluster.strategies.includes(t.strategy));

    if (clusterTrades.length === 0) return;

    const sims = simulate_tp_performance(clusterTrades, [cluster.current_tp_efficiency, cluster.optimal_tp]);
    const improvement = Math.abs(sims[0]?.plPct - (sims[1]?.plPct || 0)) || 0;

    cluster.strategies.forEach((strategy) => {
      const strategyTrades = clusterTrades.filter((t) => t.strategy === strategy);

      table.push({
        strategy,
        trade_count: strategyTrades.length,
        current_tp: Math.round(cluster.current_tp_efficiency),
        optimal_tp: Math.round(cluster.optimal_tp),
        expected_improvement: improvement,
        win_rate: cluster.win_rate,
        efficiency: cluster.avg_efficiency,
      });
    });
  });

  return table;
}

/**
 * Export optimal TP table as CSV
 */
export function export_optimal_tp_csv(table: OptimalTPTable[]): string {
  const headers = [
    'Strategy',
    'Trade Count',
    'Current TP %',
    'Optimal TP %',
    'Expected Improvement %',
    'Win Rate %',
    'Efficiency %',
  ];

  const rows = table.map((row) => [
    row.strategy,
    row.trade_count,
    row.current_tp,
    row.optimal_tp,
    row.expected_improvement.toFixed(2),
    row.win_rate.toFixed(1),
    row.efficiency.toFixed(1),
  ]);

  return [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n');
}

/**
 * Export optimal TP table as JSON
 */
export function export_optimal_tp_json(table: OptimalTPTable[]): string {
  return JSON.stringify(
    {
      generated_at: new Date().toISOString(),
      total_combinations: table.length,
      total_trades: table.reduce((sum, row) => sum + row.trade_count, 0),
      data: table,
    },
    null,
    2
  );
}
