"use client"

import { useMemo } from 'react'
import type { Layout, PlotData } from 'plotly.js'
import { ChartWrapper } from './chart-wrapper'
import { usePerformanceStore } from '@/lib/stores/performance-store'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface VixRegimeChartProps {
  className?: string
}

/**
 * Volatility regimes derived from long-run VIX observations.
 * - Low volatility: VIX ≤ 18 (below long-term average of ~19)
 * - Medium volatility: 18 < VIX ≤ 25 (historically elevated)
 * - High volatility: VIX > 25 (stress conditions)
 */
const VIX_BUCKETS = [
  { name: '≤ 18', min: -Infinity, max: 18 },
  { name: '18 - 25', min: 18, max: 25 },
  { name: '≥ 25', min: 25, max: Infinity }
]

export function VixRegimeChart({ className }: VixRegimeChartProps) {
  const { data } = usePerformanceStore()

  const { plotData, layout, openingSummary, closingSummary } = useMemo(() => {
    if (!data?.volatilityRegimes || data.volatilityRegimes.length === 0) {
      return { plotData: [], layout: {}, openingSummary: [], closingSummary: [] }
    }

    const openingEntries = data.volatilityRegimes.filter(entry => typeof entry.openingVix === 'number')
    const closingEntries = data.volatilityRegimes.filter(entry => typeof entry.closingVix === 'number')

    const romValues = data.volatilityRegimes
      .map(entry => entry.rom)
      .filter((value): value is number => typeof value === 'number' && isFinite(value))

    const romExtent = romValues.length > 0 ? [Math.min(...romValues), Math.max(...romValues)] : [-50, 50]
    const symmetricMax = Math.max(Math.abs(romExtent[0]), Math.abs(romExtent[1])) || 1

    const profitValues = data.volatilityRegimes
      .map(entry => entry.pl)
      .filter((value): value is number => typeof value === 'number' && isFinite(value))

    const rawMin = profitValues.length > 0 ? Math.min(...profitValues) : -10_000
    const rawMax = profitValues.length > 0 ? Math.max(...profitValues) : 10_000

    const domainMin = rawMin
    const domainMax = rawMax

    const domainSpan = Math.abs(domainMax - domainMin)
    const domainPadding = domainSpan > 0 ? domainSpan * 0.12 : Math.max(1, Math.abs(domainMax || 1) * 0.1)

    const yMin = domainMin - domainPadding
    const yMax = domainMax + domainPadding

    const openingVixValues = openingEntries
      .map(entry => entry.openingVix)
      .filter((value): value is number => typeof value === 'number' && isFinite(value))
    const closingVixValues = closingEntries
      .map(entry => entry.closingVix)
      .filter((value): value is number => typeof value === 'number' && isFinite(value))
    const allVixValues = [...openingVixValues, ...closingVixValues]
    const vixMin = allVixValues.length > 0 ? Math.min(...allVixValues) : 12
    const vixMax = allVixValues.length > 0 ? Math.max(...allVixValues) : 30

    const bubbleSize = (pl: number) => {
      const magnitude = Math.abs(pl)
      if (!isFinite(magnitude)) return 8
      return Math.min(28, Math.max(8, Math.sqrt(magnitude) / 15))
    }

    const buildTrace = (entries: typeof openingEntries, isOpening: boolean): Partial<PlotData> => ({
      x: entries.map(entry => (isOpening ? entry.openingVix : entry.closingVix) as number),
      y: entries.map(entry => entry.pl),
      customdata: entries.map(entry => [
        entry.pl,
        entry.rom ?? null
      ]),
      mode: 'markers',
      type: 'scatter',
      name: isOpening ? 'Opening VIX' : 'Closing VIX',
      marker: {
        size: entries.map(entry => bubbleSize(entry.pl)),
        symbol: 'circle',
        color: entries.map(entry => entry.rom ?? 0),
        colorscale: 'RdYlBu',
        cmin: -symmetricMax,
        cmax: symmetricMax,
        showscale: true,
        colorbar: {
          title: { text: 'RoM %', side: 'right' },
          x: 1.02,
          len: 0.5,
          y: isOpening ? 0.75 : 0.25
        }
      },
      hovertemplate:
        `${isOpening ? 'Opening' : 'Closing'} VIX: %{x:.2f}<br>` +
        'P/L: $%{customdata[0]:,.0f}<br>' +
        'RoM: %{customdata[1]:.2f}%<extra></extra>',
      xaxis: isOpening ? 'x' : 'x2',
      yaxis: isOpening ? 'y' : 'y2'
    })

    const traces: Partial<PlotData>[] = []
    if (openingEntries.length > 0) traces.push(buildTrace(openingEntries, true))
    if (closingEntries.length > 0) traces.push(buildTrace(closingEntries, false))

    const buildSummary = (entries: typeof openingEntries, axisSuffix: '' | '2') => {
      return VIX_BUCKETS.map(bucket => {
        const bucketTrades = entries.filter(entry => {
          const vix = axisSuffix === ''
            ? entry.openingVix ?? 0
            : entry.closingVix ?? 0
          return vix >= bucket.min && vix < bucket.max
        })

        if (bucketTrades.length === 0) {
          return { avgRom: 0, winRate: 0, count: 0 }
        }

        const roms = bucketTrades
          .map(entry => entry.rom)
          .filter((rom): rom is number => typeof rom === 'number' && isFinite(rom))
        const avgRom = roms.length > 0
          ? roms.reduce((sum, value) => sum + value, 0) / roms.length
          : 0
        const wins = bucketTrades.filter(entry => entry.pl > 0).length
        const winRate = bucketTrades.length > 0 ? (wins / bucketTrades.length) * 100 : 0

        return {
          avgRom,
          winRate,
          count: bucketTrades.length
        }
      })
    }

    const openingSummary = buildSummary(openingEntries, '')
    const closingSummary = buildSummary(closingEntries, '2')

    const regimeShapes = (forOpening: boolean): Layout['shapes'] => {
      const xref = forOpening ? 'x' : 'x2'
      const yref = forOpening ? 'y' : 'y2'
      return [
        {
          type: 'rect',
          xref,
          yref,
          x0: 0,
          x1: 18,
          y0: yMin,
          y1: yMax,
          fillcolor: 'rgba(59,130,246,0.05)',
          line: { width: 0 }
        },
        {
          type: 'rect',
          xref,
          yref,
          x0: 18,
          x1: 25,
          y0: yMin,
          y1: yMax,
          fillcolor: 'rgba(234,179,8,0.07)',
          line: { width: 0 }
        },
        {
          type: 'rect',
          xref,
          yref,
          x0: 25,
          x1: 80,
          y0: yMin,
          y1: yMax,
          fillcolor: 'rgba(248,113,113,0.08)',
          line: { width: 0 }
        }
      ]
    }

    // Create title annotations for each subplot
    const titleAnnotations: Layout['annotations'] = [
      {
        text: '<b>Opening VIX vs. Profit/Loss</b>',
        xref: 'paper',
        yref: 'paper',
        x: 0.5,
        y: 1.0,
        xanchor: 'center',
        yanchor: 'bottom',
        showarrow: false,
        font: {
          size: 13,
          color: '#0f172a'
        }
      },
      {
        text: '<b>Closing VIX vs. Profit/Loss</b>',
        xref: 'paper',
        yref: 'paper',
        x: 0.5,
        y: 0.44,
        xanchor: 'center',
        yanchor: 'middle',
        showarrow: false,
        font: {
          size: 13,
          color: '#0f172a'
        }
      }
    ]

    // Add a horizontal divider line between the two charts
    const dividerShape: Layout['shapes'] = [{
      type: 'line',
      xref: 'paper',
      yref: 'paper',
      x0: 0.05,
      x1: 0.95,
      y0: 0.48,
      y1: 0.48,
      line: {
        color: '#e2e8f0',
        width: 1,
        dash: 'dot'
      }
    }]

    const chartLayout: Partial<Layout> = {
      grid: {
        rows: 2,
        columns: 1,
        pattern: 'independent',
        roworder: 'top to bottom'
      },
      xaxis: {
        title: { text: 'VIX' },
        zeroline: false,
        range: [Math.max(10, Math.floor(vixMin - 2)), Math.ceil(vixMax + 2)],
        anchor: 'y'
      },
      yaxis: {
        title: { text: 'Profit / Loss ($)' },
        zeroline: true,
        zerolinewidth: 1,
        zerolinecolor: '#94a3b8',
        range: [yMin, yMax],
        anchor: 'x',
        domain: [0.58, 0.98]
      },
      xaxis2: {
        title: { text: 'VIX' },
        zeroline: false,
        range: [Math.max(10, Math.floor(vixMin - 2)), Math.ceil(vixMax + 2)],
        anchor: 'y2'
      },
      yaxis2: {
        title: { text: 'Profit / Loss ($)' },
        zeroline: true,
        zerolinewidth: 1,
        zerolinecolor: '#94a3b8',
        range: [yMin, yMax],
        anchor: 'x2',
        domain: [0.02, 0.42]
      },
      showlegend: false,
      hovermode: 'closest',
      shapes: [...regimeShapes(true), ...regimeShapes(false), ...dividerShape],
      annotations: titleAnnotations,
      margin: {
        t: 20,
        r: 120,
        b: 60,
        l: 90
      }
    }

    return { plotData: traces, layout: chartLayout, openingSummary, closingSummary }
  }, [data?.volatilityRegimes])

  const tooltip = {
    flavor: 'How market volatility aligns with your wins and losses.',
    detailed:
      'Stacked view compares entry and exit volatility. Colors map return on margin, bubble size tracks P/L, and shaded zones highlight low, medium, and high-vol regimes. Stats table below shows performance by regime.'
  }

  const statsTable = (
    <div>
      <h4 className="text-sm font-semibold mb-3">Regime Statistics</h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h5 className="text-xs font-medium text-muted-foreground mb-2">Opening VIX</h5>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Regime</TableHead>
                <TableHead className="text-right">Avg RoM</TableHead>
                <TableHead className="text-right">Win Rate</TableHead>
                <TableHead className="text-right">Trades</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {openingSummary.map((stats, index) => (
                <TableRow key={`open-${index}`}>
                  <TableCell className="font-medium">{VIX_BUCKETS[index].name}</TableCell>
                  <TableCell className="text-right">{stats.avgRom.toFixed(1)}%</TableCell>
                  <TableCell className="text-right">{stats.winRate.toFixed(0)}%</TableCell>
                  <TableCell className="text-right">{stats.count}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div>
          <h5 className="text-xs font-medium text-muted-foreground mb-2">Closing VIX</h5>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Regime</TableHead>
                <TableHead className="text-right">Avg RoM</TableHead>
                <TableHead className="text-right">Win Rate</TableHead>
                <TableHead className="text-right">Trades</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {closingSummary.map((stats, index) => (
                <TableRow key={`close-${index}`}>
                  <TableCell className="font-medium">{VIX_BUCKETS[index].name}</TableCell>
                  <TableCell className="text-right">{stats.avgRom.toFixed(1)}%</TableCell>
                  <TableCell className="text-right">{stats.winRate.toFixed(0)}%</TableCell>
                  <TableCell className="text-right">{stats.count}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )

  return (
    <ChartWrapper
      title="🌀 Volatility Regimes"
      description="Entry and exit VIX versus profit, sized by P/L and colored by return on margin"
      className={className}
      data={plotData as PlotData[]}
      layout={layout}
      style={{ height: '700px' }}
      tooltip={tooltip}
      footer={statsTable}
    />
  )
}
