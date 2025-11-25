/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import * as React from "react"
import { format } from "date-fns"
import { useCalendarStore } from "@/lib/stores/calendar-store"
import { formatCurrency } from "@/lib/utils"

import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog"

interface DayDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  summary?: any;
  trades?: any[];
}

export function DayDetailModal({ open, onOpenChange, summary: propSummary, trades: propTrades }: DayDetailModalProps) {
  const storeSummary = useCalendarStore((s) => s.getSelectedDaySummary())
  
  // Use prop summary if available (from MonthlyPLCalendar), otherwise use store summary
  const summary = propSummary || storeSummary

  if (!summary) return null

  const dateObj = new Date(summary.date)
  const formattedDate = format(dateObj, "MMMM d, yyyy")
  
  const realizedPL = summary.realizedPL ?? summary.totalPL ?? 0
  const netPL = realizedPL
  
  const tradeCount = summary.tradeCount ?? (propTrades?.length || summary.trades?.length || 0)
  const winRate = Math.round(summary.winRate || 0)
  
  const utilization = Math.round(summary.peakUtilizationPercent || 0)
  const utilizationAvg = Math.round(summary.utilizationData?.metrics?.avgUtilization || 0)
  const utilizationMax = Math.round(summary.utilizationData?.metrics?.peakUtilization || 0)
  const positionsHeld = summary.utilizationData?.metrics?.concurrentPositions || 0

  // Map trades to display format
  const tradesToMap = propTrades || summary.trades || []
  const trades = tradesToMap.map((t: any, i: number) => {
    // Handle pre-formatted trades from MonthlyPLCalendar
    if (t.time && (t.legsSummary || t.legs)) {
      return {
        id: t.id?.toString() || `trade-${i}`,
        time: t.time,
        strategy: t.strategy || "Unknown",
        legsSummary: t.legsSummary || t.legs || "-",
        pl: t.pl || 0,
      }
    }
    
    // Handle raw StoredTrade objects
    return {
      id: t.id?.toString() || `trade-${i}`,
      time: t.dateOpened ? format(new Date(t.dateOpened), "HH:mm") : "-",
      strategy: t.strategy || "Unknown",
      legsSummary: t.legs || "-",
      pl: t.pl || 0,
    }
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="max-w-5xl p-0 border-none bg-transparent shadow-none sm:max-w-5xl"
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">Daily Performance Review</DialogTitle>
        
        <div className="w-full rounded-xl bg-[#0d0d0d] border border-white/10 shadow-2xl p-8 overflow-y-auto max-h-[90vh]">

            {/* HEADER */}
            <div className="flex justify-between items-start mb-6">
            <div>
                <h2 className="text-3xl font-semibold text-white">{formattedDate}</h2>
                <p className="text-white/50 mt-1 text-sm">Daily Performance Review</p>
            </div>

            <button onClick={() => onOpenChange(false)} className="text-white/50 hover:text-white text-2xl">
                ✕
            </button>
            </div>

            {/* PERFORMANCE METRICS GRID */}
            <div className="grid grid-cols-4 gap-4 mb-10">

            {/* NET P/L */}
            <div className="rounded-lg bg-white/5 p-5 border border-white/10 shadow-inner">
                <p className="text-xs text-white/50 mb-1 flex items-center gap-1">📈 NET P/L</p>
                <p className={`text-3xl md:text-4xl font-bold font-mono tabular-nums leading-tight break-words ${netPL >= 0 ? "text-green-400" : "text-red-400"}`}>
                {formatCurrency(netPL)}
                </p>
            </div>

            {/* TOTAL TRADES */}
            <div className="rounded-lg bg-white/5 p-5 border border-white/10 shadow-inner">
                <p className="text-xs text-white/50 mb-1">🔄 TOTAL TRADES</p>
                <p className="text-3xl font-bold text-white">{tradeCount}</p>
                <p className="text-xs text-white/40 mt-1">{tradeCount} Executed</p>
            </div>

            {/* WIN RATE */}
            <div className="rounded-lg bg-white/5 p-5 border border-white/10 shadow-inner">
                <p className="text-xs text-white/50 mb-1">🏆 WIN RATE</p>
                <p className="text-3xl font-bold text-yellow-300">{winRate}%</p>
                <p className="text-xs text-white/40 mt-1">Daily Win Rate</p>
            </div>

            {/* UTILIZATION */}
            <div className="rounded-lg bg-white/5 p-5 border border-white/10 shadow-inner">
                <p className="text-xs text-white/50 mb-1">⚡ UTILIZATION</p>
                <p className="text-3xl font-bold text-blue-300">{utilization}%</p>
                <div className="text-xs text-white/40 mt-2 leading-5">
                Avg: {utilizationAvg}% <br />
                Max: {utilizationMax}% <br />
                Pos: {positionsHeld}
                </div>
            </div>

            </div>

            {/* TRADE LOG */}
            <h3 className="text-lg font-semibold mb-3 text-white">Trade Log ({trades.length} Entries)</h3>

            <div className="rounded-lg border border-white/10 overflow-hidden bg-black/20 shadow-lg">
            <table className="w-full text-sm">
                <thead className="bg-white/5 text-white/50">
                <tr>
                    <th className="text-left px-4 py-2 w-20">Time</th>
                    <th className="text-left px-4 py-2 w-64">Strategy</th>
                    <th className="text-left px-4 py-2 w-48">Legs</th>
                    <th className="text-left px-4 py-2 w-28">P/L</th>
                </tr>
                </thead>

                <tbody>
                {trades.length === 0 && (
                    <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-white/40">
                        No trades recorded for this day.
                    </td>
                    </tr>
                )}

                {trades.map((trade: any, idx: number) => (
                    <tr key={trade.id || idx} className="border-t border-white/5 hover:bg-white/5">
                    <td className="px-4 py-2 text-white/80">{trade.time}</td>

                    <td className="px-4 py-2 truncate text-white">{trade.strategy}</td>

                    <td className="px-4 py-2 truncate text-white/60">
                        {trade.legsSummary}
                    </td>

                    <td
                        className={`px-4 py-2 font-semibold ${trade.pl >= 0 ? "text-green-400" : "text-red-400"}`}
                    >
                        {formatCurrency(trade.pl)}
                    </td>
                    </tr>
                ))}
                </tbody>
            </table>
            </div>

            {/* FOOTER SPACING */}
            <div className="h-6" />
        </div>
      </DialogContent>
    </Dialog>
  )
}
