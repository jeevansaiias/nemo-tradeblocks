import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import {
  enrichTrades,
  calculateStrategyMetrics,
  breakdownByExitReason,
  parseTradesFromCSV,
} from '@/lib/processing/tp_optimizer_mae_mfe_service';

interface ExitReasonData {
  reason: string;
  count: number;
  avg_missed_profit: number;
  recommended_tp: number;
}

interface SeedData {
  trades: Array<{
    trade_id: string;
    strategy: string;
    entry_date: string;
    exit_date: string;
    entry_price: number;
    exit_price: number;
    max_price: number;
    min_price: number;
    contracts: number;
    exit_reason: string;
    actual_pct?: number;
    max_profit_pct?: number;
    max_loss_pct?: number;
    mfe_pct?: number;
    mae_pct?: number;
    optimal_tp?: number;
    missed_profit_pct?: number;
    efficiency?: number;
  }>;
  strategies?: Array<{
    strategy: string;
    trade_count: number;
    avg_mfe: number;
    avg_mae: number;
    avg_missed_profit: number;
    recommended_tp: number;
    win_rate: number;
    efficiency_score: number;
  }>;
}

export async function GET() {
  try {
    const dataPath = path.join(
      process.cwd(),
      'data',
      'tp_optimizer_mae_mfe.json'
    );

    if (!fs.existsSync(dataPath)) {
      return NextResponse.json(
        {
          error: 'Seed data not found',
          message: 'tp_optimizer_mae_mfe.json not found',
        },
        { status: 404 }
      );
    }

    const fileContent = fs.readFileSync(dataPath, 'utf-8');
    const seedData: SeedData = JSON.parse(fileContent);

    // Enrich trades with MAE/MFE calculations if not already enriched
    const enrichedTrades = enrichTrades(seedData.trades);

    // Calculate strategy metrics
    const strategyMetricsMap = calculateStrategyMetrics(enrichedTrades);
    const strategyMetrics = Array.from(strategyMetricsMap.values());

    // Get exit reason breakdowns for each strategy
    const exitReasonBreakdowns: Record<string, ExitReasonData[]> = {};
    for (const [strategyName] of strategyMetricsMap) {
      const strategyTrades = enrichedTrades.filter(
        (t) => t.strategy === strategyName
      );
      exitReasonBreakdowns[strategyName] = breakdownByExitReason(
        strategyTrades
      );
    }

    // Calculate global metrics
    const globalMetrics = {
      total_trades: enrichedTrades.length,
      total_strategies: strategyMetrics.length,
      overall_win_rate: Math.round(
        (enrichedTrades.filter((t) => t.actual_pct > 0).length /
          enrichedTrades.length) *
          100
      ),
      overall_avg_efficiency: Math.round(
        enrichedTrades.reduce((sum, t) => sum + (t.efficiency || 0), 0) /
          enrichedTrades.length
      ),
      overall_avg_mfe: Number(
        (
          enrichedTrades.reduce((sum, t) => sum + (t.mfe_pct || 0), 0) /
            enrichedTrades.length
        ).toFixed(3)
      ),
      overall_avg_missed_profit: Number(
        (
          enrichedTrades.reduce((sum, t) => sum + (t.missed_profit_pct || 0), 0) /
            enrichedTrades.length
        ).toFixed(3)
      ),
    };

    return NextResponse.json({
      status: 'success',
      source: 'seed-data',
      globalMetrics,
      trades: enrichedTrades,
      strategies: strategyMetrics,
      exitReasonBreakdowns,
    });
  } catch (error) {
    console.error('GET /api/tp-optimizer-mae-mfe error:', error);
    return NextResponse.json(
      {
        error: 'Failed to load MAE/MFE data',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { csvContent } = await request.json();

    if (!csvContent || typeof csvContent !== 'string') {
      return NextResponse.json(
        { error: 'Invalid request', message: 'csvContent is required' },
        { status: 400 }
      );
    }

    // Parse trades from CSV
    const trades = parseTradesFromCSV(csvContent);

    if (trades.length === 0) {
      return NextResponse.json(
        {
          error: 'No valid trades found',
          message:
            'CSV file did not contain any valid trade records. Ensure the CSV has columns for: Strategy, Entry Price, Exit Price, Max Price, Min Price, Contracts, Exit Reason',
        },
        { status: 400 }
      );
    }

    // Enrich trades with MAE/MFE calculations
    const enrichedTrades = enrichTrades(trades);

    // Calculate strategy metrics
    const strategyMetricsMap = calculateStrategyMetrics(enrichedTrades);
    const strategyMetrics = Array.from(strategyMetricsMap.values());

    // Get exit reason breakdowns for each strategy
    const exitReasonBreakdowns: Record<string, ExitReasonData[]> = {};
    for (const [strategyName] of strategyMetricsMap) {
      const strategyTrades = enrichedTrades.filter(
        (t) => t.strategy === strategyName
      );
      exitReasonBreakdowns[strategyName] = breakdownByExitReason(
        strategyTrades
      );
    }

    // Calculate global metrics
    const globalMetrics = {
      total_trades: enrichedTrades.length,
      total_strategies: strategyMetrics.length,
      overall_win_rate: Math.round(
        (enrichedTrades.filter((t) => t.actual_pct > 0).length /
          enrichedTrades.length) *
          100
      ),
      overall_avg_efficiency: Math.round(
        enrichedTrades.reduce((sum, t) => sum + (t.efficiency || 0), 0) /
          enrichedTrades.length
      ),
      overall_avg_mfe: Number(
        (
          enrichedTrades.reduce((sum, t) => sum + (t.mfe_pct || 0), 0) /
            enrichedTrades.length
        ).toFixed(3)
      ),
      overall_avg_missed_profit: Number(
        (
          enrichedTrades.reduce((sum, t) => sum + (t.missed_profit_pct || 0), 0) /
            enrichedTrades.length
        ).toFixed(3)
      ),
    };

    return NextResponse.json({
      status: 'success',
      source: 'user-upload',
      globalMetrics,
      trades: enrichedTrades,
      strategies: strategyMetrics,
      exitReasonBreakdowns,
    });
  } catch (error) {
    console.error('POST /api/tp-optimizer-mae-mfe error:', error);
    return NextResponse.json(
      {
        error: 'Failed to process CSV',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
