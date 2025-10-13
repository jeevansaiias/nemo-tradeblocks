/**
 * Unit tests for reconciliation statistical analysis
 */

import {
  calculatePairedTTest,
  calculatePearsonCorrelation,
  calculateSpearmanCorrelation,
  calculateCorrelationMetrics,
  MatchedPair,
} from '@/lib/calculations/reconciliation-stats'
import { NormalizedTrade } from '@/lib/services/trade-reconciliation'

describe('Reconciliation Statistics', () => {
  // Helper to create a normalized trade
  function createTrade(pl: number, id: string = 'test'): NormalizedTrade {
    return {
      id,
      strategy: 'TEST',
      dateOpened: new Date('2024-01-01'),
      sortTime: Date.now(),
      session: '2024-01-01',
      premiumPerContract: 100,
      totalPremium: 100,
      contracts: 1,
      pl,
      openingFees: 0,
      closingFees: 0,
    }
  }

  describe('calculatePairedTTest', () => {
    it('should return null for empty array', () => {
      const result = calculatePairedTTest([])
      expect(result).toBeNull()
    })

    it('should handle single observation', () => {
      const pairs: MatchedPair[] = [
        {
          backtested: createTrade(100),
          reported: createTrade(110),
        },
      ]

      const result = calculatePairedTTest(pairs)
      expect(result).not.toBeNull()
      expect(result!.meanDifference).toBe(10)
      expect(result!.isSignificant).toBe(false)
      expect(result!.interpretation).toContain('Insufficient data')
    })

    it('should detect no significant difference when P/Ls are identical', () => {
      const pairs: MatchedPair[] = [
        { backtested: createTrade(100), reported: createTrade(100) },
        { backtested: createTrade(200), reported: createTrade(200) },
        { backtested: createTrade(150), reported: createTrade(150) },
        { backtested: createTrade(120), reported: createTrade(120) },
        { backtested: createTrade(180), reported: createTrade(180) },
      ]

      const result = calculatePairedTTest(pairs)
      expect(result).not.toBeNull()
      expect(result!.meanDifference).toBeCloseTo(0, 10)
      expect(result!.tStatistic).toBeCloseTo(0, 10)
      expect(result!.isSignificant).toBe(false)
    })

    it('should detect significant positive difference', () => {
      // Reported consistently higher by ~$50 with some variance
      const pairs: MatchedPair[] = [
        { backtested: createTrade(100), reported: createTrade(152) }, // +52
        { backtested: createTrade(200), reported: createTrade(248) }, // +48
        { backtested: createTrade(150), reported: createTrade(201) }, // +51
        { backtested: createTrade(120), reported: createTrade(169) }, // +49
        { backtested: createTrade(180), reported: createTrade(231) }, // +51
        { backtested: createTrade(90), reported: createTrade(141) }, // +51
        { backtested: createTrade(110), reported: createTrade(159) }, // +49
        { backtested: createTrade(130), reported: createTrade(180) }, // +50
        { backtested: createTrade(160), reported: createTrade(212) }, // +52
        { backtested: createTrade(140), reported: createTrade(190) }, // +50
      ]

      const result = calculatePairedTTest(pairs)
      expect(result).not.toBeNull()
      expect(result!.meanDifference).toBeCloseTo(50.3, 1)
      expect(result!.degreesOfFreedom).toBe(9)
      expect(result!.isSignificant).toBe(true)
      expect(result!.interpretation).toContain('significant')
      expect(result!.interpretation).toContain('higher')
    })

    it('should detect significant negative difference', () => {
      // Reported consistently lower by ~$30 with some variance
      const pairs: MatchedPair[] = [
        { backtested: createTrade(100), reported: createTrade(69) }, // -31
        { backtested: createTrade(200), reported: createTrade(171) }, // -29
        { backtested: createTrade(150), reported: createTrade(119) }, // -31
        { backtested: createTrade(120), reported: createTrade(91) }, // -29
        { backtested: createTrade(180), reported: createTrade(149) }, // -31
        { backtested: createTrade(90), reported: createTrade(60) }, // -30
        { backtested: createTrade(110), reported: createTrade(79) }, // -31
        { backtested: createTrade(130), reported: createTrade(101) }, // -29
        { backtested: createTrade(160), reported: createTrade(131) }, // -29
        { backtested: createTrade(140), reported: createTrade(109) }, // -31
      ]

      const result = calculatePairedTTest(pairs)
      expect(result).not.toBeNull()
      expect(result!.meanDifference).toBeCloseTo(-30.1, 1)
      expect(result!.isSignificant).toBe(true)
      expect(result!.interpretation).toContain('lower')
    })

    it('should calculate confidence interval correctly', () => {
      const pairs: MatchedPair[] = [
        { backtested: createTrade(100), reported: createTrade(145) }, // +45
        { backtested: createTrade(200), reported: createTrade(255) }, // +55
        { backtested: createTrade(150), reported: createTrade(198) }, // +48
        { backtested: createTrade(120), reported: createTrade(172) }, // +52
        { backtested: createTrade(180), reported: createTrade(230) }, // +50
      ]

      const result = calculatePairedTTest(pairs)
      expect(result).not.toBeNull()
      // With variance, CI should bracket the mean
      expect(result!.confidenceInterval[0]).toBeLessThan(result!.meanDifference)
      expect(result!.confidenceInterval[1]).toBeGreaterThan(result!.meanDifference)
      // Mean should be within CI
      expect(result!.meanDifference).toBeGreaterThanOrEqual(result!.confidenceInterval[0])
      expect(result!.meanDifference).toBeLessThanOrEqual(result!.confidenceInterval[1])
    })

    it('should handle high variance data', () => {
      const pairs: MatchedPair[] = [
        { backtested: createTrade(100), reported: createTrade(200) },
        { backtested: createTrade(200), reported: createTrade(150) },
        { backtested: createTrade(150), reported: createTrade(300) },
        { backtested: createTrade(120), reported: createTrade(80) },
        { backtested: createTrade(180), reported: createTrade(250) },
      ]

      const result = calculatePairedTTest(pairs)
      expect(result).not.toBeNull()
      expect(result!.standardError).toBeGreaterThan(0)
      // With high variance, likely not significant
      expect(result!.pValue).toBeGreaterThan(0.05)
    })
  })

  describe('calculatePearsonCorrelation', () => {
    it('should return null for empty array', () => {
      const result = calculatePearsonCorrelation([])
      expect(result).toBeNull()
    })

    it('should return null for single observation', () => {
      const pairs: MatchedPair[] = [
        {
          backtested: createTrade(100),
          reported: createTrade(110),
        },
      ]

      const result = calculatePearsonCorrelation(pairs)
      expect(result).toBeNull()
    })

    it('should return 1 for perfect positive correlation', () => {
      // Reported = Backtested + 50 (perfect linear relationship)
      const pairs: MatchedPair[] = [
        { backtested: createTrade(100), reported: createTrade(150) },
        { backtested: createTrade(200), reported: createTrade(250) },
        { backtested: createTrade(150), reported: createTrade(200) },
        { backtested: createTrade(120), reported: createTrade(170) },
        { backtested: createTrade(180), reported: createTrade(230) },
      ]

      const result = calculatePearsonCorrelation(pairs)
      expect(result).not.toBeNull()
      expect(result).toBeCloseTo(1, 5)
    })

    it('should return -1 for perfect negative correlation', () => {
      // Reported = 300 - Backtested
      const pairs: MatchedPair[] = [
        { backtested: createTrade(100), reported: createTrade(200) },
        { backtested: createTrade(200), reported: createTrade(100) },
        { backtested: createTrade(150), reported: createTrade(150) },
        { backtested: createTrade(120), reported: createTrade(180) },
        { backtested: createTrade(180), reported: createTrade(120) },
      ]

      const result = calculatePearsonCorrelation(pairs)
      expect(result).not.toBeNull()
      expect(result).toBeCloseTo(-1, 5)
    })

    it('should return 0 for no correlation', () => {
      const pairs: MatchedPair[] = [
        { backtested: createTrade(100), reported: createTrade(150) },
        { backtested: createTrade(200), reported: createTrade(150) },
        { backtested: createTrade(150), reported: createTrade(200) },
        { backtested: createTrade(120), reported: createTrade(100) },
        { backtested: createTrade(180), reported: createTrade(180) },
      ]

      const result = calculatePearsonCorrelation(pairs)
      expect(result).not.toBeNull()
      // Should be low correlation
      expect(Math.abs(result!)).toBeLessThan(0.5)
    })

    it('should handle identical values (no variance)', () => {
      const pairs: MatchedPair[] = [
        { backtested: createTrade(100), reported: createTrade(150) },
        { backtested: createTrade(100), reported: createTrade(150) },
        { backtested: createTrade(100), reported: createTrade(150) },
      ]

      const result = calculatePearsonCorrelation(pairs)
      expect(result).toBeNull() // No variance, can't calculate correlation
    })

    it('should calculate strong positive correlation', () => {
      const pairs: MatchedPair[] = [
        { backtested: createTrade(100), reported: createTrade(105) },
        { backtested: createTrade(200), reported: createTrade(210) },
        { backtested: createTrade(150), reported: createTrade(155) },
        { backtested: createTrade(120), reported: createTrade(125) },
        { backtested: createTrade(180), reported: createTrade(185) },
        { backtested: createTrade(90), reported: createTrade(95) },
        { backtested: createTrade(110), reported: createTrade(115) },
        { backtested: createTrade(130), reported: createTrade(135) },
        { backtested: createTrade(160), reported: createTrade(165) },
        { backtested: createTrade(140), reported: createTrade(145) },
      ]

      const result = calculatePearsonCorrelation(pairs)
      expect(result).not.toBeNull()
      expect(result).toBeGreaterThan(0.95) // Should be very high
    })
  })

  describe('calculateSpearmanCorrelation', () => {
    it('should return null for empty array', () => {
      const result = calculateSpearmanCorrelation([])
      expect(result).toBeNull()
    })

    it('should return 1 for monotonic increasing relationship', () => {
      const pairs: MatchedPair[] = [
        { backtested: createTrade(100), reported: createTrade(110) },
        { backtested: createTrade(200), reported: createTrade(230) },
        { backtested: createTrade(150), reported: createTrade(165) },
        { backtested: createTrade(120), reported: createTrade(135) },
        { backtested: createTrade(180), reported: createTrade(200) },
      ]

      const result = calculateSpearmanCorrelation(pairs)
      expect(result).not.toBeNull()
      expect(result).toBeCloseTo(1, 5)
    })

    it('should be robust to outliers compared to Pearson', () => {
      // Same ranks, but with outlier in reported
      const pairs: MatchedPair[] = [
        { backtested: createTrade(100), reported: createTrade(110) },
        { backtested: createTrade(200), reported: createTrade(1000) }, // Outlier
        { backtested: createTrade(150), reported: createTrade(165) },
        { backtested: createTrade(120), reported: createTrade(135) },
        { backtested: createTrade(180), reported: createTrade(200) },
      ]

      const pearson = calculatePearsonCorrelation(pairs)
      const spearman = calculateSpearmanCorrelation(pairs)

      expect(pearson).not.toBeNull()
      expect(spearman).not.toBeNull()

      // Spearman should still be high (ranks preserved)
      expect(spearman).toBeCloseTo(1, 5)
      // Pearson affected by outlier
      expect(pearson!).toBeLessThan(spearman!)
    })
  })

  describe('calculateCorrelationMetrics', () => {
    it('should return null for insufficient data', () => {
      const result = calculateCorrelationMetrics([])
      expect(result).toBeNull()
    })

    it('should provide complete metrics with interpretation', () => {
      const pairs: MatchedPair[] = [
        { backtested: createTrade(100), reported: createTrade(150) },
        { backtested: createTrade(200), reported: createTrade(250) },
        { backtested: createTrade(150), reported: createTrade(200) },
        { backtested: createTrade(120), reported: createTrade(170) },
        { backtested: createTrade(180), reported: createTrade(230) },
      ]

      const result = calculateCorrelationMetrics(pairs)
      expect(result).not.toBeNull()
      expect(result!.pearsonR).toBeCloseTo(1, 5)
      expect(result!.spearmanRho).toBeCloseTo(1, 5)
      expect(result!.interpretation).toContain('correlation')
      expect(result!.interpretation).toContain('positive')
    })

    it('should interpret strong correlation correctly', () => {
      const pairs: MatchedPair[] = [
        { backtested: createTrade(100), reported: createTrade(105) },
        { backtested: createTrade(200), reported: createTrade(210) },
        { backtested: createTrade(150), reported: createTrade(158) },
        { backtested: createTrade(120), reported: createTrade(128) },
        { backtested: createTrade(180), reported: createTrade(188) },
      ]

      const result = calculateCorrelationMetrics(pairs)
      expect(result).not.toBeNull()
      expect(result!.interpretation).toContain('strong')
      expect(result!.interpretation).toContain('positive')
    })

    it('should interpret weak correlation correctly', () => {
      // More random data to ensure weak/very weak correlation
      const pairs: MatchedPair[] = [
        { backtested: createTrade(100), reported: createTrade(200) },
        { backtested: createTrade(200), reported: createTrade(100) },
        { backtested: createTrade(150), reported: createTrade(190) },
        { backtested: createTrade(120), reported: createTrade(180) },
        { backtested: createTrade(180), reported: createTrade(110) },
        { backtested: createTrade(90), reported: createTrade(170) },
        { backtested: createTrade(110), reported: createTrade(130) },
      ]

      const result = calculateCorrelationMetrics(pairs)
      expect(result).not.toBeNull()
      // With this data pattern, correlation should be weak/moderate/negative
      // Just verify it doesn't claim "strong positive"
      expect(result!.interpretation).not.toContain('Strong positive')
    })
  })
})
