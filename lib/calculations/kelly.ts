/**
 * Kelly Criterion calculations for position sizing
 */

import { Trade } from "@/lib/models/trade";

export interface KellyMetrics {
  fraction: number;
  percent: number;
  winRate: number;
  payoffRatio: number;
  avgWin: number;
  avgLoss: number;
}

const ZERO_METRICS: KellyMetrics = {
  fraction: 0,
  percent: 0,
  winRate: 0,
  payoffRatio: 0,
  avgWin: 0,
  avgLoss: 0,
};

/**
 * Calculate Kelly Criterion metrics for a set of trades
 *
 * Returns zero metrics if insufficient data (no wins, no losses, or zero denominator)
 */
export function calculateKellyMetrics(trades: Trade[]): KellyMetrics {
  if (trades.length === 0) {
    return ZERO_METRICS;
  }

  const wins: number[] = [];
  const losses: number[] = [];

  for (const trade of trades) {
    const pl = trade.pl || 0;
    if (pl > 0) {
      wins.push(pl);
    } else if (pl < 0) {
      losses.push(Math.abs(pl));
    }
  }

  if (wins.length === 0 || losses.length === 0) {
    return ZERO_METRICS;
  }

  const totalTrades = trades.length;
  const winRate = wins.length / totalTrades;
  const avgWin = wins.reduce((sum, val) => sum + val, 0) / wins.length;
  const avgLoss = losses.reduce((sum, val) => sum + val, 0) / losses.length;

  if (avgLoss === 0) {
    return ZERO_METRICS;
  }

  const payoffRatio = avgWin / avgLoss;
  const lossRate = 1 - winRate;
  const kellyFraction = (payoffRatio * winRate - lossRate) / payoffRatio;
  const kellyPercent = kellyFraction * 100;

  return {
    fraction: kellyFraction,
    percent: kellyPercent,
    winRate,
    payoffRatio,
    avgWin,
    avgLoss,
  };
}

/**
 * Group trades by strategy and calculate Kelly metrics for each
 */
export function calculateStrategyKellyMetrics(
  trades: Trade[]
): Map<string, KellyMetrics> {
  const strategyMap = new Map<string, Trade[]>();

  // Group trades by strategy
  for (const trade of trades) {
    const strategy = trade.strategy || "Uncategorized";
    if (!strategyMap.has(strategy)) {
      strategyMap.set(strategy, []);
    }
    strategyMap.get(strategy)!.push(trade);
  }

  // Calculate Kelly metrics for each strategy
  const metricsMap = new Map<string, KellyMetrics>();
  for (const [strategy, strategyTrades] of strategyMap.entries()) {
    metricsMap.set(strategy, calculateKellyMetrics(strategyTrades));
  }

  return metricsMap;
}
