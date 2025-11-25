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

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { CalendarDayData, CalendarColorMode } from "@/lib/services/calendar-data-service"
import { cn } from "@/lib/utils"
import { formatCompactPL } from "@/lib/utils/format"
import { DayDetailModal } from "./day-detail-modal"

interface MonthlyPLCalendarProps {
  dayMap: Map<string, CalendarDayData>
  currentDate: Date
  onDateChange: (date: Date) => void
  colorMode?: CalendarColorMode
  compact?: boolean
  showHeader?: boolean
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

export function MonthlyPLCalendar({ dayMap, currentDate, onDateChange, colorMode = "pl", compact = false, showHeader = true }: MonthlyPLCalendarProps) {
  const [selectedDayData, setSelectedDayData] = useState<CalendarDayData | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  // Generate calendar days for the month
  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentDate))
    const end = endOfWeek(endOfMonth(currentDate))
    
    return eachDayOfInterval({ start, end }).map(date => {
      const dateString = format(date, 'yyyy-MM-dd')
      const dayData = dayMap.get(dateString)
      
      return {
        date,
        pl: dayData?.pl || 0,
        tradeCount: dayData?.tradeCount || 0,
        winRate: dayData?.winRate || 0,
        trades: dayData?.trades || [],
        dailyLog: dayData?.dailyLog,
        reconciliationDiff: dayData?.reconciliationDiff,
        hasData: !!dayData
      }
    })
  }, [currentDate, dayMap])

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

  const handleDateClick = (dayData: CalendarDayData) => {
    setSelectedDayData(dayData)
    setIsModalOpen(true)
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

  const getDayColor = (dayData: CalendarDayData, hasData: boolean) => {
    if (!hasData) return 'bg-muted/10'
    
    if (colorMode === 'pl') {
      if (dayData.pl > 0) return 'bg-green-500/20 hover:bg-green-500/30 border-green-500/50'
      if (dayData.pl < 0) return 'bg-red-500/20 hover:bg-red-500/30 border-red-500/50'
      return 'bg-muted hover:bg-muted/80'
    } else if (colorMode === 'count') {
      if (dayData.tradeCount > 5) return 'bg-blue-500/40 hover:bg-blue-500/50 border-blue-500/50'
      if (dayData.tradeCount > 2) return 'bg-blue-500/20 hover:bg-blue-500/30 border-blue-500/50'
      return 'bg-blue-500/10 hover:bg-blue-500/20 border-blue-500/30'
    } else if (colorMode === 'winRate') {
      if (dayData.winRate >= 50) return 'bg-emerald-500/20 hover:bg-emerald-500/30 border-emerald-500/50'
      return 'bg-rose-500/20 hover:bg-rose-500/30 border-rose-500/50'
    }
    return 'bg-muted'
  }

  const getDayTextColor = (pl: number, hasData: boolean) => {
    if (!hasData) return 'text-muted-foreground'
    if (colorMode === 'pl') {
        if (pl > 0) return 'text-green-600 dark:text-green-400'
        if (pl < 0) return 'text-red-600 dark:text-red-400'
    }
    return 'text-foreground'
  }

  return (
    <div className="space-y-6">
      {/* Month Navigation */}
        {!compact && showHeader && (
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
        )}
        
        {compact && (
           <h3 className="text-lg font-semibold text-center mb-2">{format(currentDate, 'MMMM yyyy')}</h3>
        )}

        {/* Main Container with Proper Alignment */}
        <div className={cn("flex flex-col items-start gap-6", compact ? "" : "md:flex-row")}>
          {/* Calendar Grid Container */}
          <div className={cn("w-full", compact ? "" : "md:w-3/4")}>
            <Card className="monthly-calendar">
              <CardContent className="p-4">
                {/* Weekday Headers */}
                <div className="grid grid-cols-7 gap-2 mb-4">
                  {WEEKDAYS.map(day => (
                    <div
                      key={day}
                      className="text-center text-xs font-medium text-muted-foreground py-1"
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
                      className={cn(
                        "relative p-1 rounded-lg border cursor-pointer transition-all duration-200 flex flex-col justify-between overflow-hidden",
                        compact ? "min-h-[60px]" : "min-h-[80px]",
                        getDayColor(dayData, hasData),
                        isCurrentMonth ? 'border-border' : 'border-transparent opacity-40',
                        isCurrentMonth && hasData ? 'hover:scale-105 hover:shadow-lg' : ''
                      )}
                    >
                      {/* Date Number */}
                      <div className={cn("text-xs font-semibold", getDayTextColor(dayData.pl, hasData))}>
                        {format(dayData.date, 'd')}
                      </div>
                      
                      {/* Trade Data */}
                      {isCurrentMonth && hasData && (
                        <div className="mt-1 space-y-0.5">
                          <div className={cn("text-[10px] font-bold truncate", getDayTextColor(dayData.pl, hasData))}>
                            {colorMode === 'pl' && formatCompactPL(dayData.pl)}
                            {colorMode === 'count' && `${dayData.tradeCount} trades`}
                            {colorMode === 'winRate' && `${Math.round(dayData.winRate)}%`}
                          </div>
                          {!compact && (
                              <>
                                  <div className="text-[10px] text-muted-foreground truncate">
                                  {dayData.tradeCount} trade{dayData.tradeCount !== 1 ? 's' : ''}
                                  </div>
                                  <div className="text-[10px] text-muted-foreground truncate">
                                  {Math.round(dayData.winRate)}% win
                                  </div>
                              </>
                          )}
                        </div>
                      )}
                      
                      {/* Today Indicator */}
                      {isSameDay(dayData.date, new Date()) && (
                        <div className="absolute top-1 right-1 w-1.5 h-1.5 bg-primary rounded-full"></div>
                      )}
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Weekly Summary Sidebar */}
        {!compact && (
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
                      <p className={cn("font-semibold", week.totalPL >= 0 ? "text-green-600" : "text-red-600")}>
                      {formatCompactPL(week.totalPL)}
                      </p>
                  </div>
                  ))}
              </CardContent>
              </Card>
          </div>
        )}
      </div>

      <DayDetailModal 
          open={isModalOpen} 
          onOpenChange={setIsModalOpen} 
          summary={selectedDayData ? {
            date: selectedDayData.date,
            totalPL: selectedDayData.pl,
            winRate: selectedDayData.winRate,
            tradeCount: selectedDayData.tradeCount,
            hasDailyLog: !!selectedDayData.dailyLog,
            reconciliationDiff: selectedDayData.reconciliationDiff
          } : undefined}
          trades={selectedDayData?.trades.map((t, i) => ({
            id: t.id?.toString() || `trade-${i}`,
            time: t.dateOpened ? format(new Date(t.dateOpened), "HH:mm") : "-",
            strategy: t.strategy,
            legsSummary: t.legs,
            pl: t.pl || 0,
            maxProfit: t.maxProfit,
            maxLoss: t.maxLoss
          })) || []}
      />
    </div>
  )
}