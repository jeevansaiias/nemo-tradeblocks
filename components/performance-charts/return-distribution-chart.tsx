"use client"

import React, { useMemo } from 'react'
import { ChartWrapper, createHistogramLayout } from './chart-wrapper'
import { usePerformanceStore } from '@/lib/stores/performance-store'
import type { PlotData } from 'plotly.js'

interface ReturnDistributionChartProps {
  className?: string
}

export function ReturnDistributionChart({ className }: ReturnDistributionChartProps) {
  const { data } = usePerformanceStore()

  const { plotData, layout } = useMemo(() => {
    if (!data?.returnDistribution || data.returnDistribution.length === 0) {
      return { plotData: [], layout: {} }
    }

    const { returnDistribution } = data

    // Calculate statistics
    const mean = returnDistribution.reduce((sum, val) => sum + val, 0) / returnDistribution.length
    const median = [...returnDistribution].sort((a, b) => a - b)[Math.floor(returnDistribution.length / 2)]

    // Create histogram
    const histogramTrace = {
      x: returnDistribution,
      type: 'histogram' as const,
      nbinsx: 30,
      name: 'ROM Distribution',
      marker: {
        color: returnDistribution,
        colorscale: [
          [0, '#ef4444'], // Red for losses
          [0.5, '#f59e0b'], // Orange for small gains
          [1, '#10b981']  // Green for large gains
        ],
        showscale: false,
        line: { color: 'white', width: 1 }
      },
      hovertemplate:
        '<b>ROM Range:</b> %{x:.1f}%<br>' +
        '<b>Trade Count:</b> %{y}<br>' +
        '<extra></extra>'
    }

    const traces: Partial<PlotData>[] = [histogramTrace]

    // Smart x-axis range
    const minRom = Math.min(...returnDistribution)
    const maxRom = Math.max(...returnDistribution)
    const rangePadding = (maxRom - minRom) * 0.1
    const xMin = Math.max(-100, minRom - rangePadding)
    const xMax = Math.min(200, maxRom + rangePadding)

    const chartLayout = {
      ...createHistogramLayout('', 'Return on Margin (%)', 'Number of Trades'),
      xaxis: {
        title: { text: 'Return on Margin (%)' },
        showgrid: true,
        range: [xMin, xMax]
      },
      yaxis: {
        title: { text: 'Number of Trades' },
        showgrid: true
      },
      legend: {
        orientation: 'h' as const,
        yanchor: 'bottom' as const,
        y: 1.02,
        xanchor: 'right' as const,
        x: 1
      },
      shapes: [
        // Mean vertical line
        {
          type: 'line' as const,
          x0: mean,
          x1: mean,
          y0: 0,
          y1: 1,
          yref: 'paper' as const,
          line: { color: '#3b82f6', width: 2, dash: 'dash' as const }
        },
        // Median vertical line
        {
          type: 'line' as const,
          x0: median,
          x1: median,
          y0: 0,
          y1: 1,
          yref: 'paper' as const,
          line: { color: '#10b981', width: 2, dash: 'dot' as const }
        }
      ]
    }

    return { plotData: traces, layout: chartLayout }
  }, [data])

  if (!data) {
    return (
      <ChartWrapper
        title="📊 Return Distribution"
        description="Histogram of returns showing the frequency of different performance levels"
        className={className}
        data={[]}
        layout={{}}
      />
    )
  }

  return (
    <ChartWrapper
      title="📊 Return Distribution"
      description="Distribution of return on margin values with statistical indicators"
      className={className}
      data={plotData}
      layout={layout}
      style={{ height: '300px' }}
    />
  )
}