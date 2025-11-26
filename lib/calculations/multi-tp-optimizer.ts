"use client";

export type ExitBasis = "margin" | "premium";

export interface MultiTPLevel {
  /** Threshold return in %, e.g. 40 for +40% */
  levelPct: number;
  /** Fraction of original size to close at this level (0..1) */
  closeFraction: number;
  /** New trailing stop level in %, e.g. 0 for breakeven, 20 for +20% */
  trailToPct?: number;
}

export interface MultiTPRule {
  basis: ExitBasis;
  stopLossPct: number; // negative
  takeProfits: MultiTPLevel[]; // sorted ascending by levelPct (we'll enforce)
}

export interface ExcursionTrade {
  id: string;
  openedOn: Date;
  pl: number; // realized P/L in dollars
  marginReq: number;
  premium: number;
  maxProfitPct: number; // MFE% relative to basis
  maxLossPct: number;   // MAE% relative to basis (negative)
}

/**
 * Result of evaluating one MultiTP rule over a set of trades.
 */
export interface MultiTPScenarioResult {
  rule: MultiTPRule;
  totalPL: number;
  totalPremium: number;
  captureRate: number; // totalPL / totalPremium
  totalReturnPct: number; // vs startingCapital
  winRate: number;
  tradeCount: number;
  maxDrawdownPct: number;
  equityCurve: number[];
}

/**
 * Compute equity drawdown (peak-to-trough) as a percent of peak.
 */
function computeMaxDrawdownPct(equityCurve: number[]): number {
  if (equityCurve.length === 0) return 0;

  let peak = equityCurve[0];
  let maxDD = 0;

  for (const eq of equityCurve) {
    if (eq > peak) {
      peak = eq;
    }
    const dd = (eq - peak) / peak; // negative
    if (dd < maxDD) {
      maxDD = dd;
    }
  }

  return maxDD * 100;
}

/**
 * Clamp helper.
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Simulate one trade under a multi-TP rule using MFE/MAE approximations.
 *
 * Returns the simulated return in percent (e.g. 25 means +25%).
 */
export function simulateTradeWithMultiTP(
  trade: ExcursionTrade,
  rule: MultiTPRule
): number {
  const { pl, marginReq, premium, maxProfitPct, maxLossPct } = trade;

  // Choose denominator based on basis
  const denom = rule.basis === "margin" ? marginReq : premium;

  // If no denominator, fall back to realized PL only
  if (!denom || denom <= 0) {
    // avoid division by zero; just treat as realized only
    return 0;
  }

  // Realized return from actual P/L
  const realReturnPct = (pl / denom) * 100;

  // If no TPs and just a stop, approximate:
  if (!rule.takeProfits.length) {
    // If MAE <= stopLossPct AND realized is worse, cap at stop
    if (maxLossPct <= rule.stopLossPct && realReturnPct < rule.stopLossPct) {
      return rule.stopLossPct;
    }
    return realReturnPct;
  }

  // Sort TPs ascending by levelPct (defensive)
  const tps = [...rule.takeProfits].sort((a, b) => a.levelPct - b.levelPct);

  // Determine which TP levels were hit based on MFE
  const hitLevels = tps.filter(tp => maxProfitPct >= tp.levelPct);

  // If no TP hit and MAE <= stopLossPct, treat as stopped out at SL
  if (hitLevels.length === 0 && maxLossPct <= rule.stopLossPct) {
    return rule.stopLossPct;
  }

  // Simulate scaling out at each TP and trailing stop on remainder
  let remainingFraction = 1.0;
  let accumulatedReturn = 0;
  let currentStop = rule.stopLossPct;

  for (const tp of hitLevels) {
    if (remainingFraction <= 0) break;
    if (tp.closeFraction <= 0) continue;

    const closeSize = Math.min(remainingFraction, tp.closeFraction);

    // That slice exits exactly at the TP level
    accumulatedReturn += closeSize * tp.levelPct;
    remainingFraction -= closeSize;

    // Update trailing stop, if provided
    if (typeof tp.trailToPct === "number") {
      currentStop = Math.max(currentStop, tp.trailToPct);
    }
  }

  // Remaining position:
  if (remainingFraction > 0) {
    // This chunk experiences the actual realized return,
    // but with a floor at the last trailing stop.
    const effectiveRemainderReturn = clamp(realReturnPct, currentStop, Number.POSITIVE_INFINITY);
    accumulatedReturn += remainingFraction * effectiveRemainderReturn;
  }

  return accumulatedReturn;
}

/**
 * Evaluate a single MultiTP rule over a list of trades.
 */
export function evaluateMultiTPRuleOverTrades(
  trades: ExcursionTrade[],
  rule: MultiTPRule,
  startingCapital: number
): MultiTPScenarioResult {
  let equity = startingCapital;
  const equityCurve: number[] = [equity];

  let totalPL = 0;
  let totalPremium = 0;
  let wins = 0;
  let tradeCount = 0;

  for (const t of trades) {
    const denom = rule.basis === "margin" ? t.marginReq : t.premium;
    if (!denom || denom <= 0) continue;

    const newReturnPct = simulateTradeWithMultiTP(t, rule);
    const newPnL = (newReturnPct / 100) * denom;

    totalPL += newPnL;
    totalPremium += t.premium || 0;
    tradeCount += 1;
    if (newPnL > 0) wins += 1;

    equity += newPnL;
    equityCurve.push(equity);
  }

  const totalReturnPct = startingCapital > 0 ? (totalPL / startingCapital) * 100 : 0;
  const captureRate = totalPremium > 0 ? totalPL / totalPremium : 0;
  const winRate = tradeCount > 0 ? (wins / tradeCount) * 100 : 0;
  const maxDrawdownPct = computeMaxDrawdownPct(equityCurve);

  return {
    rule,
    totalPL,
    totalPremium,
    captureRate,
    totalReturnPct,
    winRate,
    tradeCount,
    maxDrawdownPct,
    equityCurve,
  };
}

/**
 * Configuration for grid search.
 */
export interface MultiTPGridConfig {
  basis: ExitBasis;
  startingCapital: number;

  tp1Levels: number[]; // e.g. [30, 40, 50]
  tp2Levels?: number[]; // optional, must be > TP1
  tp3Levels?: number[]; // optional, must be > TP2

  tp1Fractions: number[]; // e.g. [0.25, 0.33]
  tp2Fractions?: number[];
  tp3Fractions?: number[];

  tp1TrailStops?: number[]; // e.g. [0, 20]
  tp2TrailStops?: number[];
  tp3TrailStops?: number[];

  stopLossLevels: number[]; // e.g. [-20, -30, -40]

  maxDrawdownConstraintPct?: number; // e.g. 15 = 15%
  minWinRatePct?: number;
}

/**
 * Run a grid search over multiple MultiTPRules based on the provided ranges.
 */
export function runMultiTPGridSearch(
  trades: ExcursionTrade[],
  config: MultiTPGridConfig
): MultiTPScenarioResult[] {
  const {
    basis,
    startingCapital,
    tp1Levels,
    tp2Levels,
    tp3Levels,
    tp1Fractions,
    tp2Fractions,
    tp3Fractions,
    tp1TrailStops,
    tp2TrailStops,
    tp3TrailStops,
    stopLossLevels,
    maxDrawdownConstraintPct,
    minWinRatePct,
  } = config;

  const scenarios: MultiTPScenarioResult[] = [];

  for (const sl of stopLossLevels) {
    for (const tp1 of tp1Levels) {
      for (const f1 of tp1Fractions) {
        const trails1 = tp1TrailStops && tp1TrailStops.length ? tp1TrailStops : [undefined];

        for (const s1 of trails1) {
          // Option 1: Only TP1 + SL
          const baseRule: MultiTPRule = {
            basis,
            stopLossPct: sl,
            takeProfits: [
              {
                levelPct: tp1,
                closeFraction: f1,
                trailToPct: typeof s1 === "number" ? s1 : undefined,
              },
            ],
          };

          // Evaluate simple 1-TP rule
          {
            const result = evaluateMultiTPRuleOverTrades(trades, baseRule, startingCapital);
            if (
              (maxDrawdownConstraintPct === undefined ||
                result.maxDrawdownPct >= -maxDrawdownConstraintPct) &&
              (minWinRatePct === undefined || result.winRate >= minWinRatePct)
            ) {
              scenarios.push(result);
            }
          }

          // If TP2 configured, try 2-TP rules
          if (tp2Levels && tp2Fractions) {
            for (const tp2 of tp2Levels) {
              if (tp2 <= tp1) continue;

              for (const f2 of tp2Fractions) {
                const trails2 = tp2TrailStops && tp2TrailStops.length ? tp2TrailStops : [undefined];
                for (const s2 of trails2) {
                  const sumF12 = f1 + f2;
                  if (sumF12 > 1) continue;

                  const rule2: MultiTPRule = {
                    basis,
                    stopLossPct: sl,
                    takeProfits: [
                      {
                        levelPct: tp1,
                        closeFraction: f1,
                        trailToPct: typeof s1 === "number" ? s1 : undefined,
                      },
                      {
                        levelPct: tp2,
                        closeFraction: f2,
                        trailToPct: typeof s2 === "number" ? s2 : undefined,
                      },
                    ],
                  };

                  const result2 = evaluateMultiTPRuleOverTrades(trades, rule2, startingCapital);
                  if (
                    (maxDrawdownConstraintPct === undefined ||
                      result2.maxDrawdownPct >= -maxDrawdownConstraintPct) &&
                    (minWinRatePct === undefined || result2.winRate >= minWinRatePct)
                  ) {
                    scenarios.push(result2);
                  }

                  // If TP3 configured, try 3-TP rules
                  if (tp3Levels && tp3Fractions) {
                    for (const tp3 of tp3Levels) {
                      if (tp3 <= tp2) continue;

                      for (const f3 of tp3Fractions) {
                        const sumF = f1 + f2 + f3;
                        if (sumF > 1) continue;

                        const trails3 =
                          tp3TrailStops && tp3TrailStops.length ? tp3TrailStops : [undefined];

                        for (const s3 of trails3) {
                          const rule3: MultiTPRule = {
                            basis,
                            stopLossPct: sl,
                            takeProfits: [
                              {
                                levelPct: tp1,
                                closeFraction: f1,
                                trailToPct: typeof s1 === "number" ? s1 : undefined,
                              },
                              {
                                levelPct: tp2,
                                closeFraction: f2,
                                trailToPct: typeof s2 === "number" ? s2 : undefined,
                              },
                              {
                                levelPct: tp3,
                                closeFraction: f3,
                                trailToPct: typeof s3 === "number" ? s3 : undefined,
                              },
                            ],
                          };

                          const result3 = evaluateMultiTPRuleOverTrades(
                            trades,
                            rule3,
                            startingCapital
                          );
                          if (
                            (maxDrawdownConstraintPct === undefined ||
                              result3.maxDrawdownPct >= -maxDrawdownConstraintPct) &&
                            (minWinRatePct === undefined || result3.winRate >= minWinRatePct)
                          ) {
                            scenarios.push(result3);
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  // Sort by totalPL descending, then by captureRate
  scenarios.sort((a, b) => {
    if (b.totalPL !== a.totalPL) return b.totalPL - a.totalPL;
    return b.captureRate - a.captureRate;
  });

  return scenarios;
}
