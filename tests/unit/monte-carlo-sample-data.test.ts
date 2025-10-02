import { CsvTestDataLoader } from "../data/csv-loader";
import { runMonteCarloSimulation, type MonteCarloParams } from "@/lib/calculations/monte-carlo";
import { PortfolioStatsCalculator } from "@/lib/calculations/portfolio-stats";

/**
 * Integration test that runs the Monte Carlo simulator against the real CSV sample data.
 * This acts as a regression safety net for the risk simulator when fed with actual trade history.
 */
describe("Monte Carlo Simulation (sample data)", () => {
  it("produces deterministic statistics for the provided trade log", async () => {
    const testData = await CsvTestDataLoader.loadTestData();

    expect(testData.sources.trades).toBe("csv");
    const { trades } = testData;

    const initialCapital = PortfolioStatsCalculator.calculateInitialCapital(trades);

    const params: MonteCarloParams = {
      numSimulations: 200,
      simulationLength: Math.min(120, trades.length),
      resampleMethod: "trades",
      initialCapital,
      tradesPerYear: 252,
      randomSeed: 42,
    };

    const result = runMonteCarloSimulation(trades, params);

    expect(result.statistics).toMatchInlineSnapshot(`
{
  "meanAnnualizedReturn": 2.235229716072544,
  "meanFinalValue": 42994.90899999995,
  "meanMaxDrawdown": 0.11477685263350489,
  "meanSharpeRatio": 4.283797203731172,
  "meanTotalReturn": 0.7250792426727596,
  "medianAnnualizedReturn": 2.105085191641404,
  "medianFinalValue": 42749.25999999995,
  "medianMaxDrawdown": 0.10404984223686636,
  "medianTotalReturn": 0.7152230992190466,
  "probabilityOfProfit": 0.995,
  "stdFinalValue": 6882.420354459928,
  "valueAtRisk": {
    "p10": 0.4074272251342499,
    "p25": 0.5412595532558895,
    "p5": 0.3255305046173388,
  },
}
`);
  });
});
