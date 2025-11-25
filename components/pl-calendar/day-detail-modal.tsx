"use client"

import * as React from "react"
import { format } from "date-fns"
import { X, TrendingUp, TrendingDown, Activity } from "lucide-react"
import { useCalendarStore } from "@/lib/stores/calendar-store"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { cn, formatCurrency } from "@/lib/utils"

interface LegacySummary {
    date: Date | string
    totalPL: number
    winRate: number
    tradeCount: number
    hasDailyLog?: boolean
    reconciliationDiff?: number
    peakUtilizationPercent?: number | null
    avgUtilization?: number | null
    concurrentPositions?: number | null
}

interface LegacyTrade {
    id: string
    time: string
    strategy: string
    legsSummary: string
    pl: number
    maxProfit?: number
    maxLoss?: number
}

interface DisplayTrade {
  id: string
  time: string
  strategy: string
  legs: string
  pl: number
}

interface DayDetailModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  summary?: LegacySummary
  trades?: LegacyTrade[]
}

export function DayDetailModal({
  open,
  onOpenChange,
  summary: propSummary,
  trades: propTrades
}: DayDetailModalProps) {
  const storeSummary = useCalendarStore(s => s.getSelectedDaySummary())
  
  let summary = null
  let displayTrades: DisplayTrade[] = []

  if (propSummary) {
      summary = {
          ...propSummary,
          realizedPL: propSummary.totalPL,
          originalData: { reconciliationDiff: propSummary.reconciliationDiff },
          utilizationData: { 
              metrics: { 
                  avgUtilization: propSummary.avgUtilization,
                  concurrentPositions: propSummary.concurrentPositions
              } 
          }
      }
      displayTrades = (propTrades || []).map(t => ({
          id: t.id,
          time: t.time,
          strategy: t.strategy,
          legs: t.legsSummary,
          pl: t.pl
      }))
  } else if (storeSummary) {
      summary = storeSummary
      displayTrades = (storeSummary.trades || []).map((t, i) => ({
          id: t.id?.toString() || `trade-${i}`,
          time: t.dateOpened ? format(new Date(t.dateOpened), "HH:mm") : "-",
          strategy: t.strategy,
          legs: t.legs,
          pl: t.pl || 0
      }))
  }
  
  if (!summary) return null

  const dateObj = new Date(summary.date)
  const isPositive = summary.realizedPL >= 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl p-0 gap-0 overflow-hidden rounded-2xl bg-gradient-to-b from-neutral-900 to-neutral-950 border-neutral-800">
        <DialogHeader className="sr-only">
          <DialogTitle>Daily Performance Summary</DialogTitle>
        </DialogHeader>

        {/* Header / Top Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800/50 bg-neutral-900/50 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="h-8 w-1 rounded-full bg-primary/50" />
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-neutral-100">
                {format(dateObj, "MMMM d, yyyy")}
              </h2>
              <p className="text-xs text-neutral-400 font-medium">
                Daily Performance Review
              </p>
            </div>
          </div>
          <DialogClose className="rounded-full p-2 hover:bg-neutral-800 transition-colors text-neutral-400 hover:text-neutral-200">
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </DialogClose>
        </div>

        <div className="p-6 space-y-6">
          {/* Top Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total P/L Card */}
            <div className="relative overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900/50 p-4 flex flex-col justify-between group hover:border-neutral-700 transition-colors">
              <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                {isPositive ? (
                  <TrendingUp className="h-12 w-12 text-emerald-500" />
                ) : (
                  <TrendingDown className="h-12 w-12 text-rose-500" />
                )}
              </div>
              <span className="text-xs font-medium text-neutral-400 uppercase tracking-wider">
                Net P/L
              </span>
              <div className="mt-2 flex items-baseline gap-2">
                <span
                  className={cn(
                    "text-3xl font-bold tracking-tight",
                    isPositive ? "text-emerald-400" : "text-rose-400"
                  )}
                >
                  {formatCurrency(summary.realizedPL)}
                </span>
              </div>
            </div>

            {/* Trades Count Card */}
            <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4 flex flex-col justify-between hover:border-neutral-700 transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-neutral-400 uppercase tracking-wider">
                  Total Trades
                </span>
                <Activity className="h-4 w-4 text-neutral-500" />
              </div>
              <div className="mt-2 flex items-center gap-3">
                <span className="text-3xl font-bold text-neutral-100">
                  {summary.tradeCount}
                </span>
                <Badge variant="secondary" className="bg-neutral-800 text-neutral-300 hover:bg-neutral-700">
                  {displayTrades.length} Executed
                </Badge>
              </div>
            </div>

            {/* Win Rate & Reconciliation Card */}
            <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4 flex flex-col justify-between hover:border-neutral-700 transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-neutral-400 uppercase tracking-wider">
                  Win Rate
                </span>
                {summary.hasDailyLog && (
                  <Badge
                    variant="outline"
                    className={cn(
                      "h-5 px-1.5 text-[10px] border-opacity-30",
                      summary.originalData?.reconciliationDiff && Math.abs(summary.originalData.reconciliationDiff) > 0.01
                        ? "border-rose-500 text-rose-400 bg-rose-500/10"
                        : "border-emerald-500 text-emerald-400 bg-emerald-500/10"
                    )}
                  >
                    {summary.originalData?.reconciliationDiff && Math.abs(summary.originalData.reconciliationDiff) > 0.01
                      ? "Mismatch"
                      : "Verified"}
                  </Badge>
                )}
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span
                  className={cn(
                    "text-3xl font-bold",
                    (summary.winRate || 0) >= 50 ? "text-emerald-400" : "text-amber-400"
                  )}
                >
                  {Math.round(summary.winRate || 0)}%
                </span>
                <span className="text-xs text-neutral-500">
                  Daily Win Rate
                </span>
              </div>
            </div>

            {/* Utilization Card */}
            <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4 flex flex-col justify-between hover:border-neutral-700 transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-neutral-400 uppercase tracking-wider">
                  Utilization
                </span>
                <Activity className="h-4 w-4 text-neutral-500" />
              </div>
              <div className="mt-2 flex flex-col gap-1">
                <div className="flex items-baseline gap-2">
                    <span className={cn("text-3xl font-bold", 
                        (summary.peakUtilizationPercent || 0) > 80 ? "text-rose-400" : 
                        (summary.peakUtilizationPercent || 0) > 50 ? "text-amber-400" : "text-emerald-400"
                    )}>
                    {Math.round(summary.peakUtilizationPercent || 0)}%
                    </span>
                    <span className="text-xs text-neutral-500">Peak</span>
                </div>
                <div className="text-xs text-neutral-400">
                    Avg: {Math.round(summary.utilizationData?.metrics.avgUtilization || 0)}% · Max Pos: {summary.utilizationData?.metrics.concurrentPositions || 0}
                </div>
              </div>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[400px]">
            {/* Left Column: Trades Table */}
            <div className="lg:col-span-2 flex flex-col">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-medium text-neutral-300">
                  Trade Log
                </h3>
                <Badge variant="outline" className="text-[10px] h-5 border-neutral-700 text-neutral-400">
                  {displayTrades.length} Entries
                </Badge>
              </div>
              
              {displayTrades.length === 0 ? (
                <div className="h-32 rounded-xl border border-dashed border-neutral-800 flex items-center justify-center text-xs text-neutral-500">
                  No trades recorded for this day.
                </div>
              ) : (
                <div className="flex-1 overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900/30">
                  <div className="h-full overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-neutral-950/80 sticky top-0 z-10 backdrop-blur-sm">
                        <tr className="text-neutral-500 text-left border-b border-neutral-800">
                          <th className="px-4 py-3 font-medium w-[80px]">Time</th>
                          <th className="px-4 py-3 font-medium">Strategy</th>
                          <th className="px-4 py-3 font-medium">Legs</th>
                          <th className="px-4 py-3 font-medium text-right">P/L</th>
                        </tr>
                      </thead>
                      <tbody>
                        {displayTrades.map((trade, i) => (
                          <tr
                            key={trade.id || i}
                            className="border-b border-neutral-800/50 hover:bg-neutral-800/50 transition-colors group last:border-0"
                          >
                            <td className="px-4 py-3 font-mono text-neutral-400 group-hover:text-neutral-300">
                              {trade.time}
                            </td>
                            <td className="px-4 py-3 text-neutral-300 font-medium">
                              {trade.strategy}
                            </td>
                            <td className="px-4 py-3 text-neutral-500 truncate max-w-[180px]" title={trade.legs}>
                              {trade.legs}
                            </td>
                            <td
                              className={cn(
                                "px-4 py-3 text-right font-mono font-medium",
                                (trade.pl || 0) >= 0 ? "text-emerald-400" : "text-rose-400"
                              )}
                            >
                              {formatCurrency(trade.pl || 0)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: Timing & Notes */}
            <div className="flex flex-col gap-4">
              {/* Trade Timing Card */}
              <div className="flex-1 rounded-xl border border-neutral-800 bg-neutral-900/30 p-4 flex flex-col">
                <h3 className="text-sm font-medium text-neutral-300 mb-4">Trade Timing</h3>
                <div className="flex-1 rounded-lg border border-dashed border-neutral-800 bg-neutral-900/20 flex items-center justify-center">
                  <div className="text-center space-y-2">
                    <Activity className="h-8 w-8 text-neutral-700 mx-auto" />
                    <p className="text-xs text-neutral-600">Timeline visualization coming soon</p>
                  </div>
                </div>
              </div>

              {/* Notes Card */}
              <div className="h-[140px] rounded-xl border border-neutral-800 bg-neutral-900/30 p-4 flex flex-col">
                <h3 className="text-sm font-medium text-neutral-300 mb-2">Daily Notes</h3>
                <div className="flex-1 text-xs text-neutral-500 italic">
                  {summary.hasDailyLog ? "Daily log entry available." : "No notes added for this day."}
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
