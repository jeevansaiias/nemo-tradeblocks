import { type NormalizationBasis } from "@/lib/calculations/mfe-mae";

export type ExitBasis = NormalizationBasis;

// Slimmed excursion point tailored for TP/SL optimization.
// This intentionally mirrors the data already produced for the excursion charts.
export interface MFEMAEExitPoint {
  tradeNumber: number;
  strategy: string;
  symbol?: string;
  basis: ExitBasis;
  mfePct: number; // maximum favorable excursion, % of basis
  maePct: number; // maximum adverse excursion, % of basis (negative when loss is represented with sign)
  actualReturnPct: number; // realized P/L as % of basis
  actualPl: number; // realized absolute P/L
  basisValue: number; // margin or premium used as denominator
  profitCapturePct?: number;
  exitReason?: string;
  date?: string;
}

export type SimulatedExitType = "TP" | "SL" | "UNCHANGED";

export interface TPSlScenarioConfig {
  tpPct: number; // positive, e.g. 20 (%)
  slPct: number; // negative, e.g. -10 (%)
}

export interface ExitRuleScenarioResult {
  id: string; // `${basis}-${tpPct}-${slPct}`
  basis: ExitBasis;
  tpPct: number;
  slPct: number;

  // aggregate metrics
  trades: number;
  wins: number;
  losses: number;
  winRate: number;

  avgReturnPct: number;
  totalReturnPct: number;
  totalPl: number;
  rom: number;

  tpHits: number;
  slHits: number;
  unchanged: number;
  tpHitRate: number;
  slHitRate: number;

  medianReturnPct?: number;
  expectancyPct?: number;
}
