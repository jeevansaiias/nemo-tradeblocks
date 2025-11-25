"use client"

import { CalendarDaySummary } from "@/lib/services/calendar-data-service"
import { UtilizationTrend } from "./utilization-trend"
import { RiskScatter } from "./risk-scatter"

interface UtilizationPanelProps {
  data: CalendarDaySummary[]
}

export function UtilizationPanel({ data }: UtilizationPanelProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <UtilizationTrend days={data} />
      <RiskScatter days={data} />
    </div>
  )
}
