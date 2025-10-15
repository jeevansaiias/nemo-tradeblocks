"use client"

import { eachDayOfInterval, endOfMonth, format, startOfMonth } from "date-fns"
import { useMemo } from "react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
    formatCurrency,
    type DailyPersonalPL
} from "@/lib/processing/personal-trade-parser"

interface PersonalPLCalendarProps {
  dailyPL: DailyPersonalPL[]
  currentDate: Date
  onDateChange: (date: Date) => void
  onDateClick?: (date: string, trades: DailyPersonalPL) => void
}

export function PersonalPLCalendar({ 
  dailyPL, 
  currentDate, 
  onDateChange, 
  onDateClick 
}: PersonalPLCalendarProps) {
  const calendarData = useMemo(() => {
    const monthStart = startOfMonth(currentDate)
    const monthEnd = endOfMonth(currentDate)
    const calendarDays = eachDayOfInterval({ start: monthStart, end: monthEnd })
    
    // Create a map for quick lookup
    const plMap = new Map<string, DailyPersonalPL>()
    dailyPL.forEach(day => {
      plMap.set(day.date, day)
    })
    
    return calendarDays.map(day => {
      const dateString = format(day, 'yyyy-MM-dd')
      const dayData = plMap.get(dateString)
      
      return {
        date: day,
        dateString,
        dayData,
        isEmpty: !dayData
      }
    })
  }, [dailyPL, currentDate])

  const getColorClass = (pl: number, tradeCount: number) => {
    if (tradeCount === 0) return "bg-muted/30 text-muted-foreground"
    
    if (pl > 0) {
      if (pl >= 1000) return "bg-green-600 text-white font-bold"
      if (pl >= 500) return "bg-green-500 text-white"
      if (pl >= 100) return "bg-green-400 text-white"
      return "bg-green-300 text-green-800"
    } else {
      if (pl <= -1000) return "bg-red-600 text-white font-bold"
      if (pl <= -500) return "bg-red-500 text-white"
      if (pl <= -100) return "bg-red-400 text-white"
      return "bg-red-300 text-red-800"
    }
  }

  const handleDateClick = (dayData: DailyPersonalPL, dateString: string) => {
    if (onDateClick) {
      onDateClick(dateString, dayData)
    }
  }

  const monthStats = useMemo(() => {
    const monthPL = dailyPL.filter(day => {
      const dayDate = new Date(day.date)
      return dayDate.getMonth() === currentDate.getMonth() && 
             dayDate.getFullYear() === currentDate.getFullYear()
    })

    const totalPL = monthPL.reduce((sum, day) => sum + day.totalPL, 0)
    const totalTrades = monthPL.reduce((sum, day) => sum + day.tradeCount, 0)
    const tradingDays = monthPL.length
    const winningDays = monthPL.filter(day => day.totalPL > 0).length
    const winRate = tradingDays > 0 ? (winningDays / tradingDays) * 100 : 0

    return { totalPL, totalTrades, tradingDays, winningDays, winRate }
  }, [dailyPL, currentDate])

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>
            P/L Calendar - {format(currentDate, 'MMMM yyyy')}
          </CardTitle>
          <div className="flex items-center gap-4">
            <button
              onClick={() => onDateChange(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1))}
              className="px-3 py-1 text-sm bg-muted hover:bg-muted/80 rounded-md"
            >
              ← Previous
            </button>
            <button
              onClick={() => onDateChange(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1))}
              className="px-3 py-1 text-sm bg-muted hover:bg-muted/80 rounded-md"
            >
              Next →
            </button>
          </div>
        </div>
        
        {/* Month Statistics */}
        <div className="flex items-center gap-4 text-sm">
          <Badge variant={monthStats.totalPL >= 0 ? "default" : "destructive"}>
            {formatCurrency(monthStats.totalPL)}
          </Badge>
          <span className="text-muted-foreground">
            {monthStats.totalTrades} trades • {monthStats.tradingDays} trading days
          </span>
          <span className="text-muted-foreground">
            {monthStats.winRate.toFixed(1)}% win rate
          </span>
        </div>
      </CardHeader>
      
      <CardContent>
        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-1">
          {/* Header */}
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="p-2 text-center text-sm font-medium text-muted-foreground">
              {day}
            </div>
          ))}
          
          {/* Calendar Days */}
          {calendarData.map(({ date, dateString, dayData, isEmpty }) => (
            <div
              key={dateString}
              className={`
                min-h-[80px] p-2 border border-border/30 rounded-md cursor-pointer
                hover:border-border transition-colors
                ${isEmpty ? 'hover:bg-muted/20' : 'hover:scale-105 transition-transform'}
              `}
              onClick={() => dayData && handleDateClick(dayData, dateString)}
            >
              <div className="text-sm font-medium mb-1">
                {format(date, 'd')}
              </div>
              
              {dayData && (
                <div className="space-y-1">
                  <div
                    className={`
                      px-2 py-1 rounded text-xs text-center
                      ${getColorClass(dayData.totalPL, dayData.tradeCount)}
                    `}
                  >
                    {formatCurrency(dayData.totalPL)}
                  </div>
                  <div className="text-xs text-muted-foreground text-center">
                    {dayData.tradeCount} trade{dayData.tradeCount !== 1 ? 's' : ''}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
        
        {/* Legend */}
        <div className="flex items-center justify-center gap-4 mt-6 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-green-300"></div>
            <span>Small Profit</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-green-500"></div>
            <span>Large Profit</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-red-300"></div>
            <span>Small Loss</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-red-500"></div>
            <span>Large Loss</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-muted/30"></div>
            <span>No Trades</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}