import { CsvTestDataLoader } from "../data/csv-loader";
import { runMonteCarloSimulation, type MonteCarloParams } from "@/lib/calculations/monte-carlo";

describe("Monte Carlo legacy comparison", () => {
 it("prints stats for legacy parameter set", async () => {
    const { trades } = await CsvTestDataLoader.loadTestData();

    const params: MonteCarloParams = {
      numSimulations: 1000,
      simulationLength: Math.min(252, trades.length),
      resampleMethod: "trades",
      initialCapital: trades[0] ? trades[0].fundsAtClose - trades[0].pl : 100000,
      tradesPerYear: 125,
      randomSeed: 42,
    };

    const result = runMonteCarloSimulation(trades, params);

    expect(result.statistics).toMatchInlineSnapshot(`
{
  "meanAnnualizedReturn": 0.13867884101856834,
  "meanFinalValue": 2188854.2997999983,
  "meanMaxDrawdown": 0.029376660624827317,
  "meanSharpeRatio": 2.55361078539622,
  "meanTotalReturn": 0.300641413869577,
  "medianAnnualizedReturn": 0.13982832259955802,
  "medianFinalValue": 2191026.3899999997,
  "medianMaxDrawdown": 0.02720128093515751,
  "medianTotalReturn": 0.3019320938700867,
  "probabilityOfProfit": 1,
  "stdFinalValue": 140614.83406927538,
  "valueAtRisk": {
    "p10": 0.1914275655481033,
    "p25": 0.2453121680031447,
    "p5": 0.16704045354370586,
  },
}
`);
  });
});
