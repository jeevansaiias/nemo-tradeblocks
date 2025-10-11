"use client";

import { Card } from "@/components/ui/card";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import type { MonteCarloResult } from "@/lib/calculations/monte-carlo";
import {
  AlertOctagon,
  HelpCircle,
  Percent,
  Star,
  Target,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

interface StatisticsCardsProps {
  result: MonteCarloResult;
}

export function StatisticsCards({ result }: StatisticsCardsProps) {
  const { statistics, parameters } = result;

  // Calculate annualized return
  const yearsSimulated = parameters.simulationLength / parameters.tradesPerYear;
  const annualizedReturn =
    yearsSimulated > 0
      ? Math.pow(1 + statistics.meanTotalReturn, 1 / yearsSimulated) - 1
      : statistics.meanTotalReturn;

  // Use the final timestep of the 95th percentile equity curve for best-case return
  const bestCaseReturn =
    result.percentiles.p95.length > 0
      ? result.percentiles.p95[result.percentiles.p95.length - 1]
      : statistics.medianTotalReturn;

  return (
    <div className="space-y-6">
      {/* Key Metrics - Top Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Expected Return */}
        <Card className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-500" />
              <span className="text-sm font-medium text-muted-foreground">
                Expected Return
              </span>
            </div>
            <HoverCard>
              <HoverCardTrigger asChild>
                <HelpCircle className="h-4 w-4 text-muted-foreground/60 cursor-help" />
              </HoverCardTrigger>
              <HoverCardContent className="w-80 p-0 overflow-hidden">
                <div className="space-y-3">
                  <div className="bg-primary/5 border-b px-4 py-3">
                    <h4 className="text-sm font-semibold text-primary">
                      Expected Return
                    </h4>
                  </div>
                  <div className="px-4 pb-4 space-y-3">
                    <p className="text-sm font-medium text-foreground leading-relaxed">
                      The average annualized return across all Monte Carlo
                      simulations.
                    </p>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      This represents the mean outcome if you continue trading
                      with similar performance. It&apos;s the center point of
                      your probability distribution - half of simulations ended
                      above this level, half below. Use this as a baseline
                      expectation, but remember actual results will vary
                      significantly.
                    </p>
                  </div>
                </div>
              </HoverCardContent>
            </HoverCard>
          </div>
          <div>
            <div className="text-2xl font-bold">
              {(annualizedReturn * 100).toFixed(1)}%
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Annualized from {parameters.simulationLength} trades
            </div>
          </div>
        </Card>

        {/* Probability of Profit */}
        <Card className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <Percent className="h-5 w-5 text-blue-500" />
              <span className="text-sm font-medium text-muted-foreground">
                Probability of Profit
              </span>
            </div>
            <HoverCard>
              <HoverCardTrigger asChild>
                <HelpCircle className="h-4 w-4 text-muted-foreground/60 cursor-help" />
              </HoverCardTrigger>
              <HoverCardContent className="w-80 p-0 overflow-hidden">
                <div className="space-y-3">
                  <div className="bg-primary/5 border-b px-4 py-3">
                    <h4 className="text-sm font-semibold text-primary">
                      Probability of Profit
                    </h4>
                  </div>
                  <div className="px-4 pb-4 space-y-3">
                    <p className="text-sm font-medium text-foreground leading-relaxed">
                      Percentage of simulations that ended with a positive total
                      return.
                    </p>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      This shows your likelihood of making money over the
                      simulated period if future performance matches historical
                      patterns. A value near 50% suggests high uncertainty,
                      while values above 70% indicate more consistent
                      profitability. Remember this assumes your past performance
                      continues unchanged.
                    </p>
                  </div>
                </div>
              </HoverCardContent>
            </HoverCard>
          </div>
          <div>
            <div className="text-2xl font-bold">
              {(statistics.probabilityOfProfit * 100).toFixed(1)}%
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Out of {parameters.numSimulations} simulations
            </div>
          </div>
        </Card>

        {/* Max Drawdown */}
        <Card className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-orange-500" />
              <span className="text-sm font-medium text-muted-foreground">
                Max Drawdown
              </span>
            </div>
            <HoverCard>
              <HoverCardTrigger asChild>
                <HelpCircle className="h-4 w-4 text-muted-foreground/60 cursor-help" />
              </HoverCardTrigger>
              <HoverCardContent className="w-80 p-0 overflow-hidden">
                <div className="space-y-3">
                  <div className="bg-primary/5 border-b px-4 py-3">
                    <h4 className="text-sm font-semibold text-primary">
                      Max Drawdown (95th)
                    </h4>
                  </div>
                  <div className="px-4 pb-4 space-y-3">
                    <p className="text-sm font-medium text-foreground leading-relaxed">
                      The 95th percentile worst peak-to-trough decline across
                      all simulations.
                    </p>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      This shows how deep your losing streaks could get - 95% of
                      simulations experienced drawdowns this severe or worse.
                      Use this to ensure you have sufficient capital to weather
                      rough patches without being forced to stop trading.
                      Drawdowns are measured from the highest portfolio value to
                      the subsequent lowest point.
                    </p>
                  </div>
                </div>
              </HoverCardContent>
            </HoverCard>
          </div>
          <div>
            <div className="text-2xl font-bold">
              {(statistics.medianMaxDrawdown * 100).toFixed(1)}%
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              95th percentile decline
            </div>
          </div>
        </Card>
      </div>

      {/* Scenario Analysis - Bottom Row */}
      <div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Worst Case */}
          <Card className="p-4">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <AlertOctagon className="h-5 w-5 text-red-500" />
                <span className="text-sm font-medium text-muted-foreground">
                  Worst Case
                </span>
              </div>
              <HoverCard>
                <HoverCardTrigger asChild>
                  <HelpCircle className="h-4 w-4 text-muted-foreground/60 cursor-help" />
                </HoverCardTrigger>
                <HoverCardContent className="w-80 p-0 overflow-hidden">
                  <div className="space-y-3">
                    <div className="bg-primary/5 border-b px-4 py-3">
                      <h4 className="text-sm font-semibold text-primary">
                        Worst Case (5th)
                      </h4>
                    </div>
                    <div className="px-4 pb-4 space-y-3">
                      <p className="text-sm font-medium text-foreground leading-relaxed">
                        The 5th percentile return - 95% of simulations stayed
                        above this level.
                      </p>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        This represents a pessimistic but plausible outcome
                        where things go poorly. While 5% of simulations were
                        even worse, this shouldn&apos;t be considered the
                        absolute worst case. Use this to stress-test whether you
                        could psychologically and financially survive such an
                        outcome and continue trading.
                      </p>
                    </div>
                  </div>
                </HoverCardContent>
              </HoverCard>
            </div>
            <div>
              <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                {(statistics.valueAtRisk.p5 * 100).toFixed(1)}%
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                5th percentile outcome
              </div>
            </div>
          </Card>

          {/* Most Likely */}
          <Card className="p-4">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <Target className="h-5 w-5 text-blue-500" />
                <span className="text-sm font-medium text-muted-foreground">
                  Most Likely
                </span>
              </div>
              <HoverCard>
                <HoverCardTrigger asChild>
                  <HelpCircle className="h-4 w-4 text-muted-foreground/60 cursor-help" />
                </HoverCardTrigger>
                <HoverCardContent className="w-80 p-0 overflow-hidden">
                  <div className="space-y-3">
                    <div className="bg-primary/5 border-b px-4 py-3">
                      <h4 className="text-sm font-semibold text-primary">
                        Most Likely (50th)
                      </h4>
                    </div>
                    <div className="px-4 pb-4 space-y-3">
                      <p className="text-sm font-medium text-foreground leading-relaxed">
                        The median return - half of simulations were above this,
                        half below.
                      </p>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        This is your middle-of-the-road outcome, representing
                        the 50th percentile. Unlike the mean (Expected Return),
                        the median isn&apos;t skewed by extreme outliers, making
                        it a robust estimate of central tendency. This is often
                        considered the &quot;most likely&quot; single outcome in
                        asymmetric distributions.
                      </p>
                    </div>
                  </div>
                </HoverCardContent>
              </HoverCard>
            </div>
            <div>
              <div className="text-2xl font-bold">
                {(statistics.medianTotalReturn * 100).toFixed(1)}%
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                50th percentile outcome
              </div>
            </div>
          </Card>

          {/* Best Case */}
          <Card className="p-4">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <Star className="h-5 w-5 text-green-500" />
                <span className="text-sm font-medium text-muted-foreground">
                  Best Case
                </span>
              </div>
              <HoverCard>
                <HoverCardTrigger asChild>
                  <HelpCircle className="h-4 w-4 text-muted-foreground/60 cursor-help" />
                </HoverCardTrigger>
                <HoverCardContent className="w-80 p-0 overflow-hidden">
                  <div className="space-y-3">
                    <div className="bg-primary/5 border-b px-4 py-3">
                      <h4 className="text-sm font-semibold text-primary">
                        Best Case (95th)
                      </h4>
                    </div>
                    <div className="px-4 pb-4 space-y-3">
                      <p className="text-sm font-medium text-foreground leading-relaxed">
                        The 95th percentile return - only 5% of simulations
                        exceeded this level.
                      </p>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        This represents an optimistic but plausible scenario
                        where things go very well. While some outcomes exceeded
                        this, counting on results this good or better is
                        statistically unrealistic. Use this as an upper bound
                        for planning, but don&apos;t expect to achieve it
                        consistently.
                      </p>
                    </div>
                  </div>
                </HoverCardContent>
              </HoverCard>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {(bestCaseReturn * 100).toFixed(1)}%
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                95th percentile outcome
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
