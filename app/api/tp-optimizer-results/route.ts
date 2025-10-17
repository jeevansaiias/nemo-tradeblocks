import { readFileSync } from 'fs';
import { join } from 'path';
import { NextResponse } from 'next/server';

// CSV parsing and TP simulation
interface Trade {
  strategy: string;
  maxProfitPct: number;
  resultPct: number;
}

interface TPSimulation {
  tp: number;
  expectancy: number;
}

function parseCSV(csvContent: string): Trade[] {
  const lines = csvContent.trim().split('\n');
  if (lines.length < 2) throw new Error('Invalid CSV format');

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  const trades: Trade[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim());
    const record: Record<string, string | number> = {};

    headers.forEach((col, idx) => {
      record[col] = values[idx];
    });

    const strategy = String(record.strategy || '').trim();
    const maxProfit = parseFloat(String(record.maxprofitpct || record['max profit pct'] || record['max profit %'] || 0));
    const result = parseFloat(String(record.resultpct || record['result pct'] || record['result %'] || 0));

    if (strategy && !isNaN(maxProfit) && !isNaN(result)) {
      trades.push({ strategy, maxProfitPct: maxProfit, resultPct: result });
    }
  }

  return trades;
}

function simulateTPLevel(trades: Trade[], tpPct: number): TPSimulation {
  if (trades.length === 0) {
    return { tp: tpPct, expectancy: 0 };
  }

  const results = trades.map(t =>
    t.maxProfitPct >= tpPct ? tpPct : t.resultPct
  );

  const winners = results.filter(r => r > 0);
  const losers = results.filter(r => r < 0);

  const winRate = winners.length / trades.length;
  const avgWin = winners.length > 0 ? winners.reduce((a, b) => a + b, 0) / winners.length : 0;
  const avgLoss = losers.length > 0 ? Math.abs(losers.reduce((a, b) => a + b, 0) / losers.length) : 0;

  const expectancy = (winRate * avgWin) - ((1 - winRate) * avgLoss);

  return { tp: tpPct, expectancy: Math.round(expectancy * 100) / 100 };
}

function generateTPCandidates(): number[] {
  const candidates = new Set<number>();
  for (let tp = 25; tp <= 500; tp += 5) candidates.add(tp);
  return Array.from(candidates).sort((a, b) => a - b);
}

function processUploadedData(trades: Trade[]): Record<string, TPSimulation[]> {
  const byStrategy = new Map<string, Trade[]>();
  trades.forEach(t => {
    const list = byStrategy.get(t.strategy) || [];
    list.push(t);
    byStrategy.set(t.strategy, list);
  });

  const results: Record<string, TPSimulation[]> = {};
  const candidates = generateTPCandidates();
  
  byStrategy.forEach((strategyTrades, strategy) => {
    results[strategy] = candidates.map(tp => simulateTPLevel(strategyTrades, tp));
  });

  return results;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { csvContent } = body;

    if (!csvContent) {
      return NextResponse.json(
        { success: false, error: 'No CSV content provided' },
        { status: 400 }
      );
    }

    const trades = parseCSV(csvContent);
    if (trades.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid trades found in CSV' },
        { status: 400 }
      );
    }

    const data = processUploadedData(trades);
    const globalMetrics = calculateGlobalMetrics(data);

    return NextResponse.json({
      success: true,
      data,
      strategies: Object.keys(data),
      globalMetrics,
      tradeCount: trades.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error processing CSV:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to process CSV'
      },
      { status: 400 }
    );
  }
}

export async function GET() {
  try {
    // Read the TP optimizer results from the JSON file
    const filePath = join(process.cwd(), 'data', 'tp_optimizer_results.json');
    const fileContent = readFileSync(filePath, 'utf-8');
    const data = JSON.parse(fileContent);

    // Calculate global metrics
    const strategies = Object.keys(data);
    const globalMetrics = calculateGlobalMetrics(data);

    return NextResponse.json({
      success: true,
      data,
      strategies,
      globalMetrics,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error reading TP optimizer results:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to load results'
      },
      { status: 500 }
    );
  }
}

/**
 * Calculate global metrics across all strategies
 */
function calculateGlobalMetrics(data: Record<string, TPSimulation[] | Array<Record<string, unknown>>>) {
  const strategies = Object.keys(data);
  
  if (strategies.length === 0) {
    return {
      globalBestTP: 0,
      averageExpectancy: 0,
      weightedPFChange: 0,
      topStrategies: []
    };
  }

  // Find TP that appears most beneficial across strategies
  const tpScores = new Map<number, number>();
  for (const strategy of strategies) {
    const simulations = data[strategy] as Array<Record<string, unknown>>;
    for (const sim of simulations) {
      const tp = sim.tp as number;
      const expectancy = (sim.expectancy as number) || 0;
      const current = tpScores.get(tp) || 0;
      tpScores.set(tp, current + expectancy);
    }
  }

  const globalBestTP = tpScores.size > 0
    ? Array.from(tpScores.entries()).reduce((max, curr) =>
        curr[1] > max[1] ? curr : max
      )[0]
    : 0;

  // Calculate metrics for each strategy
  const strategyMetrics = strategies.map(strategy => {
    const simulations = data[strategy] as Array<Record<string, unknown>>;
    const best = simulations.reduce((max, curr) =>
      ((curr.expectancy as number) || 0) > ((max.expectancy as number) || 0) ? curr : max
    );
    const baseline = simulations[0];

    return {
      strategy,
      bestTP: best.tp as number,
      deltaExpectancy: ((best.expectancy as number) || 0) - ((baseline?.expectancy as number) || 0),
      profitFactor: (best.profitFactor as number) || 0,
      bestExpectancy: (best.expectancy as number) || 0
    };
  });

  // Top 5 strategies by expectancy gain
  const topStrategies = strategyMetrics
    .sort((a, b) => b.deltaExpectancy - a.deltaExpectancy)
    .slice(0, 5);

  // Average expectancy gain
  const averageExpectancy = strategyMetrics.length > 0
    ? strategyMetrics.reduce((sum, s) => sum + s.deltaExpectancy, 0) / strategyMetrics.length
    : 0;

  // Weighted PF change
  const pfChanges = strategies.map(strategy => {
    const simulations = data[strategy] as Array<Record<string, unknown>>;
    const atGlobalTP = simulations.find((s) => s.tp === globalBestTP);
    return ((atGlobalTP?.profitFactor as number) || 1) - 1;
  });

  const weightedPFChange = pfChanges.length > 0
    ? pfChanges.reduce((sum, pf) => sum + pf, 0) / pfChanges.length
    : 0;

  return {
    globalBestTP,
    averageExpectancy: Math.round(averageExpectancy * 100) / 100,
    weightedPFChange: Math.round(weightedPFChange * 1000) / 1000,
    topStrategies
  };
}
