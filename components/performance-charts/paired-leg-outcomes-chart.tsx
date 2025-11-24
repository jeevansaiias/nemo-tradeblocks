"use client"

import { useMemo } from 'react'
import { format } from 'date-fns'
import type { Layout, PlotData } from 'plotly.js'
import { ChartWrapper } from './chart-wrapper'
import { usePerformanceStore } from '@/lib/stores/performance-store'

interface GroupedLegOutcomesChartProps {
  className?: string
}

const MAX_POINTS = 40

const OUTCOME_LABELS: Record<string, string> = {
  all_losses: 'All Legs Lost',
  all_wins: 'All Legs Won',
  mixed: 'Mixed Outcome',
  single_direction: 'Same Direction'
}

const OUTCOME_COLORS: Record<string, string> = {
  all_losses: '#f87171',
  all_wins: '#4ade80',
  mixed: '#facc15',
  single_direction: '#93c5fd'
}

export function GroupedLegOutcomesChart({ className }: GroupedLegOutcomesChartProps) {
  const { data } = usePerformanceStore()

  const { plotData, layout, hasData, summary } = useMemo(() => {
    if (!data?.groupedLegOutcomes) {
      return { plotData: [], layout: {}, hasData: false, summary: null }
    }

    const entries = data.groupedLegOutcomes.entries
    const recentEntries =
      entries.length > MAX_POINTS ? entries.slice(-MAX_POINTS) : entries

    const labelFormatter = (iso: string, time?: string) => {
      const dateLabel = format(new Date(iso), "MMM d")
      return time ? `${dateLabel} ${time}` : dateLabel
    }

    const labels = recentEntries.map(entry =>
      labelFormatter(entry.dateOpened, entry.timeOpened)
    )

    const combinedValues = recentEntries.map(entry => entry.combinedPl)
    const colors = recentEntries.map(entry => OUTCOME_COLORS[entry.outcome] ?? '#cbd5f5')
    const custom = recentEntries.map(entry => [
      OUTCOME_LABELS[entry.outcome] ?? entry.outcome,
      entry.legCount,
      entry.positiveLegs,
      entry.negativeLegs
    ])

    const combinedTrace: Partial<PlotData> = {
      x: labels,
      y: combinedValues,
      type: 'bar',
      name: 'Combined P/L',
      marker: { color: colors },
      customdata: custom,
      hovertemplate:
        '<b>%{x}</b><br><b>Outcome:</b> %{customdata[0]}<br><b>Combined:</b> $%{y:.2f}<br><b>Legs:</b> %{customdata[1]} (↑%{customdata[2]} / ↓%{customdata[3]})<extra></extra>'
    }

    const layout: Partial<Layout> = {
      barmode: 'relative',
      xaxis: {
        title: { text: 'Entries (chronological)' },
        tickangle: -45
      },
      yaxis: {
        title: { text: 'P/L ($)' },
        zeroline: true,
        zerolinecolor: '#94a3b8'
      },
      legend: { orientation: 'h', y: -0.25 }
    }

    return {
      plotData: [combinedTrace],
      layout,
      hasData: labels.length > 0,
      summary: data.groupedLegOutcomes.summary
    }
  }, [data])

  const tooltip = {
    flavor: "Outcome map for every grouped entry.",
    detailed:
      "Whether you pair calls vs. puts or two overlapping spreads, this shows how each grouped entry resolved—double wins, mixed results, or full wipeouts—so you can spot which sessions snowball."
  }

  const summaryFooter = summary ? (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
      <SummaryCell label="Tracked Entries" value={summary.totalEntries} />
      <SummaryCell label="All Legs Lost" value={summary.allLosses} accent="text-red-500" />
      <SummaryCell label="All Legs Won" value={summary.allWins} accent="text-emerald-500" />
      <SummaryCell label="Mixed Outcomes" value={summary.mixedOutcomes} accent="text-amber-500" />
      <SummaryCell
        label="All-Loss Damage ($)"
        value={currencyFormatter.format(summary.totalAllLossMagnitude)}
      />
    </div>
  ) : undefined

  if (!hasData) {
    return (
      <ChartWrapper
        title="🧲 Grouped Leg Outcomes"
        description="Outcome-based view for simultaneous entries"
        className={className}
        data={[]}
        layout={{}}
        tooltip={tooltip}
        style={{ height: '360px' }}
        contentOverlay={
          <EmptyState message="No grouped entries yet. Enable combine leg groups to unlock this view." />
        }
      />
    )
  }

  return (
    <ChartWrapper
      title="🧲 Grouped Leg Outcomes"
      description="Outcome-based performance for grouped entries"
      className={className}
      data={hasData ? plotData : []}
      layout={layout}
      tooltip={tooltip}
      footer={summaryFooter}
      style={{ height: '360px' }}
    />
  )
}

function SummaryCell({
  label,
  value,
  accent
}: {
  label: string
  value: number | string
  accent?: string
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`text-base font-semibold ${accent ?? ''}`}>{value}</p>
    </div>
  )
}

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0
})

function EmptyState({ message }: { message: string }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
      {message}
    </div>
  )
}
