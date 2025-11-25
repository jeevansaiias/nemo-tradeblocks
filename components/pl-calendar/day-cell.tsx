"use client"

import { CalendarDaySummary, CalendarColorMode } from "@/lib/services/calendar-data-service"
import { cn, formatCurrency } from "@/lib/utils"
import { format, isSameMonth, isSameDay } from "date-fns"
import { Badge } from "@/components/ui/badge"

interface DayCellProps {
  summary: CalendarDaySummary | undefined
  date: Date
  currentDate: Date
  colorBy: CalendarColorMode
  onClick: () => void
}

export function DayCell({ summary, date, currentDate, colorBy, onClick }: DayCellProps) {
  const isCurrentMonth = isSameMonth(date, currentDate)
  const isToday = isSameDay(date, new Date())

  const getMetricDisplay = (summary: CalendarDaySummary) => {
    switch (colorBy) {
      case "utilization":
        return {
          label: `${(summary.peakUtilizationPercent || 0).toFixed(1)}%`,
          subLabel: "util",
          color: "text-zinc-100",
          value: summary.peakUtilizationPercent || 0,
          max: 100
        }
      case "count":
        return {
          label: `${summary.tradeCount}`,
          subLabel: "trades",
          color: "text-zinc-100",
          value: summary.tradeCount,
          max: 10 // Scale for bar
        }
      case "risk":
        return {
          label: `${(summary.riskScore || 0).toFixed(0)}`,
          subLabel: "risk",
          color: "text-zinc-100",
          value: summary.riskScore || 0,
          max: 100
        }
      case "pl":
      default:
        return {
          label: formatCurrency(summary.realizedPL),
          subLabel: "",
          color: summary.realizedPL > 0 ? "text-emerald-500" : summary.realizedPL < 0 ? "text-rose-500" : "text-muted-foreground",
          value: Math.abs(summary.realizedPL),
          max: 1000 // Arbitrary scale for PL bar, or maybe relative to max PL in month?
        }
    }
  }

  const getCellColor = (summary: CalendarDaySummary | undefined, isCurrentMonth: boolean) => {
    if (!summary) return "bg-muted/5 border-transparent"
    if (!isCurrentMonth) return "bg-muted/5 opacity-50 border-transparent"
    
    switch (colorBy) {
      case "pl":
        if (summary.realizedPL > 0) return "bg-emerald-500/10 border-emerald-500/20 hover:bg-emerald-500/20"
        if (summary.realizedPL < 0) return "bg-rose-500/10 border-rose-500/20 hover:bg-rose-500/20"
        return "bg-muted/10 hover:bg-muted/20 border-neutral-800"
      case "utilization":
        if (summary.utilizationBucket === "extreme") return "bg-red-500/20 border-red-500/30"
        if (summary.utilizationBucket === "high") return "bg-orange-500/20 border-orange-500/30"
        if (summary.utilizationBucket === "medium") return "bg-yellow-500/20 border-yellow-500/30"
        return "bg-emerald-500/10 border-emerald-500/20"
      case "count":
        if (summary.tradeCount > 5) return "bg-blue-500/20 border-blue-500/30"
        if (summary.tradeCount > 0) return "bg-blue-500/10 border-blue-500/20"
        return "bg-muted/10 border-neutral-800"
      case "risk":
        const score = summary.riskScore || 0
        if (score > 75) return "bg-purple-500/40 border-purple-500/50 hover:bg-purple-500/50"
        if (score > 50) return "bg-purple-500/25 border-purple-500/35 hover:bg-purple-500/35"
        if (score > 25) return "bg-purple-500/10 border-purple-500/20 hover:bg-purple-500/20"
        return "bg-muted/10 border-neutral-800"
      default:
        return "bg-muted/10 border-neutral-800"
    }
  }

  const metric = summary ? getMetricDisplay(summary) : null

  return (
    <div
      onClick={onClick}
      className={cn(
        "min-h-[100px] p-2 rounded-lg border transition-all cursor-pointer flex flex-col justify-between relative group",
        getCellColor(summary, isCurrentMonth),
        isToday ? "ring-1 ring-primary" : "",
        !summary && "pointer-events-none"
      )}
    >
      <div className="flex justify-between items-start">
        <span className={cn(
          "text-xs font-medium",
          !isCurrentMonth && "text-muted-foreground/50"
        )}>
          {format(date, 'd')}
        </span>
        {summary && summary.tradeCount > 0 && (
          <Badge variant="secondary" className="h-5 px-1.5 text-[10px] bg-background/50 backdrop-blur-sm">
            {summary.tradeCount}
          </Badge>
        )}
      </div>
      
      {summary && metric && (
        <div className="space-y-1 mt-2">
          <div className={cn("text-sm font-bold truncate", metric.color)}>
            {metric.label}
            {metric.subLabel && <span className="text-[10px] font-normal text-muted-foreground ml-1">{metric.subLabel}</span>}
          </div>
          
          {/* Progress bar visualization */}
          <div className="w-full bg-neutral-800/50 h-1.5 rounded-full overflow-hidden mt-2">
            <div 
              className={cn("h-full rounded-full", 
                colorBy === "pl" 
                  ? (summary.realizedPL >= 0 ? "bg-emerald-500" : "bg-red-500")
                  : colorBy === "risk" ? "bg-amber-400" 
                  : "bg-emerald-400"
              )}
              style={{ 
                width: `${Math.max(5, Math.min(100, 
                  colorBy === "count" ? (metric.value * 10) : // Scale trade count
                  colorBy === "pl" ? (metric.value / 10) : // Scale PL (very rough)
                  metric.value // Percentages
                ))}%` 
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
