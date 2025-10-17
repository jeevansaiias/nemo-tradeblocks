import { readFileSync } from 'fs';
import { join } from 'path';
import { NextResponse } from 'next/server';

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
function calculateGlobalMetrics(data: Record<string, Array<Record<string, unknown>>>) {
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
    const simulations = data[strategy];
    for (const sim of simulations) {
      const current = tpScores.get(sim.tp as number) || 0;
      tpScores.set(sim.tp as number, current + ((sim.expectancy as number) || 0));
    }
  }

  const globalBestTP = tpScores.size > 0
    ? Array.from(tpScores.entries()).reduce((max, curr) =>
        curr[1] > max[1] ? curr : max
      )[0]
    : 0;

  // Calculate metrics for each strategy
  const strategyMetrics = strategies.map(strategy => {
    const simulations = data[strategy];
    const best = simulations.reduce((max: Record<string, unknown>, curr: Record<string, unknown>) =>
      ((curr.expectancy as number) || 0) > ((max.expectancy as number) || 0) ? curr : max
    );
    const baseline = simulations[0]; // First TP is baseline

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
    const simulations = data[strategy];
    const atGlobalTP = simulations.find((s: Record<string, unknown>) => s.tp === globalBestTP);
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
