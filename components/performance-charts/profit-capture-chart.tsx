"use client"

import React, { useMemo } from 'react'
import { ChartWrapper } from './chart-wrapper'
import { usePerformanceStore } from '@/lib/stores/performance-store'
import type { Layout, PlotData } from 'plotly.js'

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

    // Filter to trades with profit capture data
    const validData = mfeMaeData.filter(d =>
      d.profitCapturePercent !== undefined && isFinite(d.profitCapturePercent)
    )

    if (validData.length === 0) {
      return { plotData: [], layout: {}, stats: null }
    }

    const tradeNumbers = validData.map(d => d.tradeNumber)
    const profitCaptures = validData.map(d => d.profitCapturePercent!)
    const colors = validData.map(d => d.isWinner ? '#22c55e' : '#ef4444')

    const traces: Partial<PlotData>[] = []

    // Scatter plot for profit capture
    traces.push({
      x: tradeNumbers,
      y: profitCaptures,
      type: 'scatter',
      mode: 'markers',
      name: 'Profit Capture',
      marker: {
        color: colors,
        size: 8,
        opacity: 0.7
      },
      customdata: validData.map(d => ({
        date: d.date.toLocaleDateString(),
        strategy: d.strategy,
        pl: d.pl,
        mfe: d.mfe,
        mae: d.mae
      })),
      hovertemplate:
        '<b>Trade #%{x}</b><br>' +
        'Profit Capture: %{y:.1f}%<br>' +
        'Strategy: %{customdata.strategy}<br>' +
        'Date: %{customdata.date}<br>' +
        'P&L: $%{customdata.pl:.0f}<br>' +
        'MFE: $%{customdata.mfe:.0f}<br>' +
        '<extra></extra>'
    })

    // Add 100% reference line
    traces.push({
      x: [Math.min(...tradeNumbers), Math.max(...tradeNumbers)],
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
    if (mfeMaeStats) {
      traces.push({
        x: [Math.min(...tradeNumbers), Math.max(...tradeNumbers)],
        y: [mfeMaeStats.avgProfitCapturePercent, mfeMaeStats.avgProfitCapturePercent],
        type: 'scatter',
        mode: 'lines',
        name: `Average (${mfeMaeStats.avgProfitCapturePercent.toFixed(1)}%)`,
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

    return { plotData: traces, layout: chartLayout, stats: mfeMaeStats }
  }, [data])

  const tooltip = {
    flavor: "How well did you lock in your wins? This shows what percentage of peak profit you actually captured at exit.",
    detailed: "Profit Capture % = (Realized P&L / Maximum Favorable Excursion) × 100. A value of 100% means you exited at the exact peak. Values above 100% indicate you captured more than the initial peak (trade went even higher before exit). Values below 100% mean you gave back some profit from the peak. The optimal zone (80-120%) is highlighted in green. Consistently low values might indicate exiting too early, while extremely high values on losers might indicate holding too long hoping for recovery. This metric helps refine your exit timing strategy."
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
