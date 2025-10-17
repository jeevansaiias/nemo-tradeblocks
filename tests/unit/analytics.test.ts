/**
 * Unit Tests for Returns & Efficiency Analytics
 * Tests with 3 synthetic trades to verify math consistency
 */

import {
  pctOfPremium,
  mfePercent,
  maePercent,
  efficiencyPct,
  clampPct,
  missedProfitPct,
  winRatePct,
} from '@/lib/analytics/returns';
import { fmt } from '@/lib/analytics/format';

/**
 * Synthetic test data: 3 trades with known outcomes
 * 
 * Trade 1: Win with good execution
 * - Entry: $100/contract, 1 contract
 * - Premium: $100
 * - Max price: $105 (MFE = 5%)
 * - Exit: $103 (Actual = 3%)
 * - Efficiency: 60%
 * 
 * Trade 2: Loss with contained downside
 * - Entry: $100/contract, 1 contract
 * - Premium: $100
 * - Min price: $95 (MAE = 5%)
 * - Exit: $98 (Actual = -2%)
 * - Efficiency: 0% (loss)
 * 
 * Trade 3: Win with excellent execution
 * - Entry: $50/contract, 2 contracts
 * - Premium: $100
 * - Max price: $57 (MFE = 28%)
 * - Exit: $55 (Actual = 20%)
 * - Efficiency: 71.43%
 */

describe('Returns Analytics', () => {
  test('Trade 1: Win with good execution', () => {
    const entry = 100;
    const contracts = 1;
    const maxPrice = 105;
    const exitPrice = 103;
    const actualPL = (exitPrice - entry) * contracts;

    const mfe = mfePercent(maxPrice, entry, contracts);
    const actual = pctOfPremium(actualPL, entry, contracts);
    const efficiency = efficiencyPct(actual, mfe);

    expect(mfe).toBeCloseTo(5, 1);
    expect(actual).toBeCloseTo(3, 1);
    expect(efficiency).toBeCloseTo(60, 1);
  });

  test('Trade 2: Loss with contained downside', () => {
    const entry = 100;
    const contracts = 1;
    const minPrice = 95;
    const exitPrice = 98;
    const actualPL = (exitPrice - entry) * contracts;

    const mae = maePercent(minPrice, entry, contracts);
    const actual = pctOfPremium(actualPL, entry, contracts);
    const efficiency = efficiencyPct(actual, 5); // Hypothetical MFE

    expect(mae).toBeCloseTo(5, 1);
    expect(actual).toBeCloseTo(-2, 1);
    expect(efficiency).toBe(0); // Loss -> 0% efficiency
  });

  test('Trade 3: Win with excellent execution (multi-leg)', () => {
    const entry = 50;
    const contracts = 2;
    const premium = entry * contracts; // 100
    const maxPrice = 57;
    const exitPrice = 55;
    const actualPL = (exitPrice - entry) * contracts; // 10

    const mfe = mfePercent(maxPrice, entry, contracts);
    const actual = pctOfPremium(actualPL, entry, contracts);
    const efficiency = efficiencyPct(actual, mfe);

    expect(mfe).toBeCloseTo(28, 1);
    expect(actual).toBeCloseTo(10, 1);
    expect(efficiency).toBeCloseTo(35.71, 1); // 10/28 * 100
  });

  test('Aggregated metrics: 3-trade portfolio', () => {
    const actuals = [3, -2, 10]; // Trade results as % of premium
    const mfes = [5, 5, 28];

    const efficiencies = actuals.map((a, i) => efficiencyPct(a, mfes[i]));
    const winRate = winRatePct(actuals);
    const avgEfficiency = efficiencies.reduce((a, b) => a + b, 0) / efficiencies.length;

    expect(efficiencies[0]).toBeCloseTo(60, 1);
    expect(efficiencies[1]).toBe(0);
    expect(efficiencies[2]).toBeCloseTo(35.71, 1);
    expect(winRate).toBeCloseTo(66.67, 1); // 2/3
    expect(avgEfficiency).toBeCloseTo(31.9, 1);
  });

  test('Clamping: efficiency never exceeds 100%', () => {
    // Even if actual > MFE (shouldn't happen, but let's test)
    const efficiency = efficiencyPct(120, 100);
    expect(efficiency).toBe(100); // Clamped
  });

  test('Clamping: negative efficiency -> 0%', () => {
    const efficiency = efficiencyPct(-10, 50);
    expect(efficiency).toBe(0);
  });

  test('Edge case: zero MFE -> 0% efficiency', () => {
    const efficiency = efficiencyPct(5, 0);
    expect(efficiency).toBe(0);
  });

  test('Missed profit calculation', () => {
    const missed = missedProfitPct(5, 3);
    expect(missed).toBeCloseTo(2, 1);

    const missedLoss = missedProfitPct(5, -2);
    expect(missedLoss).toBeCloseTo(7, 1);
  });
});

describe('Number Formatting', () => {
  test('pct2 formats percentages with 2 decimals', () => {
    expect(fmt.pct2(58.599)).toBe('58.60%');
    expect(fmt.pct2(0)).toBe('0.00%');
    expect(fmt.pct2(100)).toBe('100.00%');
  });

  test('int formats integers', () => {
    expect(fmt.int(2725.7)).toBe('2726');
    expect(fmt.int(10.1)).toBe('10');
  });

  test('k0 formats with thousand separators', () => {
    expect(fmt.k0(2725)).toBe('2,725');
    expect(fmt.k0(1000000)).toBe('1,000,000');
  });
});
