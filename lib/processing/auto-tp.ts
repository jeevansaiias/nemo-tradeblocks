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
 * Tests every possible TP% from 1% to 15,000% for comprehensive analysis
 */
export function autoTPCandidates(trades: TradeRecord[]): number[] {
  if (trades.length === 0) return [];
  
  const candidates = new Set<number>();
  
  // Test every 1% increment from 1% to 100%
  for (let tp = 1; tp <= 100; tp++) {
    candidates.add(tp);
  }
  
  // Test every 5% increment from 105% to 500% 
  for (let tp = 105; tp <= 500; tp += 5) {
    candidates.add(tp);
  }
  
  // Test every 10% increment from 510% to 1000%
  for (let tp = 510; tp <= 1000; tp += 10) {
    candidates.add(tp);
  }
  
  // Test every 25% increment from 1025% to 2500%
  for (let tp = 1025; tp <= 2500; tp += 25) {
    candidates.add(tp);
  }
  
  // Test every 50% increment from 2550% to 5000%
  for (let tp = 2550; tp <= 5000; tp += 50) {
    candidates.add(tp);
  }
  
  // Test every 100% increment from 5100% to 10000%
  for (let tp = 5100; tp <= 10000; tp += 100) {
    candidates.add(tp);
  }
  
  // Test every 250% increment from 10250% to 15000%
  for (let tp = 10250; tp <= 15000; tp += 250) {
    candidates.add(tp);
  }
  
  // Convert to sorted array
  return Array.from(candidates).sort((a, b) => a - b);
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