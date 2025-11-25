import { NextResponse } from 'next/server'
import {
  parseTradesFromCSV,
  enrichTrades,
  calculateStrategyMetrics,
  breakdownByExitReason,
  type EnrichedTrade,
  type StrategyMetrics,
  type ExitReasonBreakdown,
  type Trade,
} from '@/lib/processing/tp_optimizer_mae_mfe_service'

type APIResponse = {
  status: string
  source: string
  globalMetrics: {
    total_trades: number
    total_strategies: number
    overall_win_rate: number
    overall_avg_efficiency: number
    overall_avg_mfe: number
    overall_avg_missed_profit: number
  }
  trades: EnrichedTrade[]
  strategies: StrategyMetrics[]
  exitReasonBreakdowns: Record<string, ExitReasonBreakdown[]>
}

function makeGlobalMetrics(enriched: EnrichedTrade[]) {
  const totalTrades = enriched.length
  const totalStrategies = new Set(enriched.map((t) => t.strategy)).size
  const overallWinRate = totalTrades > 0 ? (enriched.filter(t => t.actual_pct > 0).length / totalTrades) * 100 : 0
  const overallAvgEfficiency = totalTrades > 0 ? (enriched.reduce((s, t) => s + (t.efficiency || 0), 0) / totalTrades) : 0
  const overallAvgMFE = totalTrades > 0 ? (enriched.reduce((s, t) => s + (t.mfe_pct || 0), 0) / totalTrades) : 0
  const overallAvgMissed = totalTrades > 0 ? (enriched.reduce((s, t) => s + (t.missed_profit_pct || 0), 0) / totalTrades) : 0

  return {
    total_trades: totalTrades,
    total_strategies: totalStrategies,
    overall_win_rate: Math.round(overallWinRate * 100) / 100,
    overall_avg_efficiency: Math.round(overallAvgEfficiency * 100) / 100,
    overall_avg_mfe: Math.round(overallAvgMFE * 100) / 100,
    overall_avg_missed_profit: Math.round(overallAvgMissed * 100) / 100,
  }
}

// Small synthetic seed data used when no CSV is provided
function seedTrades(): Trade[] {
  return [
    { trade_id: 'A-1', strategy: 'Strat A', entry_date: '2024-01-02', exit_date: '2024-01-05', entry_price: 100, exit_price: 110, max_price: 115, min_price: 95, contracts: 1, exit_reason: 'TP' },
    { trade_id: 'A-2', strategy: 'Strat A', entry_date: '2024-01-10', exit_date: '2024-01-12', entry_price: 120, exit_price: 118, max_price: 125, min_price: 116, contracts: 1, exit_reason: 'Stop' },
    { trade_id: 'B-1', strategy: 'Strat B', entry_date: '2024-02-01', exit_date: '2024-02-03', entry_price: 50, exit_price: 60, max_price: 65, min_price: 49, contracts: 2, exit_reason: 'TP' },
    { trade_id: 'B-2', strategy: 'Strat B', entry_date: '2024-02-10', exit_date: '2024-02-11', entry_price: 55, exit_price: 53, max_price: 58, min_price: 52, contracts: 1, exit_reason: 'Manual' },
    { trade_id: 'C-1', strategy: 'Strat C', entry_date: '2024-03-01', exit_date: '2024-03-05', entry_price: 200, exit_price: 210, max_price: 220, min_price: 195, contracts: 1, exit_reason: 'TP' },
  ]
}

export async function GET() {
  try {
    const trades = seedTrades()
    const enriched = enrichTrades(trades)
    const strategyMetricsMap = calculateStrategyMetrics(enriched)
    const strategies = Array.from(strategyMetricsMap.values())

    // Build exit reason breakdowns per strategy
    const exitReasonBreakdowns: Record<string, ExitReasonBreakdown[]> = {}
    const strategiesSet = new Set(enriched.map(t => t.strategy))
    strategiesSet.forEach((s) => {
      const filtered = enriched.filter((t) => t.strategy === s)
      exitReasonBreakdowns[s] = breakdownByExitReason(filtered)
    })

    const body: APIResponse = {
      status: 'ok',
      source: 'seed',
      globalMetrics: makeGlobalMetrics(enriched),
      trades: enriched,
      strategies,
      exitReasonBreakdowns,
    }

    return NextResponse.json(body)
  } catch (err) {
    return NextResponse.json({ status: 'error', message: err instanceof Error ? err.message : 'Unknown' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const csv = body?.csvContent
    if (!csv) return NextResponse.json({ status: 'error', message: 'csvContent required' }, { status: 400 })

    const trades = parseTradesFromCSV(csv)
    const enriched = enrichTrades(trades)
    const strategyMetricsMap = calculateStrategyMetrics(enriched)
    const strategies = Array.from(strategyMetricsMap.values())

    const exitReasonBreakdowns: Record<string, ExitReasonBreakdown[]> = {}
    const strategiesSet = new Set(enriched.map(t => t.strategy))
    strategiesSet.forEach((s) => {
      const filtered = enriched.filter((t) => t.strategy === s)
      exitReasonBreakdowns[s] = breakdownByExitReason(filtered)
    })

    const resBody: APIResponse = {
      status: 'ok',
      source: 'uploaded',
      globalMetrics: makeGlobalMetrics(enriched),
      trades: enriched,
      strategies,
      exitReasonBreakdowns,
    }

    return NextResponse.json(resBody)
  } catch (err) {
    return NextResponse.json({ status: 'error', message: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
