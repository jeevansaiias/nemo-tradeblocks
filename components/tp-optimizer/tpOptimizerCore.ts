// Core TP/SL optimization logic powered by excursion data
export interface TPOptimizerTrade {
  id: string | number;
  realizedPL: number;
  marginUsed: number;
  mfePctMargin: number;
  maePctMargin: number;
}

export interface TPSLScenarioConfig {
  id: string;
  basis: "margin";
  tpPct: number;
  slPct: number;
}

export interface TPSLScenarioResult extends TPSLScenarioConfig {
  winRate: number;
  avgReturnPct: number;
  totalReturnPct: number;
  totalPL: number;
  tpHits: number;
  slHits: number;
  trades: number;
}

function simulateTradeWithScenario(
  trade: TPOptimizerTrade,
  scenario: TPSLScenarioConfig
) {
  const { marginUsed, realizedPL, mfePctMargin, maePctMargin } = trade;

  if (!marginUsed) {
    return {
      returnPct: 0,
      pl: 0,
      hit: "none" as const,
    };
  }

  const realizedReturnPct = (realizedPL / marginUsed) * 100;

  let simulatedReturnPct = realizedReturnPct;
  let hit: "tp" | "sl" | "none" = "none";

  if (mfePctMargin >= scenario.tpPct) {
    simulatedReturnPct = scenario.tpPct;
    hit = "tp";
  } else if (maePctMargin <= scenario.slPct) {
    simulatedReturnPct = scenario.slPct;
    hit = "sl";
  }

  const simulatedPL = (simulatedReturnPct / 100) * marginUsed;

  return {
    returnPct: simulatedReturnPct,
    pl: simulatedPL,
    hit,
  };
}

export function evaluateScenario(
  trades: TPOptimizerTrade[],
  scenario: TPSLScenarioConfig
): TPSLScenarioResult {
  let totalReturnPct = 0;
  let totalPL = 0;
  let wins = 0;
  let tpHits = 0;
  let slHits = 0;

  trades.forEach((trade) => {
    const { returnPct, pl, hit } = simulateTradeWithScenario(trade, scenario);

    totalReturnPct += returnPct;
    totalPL += pl;

    if (pl > 0) wins += 1;
    if (hit === "tp") tpHits += 1;
    if (hit === "sl") slHits += 1;
  });

  const tradesCount = trades.length || 1;
  const winRate = (wins / tradesCount) * 100;
  const avgReturnPct = totalReturnPct / tradesCount;

  return {
    ...scenario,
    winRate,
    avgReturnPct,
    totalReturnPct,
    totalPL,
    tpHits,
    slHits,
    trades: tradesCount,
  };
}

export function evaluateScenarios(
  trades: TPOptimizerTrade[],
  scenarios: TPSLScenarioConfig[]
): TPSLScenarioResult[] {
  return scenarios.map((scenario) => evaluateScenario(trades, scenario));
}

export function findBestScenario(
  results: TPSLScenarioResult[],
  baseline?: { totalReturnPct: number; totalPL: number }
) {
  if (results.length === 0) return null;

  const best = [...results].sort((a, b) => b.totalReturnPct - a.totalReturnPct)[0];

  if (!baseline) {
    return {
      best,
      deltaReturnPct: 0,
      deltaPL: 0,
    };
  }

  return {
    best,
    deltaReturnPct: best.totalReturnPct - baseline.totalReturnPct,
    deltaPL: best.totalPL - baseline.totalPL,
  };
}

export function generateBestScenariosFromExcursions(
  trades: TPOptimizerTrade[],
  options?: {
    step?: number;
    topN?: number;
  }
): TPSLScenarioResult[] {
  if (trades.length === 0) return [];

  const step = options?.step ?? 5;
  const topN = options?.topN ?? 3;

  const maxMfe = Math.max(...trades.map((trade) => trade.mfePctMargin || 0));
  const minMae = Math.min(...trades.map((trade) => trade.maePctMargin || 0));

  const tpLevels: number[] = [];
  for (let tp = step; tp <= Math.floor(maxMfe / step) * step; tp += step) {
    tpLevels.push(tp);
  }

  const slLevels: number[] = [];
  for (
    let sl = -step;
    sl >= Math.ceil(minMae / step) * step;
    sl -= step
  ) {
    slLevels.push(sl);
  }

  const scenarios: TPSLScenarioConfig[] = [];

  tpLevels.forEach((tp) => {
    slLevels.forEach((sl) => {
      if (sl < 0 && tp > 0) {
        scenarios.push({
          id: `tp${tp}_sl${sl}`,
          basis: "margin",
          tpPct: tp,
          slPct: sl,
        });
      }
    });
  });

  const results = evaluateScenarios(trades, scenarios);

  return results
    .sort((a, b) => b.totalReturnPct - a.totalReturnPct)
    .slice(0, topN);
}
