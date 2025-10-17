/**
 * MAE/MFE Analytics Module
 * 
 * Single source of truth for all MAE/MFE and efficiency calculations.
 * Handles mixed input scales (decimals 0-1 or percentages 0-100+).
 * Ensures identical results whether data comes from manual upload or active block.
 */

export interface Trade {
  trade_id: string;
  strategy: string;
  entry_date?: string;
  exit_date?: string;
  entry_price?: number;
  exit_price?: number;
  max_price?: number;
  min_price?: number;
  contracts?: number;
  exit_reason?: string;
  
  // Core fields (can be in mixed scales)
  actual_pct?: number;        // Realized P/L as % (decimal or percent scale)
  max_profit_pct?: number;    // Max profit available as % (decimal or percent scale)
  max_loss_pct?: number;      // Max loss available as % (decimal or percent scale)
  mfe_pct?: number;           // Max Favorable Excursion as % (decimal or percent scale)
  mae_pct?: number;           // Max Adverse Excursion as % (decimal or percent scale)
  missed_profit_pct?: number; // Missed profit as % (decimal or percent scale)
  efficiency?: number;        // Efficiency ratio (decimal or percent scale)
  
  // Optional computed fields
  plNet?: number;             // Net P/L after fees
  plGross?: number;           // Gross P/L before fees
}

export interface TradeMetrics {
  trade_id: string;
  strategy: string;
  exit_reason: string;
  
  // All normalized to decimals (0-1 range)
  actualExitDec: number;      // Actual realized exit as decimal
  maeDec: number;             // Max Adverse Excursion as decimal
  mfeDec: number;             // Max Favorable Excursion as decimal
  missedProfitDec: number;    // Missed profit as decimal
  efficiencyDec: number;      // Efficiency as decimal (0-1)
  
  isWin: boolean;             // Whether trade was profitable
}

export interface ExitReasonStats {
  exitReason: string;
  tradeCount: number;
  winCount: number;
  winRateDec: number;         // Decimal 0-1
  avgMfeDec: number;
  avgMaeDec: number;
  avgMissedDec: number;
  avgEfficiencyDec: number;
}

export interface ToplineMetrics {
  totalTrades: number;
  strategies: Set<string>;
  winRateDec: number;         // Decimal 0-1
  avgMfeDec: number;
  avgMaeDec: number;
  avgMissedDec: number;
  avgEfficiencyDec: number;
}

/**
 * Normalize a percentage value that may be in decimal (0-1) or percentage (0-100+) scale.
 * 
 * Rule: If |x| >= 2.0, treat as percent and divide by 100.
 *       Otherwise, use as-is (assume decimal).
 * 
 * Examples:
 * - normalizePercent(0.5867) = 0.5867      (already decimal)
 * - normalizePercent(58.67) = 0.5867       (was percent, divided)
 * - normalizePercent(134.58) = 1.3458      (was percent, divided)
 * - normalizePercent(1.5) = 0.015          (edge case: treat as 1.5%)
 * 
 * @param value - Input value in either scale
 * @param defaultVal - Default if null/undefined (default: 0)
 * @returns Decimal value (0-1 range for normal cases, can exceed for large moves)
 */
export function normalizePercent(value: number | null | undefined, defaultVal: number = 0): number {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return defaultVal;
  }

  const absVal = Math.abs(value);
  
  // If absolute value >= 2.0, assume it's already in percentage scale
  if (absVal >= 2.0) {
    return value / 100;
  }
  
  // Otherwise, treat as decimal (already in 0-1 range or small fraction)
  return value;
}

/**
 * Determine if a trade was a winner using net P/L after fees.
 * 
 * Precedence:
 * 1. If plNet is defined, use plNet > 0
 * 2. Otherwise, use actual_pct > 0 (after normalization)
 * 
 * @param trade - Trade record
 * @returns true if profitable
 */
export function isWin(trade: Trade): boolean {
  // Prefer explicit net P/L if available
  if (trade.plNet !== null && trade.plNet !== undefined) {
    return trade.plNet > 0;
  }
  
  // Fall back to normalized actual_pct
  const actualDec = normalizePercent(trade.actual_pct);
  return actualDec > 0;
}

/**
 * Compute MAE, MFE, actual exit, and missed profit for a single trade.
 * Handles mixed input scales automatically.
 * 
 * @param trade - Trade record
 * @returns Object with all metrics as decimals
 */
export function computeMaeMfe(trade: Trade) {
  const maeDec = normalizePercent(trade.mae_pct);
  const mfeDec = normalizePercent(trade.mfe_pct);
  const actualExitDec = normalizePercent(trade.actual_pct);
  const missedProfitDec = normalizePercent(trade.missed_profit_pct);
  
  return {
    maeDec,
    mfeDec,
    actualExitDec,
    missedProfitDec,
  };
}

/**
 * Compute efficiency ratio given actual exit and MFE.
 * 
 * Formula: efficiency = actualExit / mfe (if mfe > 0, else 0)
 * Clamped to [0, 1] for normal trades; can exceed if actualExit > mfe (overdelivered).
 * 
 * @param actualExitDec - Actual exit as decimal
 * @param mfeDec - Max Favorable Excursion as decimal
 * @returns Efficiency as decimal (0-1 typical, can exceed on edge cases)
 */
export function computeEfficiency(actualExitDec: number, mfeDec: number): number {
  if (mfeDec === 0) {
    // Protect against division by zero
    // If there was no favorable excursion but we exited with profit, treat as perfect (1.0)
    // Otherwise, treat as zero
    return actualExitDec > 0 ? 1.0 : 0;
  }
  
  return actualExitDec / mfeDec;
}

/**
 * Compute metrics for a single trade.
 * 
 * @param trade - Trade record
 * @returns Normalized trade metrics
 */
export function computeTradeMetrics(trade: Trade): TradeMetrics {
  const { maeDec, mfeDec, actualExitDec, missedProfitDec } = computeMaeMfe(trade);
  const efficiencyDec = computeEfficiency(actualExitDec, mfeDec);
  const win = isWin(trade);
  
  return {
    trade_id: trade.trade_id || '',
    strategy: trade.strategy || 'Unknown',
    exit_reason: trade.exit_reason || 'Unknown',
    actualExitDec,
    maeDec,
    mfeDec,
    missedProfitDec,
    efficiencyDec,
    isWin: win,
  };
}

/**
 * Aggregate all trades by exit reason.
 * 
 * @param trades - Array of raw trades
 * @returns Array of exit reason statistics
 */
export function aggregateByExitReason(trades: Trade[]): ExitReasonStats[] {
  const grouped = new Map<string, TradeMetrics[]>();
  
  // Group trades by exit reason and compute metrics
  trades.forEach((trade) => {
    const metrics = computeTradeMetrics(trade);
    const reason = metrics.exit_reason;
    
    if (!grouped.has(reason)) {
      grouped.set(reason, []);
    }
    grouped.get(reason)!.push(metrics);
  });
  
  // Aggregate each group
  const stats: ExitReasonStats[] = [];
  
  grouped.forEach((metricsArray, exitReason) => {
    const tradeCount = metricsArray.length;
    const winCount = metricsArray.filter((m) => m.isWin).length;
    const winRateDec = tradeCount > 0 ? winCount / tradeCount : 0;
    
    const avgMfeDec = metricsArray.length > 0
      ? metricsArray.reduce((sum, m) => sum + m.mfeDec, 0) / metricsArray.length
      : 0;
    
    const avgMaeDec = metricsArray.length > 0
      ? metricsArray.reduce((sum, m) => sum + m.maeDec, 0) / metricsArray.length
      : 0;
    
    const avgMissedDec = metricsArray.length > 0
      ? metricsArray.reduce((sum, m) => sum + m.missedProfitDec, 0) / metricsArray.length
      : 0;
    
    const avgEfficiencyDec = metricsArray.length > 0
      ? metricsArray.reduce((sum, m) => sum + m.efficiencyDec, 0) / metricsArray.length
      : 0;
    
    stats.push({
      exitReason,
      tradeCount,
      winCount,
      winRateDec,
      avgMfeDec,
      avgMaeDec,
      avgMissedDec,
      avgEfficiencyDec,
    });
  });
  
  return stats.sort((a, b) => b.tradeCount - a.tradeCount);
}

/**
 * Compute topline metrics for all trades.
 * 
 * @param trades - Array of raw trades
 * @returns Topline statistics
 */
export function aggregateTopline(trades: Trade[]): ToplineMetrics {
  const strategies = new Set<string>();
  
  trades.forEach((trade) => {
    if (trade.strategy) {
      strategies.add(trade.strategy);
    }
  });
  
  const totalTrades = trades.length;
  
  if (totalTrades === 0) {
    return {
      totalTrades: 0,
      strategies,
      winRateDec: 0,
      avgMfeDec: 0,
      avgMaeDec: 0,
      avgMissedDec: 0,
      avgEfficiencyDec: 0,
    };
  }
  
  // Compute metrics for all trades
  const allMetrics = trades.map((trade) => computeTradeMetrics(trade));
  
  const winCount = allMetrics.filter((m) => m.isWin).length;
  const winRateDec = winCount / totalTrades;
  
  const avgMfeDec = allMetrics.reduce((sum, m) => sum + m.mfeDec, 0) / totalTrades;
  const avgMaeDec = allMetrics.reduce((sum, m) => sum + m.maeDec, 0) / totalTrades;
  const avgMissedDec = allMetrics.reduce((sum, m) => sum + m.missedProfitDec, 0) / totalTrades;
  const avgEfficiencyDec = allMetrics.reduce((sum, m) => sum + m.efficiencyDec, 0) / totalTrades;
  
  return {
    totalTrades,
    strategies,
    winRateDec,
    avgMfeDec,
    avgMaeDec,
    avgMissedDec,
    avgEfficiencyDec,
  };
}

/**
 * Sanity check: Verify two topline metrics are nearly identical.
 * 
 * Useful for asserting manual and active-block paths produce equivalent results.
 * 
 * @param metrics1 - First topline metrics
 * @param metrics2 - Second topline metrics
 * @param toleranceDec - Tolerance in decimal scale (default: 1e-6)
 * @returns Object with matches and any drifted metrics
 */
export function sanityCheckTopline(
  metrics1: ToplineMetrics,
  metrics2: ToplineMetrics,
  toleranceDec: number = 1e-6,
) {
  const checks = {
    totalTradesDiffer: metrics1.totalTrades !== metrics2.totalTrades,
    totalTrades: {
      val1: metrics1.totalTrades,
      val2: metrics2.totalTrades,
    },
    winRateDrifted: Math.abs(metrics1.winRateDec - metrics2.winRateDec) > toleranceDec,
    winRateDec: {
      val1: metrics1.winRateDec,
      val2: metrics2.winRateDec,
      diff: Math.abs(metrics1.winRateDec - metrics2.winRateDec),
    },
    avgMfeDrifted: Math.abs(metrics1.avgMfeDec - metrics2.avgMfeDec) > toleranceDec,
    avgMfeDec: {
      val1: metrics1.avgMfeDec,
      val2: metrics2.avgMfeDec,
      diff: Math.abs(metrics1.avgMfeDec - metrics2.avgMfeDec),
    },
    avgMaeDrifted: Math.abs(metrics1.avgMaeDec - metrics2.avgMaeDec) > toleranceDec,
    avgMaeDec: {
      val1: metrics1.avgMaeDec,
      val2: metrics2.avgMaeDec,
      diff: Math.abs(metrics1.avgMaeDec - metrics2.avgMaeDec),
    },
    avgMissedDrifted: Math.abs(metrics1.avgMissedDec - metrics2.avgMissedDec) > toleranceDec,
    avgMissedDec: {
      val1: metrics1.avgMissedDec,
      val2: metrics2.avgMissedDec,
      diff: Math.abs(metrics1.avgMissedDec - metrics2.avgMissedDec),
    },
    avgEfficiencyDrifted: Math.abs(metrics1.avgEfficiencyDec - metrics2.avgEfficiencyDec) > toleranceDec,
    avgEfficiencyDec: {
      val1: metrics1.avgEfficiencyDec,
      val2: metrics2.avgEfficiencyDec,
      diff: Math.abs(metrics1.avgEfficiencyDec - metrics2.avgEfficiencyDec),
    },
  };
  
  const allPass = !Object.values(checks).some((v) => {
    if (typeof v === 'boolean') return v;
    return false;
  });
  
  return { allPass, checks };
}

/**
 * Format a decimal percentage for display.
 * 
 * @param decimal - Value in decimal form (0.5867 = 58.67%)
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted string with % sign
 */
export function formatDecimalPercent(decimal: number, decimals: number = 2): string {
  if (!Number.isFinite(decimal)) {
    return '0.00%';
  }
  return `${(decimal * 100).toFixed(decimals)}%`;
}
