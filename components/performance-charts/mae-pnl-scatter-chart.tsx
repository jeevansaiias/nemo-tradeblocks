"use client"

import React, { useEffect, useMemo, useState } from 'react'
import { ChartWrapper } from './chart-wrapper'
import { usePerformanceStore } from '@/lib/stores/performance-store'
import type { Layout, PlotData } from 'plotly.js'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { EfficiencyBasis } from '@/lib/metrics/trade-efficiency'
import { NORMALIZATION_BASES, type NormalizationBasis } from '@/lib/calculations/mfe-mae'

type BasisFilter = NormalizationBasis | 'all'
type MetricMode = 'absolute' | 'normalized'

interface MaePnlScatterChartProps {
  className?: string
}

const normalizationBasisLabels: Record<NormalizationBasis, string> = {
  premium: 'Collected Premium',
  margin: 'Margin Requirement'
}

const efficiencyBasisLabels: Record<EfficiencyBasis, string> = {
  premium: 'Collected Premium',
  maxProfit: 'Maximum Profit',
  margin: 'Margin Requirement',
  unknown: 'Unknown Basis'
}

export function MaePnlScatterChart({ className }: MaePnlScatterChartProps) {
  const { data } = usePerformanceStore()
  const [basisFilter, setBasisFilter] = useState<BasisFilter>('all')
  const [metricMode, setMetricMode] = useState<MetricMode>('absolute')

  const basisOptions = useMemo(() => {
    if (!data?.mfeMaeData) {
      return NORMALIZATION_BASES.map(basis => ({
        value: basis,
        label: `${normalizationBasisLabels[basis]} (0)`,
        disabled: true
      }))
    }

    return NORMALIZATION_BASES.map(basis => {
      const count = data.mfeMaeData.filter(point => point.normalizedBy?.[basis]).length
      return {
        value: basis,
        label: `${normalizationBasisLabels[basis]} (${count})`,
        disabled: count === 0
      }
    })
  }, [data])

  useEffect(() => {
    if (basisFilter === 'all' && metricMode === 'normalized') {
      setMetricMode('absolute')
    }
  }, [basisFilter, metricMode])

  useEffect(() => {
    if (basisFilter === 'all') return

    const stillPresent = basisOptions.some(option => option.value === basisFilter && !option.disabled)
    if (!stillPresent) {
      const fallback = basisOptions.find(option => !option.disabled)?.value
      setBasisFilter(fallback ?? 'all')
    }
  }, [basisFilter, basisOptions])

  const { plotData, layout } = useMemo(() => {
    if (!data?.mfeMaeData || data.mfeMaeData.length === 0) {
      return { plotData: [], layout: {} }
    }

    const base = data.mfeMaeData.filter(point => {
      if (metricMode === 'absolute') {
        return point.mae !== undefined && isFinite(point.mae) && point.pl !== undefined
      }

      if (basisFilter === 'all') {
        return false
      }

      return Boolean(point.normalizedBy?.[basisFilter])
    })

    if (base.length === 0) {
      return { plotData: [], layout: {} }
    }

    const filteredByBasis = basisFilter === 'all'
      ? base
      : base.filter(point => point.normalizedBy?.[basisFilter])

    if (filteredByBasis.length === 0) {
      return { plotData: [], layout: {} }
    }

    const winners = filteredByBasis.filter(point => point.isWinner)
    const losers = filteredByBasis.filter(point => !point.isWinner)

    const valueFor = (point: typeof filteredByBasis[number]) => {
      if (metricMode === 'absolute') {
        return {
          x: point.mae,
          y: point.pl
        }
      }

      const metrics = basisFilter !== 'all' ? point.normalizedBy?.[basisFilter] : undefined
      return {
        x: metrics?.maePercent ?? 0,
        y: metrics?.plPercent ?? 0
      }
    }

    const toCustomData = (point: typeof filteredByBasis[number]) => {
      const normalizedMetrics = basisFilter !== 'all' ? point.normalizedBy?.[basisFilter] : undefined

      return {
        trade: point.tradeNumber,
        strategy: point.strategy,
        date: point.date.toLocaleDateString(),
        mfeRaw: point.mfe,
        maeRaw: point.mae,
        mfePercent: normalizedMetrics ? `${normalizedMetrics.mfePercent.toFixed(1)}%` : 'N/A',
        maePercent: normalizedMetrics ? `${normalizedMetrics.maePercent.toFixed(1)}%` : 'N/A',
        pl: point.pl,
        plPercent: normalizedMetrics ? `${normalizedMetrics.plPercent.toFixed(1)}%` : 'N/A',
        basisLabel: basisFilter === 'all'
          ? efficiencyBasisLabels[point.basis]
          : normalizationBasisLabels[basisFilter],
        denominatorLabel: normalizedMetrics?.denominator
          ? `$${normalizedMetrics.denominator.toLocaleString()}`
          : point.denominator ? `$${point.denominator.toLocaleString()}` : '—'
      }
    }

    const traces: Partial<PlotData>[] = []

    if (winners.length > 0) {
      traces.push({
        x: winners.map(point => valueFor(point).x),
        y: winners.map(point => valueFor(point).y),
        type: 'scatter',
        mode: 'markers',
        name: 'Winners',
        marker: {
          color: '#22c55e',
          size: 8,
          opacity: 0.75,
          line: {
            color: '#16a34a',
            width: 1
          }
        },
        customdata: winners.map(toCustomData),
        hovertemplate:
          '<b>Winner - Trade #%{customdata.trade}</b><br>' +
          'Strategy: %{customdata.strategy}<br>' +
          'Date: %{customdata.date}<br>' +
          (metricMode === 'absolute'
            ? 'MAE: $%{x:.0f}<br>P&L: $%{y:.0f}<br>'
            : 'MAE: %{x:.1f}%<br>P&L: %{y:.1f}%<br>') +
          'Raw MAE: $%{customdata.maeRaw:.0f}<br>' +
          'Raw MFE: $%{customdata.mfeRaw:.0f}<br>' +
          'MFE Percent: %{customdata.mfePercent}<br>' +
          'P&L Percent: %{customdata.plPercent}<br>' +
          'Normalization: %{customdata.basisLabel}<br>' +
          'Denominator: %{customdata.denominatorLabel}' +
          '<extra></extra>'
      })
    }

    if (losers.length > 0) {
      traces.push({
        x: losers.map(point => valueFor(point).x),
        y: losers.map(point => valueFor(point).y),
        type: 'scatter',
        mode: 'markers',
        name: 'Losers',
        marker: {
          color: '#ef4444',
          size: 8,
          opacity: 0.75,
          line: {
            color: '#dc2626',
            width: 1
          }
        },
        customdata: losers.map(toCustomData),
        hovertemplate:
          '<b>Loser - Trade #%{customdata.trade}</b><br>' +
          'Strategy: %{customdata.strategy}<br>' +
          'Date: %{customdata.date}<br>' +
          (metricMode === 'absolute'
            ? 'MAE: $%{x:.0f}<br>P&L: $%{y:.0f}<br>'
            : 'MAE: %{x:.1f}%<br>P&L: %{y:.1f}%<br>') +
          'Raw MAE: $%{customdata.maeRaw:.0f}<br>' +
          'Raw MFE: $%{customdata.mfeRaw:.0f}<br>' +
          'MFE Percent: %{customdata.mfePercent}<br>' +
          'P&L Percent: %{customdata.plPercent}<br>' +
          'Normalization: %{customdata.basisLabel}<br>' +
          'Denominator: %{customdata.denominatorLabel}' +
          '<extra></extra>'
      })
    }

    const xAxisTitle = metricMode === 'absolute'
      ? 'Maximum Adverse Excursion ($)'
      : 'Maximum Adverse Excursion (%)'
    const yAxisTitle = metricMode === 'absolute'
      ? 'Realized P&L ($)'
      : 'Realized P&L (%)'

    const chartLayout: Partial<Layout> = {
      xaxis: {
        title: { text: xAxisTitle },
        showgrid: true,
        zeroline: true
      },
      yaxis: {
        title: { text: yAxisTitle },
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
          type: 'line',
          xref: 'paper',
          yref: 'y',
          x0: 0,
          x1: 1,
          y0: 0,
          y1: 0,
          line: {
            color: '#6b7280',
            width: 1,
            dash: 'dot'
          }
        }
      ],
      annotations: [
        {
          text: metricMode === 'absolute'
            ? 'Lower MAE & higher P&L = favorable trades'
            : 'Higher P&L% with controlled MAE% = favorable trades',
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
          bgcolor: 'rgba(255, 255, 255, 0.85)',
          borderpad: 4
        }
      ]
    }

    return { plotData: traces, layout: chartLayout }
  }, [basisFilter, data, metricMode])

  const description = (() => {
    if (!data?.mfeMaeData || data.mfeMaeData.length === 0) {
      return 'MAE vs. P&L scatter plot'
    }

    const basisText = basisFilter === 'all'
      ? 'all normalization bases'
      : normalizationBasisLabels[basisFilter]

    const modeText = metricMode === 'absolute' ? 'absolute dollars' : 'normalized percentages'
    const suffix = basisFilter === 'all'
      ? ' — select a normalization basis to unlock % view'
      : ''

    return `Backtest theoretical: MAE vs. realized P&L shown in ${modeText} (${basisText})${suffix}`
  })()

  const basisSelect = (
    <Select value={basisFilter} onValueChange={value => setBasisFilter(value as BasisFilter)}>
      <SelectTrigger size="sm">
        <SelectValue placeholder="Filter by basis" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All bases ({data?.mfeMaeData?.length ?? 0})</SelectItem>
        {basisOptions.map(option => (
          <SelectItem key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )

  const scaleSelect = (
    <Select value={metricMode} onValueChange={value => setMetricMode(value as MetricMode)}>
      <SelectTrigger size="sm">
        <SelectValue placeholder="Scale" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="absolute">Absolute $</SelectItem>
        <SelectItem value="normalized" disabled={basisFilter === 'all'}>
          {basisFilter === 'all' ? 'Normalized % (select basis first)' : 'Normalized %'}
        </SelectItem>
      </SelectContent>
    </Select>
  )

  const actions = (
    <div className="flex flex-wrap items-center gap-2">
      {basisSelect}
      {scaleSelect}
    </div>
  )

  const tooltip = {
    flavor: 'Did modeled drawdowns translate into the P&L the backtest realized?',
    detailed:
      'Plots each backtest trade by its Maximum Adverse Excursion (risk taken) against the realized P&L. Use the basis filter to compare trades normalized by collected premium or margin requirement, then switch to percent view to evaluate efficiency relative to that basis.'
  }

  if (!data || !data.mfeMaeData || data.mfeMaeData.length === 0) {
    return (
      <ChartWrapper
        title="📉 MAE vs P&L"
        description="Maximum Adverse Excursion vs Realized P&L scatter plot"
        className={className}
        data={[]}
        layout={{}}
        style={{ height: '450px' }}
        tooltip={tooltip}
      />
    )
  }

  return (
    <ChartWrapper
      title="📉 MAE vs P&L"
      description={description}
      className={className}
      data={plotData}
      layout={layout}
      style={{ height: '500px' }}
      tooltip={tooltip}
      actions={actions}
    />
  )
}
