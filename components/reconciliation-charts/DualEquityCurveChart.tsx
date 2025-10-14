"use client"

import { ChartWrapper, createLineChartLayout } from "@/components/performance-charts/chart-wrapper"
import { Badge } from "@/components/ui/badge"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { EquityCurvePoint } from "@/lib/calculations/reconciliation-stats"
import type { Layout, PlotData } from "plotly.js"
import { useState } from "react"

interface DualEquityCurveChartProps {
  data: EquityCurvePoint[] | null
  normalizeTo1Lot?: boolean
  className?: string
}

export function DualEquityCurveChart({ data, normalizeTo1Lot = false, className }: DualEquityCurveChartProps) {
  const [yAxisScale, setYAxisScale] = useState<"linear" | "log">("linear")

  if (!data || data.length === 0) {
    return (
      <div className={className}>
        <div className="text-center p-8 text-muted-foreground">
          No matched trades available for equity curve comparison
        </div>
      </div>
    )
  }

  // Backtested equity curve
  const backtestedTrace: Partial<PlotData> = {
    x: data.map(point => point.date),
    y: data.map(point => point.backtestedEquity),
    type: "scatter",
    mode: "lines",
    name: "Backtested P/L",
    line: {
      color: "#3b82f6", // blue
      width: 2,
      shape: "hv", // Step function - equity changes at each trade
    },
    hovertemplate:
      "<b>Date:</b> %{x}<br>" +
      "<b>Backtested:</b> $%{y:,.2f}<br>" +
      "<b>Trade #:</b> %{customdata}<br>" +
      "<extra></extra>",
    customdata: data.map(point => point.tradeNumber),
  }

  // Reported equity curve
  const reportedTrace: Partial<PlotData> = {
    x: data.map(point => point.date),
    y: data.map(point => point.reportedEquity),
    type: "scatter",
    mode: "lines",
    name: "Reported P/L",
    line: {
      color: "#10b981", // green
      width: 2,
      shape: "hv", // Step function - equity changes at each trade
    },
    hovertemplate:
      "<b>Date:</b> %{x}<br>" +
      "<b>Reported:</b> $%{y:,.2f}<br>" +
      "<b>Trade #:</b> %{customdata}<br>" +
      "<extra></extra>",
    customdata: data.map(point => point.tradeNumber),
  }

  const traces: Partial<PlotData>[] = [backtestedTrace, reportedTrace]

  // Calculate y-axis range for better visualization
  const allEquityValues = [
    ...data.map(p => p.backtestedEquity),
    ...data.map(p => p.reportedEquity),
  ]
  const minEquity = Math.min(...allEquityValues)
  const maxEquity = Math.max(...allEquityValues)
  const padding = (maxEquity - minEquity) * 0.1

  const layout: Partial<Layout> = {
    ...createLineChartLayout("", "Date", "Cumulative P/L ($)"),
    xaxis: {
      title: { text: "Date" },
      showgrid: true,
    },
    yaxis: {
      title: {
        text: "Cumulative P/L ($)",
        standoff: 50,
      },
      showgrid: true,
      zeroline: true,
      zerolinewidth: 2,
      zerolinecolor: "#e5e7eb",
      type: yAxisScale,
      tickformat: "$,.0f",
      range: yAxisScale === "linear" ? [minEquity - padding, maxEquity + padding] : undefined,
    },
    legend: {
      orientation: "h",
      yanchor: "bottom",
      y: 1.02,
      xanchor: "right",
      x: 1,
    },
    hovermode: "x unified",
  }

  const controls = (
    <div className="flex items-center gap-3">
      {normalizeTo1Lot && (
        <Badge variant="secondary" className="text-xs">
          Per Contract
        </Badge>
      )}
      <ToggleGroup
        type="single"
        value={yAxisScale}
        onValueChange={(value: "linear" | "log") => {
          if (value) setYAxisScale(value)
        }}
        className="border rounded-md p-1"
      >
        <ToggleGroupItem value="linear" className="text-xs px-3 py-1">
          Linear
        </ToggleGroupItem>
        <ToggleGroupItem value="log" className="text-xs px-3 py-1">
          Log
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  )

  const finalEquity = data[data.length - 1]
  const normalizationNote = normalizeTo1Lot ? " (per contract)" : ""
  const description = `Comparing ${data.length} matched trades${normalizationNote}. Final difference: $${finalEquity.difference.toFixed(2)} (${finalEquity.percentDifference > 0 ? "+" : ""}${finalEquity.percentDifference.toFixed(2)}%)`

  return (
    <div className={className}>
      <ChartWrapper
        title="Dual Equity Curve"
        description={description}
        tooltip={{
          flavor: "Side-by-side comparison of backtested vs reported performance over time",
          detailed: "This chart shows how your actual (reported) performance compares to your backtested expectations. Divergence between the lines reveals slippage, commission differences, or execution variations accumulating over time.",
        }}
        data={traces}
        layout={layout}
        style={{ height: "400px" }}
      >
        {controls}
      </ChartWrapper>
    </div>
  )
}
