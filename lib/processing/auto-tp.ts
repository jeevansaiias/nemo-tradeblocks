import { TradeRecord, TPResult } from "@/lib/stores/tp-optimizer-store";

/**
 * Coerce value to clean number, stripping % and whitespace
 */
export function pct(x: string | number): number {
  if (typeof x === 'number') return x;
  const cleaned = String(x).replace(/[%\s,]/g, '').trim();
  return parseFloat(cleaned) || 0;
}

/**
 * Generate auto TP candidates from trade data
 * Combines percentiles from maxProfitPct with log-scale anchors (NO 100% cap)
 */
export function autoTPCandidates(trades: TradeRecord[]): number[] {
  if (trades.length === 0) return [];
  
  // Get all maxProfitPct values, sorted
  const maxProfits = trades
    .map(t => t.maxProfitPct)
    .filter(p => p > 0)
    .sort((a, b) => a - b);
  
  if (maxProfits.length === 0) return [5, 10, 15, 20, 25, 30, 40, 50];
  
  const candidates = new Set<number>();
  const maxValue = Math.max(...maxProfits);
  const upperBound = maxValue * 1.05; // Small cushion above max
  
  // Add percentiles (10th, 20th, ..., 90th) of maxProfitPct
  for (let i = 1; i <= 9; i++) {
    const percentileIndex = Math.floor((i / 10) * (maxProfits.length - 1));
    const percentileValue = Math.round(maxProfits[percentileIndex] * 10) / 10; // Round to 0.1
    if (percentileValue >= 1) {
      candidates.add(percentileValue);
    }
  }
  
  // Add log-scale anchor points (NO 100% cap)
  const anchors = [5, 10, 15, 20, 25, 30, 40, 50, 75, 100, 150, 200, 300, 500, 750, 1000, 1500, 2000];
  anchors.forEach(anchor => {
    if (anchor >= 1 && anchor <= upperBound) {
      candidates.add(anchor);
    }
  });
  
  // Convert to sorted array, clamped to [1, upperBound]
  return Array.from(candidates)
    .filter(tp => tp >= 1 && tp <= upperBound)
    .map(tp => Math.round(tp * 10) / 10) // Round to 0.1 precision
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
  
  // Handle edge cases for profit factor
  let profitFactor: number;
  if (grossLoss === 0) {
    profitFactor = grossProfit > 0 ? Number.POSITIVE_INFINITY : 0;
  } else {
    profitFactor = grossProfit / grossLoss;
  }
  
  // Handle edge cases for expectancy
  const expectancy = winners.length === 0 && losers.length === 0 ? 0 : 
    (winRate * avgWin) - ((1 - winRate) * avgLoss);
  
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
 * Summarize baseline performance (actual results from trading log)
 * Uses the resultPct field as-is (do NOT force expiry)
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
  
  // Use original results (baseline = actual trade results)
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
  
  // Handle edge cases for profit factor
  let profitFactor: number;
  if (grossLoss === 0) {
    profitFactor = grossProfit > 0 ? Number.POSITIVE_INFINITY : 0;
  } else {
    profitFactor = grossProfit / grossLoss;
  }
  
  // Handle edge cases for expectancy
  const expectancy = winners.length === 0 && losers.length === 0 ? 0 : 
    (winRate * avgWin) - ((1 - winRate) * avgLoss);
  
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