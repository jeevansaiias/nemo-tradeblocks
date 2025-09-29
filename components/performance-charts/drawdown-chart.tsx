"use client"

import React, { useMemo } from 'react'
import { ChartWrapper, createLineChartLayout } from './chart-wrapper'
import { usePerformanceStore } from '@/lib/stores/performance-store'
import type { PlotData, Layout } from 'plotly.js'

interface DrawdownChartProps {
  className?: string
}

export function DrawdownChart({ className }: DrawdownChartProps) {
  const { data } = usePerformanceStore()

  const { plotData, layout } = useMemo(() => {
    if (!data?.drawdownData) {
      return { plotData: [], layout: {} }
    }

    const { drawdownData } = data

    // Find maximum drawdown point
    const maxDrawdownPoint = drawdownData.reduce((max, current) =>
      current.drawdownPct < max.drawdownPct ? current : max
    )

    // Main drawdown area
    const drawdownTrace: Partial<PlotData> = {
      x: drawdownData.map(point => point.date),
      y: drawdownData.map(point => point.drawdownPct),
      type: 'scatter' as const,
      mode: 'lines',
      name: 'Drawdown %',
      line: { color: '#ef4444', width: 0 },
      fill: 'tonexty',
      fillcolor: 'rgba(239, 68, 68, 0.3)',
      hovertemplate:
        '<b>Date:</b> %{x}<br>' +
        '<b>Drawdown:</b> %{y:.2f}%<br>' +
        '<extra></extra>'
    }

    // Zero line (baseline)
    const zeroLineTrace: Partial<PlotData> = {
      x: drawdownData.map(point => point.date),
      y: Array(drawdownData.length).fill(0),
      type: 'scatter' as const,
      mode: 'lines',
      name: 'No Drawdown',
      line: { color: 'rgba(0,0,0,0.3)', width: 1 },
      showlegend: false,
      hoverinfo: 'skip'
    }

    // Maximum drawdown point
    const maxDrawdownTrace: Partial<PlotData> = {
      x: [maxDrawdownPoint.date],
      y: [maxDrawdownPoint.drawdownPct],
      type: 'scatter' as const,
      mode: 'markers',
      name: `Max Drawdown: ${maxDrawdownPoint.drawdownPct.toFixed(1)}%`,
      marker: {
        color: '#dc2626',
        size: 12,
        symbol: 'x',
        line: { width: 2, color: '#991b1b' }
      },
      hovertemplate:
        '<b>Maximum Drawdown</b><br>' +
        '<b>Date:</b> %{x}<br>' +
        '<b>Drawdown:</b> %{y:.2f}%<br>' +
        '<extra></extra>'
    }

    const traces: Partial<PlotData>[] = [zeroLineTrace, drawdownTrace, maxDrawdownTrace]

    const minDrawdown = Math.min(...drawdownData.map(d => d.drawdownPct))

    const chartLayout: Partial<Layout> = {
      ...createLineChartLayout('', 'Date', 'Drawdown (%)'),
      yaxis: {
        title: { text: 'Drawdown (%)' },
        showgrid: true,
        zeroline: true,
        zerolinecolor: '#000',
        zerolinewidth: 1,
        tickformat: '.1f',
        range: [minDrawdown * 1.1, 5] // Show a bit above zero
      },
      legend: {
        orientation: 'h',
        yanchor: 'bottom',
        y: 1.02,
        xanchor: 'right',
        x: 1
      },
      annotations: [{
        x: maxDrawdownPoint.date,
        y: maxDrawdownPoint.drawdownPct,
        text: 'Max DD',
        showarrow: true,
        arrowhead: 2,
        arrowsize: 1,
        arrowwidth: 2,
        arrowcolor: '#dc2626',
        ax: 0,
        ay: -30,
        font: { size: 10, color: '#dc2626' }
      }]
    }

    return { plotData: traces, layout: chartLayout }
  }, [data])

  if (!data) {
    return (
      <ChartWrapper
        title="Drawdown"
        description="Visualize portfolio drawdown periods and recovery"
        className={className}
        data={[]}
        layout={{}}
      />
    )
  }

  return (
    <ChartWrapper
      title="Drawdown"
      description="Visualize portfolio drawdown periods and recovery patterns"
      className={className}
      data={plotData}
      layout={layout}
      style={{ height: '300px' }}
    />
  )
}