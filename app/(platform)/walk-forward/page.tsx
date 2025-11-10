"use client"

import { useEffect, useMemo } from "react"
import { Download, History, Loader2, TrendingUp, AlertTriangle, Activity } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { ChartWrapper } from "@/components/performance-charts/chart-wrapper"
import { WalkForwardPeriodSelector } from "@/components/walk-forward/period-selector"
import { WalkForwardAnalysisChart } from "@/components/walk-forward/analysis-chart"
import { RobustnessMetrics } from "@/components/walk-forward/robustness-metrics"
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
  const exportResultsAsCsv = useWalkForwardStore((state) => state.exportResultsAsCsv)
  const exportResultsAsJson = useWalkForwardStore((state) => state.exportResultsAsJson)

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

  const slopegraph = useMemo(() => {
    if (!periodSummaries.length) return null

    const traces: Data[] = periodSummaries.map((period) => ({
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

    const height = Math.max(220, periodSummaries.length * 60)

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
  }, [periodSummaries, targetMetricLabel])

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
        periods={results?.results.periods ?? []}
        targetMetricLabel={targetMetricLabel}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2 overflow-hidden">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Window Comparison</CardTitle>
                <CardDescription>Evaluate each walk-forward step at a glance.</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  disabled={!results}
                  onClick={() => handleExport("csv")}
                  size="sm"
                >
                  <Download className="mr-2 h-4 w-4" />
                  CSV
                </Button>
                <Button
                  variant="outline"
                  disabled={!results}
                  onClick={() => handleExport("json")}
                  size="sm"
                >
                  <Download className="mr-2 h-4 w-4" />
                  JSON
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {periodSummaries.length > 0 ? (
              <>
                <div className="rounded-lg border border-dashed border-muted-foreground/30 bg-muted/10 p-4 text-sm text-muted-foreground">
                  <p className="text-foreground text-sm font-medium">How to read these windows</p>
                  <ul className="mt-3 space-y-2 text-xs">
                    <li className="flex items-start gap-2">
                      <span className="mt-1 h-2 w-2 rounded-full bg-blue-500" />
                      In-sample ranges (blue) show what the optimizer saw. Orange ranges show how that setup behaved on unseen data.
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-1 h-2 w-2 rounded-full bg-orange-500" />
                      OOS retention ≥ 80% generally signals a robust hand-off. Anything below ~60% deserves a parameter tweak.
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-1 h-2 w-2 rounded-full bg-primary" />
                      Action chips highlight what to do next (scale up, monitor, or re-optimize).
                    </li>
                  </ul>
                </div>

                {slopegraph && (
                  <ChartWrapper
                    title="IS vs OOS retention"
                    description={`Each slope shows how ${targetMetricLabel} travelled from the training window to the test window.`}
                    data={slopegraph.data}
                    layout={slopegraph.layout}
                    style={{ height: (slopegraph.layout.height as number | undefined) ?? 280 }}
                  />
                )}

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {periodSummaries.map((period) => {
                    const delta = period.outSampleMetric - period.inSampleMetric
                    const deltaClass = delta >= 0 ? "text-emerald-600" : "text-rose-600"
                    const StatusIcon = period.status.icon
                    const progressValue = Math.max(0, Math.min(100, period.efficiencyPct))

                    return (
                      <div
                        key={period.label}
                        className="rounded-2xl border bg-card/40 p-4 shadow-sm"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs uppercase tracking-wide text-muted-foreground">
                              Window
                            </p>
                            <p className="text-lg font-semibold">{period.label}</p>
                          </div>
                          <span className={cn("rounded-full px-3 py-1 text-xs font-medium", period.status.chipClass)}>
                            {period.status.label}
                          </span>
                        </div>

                        <div className="mt-4 space-y-2 text-xs text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-blue-500" />
                            <span>{period.inSampleRange}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-orange-500" />
                            <span>{period.outSampleRange}</span>
                          </div>
                        </div>

                        <div className="mt-4 space-y-2">
                          <div className="flex items-center justify-between text-sm font-medium">
                            <span>{`IS ${targetMetricLabel}`}</span>
                            <span>{formatMetricValue(period.inSampleMetric)}</span>
                          </div>
                          <div className="flex items-center justify-between text-sm font-medium">
                            <span>{`OOS ${targetMetricLabel}`}</span>
                            <span>{formatMetricValue(period.outSampleMetric)}</span>
                          </div>
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>Delta</span>
                            <span className={deltaClass}>
                              {delta >= 0 ? "+" : ""}
                              {formatMetricValue(delta)} {targetMetricLabel}
                            </span>
                          </div>
                          <Progress value={progressValue} />
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>OOS retained</span>
                            <span className="font-semibold text-foreground">
                              {period.efficiencyPct.toFixed(1)}%
                            </span>
                          </div>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground">
                          <div>
                            <p className="text-base font-semibold text-foreground">
                              {period.oosTrades ?? "—"}
                            </p>
                            <p className="text-[11px] uppercase tracking-wide">OOS trades</p>
                          </div>
                          <div>
                            <p className="text-base font-semibold text-foreground">
                              {period.oosDrawdown != null
                                ? `${Math.abs(period.oosDrawdown).toFixed(2)}%`
                                : "—"}
                            </p>
                            <p className="text-[11px] uppercase tracking-wide">Max drawdown</p>
                          </div>
                        </div>

                        <div className="mt-4 space-y-2">
                          <p className="text-xs font-semibold text-muted-foreground">
                            Parameters that won this window
                          </p>
                          {period.parameterItems.length ? (
                            <div className="flex flex-wrap gap-2">
                              {period.parameterItems.map((item) => (
                                <span
                                  key={`${period.label}-${item}`}
                                  className="rounded-full bg-muted px-2 py-1 text-xs"
                                >
                                  {item}
                                </span>
                              ))}
                              {period.parameterOverflow > 0 && (
                                <span className="rounded-full border px-2 py-1 text-xs text-muted-foreground">
                                  +{period.parameterOverflow} more
                                </span>
                              )}
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground">
                              No parameter adjustments captured for this slice.
                            </p>
                          )}
                        </div>

                        <div className="mt-4 flex items-start gap-2 rounded-lg bg-muted/40 p-3 text-sm">
                          <StatusIcon className={cn("h-4 w-4 flex-shrink-0", period.status.iconClass)} />
                          <p className="text-muted-foreground">{period.status.action}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            ) : (
              <div className="py-10 text-center text-sm text-muted-foreground">
                Run the analysis to populate this comparison.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-primary" />
              <CardTitle>Run History</CardTitle>
            </div>
            <CardDescription>Switch between prior walk-forward snapshots.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground">No saved runs yet.</p>
            ) : (
              history.map((analysis) => {
                const isActive = analysis.id === results?.id
                return (
                  <button
                    key={analysis.id}
                    onClick={() => selectAnalysis(analysis.id)}
                    className={cn(
                      "w-full rounded-md border px-3 py-2 text-left text-sm transition hover:border-primary",
                      isActive
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border/60 text-foreground"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">
                        {formatDate(new Date(analysis.createdAt))}
                      </span>
                      <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                        {TARGET_LABELS[analysis.config.optimizationTarget]}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {analysis.results.periods.length} windows ·{" "}
                      {(analysis.results.summary.degradationFactor * 100).toFixed(1)}% efficiency
                    </p>
                  </button>
                )
              })
            )}
          </CardContent>
        </Card>
      </div>

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
