import { CsvTestDataLoader } from "../data/csv-loader";
import { runMonteCarloSimulation, type MonteCarloParams } from "@/lib/calculations/monte-carlo";

describe("Monte Carlo legacy comparison", () => {
 it("prints stats for legacy parameter set", async () => {
    const { trades } = await CsvTestDataLoader.loadTestData();

    const params: MonteCarloParams = {
      numSimulations: 1000,
      simulationLength: Math.min(252, trades.length),
      resampleMethod: "trades",
      initialCapital: trades[0]?.fundsAtClose - trades[0]?.pl ?? 100000,
      tradesPerYear: 125,
      randomSeed: 42,
    };

    const result = runMonteCarloSimulation(trades, params);

    expect(result.statistics).toMatchInlineSnapshot(`
{
  "meanAnnualizedReturn": 0.2089488783670814,
  "meanFinalValue": 119876.67296000003,
  "meanMaxDrawdown": 0.044277455695917116,
  "meanSharpeRatio": 3.0293475211773817,
  "meanTotalReturn": 0.4681887642475115,
  "medianAnnualizedReturn": 0.20922518753821395,
  "medianFinalValue": 119753.24000000021,
  "medianMaxDrawdown": 0.04158660888462547,
  "medianTotalReturn": 0.46667701988111365,
  "probabilityOfProfit": 1,
  "stdFinalValue": 9215.531676253735,
  "valueAtRisk": {
    "p10": 0.3260851034227346,
    "p25": 0.39343872383078266,
    "p5": 0.2836944465945624,
  },
}
`);
  });
});
