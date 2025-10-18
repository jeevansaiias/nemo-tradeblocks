"use client"

import React, { useMemo } from 'react'
import { ChartWrapper } from './chart-wrapper'
import { usePerformanceStore } from '@/lib/stores/performance-store'
import type { Layout, PlotData } from 'plotly.js'

interface ExcursionRatioChartProps {
  className?: string
  groupBy?: 'time' | 'strategy'
}

export function ExcursionRatioChart({ className, groupBy = 'time' }: ExcursionRatioChartProps) {
  const { data } = usePerformanceStore()

  const { plotData, layout } = useMemo(() => {
    if (!data?.mfeMaeData || data.mfeMaeData.length === 0) {
      return { plotData: [], layout: {} }
    }

    const { mfeMaeData } = data

    // Filter to trades with excursion ratio
    const validData = mfeMaeData.filter(d =>
      d.excursionRatio !== undefined && isFinite(d.excursionRatio)
    )

    if (validData.length === 0) {
      return { plotData: [], layout: {} }
    }

    const traces: Partial<PlotData>[] = []

    if (groupBy === 'time') {
      // Time series view
      const tradeNumbers = validData.map(d => d.tradeNumber)
      const ratios = validData.map(d => d.excursionRatio!)
      const colors = validData.map(d => d.isWinner ? '#22c55e' : '#ef4444')

      traces.push({
        x: tradeNumbers,
        y: ratios,
        type: 'scatter',
        mode: 'markers',
        name: 'Excursion Ratio',
        marker: {
          color: colors,
          size: 8,
          opacity: 0.7
        },
        customdata: validData.map(d => ({
          date: d.date.toLocaleDateString(),
          strategy: d.strategy,
          mfe: d.mfe,
          mae: d.mae,
          pl: d.pl
        })),
        hovertemplate:
          '<b>Trade #%{x}</b><br>' +
          'Ratio: %{y:.2f}<br>' +
          'Strategy: %{customdata.strategy}<br>' +
          'Date: %{customdata.date}<br>' +
          'MFE: $%{customdata.mfe:.0f}<br>' +
          'MAE: $%{customdata.mae:.0f}<br>' +
          'P&L: $%{customdata.pl:.0f}<br>' +
          '<extra></extra>'
      })

      // Add average line
      const avgRatio = ratios.reduce((sum, r) => sum + r, 0) / ratios.length
      traces.push({
        x: [Math.min(...tradeNumbers), Math.max(...tradeNumbers)],
        y: [avgRatio, avgRatio],
        type: 'scatter',
        mode: 'lines',
        name: `Average (${avgRatio.toFixed(2)})`,
        line: {
          color: '#3b82f6',
          width: 2,
          dash: 'dash'
        },
        hoverinfo: 'skip',
        showlegend: true
      })

      // Add 1.0 reference line (break-even)
      traces.push({
        x: [Math.min(...tradeNumbers), Math.max(...tradeNumbers)],
        y: [1, 1],
        type: 'scatter',
        mode: 'lines',
        name: 'Ratio = 1.0',
        line: {
          color: '#6b7280',
          width: 1,
          dash: 'dot'
        },
        hoverinfo: 'skip',
        showlegend: true
      })

    } else {
      // Strategy comparison view
      const strategyMap = new Map<string, number[]>()

      validData.forEach(d => {
        if (!strategyMap.has(d.strategy)) {
          strategyMap.set(d.strategy, [])
        }
        strategyMap.get(d.strategy)!.push(d.excursionRatio!)
      })

      const strategies = Array.from(strategyMap.keys()).sort()
      const avgRatios = strategies.map(strategy => {
        const ratios = strategyMap.get(strategy)!
        return ratios.reduce((sum, r) => sum + r, 0) / ratios.length
      })

      traces.push({
        x: strategies,
        y: avgRatios,
        type: 'bar',
        name: 'Avg Excursion Ratio',
        marker: {
          color: avgRatios.map(r => r >= 1 ? '#22c55e' : '#ef4444'),
          opacity: 0.8
        },
        hovertemplate:
          '<b>%{x}</b><br>' +
          'Avg Ratio: %{y:.2f}<br>' +
          '<extra></extra>'
      })
    }

    const chartLayout: Partial<Layout> = {
      xaxis: {
        title: { text: groupBy === 'time' ? 'Trade Number' : 'Strategy' },
        showgrid: true
      },
      yaxis: {
        title: { text: 'MFE/MAE Ratio' },
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
      shapes: groupBy === 'time' ? [
        {
          type: 'rect',
          xref: 'paper',
          yref: 'y',
          x0: 0,
          x1: 1,
          y0: 1,
          y1: Infinity,
          fillcolor: 'rgba(34, 197, 94, 0.1)',
          line: { width: 0 },
          layer: 'below'
        }
      ] : [],
      annotations: groupBy === 'time' ? [
        {
          text: 'Favorable zone (Ratio > 1)',
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
          }
        }
      ] : []
    }

    return { plotData: traces, layout: chartLayout }
  }, [data, groupBy])

  const tooltip = {
    flavor: "The reward-to-risk balance - do your trades offer more upside than downside?",
    detailed: "Excursion Ratio = MFE / MAE. A ratio above 1.0 means the trade had more profit potential (MFE) than risk (MAE), which is ideal. A ratio below 1.0 indicates more downside than upside. Consistently high ratios suggest you're entering trades with favorable risk/reward setups. Low ratios might indicate poor entry timing or trading against the trend. Green dots represent winning trades, red dots are losers. The average line helps identify if your typical trade setup is favorable. Use this to evaluate entry quality and whether you're selecting trades with adequate profit potential relative to their risk."
  }

  if (!data || !data.mfeMaeData || data.mfeMaeData.length === 0) {
    return (
      <ChartWrapper
        title="⚖️ Excursion Ratio Analysis"
        description="MFE/MAE ratio over time - reward vs risk balance"
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
      title="⚖️ Excursion Ratio Analysis"
      description={groupBy === 'time'
        ? "MFE/MAE ratio over time - higher values indicate better reward/risk balance"
        : "Average MFE/MAE ratio by strategy"}
      className={className}
      data={plotData}
      layout={layout}
      style={{ height: '450px' }}
      tooltip={tooltip}
    />
  )
}
