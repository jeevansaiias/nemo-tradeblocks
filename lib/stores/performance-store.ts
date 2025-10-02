import { create } from 'zustand'
import { Trade } from '@/lib/models/trade'
import { DailyLogEntry } from '@/lib/models/daily-log'
import { PortfolioStats } from '@/lib/models/portfolio-stats'

export interface DateRange {
  from: Date | undefined
  to: Date | undefined
  preset: 'all' | 'ytd' | '1y' | '6m' | '3m' | '1m'
}

export interface ChartSettings {
  equityScale: 'linear' | 'log'
  showDrawdownAreas: boolean
  showTrend: boolean
  maWindow: number
  rollingMetricType: 'win_rate' | 'sharpe' | 'profit_factor'
}

export interface PerformanceData {
  // Raw data
  trades: Trade[]
  dailyLogs: DailyLogEntry[]

  // Calculated metrics
  portfolioStats: PortfolioStats | null

  // Chart data (processed and ready for visualization)
  equityCurve: Array<{ date: string; equity: number; highWaterMark: number; tradeNumber: number }>
  drawdownData: Array<{ date: string; drawdownPct: number }>
  dayOfWeekData: Array<{ day: string; count: number; avgPl: number }>
  returnDistribution: number[]
  streakData: {
    winDistribution: Record<number, number>
    lossDistribution: Record<number, number>
    statistics: {
      maxWinStreak: number
      maxLossStreak: number
      avgWinStreak: number
      avgLossStreak: number
    }
  }
  monthlyReturns: Record<number, Record<number, number>> // {year: {month: value}}
  tradeSequence: Array<{ tradeNumber: number; pl: number; date: string }>
  romTimeline: Array<{ date: string; rom: number }>
  rollingMetrics: Array<{ date: string; winRate: number; sharpeRatio: number; profitFactor: number; volatility: number }>
}

interface PerformanceStore {
  // State
  isLoading: boolean
  error: string | null

  // Filters
  dateRange: DateRange
  selectedStrategies: string[]

  // Data
  data: PerformanceData | null

  // UI State
  chartSettings: ChartSettings

  // Actions
  setDateRange: (dateRange: DateRange) => void
  setSelectedStrategies: (strategies: string[]) => void
  updateChartSettings: (settings: Partial<ChartSettings>) => void
  fetchPerformanceData: (blockId: string) => Promise<void>
  applyFilters: () => void
  reset: () => void
}

const initialDateRange: DateRange = {
  from: undefined,
  to: undefined,
  preset: 'all'
}

const initialChartSettings: ChartSettings = {
  equityScale: 'linear',
  showDrawdownAreas: true,
  showTrend: true,
  maWindow: 30,
  rollingMetricType: 'win_rate'
}

export const usePerformanceStore = create<PerformanceStore>((set, get) => ({
  // Initial state
  isLoading: false,
  error: null,
  dateRange: initialDateRange,
  selectedStrategies: [],
  data: null,
  chartSettings: initialChartSettings,

  // Actions
  setDateRange: (dateRange) => {
    set({ dateRange })
    get().applyFilters()
  },

  setSelectedStrategies: (selectedStrategies) => {
    set({ selectedStrategies })
    get().applyFilters()
  },

  updateChartSettings: (settings) => {
    set(state => ({
      chartSettings: { ...state.chartSettings, ...settings }
    }))
  },

  fetchPerformanceData: async (blockId: string) => {
    set({ isLoading: true, error: null })

    try {
      // Import here to avoid circular dependencies
      const { getTradesByBlock, getDailyLogsByBlock } = await import('@/lib/db')
      const { PortfolioStatsCalculator } = await import('@/lib/calculations/portfolio-stats')

      // Fetch raw data
      const [trades, dailyLogs] = await Promise.all([
        getTradesByBlock(blockId),
        getDailyLogsByBlock(blockId)
      ])

      // Calculate portfolio stats
      const calculator = new PortfolioStatsCalculator({ riskFreeRate: 2.0 })
      const portfolioStats = calculator.calculatePortfolioStats(trades, dailyLogs, false)

      // Process chart data
      const data = await processChartData(trades)

      set({
        data: {
          trades,
          dailyLogs,
          portfolioStats,
          ...data
        },
        isLoading: false
      })

      get().applyFilters()
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to load performance data',
        isLoading: false
      })
    }
  },

  applyFilters: () => {
    const { data, dateRange, selectedStrategies } = get()
    if (!data) return

    // Apply date range filter
    let filteredTrades = data.trades
    if (dateRange.from && dateRange.to) {
      filteredTrades = filteredTrades.filter(trade => {
        const tradeDate = new Date(trade.dateOpened)
        return tradeDate >= dateRange.from! && tradeDate <= dateRange.to!
      })
    }

    // Apply strategy filter
    if (selectedStrategies.length > 0) {
      filteredTrades = filteredTrades.filter(trade =>
        selectedStrategies.includes(trade.strategy || 'Unknown')
      )
    }

    // Always recalculate chart data when filters are applied
    // This ensures that going from filtered to unfiltered state works correctly
    processChartData(filteredTrades).then(chartData => {
      set(state => ({
        data: state.data ? {
          ...state.data,
          ...chartData
        } : null
      }))
    })
  },

  reset: () => {
    set({
      isLoading: false,
      error: null,
      dateRange: initialDateRange,
      selectedStrategies: [],
      data: null,
      chartSettings: initialChartSettings
    })
  }
}))

// Helper function to process raw data into chart-ready format
async function processChartData(
  trades: Trade[]
): Promise<Omit<PerformanceData, 'trades' | 'dailyLogs' | 'portfolioStats'>> {
  // Calculate equity curve
  const equityCurve = calculateEquityCurve(trades)

  // Calculate drawdown data
  const drawdownData = equityCurve.map(point => ({
    date: point.date,
    drawdownPct: ((point.equity - point.highWaterMark) / point.highWaterMark) * 100
  }))

  // Day of week analysis
  const dayOfWeekData = calculateDayOfWeekData(trades)

  // Return distribution
  const returnDistribution = trades
    .filter(trade => trade.marginReq && trade.marginReq > 0)
    .map(trade => (trade.pl / trade.marginReq!) * 100)

  // Streak analysis
  const streakData = calculateStreakData(trades)

  // Monthly returns
  const monthlyReturns = calculateMonthlyReturns(trades)

  // Trade sequence
  const tradeSequence = trades.map((trade, index) => ({
    tradeNumber: index + 1,
    pl: trade.pl,
    date: trade.dateOpened.toISOString()
  }))

  // Return on margin timeline
  const romTimeline = trades
    .filter(trade => trade.marginReq && trade.marginReq > 0)
    .map(trade => ({
      date: trade.dateOpened.toISOString(),
      rom: (trade.pl / trade.marginReq!) * 100
    }))

  // Rolling metrics (simplified for now)
  const rollingMetrics = calculateRollingMetrics(trades)

  return {
    equityCurve,
    drawdownData,
    dayOfWeekData,
    returnDistribution,
    streakData,
    monthlyReturns,
    tradeSequence,
    romTimeline,
    rollingMetrics
  }
}

function calculateEquityCurve(trades: Trade[]) {
  const sortedTrades = [...trades].sort((a, b) =>
    new Date(a.dateOpened).getTime() - new Date(b.dateOpened).getTime()
  )

  let runningEquity = 100000 // Starting capital
  let highWaterMark = runningEquity

  const curve = [{
    date: sortedTrades[0]?.dateOpened.toISOString() || new Date().toISOString(),
    equity: runningEquity,
    highWaterMark,
    tradeNumber: 0
  }]

  sortedTrades.forEach((trade, index) => {
    runningEquity += trade.pl
    highWaterMark = Math.max(highWaterMark, runningEquity)

    // Create unique timestamps for trades on the same day
    // Add seconds/milliseconds based on trade index to ensure uniqueness
    const baseDate = new Date(trade.dateOpened)
    const uniqueDate = new Date(baseDate.getTime() + index * 1000) // Add seconds

    curve.push({
      date: uniqueDate.toISOString(),
      equity: runningEquity,
      highWaterMark,
      tradeNumber: index + 1
    })
  })

  return curve
}

function calculateDayOfWeekData(trades: Trade[]) {
  // Match Python's weekday() behavior: 0=Monday, 1=Tuesday, ... 6=Sunday
  const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
  const dayData: Record<string, { count: number; totalPl: number }> = {}

  trades.forEach(trade => {
    // Use UTC to avoid timezone issues
    // getUTCDay() returns 0=Sunday, 1=Monday, ..., 6=Saturday
    const tradeDate = trade.dateOpened instanceof Date ? trade.dateOpened : new Date(trade.dateOpened)
    const jsDay = tradeDate.getUTCDay()

    // Convert to Python's weekday() (0=Monday, 1=Tuesday, ..., 6=Sunday)
    const pythonWeekday = jsDay === 0 ? 6 : jsDay - 1
    const day = dayNames[pythonWeekday]

    if (!dayData[day]) {
      dayData[day] = { count: 0, totalPl: 0 }
    }
    dayData[day].count++
    dayData[day].totalPl += trade.pl
  })

  return Object.entries(dayData).map(([day, data]) => ({
    day,
    count: data.count,
    avgPl: data.count > 0 ? data.totalPl / data.count : 0
  }))
}

function calculateStreakData(trades: Trade[]) {
  const sortedTrades = [...trades].sort((a, b) =>
    new Date(a.dateOpened).getTime() - new Date(b.dateOpened).getTime()
  )

  const winStreaks: number[] = []
  const lossStreaks: number[] = []
  let currentStreak = 0
  let isWinStreak = false

  sortedTrades.forEach(trade => {
    const isWin = trade.pl > 0

    if (currentStreak === 0) {
      currentStreak = 1
      isWinStreak = isWin
    } else if ((isWinStreak && isWin) || (!isWinStreak && !isWin)) {
      currentStreak++
    } else {
      // Streak ended
      if (isWinStreak) {
        winStreaks.push(currentStreak)
      } else {
        lossStreaks.push(currentStreak)
      }
      currentStreak = 1
      isWinStreak = isWin
    }
  })

  // Don't forget the last streak
  if (currentStreak > 0) {
    if (isWinStreak) {
      winStreaks.push(currentStreak)
    } else {
      lossStreaks.push(currentStreak)
    }
  }

  // Convert to distributions
  const winDistribution: Record<number, number> = {}
  const lossDistribution: Record<number, number> = {}

  winStreaks.forEach(streak => {
    winDistribution[streak] = (winDistribution[streak] || 0) + 1
  })

  lossStreaks.forEach(streak => {
    lossDistribution[streak] = (lossDistribution[streak] || 0) + 1
  })

  return {
    winDistribution,
    lossDistribution,
    statistics: {
      maxWinStreak: Math.max(...winStreaks, 0),
      maxLossStreak: Math.max(...lossStreaks, 0),
      avgWinStreak: winStreaks.length > 0 ? winStreaks.reduce((a, b) => a + b) / winStreaks.length : 0,
      avgLossStreak: lossStreaks.length > 0 ? lossStreaks.reduce((a, b) => a + b) / lossStreaks.length : 0
    }
  }
}

function calculateMonthlyReturns(trades: Trade[]) {
  // Match legacy format: {year: {month: value}}
  const monthlyData: Record<string, number> = {}

  // First, aggregate by year-month key
  trades.forEach(trade => {
    const date = new Date(trade.dateOpened)
    const year = date.getUTCFullYear()
    const month = date.getUTCMonth() + 1 // 1-12
    const monthKey = `${year}-${String(month).padStart(2, '0')}`

    monthlyData[monthKey] = (monthlyData[monthKey] || 0) + trade.pl
  })

  // Convert to nested structure {year: {month: value}}
  const monthlyReturns: Record<number, Record<number, number>> = {}
  const years = new Set<number>()

  // Get all unique years from trades
  trades.forEach(trade => {
    years.add(new Date(trade.dateOpened).getUTCFullYear())
  })

  // Initialize structure for each year
  Array.from(years).sort().forEach(year => {
    monthlyReturns[year] = {}
    for (let month = 1; month <= 12; month++) {
      const monthKey = `${year}-${String(month).padStart(2, '0')}`
      monthlyReturns[year][month] = monthlyData[monthKey] || 0
    }
  })

  return monthlyReturns
}

function calculateRollingMetrics(trades: Trade[]) {
  // Simplified rolling metrics calculation
  const windowSize = 30
  const metrics: Array<{ date: string; winRate: number; sharpeRatio: number; profitFactor: number; volatility: number }> = []

  for (let i = windowSize - 1; i < trades.length; i++) {
    const windowTrades = trades.slice(i - windowSize + 1, i + 1)
    const wins = windowTrades.filter(t => t.pl > 0).length
    const winRate = wins / windowTrades.length

    const returns = windowTrades.map(t => t.pl)
    const avgReturn = returns.reduce((a, b) => a + b) / returns.length
    const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - avgReturn, 2), 0) / returns.length
    const volatility = Math.sqrt(variance)

    const positiveReturns = returns.filter(r => r > 0).reduce((a, b) => a + b, 0)
    const negativeReturns = Math.abs(returns.filter(r => r < 0).reduce((a, b) => a + b, 0))
    const profitFactor = negativeReturns > 0 ? positiveReturns / negativeReturns : positiveReturns > 0 ? 999 : 0

    const sharpeRatio = volatility > 0 ? (avgReturn - 0) / volatility : 0 // Simplified, assuming 0 risk-free rate

    metrics.push({
      date: trades[i].dateOpened.toISOString(),
      winRate: winRate * 100,
      sharpeRatio,
      profitFactor,
      volatility
    })
  }

  return metrics
}
