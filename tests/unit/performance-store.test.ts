import { describe, it, expect } from '@jest/globals'

import { processChartData } from '../../lib/stores/performance-store'
import { calculateInitialCapital } from '../../lib/processing/capital-calculator'
import { mockTrades } from '../data/mock-trades'
import { mockDailyLogs } from '../data/mock-daily-logs'

describe('performance-store chart data', () => {
  it('uses daily logs to drive drawdown when available', async () => {
    const result = await processChartData(mockTrades, mockDailyLogs)

    const expectedMaxDrawdown = Math.max(
      ...mockDailyLogs.map(log => Math.abs(log.drawdownPct ?? 0))
    )

    const chartMaxDrawdown = Math.min(...result.drawdownData.map(point => point.drawdownPct))

    expect(Math.abs(chartMaxDrawdown)).toBeCloseTo(expectedMaxDrawdown, 3)

    const lastEquityPoint = result.equityCurve[result.equityCurve.length - 1]
    const lastDailyLog = mockDailyLogs[mockDailyLogs.length - 1]

    expect(lastEquityPoint.equity).toBe(lastDailyLog.netLiquidity)
  })

  it('falls back to trade-based equity when daily logs are missing', async () => {
    const result = await processChartData(mockTrades)

    const expectedInitialCapital = calculateInitialCapital(mockTrades)
    const firstPoint = result.equityCurve[0]

    expect(firstPoint.equity).toBe(expectedInitialCapital)
    expect(firstPoint.highWaterMark).toBe(expectedInitialCapital)
  })
})

