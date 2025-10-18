"use client"

import React, { useMemo } from 'react'
import { ChartWrapper } from './chart-wrapper'
import { usePerformanceStore } from '@/lib/stores/performance-store'
import type { Layout, PlotData } from 'plotly.js'

interface MFEMAEScatterChartProps {
  className?: string
}

export function MFEMAEScatterChart({ className }: MFEMAEScatterChartProps) {
  const { data } = usePerformanceStore()

  const { plotData, layout } = useMemo(() => {
    if (!data?.mfeMaeData || data.mfeMaeData.length === 0) {
      return { plotData: [], layout: {} }
    }

    const { mfeMaeData } = data

    // Filter to only trades with both MFE and MAE percentages
    const validData = mfeMaeData.filter(d =>
      d.maePercent !== undefined && d.mfePercent !== undefined
    )

    if (validData.length === 0) {
      return { plotData: [], layout: {} }
    }

    // Split into winners and losers
    const winners = validData.filter(d => d.isWinner)
    const losers = validData.filter(d => !d.isWinner)

    const traces: Partial<PlotData>[] = []

    // Winners scatter plot
    if (winners.length > 0) {
      traces.push({
        x: winners.map(d => d.maePercent),
        y: winners.map(d => d.mfePercent),
        type: 'scatter',
        mode: 'markers',
        name: 'Winners',
        marker: {
          color: '#22c55e',
          size: 8,
          opacity: 0.7,
          line: {
            color: '#16a34a',
            width: 1
          }
        },
        customdata: winners.map(d => ({
          trade: d.tradeNumber,
          strategy: d.strategy,
          pl: d.pl,
          date: d.date.toLocaleDateString(),
          profitCapture: d.profitCapturePercent?.toFixed(1) || 'N/A'
        })),
        hovertemplate:
          '<b>Winner - Trade #%{customdata.trade}</b><br>' +
          'Strategy: %{customdata.strategy}<br>' +
          'Date: %{customdata.date}<br>' +
          'MAE: %{x:.1f}%<br>' +
          'MFE: %{y:.1f}%<br>' +
          'P&L: $%{customdata.pl:.0f}<br>' +
          'Profit Capture: %{customdata.profitCapture}%' +
          '<extra></extra>'
      })
    }

    // Losers scatter plot
    if (losers.length > 0) {
      traces.push({
        x: losers.map(d => d.maePercent),
        y: losers.map(d => d.mfePercent),
        type: 'scatter',
        mode: 'markers',
        name: 'Losers',
        marker: {
          color: '#ef4444',
          size: 8,
          opacity: 0.7,
          line: {
            color: '#dc2626',
            width: 1
          }
        },
        customdata: losers.map(d => ({
          trade: d.tradeNumber,
          strategy: d.strategy,
          pl: d.pl,
          date: d.date.toLocaleDateString(),
          profitCapture: d.profitCapturePercent?.toFixed(1) || 'N/A'
        })),
        hovertemplate:
          '<b>Loser - Trade #%{customdata.trade}</b><br>' +
          'Strategy: %{customdata.strategy}<br>' +
          'Date: %{customdata.date}<br>' +
          'MAE: %{x:.1f}%<br>' +
          'MFE: %{y:.1f}%<br>' +
          'P&L: $%{customdata.pl:.0f}<br>' +
          'Profit Capture: %{customdata.profitCapture}%' +
          '<extra></extra>'
      })
    }

    // Add diagonal reference line (MFE = MAE)
    const maxVal = Math.max(
      ...validData.map(d => Math.max(d.maePercent || 0, d.mfePercent || 0))
    )

    traces.push({
      x: [0, maxVal],
      y: [0, maxVal],
      type: 'scatter',
      mode: 'lines',
      name: 'MFE = MAE',
      line: {
        color: '#6b7280',
        width: 1,
        dash: 'dash'
      },
      hoverinfo: 'skip',
      showlegend: true
    })

    const chartLayout: Partial<Layout> = {
      xaxis: {
        title: { text: 'Maximum Adverse Excursion (%)' },
        showgrid: true,
        zeroline: true
      },
      yaxis: {
        title: { text: 'Maximum Favorable Excursion (%)' },
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
      annotations: [
        {
          text: 'Upper left quadrant: Better risk/reward<br>(Low MAE, High MFE)',
          xref: 'paper',
          yref: 'paper',
          x: 0.02,
          y: 0.98,
          xanchor: 'left',
          yanchor: 'top',
          showarrow: false,
          font: {
            size: 10,
            color: '#6b7280'
          },
          bgcolor: 'rgba(255, 255, 255, 0.8)',
          borderpad: 4
        }
      ]
    }

    return { plotData: traces, layout: chartLayout }
  }, [data])

  const tooltip = {
    flavor: "The opportunity map - see how much profit potential you had versus how much risk you took on each trade.",
    detailed: "Each point represents a trade plotted by its Maximum Adverse Excursion (worst drawdown) on the x-axis and Maximum Favorable Excursion (peak profit) on the y-axis. Trades in the upper-left quadrant had the best risk/reward profiles - high profit potential with low drawdowns. The diagonal line shows where MFE equals MAE. Points above the line had more upside than downside, while points below had more risk than reward. Green dots are winners, red dots are losers. This helps identify whether your exits are optimal and if certain trades offered better opportunities than others."
  }

  if (!data || !data.mfeMaeData || data.mfeMaeData.length === 0) {
    return (
      <ChartWrapper
        title="🎯 MFE vs MAE Analysis"
        description="Maximum Favorable vs Adverse Excursion scatter plot"
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
      title="🎯 MFE vs MAE Analysis"
      description="Risk-reward profile: Maximum Favorable Excursion vs Maximum Adverse Excursion"
      className={className}
      data={plotData}
      layout={layout}
      style={{ height: '500px' }}
      tooltip={tooltip}
    />
  )
}
