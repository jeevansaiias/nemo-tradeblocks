"use client"

import { useEffect } from "react"
import { useCalendarStore } from "@/lib/stores/calendar-store"
import { useBlockStore } from "@/lib/stores/block-store"
import { TradeCalendar } from "@/components/pl-calendar/trade-calendar"
import { DayDetailModal } from "@/components/pl-calendar/day-detail-modal"
import { UtilizationPanel } from "@/components/pl-calendar/utilization-panel"
import { CalendarViewMode, CalendarColorMode } from "@/lib/services/calendar-data-service"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Calendar, ChevronLeft, ChevronRight, Loader2 } from "lucide-react"
import { format, addMonths, subMonths, addYears, subYears } from "date-fns"
import { formatCurrency, cn } from "@/lib/utils"

export default function CalendarPage() {
  const activeBlockId = useBlockStore((state) => state.activeBlockId)
  const { 
    view, setView, 
    colorBy, setColorBy, 
    currentDate, setCurrentDate, 
    loadData, isLoading, 
    daySummaries,
    selectedDate, setSelectedDate
  } = useCalendarStore()

  useEffect(() => {
    if (activeBlockId) {
      loadData(activeBlockId)
    }
  }, [activeBlockId, view, currentDate, colorBy, loadData])

  const handlePrevious = () => {
    if (view === 'month') setCurrentDate(subMonths(currentDate, 1))
    else if (view === 'quarter') setCurrentDate(subMonths(currentDate, 3))
    else if (view === 'year') setCurrentDate(subYears(currentDate, 1))
  }

  const handleNext = () => {
    if (view === 'month') setCurrentDate(addMonths(currentDate, 1))
    else if (view === 'quarter') setCurrentDate(addMonths(currentDate, 3))
    else if (view === 'year') setCurrentDate(addYears(currentDate, 1))
  }

  // Calculate view stats
  const totalPL = daySummaries.reduce((sum, day) => sum + day.realizedPL, 0)
  const totalTrades = daySummaries.reduce((sum, day) => sum + day.tradeCount, 0)
  const winRate = totalTrades > 0 
    ? (daySummaries.reduce((sum, day) => sum + (day.originalData?.trades.filter(t => (t.pl || 0) > 0).length || 0), 0) / totalTrades) * 100 
    : 0

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
            {format(currentDate, view === 'year' ? 'yyyy' : 'MMMM yyyy')}
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
              {formatCurrency(totalPL)}
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
        <TradeCalendar />
      )}

      {/* Utilization Panel */}
      <UtilizationPanel data={daySummaries} />

      {/* Detail Modal */}
      <DayDetailModal 
        open={!!selectedDate} 
        onOpenChange={(open) => !open && setSelectedDate(null)}
        summary={selectedDate ? (() => {
            const s = daySummaries.find(s => s.date === format(selectedDate, 'yyyy-MM-dd'))
            if (!s) return null
            return {
                date: s.date,
                totalPL: s.realizedPL,
                winRate: s.winRate || 0,
                tradeCount: s.tradeCount,
                hasDailyLog: s.hasDailyLog,
                reconciliationDiff: s.originalData?.reconciliationDiff,
                peakUtilizationPercent: s.peakUtilizationPercent,
                avgUtilization: s.utilizationData?.metrics.avgUtilization,
                concurrentPositions: s.utilizationData?.metrics.concurrentPositions
            }
        })() : null}
        trades={selectedDate ? (daySummaries.find(s => s.date === format(selectedDate, 'yyyy-MM-dd'))?.originalData?.trades.map((t, i) => ({
            id: t.id?.toString() || `trade-${i}`,
            time: t.dateOpened ? format(new Date(t.dateOpened), "HH:mm") : "-",
            strategy: t.strategy,
            legsSummary: t.legs,
            pl: t.pl || 0,
            maxProfit: t.maxProfit,
            maxLoss: t.maxLoss
        })) || []) : []}
        intradaySnapshots={selectedDate ? (daySummaries.find(s => s.date === format(selectedDate, 'yyyy-MM-dd'))?.utilizationData?.intradaySnapshots || []) : []}
      />
    </div>
  )
}