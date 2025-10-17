/**
 * Returns & Efficiency Analytics
 * 
 * All percentages are calculated as % OF PREMIUM (entry price * contracts).
 * This is the standard for options analysis and ensures consistency across all calculations.
 * 
 * Basis: % OF PREMIUM
 * - Used for: Actual %, MFE %, MAE %, and Efficiency calculations
 * - Ensures P&L, max profit, and max loss are all on same scale
 * - Results in typical efficiency values of 0-100% (clamped at boundaries)
 */

/**
 * Calculate actual return as % of premium (entry price * contracts)
 * @param actualPL - Realized profit/loss in dollars
 * @param entryPrice - Entry price per contract
 * @param contracts - Number of contracts
 * @returns Actual return as percentage of premium
 */
export function pctOfPremium(
  actualPL: number,
  entryPrice: number,
  contracts: number
): number {
  const premium = entryPrice * contracts;
  if (premium === 0) return 0;
  return (actualPL / premium) * 100;
}

/**
 * Calculate maximum favorable excursion (MFE) as % of premium
 * @param maxPrice - Highest price reached in trade
 * @param entryPrice - Entry price per contract
 * @param contracts - Number of contracts
 * @returns MFE as percentage of premium
 */
export function mfePercent(
  maxPrice: number,
  entryPrice: number,
  contracts: number
): number {
  const premium = entryPrice * contracts;
  if (premium === 0) return 0;
  const maxProfit = (maxPrice - entryPrice) * contracts;
  return (maxProfit / premium) * 100;
}

/**
 * Calculate maximum adverse excursion (MAE) as % of premium
 * @param minPrice - Lowest price reached in trade
 * @param entryPrice - Entry price per contract
 * @param contracts - Number of contracts
 * @returns MAE as percentage of premium (absolute value)
 */
export function maePercent(
  minPrice: number,
  entryPrice: number,
  contracts: number
): number {
  const premium = entryPrice * contracts;
  if (premium === 0) return 0;
  const maxLoss = Math.abs((minPrice - entryPrice) * contracts);
  return (maxLoss / premium) * 100;
}

/**
 * Calculate efficiency as (actual / mfe) * 100
 * Clamped to 0-100% to represent how much of the maximum profit was captured
 * @param actualPct - Actual return as percentage
 * @param mfePct - Maximum favorable excursion as percentage
 * @returns Efficiency percentage (0-100), or 0 if MFE is 0 or negative
 */
export function efficiencyPct(actualPct: number, mfePct: number): number {
  if (mfePct <= 0) return 0;
  if (actualPct < 0) return 0; // No efficiency if trade was a loss
  
  const efficiency = (actualPct / mfePct) * 100;
  return clampPct(efficiency);
}

/**
 * Clamp a percentage value to 0-100%
 * @param value - Percentage value to clamp
 * @returns Clamped value between 0 and 100
 */
export function clampPct(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

/**
 * Validate that a set of efficiency values is reasonable
 * Warns if any efficiency > 100% (suggests data/basis mismatch)
 * @param efficiencies - Array of efficiency percentages
 * @param context - Optional context string for debugging
 * @returns true if all values are <= 100%, false otherwise
 */
export function validateEfficiencies(
  efficiencies: number[],
  context: string = 'Unknown'
): boolean {
  const invalid = efficiencies.filter((e) => e > 100);
  if (invalid.length > 0) {
    console.warn(
      `[TP Optimizer] Efficiency validation warning in ${context}: ${invalid.length} / ${efficiencies.length} values exceed 100%`,
      `Max: ${Math.max(...invalid).toFixed(2)}%`
    );
    return false;
  }
  return true;
}

/**
 * Calculate missed profit as (MFE - actual)
 * @param mfePct - Maximum favorable excursion as percentage
 * @param actualPct - Actual return as percentage
 * @returns Missed profit percentage
 */
export function missedProfitPct(mfePct: number, actualPct: number): number {
  return Math.max(0, mfePct - actualPct);
}

/**
 * Calculate win rate
 * @param trades - Array of actual return percentages
 * @returns Win rate as percentage (0-100)
 */
export function winRatePct(trades: number[]): number {
  if (trades.length === 0) return 0;
  const winners = trades.filter((t) => t > 0).length;
  return (winners / trades.length) * 100;
}
