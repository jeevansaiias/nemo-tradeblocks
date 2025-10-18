import { Trade } from '@/lib/models/trade'
import { computeTotalMaxProfit, computeTotalMaxLoss, computeTotalPremium, type EfficiencyBasis } from '@/lib/metrics/trade-efficiency'

/**
 * Data point for a single trade's MFE/MAE metrics
 */
export interface MFEMAEDataPoint {
  tradeNumber: number
  date: Date
  strategy: string

  // Raw values (normalized)
  mfe: number // Maximum Favorable Excursion (total max profit)
  mae: number // Maximum Adverse Excursion (total max loss)
  pl: number // Realized P&L

  // Percentage values (normalized by denominator)
  mfePercent?: number
  maePercent?: number
  plPercent?: number

  // Efficiency metrics
  profitCapturePercent?: number // (pl / mfe) * 100 - what % of peak profit was captured
  excursionRatio?: number // mfe / mae - reward-to-risk ratio

  // Context
  denominator?: number
  basis: EfficiencyBasis
  isWinner: boolean
  marginReq: number
  premium?: number

  // Trade details for tooltips
  openingPrice: number
  closingPrice?: number
  numContracts: number
}

/**
 * Aggregated MFE/MAE statistics
 */
export interface MFEMAEStats {
  avgMFEPercent: number
  avgMAEPercent: number
  avgProfitCapturePercent: number
  avgExcursionRatio: number

  winnerAvgProfitCapture: number
  loserAvgProfitCapture: number

  medianMFEPercent: number
  medianMAEPercent: number

  totalTrades: number
  tradesWithMFE: number
  tradesWithMAE: number
}

/**
 * Distribution bucket for histograms
 */
export interface DistributionBucket {
  bucket: string
  mfeCount: number
  maeCount: number
  range: [number, number]
}

/**
 * Calculates MFE/MAE metrics for a single trade
 */
export function calculateTradeExcursionMetrics(trade: Trade, tradeNumber: number): MFEMAEDataPoint | null {
  const totalMFE = computeTotalMaxProfit(trade)
  const totalMAE = computeTotalMaxLoss(trade)

  // Skip trades without excursion data
  if (!totalMFE && !totalMAE) {
    return null
  }

  // Determine denominator for percentage calculations
  const totalPremium = computeTotalPremium(trade)
  const margin = typeof trade.marginReq === 'number' && isFinite(trade.marginReq) && trade.marginReq !== 0
    ? Math.abs(trade.marginReq)
    : undefined

  let denominator: number | undefined
  let basis: EfficiencyBasis = 'unknown'

  if (totalPremium && totalPremium > 0) {
    denominator = totalPremium
    basis = 'premium'
  } else if (totalMFE && totalMFE > 0) {
    denominator = totalMFE
    basis = 'maxProfit'
  } else if (margin && margin > 0) {
    denominator = margin
    basis = 'margin'
  }

  const dataPoint: MFEMAEDataPoint = {
    tradeNumber,
    date: trade.dateOpened,
    strategy: trade.strategy || 'Unknown',
    mfe: totalMFE || 0,
    mae: totalMAE || 0,
    pl: trade.pl,
    isWinner: trade.pl > 0,
    marginReq: trade.marginReq,
    premium: totalPremium,
    basis,
    openingPrice: trade.openingPrice,
    closingPrice: trade.closingPrice,
    numContracts: trade.numContracts,
  }

  // Calculate percentages if we have a denominator
  if (denominator && denominator > 0) {
    dataPoint.denominator = denominator

    if (totalMFE) {
      dataPoint.mfePercent = (totalMFE / denominator) * 100
    }
    if (totalMAE) {
      dataPoint.maePercent = (totalMAE / denominator) * 100
    }
    dataPoint.plPercent = (trade.pl / denominator) * 100
  }

  // Profit capture: what % of max profit was actually captured
  if (totalMFE && totalMFE > 0) {
    dataPoint.profitCapturePercent = (trade.pl / totalMFE) * 100
  }

  // Excursion ratio: reward/risk
  if (totalMFE && totalMAE && totalMAE > 0) {
    dataPoint.excursionRatio = totalMFE / totalMAE
  }

  return dataPoint
}

/**
 * Processes all trades to generate MFE/MAE data points
 */
export function calculateMFEMAEData(trades: Trade[]): MFEMAEDataPoint[] {
  const dataPoints: MFEMAEDataPoint[] = []

  trades.forEach((trade, index) => {
    const point = calculateTradeExcursionMetrics(trade, index + 1)
    if (point) {
      dataPoints.push(point)
    }
  })

  return dataPoints
}

/**
 * Calculates aggregate statistics from MFE/MAE data points
 */
export function calculateMFEMAEStats(dataPoints: MFEMAEDataPoint[]): MFEMAEStats | null {
  if (dataPoints.length === 0) {
    return null
  }

  const withMFE = dataPoints.filter(d => d.mfe > 0)
  const withMAE = dataPoints.filter(d => d.mae > 0)
  const withMFEPercent = dataPoints.filter(d => d.mfePercent !== undefined)
  const withMAEPercent = dataPoints.filter(d => d.maePercent !== undefined)
  const withProfitCapture = dataPoints.filter(d => d.profitCapturePercent !== undefined)
  const withExcursionRatio = dataPoints.filter(d => d.excursionRatio !== undefined)

  const winners = withProfitCapture.filter(d => d.isWinner)
  const losers = withProfitCapture.filter(d => !d.isWinner)

  // Helper to calculate median
  const median = (values: number[]): number => {
    if (values.length === 0) return 0
    const sorted = [...values].sort((a, b) => a - b)
    const mid = Math.floor(sorted.length / 2)
    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid]
  }

  return {
    avgMFEPercent: withMFEPercent.length > 0
      ? withMFEPercent.reduce((sum, d) => sum + (d.mfePercent || 0), 0) / withMFEPercent.length
      : 0,
    avgMAEPercent: withMAEPercent.length > 0
      ? withMAEPercent.reduce((sum, d) => sum + (d.maePercent || 0), 0) / withMAEPercent.length
      : 0,
    avgProfitCapturePercent: withProfitCapture.length > 0
      ? withProfitCapture.reduce((sum, d) => sum + (d.profitCapturePercent || 0), 0) / withProfitCapture.length
      : 0,
    avgExcursionRatio: withExcursionRatio.length > 0
      ? withExcursionRatio.reduce((sum, d) => sum + (d.excursionRatio || 0), 0) / withExcursionRatio.length
      : 0,
    winnerAvgProfitCapture: winners.length > 0
      ? winners.reduce((sum, d) => sum + (d.profitCapturePercent || 0), 0) / winners.length
      : 0,
    loserAvgProfitCapture: losers.length > 0
      ? losers.reduce((sum, d) => sum + (d.profitCapturePercent || 0), 0) / losers.length
      : 0,
    medianMFEPercent: median(withMFEPercent.map(d => d.mfePercent || 0)),
    medianMAEPercent: median(withMAEPercent.map(d => d.maePercent || 0)),
    totalTrades: dataPoints.length,
    tradesWithMFE: withMFE.length,
    tradesWithMAE: withMAE.length,
  }
}

/**
 * Creates distribution buckets for histogram visualization
 */
export function createExcursionDistribution(
  dataPoints: MFEMAEDataPoint[],
  bucketSize: number = 10
): DistributionBucket[] {
  const mfeValues = dataPoints.filter(d => d.mfePercent !== undefined).map(d => d.mfePercent!)
  const maeValues = dataPoints.filter(d => d.maePercent !== undefined).map(d => d.maePercent!)

  if (mfeValues.length === 0 && maeValues.length === 0) {
    return []
  }

  const allValues = [...mfeValues, ...maeValues]
  const maxValue = Math.max(...allValues)
  const numBuckets = Math.ceil(maxValue / bucketSize)

  const buckets: DistributionBucket[] = []

  for (let i = 0; i < numBuckets; i++) {
    const rangeStart = i * bucketSize
    const rangeEnd = (i + 1) * bucketSize

    const mfeCount = mfeValues.filter(v => v >= rangeStart && v < rangeEnd).length
    const maeCount = maeValues.filter(v => v >= rangeStart && v < rangeEnd).length

    buckets.push({
      bucket: `${rangeStart}-${rangeEnd}%`,
      mfeCount,
      maeCount,
      range: [rangeStart, rangeEnd]
    })
  }

  return buckets
}
