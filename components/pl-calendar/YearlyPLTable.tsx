"use client"

import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import type { StoredTrade } from "@/lib/db/trades-store"
import { clsx } from "clsx"
import { getMonth, getYear } from "date-fns"
import { useMemo } from "react"
import { formatCurrency } from "@/lib/utils"
import { formatCompactPL } from "@/lib/utils/format"

interface YearlyPLTableProps {
  trades: StoredTrade[]
  currentYear?: number
  onYearChange?: (year: number) => void
  onMonthClick?: (year: number, month: number) => void
}

interface MonthData {
  pl: number
  trades: number
  winRate: number
  avgPL: number
}

interface YearData {
  [key: string]: MonthData
  total: MonthData
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
]

export function YearlyPLTable({ trades, onMonthClick }: YearlyPLTableProps) {
  // Aggregate data by year and month
  const yearlyData = useMemo(() => {
    const data: { [year: number]: YearData } = {}
    
    // Initialize years with empty months
    const years = new Set<number>()
    trades.forEach(trade => {
      if (trade.dateOpened) {
        years.add(getYear(new Date(trade.dateOpened)))
      }
    })
    
    years.forEach(year => {
      data[year] = {
        total: { pl: 0, trades: 0, winRate: 0, avgPL: 0 }
      }
      MONTHS.forEach(month => {
        data[year][month] = { pl: 0, trades: 0, winRate: 0, avgPL: 0 }
      })
    })
    
    // Aggregate trades
    trades.forEach(trade => {
      if (!trade.dateOpened) return
      
      const date = new Date(trade.dateOpened)
      const year = getYear(date)
      const monthIndex = getMonth(date)
      const monthName = MONTHS[monthIndex]
      
      if (!data[year]) return
      
      const monthData = data[year][monthName]
      monthData.pl += trade.pl || 0
      monthData.trades += 1
      
      // Update year total
      data[year].total.pl += trade.pl || 0
      data[year].total.trades += 1
    })
    
    // Calculate win rates and averages
    Object.keys(data).forEach(yearKey => {
      const year = parseInt(yearKey)
      
      // Calculate monthly stats
      MONTHS.forEach(month => {
        const monthData = data[year][month]
        if (monthData.trades > 0) {
          const winningTrades = trades.filter(t => {
            if (!t.dateOpened) return false
            const date = new Date(t.dateOpened)
            return getYear(date) === year && 
                   MONTHS[getMonth(date)] === month && 
                   (t.pl || 0) > 0
          }).length
          
          monthData.winRate = (winningTrades / monthData.trades) * 100
          monthData.avgPL = monthData.pl / monthData.trades
        }
      })
      
      // Calculate yearly stats
      const yearData = data[year].total
      if (yearData.trades > 0) {
        const winningTrades = trades.filter(t => {
          if (!t.dateOpened) return false
          return getYear(new Date(t.dateOpened)) === year && (t.pl || 0) > 0
        }).length
        
        yearData.winRate = (winningTrades / yearData.trades) * 100
        yearData.avgPL = yearData.pl / yearData.trades
      }
    })
    
    return data
  }, [trades])

  const years = Object.keys(yearlyData)
    .map(y => parseInt(y))
    .sort((a, b) => b - a) // Most recent first

  const getColorClass = (pl: number, trades: number) => {
    if (trades === 0) return "bg-muted text-muted-foreground"
    
    if (pl > 0) {
      if (pl >= 5000) return "bg-primary/90 text-primary-foreground font-bold"
      if (pl >= 2000) return "bg-primary/70 text-primary-foreground"
      if (pl >= 500) return "bg-primary/50 text-primary-foreground"
      return "bg-primary/30 text-primary"
    } else {
      if (pl <= -5000) return "bg-destructive/90 text-destructive-foreground font-bold"
      if (pl <= -2000) return "bg-destructive/70 text-destructive-foreground"
      if (pl <= -500) return "bg-destructive/50 text-destructive-foreground"
      return "bg-destructive/30 text-destructive"
    }
  }

  return (
    <TooltipProvider>
      <Card>
        <CardHeader>
          <CardTitle>Yearly P/L Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th className="p-3 text-left text-sm font-semibold text-muted-foreground">
                    Year
                  </th>
                  {MONTHS.map((month) => (
                    <th key={month} className="p-3 text-center text-sm font-semibold text-muted-foreground">
                      {month}
                    </th>
                  ))}
                  <th className="p-3 text-center text-sm font-semibold text-primary">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {years.map((year) => (
                  <tr key={year} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="p-3 text-sm font-semibold text-foreground">
                      {year}
                    </td>
                    {MONTHS.map((month) => {
                      const data = yearlyData[year]?.[month]
                      if (!data || data.trades === 0) {
                        return (
                          <td key={month} className="p-3 text-center">
                            <div className="h-12 w-full rounded-md bg-muted/50 flex items-center justify-center text-xs text-muted-foreground">
                              --
                            </div>
                          </td>
                        )
                      }

                      return (
                        <td key={month} className="p-3 text-center">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div
                                className={clsx(
                                  "h-12 w-full rounded-md cursor-pointer transition-all duration-200 hover:scale-105 flex flex-col items-center justify-center text-xs",
                                  getColorClass(data.pl, data.trades)
                                )}
                                onClick={() => {
                                  const monthIndex = MONTHS.indexOf(month)
                                  onMonthClick?.(year, monthIndex)
                                }}
                              >
                                <div className="font-semibold">
                                  {formatCompactPL(data.pl)}
                                </div>
                                <div className="text-[10px] opacity-80">
                                  {data.trades} trades
                                </div>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent className="bg-popover border border-border">
                              <div className="space-y-1 text-sm">
                                <div className="font-semibold">{month} {year}</div>
                                <div>P/L: {formatCurrency(data.pl)}</div>
                                <div>Trades: {data.trades}</div>
                                <div>Win Rate: {Math.round(data.winRate)}%</div>
                                <div>Avg P/L: {formatCurrency(data.avgPL)}</div>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </td>
                      )
                    })}
                    <td className="p-3 text-center">
                      <div
                        className={clsx(
                          "h-12 w-full rounded-md flex flex-col items-center justify-center text-sm font-bold border-2",
                          yearlyData[year]?.total.pl >= 0 
                            ? "bg-primary/20 border-primary text-primary" 
                            : "bg-destructive/20 border-destructive text-destructive"
                        )}
                      >
                        <div>{formatCompactPL(yearlyData[year]?.total.pl || 0)}</div>
                        <div className="text-xs opacity-80">
                          {yearlyData[year]?.total.trades || 0} trades
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* Legend */}
          <div className="flex items-center justify-center gap-6 mt-6 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-primary/30"></div>
              <span className="text-muted-foreground">Small Profit</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-primary/70"></div>
              <span className="text-muted-foreground">Large Profit</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-destructive/30"></div>
              <span className="text-muted-foreground">Small Loss</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-destructive/70"></div>
              <span className="text-muted-foreground">Large Loss</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-muted/50"></div>
              <span className="text-muted-foreground">No Trades</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  )
}