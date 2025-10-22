"use client"

import React, { useEffect, useMemo, useState } from 'react'
import { ChartWrapper } from './chart-wrapper'
import { usePerformanceStore } from '@/lib/stores/performance-store'
import type { Layout, PlotData } from 'plotly.js'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { NORMALIZATION_BASES, type NormalizationBasis } from '@/lib/calculations/mfe-mae'

const basisLabels: Record<NormalizationBasis, string> = {
  premium: 'Collected Premium',
  margin: 'Margin Requirement'
}

interface MFEMAEScatterChartProps {
  className?: string
}

export function MFEMAEScatterChart({ className }: MFEMAEScatterChartProps) {
  const { data } = usePerformanceStore()
  const [selectedBasis, setSelectedBasis] = useState<NormalizationBasis | null>(null)

  const basisOptions = useMemo(() => {
    if (!data?.mfeMaeData) {
      return NORMALIZATION_BASES.map(basis => ({ value: basis, label: `${basisLabels[basis]} (0)`, disabled: true }))
    }

    return NORMALIZATION_BASES.map(basis => {
      const count = data.mfeMaeData.filter(point => point.normalizedBy?.[basis]).length
      return {
        value: basis,
        label: `${basisLabels[basis]} (${count})`,
        disabled: count === 0
      }
    })
  }, [data])

  useEffect(() => {
    const firstAvailable = basisOptions.find(option => !option.disabled)?.value ?? null
    setSelectedBasis(prev => (prev && !basisOptions.find(option => option.value === prev && option.disabled) ? prev : firstAvailable))
  }, [basisOptions])

  const { plotData, layout } = useMemo(() => {
    if (!data?.mfeMaeData || data.mfeMaeData.length === 0 || !selectedBasis) {
      return { plotData: [], layout: {} }
    }

    const { mfeMaeData } = data

    const basisData = mfeMaeData.filter(d => d.normalizedBy?.[selectedBasis])

    if (basisData.length === 0) {
      return { plotData: [], layout: {} }
    }

    // Split into winners and losers
    const winners = basisData.filter(d => d.isWinner)
    const losers = basisData.filter(d => !d.isWinner)

    const traces: Partial<PlotData>[] = []

    // Winners scatter plot
    if (winners.length > 0) {
      traces.push({
        x: winners.map(d => d.normalizedBy[selectedBasis]!.maePercent),
        y: winners.map(d => d.normalizedBy[selectedBasis]!.mfePercent),
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
          profitCapture: d.profitCapturePercent?.toFixed(1) || 'N/A',
          basisLabel: basisLabels[selectedBasis],
          denominatorLabel: d.normalizedBy[selectedBasis]?.denominator ? `$${d.normalizedBy[selectedBasis]!.denominator.toLocaleString()}` : '—',
          maeRaw: d.mae,
          mfeRaw: d.mfe,
          plPercent: `${d.normalizedBy[selectedBasis]!.plPercent.toFixed(1)}%`
        })) as unknown as PlotData['customdata'],
        hovertemplate:
          '<b>Winner - Trade #%{customdata.trade}</b><br>' +
          'Strategy: %{customdata.strategy}<br>' +
          'Date: %{customdata.date}<br>' +
          'MAE: %{x:.1f}%<br>' +
          'MFE: %{y:.1f}%<br>' +
          'P&L: $%{customdata.pl:.0f}<br>' +
          'Profit Capture: %{customdata.profitCapture}%<br>' +
          'Normalization: %{customdata.basisLabel}<br>' +
          'Denominator: %{customdata.denominatorLabel}<br>' +
          'Raw MAE: $%{customdata.maeRaw:.0f}<br>' +
          'Raw MFE: $%{customdata.mfeRaw:.0f}<br>' +
          'P&L Normalized: %{customdata.plPercent}' +
          '<extra></extra>'
      })
    }

    // Losers scatter plot
    if (losers.length > 0) {
      traces.push({
        x: losers.map(d => d.normalizedBy[selectedBasis]!.maePercent),
        y: losers.map(d => d.normalizedBy[selectedBasis]!.mfePercent),
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
          profitCapture: d.profitCapturePercent?.toFixed(1) || 'N/A',
          basisLabel: basisLabels[selectedBasis],
          denominatorLabel: d.normalizedBy[selectedBasis]?.denominator ? `$${d.normalizedBy[selectedBasis]!.denominator.toLocaleString()}` : '—',
          maeRaw: d.mae,
          mfeRaw: d.mfe,
          plPercent: `${d.normalizedBy[selectedBasis]!.plPercent.toFixed(1)}%`
        })) as unknown as PlotData['customdata'],
        hovertemplate:
          '<b>Loser - Trade #%{customdata.trade}</b><br>' +
          'Strategy: %{customdata.strategy}<br>' +
          'Date: %{customdata.date}<br>' +
          'MAE: %{x:.1f}%<br>' +
          'MFE: %{y:.1f}%<br>' +
          'P&L: $%{customdata.pl:.0f}<br>' +
          'Profit Capture: %{customdata.profitCapture}%<br>' +
          'Normalization: %{customdata.basisLabel}<br>' +
          'Denominator: %{customdata.denominatorLabel}<br>' +
          'Raw MAE: $%{customdata.maeRaw:.0f}<br>' +
          'Raw MFE: $%{customdata.mfeRaw:.0f}<br>' +
          'P&L Normalized: %{customdata.plPercent}' +
          '<extra></extra>'
      })
    }

    // Add diagonal reference line (MFE = MAE)
    const maxVal = Math.max(
      ...basisData.map(d => {
        const metrics = d.normalizedBy[selectedBasis]!
        return Math.max(metrics.maePercent || 0, metrics.mfePercent || 0)
      })
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
  }, [data, selectedBasis])

  const description = selectedBasis
    ? `Backtest theoretical risk vs reward normalized by ${basisLabels[selectedBasis]}`
    : 'Backtest theoretical risk vs reward'

  const basisSelect = (
    <Select
      value={selectedBasis ?? undefined}
      onValueChange={(value) => setSelectedBasis(value as NormalizationBasis)}
    >
      <SelectTrigger size="sm">
        <SelectValue placeholder="Select normalization basis" />
      </SelectTrigger>
      <SelectContent>
        {basisOptions.map(option => (
          <SelectItem key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )

  const tooltip = {
    flavor: "The opportunity map - see how much theoretical profit potential you had versus modeled risk on each trade.",
    detailed: "Each point represents a backtest trade plotted by its Maximum Adverse Excursion (worst modeled drawdown) on the x-axis and Maximum Favorable Excursion (peak modeled profit) on the y-axis. Trades in the upper-left quadrant had the best risk/reward profiles - high profit potential with low drawdowns. The diagonal line shows where MFE equals MAE. Points above the line had more upside than downside, while points below had more risk than reward. Use the basis selector to normalize by collected premium or margin requirement so you compare trades on the same scale."
  }

  if (!data || !data.mfeMaeData || data.mfeMaeData.length === 0) {
    return (
      <ChartWrapper
        title="🎯 MFE vs MAE Analysis"
        description="Maximum Favorable vs Adverse Excursion scatter plot (backtest theoretical)"
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
      description={description}
      className={className}
      data={plotData}
      layout={layout}
      style={{ height: '500px' }}
      tooltip={tooltip}
      actions={basisSelect}
    />
  )
}
