"use client"

import { useEffect, useMemo } from "react"
import { Download, Loader2, TrendingUp, AlertTriangle, Activity } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Checkbox } from "@/components/ui/checkbox"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ChartWrapper } from "@/components/performance-charts/chart-wrapper"
import { WalkForwardPeriodSelector } from "@/components/walk-forward/period-selector"
import { WalkForwardAnalysisChart } from "@/components/walk-forward/analysis-chart"
import { RobustnessMetrics } from "@/components/walk-forward/robustness-metrics"
import { RunSwitcher } from "@/components/walk-forward/run-switcher"
import { useBlockStore } from "@/lib/stores/block-store"
import { useWalkForwardStore } from "@/lib/stores/walk-forward-store"
import { WalkForwardOptimizationTarget } from "@/lib/models/walk-forward"
import { cn } from "@/lib/utils"
import type { Data } from "plotly.js"

const TARGET_LABELS: Record<WalkForwardOptimizationTarget, string> = {
  netPl: "Net Profit",
  profitFactor: "Profit Factor",
  sharpeRatio: "Sharpe Ratio",
  sortinoRatio: "Sortino Ratio",
  calmarRatio: "Calmar Ratio",
  cagr: "CAGR",
  avgDailyPl: "Avg Daily P/L",
  winRate: "Win Rate",
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export default function WalkForwardPage() {
  const activeBlock = useBlockStore((state) => {
    const activeId = state.activeBlockId
    return activeId ? state.blocks.find((block) => block.id === activeId) ?? null : null
  })
  const blockIsLoading = useBlockStore((state) => state.isLoading)
  const isInitialized = useBlockStore((state) => state.isInitialized)
  const loadBlocks = useBlockStore((state) => state.loadBlocks)

  const results = useWalkForwardStore((state) => state.results)
  const history = useWalkForwardStore((state) => state.history)
  const config = useWalkForwardStore((state) => state.config)
  const loadHistory = useWalkForwardStore((state) => state.loadHistory)
  const selectAnalysis = useWalkForwardStore((state) => state.selectAnalysis)
  const deleteAnalysis = useWalkForwardStore((state) => state.deleteAnalysis)
  const exportResultsAsCsv = useWalkForwardStore((state) => state.exportResultsAsCsv)
  const exportResultsAsJson = useWalkForwardStore((state) => state.exportResultsAsJson)

  const [showFailingOnly, setShowFailingOnly] = useState(false)
  const [minOosTrades, setMinOosTrades] = useState(0)
  const [periodRange, setPeriodRange] = useState<[number, number]>([1, 1])
  const [showCards, setShowCards] = useState(true)

  const activeBlockId = activeBlock?.id ?? null

  useEffect(() => {
    if (!isInitialized) {
      loadBlocks().catch(console.error)
    }
  }, [isInitialized, loadBlocks])

  useEffect(() => {
    if (activeBlockId) {
      loadHistory(activeBlockId).catch(console.error)
    }
  }, [activeBlockId, loadHistory])

  useEffect(() => {
    if (results?.results.periods?.length) {
      setPeriodRange([1, results.results.periods.length])
    }
  }, [results?.results.periods?.length])

  const targetMetricLabel =
    TARGET_LABELS[
      (results?.config.optimizationTarget ?? config.optimizationTarget) as WalkForwardOptimizationTarget
    ] ?? "Net Profit"

  const insights = useMemo(() => {
    if (!results) return []
    const { periods, summary, stats } = results.results
    if (!periods.length) return []

    const avgKelly =
      periods.reduce((sum, period) => sum + (period.optimalParameters.kellyMultiplier ?? 0), 0) /
      periods.length
    const bestPeriod = periods.reduce((best, period) => {
      return period.targetMetricOutOfSample > best.targetMetricOutOfSample ? period : best
    }, periods[0])

    const consistency = Math.round((stats.consistencyScore ?? 0) * 100)
    const efficiency = Math.round(summary.degradationFactor * 100)

    return [
      `Out-of-sample performance retained ${efficiency}% of ${targetMetricLabel} on average.`,
      `Kelly multiplier averaged ${avgKelly.toFixed(2)}x, suggesting a ${avgKelly > 1 ? "growth" : "capital preservation"} bias.`,
      `Best OOS window (${formatDate(bestPeriod.outOfSampleStart)} → ${formatDate(
        bestPeriod.outOfSampleEnd
      )}) delivered ${bestPeriod.targetMetricOutOfSample.toFixed(2)} ${targetMetricLabel}.`,
      `Consistency: ${consistency}% of windows stayed non-negative after rolling forward.`,
    ]
  }, [results, targetMetricLabel])

  const formatMetricValue = (value: number) => {
    if (!Number.isFinite(value)) return "—"
    const abs = Math.abs(value)
    const fractionDigits = abs >= 1000 ? 0 : abs >= 100 ? 1 : 2
    return value.toLocaleString(undefined, {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    })
  }

  const getEfficiencyStatus = (pct: number) => {
    if (pct >= 90) {
      return {
        label: "Robust retention",
        chipClass: "bg-emerald-50 text-emerald-700",
        icon: TrendingUp,
        iconClass: "text-emerald-600",
        action: "OOS almost mirrors IS. You can lean into this sizing with confidence.",
        lineColor: "#10b981",
      }
    }
    if (pct >= 70) {
      return {
        label: "Worth monitoring",
        chipClass: "bg-amber-50 text-amber-700",
        icon: Activity,
        iconClass: "text-amber-600",
        action: "Slight degradation — keep the parameters but monitor drawdowns closely.",
        lineColor: "#f59e0b",
      }
    }
    return {
      label: "Needs attention",
      chipClass: "bg-rose-50 text-rose-700",
      icon: AlertTriangle,
      iconClass: "text-rose-600",
      action: "OOS fell off a cliff. Re-run optimization or throttle position sizes here.",
      lineColor: "#f43f5e",
    }
  }

  const periodSummaries = useMemo(() => {
    if (!results) return []
    return results.results.periods.map((period, index) => {
      const degradation =
        period.targetMetricInSample !== 0
          ? period.targetMetricOutOfSample / period.targetMetricInSample
          : 0

      const efficiencyPct = Number.isFinite(degradation) ? degradation * 100 : 0
      const status = getEfficiencyStatus(efficiencyPct)

      const parameterSummary = Object.entries(period.optimalParameters).map(([key, value]) => {
        if (key.startsWith("strategy:")) {
          return `${key.replace("strategy:", "Strategy ")}: ${(value * 100).toFixed(0)}%`
        }
        if (key.toLowerCase().includes("pct")) {
          return `${key}: ${value.toFixed(2)}%`
        }
        return `${key}: ${value.toFixed(2)}`
      })
      const parameterPreview = parameterSummary.slice(0, 4)
      const parameterOverflow = Math.max(0, parameterSummary.length - parameterPreview.length)

      return {
        label: `Period ${index + 1}`,
        inSampleRange: `${formatDate(period.inSampleStart)} → ${formatDate(period.inSampleEnd)}`,
        outSampleRange: `${formatDate(period.outOfSampleStart)} → ${formatDate(period.outOfSampleEnd)}`,
        inSampleMetric: period.targetMetricInSample,
        outSampleMetric: period.targetMetricOutOfSample,
        efficiencyPct,
        status,
        oosDrawdown: period.outOfSampleMetrics.maxDrawdown,
        oosTrades: period.outOfSampleMetrics.totalTrades,
        parameterItems: parameterPreview,
        parameterOverflow,
      }
    })
  }, [results])

  const rangeFilteredSummaries = useMemo(() => {
    const [start, end] = periodRange
    return periodSummaries.filter((_, idx) => {
      const n = idx + 1
      return n >= start && n <= end
    })
  }, [periodSummaries, periodRange])

  const filteredPeriodSummaries = useMemo(() => {
    return rangeFilteredSummaries.filter((period) => {
      if (showFailingOnly && period.efficiencyPct >= 60) return false
      if (minOosTrades > 0 && (period.oosTrades ?? 0) < minOosTrades) return false
      return true
    })
  }, [rangeFilteredSummaries, showFailingOnly, minOosTrades])

  const miniBars = useMemo(() => {
    return filteredPeriodSummaries.map((period) => {
      const isVal = period.inSampleMetric
      const oosVal = period.outSampleMetric
      const maxVal = Math.max(Math.abs(isVal), Math.abs(oosVal), 1)
      const isWidth = Math.min(100, (Math.abs(isVal) / maxVal) * 100)
      const oosWidth = Math.min(100, (Math.abs(oosVal) / maxVal) * 100)
      return {
        label: period.label,
        isVal,
        oosVal,
        isWidth,
        oosWidth,
        status: period.status,
      }
    })
  }, [filteredPeriodSummaries])

  const slopegraph = useMemo(() => {
    if (!filteredPeriodSummaries.length) return null

    const traces: Data[] = filteredPeriodSummaries.map((period) => ({
      type: "scatter",
      mode: "lines+markers",
      name: period.label,
      x: [period.inSampleMetric, period.outSampleMetric],
      y: [period.label, period.label],
      marker: {
        size: 8,
        color: ["#2563eb", "#f97316"],
      },
      text: ["In-Sample", "Out-of-Sample"],
      line: { color: period.status.lineColor, width: 2 },
      hovertemplate:
        `<b>${period.label}</b><br>%{text}: %{x:.2f} ${targetMetricLabel}<extra></extra>`,
      showlegend: false,
    }))

    const height = Math.max(220, filteredPeriodSummaries.length * 50)

    return {
      data: traces,
      layout: {
        height,
        xaxis: {
          title: { text: targetMetricLabel },
          zeroline: false,
          gridcolor: "rgba(226,232,240,0.5)",
          automargin: true,
        },
        yaxis: {
          type: "category" as const,
          autorange: "reversed" as const,
          tickfont: { size: 12 },
          automargin: true,
        },
        margin: { t: 20, r: 20, b: 40, l: 90 },
        hovermode: "closest" as const,
        showlegend: false,
      },
    }
  }, [filteredPeriodSummaries, targetMetricLabel])

  const periodCount = results?.results.periods.length ?? 0
  const visiblePeriods =
    results?.results.periods?.slice(
      Math.max(0, periodRange[0] - 1),
      Math.min(results.results.periods.length, periodRange[1])
    ) ?? []

  const handleExport = (format: "csv" | "json") => {
    const payload = format === "csv" ? exportResultsAsCsv() : exportResultsAsJson()
    if (!payload) return

    const blob = new Blob([payload], {
      type: format === "csv" ? "text/csv;charset=utf-8;" : "application/json",
    })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = format === "csv" ? "walk-forward-summary.csv" : "walk-forward-summary.json"
    anchor.click()
    URL.revokeObjectURL(url)
  }

  if (!isInitialized || blockIsLoading) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        <div className="flex items-center gap-2 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading blocks...
        </div>
      </div>
    )
  }

  if (!activeBlock) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Select a Block</CardTitle>
          <CardDescription>
            Choose a block from the sidebar to configure walk-forward optimization.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Once a block is active you can orchestrate rolling in-sample/out-of-sample testing and
          visualize robustness.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <RunSwitcher
        history={history}
        currentId={results?.id ?? null}
        onSelect={selectAnalysis}
        onDelete={deleteAnalysis}
      />

      {/* How to Use This Page */}
      <Card className="p-6">
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">How to Use This Page</h2>
          <p className="text-sm text-muted-foreground">
            Walk-forward analysis validates your strategy&apos;s performance by repeatedly optimizing
            on historical data (in-sample) and testing on unseen future data (out-of-sample).
          </p>
          <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
            <li>
              Configure your in-sample and out-of-sample windows to match your trading timeframe
              and available data.
            </li>
            <li>
              Choose an optimization target (e.g., Sharpe Ratio, Net Profit) that aligns with
              your risk tolerance and goals.
            </li>
            <li>
              Define parameter ranges for position sizing and risk controls to sweep through
              different combinations.
            </li>
            <li>
              Run the analysis to see how optimal parameters change across different market
              regimes and whether performance degrades out-of-sample.
            </li>
            <li>
              Review the efficiency metrics and consistency scores to assess if your strategy
              is robust or overfit to specific market conditions.
            </li>
          </ul>
          <p className="text-xs text-muted-foreground italic">
            A robust strategy should maintain reasonable performance (60-80% efficiency) in
            out-of-sample periods. High degradation suggests overfitting to historical data.
          </p>
        </div>
      </Card>

      <WalkForwardPeriodSelector blockId={activeBlockId} />

      <RobustnessMetrics results={results?.results ?? null} targetMetricLabel={targetMetricLabel} />

      <WalkForwardAnalysisChart
        periods={visiblePeriods}
        targetMetricLabel={targetMetricLabel}
      />

      <Card className="overflow-hidden">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>Window Table</CardTitle>
              <CardDescription>
                Scan retention, drawdowns, and samples quickly. Use filters to surface weak slices.
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" disabled={!results} onClick={() => handleExport("csv")} size="sm">
                <Download className="mr-2 h-4 w-4" />
                CSV
              </Button>
              <Button variant="outline" disabled={!results} onClick={() => handleExport("json")} size="sm">
                <Download className="mr-2 h-4 w-4" />
                JSON
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4 pt-2 text-sm">
            <label className="flex items-center gap-2">
              <Checkbox
                checked={showFailingOnly}
                onCheckedChange={(v) => setShowFailingOnly(Boolean(v))}
              />
              <span className="text-muted-foreground">Only failing windows (&lt;60% retention)</span>
            </label>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-xs">Min OOS trades</span>
              <div className="w-32">
                <Slider
                  min={0}
                  max={Math.max(...periodSummaries.map((p) => p.oosTrades ?? 0), 20)}
                  step={1}
                  value={[minOosTrades]}
                  onValueChange={(v) => setMinOosTrades(v[0] ?? 0)}
                />
              </div>
              <Badge variant="secondary" className="text-xs">{minOosTrades}</Badge>
            </div>
            {periodCount > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-xs">Window range</span>
                <div className="w-44">
                  <Slider
                    min={1}
                    max={periodCount}
                    step={1}
                    value={[periodRange[0], periodRange[1]]}
                    onValueChange={(v) => {
                      if (!v || v.length < 2) return
                      const [a, b] = v as [number, number]
                      setPeriodRange([Math.min(a, b), Math.max(a, b)])
                    }}
                  />
                </div>
                <Badge variant="secondary" className="text-xs">
                  {periodRange[0]}–{periodRange[1]} / {periodCount}
                </Badge>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filteredPeriodSummaries.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              {periodSummaries.length === 0 ? "Run the analysis to populate this table." : "No windows match the current filters."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Window</TableHead>
                    <TableHead>IS Range</TableHead>
                    <TableHead>OOS Range</TableHead>
                    <TableHead className="text-right">OOS Retention</TableHead>
                    <TableHead className="text-right">Delta</TableHead>
                    <TableHead className="text-right">OOS Trades</TableHead>
                    <TableHead className="text-right">Max DD</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPeriodSummaries.map((period) => {
                    const delta = period.outSampleMetric - period.inSampleMetric
                    const deltaClass = delta >= 0 ? "text-emerald-600" : "text-rose-600"
                    const StatusIcon = period.status.icon

                    return (
                      <TableRow key={period.label}>
                        <TableCell className="font-medium">{period.label}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{period.inSampleRange}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{period.outSampleRange}</TableCell>
                        <TableCell className="text-right font-semibold">
                          {period.efficiencyPct.toFixed(1)}%
                        </TableCell>
                        <TableCell className={cn("text-right", deltaClass)}>
                          {delta >= 0 ? "+" : ""}
                          {formatMetricValue(delta)}
                        </TableCell>
                        <TableCell className="text-right">{period.oosTrades ?? "—"}</TableCell>
                        <TableCell className="text-right">
                          {period.oosDrawdown != null ? `${Math.abs(period.oosDrawdown).toFixed(2)}%` : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs", period.status.chipClass)}>
                            <StatusIcon className="h-3 w-3" />
                            {period.status.label}
                          </span>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Retention Visuals</CardTitle>
              <CardDescription>See how each window hands off from IS to OOS.</CardDescription>
            </div>
            <Collapsible>
              <CollapsibleTrigger className="text-xs text-primary hover:underline">How to read</CollapsibleTrigger>
              <CollapsibleContent className="mt-2 rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
                <ul className="space-y-1">
                  <li className="flex items-start gap-2">
                    <span className="mt-1 h-2 w-2 rounded-full bg-blue-500" />
                    Blue spans show the in-sample window; orange spans show out-of-sample.
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1 h-2 w-2 rounded-full bg-orange-500" />
                    OOS retention ≥ 80% is robust; 60–80% monitor; &lt;60% needs a re-run or sizing tweak.
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1 h-2 w-2 rounded-full bg-primary" />
                    Status chips suggest next action per window.
                  </li>
                </ul>
              </CollapsibleContent>
            </Collapsible>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {slopegraph ? (
            <ChartWrapper
              title="IS vs OOS retention"
              description={`Each slope shows how ${targetMetricLabel} travelled from the training window to the test window.`}
              data={slopegraph.data}
              layout={slopegraph.layout}
              style={{ height: (slopegraph.layout.height as number | undefined) ?? 280 }}
            />
          ) : (
            <div className="py-10 text-center text-sm text-muted-foreground">
              Run the analysis to populate these visuals.
            </div>
          )}

          {miniBars.length > 0 && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Switch
                  id="show-cards"
                  checked={showCards}
                  onCheckedChange={(v) => setShowCards(Boolean(v))}
                />
                <label htmlFor="show-cards" className="cursor-pointer">
                  Show mini-cards
                </label>
              </div>
            </div>
          )}

          {miniBars.length > 0 && showCards && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {miniBars.map((bar) => (
                <div key={bar.label} className="rounded-lg border bg-card/60 p-3 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{bar.label}</span>
                    <span className={cn("rounded-full px-2 py-0.5 text-[11px]", bar.status.chipClass)}>
                      {bar.status.label}
                    </span>
                  </div>
                  <div className="space-y-1 text-[11px] text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-blue-500" />
                      <span>IS {formatMetricValue(bar.isVal)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-orange-500" />
                      <span>OOS {formatMetricValue(bar.oosVal)}</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="h-2 rounded-full bg-blue-500/15">
                      <div className="h-2 rounded-full bg-blue-500" style={{ width: `${bar.isWidth}%` }} />
                    </div>
                    <div className="h-2 rounded-full bg-orange-500/15">
                      <div className="h-2 rounded-full bg-orange-500" style={{ width: `${bar.oosWidth}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <TrendingUp className="h-4 w-4 text-primary" />
            Actionable Insights
          </div>
          <CardTitle>What to do next</CardTitle>
          <CardDescription>
            Translate diagnostics into sizing tweaks or additional risk controls.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {results && insights.length > 0 ? (
            <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
              {insights.map((insight, index) => (
                <li key={index}>{insight}</li>
              ))}
            </ul>
          ) : (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <AlertTriangle className="h-4 w-4" />
              Run at least one analysis to surface suggestions.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
