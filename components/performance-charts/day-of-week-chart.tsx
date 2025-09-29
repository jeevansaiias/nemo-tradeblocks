"use client"

import React, { useMemo } from 'react'
import { ChartWrapper, createBarChartLayout } from './chart-wrapper'
import { usePerformanceStore } from '@/lib/stores/performance-store'
import type { Layout, PlotData } from 'plotly.js'

interface DayOfWeekChartProps {
  className?: string
}

const DAY_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

export function DayOfWeekChart({ className }: DayOfWeekChartProps) {
  const { data } = usePerformanceStore()

  const { plotData, layout } = useMemo(() => {
    if (!data?.dayOfWeekData) {
      return { plotData: [], layout: {} }
    }

    // Sort data by day order
    const sortedData = [...data.dayOfWeekData].sort(
      (a, b) => DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day)
    )

    const days = sortedData.map(item => item.day)
    const counts = sortedData.map(item => item.count)
    const avgPls = sortedData.map(item => item.avgPl)

    // Color bars based on profitability
    const colors = avgPls.map(pl => pl > 0 ? '#22c55e' : '#ef4444')

    // Create text labels showing average P/L
    const textLabels = avgPls.map(pl => `$${pl >= 0 ? '+' : ''}${pl.toFixed(0)}`)

    const barTrace: Partial<PlotData> = {
      x: days,
      y: counts,
      type: 'bar',
      marker: { color: colors },
      text: textLabels,
      textposition: 'inside',
      textfont: {
        size: 12,
        color: 'white',
        family: 'Arial Black'
      },
      hovertemplate:
        '<b>%{x}</b><br>' +
        '<b>Trade Count:</b> %{y}<br>' +
        '<b>Avg P/L:</b> $%{customdata}<br>' +
        '<extra></extra>',
      customdata: avgPls.map(pl => `${pl >= 0 ? '+' : ''}${pl.toFixed(0)}`)
    }

    const chartLayout: Partial<Layout> = {
      ...createBarChartLayout('', 'Day of Week', 'Number of Trades'),
      yaxis: {
        title: { text: 'Number of Trades' },
        showgrid: true,
        zeroline: true,
        zerolinecolor: '#e5e7eb',
        zerolinewidth: 1
      },
      xaxis: {
        title: { text: 'Day of Week' },
        showgrid: false
      }
    }

    return { plotData: [barTrace], layout: chartLayout }
  }, [data])

  if (!data) {
    return (
      <ChartWrapper
        title="📅 Day of Week Patterns"
        description="Trading activity and performance by day of the week"
        className={className}
        data={[]}
        layout={{}}
      />
    )
  }

  return (
    <ChartWrapper
      title="📅 Day of Week Patterns"
      description="Trading activity and performance patterns across weekdays"
      className={className}
      data={plotData}
      layout={layout}
      style={{ height: '300px' }}
    />
  )
}