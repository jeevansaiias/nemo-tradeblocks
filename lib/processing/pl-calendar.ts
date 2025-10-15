/**
 * P/L Calendar Processing
 * 
 * Utilities for aggregating trade data by date for calendar visualization
 */

import type { StoredTrade } from '@/lib/db/trades-store'
import { format } from 'date-fns'

export interface DailyPLData {
  date: string // YYYY-MM-DD format
  value: number // Total P/L for the date
  count: number // Number of trades
}

/**
 * Aggregates trades by date and calculates daily P/L
 */
export function aggregateDailyPL(trades: StoredTrade[]): DailyPLData[] {
  const dailyPL = new Map<string, { value: number; count: number }>()

  for (const trade of trades) {
    // Use dateOpened for aggregation (when the trade was opened)
    if (!trade.dateOpened) continue
    
    const date = format(new Date(trade.dateOpened), 'yyyy-MM-dd')
    const current = dailyPL.get(date) || { value: 0, count: 0 }
    
    dailyPL.set(date, {
      value: current.value + (trade.pl || 0),
      count: current.count + 1
    })
  }

  return Array.from(dailyPL, ([date, data]) => ({
    date,
    value: data.value,
    count: data.count
  })).sort((a, b) => a.date.localeCompare(b.date))
}

/**
 * Filters trades for a specific date
 */
export function getTradesForDate(trades: StoredTrade[], targetDate: string): StoredTrade[] {
  return trades.filter(trade => {
    if (!trade.dateOpened) return false
    const tradeDate = format(new Date(trade.dateOpened), 'yyyy-MM-dd')
    return tradeDate === targetDate
  })
}

/**
 * Calculates summary statistics for calendar view
 */
export function calculateCalendarStats(dailyPL: DailyPLData[]) {
  if (dailyPL.length === 0) {
    return {
      totalPL: 0,
      winDays: 0,
      lossDays: 0,
      maxWin: 0,
      maxLoss: 0,
      avgWin: 0,
      avgLoss: 0,
      totalTrades: 0
    }
  }

  const wins = dailyPL.filter(d => d.value > 0)
  const losses = dailyPL.filter(d => d.value < 0)
  
  const totalPL = dailyPL.reduce((sum, d) => sum + d.value, 0)
  const totalTrades = dailyPL.reduce((sum, d) => sum + d.count, 0)
  
  const maxWin = wins.length > 0 ? Math.max(...wins.map(d => d.value)) : 0
  const maxLoss = losses.length > 0 ? Math.min(...losses.map(d => d.value)) : 0
  
  const avgWin = wins.length > 0 ? wins.reduce((sum, d) => sum + d.value, 0) / wins.length : 0
  const avgLoss = losses.length > 0 ? losses.reduce((sum, d) => sum + d.value, 0) / losses.length : 0

  return {
    totalPL,
    winDays: wins.length,
    lossDays: losses.length,
    maxWin,
    maxLoss,
    avgWin,
    avgLoss,
    totalTrades
  }
}

/**
 * Generates calendar heatmap color class based on P/L value
 */
export function getColorClass(value: number | undefined): string {
  if (!value || value === 0) return 'color-empty'
  if (value > 0) return 'color-positive'
  return 'color-negative'
}

/**
 * Formats P/L value for display
 */
export function formatPL(value: number): string {
  const formatted = Math.abs(value).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  })
  
  if (value > 0) return `+${formatted}`
  if (value < 0) return `-${formatted}`
  return formatted
}