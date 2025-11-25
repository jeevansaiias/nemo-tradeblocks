/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import * as React from "react"
import { format } from "date-fns"
import { Activity, TrendingUp, Repeat, Trophy, Puzzle, X, Clock, FileText } from "lucide-react"
import { useCalendarStore } from "@/lib/stores/calendar-store"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog"
import { Card } from "@/components/ui/card"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn, formatCurrency } from "@/lib/utils"

interface DayDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  summary?: any;
  trades?: any[];
}

function MetricCard({
  title,
  value,
  sub,
  icon,
  color,
}: {
  title: string
  value: React.ReactNode
  sub?: string
  icon: React.ReactNode
  color?: string
}) {
  return (
    <Card className="bg-muted/20 p-6 rounded-xl border border-border/50 flex flex-col justify-between shadow-sm hover:bg-muted/30 transition-colors">
      <div>
        <div className="text-xs font-medium text-muted-foreground flex items-center gap-2 uppercase tracking-wider mb-3">
          {icon} {title}
        </div>
        <div
          className={cn(
            "text-3xl font-bold tracking-tight",
            color || "text-foreground"
          )}
        >
          {value}
        </div>
      </div>
      {sub && (
        <div className="text-xs text-muted-foreground mt-2 font-medium">{sub}</div>
      )}
    </Card>
  )
}

export function DayDetailModal({ open, onOpenChange, summary: propSummary, trades: propTrades }: DayDetailModalProps) {
  const storeSummary = useCalendarStore((s) => s.getSelectedDaySummary())
  
  // Use prop summary if available (from MonthlyPLCalendar), otherwise use store summary
  const summary = propSummary || storeSummary

  if (!summary) return null

  const dateObj = new Date(summary.date)
  const isPositive = (summary.realizedPL || summary.totalPL || 0) >= 0
  const realizedPL = summary.realizedPL ?? summary.totalPL ?? 0
  const tradeCount = summary.tradeCount ?? (propTrades?.length || summary.trades?.length || 0)
  const winRate = summary.winRate ?? 0

  // Map trades to display format
  const tradesToMap = propTrades || summary.trades || []
  const displayTrades = tradesToMap.map((t: any, i: number) => {
    // Handle pre-formatted trades from MonthlyPLCalendar
    if (t.time && (t.legsSummary || t.legs)) {
      return {
        id: t.id?.toString() || `trade-${i}`,
        time: t.time,
        strategy: t.strategy || "Unknown",
        legs: t.legsSummary || t.legs || "-",
        pl: t.pl || 0,
      }
    }
    
    // Handle raw StoredTrade objects
    return {
      id: t.id?.toString() || `trade-${i}`,
      time: t.dateOpened ? format(new Date(t.dateOpened), "HH:mm") : "-",
      strategy: t.strategy || "Unknown",
      legs: t.legs || "-",
      pl: t.pl || 0,
    }
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[1000px] p-0 gap-0 overflow-hidden rounded-2xl bg-background border-border shadow-2xl flex flex-col max-h-[90vh]">
        <DialogHeader className="sr-only">
          <DialogTitle>Daily Performance Review</DialogTitle>
        </DialogHeader>

        {/* Header */}
        <div className="p-6 border-b border-border flex items-center justify-between bg-muted/10">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">
              {format(dateObj, "MMMM d, yyyy")}
            </h2>
            <p className="text-sm text-muted-foreground font-medium mt-1">
              Daily Performance Review
            </p>
          </div>
          <DialogClose className="rounded-full p-2 hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
            <span className="sr-only">Close</span>
          </DialogClose>
        </div>

        <div className="overflow-y-auto flex-1">
          <div className="p-6 space-y-8">
            {/* Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <MetricCard
                title="NET P/L"
                value={formatCurrency(realizedPL)}
                color={isPositive ? "text-emerald-500" : "text-rose-500"}
                icon={<TrendingUp className="h-4 w-4" />}
              />
              <MetricCard
                title="TOTAL TRADES"
                value={tradeCount}
                sub={`${displayTrades.length} Executed`}
                icon={<Repeat className="h-4 w-4" />}
              />
              <MetricCard
                title="WIN RATE"
                value={`${Math.round(winRate || 0)}%`}
                sub="Daily Win Rate"
                icon={<Trophy className="h-4 w-4" />}
              />
              <MetricCard
                title="UTILIZATION"
                value={`${Math.round(summary.peakUtilizationPercent || 0)}%`}
                sub={`Avg: ${Math.round(
                  summary.utilizationData?.metrics?.avgUtilization || 0
                )}% • Max Pos: ${
                  summary.utilizationData?.metrics?.concurrentPositions || 0
                }`}
                icon={<Puzzle className="h-4 w-4" />}
              />
            </div>

            {/* Body Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-8">
              {/* Left Column: Trade Log */}
              <div className="flex flex-col space-y-4">
                <h3 className="text-lg font-semibold text-foreground/80 flex items-center gap-2">
                  Trade Log
                  <span className="text-sm font-normal text-muted-foreground ml-2">
                    ({displayTrades.length} Entries)
                  </span>
                </h3>

                <div className="rounded-xl border border-border overflow-hidden bg-card">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50 text-muted-foreground border-b border-border">
                        <tr>
                          <th className="px-4 py-3 text-left font-medium text-xs uppercase tracking-wider w-[100px]">
                            Time
                          </th>
                          <th className="px-4 py-3 text-left font-medium text-xs uppercase tracking-wider">
                            Strategy
                          </th>
                          <th className="px-4 py-3 text-right font-medium text-xs uppercase tracking-wider">
                            Legs
                          </th>
                          <th className="px-4 py-3 text-right font-medium text-xs uppercase tracking-wider">
                            P/L
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/50">
                        {displayTrades.length === 0 && (
                          <tr>
                            <td
                              colSpan={4}
                              className="p-12 text-center text-muted-foreground text-sm"
                            >
                              No trades recorded for this day.
                            </td>
                          </tr>
                        )}

                        {displayTrades.map((t: any, idx: number) => (
                          <tr
                            key={t.id || idx}
                            className="hover:bg-muted/30 transition-colors group"
                          >
                            <td className="px-4 py-3 text-muted-foreground font-mono text-xs group-hover:text-foreground">
                              {t.time}
                            </td>
                            <td className="px-4 py-3 text-foreground font-medium text-sm">
                              <div className="truncate max-w-[180px]" title={t.strategy}>
                                {t.strategy}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-muted-foreground text-xs text-right">
                              <div className="truncate max-w-[120px] ml-auto" title={t.legs}>
                                {t.legs}
                              </div>
                            </td>
                            <td
                              className={cn(
                                "px-4 py-3 text-right font-mono font-medium text-sm",
                                (t.pl || 0) >= 0
                                  ? "text-emerald-500"
                                  : "text-rose-500"
                              )}
                            >
                              {formatCurrency(t.pl || 0)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Right Column: Timing & Notes */}
              <div className="flex flex-col space-y-8">
                {/* Trade Timing */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-foreground/80 flex items-center gap-2">
                    Trade Timing
                  </h3>
                  <div className="bg-muted/20 h-40 rounded-xl border border-dashed border-border flex flex-col items-center justify-center text-muted-foreground text-sm gap-3">
                    <Clock className="h-6 w-6 opacity-50" />
                    <span>Timing analysis coming soon</span>
                  </div>
                </div>

                {/* Daily Notes */}
                <div className="space-y-4 flex-1 flex flex-col">
                  <h3 className="text-lg font-semibold text-foreground/80 flex items-center gap-2">
                    Daily Notes
                  </h3>
                  <Card className="bg-muted/20 flex-1 min-h-[150px] rounded-xl border border-border p-0 overflow-hidden shadow-none">
                    <div className="p-4 h-full">
                      {summary.hasDailyLog ? (
                        <div className="flex items-start gap-3 text-sm text-foreground/90">
                          <FileText className="h-4 w-4 mt-0.5 text-primary" />
                          <p>Daily log entry available.</p>
                        </div>
                      ) : (
                        <textarea
                          className="w-full h-full bg-transparent text-sm text-muted-foreground resize-none focus:outline-none placeholder:text-muted-foreground/50"
                          placeholder="No notes added for this day."
                          disabled
                        />
                      )}
                    </div>
                  </Card>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
