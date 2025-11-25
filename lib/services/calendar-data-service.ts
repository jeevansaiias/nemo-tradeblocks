import { StoredTrade } from "@/lib/db/trades-store"
import { DailyLogEntry } from "@/lib/models/daily-log"
import { getTradesByBlock } from "@/lib/db"
import { getDailyLogsByBlock } from "@/lib/db/daily-logs-store"
import { format, startOfDay } from "date-fns"

export type CalendarViewMode = "month" | "quarter" | "year"
export type CalendarColorMode = "pl" | "count" | "winRate"

export interface CalendarDayData {
  date: Date
  pl: number
  tradeCount: number
  winRate: number
  trades: StoredTrade[]
  dailyLog?: DailyLogEntry
  reconciliationDiff?: number // Difference between trade PL and daily log PL
}

export interface CalendarStats {
  totalPL: number
  totalTrades: number
  winRate: number
  bestDay: { date: Date; pl: number } | null
  worstDay: { date: Date; pl: number } | null
  averagePL: number
}

export class CalendarDataService {
  
  static async getCalendarData(blockId: string): Promise<{
    trades: StoredTrade[],
    dailyLogs: DailyLogEntry[],
    dayMap: Map<string, CalendarDayData>
  }> {
    const [trades, dailyLogs] = await Promise.all([
      getTradesByBlock(blockId),
      getDailyLogsByBlock(blockId)
    ])

    const dayMap = new Map<string, CalendarDayData>()

    // Process Trades
    trades.forEach(trade => {
      if (!trade.dateOpened) return
      const date = startOfDay(new Date(trade.dateOpened))
      const dateKey = format(date, 'yyyy-MM-dd')

      if (!dayMap.has(dateKey)) {
        dayMap.set(dateKey, {
          date,
          pl: 0,
          tradeCount: 0,
          winRate: 0,
          trades: [],
          dailyLog: undefined,
          reconciliationDiff: undefined
        })
      }

      const dayData = dayMap.get(dateKey)!
      dayData.pl += trade.pl || 0
      dayData.tradeCount += 1
      dayData.trades.push(trade)
    })

    // Process Daily Logs
    dailyLogs.forEach(log => {
      const date = startOfDay(new Date(log.date))
      const dateKey = format(date, 'yyyy-MM-dd')

      if (!dayMap.has(dateKey)) {
        dayMap.set(dateKey, {
          date,
          pl: 0,
          tradeCount: 0,
          winRate: 0,
          trades: [],
          dailyLog: log,
          reconciliationDiff: undefined
        })
      } else {
        const dayData = dayMap.get(dateKey)!
        dayData.dailyLog = log
      }
    })

    // Calculate derived stats
    dayMap.forEach(dayData => {
      // Win Rate
      const winningTrades = dayData.trades.filter(t => (t.pl || 0) > 0).length
      dayData.winRate = dayData.tradeCount > 0 ? (winningTrades / dayData.tradeCount) * 100 : 0

      // Reconciliation
      if (dayData.dailyLog) {
        // Assuming dailyLog.dailyPl is the "truth" from broker
        // And dayData.pl is the sum of trades in the block
        // Diff = Block PL - Log PL (or vice versa)
        // Let's say we want to see if Block PL matches Log PL
        dayData.reconciliationDiff = dayData.pl - dayData.dailyLog.dailyPl
      }
    })

    return { trades, dailyLogs, dayMap }
  }

  static getStats(dayMap: Map<string, CalendarDayData>): CalendarStats {
    let totalPL = 0
    let totalTrades = 0
    let winningTrades = 0
    let bestDay: { date: Date; pl: number } | null = null
    let worstDay: { date: Date; pl: number } | null = null

    dayMap.forEach(day => {
      totalPL += day.pl
      totalTrades += day.tradeCount
      winningTrades += day.trades.filter(t => (t.pl || 0) > 0).length

      if (!bestDay || day.pl > bestDay.pl) {
        bestDay = { date: day.date, pl: day.pl }
      }
      if (!worstDay || day.pl < worstDay.pl) {
        worstDay = { date: day.date, pl: day.pl }
      }
    })

    return {
      totalPL,
      totalTrades,
      winRate: totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0,
      bestDay,
      worstDay,
      averagePL: totalTrades > 0 ? totalPL / totalTrades : 0 // Average per trade? Or per day? Usually per day in calendar context.
      // Let's stick to per trade for now as it's common, or maybe per day?
      // "Average Daily P/L" is probably more relevant for a calendar.
    }
  }
}
