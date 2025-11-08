"use client"

import {
  IconPlayerPlay,
  IconAdjustmentsHorizontal,
  IconHeartRateMonitor,
} from "@tabler/icons-react"
import { Loader2, Square } from "lucide-react"
import { useMemo } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { WalkForwardOptimizationTarget } from "@/lib/models/walk-forward"
import { WALK_FORWARD_PRESETS, useWalkForwardStore } from "@/lib/stores/walk-forward-store"

interface PeriodSelectorProps {
  blockId?: string | null
  blockName?: string
}

const TARGET_OPTIONS: Array<{ value: WalkForwardOptimizationTarget; label: string }> = [
  { value: "netPl", label: "Net Profit" },
  { value: "profitFactor", label: "Profit Factor" },
  { value: "sharpeRatio", label: "Sharpe Ratio" },
  { value: "sortinoRatio", label: "Sortino Ratio" },
  { value: "calmarRatio", label: "Calmar Ratio" },
  { value: "cagr", label: "CAGR" },
  { value: "avgDailyPl", label: "Avg Daily P/L" },
  { value: "winRate", label: "Win Rate" },
]

const PARAMETER_METADATA: Record<
  string,
  { label: string; helper: string; min: number; max: number; step: number; precision?: number }
> = {
  kellyMultiplier: {
    label: "Kelly Multiplier (x)",
    helper: "Scale Kelly sizing to sweep risk appetite.",
    min: 0.1,
    max: 3,
    step: 0.05,
  },
  fixedFractionPct: {
    label: "Fixed Fraction %",
    helper: "Percent of capital risked per trade.",
    min: 1,
    max: 20,
    step: 0.5,
  },
  maxDrawdownPct: {
    label: "Max Drawdown %",
    helper: "Reject combos that breach this drawdown.",
    min: 2,
    max: 50,
    step: 1,
  },
  maxDailyLossPct: {
    label: "Max Daily Loss %",
    helper: "Cut risk-off when day losses exceed cap.",
    min: 1,
    max: 25,
    step: 1,
  },
  consecutiveLossLimit: {
    label: "Consecutive Loss Limit",
    helper: "Stops trading after N losing trades.",
    min: 1,
    max: 10,
    step: 1,
    precision: 0,
  },
}

export function WalkForwardPeriodSelector({ blockId, blockName }: PeriodSelectorProps) {
  const config = useWalkForwardStore((state) => state.config)
  const presets = useWalkForwardStore((state) => state.presets)
  const updateConfig = useWalkForwardStore((state) => state.updateConfig)
  const setParameterRange = useWalkForwardStore((state) => state.setParameterRange)
  const applyPreset = useWalkForwardStore((state) => state.applyPreset)
  const runAnalysis = useWalkForwardStore((state) => state.runAnalysis)
  const cancelAnalysis = useWalkForwardStore((state) => state.cancelAnalysis)
  const isRunning = useWalkForwardStore((state) => state.isRunning)
  const progress = useWalkForwardStore((state) => state.progress)
  const error = useWalkForwardStore((state) => state.error)

  const disableRun = !blockId || isRunning

  const handleRun = async () => {
    if (!blockId) return
    await runAnalysis(blockId)
  }

  const presetButtons = useMemo(
    () =>
      Object.entries(presets ?? WALK_FORWARD_PRESETS).map(([key, preset]) => (
        <Button
          key={key}
          variant="outline"
          size="sm"
          onClick={() => applyPreset(key as keyof typeof WALK_FORWARD_PRESETS)}
        >
          {preset.label}
        </Button>
      )),
    [presets, applyPreset]
  )

  const renderParameterControls = () => {
    return Object.entries(config.parameterRanges).map(([key, range]) => {
      const metadata = PARAMETER_METADATA[key]
      if (!metadata) return null

      const [minValue, maxValue, stepValue] = range

      const sliderMin = Math.min(metadata.min, minValue)
      const sliderMax = Math.max(metadata.max, maxValue)
      const precision = metadata.precision ?? 2

      return (
        <div key={key} className="space-y-2 rounded-lg border border-border/40 p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">{metadata.label}</p>
              <p className="text-xs text-muted-foreground">{metadata.helper}</p>
            </div>
            <Badge variant="secondary">
              {minValue.toFixed(precision)} - {maxValue.toFixed(precision)}
            </Badge>
          </div>
          <Slider
            min={sliderMin}
            max={sliderMax}
            step={stepValue}
            value={[minValue, maxValue]}
            onValueChange={(values) => {
              if (!values || values.length < 2) return
              const nextMin = Number(values[0].toFixed(precision))
              const nextMax = Number(values[1].toFixed(precision))
              setParameterRange(key, [nextMin, nextMax, stepValue])
            }}
          />
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Min</Label>
              <Input
                type="number"
                value={minValue}
                step={stepValue}
                onChange={(event) =>
                  setParameterRange(key, [
                    Number(event.target.value),
                    maxValue,
                    stepValue,
                  ])
                }
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Max</Label>
              <Input
                type="number"
                value={maxValue}
                step={stepValue}
                onChange={(event) =>
                  setParameterRange(key, [
                    minValue,
                    Number(event.target.value),
                    stepValue,
                  ])
                }
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Step</Label>
              <Input
                type="number"
                value={stepValue}
                step={metadata.step}
                min={metadata.step}
                onChange={(event) =>
                  setParameterRange(key, [
                    minValue,
                    maxValue,
                    Math.max(Number(event.target.value), metadata.step),
                  ])
                }
              />
            </div>
          </div>
        </div>
      )
    })
  }

  const progressPercent =
    progress && progress.totalCombinations
      ? Math.min(
          100,
          Math.round(
            ((progress.testedCombinations ?? 0) / progress.totalCombinations) * 100
          )
        )
      : 0

  return (
    <Card>
      <CardHeader className="space-y-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <IconHeartRateMonitor className="h-4 w-4 text-primary" />
          {blockName ? `Target Block: ${blockName}` : "No block selected"}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <IconAdjustmentsHorizontal className="h-5 w-5 text-primary" />
          <CardTitle>Walk-Forward Configuration</CardTitle>
        </div>
        <CardDescription>
          Define in-sample / out-of-sample cadence, optimization target, and risk sweeps. Use
          presets for quick-start configurations.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && (
          <Alert variant="destructive">
            <AlertTitle>Analysis error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-1">
            <Label>In-Sample Days</Label>
            <Input
              type="number"
              min={10}
              value={config.inSampleDays}
              onChange={(event) => updateConfig({ inSampleDays: Number(event.target.value) })}
            />
          </div>
          <div className="space-y-1">
            <Label>Out-of-Sample Days</Label>
            <Input
              type="number"
              min={5}
              value={config.outOfSampleDays}
              onChange={(event) => updateConfig({ outOfSampleDays: Number(event.target.value) })}
            />
          </div>
          <div className="space-y-1">
            <Label>Step Size (Days)</Label>
            <Input
              type="number"
              min={1}
              value={config.stepSizeDays}
              onChange={(event) => updateConfig({ stepSizeDays: Number(event.target.value) })}
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <Label>Optimization Target</Label>
            <Select
              value={config.optimizationTarget}
              onValueChange={(value) =>
                updateConfig({ optimizationTarget: value as WalkForwardOptimizationTarget })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select metric" />
              </SelectTrigger>
              <SelectContent>
                {TARGET_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Min IS Trades</Label>
              <Input
                type="number"
                min={5}
                value={config.minInSampleTrades ?? 0}
                onChange={(event) =>
                  updateConfig({ minInSampleTrades: Number(event.target.value) })
                }
              />
            </div>
            <div className="space-y-1">
              <Label>Min OOS Trades</Label>
              <Input
                type="number"
                min={1}
                value={config.minOutOfSampleTrades ?? 0}
                onChange={(event) =>
                  updateConfig({ minOutOfSampleTrades: Number(event.target.value) })
                }
              />
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Parameter Sweeps</p>
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">{presetButtons}</div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">{renderParameterControls()}</div>
        </div>

        <div className="space-y-3 rounded-lg border border-dashed border-primary/40 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-primary">Analysis Controls</p>
              <p className="text-xs text-muted-foreground">
                {progress ? progress.phase : "Awaiting run"}
              </p>
            </div>
            <div className="flex gap-2">
              {isRunning ? (
                <Button variant="outline" onClick={cancelAnalysis} size="sm">
                  <Square className="mr-2 h-3.5 w-3.5" />
                  Cancel
                </Button>
              ) : null}
              <Button onClick={handleRun} disabled={disableRun} size="sm">
                {isRunning ? (
                  <>
                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                    Running...
                  </>
                ) : (
                  <>
                    <IconPlayerPlay className="mr-2 h-3.5 w-3.5" />
                    Run Analysis
                  </>
                )}
              </Button>
            </div>
          </div>
          {progress && progress.totalCombinations ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  Window {progress.currentPeriod}/{progress.totalPeriods}
                </span>
                <span>
                  {progress.testedCombinations}/{progress.totalCombinations} combos tested
                </span>
              </div>
              <Progress value={progressPercent} />
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Progress updates will appear here once the engine starts crunching windows.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
