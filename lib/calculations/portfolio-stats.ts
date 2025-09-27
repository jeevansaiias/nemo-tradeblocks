/**
 * Portfolio Statistics Calculator
 *
 * Calculates comprehensive portfolio statistics from trade data.
 * Based on legacy Python implementation for consistency.
 */

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
    const totalPl = trades.reduce((sum, trade) => sum + trade.pl, 0)
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
      ? winningTrades.reduce((sum, trade) => sum + trade.pl, 0) / winningTrades.length
      : 0
    const avgLoss = losingTrades.length > 0
      ? losingTrades.reduce((sum, trade) => sum + trade.pl, 0) / losingTrades.length
      : 0

    // Max win/loss
    const maxWin = trades.length > 0 ? Math.max(...trades.map(trade => trade.pl)) : 0
    const maxLoss = trades.length > 0 ? Math.min(...trades.map(trade => trade.pl)) : 0

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

    return {
      totalTrades,
      totalPl,
      winRate,
      avgWin,
      avgLoss,
      maxWin,
      maxLoss,
      sharpeRatio,
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
      return Math.min(...dailyLogEntries.map(entry => entry.drawdownPct))
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

    // Calculate Sharpe ratio
    const avgDailyReturn = dailyReturns.reduce((sum, ret) => sum + ret, 0) / dailyReturns.length
    const variance = dailyReturns.reduce((sum, ret) => sum + Math.pow(ret - avgDailyReturn, 2), 0) / (dailyReturns.length - 1)
    const stdDev = Math.sqrt(variance)

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