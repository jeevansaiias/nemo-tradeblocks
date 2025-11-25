"use client"

import { useEffect, useState } from "react"
import { CalendarDataService, CalendarViewMode, CalendarColorMode, CalendarDayData, CalendarStats } from "@/lib/services/calendar-data-service"
import { MonthlyPLCalendar } from "@/components/pl-calendar/MonthlyPLCalendar"
import { QuarterlyPLView } from "@/components/pl-calendar/QuarterlyPLView"
import { YearlyPLTable } from "@/components/pl-calendar/YearlyPLTable"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
    Tabs,
    TabsList,
    TabsTrigger,
} from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useBlockStore } from "@/lib/stores/block-store"
import { Calendar, Target, TrendingDown, TrendingUp } from "lucide-react"
import { formatCurrency, cn } from "@/lib/utils"
import { StoredTrade } from "@/lib/db/trades-store"

export default function CalendarPage() {
  const activeBlock = useBlockStore((state) => {
    const activeBlockId = state.activeBlockId
    return activeBlockId
      ? state.blocks.find((block) => block.id === activeBlockId)
      : null
  })

  const [dayMap, setDayMap] = useState<Map<string, CalendarDayData>>(new Map())
  const [stats, setStats] = useState<CalendarStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewMode, setViewMode] = useState<CalendarViewMode>("month")
  const [colorMode, setColorMode] = useState<CalendarColorMode>("pl")
  const [trades, setTrades] = useState<StoredTrade[]>([]) // Keep trades for YearlyPLTable compatibility for now

  useEffect(() => {
    async function loadData() {
      if (!activeBlock?.id) {
        setDayMap(new Map())
        setStats(null)
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      try {
        const { dayMap, trades } = await CalendarDataService.getCalendarData(activeBlock.id)
        const stats = CalendarDataService.getStats(dayMap)
        setDayMap(dayMap)
        setStats(stats)
        setTrades(trades)
      } catch (error) {
        console.error("Failed to load calendar data:", error)
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [activeBlock?.id])

  const handleMonthClick = (year: number, month: number) => {
    const selectedDate = new Date(year, month, 1)
    setCurrentDate(selectedDate)
    setViewMode("month")
  }

  if (!activeBlock) {
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
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            📅 P/L Calendar
          </h1>
          <p className="text-muted-foreground">
            Daily profit/loss visualization for {activeBlock.name}
          </p>
        </div>
        
        <div className="flex items-center gap-4">
            {/* Color Mode Selector */}
            <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Color by:</span>
                <Select value={colorMode} onValueChange={(v) => setColorMode(v as CalendarColorMode)}>
                    <SelectTrigger className="w-[120px]">
                        <SelectValue placeholder="Color Mode" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="pl">P/L</SelectItem>
                        <SelectItem value="count">Trade Count</SelectItem>
                        <SelectItem value="winRate">Win Rate</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* View Toggle */}
            <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as CalendarViewMode)}>
            <TabsList>
                <TabsTrigger value="month">Month</TabsTrigger>
                <TabsTrigger value="quarter">Quarter</TabsTrigger>
                <TabsTrigger value="year">Year</TabsTrigger>
            </TabsList>
            </Tabs>
        </div>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-4">
            <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total P/L</CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className={cn("text-2xl font-bold", stats.totalPL >= 0 ? 'text-green-600' : 'text-red-600')}>
                {formatCurrency(stats.totalPL)}
                </div>
                <p className="text-xs text-muted-foreground">
                {stats.totalTrades} total trades
                </p>
            </CardContent>
            </Card>

            <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Win Rate</CardTitle>
                <TrendingUp className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold text-primary">
                {stats.winRate.toFixed(1)}%
                </div>
                <p className="text-xs text-muted-foreground">
                Overall win rate
                </p>
            </CardContent>
            </Card>

            <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Best Day</CardTitle>
                <TrendingUp className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold text-green-600">
                {stats.bestDay ? formatCurrency(stats.bestDay.pl) : "$0.00"}
                </div>
                <p className="text-xs text-muted-foreground">
                {stats.bestDay ? stats.bestDay.date.toLocaleDateString() : "-"}
                </p>
            </CardContent>
            </Card>

            <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Worst Day</CardTitle>
                <TrendingDown className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold text-red-600">
                {stats.worstDay ? formatCurrency(stats.worstDay.pl) : "$0.00"}
                </div>
                <p className="text-xs text-muted-foreground">
                {stats.worstDay ? stats.worstDay.date.toLocaleDateString() : "-"}
                </p>
            </CardContent>
            </Card>
        </div>
      )}

      {/* Calendar Views */}
      <div className="space-y-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-sm text-muted-foreground">Loading calendar...</div>
            </div>
          ) : (
            <>
                {viewMode === 'month' && (
                    <MonthlyPLCalendar
                        dayMap={dayMap}
                        currentDate={currentDate}
                        onDateChange={setCurrentDate}
                        colorMode={colorMode}
                    />
                )}
                {viewMode === 'quarter' && (
                    <QuarterlyPLView
                        dayMap={dayMap}
                        currentDate={currentDate}
                        onDateChange={setCurrentDate}
                        colorMode={colorMode}
                    />
                )}
                {viewMode === 'year' && (
                    <YearlyPLTable
                        trades={trades}
                        currentYear={currentDate.getFullYear()}
                        onYearChange={(year) => setCurrentDate(new Date(year, 0, 1))}
                        onMonthClick={handleMonthClick}
                    />
                )}
            </>
          )}
      </div>
    </div>
  )
}