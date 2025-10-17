/**
 * Dynamic Take-Profit Optimizer Service (v2)
 * 
 * Simulates multiple TP levels for each strategy and computes comprehensive metrics.
 * Supports rule-aware TP ranges and cross-strategy comparison.
 */

export interface StrategyTrade {
  strategy: string;
  entryDate: string;
  exitDate: string;
  maxProfitPct: number;
  maxLossPct: number;
  resultPct: number;
  exitReason?: string;
}

export interface TPSimulationPoint {
  tp: number;
  pl: number;
  plPct: number;
  winRate: number;
  expectancy: number;
  profitFactor: number;
  trades: number;
  missedProfitAvg: number;
}

export interface StrategyOptimizationResult {
  strategy: string;
  bestTP: number;
  bestPL: number;
  bestExpectancy: number;
  simulations: TPSimulationPoint[];
  baselineTP: number;
  baselinePL: number;
  baselineExpectancy: number;
  ruleTPSuggestion?: number;
  tradeCount: number;
}

export interface AggregatedResults {
  [strategyName: string]: TPSimulationPoint[];
}

/**
 * Generate TP candidates based on rule constraints
 * @param ruleTP - Suggested TP from strategy rules (if exists)
 * @returns Array of TP percentages to simulate
 */
export function generateTPCandidates(ruleTP?: number): number[] {
  const candidates = new Set<number>();

  if (ruleTP && ruleTP > 0) {
    // Rule-aware mode: ±50% around rule TP
    const lower = Math.max(25, Math.round(ruleTP * 0.5));
    const upper = Math.round(ruleTP * 1.5);
    
    for (let tp = lower; tp <= upper; tp += Math.max(1, Math.floor((upper - lower) / 50))) {
      candidates.add(tp);
    }
  } else {
    // Full range: 25% to 10,000%
    // Dense sampling at lower levels, sparse at higher
    for (let tp = 25; tp <= 100; tp++) {
      candidates.add(tp);
    }
    for (let tp = 110; tp <= 500; tp += 10) {
      candidates.add(tp);
    }
    for (let tp = 550; tp <= 1000; tp += 50) {
      candidates.add(tp);
    }
    for (let tp = 1100; tp <= 5000; tp += 100) {
      candidates.add(tp);
    }
    for (let tp = 5200; tp <= 10000; tp += 200) {
      candidates.add(tp);
    }
  }

  return Array.from(candidates).sort((a, b) => a - b);
}

/**
 * Simulate trades with a specific TP level
 */
export function simulateTPLevel(
  trades: StrategyTrade[],
  tpPct: number
): TPSimulationPoint {
  if (trades.length === 0) {
    return {
      tp: tpPct,
      pl: 0,
      plPct: 0,
      winRate: 0,
      expectancy: 0,
      profitFactor: 0,
      trades: 0,
      missedProfitAvg: 0
    };
  }

  const simulatedResults = trades.map(trade => {
    // TP rule: if max profit reached TP, use TP; otherwise use original result
    return trade.maxProfitPct >= tpPct ? tpPct : trade.resultPct;
  });

  const totalPL = simulatedResults.reduce((sum, result) => sum + result, 0);
  const avgPerTrade = totalPL / trades.length;
  
  const winners = simulatedResults.filter(result => result > 0);
  const losers = simulatedResults.filter(result => result < 0);
  const breakevens = simulatedResults.filter(result => result === 0);

  const winRate = winners.length / trades.length;
  const avgWin = winners.length > 0
    ? winners.reduce((sum, w) => sum + w, 0) / winners.length
    : 0;
  const avgLoss = losers.length > 0
    ? Math.abs(losers.reduce((sum, l) => sum + l, 0) / losers.length)
    : 0;

  const grossProfit = winners.reduce((sum, w) => sum + w, 0);
  const grossLoss = Math.abs(losers.reduce((sum, l) => sum + l, 0));

  // Profit factor
  const profitFactor = grossLoss > 0 
    ? grossProfit / grossLoss
    : (grossProfit > 0 ? 999.99 : 0);

  // Expectancy: (Win% × Avg Win) - (Loss% × Avg Loss)
  const expectancy = (winRate * avgWin) - ((1 - winRate) * avgLoss);

  // Missed profit: potential profit if TP was hit vs actual result
  const missedProfits = trades.map(trade => {
    if (trade.maxProfitPct >= tpPct) {
      return 0; // TP was hit, no missed profit
    }
    return trade.maxProfitPct - trade.resultPct;
  });
  const missedProfitAvg = missedProfits.reduce((sum, m) => sum + m, 0) / trades.length;

  return {
    tp: tpPct,
    pl: Math.round(totalPL * 100) / 100,
    plPct: Math.round((avgPerTrade * 100 * 100)) / 100,
    winRate: Math.round(winRate * 10000) / 100,
    expectancy: Math.round(expectancy * 10000) / 100,
    profitFactor: Math.round(profitFactor * 1000) / 1000,
    trades: trades.length,
    missedProfitAvg: Math.round(missedProfitAvg * 1000) / 1000
  };
}

/**
 * Optimize TP for a single strategy
 */
export function optimizeStrategy(
  trades: StrategyTrade[],
  strategy: string,
  ruleTP?: number
): StrategyOptimizationResult {
  const candidates = generateTPCandidates(ruleTP);
  const simulations = candidates.map(tp => simulateTPLevel(trades, tp));

  // Find best by expectancy
  const best = simulations.reduce((max, curr) =>
    curr.expectancy > max.expectancy ? curr : max
  );

  // Baseline (no TP change, use original resultPct)
  const baseline = simulateTPLevel(trades, 0);

  return {
    strategy,
    bestTP: best.tp,
    bestPL: best.pl,
    bestExpectancy: best.expectancy,
    simulations,
    baselineTP: 0,
    baselinePL: baseline.pl,
    baselineExpectancy: baseline.expectancy,
    ruleTPSuggestion: ruleTP,
    tradeCount: trades.length
  };
}

/**
 * Aggregate results from multiple strategies into comparison format
 */
export function aggregateResults(
  results: StrategyOptimizationResult[]
): AggregatedResults {
  const aggregated: AggregatedResults = {};

  for (const result of results) {
    aggregated[result.strategy] = result.simulations;
  }

  return aggregated;
}

/**
 * Calculate global metrics across all strategies
 */
export interface GlobalMetrics {
  globalBestTP: number;
  averageExpectancy: number;
  weightedPFChange: number;
  topStrategies: Array<{
    strategy: string;
    bestTP: number;
    deltaExpectancy: number;
    profitFactor: number;
  }>;
}

export function calculateGlobalMetrics(
  results: StrategyOptimizationResult[]
): GlobalMetrics {
  if (results.length === 0) {
    return {
      globalBestTP: 0,
      averageExpectancy: 0,
      weightedPFChange: 0,
      topStrategies: []
    };
  }

  // Find TP that appears most beneficial across strategies
  const tpScores = new Map<number, number>();
  for (const result of results) {
    for (const sim of result.simulations) {
      const current = tpScores.get(sim.tp) || 0;
      tpScores.set(sim.tp, current + sim.expectancy);
    }
  }

  const globalBestTP = Array.from(tpScores.entries()).reduce((max, curr) =>
    curr[1] > max[1] ? curr : max
  )[0] || 0;

  // Average expectancy improvement
  const expectancyGains = results.map(r => r.bestExpectancy - r.baselineExpectancy);
  const averageExpectancy = expectancyGains.reduce((sum, g) => sum + g, 0) / results.length;

  // Weighted PF change
  const simAtGlobalTP = results
    .map(r => r.simulations.find(s => s.tp === globalBestTP))
    .filter(Boolean) as TPSimulationPoint[];

  const pfChanges = simAtGlobalTP.map(sim => 
    (sim ? sim.profitFactor : 1) - 1
  );
  const weightedPFChange = pfChanges.length > 0
    ? pfChanges.reduce((sum, pf) => sum + pf, 0) / pfChanges.length
    : 0;

  // Top 5 strategies by expectancy gain
  const topStrategies = results
    .map(r => ({
      strategy: r.strategy,
      bestTP: r.bestTP,
      deltaExpectancy: r.bestExpectancy - r.baselineExpectancy,
      profitFactor: r.simulations.find(s => s.tp === r.bestTP)?.profitFactor || 0
    }))
    .sort((a, b) => b.deltaExpectancy - a.deltaExpectancy)
    .slice(0, 5);

  return {
    globalBestTP,
    averageExpectancy: Math.round(averageExpectancy * 10000) / 100,
    weightedPFChange: Math.round(weightedPFChange * 1000) / 1000,
    topStrategies
  };
}

/**
 * Parse CSV data into trade records
 * Format: strategy, entryDate, exitDate, maxProfitPct, maxLossPct, resultPct, exitReason
 */
export function parseTradesFromCSV(csvContent: string): StrategyTrade[] {
  const lines = csvContent.trim().split('\n');
  if (lines.length < 2) return [];

  const header = lines[0].split(',').map(h => h.trim());
  const trades: StrategyTrade[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim());
    const record: Partial<StrategyTrade> = {};

    header.forEach((col, idx) => {
      const value = values[idx];
      if (col === 'strategy') record.strategy = value;
      else if (col === 'entryDate') record.entryDate = value;
      else if (col === 'exitDate') record.exitDate = value;
      else if (col === 'maxProfitPct') record.maxProfitPct = parseFloat(value) || 0;
      else if (col === 'maxLossPct') record.maxLossPct = parseFloat(value) || 0;
      else if (col === 'resultPct') record.resultPct = parseFloat(value) || 0;
      else if (col === 'exitReason') record.exitReason = value;
    });

    if (record.strategy && record.resultPct !== undefined) {
      trades.push(record as StrategyTrade);
    }
  }

  return trades;
}
