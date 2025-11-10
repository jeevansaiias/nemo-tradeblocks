"use client"

import { useEffect, useMemo } from "react"
import { Download, History, Loader2, TrendingUp, AlertTriangle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { WalkForwardPeriodSelector } from "@/components/walk-forward/period-selector"
import { WalkForwardAnalysisChart } from "@/components/walk-forward/analysis-chart"
import { RobustnessMetrics } from "@/components/walk-forward/robustness-metrics"
import { useBlockStore } from "@/lib/stores/block-store"
import { useWalkForwardStore } from "@/lib/stores/walk-forward-store"
import { WalkForwardOptimizationTarget } from "@/lib/models/walk-forward"
import { cn } from "@/lib/utils"

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

  const periodRows = useMemo(() => {
    if (!results) return []
    return results.results.periods.map((period, index) => {
      const degradation =
        period.targetMetricInSample !== 0
          ? period.targetMetricOutOfSample / period.targetMetricInSample
          : 0

      const parameterSummary = Object.entries(period.optimalParameters)
        .map(([key, value]) => {
          if (key.startsWith("strategy:")) {
            return `${key.replace("strategy:", "Strategy ")}: ${(value * 100).toFixed(0)}%`
          }
          if (key.toLowerCase().includes("pct")) {
            return `${key}: ${value.toFixed(2)}%`
          }
          return `${key}: ${value.toFixed(2)}`
        })
        .join(", ")

      return {
        label: `Period ${index + 1}`,
        inSampleRange: `${formatDate(period.inSampleStart)} → ${formatDate(period.inSampleEnd)}`,
        outSampleRange: `${formatDate(period.outOfSampleStart)} → ${formatDate(period.outOfSampleEnd)}`,
        inSampleMetric: period.targetMetricInSample,
        outSampleMetric: period.targetMetricOutOfSample,
        degradation,
        oosDrawdown: period.outOfSampleMetrics.maxDrawdown,
        parameters: parameterSummary,
      }
    })
  }, [results])

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
          <CardContent className="overflow-x-auto">
            {results && results.results.periods.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Period</TableHead>
                    <TableHead>IS Window</TableHead>
                    <TableHead>OOS Window</TableHead>
                    <TableHead>{`IS ${targetMetricLabel}`}</TableHead>
                    <TableHead>{`OOS ${targetMetricLabel}`}</TableHead>
                    <TableHead>Efficiency</TableHead>
                    <TableHead>OOS Max DD</TableHead>
                    <TableHead>Parameters</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {periodRows.map((row) => (
                    <TableRow key={row.label}>
                      <TableCell className="font-medium">{row.label}</TableCell>
                      <TableCell>{row.inSampleRange}</TableCell>
                      <TableCell>{row.outSampleRange}</TableCell>
                      <TableCell>{row.inSampleMetric.toFixed(2)}</TableCell>
                      <TableCell>{row.outSampleMetric.toFixed(2)}</TableCell>
                      <TableCell className={row.degradation >= 0.8 ? "text-green-600" : ""}>
                        {(row.degradation * 100).toFixed(1)}%
                      </TableCell>
                      <TableCell>{row.oosDrawdown?.toFixed(2) ?? "—"}%</TableCell>
                      <TableCell className="max-w-[220px] text-xs text-muted-foreground">
                        {row.parameters || "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="py-10 text-center text-sm text-muted-foreground">
                Run the analysis to populate this table.
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
