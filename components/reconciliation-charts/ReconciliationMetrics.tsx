"use client"

import { MetricCard } from "@/components/metric-card"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AlignedTradeSet, AlignmentMetrics } from "@/lib/services/trade-reconciliation"
import { TrendingDown, TrendingUp } from "lucide-react"
import { cn } from "@/lib/utils"

interface ReconciliationMetricsProps {
  metrics: AlignmentMetrics
  alignment: AlignedTradeSet // Need full alignment to calculate session-based match rate
  className?: string
}

export function ReconciliationMetrics({ metrics, alignment, className }: ReconciliationMetricsProps) {
  const {
    backtested,
    reported,
    delta,
    slippagePerContract,
    tTest,
    correlation,
    matched,
  } = metrics

  // Calculate session-based match rate (more accurate than trade-based)
  const totalSessions = alignment.sessions.length
  const matchedSessions = alignment.sessions.filter(session =>
    session.items.some(item => item.isPaired)
  ).length
  const sessionMatchRate = totalSessions > 0 ? matchedSessions / totalSessions : 0

  // Calculate derived metrics
  const plDifferencePercent = backtested.totalPl !== 0
    ? (delta.totalPl / Math.abs(backtested.totalPl)) * 100
    : null

  const plDifferenceSubtitle = plDifferencePercent !== null
    ? `${plDifferencePercent >= 0 ? '+' : ''}${plDifferencePercent.toFixed(1)}%`
    : 'N/A'

  const avgSlippagePerTrade = matched.tradeCount > 0
    ? matched.totalSlippage / matched.tradeCount
    : null

  const slippageAsPercentOfPremium = Math.abs(matched.backtestedAvgPremiumPerContract) > 1e-6
    ? (slippagePerContract / Math.abs(matched.backtestedAvgPremiumPerContract)) * 100
    : null

  const formatCurrency = (value: number) => new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)

  const slippagePercentBreakdown = slippageAsPercentOfPremium !== null
    ? `${formatCurrency(slippagePerContract)} / ${formatCurrency(Math.abs(matched.backtestedAvgPremiumPerContract))}`
    : undefined

  const matchedAvgPremiumDisplay = formatCurrency(matched.backtestedAvgPremiumPerContract)
  const slippagePerContractDisplay = formatCurrency(slippagePerContract)
  const avgSlippagePerTradeDisplay = avgSlippagePerTrade != null ? formatCurrency(avgSlippagePerTrade) : null

  return (
    <div className={cn("space-y-4", className)}>
      {/* Match Quality & Trade Counts - Compact Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {/* Match Rate - Larger span */}
        <Card className="md:col-span-2 relative backdrop-blur-sm bg-background/50 border-border/50 transition-all duration-200 hover:shadow-md hover:bg-background/80 py-0">
          <CardContent className="px-0 p-2">
            <div className="space-y-1 text-center">
              {/* Title */}
              <div className="flex items-center justify-center gap-1">
                <span className="text-xs font-medium text-muted-foreground">Match Quality</span>
              </div>

              {/* Value */}
              <div className="text-base font-semibold">
                {(sessionMatchRate * 100).toFixed(1)}%
              </div>

              {/* Subtitle */}
              <div className="text-xs text-muted-foreground">
                {matchedSessions} of {totalSessions} sessions
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Backtested Trades */}
        <MetricCard
          title="Backtested"
          value={alignment.backtestedTrades.length}
          format="number"
          subtitle="trades included"
          size="sm"
        />

        {/* Reported Trades */}
        <MetricCard
          title="Reported"
          value={alignment.reportedTrades.length}
          format="number"
          subtitle="trades included"
          size="sm"
        />

        {/* Unmatched Sessions */}
        <MetricCard
          title="Unmatched"
          value={totalSessions - matchedSessions}
          format="number"
          subtitle="sessions"
          size="sm"
          isPositive={totalSessions - matchedSessions === 0}
        />
      </div>

      {/* Performance Delta Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <MetricCard
          title="Avg Premium / Contract"
          value={matchedAvgPremiumDisplay}
          format="number"
          size="sm"
          tooltip={{
            flavor: "Average matched backtested premium per contract",
            detailed: "Baseline premium from matched backtested trades. Used as the denominator when computing slippage percentage."
          }}
        />

        <MetricCard
          title="Avg Slippage / Contract"
          value={slippagePerContractDisplay}
          format="number"
          isPositive={slippagePerContract >= 0}
          size="sm"
          tooltip={{
            flavor: "Slippage normalized per contract",
            detailed: "Shows slippage on a per-contract basis, useful for comparing strategies with different position sizes."
          }}
        />

        <MetricCard
          title="Avg Slippage / Trade"
          value={avgSlippagePerTradeDisplay ?? 'N/A'}
          format="number"
          isPositive={avgSlippagePerTrade != null ? avgSlippagePerTrade >= 0 : undefined}
          size="sm"
          tooltip={{
            flavor: "Average slippage per trade execution",
            detailed: "Measures the average difference in premium captured per trade. Positive slippage means better execution than expected."
          }}
        />

        <MetricCard
          title="Slippage % of Premium"
          value={slippageAsPercentOfPremium ?? 'N/A'}
          format="percentage"
          isPositive={slippageAsPercentOfPremium != null ? slippageAsPercentOfPremium >= 0 : undefined}
          size="sm"
          tooltip={{
            flavor: "Slippage as percentage of average premium",
            detailed: slippagePercentBreakdown
              ? `Calculated as ${formatCurrency(slippagePerContract)} divided by ${formatCurrency(Math.abs(matched.backtestedAvgPremiumPerContract))}. Numerator is Avg Slippage / Contract; denominator is Avg Premium / Contract. Values near 0% indicate execution closely matched expectations.`
              : "Relative measure of slippage impact. Values near 0% indicate execution closely matched expectations."
          }}
        />

        <MetricCard
          title="Net P/L Δ"
          value={delta.totalPl}
          format="currency"
          isPositive={delta.totalPl >= 0}
          subtitle={plDifferenceSubtitle}
          size="sm"
          tooltip={{
            flavor: "Difference between reported and backtested P/L",
            detailed: "Positive values indicate reported performance exceeded backtested expectations. This includes slippage, execution differences, and timing variations."
          }}
        />
      </div>

      {/* Statistical Significance Card */}
      {tTest && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Statistical Analysis</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Key Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="text-center p-2 bg-muted/50 rounded">
                <div className="text-base font-semibold">
                  {tTest.pValue < 0.001 ? '<0.001' : tTest.pValue.toFixed(3)}
                </div>
                <div className="text-xs text-muted-foreground">p-value</div>
              </div>

              <div className="text-center p-2 bg-muted/50 rounded">
                <div className="text-base font-semibold">
                  {tTest.tStatistic.toFixed(2)}
                </div>
                <div className="text-xs text-muted-foreground">t-statistic</div>
              </div>

              <div className="text-center p-2 bg-muted/50 rounded">
                <div className="text-base font-semibold">
                  ${tTest.meanDifference.toFixed(2)}
                </div>
                <div className="text-xs text-muted-foreground">Mean Diff</div>
              </div>

              <div className="text-center p-2 bg-muted/50 rounded">
                <div className="text-base font-semibold">
                  {tTest.degreesOfFreedom}
                </div>
                <div className="text-xs text-muted-foreground">df</div>
              </div>
            </div>

            {/* Confidence Interval */}
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground">
                95% Confidence Interval
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-muted/50 rounded p-2 text-center">
                  <div className="text-sm font-semibold">
                    ${tTest.confidenceInterval[0].toFixed(2)}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">to</div>
                <div className="flex-1 bg-muted/50 rounded p-2 text-center">
                  <div className="text-sm font-semibold">
                    ${tTest.confidenceInterval[1].toFixed(2)}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Correlation Card */}
      {correlation && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Correlation Analysis</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Correlation Values */}
            <div className="grid grid-cols-2 gap-3">
              <div className="text-center p-3 bg-muted/50 rounded">
                <div className="flex items-center justify-center gap-1 mb-1">
                  {correlation.pearsonR >= 0 ? (
                    <TrendingUp className="w-4 h-4 text-green-500" />
                  ) : (
                    <TrendingDown className="w-4 h-4 text-red-500" />
                  )}
                  <div className="text-xl font-bold">
                    {correlation.pearsonR.toFixed(3)}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">Pearson r</div>
                <div className="text-xs text-muted-foreground/70 mt-1">
                  (Linear correlation)
                </div>
              </div>

              <div className="text-center p-3 bg-muted/50 rounded">
                <div className="flex items-center justify-center gap-1 mb-1">
                  {correlation.spearmanRho >= 0 ? (
                    <TrendingUp className="w-4 h-4 text-green-500" />
                  ) : (
                    <TrendingDown className="w-4 h-4 text-red-500" />
                  )}
                  <div className="text-xl font-bold">
                    {correlation.spearmanRho.toFixed(3)}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">Spearman ρ</div>
                <div className="text-xs text-muted-foreground/70 mt-1">
                  (Rank correlation)
                </div>
              </div>
            </div>

            {/* Correlation strength indicator */}
            <div className="flex items-center gap-2 text-sm">
              <div className="flex-1 bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 h-2 rounded-full" />
              <div className="text-xs text-muted-foreground">
                {Math.abs(correlation.pearsonR) >= 0.7 ? "Strong" :
                 Math.abs(correlation.pearsonR) >= 0.5 ? "Moderate" : "Weak"}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Trade Efficiency Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <MetricCard
          title="Total Fees (BT)"
          value={backtested.totalFees}
          format="currency"
          subtitle="Backtested"
          tooltip={{
            flavor: "Total commissions and fees for backtested trades",
            detailed: "Includes opening and closing commissions for all matched backtested trades."
          }}
        />

        <MetricCard
          title="Total Fees (RP)"
          value={reported.totalFees}
          format="currency"
          subtitle="Reported"
          tooltip={{
            flavor: "Total commissions and fees for reported trades",
            detailed: "Actual fees paid during live execution."
          }}
        />

        <MetricCard
          title="Fee Difference"
          value={delta.totalFees}
          format="currency"
          isPositive={delta.totalFees <= 0}
          tooltip={{
            flavor: "Difference in total fees",
            detailed: "Positive values indicate higher fees in reported trades. This can impact net P/L significantly."
          }}
        />
      </div>
    </div>
  )
}
