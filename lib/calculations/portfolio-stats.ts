/**
 * Portfolio Statistics Calculator
 *
 * Calculates comprehensive portfolio statistics from trade data.
 * Based on legacy Python implementation for consistency.
 * Uses math.js for statistical calculations to ensure numpy compatibility.
 *
 * Key improvements for consistency:
 * - Sharpe Ratio: Uses sample std (N-1) via math.js 'uncorrected' parameter
 * - Sortino Ratio: Uses population std (N) via math.js 'biased' parameter to match numpy.std()
 * - Mean calculations: Replaced manual reduce operations with math.js mean()
 * - Min/Max calculations: Using math.js min/max functions
 * - Daily returns: Fixed to use previous day's portfolio value as denominator
 *
 * This ensures our calculations match the legacy Python implementation exactly.
 */

import { std, mean, min, max } from 'mathjs'
import { Trade } from '../models/trade'
import { DailyLogEntry } from '../models/daily-log'
import { PortfolioStats, StrategyStats, AnalysisConfig } from '../models/portfolio-stats'

/**
 * Default analysis configuration
 */
export const DEFAULT_ANALYSIS_CONFIG: AnalysisConfig = {
  riskFreeRate: 2.0, // 2% annual
  useBusinessDaysOnly: true,
  annualizationFactor: 252, // Business days
  confidenceLevel: 0.95,
  drawdownThreshold: 0.05,
}

/**
 * Portfolio statistics calculator
 */
export class PortfolioStatsCalculator {
  private config: AnalysisConfig

  constructor(config: Partial<AnalysisConfig> = {}) {
    this.config = { ...DEFAULT_ANALYSIS_CONFIG, ...config }
  }

  /**
   * Calculate comprehensive portfolio statistics
   */
  calculatePortfolioStats(trades: Trade[], dailyLogEntries?: DailyLogEntry[]): PortfolioStats {
    if (trades.length === 0) {
      return this.getEmptyStats()
    }

    // Basic statistics
    const totalTrades = trades.length
    const totalPl = trades.map(trade => trade.pl).reduce((sum, pl) => sum + pl, 0)
    const totalCommissions = trades.reduce(
      (sum, trade) => sum + trade.openingCommissionsFees + trade.closingCommissionsFees,
      0
    )
    const netPl = totalPl - totalCommissions

    // Win/Loss analysis
    const winningTrades = trades.filter(trade => trade.pl > 0)
    const losingTrades = trades.filter(trade => trade.pl < 0)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _breakEvenTrades = trades.filter(trade => trade.pl === 0)

    const winRate = winningTrades.length / totalTrades
    const avgWin = winningTrades.length > 0
      ? mean(winningTrades.map(trade => trade.pl)) as number
      : 0
    const avgLoss = losingTrades.length > 0
      ? mean(losingTrades.map(trade => trade.pl)) as number
      : 0

    // Max win/loss
    const plValues = trades.map(trade => trade.pl)
    const maxWin = plValues.length > 0 ? max(plValues) as number : 0
    const maxLoss = plValues.length > 0 ? min(plValues) as number : 0

    // Profit factor (gross profit / gross loss)
    const grossProfit = winningTrades.reduce((sum, trade) => sum + trade.pl, 0)
    const grossLoss = Math.abs(losingTrades.reduce((sum, trade) => sum + trade.pl, 0))
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0

    // Drawdown calculation
    const maxDrawdown = this.calculateMaxDrawdown(trades, dailyLogEntries)

    // Daily P/L calculation
    const avgDailyPl = this.calculateAvgDailyPl(trades, dailyLogEntries)

    // Sharpe ratio (if we have daily data)
    const sharpeRatio = this.calculateSharpeRatio(trades, dailyLogEntries)

    // Advanced metrics
    const cagr = this.calculateCAGR(trades, dailyLogEntries)
    const sortinoRatio = this.calculateSortinoRatio(trades, dailyLogEntries)
    const calmarRatio = this.calculateCalmarRatio(trades, dailyLogEntries)
    const kellyPercentage = this.calculateKellyPercentage(trades)

    // Streak calculations
    const streaks = this.calculateStreaks(trades)

    // Time in drawdown
    const timeInDrawdown = this.calculateTimeInDrawdown(trades, dailyLogEntries)

    // Periodic win rates
    const periodicWinRates = this.calculatePeriodicWinRates(trades)

    return {
      totalTrades,
      totalPl,
      winRate,
      avgWin,
      avgLoss,
      maxWin,
      maxLoss,
      sharpeRatio,
      sortinoRatio,
      calmarRatio,
      cagr,
      kellyPercentage,
      maxWinStreak: streaks.maxWinStreak,
      maxLossStreak: streaks.maxLossStreak,
      currentStreak: streaks.currentStreak,
      timeInDrawdown,
      monthlyWinRate: periodicWinRates.monthlyWinRate,
      weeklyWinRate: periodicWinRates.weeklyWinRate,
      maxDrawdown,
      avgDailyPl,
      totalCommissions,
      netPl,
      profitFactor,
    }
  }

  /**
   * Calculate strategy-specific statistics
   */
  calculateStrategyStats(trades: Trade[]): Record<string, StrategyStats> {
    if (trades.length === 0) {
      return {}
    }

    // Group trades by strategy
    const tradesByStrategy = trades.reduce((acc, trade) => {
      const strategy = trade.strategy || 'Unknown'
      if (!acc[strategy]) {
        acc[strategy] = []
      }
      acc[strategy].push(trade)
      return acc
    }, {} as Record<string, Trade[]>)

    // Calculate stats for each strategy
    const strategyStats: Record<string, StrategyStats> = {}

    Object.entries(tradesByStrategy).forEach(([strategyName, strategyTrades]) => {
      const portfolioStats = this.calculatePortfolioStats(strategyTrades)

      // Calculate average DTE if available
      const avgDte = this.calculateAvgDTE(strategyTrades)

      strategyStats[strategyName] = {
        strategyName,
        tradeCount: strategyTrades.length,
        totalPl: portfolioStats.totalPl,
        winRate: portfolioStats.winRate,
        avgWin: portfolioStats.avgWin,
        avgLoss: portfolioStats.avgLoss,
        maxWin: portfolioStats.maxWin,
        maxLoss: portfolioStats.maxLoss,
        avgDte,
        successRate: portfolioStats.winRate, // Assuming success rate = win rate for now
        profitFactor: portfolioStats.profitFactor,
      }
    })

    return strategyStats
  }

  /**
   * Calculate maximum drawdown
   */
  private calculateMaxDrawdown(trades: Trade[], dailyLogEntries?: DailyLogEntry[]): number {
    // If we have daily log data, use it for more accurate drawdown
    if (dailyLogEntries && dailyLogEntries.length > 0) {
      // Match legacy: take absolute value of each drawdown, then find maximum
      let maxDrawdown = 0.0

      for (const entry of dailyLogEntries) {
        // Daily log contains percentage values (e.g., -5.55), same as legacy Python
        const drawdownPct = Math.abs(entry.drawdownPct || 0)  // Make sure it's positive
        maxDrawdown = Math.max(maxDrawdown, drawdownPct)
      }

      return maxDrawdown
    }

    // Otherwise calculate from trade data
    if (trades.length === 0) return 0

    // Sort trades chronologically
    const sortedTrades = [...trades].sort((a, b) => {
      const dateCompare = new Date(a.dateOpened).getTime() - new Date(b.dateOpened).getTime()
      if (dateCompare !== 0) return dateCompare
      return a.timeOpened.localeCompare(b.timeOpened)
    })

    // Calculate running portfolio value and drawdown
    let runningPl = 0
    let peak = 0
    let maxDrawdown = 0

    // Get initial capital from first trade
    const initialCapital = sortedTrades[0]?.fundsAtClose - sortedTrades[0]?.pl || 0

    for (const trade of sortedTrades) {
      runningPl += trade.pl
      const currentValue = initialCapital + runningPl

      if (currentValue > peak) {
        peak = currentValue
      }

      if (peak > 0) {
        const drawdown = (currentValue - peak) / peak
        if (drawdown < maxDrawdown) {
          maxDrawdown = drawdown
        }
      }
    }

    return maxDrawdown
  }

  /**
   * Calculate average daily P/L
   */
  private calculateAvgDailyPl(trades: Trade[], dailyLogEntries?: DailyLogEntry[]): number {
    // Use daily log data if available
    if (dailyLogEntries && dailyLogEntries.length > 0) {
      const totalDailyPl = dailyLogEntries.reduce((sum, entry) => sum + entry.dailyPl, 0)
      return totalDailyPl / dailyLogEntries.length
    }

    // Otherwise calculate from trades
    if (trades.length === 0) return 0

    // Group trades by date
    const dailyPl = new Map<string, number>()

    trades.forEach(trade => {
      const dateKey = new Date(trade.dateOpened).toISOString().split('T')[0]
      const currentPl = dailyPl.get(dateKey) || 0
      dailyPl.set(dateKey, currentPl + trade.pl)
    })

    const totalDailyPl = Array.from(dailyPl.values()).reduce((sum, pl) => sum + pl, 0)
    return totalDailyPl / dailyPl.size
  }

  /**
   * Calculate Sharpe ratio
   */
  private calculateSharpeRatio(trades: Trade[], dailyLogEntries?: DailyLogEntry[]): number | undefined {
    const dailyReturns: number[] = []

    if (dailyLogEntries && dailyLogEntries.length > 1) {
      // Calculate returns from daily log data
      for (let i = 1; i < dailyLogEntries.length; i++) {
        const prevValue = dailyLogEntries[i - 1].netLiquidity
        const currentValue = dailyLogEntries[i].netLiquidity
        if (prevValue > 0) {
          const dailyReturn = (currentValue - prevValue) / prevValue
          dailyReturns.push(dailyReturn)
        }
      }
    } else if (trades.length > 0) {
      // Calculate from trade data grouped by day
      const dailyPl = new Map<string, number>()
      let portfolioValue = trades[0]?.fundsAtClose - trades[0]?.pl || 0

      trades.forEach(trade => {
        const dateKey = new Date(trade.dateOpened).toISOString().split('T')[0]
        const currentPl = dailyPl.get(dateKey) || 0
        dailyPl.set(dateKey, currentPl + trade.pl)
      })

      // Convert P/L to returns
      const sortedDates = Array.from(dailyPl.keys()).sort()
      for (const date of sortedDates) {
        const dayPl = dailyPl.get(date)!
        if (portfolioValue > 0) {
          const dailyReturn = dayPl / portfolioValue
          dailyReturns.push(dailyReturn)
          portfolioValue += dayPl
        }
      }
    }

    if (dailyReturns.length < 2) return undefined

    // Calculate Sharpe ratio using math.js for statistical consistency
    const avgDailyReturn = mean(dailyReturns) as number
    const stdDev = std(dailyReturns, 'uncorrected') as number // Use sample std (N-1) for Sharpe

    if (stdDev === 0) return undefined

    // Annualize the Sharpe ratio
    const dailyRiskFreeRate = this.config.riskFreeRate / 100 / this.config.annualizationFactor
    const excessReturn = avgDailyReturn - dailyRiskFreeRate
    const sharpeRatio = (excessReturn / stdDev) * Math.sqrt(this.config.annualizationFactor)

    return sharpeRatio
  }

  /**
   * Calculate average days to expiration (DTE)
   */
  private calculateAvgDTE(trades: Trade[]): number | undefined {
    const tradesWithDTE = trades.filter(trade =>
      trade.dateClosed && trade.dateOpened
    )

    if (tradesWithDTE.length === 0) return undefined

    const totalDTE = tradesWithDTE.reduce((sum, trade) => {
      const openDate = new Date(trade.dateOpened)
      const closeDate = new Date(trade.dateClosed!)
      const dte = Math.ceil((closeDate.getTime() - openDate.getTime()) / (1000 * 60 * 60 * 24))
      return sum + dte
    }, 0)

    return totalDTE / tradesWithDTE.length
  }

  /**
   * Calculate Compound Annual Growth Rate (CAGR)
   */
  private calculateCAGR(trades: Trade[], dailyLogEntries?: DailyLogEntry[]): number | undefined {
    if (trades.length === 0) return undefined

    const sortedTrades = [...trades].sort((a, b) => {
      const dateCompare = new Date(a.dateOpened).getTime() - new Date(b.dateOpened).getTime()
      if (dateCompare !== 0) return dateCompare
      return a.timeOpened.localeCompare(b.timeOpened)
    })

    const startDate = new Date(sortedTrades[0].dateOpened)
    const endDate = new Date(sortedTrades[sortedTrades.length - 1].dateClosed || sortedTrades[sortedTrades.length - 1].dateOpened)
    const totalYears = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25)

    if (totalYears <= 0) return undefined

    const initialCapital = PortfolioStatsCalculator.calculateInitialCapital(trades)
    const finalValue = initialCapital + trades.reduce((sum, trade) => sum + trade.pl, 0)

    if (initialCapital <= 0 || finalValue <= 0) return undefined

    const cagr = Math.pow(finalValue / initialCapital, 1 / totalYears) - 1
    return cagr * 100  // Return as percentage
  }

  /**
   * Calculate Sortino Ratio
   */
  private calculateSortinoRatio(trades: Trade[], dailyLogEntries?: DailyLogEntry[]): number | undefined {
    if (trades.length < 2) return undefined

    const dailyReturns = this.calculateDailyReturns(trades, dailyLogEntries)
    if (dailyReturns.length < 2) return undefined

    const dailyRiskFreeRate = this.config.riskFreeRate / 100 / this.config.annualizationFactor

    // Calculate excess returns (returns minus risk-free rate)
    const excessReturns = dailyReturns.map(ret => ret - dailyRiskFreeRate)
    const avgExcessReturn = mean(excessReturns) as number

    // Only consider negative excess returns for downside deviation
    const negativeExcessReturns = excessReturns.filter(ret => ret < 0)
    if (negativeExcessReturns.length === 0) return undefined

    // Calculate downside deviation using math.js to match numpy.std behavior
    // Use 'biased' for population std (divide by N) to match numpy default
    const downsideDeviation = std(negativeExcessReturns, 'biased') as number

    if (downsideDeviation === 0) return undefined

    const sortinoRatio = (avgExcessReturn / downsideDeviation) * Math.sqrt(this.config.annualizationFactor)

    return sortinoRatio
  }

  /**
   * Calculate Calmar Ratio
   */
  private calculateCalmarRatio(trades: Trade[], dailyLogEntries?: DailyLogEntry[]): number | undefined {
    const cagr = this.calculateCAGR(trades, dailyLogEntries)
    const maxDrawdown = Math.abs(this.calculateMaxDrawdown(trades, dailyLogEntries))

    if (!cagr || maxDrawdown === 0) return undefined

    return cagr / maxDrawdown
  }

  /**
   * Calculate Kelly Criterion Percentage
   */
  private calculateKellyPercentage(trades: Trade[]): number | undefined {
    if (trades.length === 0) return undefined

    const winningTrades = trades.filter(trade => trade.pl > 0)
    const losingTrades = trades.filter(trade => trade.pl < 0)

    if (winningTrades.length === 0 || losingTrades.length === 0) return undefined

    const winRate = winningTrades.length / trades.length
    const avgWin = winningTrades.reduce((sum, trade) => sum + trade.pl, 0) / winningTrades.length
    const avgLoss = Math.abs(losingTrades.reduce((sum, trade) => sum + trade.pl, 0) / losingTrades.length)

    if (avgLoss === 0) return undefined

    const winLossRatio = avgWin / avgLoss
    const kellyPercentage = (winRate * winLossRatio - (1 - winRate)) / winLossRatio

    return kellyPercentage * 100  // Return as percentage
  }

  /**
   * Calculate win/loss streaks
   */
  private calculateStreaks(trades: Trade[]): {
    maxWinStreak: number
    maxLossStreak: number
    currentStreak: number
  } {
    if (trades.length === 0) {
      return { maxWinStreak: 0, maxLossStreak: 0, currentStreak: 0 }
    }

    const sortedTrades = [...trades].sort((a, b) => {
      const dateCompare = new Date(a.dateOpened).getTime() - new Date(b.dateOpened).getTime()
      if (dateCompare !== 0) return dateCompare
      return a.timeOpened.localeCompare(b.timeOpened)
    })

    let maxWinStreak = 0
    let maxLossStreak = 0
    let currentWinStreak = 0
    let currentLossStreak = 0

    for (const trade of sortedTrades) {
      if (trade.pl > 0) {
        currentWinStreak++
        currentLossStreak = 0
        maxWinStreak = Math.max(maxWinStreak, currentWinStreak)
      } else if (trade.pl < 0) {
        currentLossStreak++
        currentWinStreak = 0
        maxLossStreak = Math.max(maxLossStreak, currentLossStreak)
      }
    }

    // Current streak is the last streak (win or loss)
    const lastTrade = sortedTrades[sortedTrades.length - 1]
    const currentStreak = lastTrade.pl > 0 ? currentWinStreak : lastTrade.pl < 0 ? -currentLossStreak : 0

    return { maxWinStreak, maxLossStreak, currentStreak }
  }

  /**
   * Calculate time in drawdown
   */
  private calculateTimeInDrawdown(trades: Trade[], dailyLogEntries?: DailyLogEntry[]): number | undefined {
    if (dailyLogEntries && dailyLogEntries.length > 0) {
      const daysInDrawdown = dailyLogEntries.filter(entry => entry.drawdownPct < 0).length
      return (daysInDrawdown / dailyLogEntries.length) * 100
    }

    // If no daily log, calculate from trade data
    if (trades.length === 0) return undefined

    const sortedTrades = [...trades].sort((a, b) => {
      const dateCompare = new Date(a.dateOpened).getTime() - new Date(b.dateOpened).getTime()
      if (dateCompare !== 0) return dateCompare
      return a.timeOpened.localeCompare(b.timeOpened)
    })

    const initialCapital = PortfolioStatsCalculator.calculateInitialCapital(trades)
    let runningPl = 0
    let peak = initialCapital
    let daysInDrawdown = 0
    let totalDays = 0

    // Track portfolio value by date
    const valuesByDate = new Map<string, number>()

    for (const trade of sortedTrades) {
      runningPl += trade.pl
      const currentValue = initialCapital + runningPl
      const dateKey = new Date(trade.dateOpened).toISOString().split('T')[0]
      valuesByDate.set(dateKey, currentValue)
    }

    // Count days in drawdown
    for (const [date, value] of valuesByDate) {
      totalDays++
      if (value > peak) {
        peak = value
      } else if (value < peak) {
        daysInDrawdown++
      }
    }

    return totalDays > 0 ? (daysInDrawdown / totalDays) * 100 : undefined
  }

  /**
   * Calculate periodic win rates
   */
  private calculatePeriodicWinRates(trades: Trade[]): {
    monthlyWinRate: number
    weeklyWinRate: number
  } {
    if (trades.length === 0) {
      return { monthlyWinRate: 0, weeklyWinRate: 0 }
    }

    // Group trades by month and week
    const monthlyTrades = new Map<string, Trade[]>()
    const weeklyTrades = new Map<string, Trade[]>()

    for (const trade of trades) {
      const date = new Date(trade.dateOpened)

      // Monthly grouping (YYYY-MM)
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      if (!monthlyTrades.has(monthKey)) {
        monthlyTrades.set(monthKey, [])
      }
      monthlyTrades.get(monthKey)!.push(trade)

      // Weekly grouping (YYYY-WW)
      const startOfYear = new Date(date.getFullYear(), 0, 1)
      const weekNumber = Math.ceil(((date.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7)
      const weekKey = `${date.getFullYear()}-${String(weekNumber).padStart(2, '0')}`
      if (!weeklyTrades.has(weekKey)) {
        weeklyTrades.set(weekKey, [])
      }
      weeklyTrades.get(weekKey)!.push(trade)
    }

    // Calculate monthly win rate
    let profitableMonths = 0
    for (const [month, monthTrades] of monthlyTrades) {
      const monthPl = monthTrades.reduce((sum, trade) => sum + trade.pl, 0)
      if (monthPl > 0) profitableMonths++
    }
    const monthlyWinRate = monthlyTrades.size > 0 ? (profitableMonths / monthlyTrades.size) * 100 : 0

    // Calculate weekly win rate
    let profitableWeeks = 0
    for (const [week, weekTrades] of weeklyTrades) {
      const weekPl = weekTrades.reduce((sum, trade) => sum + trade.pl, 0)
      if (weekPl > 0) profitableWeeks++
    }
    const weeklyWinRate = weeklyTrades.size > 0 ? (profitableWeeks / weeklyTrades.size) * 100 : 0

    return { monthlyWinRate, weeklyWinRate }
  }

  /**
   * Calculate daily returns for advanced metrics
   */
  private calculateDailyReturns(trades: Trade[], dailyLogEntries?: DailyLogEntry[]): number[] {
    if (dailyLogEntries && dailyLogEntries.length > 0) {
      return dailyLogEntries.map(entry => {
        // Calculate previous day's portfolio value (net liquidity minus today's P/L)
        const previousValue = entry.netLiquidity - entry.dailyPl
        return previousValue > 0 ? entry.dailyPl / previousValue : 0
      })
    }

    // Calculate from trade data
    const sortedTrades = [...trades].sort((a, b) => {
      const dateCompare = new Date(a.dateOpened).getTime() - new Date(b.dateOpened).getTime()
      if (dateCompare !== 0) return dateCompare
      return a.timeOpened.localeCompare(b.timeOpened)
    })

    const dailyReturns: number[] = []
    const tradesByDate = new Map<string, Trade[]>()

    // Group trades by date
    for (const trade of sortedTrades) {
      const dateKey = new Date(trade.dateOpened).toISOString().split('T')[0]
      if (!tradesByDate.has(dateKey)) {
        tradesByDate.set(dateKey, [])
      }
      tradesByDate.get(dateKey)!.push(trade)
    }

    // Calculate daily returns
    const initialCapital = PortfolioStatsCalculator.calculateInitialCapital(trades)
    let portfolioValue = initialCapital

    for (const [date, dayTrades] of tradesByDate) {
      const dayPl = dayTrades.reduce((sum, trade) => sum + trade.pl, 0)
      if (portfolioValue > 0) {
        dailyReturns.push(dayPl / portfolioValue)
        portfolioValue += dayPl
      }
    }

    return dailyReturns
  }

  /**
   * Get empty statistics (for zero trades)
   */
  private getEmptyStats(): PortfolioStats {
    return {
      totalTrades: 0,
      totalPl: 0,
      winRate: 0,
      avgWin: 0,
      avgLoss: 0,
      maxWin: 0,
      maxLoss: 0,
      sharpeRatio: undefined,
      sortinoRatio: undefined,
      calmarRatio: undefined,
      cagr: undefined,
      kellyPercentage: undefined,
      maxWinStreak: 0,
      maxLossStreak: 0,
      currentStreak: 0,
      timeInDrawdown: undefined,
      monthlyWinRate: 0,
      weeklyWinRate: 0,
      maxDrawdown: 0,
      avgDailyPl: 0,
      totalCommissions: 0,
      netPl: 0,
      profitFactor: 0,
    }
  }

  /**
   * Calculate initial capital from trades
   */
  static calculateInitialCapital(trades: Trade[]): number {
    if (trades.length === 0) return 0

    // Sort trades chronologically
    const sortedTrades = [...trades].sort((a, b) => {
      const dateCompare = new Date(a.dateOpened).getTime() - new Date(b.dateOpened).getTime()
      if (dateCompare !== 0) return dateCompare
      return a.timeOpened.localeCompare(b.timeOpened)
    })

    const firstTrade = sortedTrades[0]
    return firstTrade.fundsAtClose - firstTrade.pl
  }

  /**
   * Calculate portfolio value at any point in time
   */
  static calculatePortfolioValueAtDate(trades: Trade[], targetDate: Date, initialCapital?: number): number {
    if (initialCapital === undefined) {
      initialCapital = this.calculateInitialCapital(trades)
    }

    const relevantTrades = trades.filter(trade => {
      const tradeDate = new Date(trade.dateOpened)
      return tradeDate <= targetDate
    })

    const totalPl = relevantTrades.reduce((sum, trade) => sum + trade.pl, 0)
    return initialCapital + totalPl
  }
}