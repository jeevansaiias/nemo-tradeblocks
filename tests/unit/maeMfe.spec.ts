/**
 * Unit tests for MAE/MFE analytics module
 * 
 * Tests cover:
 * - Mixed input scales (decimals 0-1 and percentages 0-100+)
 * - Edge cases (zero MFE, negative values, perfect/zero efficiency)
 * - Identical outputs for same trades via both entry points
 * - Win predicate logic
 * - Aggregation consistency
 */

import {
  normalizePercent,
  isWin,
  computeMaeMfe,
  computeEfficiency,
  computeTradeMetrics,
  aggregateByExitReason,
  aggregateTopline,
  sanityCheckTopline,
  formatDecimalPercent,
  Trade,
} from '@/lib/analytics/maeMfe';

describe('maeMfe Analytics', () => {
  describe('normalizePercent', () => {
    it('should handle already-decimal values', () => {
      expect(normalizePercent(0.25)).toBeCloseTo(0.25);
      expect(normalizePercent(0.5867)).toBeCloseTo(0.5867);
      expect(normalizePercent(0.99)).toBeCloseTo(0.99);
    });

    it('should convert percentage values to decimal', () => {
      expect(normalizePercent(25)).toBeCloseTo(0.25);
      expect(normalizePercent(58.67)).toBeCloseTo(0.5867);
      expect(normalizePercent(134.58)).toBeCloseTo(1.3458);
    });

    it('should handle edge cases near boundary', () => {
      // Values >= 2.0 are treated as percent; < 2.0 as decimal
      expect(normalizePercent(2.0)).toBeCloseTo(0.02);      // 2.0 >= 2.0 -> percent
      expect(normalizePercent(1.99)).toBeCloseTo(1.99);     // 1.99 < 2.0 -> decimal
      expect(normalizePercent(2.01)).toBeCloseTo(0.0201);   // 2.01 >= 2.0 -> percent
    });

    it('should handle null/undefined', () => {
      expect(normalizePercent(null)).toBe(0);
      expect(normalizePercent(undefined)).toBe(0);
      expect(normalizePercent(null, 0.5)).toBe(0.5);
    });

    it('should handle negative values', () => {
      expect(normalizePercent(-0.25)).toBeCloseTo(-0.25);
      expect(normalizePercent(-25)).toBeCloseTo(-0.25);
      expect(normalizePercent(-134.58)).toBeCloseTo(-1.3458);
    });

    it('should handle NaN/Infinity', () => {
      expect(normalizePercent(NaN)).toBe(0);
      expect(normalizePercent(Infinity)).toBe(0);
    });
  });

  describe('isWin', () => {
    it('should use plNet if available', () => {
      const winTrade: Trade = { trade_id: '1', strategy: 'S1', plNet: 100 };
      const lossTrade: Trade = { trade_id: '2', strategy: 'S1', plNet: -50 };

      expect(isWin(winTrade)).toBe(true);
      expect(isWin(lossTrade)).toBe(false);
    });

    it('should fall back to actual_pct', () => {
      const winTrade: Trade = { trade_id: '1', strategy: 'S1', actual_pct: 0.25 };
      const lossTrade: Trade = { trade_id: '2', strategy: 'S1', actual_pct: -0.10 };

      expect(isWin(winTrade)).toBe(true);
      expect(isWin(lossTrade)).toBe(false);
    });

    it('should fall back to actual_pct in percent scale', () => {
      const winTrade: Trade = { trade_id: '1', strategy: 'S1', actual_pct: 25 };
      const lossTrade: Trade = { trade_id: '2', strategy: 'S1', actual_pct: -10 };

      expect(isWin(winTrade)).toBe(true);
      expect(isWin(lossTrade)).toBe(false);
    });

    it('should return false for zero/undefined', () => {
      const breakeven: Trade = { trade_id: '1', strategy: 'S1', actual_pct: 0 };
      const unknown: Trade = { trade_id: '2', strategy: 'S1' };

      expect(isWin(breakeven)).toBe(false);
      expect(isWin(unknown)).toBe(false);
    });
  });

  describe('computeEfficiency', () => {
    it('should compute ratio when MFE > 0', () => {
      expect(computeEfficiency(0.25, 0.50)).toBeCloseTo(0.5);
      expect(computeEfficiency(0.50, 0.50)).toBeCloseTo(1.0);
      expect(computeEfficiency(0.75, 0.50)).toBeCloseTo(1.5);
    });

    it('should handle zero MFE safely', () => {
      expect(computeEfficiency(0, 0)).toBe(0);
      expect(computeEfficiency(0.25, 0)).toBe(1.0); // Profit with no MFE = perfect
      expect(computeEfficiency(-0.10, 0)).toBe(0); // Loss with no MFE = zero
    });

    it('should handle negative values', () => {
      expect(computeEfficiency(-0.10, 0.50)).toBeCloseTo(-0.2);
      expect(computeEfficiency(-0.50, 0.50)).toBeCloseTo(-1.0);
    });
  });

  describe('computeMaeMfe', () => {
    it('should normalize mixed scales', () => {
      const trade: Trade = {
        trade_id: '1',
        strategy: 'S1',
        mae_pct: 25,        // percent scale
        mfe_pct: 0.50,      // decimal scale
        actual_pct: 40,     // percent scale
        missed_profit_pct: 0.10, // decimal scale
      };

      const result = computeMaeMfe(trade);

      expect(result.maeDec).toBeCloseTo(0.25);
      expect(result.mfeDec).toBeCloseTo(0.50);
      expect(result.actualExitDec).toBeCloseTo(0.40);
      expect(result.missedProfitDec).toBeCloseTo(0.10);
    });
  });

  describe('computeTradeMetrics', () => {
    it('should compute all metrics for a single trade', () => {
      const trade: Trade = {
        trade_id: 'T1',
        strategy: 'Strategy-A',
        exit_reason: 'TP',
        actual_pct: 0.30,
        mfe_pct: 0.50,
        mae_pct: 0.10,
        missed_profit_pct: 0.20,
        plNet: 100,
      };

      const metrics = computeTradeMetrics(trade);

      expect(metrics.trade_id).toBe('T1');
      expect(metrics.strategy).toBe('Strategy-A');
      expect(metrics.exit_reason).toBe('TP');
      expect(metrics.actualExitDec).toBeCloseTo(0.30);
      expect(metrics.mfeDec).toBeCloseTo(0.50);
      expect(metrics.maeDec).toBeCloseTo(0.10);
      expect(metrics.missedProfitDec).toBeCloseTo(0.20);
      expect(metrics.efficiencyDec).toBeCloseTo(0.60); // 0.30 / 0.50
      expect(metrics.isWin).toBe(true);
    });
  });

  describe('aggregateByExitReason', () => {
    it('should group and aggregate trades by exit reason', () => {
      const trades: Trade[] = [
        { trade_id: 'T1', strategy: 'S1', exit_reason: 'TP', actual_pct: 0.30, mfe_pct: 0.50, mae_pct: 0.05, missed_profit_pct: 0.20, plNet: 100 },
        { trade_id: 'T2', strategy: 'S1', exit_reason: 'TP', actual_pct: 0.40, mfe_pct: 0.50, mae_pct: 0.03, missed_profit_pct: 0.10, plNet: 200 },
        { trade_id: 'T3', strategy: 'S1', exit_reason: 'SL', actual_pct: -0.20, mfe_pct: 0.10, mae_pct: 0.20, missed_profit_pct: 0.30, plNet: -100 },
      ];

      const stats = aggregateByExitReason(trades);

      expect(stats).toHaveLength(2);

      // TP group
      const tp = stats.find((s) => s.exitReason === 'TP')!;
      expect(tp).toBeDefined();
      expect(tp.tradeCount).toBe(2);
      expect(tp.winCount).toBe(2);
      expect(tp.winRateDec).toBeCloseTo(1.0);
      expect(tp.avgMfeDec).toBeCloseTo(0.50);
      expect(tp.avgMaeDec).toBeCloseTo(0.04);
      expect(tp.avgMissedDec).toBeCloseTo(0.15);
      expect(tp.avgEfficiencyDec).toBeCloseTo(0.70); // (0.60 + 0.80) / 2

      // SL group
      const sl = stats.find((s) => s.exitReason === 'SL')!;
      expect(sl).toBeDefined();
      expect(sl.tradeCount).toBe(1);
      expect(sl.winCount).toBe(0);
      expect(sl.winRateDec).toBeCloseTo(0);
    });

    it('should sort by trade count descending', () => {
      const trades: Trade[] = [
        { trade_id: 'T1', strategy: 'S1', exit_reason: 'Rare', actual_pct: 0.10, mfe_pct: 0.20, mae_pct: 0.05, missed_profit_pct: 0.10, plNet: 50 },
        { trade_id: 'T2', strategy: 'S1', exit_reason: 'Common', actual_pct: 0.10, mfe_pct: 0.20, mae_pct: 0.05, missed_profit_pct: 0.10, plNet: 50 },
        { trade_id: 'T3', strategy: 'S1', exit_reason: 'Common', actual_pct: 0.10, mfe_pct: 0.20, mae_pct: 0.05, missed_profit_pct: 0.10, plNet: 50 },
        { trade_id: 'T4', strategy: 'S1', exit_reason: 'Common', actual_pct: 0.10, mfe_pct: 0.20, mae_pct: 0.05, missed_profit_pct: 0.10, plNet: 50 },
      ];

      const stats = aggregateByExitReason(trades);

      expect(stats[0].exitReason).toBe('Common');
      expect(stats[0].tradeCount).toBe(3);
      expect(stats[1].exitReason).toBe('Rare');
      expect(stats[1].tradeCount).toBe(1);
    });
  });

  describe('aggregateTopline', () => {
    it('should compute topline metrics correctly', () => {
      const trades: Trade[] = [
        { trade_id: 'T1', strategy: 'S1', exit_reason: 'TP', actual_pct: 0.30, mfe_pct: 0.50, mae_pct: 0.05, missed_profit_pct: 0.20, plNet: 100 },
        { trade_id: 'T2', strategy: 'S1', exit_reason: 'TP', actual_pct: 0.40, mfe_pct: 0.50, mae_pct: 0.03, missed_profit_pct: 0.10, plNet: 200 },
        { trade_id: 'T3', strategy: 'S2', exit_reason: 'SL', actual_pct: -0.20, mfe_pct: 0.10, mae_pct: 0.20, missed_profit_pct: 0.30, plNet: -100 },
      ];

      const metrics = aggregateTopline(trades);

      expect(metrics.totalTrades).toBe(3);
      expect(metrics.strategies.size).toBe(2);
      expect(metrics.strategies.has('S1')).toBe(true);
      expect(metrics.strategies.has('S2')).toBe(true);
      
      expect(metrics.winRateDec).toBeCloseTo(2 / 3); // 2 wins out of 3
      expect(metrics.avgMfeDec).toBeCloseTo((0.50 + 0.50 + 0.10) / 3);
      expect(metrics.avgMaeDec).toBeCloseTo((0.05 + 0.03 + 0.20) / 3);
      expect(metrics.avgMissedDec).toBeCloseTo((0.20 + 0.10 + 0.30) / 3);
    });

    it('should handle empty trade list', () => {
      const metrics = aggregateTopline([]);

      expect(metrics.totalTrades).toBe(0);
      expect(metrics.strategies.size).toBe(0);
      expect(metrics.winRateDec).toBe(0);
      expect(metrics.avgMfeDec).toBe(0);
    });
  });

  describe('sanityCheckTopline', () => {
    it('should detect identical metrics as passing', () => {
      const trades: Trade[] = [
        { trade_id: 'T1', strategy: 'S1', exit_reason: 'TP', actual_pct: 0.30, mfe_pct: 0.50, mae_pct: 0.05, missed_profit_pct: 0.20, plNet: 100 },
        { trade_id: 'T2', strategy: 'S1', exit_reason: 'SL', actual_pct: -0.10, mfe_pct: 0.20, mae_pct: 0.10, missed_profit_pct: 0.30, plNet: -50 },
      ];

      const metrics1 = aggregateTopline(trades);
      const metrics2 = aggregateTopline(trades);

      const result = sanityCheckTopline(metrics1, metrics2);

      expect(result.allPass).toBe(true);
    });

    it('should detect differing metrics', () => {
      const trades1: Trade[] = [
        { trade_id: 'T1', strategy: 'S1', exit_reason: 'TP', actual_pct: 0.30, mfe_pct: 0.50, mae_pct: 0.05, missed_profit_pct: 0.20, plNet: 100 },
      ];

      const trades2: Trade[] = [
        { trade_id: 'T1', strategy: 'S1', exit_reason: 'TP', actual_pct: 0.30, mfe_pct: 0.50, mae_pct: 0.05, missed_profit_pct: 0.20, plNet: 100 },
        { trade_id: 'T2', strategy: 'S1', exit_reason: 'SL', actual_pct: -0.10, mfe_pct: 0.20, mae_pct: 0.10, missed_profit_pct: 0.30, plNet: -50 },
      ];

      const metrics1 = aggregateTopline(trades1);
      const metrics2 = aggregateTopline(trades2);

      const result = sanityCheckTopline(metrics1, metrics2);

      expect(result.allPass).toBe(false);
      expect(result.checks.totalTradesDiffer).toBe(true);
    });
  });

  describe('formatDecimalPercent', () => {
    it('should format decimals as percentages', () => {
      expect(formatDecimalPercent(0.5867)).toBe('58.67%');
      expect(formatDecimalPercent(0.25)).toBe('25.00%');
      expect(formatDecimalPercent(1.0)).toBe('100.00%');
      expect(formatDecimalPercent(0)).toBe('0.00%');
    });

    it('should handle custom decimal places', () => {
      expect(formatDecimalPercent(0.5867, 1)).toBe('58.7%');
      expect(formatDecimalPercent(0.5867, 3)).toBe('58.670%');
    });

    it('should handle NaN/Infinity', () => {
      expect(formatDecimalPercent(NaN)).toBe('0.00%');
      expect(formatDecimalPercent(Infinity)).toBe('0.00%');
    });
  });

  describe('Cross-route consistency (Manual vs Active-Block)', () => {
    it('should produce identical results for same trades regardless of input scale', () => {
      // Simulate trades coming from different sources with different scales
      const tradesDecimalScale: Trade[] = [
        { trade_id: 'T1', strategy: 'S1', exit_reason: 'TP', actual_pct: 0.30, mfe_pct: 0.50, mae_pct: 0.05, missed_profit_pct: 0.20, plNet: 100 },
        { trade_id: 'T2', strategy: 'S1', exit_reason: 'SL', actual_pct: -0.10, mfe_pct: 0.20, mae_pct: 0.10, missed_profit_pct: 0.30, plNet: -50 },
      ];

      const tradesPercentScale: Trade[] = [
        { trade_id: 'T1', strategy: 'S1', exit_reason: 'TP', actual_pct: 30, mfe_pct: 50, mae_pct: 5, missed_profit_pct: 20, plNet: 100 },
        { trade_id: 'T2', strategy: 'S1', exit_reason: 'SL', actual_pct: -10, mfe_pct: 20, mae_pct: 10, missed_profit_pct: 30, plNet: -50 },
      ];

      const metricsDecimal = aggregateTopline(tradesDecimalScale);
      const metricsPercent = aggregateTopline(tradesPercentScale);

      // Should be identical
      expect(metricsDecimal.totalTrades).toBe(metricsPercent.totalTrades);
      expect(metricsDecimal.winRateDec).toBeCloseTo(metricsPercent.winRateDec);
      expect(metricsDecimal.avgMfeDec).toBeCloseTo(metricsPercent.avgMfeDec);
      expect(metricsDecimal.avgMaeDec).toBeCloseTo(metricsPercent.avgMaeDec);
      expect(metricsDecimal.avgMissedDec).toBeCloseTo(metricsPercent.avgMissedDec);

      // Sanity check should pass
      const check = sanityCheckTopline(metricsDecimal, metricsPercent);
      expect(check.allPass).toBe(true);
    });
  });
});
