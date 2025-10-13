"use client"

import { ChartWrapper, createHistogramLayout } from "@/components/performance-charts/chart-wrapper"
import { AlignedTradeSet } from "@/lib/services/trade-reconciliation"
import type { PlotData } from "plotly.js"
import { useMemo } from "react"

interface SlippageDistributionChartProps {
  alignment: AlignedTradeSet
  className?: string
}

export function SlippageDistributionChart({
  alignment,
  className,
}: SlippageDistributionChartProps) {
  const { plotData, layout, stats } = useMemo(() => {
    // Extract matched pairs
    const matchedPairs = alignment.sessions.flatMap(session =>
      session.items
        .filter(item => item.isPaired && item.backtested && item.reported)
        .map(item => ({
          backtested: item.backtested!,
          reported: item.reported!,
        }))
    )

    if (matchedPairs.length === 0) {
      return { plotData: [], layout: {}, stats: null }
    }

    // Calculate slippage for each pair (reported premium - backtested premium)
    const slippages = matchedPairs.map(
      pair => pair.reported.totalPremium - pair.backtested.totalPremium
    )

    // Calculate statistics
    const sortedSlippages = [...slippages].sort((a, b) => a - b)
    const mean = slippages.reduce((sum, val) => sum + val, 0) / slippages.length
    const median = sortedSlippages[Math.floor(sortedSlippages.length / 2)]

    // Calculate percentiles
    const getPercentile = (arr: number[], percentile: number) => {
      const index = (percentile / 100) * (arr.length - 1)
      const lower = Math.floor(index)
      const upper = Math.ceil(index)
      if (lower === upper) return arr[lower]
      const weight = index - lower
      return arr[lower] * (1 - weight) + arr[upper] * weight
    }

    const p25 = getPercentile(sortedSlippages, 25)
    const p75 = getPercentile(sortedSlippages, 75)
    const p10 = getPercentile(sortedSlippages, 10)
    const p90 = getPercentile(sortedSlippages, 90)

    // Create histogram with color gradient
    const histogramTrace: Partial<PlotData> = {
      x: slippages,
      type: "histogram",
      nbinsx: 20,
      name: "Slippage Distribution",
      marker: {
        color: slippages.map(s => {
          if (s > 0) return "#10b981" // Green for positive slippage
          if (s < 0) return "#ef4444" // Red for negative slippage
          return "#6b7280" // Gray for zero
        }),
        line: { color: "#ffffff", width: 0.5 },
      },
      hovertemplate:
        "<b>Slippage Range:</b> $%{x:.2f}<br>" +
        "<b>Trade Count:</b> %{y}<br>" +
        "<extra></extra>",
    }

    const traces: Partial<PlotData>[] = [histogramTrace]

    // Smart x-axis range
    const minSlippage = Math.min(...slippages)
    const maxSlippage = Math.max(...slippages)
    const rangePadding = Math.max(Math.abs(maxSlippage), Math.abs(minSlippage)) * 0.15
    const xMin = minSlippage - rangePadding
    const xMax = maxSlippage + rangePadding

    // Add mean line
    traces.push({
      x: [mean, mean],
      y: [0, 1],
      type: "scatter",
      mode: "lines",
      line: { color: "#3b82f6", width: 2, dash: "dash" },
      name: `Mean: $${mean.toFixed(2)}`,
      showlegend: true,
      yaxis: "y2",
      hovertemplate: `<b>Mean Slippage</b><br>$${mean.toFixed(2)}<extra></extra>`,
    })

    // Add median line
    traces.push({
      x: [median, median],
      y: [0, 1],
      type: "scatter",
      mode: "lines",
      line: { color: "#10b981", width: 2, dash: "dot" },
      name: `Median: $${median.toFixed(2)}`,
      showlegend: true,
      yaxis: "y2",
      hovertemplate: `<b>Median Slippage</b><br>$${median.toFixed(2)}<extra></extra>`,
    })

    // Add zero line for reference
    traces.push({
      x: [0, 0],
      y: [0, 1],
      type: "scatter",
      mode: "lines",
      line: { color: "#6b7280", width: 1.5, dash: "solid" },
      name: "Zero",
      showlegend: true,
      yaxis: "y2",
      hovertemplate: "<b>Zero Slippage</b><extra></extra>",
    })

    const chartLayout = {
      ...createHistogramLayout("", "Slippage ($)", "Number of Trades"),
      xaxis: {
        title: { text: "Slippage ($)" },
        showgrid: true,
        range: [xMin, xMax],
        zeroline: true,
        zerolinewidth: 2,
      },
      yaxis: {
        title: { text: "Number of Trades" },
        showgrid: true,
      },
      yaxis2: {
        overlaying: "y",
        side: "right" as const,
        showgrid: false,
        showticklabels: false,
        range: [0, 1],
      },
      showlegend: true,
      legend: {
        x: 1,
        xanchor: "right",
        y: 1,
        yanchor: "top",
        bgcolor: "rgba(0,0,0,0)",
      },
      bargap: 0.05,
    }

    return {
      plotData: traces,
      layout: chartLayout,
      stats: {
        mean,
        median,
        p10,
        p25,
        p75,
        p90,
        count: slippages.length,
        positiveCount: slippages.filter(s => s > 0).length,
        negativeCount: slippages.filter(s => s < 0).length,
      },
    }
  }, [alignment])

  if (plotData.length === 0) {
    return (
      <div className={className}>
        <div className="text-center p-8 text-muted-foreground">
          No matched trades available for slippage analysis
        </div>
      </div>
    )
  }

  return (
    <div className={className}>
      <ChartWrapper
        title="Slippage Distribution"
        description={`Analysis of ${stats?.count} matched trades`}
        tooltip={{
          flavor: "Distribution of slippage across all matched trades",
          detailed: "Slippage is the difference between backtested premium and actual reported premium. Positive slippage (green) indicates better execution than expected, while negative slippage (red) indicates worse execution. The distribution helps identify systematic biases and execution quality patterns."
        }}
        data={plotData}
        layout={layout}
      >
        {/* Stats Summary */}
        {stats && (
          <div className="flex gap-3 text-xs">
            <div className="text-green-600 dark:text-green-400">
              +{stats.positiveCount} favorable
            </div>
            <div className="text-red-600 dark:text-red-400">
              {stats.negativeCount} unfavorable
            </div>
          </div>
        )}
      </ChartWrapper>
    </div>
  )
}
