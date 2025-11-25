"use client"

import { useEffect, useState } from "react"
import { useCalendarStore } from "@/lib/stores/calendar-store"
import { useBlockStore } from "@/lib/stores/block-store"
import { MonthlyPLCalendar } from "@/components/pl-calendar/MonthlyPLCalendar"
import { WeeklySummaryPanel } from "@/components/pl-calendar/weekly-summary-panel"
import { YearHeatmap } from "@/components/pl-calendar/YearHeatmap"
import { UtilizationPanel } from "@/components/pl-calendar/utilization-panel"
import { CalendarViewMode, CalendarColorMode, CalendarDayData, WeeklySummary, WeeklyBucket } from "@/lib/services/calendar-data-service"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Calendar, ChevronLeft, ChevronRight, Loader2 } from "lucide-react"
import { format, addMonths, subMonths, addYears, subYears, getQuarter, addQuarters, subQuarters, startOfQuarter, isSameMonth, parseISO, startOfMonth } from "date-fns"
import { formatCurrency, cn } from "@/lib/utils"

import { formatCompactPL } from "@/lib/utils/format"

/*
Copilot prompt:

“Refactor the P/L Calendar monthly view to match the Year view layout.
	•	The Year view already uses a nice 7-column grid of DayCell-style tiles. Reuse that same visual style for the Month view: a full-width, responsive 7-column grid with consistent gaps and a minimum height.
	•	For Month view, use a two-column layout: left is the month grid, right is a MonthlyWeeklySummary card that shows only the weeks which intersect the selected month. The weekly panel should be a rounded card with a header (‘Weekly summary’) and a scrollable list of WeekSummaryCard rows; do not render the old tall ‘Weekly Summary’ section that takes the entire right side.
	•	Implement a helper buildMonthWeeks(trades, monthStart) that groups trades into weeks and then clips weeks to the selected month by filtering trades to monthStart.startOf('month')..monthStart.endOf('month'). Use that helper to feed MonthlyWeeklySummary.
	•	Make the Yearly P/L grid interactive: each month tile should call onMonthDrillDown({ year, monthIndex }) that switches the calendar to Month view and sets the current cursor.
	•	Extract a shared formatCompactPL(value: number) utility that returns values like ‘1.12M’, ‘648.3K’, or ‘325’ and use it across monthly cells, yearly cells, weekly summary cards, and modal headers.
	•	Keep Utilization Trend and Risk Heatmap as a shared footer under both Month and Year views, in a 2-column responsive grid.
	•	Preserve existing props, types, and store wiring from the feature/pl-calendar-drilldown branch so data continues to flow correctly.”
*/

function getMonthlyWeeklyBuckets(
  monthStart: Date,
  weeklySummaries: WeeklySummary[]
): WeeklyBucket[] {
  const month = monthStart.getMonth();
  const year = monthStart.getFullYear();

  return weeklySummaries
    .filter((w) => {
      const start = parseISO(w.startDate);
      const end = parseISO(w.endDate);
      // Include if the week overlaps with the month
      return (start.getFullYear() === year && start.getMonth() === month) ||
             (end.getFullYear() === year && end.getMonth() === month);
    })
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
    .map((w, idx) => ({
      weekIndex: idx + 1,
      startDate: parseISO(w.startDate),
      endDate: parseISO(w.endDate),
      netPL: w.netPL,
      tradeCount: w.trades,
      daysTraded: w.daysTraded,
      winRate: w.winRate
    }));
}

export default function CalendarPage() {
  const activeBlockId = useBlockStore((state) => state.activeBlockId)
  const { 
    view, setView, 
    colorBy, setColorBy, 
    currentDate, setCurrentDate, 
    loadData, isLoading, 
    daySummaries,
    weeklySummaries,
    yearlySnapshot
  } = useCalendarStore()

  const [highlightedWeek, setHighlightedWeek] = useState<WeeklyBucket | null>(null)

  useEffect(() => {
    if (activeBlockId) {
      loadData(activeBlockId)
    }
  }, [activeBlockId, view, currentDate, colorBy, loadData])

  useEffect(() => {
    setHighlightedWeek(null)
  }, [view, currentDate])

  const handlePrevious = () => {
    if (view === 'month') setCurrentDate(subMonths(currentDate, 1))
    else if (view === 'quarter') setCurrentDate(subQuarters(currentDate, 1))
    else if (view === 'year') setCurrentDate(subYears(currentDate, 1))
  }

  const handleNext = () => {
    if (view === 'month') setCurrentDate(addMonths(currentDate, 1))
    else if (view === 'quarter') setCurrentDate(addQuarters(currentDate, 1))
    else if (view === 'year') setCurrentDate(addYears(currentDate, 1))
  }

  const handleMonthClick = (year: number, monthIndex: number) => {
    const newDate = new Date(year, monthIndex, 1);
    setCurrentDate(newDate);
    setView('month');
  };

  const getHeaderLabel = () => {
    if (view === 'month') return format(currentDate, 'MMMM yyyy')
    if (view === 'quarter') return `Q${getQuarter(currentDate)} ${format(currentDate, 'yyyy')}`
    return format(currentDate, 'yyyy')
  }

  // Calculate view stats
  const totalPL = daySummaries.reduce((sum, day) => sum + day.realizedPL, 0)
  const totalTrades = daySummaries.reduce((sum, day) => sum + day.tradeCount, 0)
  const winRate = totalTrades > 0 
    ? (daySummaries.reduce((sum, day) => sum + (day.originalData?.trades.filter(t => (t.pl || 0) > 0).length || 0), 0) / totalTrades) * 100 
    : 0

  // Prepare data for views
  const dayMap = new Map<string, CalendarDayData>(
    daySummaries
      .filter(s => s.originalData)
      .map(s => [s.date, s.originalData as CalendarDayData])
  )

  const monthStart = startOfMonth(currentDate)
  const monthlyWeeks = getMonthlyWeeklyBuckets(monthStart, weeklySummaries)

  if (!activeBlockId) {
      return (
        <div className="flex h-64 items-center justify-center">
          <Card className="max-w-md text-center">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                No Active Block Selected
              </CardTitle>
              <CardDescription>
                Choose a block from the sidebar to view your trading calendar.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      )
  }

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={handlePrevious}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-2xl font-bold min-w-[200px] text-center">
            {getHeaderLabel()}
          </h2>
          <Button variant="outline" size="icon" onClick={handleNext}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Select value={view} onValueChange={(v) => setView(v as CalendarViewMode)}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="View" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="month">Month</SelectItem>
              <SelectItem value="quarter">Quarter</SelectItem>
              <SelectItem value="year">Year</SelectItem>
            </SelectContent>
          </Select>

          <Select value={colorBy} onValueChange={(v) => setColorBy(v as CalendarColorMode)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Color By" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pl">P/L</SelectItem>
              <SelectItem value="utilization">Utilization</SelectItem>
              <SelectItem value="count">Trade Count</SelectItem>
              <SelectItem value="risk">Risk</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Stats Summary (for current view) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Period P/L</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={cn("text-2xl font-bold", totalPL >= 0 ? "text-emerald-500" : "text-rose-500")}>
              {formatCompactPL(totalPL)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Trades</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalTrades}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Win Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={cn("text-2xl font-bold", winRate >= 50 ? "text-emerald-500" : "text-amber-500")}>
              {winRate.toFixed(1)}%
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Calendar Grid */}
      {isLoading ? (
        <div className="h-[400px] flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="mt-6">
          {view === 'year' && yearlySnapshot ? (
             <YearHeatmap 
                data={yearlySnapshot} 
                metric="pl" 
                onMonthClick={handleMonthClick}
             />
          ) : view === 'quarter' ? (
             <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
                {[0, 1, 2].map((offset) => {
                    const qStart = startOfQuarter(currentDate);
                    const monthDate = addMonths(qStart, offset);
                    return (
                        <div key={offset} className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-4">
                            <div className="mb-4 text-center font-mono text-sm font-medium text-zinc-400">
                                {format(monthDate, 'MMMM yyyy')}
                            </div>
                            <MonthlyPLCalendar
                                currentDate={monthDate}
                                dayMap={dayMap}
                                colorMode={colorBy}
                                onDateChange={() => {}}
                                showHeader={false}
                            />
                        </div>
                    )
                })}
             </div>
          ) : (
             <div className="grid grid-cols-[minmax(0,3fr)_minmax(260px,1.2fr)] gap-6 xl:grid-cols-[minmax(0,4fr)_minmax(280px,1.3fr)]">
                <div className="min-w-0">
                    <MonthlyPLCalendar
                    currentDate={currentDate}
                    dayMap={dayMap}
                    colorMode={colorBy}
                    onDateChange={setCurrentDate}
                    showHeader={false}
                    highlightedWeek={highlightedWeek}
                    />
                </div>
        <WeeklySummaryPanel 
          monthStart={monthStart}
          weeks={monthlyWeeks}
          metric={colorBy}
          onWeekHover={setHighlightedWeek}
        />
             </div>
          )}
        </div>
      )}

      {/* Utilization Panel */}
      <UtilizationPanel data={daySummaries} />
    </div>
  )
}