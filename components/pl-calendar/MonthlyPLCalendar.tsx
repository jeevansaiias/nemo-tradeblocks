"use client"

import {
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  getWeek,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek
} from "date-fns"
import { useMemo, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { ChevronLeft, ChevronRight } from "lucide-react"

import type { StoredTrade } from "@/lib/db/trades-store"
import { formatPL, getTradesForDate, type DailyPLData } from "@/lib/processing/pl-calendar"

interface MonthlyPLCalendarProps {
  trades: StoredTrade[]
  dailyPL: DailyPLData[]
  currentDate: Date
  onDateChange: (date: Date) => void
}

interface DayData {
  date: Date
  pl: number
  tradeCount: number
  winRate: number
  trades: StoredTrade[]
}

interface WeekSummary {
  weekNumber: number
  weekStart: Date
  weekEnd: Date
  totalPL: number
  daysTraded: number
  totalTrades: number
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function MonthlyPLCalendar({ trades, dailyPL, currentDate, onDateChange }: MonthlyPLCalendarProps) {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [selectedTrades, setSelectedTrades] = useState<StoredTrade[]>([])
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)

  // Generate calendar days for the month
  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentDate))
    const end = endOfWeek(endOfMonth(currentDate))
    
    return eachDayOfInterval({ start, end }).map(date => {
      const dateString = format(date, 'yyyy-MM-dd')
      const dayTrades = getTradesForDate(trades, dateString)
      const dayPL = dailyPL.find(d => d.date === dateString)
      
      const winningTrades = dayTrades.filter(t => t.pl > 0).length
      const winRate = dayTrades.length > 0 ? (winningTrades / dayTrades.length) * 100 : 0
      
      return {
        date,
        pl: dayPL?.value || 0,
        tradeCount: dayPL?.count || 0,
        winRate,
        trades: dayTrades
      }
    })
  }, [currentDate, trades, dailyPL])

  // Generate weekly summaries
  const weekSummaries = useMemo(() => {
    const weeks = new Map<number, WeekSummary>()
    
    calendarDays.forEach(day => {
      if (!isSameMonth(day.date, currentDate)) return
      
      const weekNum = getWeek(day.date)
      const existing = weeks.get(weekNum) || {
        weekNumber: weekNum,
        weekStart: startOfWeek(day.date),
        weekEnd: endOfWeek(day.date),
        totalPL: 0,
        daysTraded: 0,
        totalTrades: 0
      }
      
      existing.totalPL += day.pl
      if (day.tradeCount > 0) existing.daysTraded += 1
      existing.totalTrades += day.tradeCount
      
      weeks.set(weekNum, existing)
    })
    
    return Array.from(weeks.values()).sort((a, b) => a.weekNumber - b.weekNumber)
  }, [calendarDays, currentDate])

  const handleDateClick = (dayData: DayData) => {
    setSelectedDate(dayData.date)
    setSelectedTrades(dayData.trades)
    setIsDrawerOpen(true)
  }

  const previousMonth = () => {
    const newDate = new Date(currentDate)
    newDate.setMonth(newDate.getMonth() - 1)
    onDateChange(newDate)
  }

  const nextMonth = () => {
    const newDate = new Date(currentDate)
    newDate.setMonth(newDate.getMonth() + 1)
    onDateChange(newDate)
  }

  const getDayColor = (pl: number, hasData: boolean) => {
    if (!hasData) return 'bg-gray-900'
    if (pl > 0) return 'bg-green-900 hover:bg-green-800'
    if (pl < 0) return 'bg-red-900 hover:bg-red-800'
    return 'bg-gray-800 hover:bg-gray-700'
  }

  const getDayTextColor = (pl: number, hasData: boolean) => {
    if (!hasData) return 'text-gray-500'
    if (pl > 0) return 'text-green-300'
    if (pl < 0) return 'text-red-300'
    return 'text-gray-300'
  }

  return (
    <div className="space-y-6">
      {/* Month Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={previousMonth}
          className="flex items-center gap-2"
        >
          <ChevronLeft className="h-4 w-4" />
          Previous
        </Button>
        
        <h2 className="text-2xl font-bold text-primary">
          {format(currentDate, 'MMMM yyyy')}
        </h2>
        
        <Button
          variant="outline"
          size="sm"
          onClick={nextMonth}
          className="flex items-center gap-2"
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Main Container with Proper Alignment */}
      <div className="flex flex-col md:flex-row items-start gap-6">
        {/* Calendar Grid Container */}
        <div className="w-full md:w-3/4">
          <Card className="monthly-calendar">
            <CardContent className="p-6">
              {/* Weekday Headers */}
              <div className="grid grid-cols-7 gap-2 mb-4">
                {WEEKDAYS.map(day => (
                  <div
                    key={day}
                    className="text-center text-sm font-medium text-muted-foreground py-2"
                  >
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar Days */}
              <div className="grid grid-cols-7 gap-2">
              {calendarDays.map((dayData, index) => {
                const isCurrentMonth = isSameMonth(dayData.date, currentDate)
                const hasData = dayData.tradeCount > 0
                
                return (
                  <div
                    key={index}
                    onClick={() => isCurrentMonth && handleDateClick(dayData)}
                    className={`
                      relative min-h-[80px] p-2 rounded-lg border cursor-pointer transition-all duration-200
                      ${getDayColor(dayData.pl, hasData)}
                      ${isCurrentMonth ? 'border-border' : 'border-transparent opacity-40'}
                      ${isCurrentMonth && hasData ? 'hover:scale-105 hover:shadow-lg' : ''}
                    `}
                  >
                    {/* Date Number */}
                    <div className={`text-sm font-semibold ${getDayTextColor(dayData.pl, hasData)}`}>
                      {format(dayData.date, 'd')}
                    </div>
                    
                    {/* Trade Data */}
                    {isCurrentMonth && hasData && (
                      <div className="mt-1 space-y-1">
                        <div className={`text-xs font-bold ${getDayTextColor(dayData.pl, hasData)}`}>
                          {formatPL(dayData.pl)}
                        </div>
                        <div className="text-xs text-gray-400">
                          {dayData.tradeCount} trade{dayData.tradeCount !== 1 ? 's' : ''}
                        </div>
                        <div className="text-xs text-gray-400">
                          {Math.round(dayData.winRate)}% win
                        </div>
                      </div>
                    )}
                    
                    {/* Today Indicator */}
                    {isSameDay(dayData.date, new Date()) && (
                      <div className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full"></div>
                    )}
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Weekly Summary Sidebar */}
      <div className="w-full md:w-1/4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Weekly Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {weekSummaries.map((week) => (
              <div
                key={week.weekNumber}
                className="flex justify-between items-center p-3 rounded-lg bg-card/50 border border-border"
              >
                <div>
                  <p className="text-sm text-foreground font-medium">
                    Week {week.weekNumber}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {format(week.weekStart, 'MMM d')} - {format(week.weekEnd, 'MMM d')} · {week.daysTraded} days
                  </p>
                </div>
                <p className={`font-semibold ${
                  week.totalPL >= 0 ? "text-primary" : "text-destructive"
                }`}>
                  {formatPL(week.totalPL)}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>

    {/* Trade Details Drawer */}
    <Sheet open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
      <SheetContent className="w-[400px] sm:w-[540px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            {selectedDate && format(selectedDate, 'MMMM d, yyyy')}
          </SheetTitle>
          <SheetDescription>
            {selectedTrades.length} trade{selectedTrades.length !== 1 ? 's' : ''} executed on this day
          </SheetDescription>
        </SheetHeader>
          
          <div className="mt-6 space-y-4 max-h-[calc(100vh-120px)] overflow-y-auto">
            {selectedTrades.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No trades found for this date.
              </p>
            ) : (
              <>
                {selectedTrades.map((trade, index) => (
                  <Card key={index} className="border-l-4" style={{
                    borderLeftColor: trade.pl >= 0 ? '#FF8A3D' : '#ef4444'
                  }}>
                    <CardContent className="pt-4">
                      <div className="space-y-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="font-medium text-foreground text-sm">
                              {trade.legs}
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              Strategy: {trade.strategy}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className={`text-lg font-bold ${
                              trade.pl >= 0 ? 'text-primary' : 'text-destructive'
                            }`}>
                              {formatPL(trade.pl)}
                            </div>
                            <Badge variant={trade.pl >= 0 ? "default" : "destructive"} className="text-xs">
                              {trade.pl >= 0 ? "Win" : "Loss"}
                            </Badge>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div>
                            <span className="text-muted-foreground">Contracts:</span>
                            <span className="ml-1 text-foreground">{trade.numContracts}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Premium:</span>
                            <span className="ml-1 text-foreground">{formatPL(trade.premium)}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Opened:</span>
                            <span className="ml-1 text-foreground">{trade.timeOpened}</span>
                          </div>
                          {trade.timeClosed && (
                            <div>
                              <span className="text-muted-foreground">Closed:</span>
                              <span className="ml-1 text-foreground">{trade.timeClosed}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                
                {/* Daily Summary */}
                <Card className="border-dashed border-primary/30">
                  <CardContent className="pt-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between font-semibold">
                        <span>Daily Total</span>
                        <span className={
                          selectedTrades.reduce((sum, t) => sum + t.pl, 0) >= 0 
                            ? 'text-primary' 
                            : 'text-destructive'
                        }>
                          {formatPL(selectedTrades.reduce((sum, t) => sum + t.pl, 0))}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm text-muted-foreground">
                        <span>Win Rate</span>
                        <span>
                          {Math.round((selectedTrades.filter(t => t.pl > 0).length / selectedTrades.length) * 100)}%
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm text-muted-foreground">
                        <span>Wins / Losses</span>
                        <span>
                          {selectedTrades.filter(t => t.pl > 0).length} / {selectedTrades.filter(t => t.pl < 0).length}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}