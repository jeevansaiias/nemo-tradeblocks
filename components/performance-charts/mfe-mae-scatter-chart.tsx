"use client"

import React, { useEffect, useMemo, useState } from "react"
import { ChartWrapper } from "./chart-wrapper"
import { usePerformanceStore } from "@/lib/stores/performance-store"
import type { Layout, PlotData } from "plotly.js"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select"
import {
  NORMALIZATION_BASES,
  type MFEMAEDataPoint,
  type NormalizationBasis
} from "@/lib/calculations/mfe-mae"
import type { EfficiencyBasis } from "@/lib/metrics/trade-efficiency"

type AxisValueFormat =
  | { type: "currency"; maximumFractionDigits?: number }
  | { type: "percent"; maximumFractionDigits?: number }
  | { type: "number"; maximumFractionDigits?: number }

interface AxisOption {
  value: string
  label: string
  axisLabel: string
  format: AxisValueFormat
  accessor: (point: MFEMAEDataPoint) => number | null
}

const normalizationBasisLabels: Record<NormalizationBasis, string> = {
  premium: "Collected Premium",
  margin: "Margin Requirement"
}

const efficiencyBasisLabels: Record<EfficiencyBasis, string> = {
  premium: "Collected Premium",
  maxProfit: "Maximum Profit",
  margin: "Margin Requirement",
  unknown: "Unknown Basis"
}

function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value)
}

function formatAxisValue(value: number, format: AxisValueFormat): string {
  if (!Number.isFinite(value)) {
    return "N/A"
  }

  switch (format.type) {
    case "currency": {
      const formatter = new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: format.maximumFractionDigits ?? 0
      })
      return formatter.format(value)
    }
    case "percent": {
      const digits = format.maximumFractionDigits ?? 1
      return `${value.toFixed(digits)}%`
    }
    case "number":
    default: {
      const formatter = new Intl.NumberFormat(undefined, {
        maximumFractionDigits: format.maximumFractionDigits ?? 2
      })
      return formatter.format(value)
    }
  }
}

const rawCurrencyFormat: AxisValueFormat = { type: "currency", maximumFractionDigits: 0 }
const preciseCurrencyFormat: AxisValueFormat = { type: "currency", maximumFractionDigits: 2 }
const percentFormat: AxisValueFormat = { type: "percent", maximumFractionDigits: 1 }
const ratioFormat: AxisValueFormat = { type: "number", maximumFractionDigits: 2 }
const integerFormat: AxisValueFormat = { type: "number", maximumFractionDigits: 0 }
const decimalFormat: AxisValueFormat = { type: "number", maximumFractionDigits: 2 }

const preferredXAxisOrder = [
  "mae_percent_premium",
  "mae_percent_margin",
  "mae"
]

const preferredYAxisOrder = [
  "mfe_percent_premium",
  "mfe_percent_margin",
  "mfe"
]

export function MFEMAEScatterChart({ className }: { className?: string }) {
  const { data } = usePerformanceStore()
  const [xMetric, setXMetric] = useState<string | null>(null)
  const [yMetric, setYMetric] = useState<string | null>(null)

  const axisOptions = useMemo<AxisOption[]>(() => {
    if (!data?.mfeMaeData || data.mfeMaeData.length === 0) {
      return []
    }

    const options: AxisOption[] = []
    const addOption = (option: AxisOption) => {
      const hasValue = data.mfeMaeData?.some(point => {
        const value = option.accessor(point)
        return isFiniteNumber(value)
      })

      if (hasValue) {
        options.push(option)
      }
    }

    const makeNormalizedAccessor = (
      basis: NormalizationBasis,
      key: "maePercent" | "mfePercent" | "plPercent"
    ) => (point: MFEMAEDataPoint) => {
      const metrics = point.normalizedBy?.[basis]
      if (!metrics) return null
      return metrics[key]
    }

    NORMALIZATION_BASES.forEach(basis => {
      const label = normalizationBasisLabels[basis]
      addOption({
        value: `mae_percent_${basis}`,
        label: `MAE (% of ${label})`,
        axisLabel: `Maximum Adverse Excursion (% of ${label})`,
        format: percentFormat,
        accessor: makeNormalizedAccessor(basis, "maePercent")
      })
      addOption({
        value: `mfe_percent_${basis}`,
        label: `MFE (% of ${label})`,
        axisLabel: `Maximum Favorable Excursion (% of ${label})`,
        format: percentFormat,
        accessor: makeNormalizedAccessor(basis, "mfePercent")
      })
      addOption({
        value: `pl_percent_${basis}`,
        label: `P&L (% of ${label})`,
        axisLabel: `P&L (% of ${label})`,
        format: percentFormat,
        accessor: makeNormalizedAccessor(basis, "plPercent")
      })
    })

    addOption({
      value: "mae",
      label: "MAE ($)",
      axisLabel: "Maximum Adverse Excursion ($)",
      format: rawCurrencyFormat,
      accessor: point => point.mae ?? null
    })

    addOption({
      value: "mfe",
      label: "MFE ($)",
      axisLabel: "Maximum Favorable Excursion ($)",
      format: rawCurrencyFormat,
      accessor: point => point.mfe ?? null
    })

    addOption({
      value: "pl",
      label: "P&L ($)",
      axisLabel: "P&L ($)",
      format: rawCurrencyFormat,
      accessor: point => point.pl ?? null
    })

    addOption({
      value: "profit_capture",
      label: "Profit Capture (%)",
      axisLabel: "Profit Capture (%)",
      format: percentFormat,
      accessor: point => point.profitCapturePercent ?? null
    })

    addOption({
      value: "excursion_ratio",
      label: "Excursion Ratio (MFE/MAE)",
      axisLabel: "Excursion Ratio (MFE/MAE)",
      format: ratioFormat,
      accessor: point => point.excursionRatio ?? null
    })

    addOption({
      value: "premium",
      label: "Collected Premium ($)",
      axisLabel: "Collected Premium ($)",
      format: rawCurrencyFormat,
      accessor: point => point.premium ?? null
    })

    addOption({
      value: "margin",
      label: "Margin Requirement ($)",
      axisLabel: "Margin Requirement ($)",
      format: rawCurrencyFormat,
      accessor: point => point.marginReq ?? null
    })

    addOption({
      value: "denominator",
      label: "Normalization Denominator ($)",
      axisLabel: "Normalization Denominator ($)",
      format: rawCurrencyFormat,
      accessor: point => point.denominator ?? null
    })

    addOption({
      value: "opening_price",
      label: "Opening Price ($)",
      axisLabel: "Opening Price ($)",
      format: preciseCurrencyFormat,
      accessor: point => point.openingPrice ?? null
    })

    addOption({
      value: "closing_price",
      label: "Closing Price ($)",
      axisLabel: "Closing Price ($)",
      format: preciseCurrencyFormat,
      accessor: point => point.closingPrice ?? null
    })

    addOption({
      value: "avg_closing_cost",
      label: "Average Closing Cost ($)",
      axisLabel: "Average Closing Cost ($)",
      format: preciseCurrencyFormat,
      accessor: point => point.avgClosingCost ?? null
    })

    addOption({
      value: "funds_at_close",
      label: "Funds at Close ($)",
      axisLabel: "Funds at Close ($)",
      format: rawCurrencyFormat,
      accessor: point => point.fundsAtClose ?? null
    })

    addOption({
      value: "opening_commissions",
      label: "Opening Commissions & Fees ($)",
      axisLabel: "Opening Commissions & Fees ($)",
      format: preciseCurrencyFormat,
      accessor: point => point.openingCommissionsFees ?? null
    })

    addOption({
      value: "closing_commissions",
      label: "Closing Commissions & Fees ($)",
      axisLabel: "Closing Commissions & Fees ($)",
      format: preciseCurrencyFormat,
      accessor: point => point.closingCommissionsFees ?? null
    })

    addOption({
      value: "num_contracts",
      label: "Number of Contracts",
      axisLabel: "Number of Contracts",
      format: integerFormat,
      accessor: point => point.numContracts ?? null
    })

    addOption({
      value: "opening_short_long",
      label: "Opening Short/Long Ratio",
      axisLabel: "Opening Short/Long Ratio",
      format: ratioFormat,
      accessor: point => point.openingShortLongRatio ?? null
    })

    addOption({
      value: "closing_short_long",
      label: "Closing Short/Long Ratio",
      axisLabel: "Closing Short/Long Ratio",
      format: ratioFormat,
      accessor: point => point.closingShortLongRatio ?? null
    })

    addOption({
      value: "opening_vix",
      label: "Opening VIX",
      axisLabel: "Opening VIX",
      format: decimalFormat,
      accessor: point => point.openingVix ?? null
    })

    addOption({
      value: "closing_vix",
      label: "Closing VIX",
      axisLabel: "Closing VIX",
      format: decimalFormat,
      accessor: point => point.closingVix ?? null
    })

    addOption({
      value: "gap",
      label: "Gap ($)",
      axisLabel: "Gap ($)",
      format: rawCurrencyFormat,
      accessor: point => point.gap ?? null
    })

    addOption({
      value: "movement",
      label: "Underlying Movement ($)",
      axisLabel: "Underlying Movement ($)",
      format: rawCurrencyFormat,
      accessor: point => point.movement ?? null
    })

    addOption({
      value: "max_profit",
      label: "Modeled Max Profit ($)",
      axisLabel: "Modeled Max Profit ($)",
      format: rawCurrencyFormat,
      accessor: point => point.maxProfit ?? null
    })

    addOption({
      value: "max_loss",
      label: "Modeled Max Loss ($)",
      axisLabel: "Modeled Max Loss ($)",
      format: rawCurrencyFormat,
      accessor: point => point.maxLoss ?? null
    })

    return options
  }, [data])

  useEffect(() => {
    if (axisOptions.length === 0) {
      if (xMetric !== null) setXMetric(null)
      if (yMetric !== null) setYMetric(null)
      return
    }

    const availableValues = axisOptions.map(option => option.value)
    const findFirstAvailable = (preferred: string[], exclude?: string) => {
      for (const value of preferred) {
        if (value === exclude) continue
        if (availableValues.includes(value)) {
          return value
        }
      }
      const fallback = axisOptions.find(option => option.value !== exclude)
      return fallback?.value ?? null
    }

    const desiredX = xMetric && availableValues.includes(xMetric)
      ? xMetric
      : findFirstAvailable(preferredXAxisOrder)

    if (desiredX !== xMetric) {
      setXMetric(desiredX)
    }

    const desiredY = yMetric && availableValues.includes(yMetric) && yMetric !== desiredX
      ? yMetric
      : findFirstAvailable(preferredYAxisOrder, desiredX ?? undefined)

    if (desiredY !== yMetric) {
      setYMetric(desiredY)
    }
  }, [axisOptions, xMetric, yMetric])

  const axisOptionMap = useMemo(() => {
    return new Map(axisOptions.map(option => [option.value, option]))
  }, [axisOptions])

  const selectedX = xMetric ? axisOptionMap.get(xMetric) ?? null : null
  const selectedY = yMetric ? axisOptionMap.get(yMetric) ?? null : null

  const { plotData, layout } = useMemo(() => {
    if (!data?.mfeMaeData || data.mfeMaeData.length === 0 || !selectedX || !selectedY) {
      return { plotData: [], layout: {} }
    }

    const points = data.mfeMaeData
      .map(point => {
        const xValue = selectedX.accessor(point)
        const yValue = selectedY.accessor(point)

        if (!isFiniteNumber(xValue) || !isFiniteNumber(yValue)) {
          return null
        }

        return { point, xValue, yValue }
      })
      .filter((entry): entry is { point: MFEMAEDataPoint; xValue: number; yValue: number } => entry !== null)

    if (points.length === 0) {
      return { plotData: [], layout: {} }
    }

    const winners = points.filter(entry => entry.point.isWinner)
    const losers = points.filter(entry => !entry.point.isWinner)

    const toCustomData = (entry: { point: MFEMAEDataPoint; xValue: number; yValue: number }) => {
      const { point, xValue, yValue } = entry
      const premiumMetrics = point.normalizedBy?.premium
      const marginMetrics = point.normalizedBy?.margin

      return {
        trade: point.tradeNumber,
        strategy: point.strategy,
        date: point.date.toLocaleDateString(),
        xLabel: selectedX.axisLabel,
        yLabel: selectedY.axisLabel,
        xFormatted: formatAxisValue(xValue, selectedX.format),
        yFormatted: formatAxisValue(yValue, selectedY.format),
        maeRaw: formatAxisValue(point.mae ?? 0, rawCurrencyFormat),
        mfeRaw: formatAxisValue(point.mfe ?? 0, rawCurrencyFormat),
        pl: formatAxisValue(point.pl ?? 0, rawCurrencyFormat),
        profitCapture: point.profitCapturePercent !== undefined
          ? formatAxisValue(point.profitCapturePercent, percentFormat)
          : "N/A",
        excursionRatio: point.excursionRatio !== undefined
          ? formatAxisValue(point.excursionRatio, ratioFormat)
          : "N/A",
        basisLabel: efficiencyBasisLabels[point.basis],
        premiumDenominator: premiumMetrics?.denominator
          ? formatAxisValue(premiumMetrics.denominator, rawCurrencyFormat)
          : "—",
        marginDenominator: marginMetrics?.denominator
          ? formatAxisValue(marginMetrics.denominator, rawCurrencyFormat)
          : "—",
        premiumPlPercent: premiumMetrics?.plPercent !== undefined
          ? formatAxisValue(premiumMetrics.plPercent, percentFormat)
          : "N/A",
        marginPlPercent: marginMetrics?.plPercent !== undefined
          ? formatAxisValue(marginMetrics.plPercent, percentFormat)
          : "N/A"
      }
    }

    const traces: Partial<PlotData>[] = []

    if (winners.length > 0) {
      traces.push({
        x: winners.map(entry => entry.xValue),
        y: winners.map(entry => entry.yValue),
        type: "scatter",
        mode: "markers",
        name: "Winners",
        marker: {
          color: "#22c55e",
          size: 8,
          opacity: 0.7,
          line: {
            color: "#16a34a",
            width: 1
          }
        },
        customdata: winners.map(toCustomData) as unknown as PlotData["customdata"],
        hovertemplate:
          "<b>Winner - Trade #%{customdata.trade}</b><br>" +
          "Strategy: %{customdata.strategy}<br>" +
          "Date: %{customdata.date}<br>" +
          "%{customdata.xLabel}: %{customdata.xFormatted}<br>" +
          "%{customdata.yLabel}: %{customdata.yFormatted}<br>" +
          "Raw MAE: %{customdata.maeRaw}<br>" +
          "Raw MFE: %{customdata.mfeRaw}<br>" +
          "P&L: %{customdata.pl}<br>" +
          "Profit Capture: %{customdata.profitCapture}<br>" +
          "Excursion Ratio: %{customdata.excursionRatio}<br>" +
          "Normalization Basis: %{customdata.basisLabel}<br>" +
          "Premium Denominator: %{customdata.premiumDenominator}<br>" +
          "Margin Denominator: %{customdata.marginDenominator}<br>" +
          "Premium P&L: %{customdata.premiumPlPercent}<br>" +
          "Margin P&L: %{customdata.marginPlPercent}" +
          "<extra></extra>"
      })
    }

    if (losers.length > 0) {
      traces.push({
        x: losers.map(entry => entry.xValue),
        y: losers.map(entry => entry.yValue),
        type: "scatter",
        mode: "markers",
        name: "Losers",
        marker: {
          color: "#ef4444",
          size: 8,
          opacity: 0.7,
          line: {
            color: "#dc2626",
            width: 1
          }
        },
        customdata: losers.map(toCustomData) as unknown as PlotData["customdata"],
        hovertemplate:
          "<b>Loser - Trade #%{customdata.trade}</b><br>" +
          "Strategy: %{customdata.strategy}<br>" +
          "Date: %{customdata.date}<br>" +
          "%{customdata.xLabel}: %{customdata.xFormatted}<br>" +
          "%{customdata.yLabel}: %{customdata.yFormatted}<br>" +
          "Raw MAE: %{customdata.maeRaw}<br>" +
          "Raw MFE: %{customdata.mfeRaw}<br>" +
          "P&L: %{customdata.pl}<br>" +
          "Profit Capture: %{customdata.profitCapture}<br>" +
          "Excursion Ratio: %{customdata.excursionRatio}<br>" +
          "Normalization Basis: %{customdata.basisLabel}<br>" +
          "Premium Denominator: %{customdata.premiumDenominator}<br>" +
          "Margin Denominator: %{customdata.marginDenominator}<br>" +
          "Premium P&L: %{customdata.premiumPlPercent}<br>" +
          "Margin P&L: %{customdata.marginPlPercent}" +
          "<extra></extra>"
      })
    }

    const showDiagonal = (() => {
      if (!xMetric || !yMetric) return false
      if (xMetric === "mae" && yMetric === "mfe") return true
      if (xMetric.startsWith("mae_percent_") && yMetric.startsWith("mfe_percent_")) {
        return xMetric.replace("mae_percent_", "") === yMetric.replace("mfe_percent_", "")
      }
      return false
    })()

    if (showDiagonal) {
      const maxVal = Math.max(
        ...points.map(entry => Math.max(entry.xValue, entry.yValue))
      )

      traces.push({
        x: [0, maxVal],
        y: [0, maxVal],
        type: "scatter",
        mode: "lines",
        name: "MFE = MAE",
        line: {
          color: "#6b7280",
          width: 1,
          dash: "dash"
        },
        hoverinfo: "skip",
        showlegend: true
      })
    }

    const layout: Partial<Layout> = {
      xaxis: {
        title: { text: selectedX.axisLabel },
        showgrid: true,
        zeroline: true
      },
      yaxis: {
        title: { text: selectedY.axisLabel },
        showgrid: true,
        zeroline: true
      },
      showlegend: true,
      legend: {
        orientation: "h",
        yanchor: "bottom",
        y: 1.02,
        xanchor: "right",
        x: 1
      },
      hovermode: "closest",
      annotations: [
        {
          text: "Use the axis selectors to compare excursions against pricing, volatility, or any other trade input.",
          xref: "paper",
          yref: "paper",
          x: 0.02,
          y: 0.98,
          xanchor: "left",
          yanchor: "top",
          showarrow: false,
          font: {
            size: 10,
            color: "#6b7280"
          },
          bgcolor: "rgba(255, 255, 255, 0.8)",
          borderpad: 4
        }
      ]
    }

    return { plotData: traces, layout }
  }, [data, selectedX, selectedY, xMetric, yMetric])

  const description = selectedX && selectedY
    ? `Explore trade excursions by plotting ${selectedY.axisLabel} against ${selectedX.axisLabel}.`
    : "Backtest theoretical risk versus reward scatter plot"

  const axisSelectors = axisOptions.length > 0 ? (
    <div className="flex flex-wrap gap-2">
      <Select value={xMetric ?? undefined} onValueChange={setXMetric}>
        <SelectTrigger size="sm" className="w-[220px]">
          <SelectValue placeholder="X-axis metric" />
        </SelectTrigger>
        <SelectContent>
          {axisOptions.map(option => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={yMetric ?? undefined} onValueChange={setYMetric}>
        <SelectTrigger size="sm" className="w-[220px]">
          <SelectValue placeholder="Y-axis metric" />
        </SelectTrigger>
        <SelectContent>
          {axisOptions
            .filter(option => option.value !== xMetric)
            .map(option => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
        </SelectContent>
      </Select>
    </div>
  ) : undefined

  const tooltip = {
    flavor: "Customize your opportunity map by pairing MAE/MFE with any trade parameter.",
    detailed:
      "Each point plots a trade using your chosen axes. Mix and match normalized excursion metrics with inputs like premium, margin, VIX, or commissions to uncover relationships between risk, reward, and market context. Winners and losers remain color coded so you can spot regime shifts and sensitivities quickly."
  }

  if (!data || !data.mfeMaeData || data.mfeMaeData.length === 0) {
    return (
      <ChartWrapper
        title="🎯 MFE vs MAE Analysis"
        description="Maximum Favorable vs Adverse Excursion scatter plot (backtest theoretical)"
        className={className}
        data={[]}
        layout={{}}
        style={{ height: "400px" }}
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
      style={{ height: "500px" }}
      tooltip={tooltip}
      actions={axisSelectors}
    />
  )
}
