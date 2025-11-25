"use client"

import { useCalendarStore } from "@/lib/stores/calendar-store"
import { format, startOfWeek, endOfWeek, eachDayOfInterval, startOfMonth, endOfMonth } from "date-fns"
import { Card, CardContent } from "@/components/ui/card"
import { DayCell } from "./day-cell"

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function CalendarGrid() {
  const { currentDate, daySummaries, colorBy, setSelectedDate } = useCalendarStore()
  
  // Generate calendar days
  const start = startOfWeek(startOfMonth(currentDate))
  const end = endOfWeek(endOfMonth(currentDate))
  const calendarDays = eachDayOfInterval({ start, end })
  
  const summaryMap = new Map(daySummaries.map(s => [s.date, s]))

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
            
            return (
              <DayCell
                key={dateKey}
                summary={summary}
                date={date}
                currentDate={currentDate}
                colorBy={colorBy}
                onClick={() => summary && setSelectedDate(date)}
              />
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
