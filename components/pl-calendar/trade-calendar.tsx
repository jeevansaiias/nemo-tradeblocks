"use client"

import { useCalendarStore } from "@/lib/stores/calendar-store"
import { CalendarDaySummary } from "@/lib/services/calendar-data-service"
import { format, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, startOfMonth, endOfMonth } from "date-fns"
import { cn, formatCurrency } from "@/lib/utils"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function TradeCalendar() {
  const { currentDate, daySummaries, colorBy, setSelectedDate } = useCalendarStore()
  
  // Generate calendar days
  const start = startOfWeek(startOfMonth(currentDate))
  const end = endOfWeek(endOfMonth(currentDate))
  const calendarDays = eachDayOfInterval({ start, end })
  
  const summaryMap = new Map(daySummaries.map(s => [s.date, s]))

  const getCellColor = (summary: CalendarDaySummary | undefined, isCurrentMonth: boolean) => {
    if (!summary) return "bg-muted/5 border-transparent"
    if (!isCurrentMonth) return "bg-muted/5 opacity-50 border-transparent"
    
    switch (colorBy) {
      case "pl":
        if (summary.realizedPL > 0) return "bg-emerald-500/10 border-emerald-500/20 hover:bg-emerald-500/20"
        if (summary.realizedPL < 0) return "bg-rose-500/10 border-rose-500/20 hover:bg-rose-500/20"
        return "bg-muted/10 hover:bg-muted/20 border-neutral-800"
      case "utilization":
        if (summary.utilizationBucket === "extreme") return "bg-red-500/20 border-red-500/30"
        if (summary.utilizationBucket === "high") return "bg-orange-500/20 border-orange-500/30"
        if (summary.utilizationBucket === "medium") return "bg-yellow-500/20 border-yellow-500/30"
        return "bg-emerald-500/10 border-emerald-500/20"
      case "count":
        if (summary.tradeCount > 5) return "bg-blue-500/20 border-blue-500/30"
        if (summary.tradeCount > 0) return "bg-blue-500/10 border-blue-500/20"
        return "bg-muted/10 border-neutral-800"
      case "risk":
         return "bg-purple-500/10 border-purple-500/20"
      default:
        return "bg-muted/10 border-neutral-800"
    }
  }

  return (
    <Card className="border-neutral-800 bg-neutral-900/50">
      <CardContent className="p-4">
        <div className="grid grid-cols-7 gap-2 mb-2">
          {WEEKDAYS.map(day => (
            <div key={day} className="text-center text-xs font-medium text-muted-foreground py-2">
              {day}
            </div>
          ))}
        </div>
        
        <div className="grid grid-cols-7 gap-2">
          {calendarDays.map((date) => {
            const dateKey = format(date, 'yyyy-MM-dd')
            const summary = summaryMap.get(dateKey)
            const isCurrentMonth = isSameMonth(date, currentDate)
            const isToday = isSameDay(date, new Date())
            
            return (
              <div
                key={dateKey}
                onClick={() => summary && setSelectedDate(date)}
                className={cn(
                  "min-h-[100px] p-2 rounded-lg border transition-all cursor-pointer flex flex-col justify-between relative group",
                  getCellColor(summary, isCurrentMonth),
                  isToday ? "ring-1 ring-primary" : "",
                  !summary && "pointer-events-none"
                )}
              >
                <div className="flex justify-between items-start">
                  <span className={cn(
                    "text-xs font-medium",
                    !isCurrentMonth && "text-muted-foreground/50"
                  )}>
                    {format(date, 'd')}
                  </span>
                  {summary && summary.tradeCount > 0 && (
                    <Badge variant="secondary" className="h-5 px-1.5 text-[10px] bg-background/50 backdrop-blur-sm">
                      {summary.tradeCount}
                    </Badge>
                  )}
                </div>
                
                {summary && (
                  <div className="space-y-1 mt-2">
                    {summary.realizedPL !== 0 && (
                      <div className={cn(
                        "text-sm font-bold truncate",
                        summary.realizedPL > 0 ? "text-emerald-500" : "text-rose-500"
                      )}>
                        {formatCurrency(summary.realizedPL)}
                      </div>
                    )}
                    
                    {summary.utilizationPercent !== null && summary.utilizationPercent > 0 && (
                      <div className="w-full bg-neutral-800/50 h-1.5 rounded-full overflow-hidden mt-2">
                        <div 
                          className={cn("h-full rounded-full", 
                            summary.utilizationBucket === "extreme" ? "bg-red-500" :
                            summary.utilizationBucket === "high" ? "bg-orange-500" :
                            summary.utilizationBucket === "medium" ? "bg-yellow-500" : "bg-emerald-500"
                          )}
                          style={{ width: `${Math.min(summary.utilizationPercent, 100)}%` }}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
