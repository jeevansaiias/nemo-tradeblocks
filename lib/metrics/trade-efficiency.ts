import { Trade } from '@/lib/models/trade'

const OPTION_CONTRACT_MULTIPLIER = 100
const MARGIN_RATIO_THRESHOLD = 0.5
const SMALL_NOTIONAL_THRESHOLD = 5_000

function getNormalizedContractCount(trade: Trade): number {
  const contracts = typeof trade.numContracts === 'number' && isFinite(trade.numContracts)
    ? Math.abs(trade.numContracts)
    : 0

  return contracts > 0 ? contracts : 1
}

function applyOptionMultiplierIfNeeded(total: number, trade: Trade): number {
  if (!isFinite(total) || total <= 0) {
    return total
  }

  const margin = typeof trade.marginReq === 'number' && isFinite(trade.marginReq)
    ? Math.abs(trade.marginReq)
    : undefined

  if (margin && margin > 0) {
    const ratio = total / margin
    if (ratio > 0 && ratio < MARGIN_RATIO_THRESHOLD) {
      return total * OPTION_CONTRACT_MULTIPLIER
    }
    return total
  }

  if (total < SMALL_NOTIONAL_THRESHOLD) {
    return total * OPTION_CONTRACT_MULTIPLIER
  }

  return total
}

function normalisePerContractValue(value: number, trade: Trade, isPremium: boolean): number {
  const contracts = getNormalizedContractCount(trade)
  let base = Math.abs(value)

  if (isPremium && trade.premiumPrecision === 'cents') {
    base = base / 100
  }

  const total = base * contracts
  return applyOptionMultiplierIfNeeded(total, trade)
}

export function computeTotalPremium(trade: Trade): number | undefined {
  if (typeof trade.premium !== 'number' || !isFinite(trade.premium)) {
    return undefined
  }

  const total = normalisePerContractValue(Math.abs(trade.premium), trade, true)
  return isFinite(total) && total > 0 ? total : undefined
}

export function computeTotalMaxProfit(trade: Trade): number | undefined {
  if (typeof trade.maxProfit !== 'number' || !isFinite(trade.maxProfit) || trade.maxProfit === 0) {
    return undefined
  }

  const total = normalisePerContractValue(Math.abs(trade.maxProfit), trade, false)
  return isFinite(total) && total > 0 ? total : undefined
}

export function computeTotalMaxLoss(trade: Trade): number | undefined {
  if (typeof trade.maxLoss !== 'number' || !isFinite(trade.maxLoss) || trade.maxLoss === 0) {
    return undefined
  }

  const total = normalisePerContractValue(Math.abs(trade.maxLoss), trade, false)
  return isFinite(total) && total > 0 ? total : undefined
}

export type EfficiencyBasis = 'premium' | 'maxProfit' | 'margin' | 'unknown'

export interface PremiumEfficiencyResult {
  percentage?: number
  denominator?: number
  basis: EfficiencyBasis
}

export function calculatePremiumEfficiencyPercent(trade: Trade): PremiumEfficiencyResult {
  const totalPremium = computeTotalPremium(trade)
  const totalMaxProfit = computeTotalMaxProfit(trade)
  const margin = typeof trade.marginReq === 'number' && isFinite(trade.marginReq) && trade.marginReq !== 0
    ? Math.abs(trade.marginReq)
    : undefined

  let denominator: number | undefined
  let basis: EfficiencyBasis = 'unknown'

  if (totalPremium && totalPremium > 0) {
    denominator = totalPremium
    basis = 'premium'
  } else if (totalMaxProfit && totalMaxProfit > 0) {
    denominator = totalMaxProfit
    basis = 'maxProfit'
  } else if (margin && margin > 0) {
    denominator = margin
    basis = 'margin'
  }

  if (!denominator || denominator === 0) {
    return { basis }
  }

  const percentage = (trade.pl / denominator) * 100

  if (!isFinite(percentage)) {
    return { basis }
  }

  return {
    percentage,
    denominator,
    basis
  }
}
