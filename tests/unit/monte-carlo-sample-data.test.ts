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
  "meanAnnualizedReturn": 1.3074502002408317,
  "meanFinalValue": 735352.6545000005,
  "meanMaxDrawdown": 0.07388740419836855,
  "meanSharpeRatio": 3.5944394545765643,
  "meanTotalReturn": 0.4719719113903137,
  "medianAnnualizedReturn": 1.2222057059780882,
  "medianFinalValue": 730686.49,
  "medianMaxDrawdown": 0.06376008915186528,
  "medianTotalReturn": 0.4626315451920069,
  "probabilityOfProfit": 0.975,
  "stdFinalValue": 107571.26551833487,
  "valueAtRisk": {
    "p10": 0.1801627264228324,
    "p25": 0.3445487072716335,
    "p5": 0.10379656086469356,
  },
}
`);
  });
});
