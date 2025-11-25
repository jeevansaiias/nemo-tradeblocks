import {
  type MFEMAEDataPoint,
  type NormalizationBasis,
} from "@/lib/calculations/mfe-mae";
import {
  type ExitBasis,
  type ExitRuleScenarioResult,
  type MFEMAEExitPoint,
  type SimulatedExitType,
  type TPSlScenarioConfig,
} from "@/lib/types/exit-optimization";

function toExitPoint(
  point: MFEMAEDataPoint,
  basis: NormalizationBasis
): MFEMAEExitPoint | null {
  const normalized = point.normalizedBy?.[basis];
  if (!normalized) return null;

  const maePctSigned =
    typeof normalized.maePercent === "number"
      ? -Math.abs(normalized.maePercent)
      : 0;

  return {
    tradeNumber: point.tradeNumber,
    strategy: point.strategy,
    basis,
    mfePct: normalized.mfePercent ?? 0,
    maePct: maePctSigned,
    actualReturnPct: normalized.plPercent ?? 0,
    actualPl: point.pl,
    basisValue: normalized.denominator,
    profitCapturePct: point.profitCapturePercent,
    date: point.date ? new Date(point.date).toISOString() : undefined,
  };
}

export function simulateExitRuleScenario(
  mfeMaeData: MFEMAEDataPoint[],
  basis: ExitBasis,
  scenario: TPSlScenarioConfig
): ExitRuleScenarioResult {
  const points = mfeMaeData
    .map((p) => toExitPoint(p, basis))
    .filter(Boolean) as MFEMAEExitPoint[];

  const id = `${basis}-${scenario.tpPct}-${scenario.slPct}`;

  let wins = 0;
  let losses = 0;
  let tpHits = 0;
  let slHits = 0;
  let unchanged = 0;
  let totalReturnPct = 0;
  let totalPl = 0;

  const returns: number[] = [];

  points.forEach((point) => {
    let exitType: SimulatedExitType = "UNCHANGED";
    let simulatedReturnPct = point.actualReturnPct;

    if (point.mfePct >= scenario.tpPct) {
      exitType = "TP";
      simulatedReturnPct = scenario.tpPct;
    } else if (point.maePct <= scenario.slPct) {
      exitType = "SL";
      simulatedReturnPct = scenario.slPct;
    }

    const simulatedPl = point.basisValue * (simulatedReturnPct / 100);

    switch (exitType) {
      case "TP":
        tpHits += 1;
        break;
      case "SL":
        slHits += 1;
        break;
      default:
        unchanged += 1;
    }

    if (simulatedReturnPct > 0) {
      wins += 1;
    } else if (simulatedReturnPct < 0) {
      losses += 1;
    }

    totalReturnPct += simulatedReturnPct;
    totalPl += simulatedPl;
    returns.push(simulatedReturnPct);
  });

  const trades = points.length;
  const winRate = trades > 0 ? (wins / trades) * 100 : 0;
  const tpHitRate = trades > 0 ? (tpHits / trades) * 100 : 0;
  const slHitRate = trades > 0 ? (slHits / trades) * 100 : 0;
  const avgReturnPct = trades > 0 ? totalReturnPct / trades : 0;

  const medianReturnPct = (() => {
    if (returns.length === 0) return undefined;
    const sorted = [...returns].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  })();

  const expectancyPct =
    returns.length > 0 ? returns.reduce((s, r) => s + r, 0) / returns.length : undefined;

  return {
    id,
    basis,
    tpPct: scenario.tpPct,
    slPct: scenario.slPct,
    trades,
    wins,
    losses,
    winRate,
    avgReturnPct,
    totalReturnPct,
    totalPl,
    rom: totalReturnPct,
    tpHits,
    slHits,
    unchanged,
    tpHitRate,
    slHitRate,
    medianReturnPct,
    expectancyPct,
  };
}

export function simulateExitRuleGrid(
  mfeMaeData: MFEMAEDataPoint[],
  basis: ExitBasis,
  scenarios: TPSlScenarioConfig[]
): ExitRuleScenarioResult[] {
  return scenarios.map((scenario) =>
    simulateExitRuleScenario(mfeMaeData, basis, scenario)
  );
}
