"use client"

import { MonthlyPLCalendar } from "./MonthlyPLCalendar"
import { CalendarDayData, CalendarColorMode } from "@/lib/services/calendar-data-service"
import { addMonths, startOfQuarter } from "date-fns"

interface QuarterlyPLViewProps {
  currentDate: Date
  dayMap: Map<string, CalendarDayData>
  colorMode: CalendarColorMode
  onDateChange: (date: Date) => void
}

export function QuarterlyPLView({ currentDate, dayMap, colorMode, onDateChange }: QuarterlyPLViewProps) {
  const quarterStart = startOfQuarter(currentDate)
  const months = [0, 1, 2].map(offset => addMonths(quarterStart, offset))

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
      {months.map(monthDate => (
        <MonthlyPLCalendar
          key={monthDate.toISOString()}
          currentDate={monthDate}
          dayMap={dayMap}
          colorMode={colorMode}
          onDateChange={onDateChange}
          compact={true}
        />
      ))}
    </div>
  )
}
