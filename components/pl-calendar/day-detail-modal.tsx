"use client"

import * as React from "react"
import { format } from "date-fns"
import { X, TrendingUp, Repeat, Trophy, Puzzle, Activity } from "lucide-react"
import { useCalendarStore } from "@/lib/stores/calendar-store"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog"
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

function MetricCard({ title, value, sub, icon, color }: { title: string, value: React.ReactNode, sub?: string, icon: React.ReactNode, color?: string }) {
  return (
    <div className="bg-neutral-900/40 p-4 rounded-xl border border-neutral-800 h-full flex flex-col justify-between">
      <div>
        <div className="text-xs font-medium text-neutral-500 flex items-center gap-2 uppercase tracking-wider mb-2">
          {icon} {title}
        </div>
        <div className={cn("text-2xl font-semibold tracking-tight", color || "text-neutral-100")}>
          {value}
        </div>
      </div>
      {sub && <div className="text-xs text-neutral-500 mt-1 font-medium">{sub}</div>}
    </div>
  );
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
      <DialogContent className="max-w-4xl p-0 gap-0 overflow-hidden rounded-2xl bg-[#0d0f13] border-neutral-800 shadow-2xl">
        <DialogHeader className="sr-only">
          <DialogTitle>Daily Performance Summary</DialogTitle>
        </DialogHeader>

        {/* Header */}
        <div className="p-6 border-b border-neutral-800 flex items-center justify-between bg-neutral-900/20">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-neutral-100">
              {format(dateObj, "MMMM d, yyyy")}
            </h2>
            <p className="text-sm text-neutral-500 font-medium">Daily Performance Review</p>
          </div>
          <DialogClose className="rounded-full p-2 hover:bg-neutral-800 transition-colors text-neutral-400 hover:text-neutral-200">
            <X className="h-5 w-5" />
            <span className="sr-only">Close</span>
          </DialogClose>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 px-6 py-6 gap-4">
          <MetricCard 
            title="NET P/L" 
            value={formatCurrency(summary.realizedPL)} 
            color={isPositive ? "text-emerald-400" : "text-rose-400"} 
            icon={<TrendingUp className="h-4 w-4" />} 
          />
          <MetricCard 
            title="TOTAL TRADES" 
            value={summary.tradeCount} 
            sub={`${displayTrades.length} Executed`} 
            icon={<Repeat className="h-4 w-4" />} 
          />
          <MetricCard 
            title="WIN RATE" 
            value={`${Math.round(summary.winRate || 0)}%`} 
            sub="Daily Win Rate" 
            icon={<Trophy className="h-4 w-4" />} 
          />
          <MetricCard
            title="UTILIZATION"
            value={`${Math.round(summary.peakUtilizationPercent || 0)}%`}
            sub={`Avg: ${Math.round(summary.utilizationData?.metrics.avgUtilization || 0)}% • Max Pos: ${summary.utilizationData?.metrics.concurrentPositions || 0}`}
            icon={<Puzzle className="h-4 w-4" />}
          />
        </div>

        {/* Body Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 px-6 pb-8">
          {/* Trade Log */}
          <div className="lg:col-span-2">
            <h3 className="text-sm font-medium text-neutral-300 mb-3 flex items-center gap-2">
              Trade Log <span className="text-neutral-500">({displayTrades.length} Entries)</span>
            </h3>

            <div className="bg-neutral-900/30 rounded-xl border border-neutral-800 overflow-hidden max-h-[400px] flex flex-col">
              <div className="overflow-y-auto custom-scroll flex-1">
                <table className="w-full text-sm">
                  <thead className="bg-neutral-900/80 text-neutral-500 sticky top-0 backdrop-blur-sm z-10">
                    <tr className="border-b border-neutral-800">
                      <th className="p-3 text-left font-medium text-xs uppercase tracking-wider w-[80px]">Time</th>
                      <th className="p-3 text-left font-medium text-xs uppercase tracking-wider">Strategy</th>
                      <th className="p-3 text-left font-medium text-xs uppercase tracking-wider">Legs</th>
                      <th className="p-3 text-right font-medium text-xs uppercase tracking-wider">P/L</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayTrades.length === 0 && (
                      <tr>
                        <td colSpan={4} className="p-12 text-center text-neutral-500 text-xs">
                          No trades recorded for this day.
                        </td>
                      </tr>
                    )}

                    {displayTrades.map((t, idx) => (
                      <tr key={t.id || idx} className="border-b border-neutral-800/50 hover:bg-neutral-800/50 transition-colors last:border-0 group">
                        <td className="p-3 text-neutral-400 font-mono text-xs group-hover:text-neutral-300">{t.time}</td>
                        <td className="p-3 text-neutral-300 font-medium text-xs">{t.strategy}</td>
                        <td className="p-3 text-neutral-500 text-xs truncate max-w-[150px]" title={t.legs}>{t.legs}</td>
                        <td
                          className={cn(
                            "p-3 text-right font-mono font-medium text-xs",
                            (t.pl || 0) >= 0 ? "text-emerald-400" : "text-rose-400"
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

          {/* Right Panel */}
          <div className="space-y-6">
            {/* Trade Timing */}
            <div>
              <h3 className="text-sm font-medium text-neutral-300 mb-3">Trade Timing</h3>
              <div className="bg-neutral-900/30 h-40 rounded-xl border border-neutral-800 flex flex-col items-center justify-center text-neutral-500 text-xs gap-2">
                <Activity className="h-6 w-6 opacity-50" />
                <span>Timeline visualization coming soon</span>
              </div>
            </div>

            {/* Notes */}
            <div className="flex-1 flex flex-col">
              <h3 className="text-sm font-medium text-neutral-300 mb-3">Daily Notes</h3>
              <div className="bg-neutral-900/30 min-h-[120px] rounded-xl border border-neutral-800 p-4 text-neutral-500 text-xs italic flex-1">
                {summary.hasDailyLog ? "Daily log entry available." : "No notes added for this day."}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
