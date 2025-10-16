"use client"

import { useMemo } from 'react'
import type { Layout, PlotData } from 'plotly.js'
import { ChartWrapper } from './chart-wrapper'
import { usePerformanceStore } from '@/lib/stores/performance-store'

interface PremiumEfficiencyChartProps {
  className?: string
}

export function PremiumEfficiencyChart({ className }: PremiumEfficiencyChartProps) {
  const { data } = usePerformanceStore()

  const { plotData, layout } = useMemo(() => {
    if (!data?.premiumEfficiency || data.premiumEfficiency.length === 0) {
      return { plotData: [], layout: {} }
    }

    const entries = data.premiumEfficiency.filter(entry => typeof entry.efficiencyPct === 'number' && isFinite(entry.efficiencyPct))

    if (entries.length === 0) {
      return { plotData: [], layout: {} }
    }

    const tradeNumbers = entries.map(entry => entry.tradeNumber)
    const efficiencyValues = entries.map(entry => entry.efficiencyPct as number)
    const commissionValues = entries.map(entry => entry.totalCommissions ?? 0)
    const denominatorValues = entries.map(entry => entry.efficiencyDenominator ?? null)
    const basisLookup: Record<string, string> = {
      premium: 'Premium',
      maxProfit: 'Max Profit',
      margin: 'Margin',
      unknown: 'Unknown'
    }
    const basisLabels = entries.map(entry => basisLookup[entry.efficiencyBasis ?? 'unknown'] ?? 'Unknown')
    const premiumTotals = entries.map(entry => entry.totalPremium ?? null)

    const markerSizes = premiumTotals.map(total => {
      if (!total || total <= 0) return 6
      return Math.min(26, Math.max(8, Math.sqrt(total) / 10))
    })

    const efficiencyTrace: Partial<PlotData> = {
      x: tradeNumbers,
      y: efficiencyValues,
      customdata: entries.map((entry, idx) => [
        commissionValues[idx],
        entry.pl,
        denominatorValues[idx],
        basisLabels[idx],
        premiumTotals[idx]
      ]),
      mode: 'markers+lines',
      type: 'scatter',
      name: 'Efficiency %',
      marker: {
        size: markerSizes,
        color: entries.map(entry => entry.pl),
        colorscale: 'Viridis',
        showscale: true,
        colorbar: {
          title: 'P/L ($)',
          titleside: 'right'
        }
      },
      hovertemplate:
        'Trade #%{x}<br>Efficiency: %{y:.2f}%<br>P/L: $%{customdata[1]:.2f}<br>Basis (%{customdata[3]}): $%{customdata[2]:.2f}<br>Commissions: $%{customdata[0]:.2f}<br>Total Premium: $%{customdata[4]:.2f}<extra></extra>'
    }

    const commissionTrace: Partial<PlotData> = {
      x: tradeNumbers,
      y: commissionValues,
      type: 'bar',
      name: 'Total Commissions',
      yaxis: 'y2',
      opacity: 0.4,
      marker: {
        color: '#f97316'
      },
      hovertemplate: 'Trade #%{x}<br>Commissions: $%{y:.2f}<extra></extra>'
    }

    const chartLayout: Partial<Layout> = {
      xaxis: {
        title: { text: 'Trade Number' }
      },
      yaxis: {
        title: { text: 'Efficiency (%)' }
      },
      yaxis2: {
        title: { text: 'Commissions ($)' },
        overlaying: 'y',
        side: 'right'
      },
      hovermode: 'x unified',
      legend: {
        orientation: 'h',
        yanchor: 'bottom',
        y: 1.02,
        xanchor: 'right',
        x: 1
      }
    }

    return { plotData: [commissionTrace, efficiencyTrace], layout: chartLayout }
  }, [data?.premiumEfficiency])

  const tooltip = {
    flavor: 'Are you capturing enough of the premium to justify the risk?',
    detailed:
      'Efficiency compares realized P/L to collected premium or theoretical max profit, while bubble size highlights commission drag. Spot trades where execution or fees leak edge.'
  }

  return (
    <ChartWrapper
      title="💰 Premium Efficiency"
      description="Realized versus potential capture with commission drag"
      className={className}
      data={plotData as PlotData[]}
      layout={layout}
      style={{ height: '350px' }}
      tooltip={tooltip}
    />
  )
}
