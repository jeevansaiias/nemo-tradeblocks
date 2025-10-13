"use client"

import { ChartWrapper, createHistogramLayout } from "@/components/performance-charts/chart-wrapper"
import { AlignedTradeSet, NormalizedTrade } from "@/lib/services/trade-reconciliation"
import type { PlotData } from "plotly.js"
import { useMemo } from "react"

interface SlippageDistributionChartProps {
  alignment: AlignedTradeSet
  normalizeTo1Lot?: boolean
  className?: string
}

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export function SlippageDistributionChart({
  alignment,
  normalizeTo1Lot = false,
  className,
}: SlippageDistributionChartProps) {
  const { plotData, layout, stats } = useMemo(() => {
    // Extract matched pairs
    const matchedPairs = alignment.sessions.flatMap(session =>
      session.items
        .filter(item =>
          item.isPaired &&
          item.backtested &&
          item.reported &&
          item.includedBacktested &&
          item.includedReported
        )
        .map(item => ({
          backtested: item.backtested!,
          reported: item.reported!,
        }))
    )

    if (matchedPairs.length === 0) {
      return { plotData: [], layout: {}, stats: null }
    }

    const normalizePremium = (trade: NormalizedTrade) => {
      if (!normalizeTo1Lot || !trade.contracts) {
        return trade.totalPremium
      }
      return trade.totalPremium / trade.contracts
    }

    // Calculate slippage for each pair (reported premium - backtested premium)
    const slippages = matchedPairs.map(
      pair => normalizePremium(pair.reported) - normalizePremium(pair.backtested)
    )

    // Calculate statistics
    const sortedSlippages = [...slippages].sort((a, b) => a - b)
    const mean = slippages.reduce((sum, val) => sum + val, 0) / slippages.length
    const median = (() => {
      const mid = Math.floor(sortedSlippages.length / 2)
      if (sortedSlippages.length % 2 === 0) {
        return (sortedSlippages[mid - 1] + sortedSlippages[mid]) / 2
      }
      return sortedSlippages[mid]
    })()

    // Calculate percentiles
    const getPercentile = (arr: number[], percentile: number) => {
      const index = (percentile / 100) * (arr.length - 1)
      const lower = Math.floor(index)
      const upper = Math.ceil(index)
      if (lower === upper) return arr[lower]
      const weight = index - lower
      return arr[lower] * (1 - weight) + arr[upper] * weight
    }

    const p10 = getPercentile(sortedSlippages, 10)
    const p90 = getPercentile(sortedSlippages, 90)
    const p25 = getPercentile(sortedSlippages, 25)
    const p75 = getPercentile(sortedSlippages, 75)

    const traces: Partial<PlotData>[] = []

    // Smart x-axis range
    const minSlippage = Math.min(...slippages)
    const maxSlippage = Math.max(...slippages)
    const maxMagnitude = Math.max(Math.abs(maxSlippage), Math.abs(minSlippage))
    const rangePadding = maxMagnitude === 0 ? 1 : maxMagnitude * 0.15
    const xMin = minSlippage - rangePadding
    const xMax = maxSlippage + rangePadding

    const binCount = Math.min(40, Math.max(10, Math.ceil(Math.sqrt(slippages.length))))
    const binSize = xMax - xMin === 0 ? 1 : (xMax - xMin) / binCount
    const xbins = {
      start: xMin,
      end: xMax,
      size: binSize,
    }

    const positiveSlippages = slippages.filter((s) => s > 0)
    const negativeSlippages = slippages.filter((s) => s < 0)
    const neutralSlippages = slippages.filter((s) => s === 0)

    if (negativeSlippages.length > 0) {
      traces.push({
        x: negativeSlippages,
        type: "histogram",
        name: "Negative (worse execution)",
        marker: { color: "#ef4444" },
        opacity: 0.75,
        xbins,
        hovertemplate:
          "<b>Slippage:</b> $%{x:.2f}<br>" +
          "<b>Trades:</b> %{y}<br>" +
          "<extra></extra>",
      })
    }

    if (positiveSlippages.length > 0) {
      traces.push({
        x: positiveSlippages,
        type: "histogram",
        name: "Positive (better execution)",
        marker: { color: "#10b981" },
        opacity: 0.75,
        xbins,
        hovertemplate:
          "<b>Slippage:</b> $%{x:.2f}<br>" +
          "<b>Trades:</b> %{y}<br>" +
          "<extra></extra>",
      })
    }

    if (neutralSlippages.length > 0) {
      traces.push({
        x: neutralSlippages,
        type: "histogram",
        name: "Neutral",
        marker: { color: "#6b7280" },
        opacity: 0.75,
        xbins,
        hovertemplate:
          "<b>Slippage:</b> $%{x:.2f}<br>" +
          "<b>Trades:</b> %{y}<br>" +
          "<extra></extra>",
      })
    }

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

    if (xMin < 0 && xMax > 0) {
      traces.push({
        x: [0, 0],
        y: [0, 1],
        type: "scatter",
        mode: "lines",
        line: { color: "#6b7280", width: 1.5 },
        name: "Zero",
        showlegend: true,
        yaxis: "y2",
        hovertemplate: "<b>Zero Slippage</b><extra></extra>",
      })
    }

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
        overlaying: "y" as const,
        side: "right" as const,
        showgrid: false,
        showticklabels: false,
        range: [0, 1],
      },
      showlegend: true,
      legend: {
        orientation: "h" as const,
        yanchor: "bottom" as const,
        y: 1.02,
        xanchor: "right" as const,
        x: 1,
        bgcolor: "rgba(0,0,0,0)",
      },
      bargap: 0.05,
      barmode: "overlay" as const,
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
        positiveCount: positiveSlippages.length,
        neutralCount: neutralSlippages.length,
        negativeCount: negativeSlippages.length,
      },
    }
  }, [alignment, normalizeTo1Lot])

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
        description={`Distribution of slippage for ${stats?.count ?? 0} matched trades (${normalizeTo1Lot ? "per contract" : "per trade"})`}
        tooltip={{
          flavor: "Distribution of slippage across all matched trades",
          detailed: "Slippage measures reported premium minus backtested premium for each matched trade. Positive slippage (green) indicates better execution than expected, while negative slippage (red) indicates worse execution."
        }}
        data={plotData}
        layout={layout}
        style={{ height: "320px" }}
      >
        {/* Stats Summary */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs text-muted-foreground">
            <div>
              <span className="block font-semibold text-foreground">Mean</span>
              {currencyFormatter.format(stats.mean)}
            </div>
            <div>
              <span className="block font-semibold text-foreground">Median</span>
              {currencyFormatter.format(stats.median)}
            </div>
            <div>
              <span className="block font-semibold text-foreground">P25 / P75</span>
              {currencyFormatter.format(stats.p25)} / {currencyFormatter.format(stats.p75)}
            </div>
            <div>
              <span className="block font-semibold text-foreground">P10 / P90</span>
              {currencyFormatter.format(stats.p10)} / {currencyFormatter.format(stats.p90)}
            </div>
            <div>
              <span className="block font-semibold text-foreground">Favorable / Neutral / Unfavorable</span>
              +{stats.positiveCount} / {stats.neutralCount} / {stats.negativeCount}
            </div>
          </div>
        )}
      </ChartWrapper>
    </div>
  )
}
