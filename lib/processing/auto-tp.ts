import { TradeRecord, TPResult } from "@/lib/stores/tp-optimizer-store";

/**
 * Generate auto TP candidates from trade data
 * Combines percentiles from maxProfitPct with fixed anchors
 */
export function autoTPCandidates(trades: TradeRecord[]): number[] {
  if (trades.length === 0) return [];
  
  // Get all maxProfitPct values, sorted
  const maxProfits = trades
    .map(t => t.maxProfitPct)
    .filter(p => p > 0)
    .sort((a, b) => a - b);
  
  if (maxProfits.length === 0) return [10, 15, 20, 25, 30, 40, 50];
  
  const candidates = new Set<number>();
  
  // Add percentiles (10th, 20th, ..., 90th)
  for (let i = 1; i <= 9; i++) {
    const percentileIndex = Math.floor((i / 10) * (maxProfits.length - 1));
    const percentileValue = Math.round(maxProfits[percentileIndex]);
    if (percentileValue >= 1 && percentileValue <= 100) {
      candidates.add(percentileValue);
    }
  }
  
  // Add anchor points
  const anchors = [10, 15, 20, 25, 30, 40, 50];
  anchors.forEach(anchor => candidates.add(anchor));
  
  // Convert to sorted array, clamped to [1, 100]
  return Array.from(candidates)
    .filter(tp => tp >= 1 && tp <= 100)
    .sort((a, b) => a - b);
}

/**
 * Simulate TP-only strategy (no SL changes)
 * For each trade: if maxProfitPct >= tpPct, use tpPct; otherwise use resultPct
 */
export function simulateTP(trades: TradeRecord[], tpPct: number): TPResult {
  if (trades.length === 0) {
    return {
      tpPct,
      trades: 0,
      totalPnL: 0,
      avgPerTrade: 0,
      winRate: 0,
      profitFactor: 0,
      expectancy: 0
    };
  }
  
  // Simulate each trade
  const simulatedResults = trades.map(trade => {
    // TP-only rule: if max profit reached TP, take TP; otherwise use original result
    return trade.maxProfitPct >= tpPct ? tpPct : trade.resultPct;
  });
  
  // Calculate metrics
  const totalPnL = simulatedResults.reduce((sum, result) => sum + result, 0);
  const avgPerTrade = totalPnL / trades.length;
  
  const winners = simulatedResults.filter(result => result > 0);
  const losers = simulatedResults.filter(result => result < 0);
  
  const winRate = winners.length / trades.length;
  const avgWin = winners.length > 0 ? winners.reduce((sum, w) => sum + w, 0) / winners.length : 0;
  const avgLoss = losers.length > 0 ? Math.abs(losers.reduce((sum, l) => sum + l, 0) / losers.length) : 0;
  
  const grossProfit = winners.reduce((sum, w) => sum + w, 0);
  const grossLoss = Math.abs(losers.reduce((sum, l) => sum + l, 0));
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 999 : 0;
  
  const expectancy = (winRate * avgWin) - ((1 - winRate) * avgLoss);
  
  return {
    tpPct,
    trades: trades.length,
    totalPnL,
    avgPerTrade,
    winRate,
    profitFactor,
    expectancy
  };
}

/**
 * Summarize baseline performance (hold to expiry)
 * Uses the resultPct field as-is
 */
export function summarizeBaseline(trades: TradeRecord[]): TPResult {
  if (trades.length === 0) {
    return {
      tpPct: 0, // N/A for baseline
      trades: 0,
      totalPnL: 0,
      avgPerTrade: 0,
      winRate: 0,
      profitFactor: 0,
      expectancy: 0
    };
  }
  
  // Use original results
  const results = trades.map(trade => trade.resultPct);
  
  // Calculate metrics
  const totalPnL = results.reduce((sum, result) => sum + result, 0);
  const avgPerTrade = totalPnL / trades.length;
  
  const winners = results.filter(result => result > 0);
  const losers = results.filter(result => result < 0);
  
  const winRate = winners.length / trades.length;
  const avgWin = winners.length > 0 ? winners.reduce((sum, w) => sum + w, 0) / winners.length : 0;
  const avgLoss = losers.length > 0 ? Math.abs(losers.reduce((sum, l) => sum + l, 0) / losers.length) : 0;
  
  const grossProfit = winners.reduce((sum, w) => sum + w, 0);
  const grossLoss = Math.abs(losers.reduce((sum, l) => sum + l, 0));
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 999 : 0;
  
  const expectancy = (winRate * avgWin) - ((1 - winRate) * avgLoss);
  
  return {
    tpPct: 0, // N/A for baseline
    trades: trades.length,
    totalPnL,
    avgPerTrade,
    winRate,
    profitFactor,
    expectancy
  };
}

/**
 * Pick the best result based on objective
 */
export function pickBest(results: TPResult[], objective: "totalPnL" | "expectancy" | "profitFactor"): TPResult {
  if (results.length === 0) {
    throw new Error("No results to pick from");
  }
  
  switch (objective) {
    case "totalPnL":
      return results.reduce((best, current) =>
        current.totalPnL > best.totalPnL ? current : best
      );
    case "expectancy":
      return results.reduce((best, current) =>
        current.expectancy > best.expectancy ? current : best
      );
    case "profitFactor":
      return results.reduce((best, current) =>
        current.profitFactor > best.profitFactor ? current : best
      );
    default:
      return results[0];
  }
}