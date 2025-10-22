"use client"

import React, { useMemo } from 'react'
import { ChartWrapper } from './chart-wrapper'
import { usePerformanceStore } from '@/lib/stores/performance-store'
import type { Layout, PlotData } from 'plotly.js'
import { NORMALIZATION_BASES } from '@/lib/calculations/mfe-mae'

const basisLabels = {
  premium: 'Collected Premium',
  maxProfit: 'Maximum Profit',
  margin: 'Margin Requirement',
  unknown: 'Unknown Basis'
} as const

interface ProfitCaptureChartProps {
  className?: string
}

export function ProfitCaptureChart({ className }: ProfitCaptureChartProps) {
  const { data } = usePerformanceStore()

  const { plotData, layout, stats } = useMemo(() => {
    if (!data?.mfeMaeData || data.mfeMaeData.length === 0) {
      return { plotData: [], layout: {}, stats: null }
    }

    const { mfeMaeData, mfeMaeStats } = data
    const statsEntry = NORMALIZATION_BASES.map(basis => mfeMaeStats?.[basis]).find(Boolean) || null

    // Filter to trades with profit capture data
    const validData = mfeMaeData.filter(d =>
      d.profitCapturePercent !== undefined && isFinite(d.profitCapturePercent)
    )

    if (validData.length === 0) {
      return { plotData: [], layout: {}, stats: null }
    }

    // Split into winners and losers
    const winners = validData.filter(d => d.isWinner)
    const losers = validData.filter(d => !d.isWinner)

    const traces: Partial<PlotData>[] = []

    // Winners scatter plot
    if (winners.length > 0) {
      traces.push({
        x: winners.map(d => d.tradeNumber),
        y: winners.map(d => d.profitCapturePercent!),
        type: 'scatter',
        mode: 'markers',
        name: 'Winners',
        marker: {
          color: '#22c55e',
          size: 8,
          opacity: 0.7
        },
        customdata: winners.map(d => ({
          date: d.date.toLocaleDateString(),
          strategy: d.strategy,
          pl: d.pl,
          mfe: d.mfe,
          mae: d.mae,
          basisLabel: basisLabels[d.basis],
          denominatorLabel: d.denominator ? `$${d.denominator.toLocaleString()}` : '—'
        })) as unknown as PlotData['customdata'],
        hovertemplate:
          '<b>Trade #%{x}</b><br>' +
          'Profit Capture: %{y:.1f}%<br>' +
          'Strategy: %{customdata.strategy}<br>' +
          'Date: %{customdata.date}<br>' +
          'P&L: $%{customdata.pl:.0f}<br>' +
          'MFE: $%{customdata.mfe:.0f}<br>' +
          'Normalization: %{customdata.basisLabel}<br>' +
          'Denominator: %{customdata.denominatorLabel}<br>' +
          '<extra></extra>'
      })
    }

    // Losers scatter plot
    if (losers.length > 0) {
      traces.push({
        x: losers.map(d => d.tradeNumber),
        y: losers.map(d => d.profitCapturePercent!),
        type: 'scatter',
        mode: 'markers',
        name: 'Losers',
        marker: {
          color: '#ef4444',
          size: 8,
          opacity: 0.7
        },
        customdata: losers.map(d => ({
          date: d.date.toLocaleDateString(),
          strategy: d.strategy,
          pl: d.pl,
          mfe: d.mfe,
          mae: d.mae,
          basisLabel: basisLabels[d.basis],
          denominatorLabel: d.denominator ? `$${d.denominator.toLocaleString()}` : '—'
        })) as unknown as PlotData['customdata'],
        hovertemplate:
          '<b>Trade #%{x}</b><br>' +
          'Profit Capture: %{y:.1f}%<br>' +
          'Strategy: %{customdata.strategy}<br>' +
          'Date: %{customdata.date}<br>' +
          'P&L: $%{customdata.pl:.0f}<br>' +
          'MFE: $%{customdata.mfe:.0f}<br>' +
          'Normalization: %{customdata.basisLabel}<br>' +
          'Denominator: %{customdata.denominatorLabel}<br>' +
          '<extra></extra>'
      })
    }

    // Add 100% reference line
    const allTradeNumbers = validData.map(d => d.tradeNumber)
    traces.push({
      x: [Math.min(...allTradeNumbers), Math.max(...allTradeNumbers)],
      y: [100, 100],
      type: 'scatter',
      mode: 'lines',
      name: '100% Capture',
      line: {
        color: '#6b7280',
        width: 1,
        dash: 'dot'
      },
      hoverinfo: 'skip',
      showlegend: true
    })

    // Add average line if we have stats
    if (statsEntry) {
      traces.push({
        x: [Math.min(...allTradeNumbers), Math.max(...allTradeNumbers)],
        y: [statsEntry.avgProfitCapturePercent, statsEntry.avgProfitCapturePercent],
        type: 'scatter',
        mode: 'lines',
        name: `Average (${statsEntry.avgProfitCapturePercent.toFixed(1)}%)`,
        line: {
          color: '#3b82f6',
          width: 2,
          dash: 'dash'
        },
        hoverinfo: 'skip',
        showlegend: true
      })
    }

    const chartLayout: Partial<Layout> = {
      xaxis: {
        title: { text: 'Trade Number' },
        showgrid: true
      },
      yaxis: {
        title: { text: 'Profit Capture (%)' },
        showgrid: true,
        zeroline: true
      },
      showlegend: true,
      legend: {
        orientation: 'h',
        yanchor: 'bottom',
        y: 1.02,
        xanchor: 'right',
        x: 1
      },
      hovermode: 'closest',
      shapes: [
        {
          type: 'rect',
          xref: 'paper',
          yref: 'y',
          x0: 0,
          x1: 1,
          y0: 80,
          y1: 120,
          fillcolor: 'rgba(34, 197, 94, 0.1)',
          line: { width: 0 },
          layer: 'below'
        }
      ],
      annotations: [
        {
          text: 'Optimal capture zone (80-120%)',
          xref: 'paper',
          yref: 'y',
          x: 0.5,
          y: 100,
          xanchor: 'center',
          showarrow: false,
          font: {
            size: 10,
            color: '#6b7280'
          }
        }
      ]
    }

    return { plotData: traces, layout: chartLayout, stats: statsEntry }
  }, [data])

  const tooltip = {
    flavor: "How well did you lock in your modeled wins? This shows what percentage of peak theoretical profit you captured at exit.",
    detailed: "Profit Capture % = (Realized P&L / Maximum Favorable Excursion) × 100 using backtest excursions. A value of 100% means the strategy exited at the modeled peak. Values above 100% indicate the backtest captured more than the initial peak, while values below 100% mean profit was given back from the modeled high. Hover to see which normalization basis (premium, margin, or max profit) underpins each trade. Use this to refine exit timing in the presence of model assumptions and recognize that live execution may deviate." 
  }

  const description = stats
    ? `Average profit capture: ${stats.avgProfitCapturePercent.toFixed(1)}% | Winners: ${stats.winnerAvgProfitCapture.toFixed(1)}% | Losers: ${stats.loserAvgProfitCapture.toFixed(1)}%`
    : 'Percentage of peak profit captured at exit'

  if (!data || !data.mfeMaeData || data.mfeMaeData.length === 0) {
    return (
      <ChartWrapper
        title="📈 Profit Capture Efficiency"
        description={description}
        className={className}
        data={[]}
        layout={{}}
        style={{ height: '400px' }}
        tooltip={tooltip}
      />
    )
  }

  return (
    <ChartWrapper
      title="📈 Profit Capture Efficiency"
      description={description}
      className={className}
      data={plotData}
      layout={layout}
      style={{ height: '450px' }}
      tooltip={tooltip}
    />
  )
}
