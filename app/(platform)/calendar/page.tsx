"use client"

// date-fns formatting used inside MonthlyPLCalendar and Monthly drawer component
import { useEffect, useState } from "react"

import { MonthlyPLCalendar } from "@/components/pl-calendar/MonthlyPLCalendar"
import { YearlyPLTable } from "@/components/pl-calendar/YearlyPLTable"
// MonthlyPLCalendar provides its own drawer. Page-level dialog and badge imports removed.
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@/components/ui/tabs"
import { getTradesByBlock } from "@/lib/db"
import type { StoredTrade } from "@/lib/db/trades-store"
import {
  aggregateDailyPL,
  calculateCalendarStats,
  formatPL,
  type DailyPLData,
} from "@/lib/processing/pl-calendar"
import { useBlockStore } from "@/lib/stores/block-store"
import { Calendar, Target, TrendingDown, TrendingUp } from "lucide-react"

export default function CalendarPage() {
  const activeBlock = useBlockStore((state) => {
    const activeBlockId = state.activeBlockId
    return activeBlockId
      ? state.blocks.find((block) => block.id === activeBlockId)
      : null
  })

  const [trades, setTrades] = useState<StoredTrade[]>([])
  const [dailyPL, setDailyPL] = useState<DailyPLData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear())
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [viewMode, setViewMode] = useState<"yearly" | "monthly">("yearly")

  const stats = calculateCalendarStats(dailyPL)

  useEffect(() => {
    async function loadTrades() {
      if (!activeBlock?.id) {
        setTrades([])
        setDailyPL([])
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      try {
        const blockTrades = await getTradesByBlock(activeBlock.id)
        setTrades(blockTrades)
        
        const aggregated = aggregateDailyPL(blockTrades)
        setDailyPL(aggregated)
      } catch (error) {
        console.error("Failed to load trades:", error)
        setTrades([])
        setDailyPL([])
      } finally {
        setIsLoading(false)
      }
    }

    loadTrades()
  }, [activeBlock?.id])

  // Date click handler removed — MonthlyPLCalendar currently uses onDateChange prop

  const handleMonthClick = (year: number, month: number) => {
    // Create a date for the selected month and year
    const selectedDate = new Date(year, month, 1)
    setCurrentMonth(selectedDate)
    setViewMode("monthly")
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            📅 P/L Calendar
          </h1>
          <p className="text-muted-foreground">
            Daily profit/loss visualization for {activeBlock.name}
          </p>
        </div>
        
        {/* View Toggle */}
        <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as "yearly" | "monthly")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="yearly">Yearly</TabsTrigger>
            <TabsTrigger value="monthly">Monthly</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total P/L</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${stats.totalPL >= 0 ? 'text-primary' : 'text-destructive'}`}>
              {formatPL(stats.totalPL)}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats.totalTrades} total trades
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Win Days</CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {stats.winDays}
            </div>
            <p className="text-xs text-muted-foreground">
              Avg: {formatPL(stats.avgWin)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Loss Days</CardTitle>
            <TrendingDown className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {stats.lossDays}
            </div>
            <p className="text-xs text-muted-foreground">
              Avg: {formatPL(stats.avgLoss)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Win Rate</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {stats.winDays + stats.lossDays > 0 
                ? Math.round((stats.winDays / (stats.winDays + stats.lossDays)) * 100)
                : 0}%
            </div>
            <p className="text-xs text-muted-foreground">
              Daily win percentage
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Calendar Views */}
      <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as "yearly" | "monthly")}>
        <TabsContent value="yearly" className="space-y-6">
          {/* Yearly P/L Table */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-sm text-muted-foreground">Loading calendar...</div>
            </div>
          ) : (
            <YearlyPLTable
              trades={trades}
              currentYear={currentYear}
              onYearChange={setCurrentYear}
              onMonthClick={handleMonthClick}
            />
          )}
        </TabsContent>

        <TabsContent value="monthly" className="space-y-6">
          {/* Monthly Calendar */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-sm text-muted-foreground">Loading calendar...</div>
            </div>
          ) : (
            <MonthlyPLCalendar
              trades={trades}
              dailyPL={dailyPL}
              currentDate={currentMonth}
              onDateChange={setCurrentMonth}
            />
          )}
        </TabsContent>
      </Tabs>

      {/* Monthly calendar uses its own drawer for trade details */}
    </div>
  )
}