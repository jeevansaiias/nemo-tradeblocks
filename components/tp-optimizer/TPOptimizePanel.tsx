"use client";

import { useMemo } from "react";
import { Play, Target, TrendingUp, Calculator } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useTPOptimizerStore } from "@/lib/stores/tp-optimizer-store";
import type { TradeRecord } from "@/lib/stores/tp-optimizer-store";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { formatCurrency } from "@/lib/utils";
import {
  TPOptimizerTrade,
  TPSLScenarioConfig,
  TPSLScenarioResult,
  evaluateScenarios,
  findBestScenario,
  generateBestScenariosFromExcursions,
} from "./tpOptimizerCore";

interface TPOptimizePanelProps {
  onOptimizationComplete?: () => void;
}

type ScenarioRow = TPSLScenarioResult & {
  scenarioLabel: string;
  source: "auto" | "custom";
};

type ExtendedTradeRecord = TradeRecord & {
  id?: string | number;
  marginUsed?: number;
  marginReq?: number;
  realizedPL?: number;
  pl?: number;
  mfePctMargin?: number;
  maePctMargin?: number;
};

const DEFAULT_CUSTOM_SCENARIOS: TPSLScenarioConfig[] = [
  { id: "scenario-1", basis: "margin", tpPct: 15, slPct: -5 },
  { id: "scenario-2", basis: "margin", tpPct: 25, slPct: -10 },
  { id: "scenario-3", basis: "margin", tpPct: 35, slPct: -15 },
];

const formatPercentValue = (value: number, digits = 2, withSign = false) => {
  if (!Number.isFinite(value)) return "–";
  const formatted = value.toFixed(digits);
  if (!withSign) return `${formatted}%`;
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${formatted}%`;
};

const formatCurrencyValue = (value: number) => {
  if (!Number.isFinite(value)) return "–";
  return formatCurrency(value);
};

export function TPOptimizePanel({ onOptimizationComplete }: TPOptimizePanelProps) {
  const {
    data,
    objective,
    scope,
    selectedStrategy,
    candidates,
    results,
    baseline,
    best,
    isOptimizing,
    error,
    setObjective,
    setScope,
    setSelectedStrategy,
    runOptimization,
    setActiveTab,
    getStrategies,
    getScopedData
  } = useTPOptimizerStore();

  // Define all helper functions first
  const formatTPPercentage = (tp: number) => {
    if (tp >= 1000) {
      return `${(tp / 1000).toFixed(1)}k%`;
    }
    return `${tp}%`;
  };

  const getObjectiveLabel = () => {
    switch (objective) {
      case "totalPnL": return "Total P&L";
      case "expectancy": return "Expectancy";
      case "profitFactor": return "Profit Factor";
      default: return "Metric";
    }
  };

  const formatValue = (value: number) => {
    if (objective === "totalPnL" || objective === "expectancy") {
      return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
    }
    if (objective === "profitFactor") {
      if (value === Number.POSITIVE_INFINITY) return "∞";
      return value.toFixed(2);
    }
    return value.toFixed(2);
  };

  // Then compute derived values
  const strategies = getStrategies();
  const scopedData = getScopedData();

  const optimizerTrades = useMemo<TPOptimizerTrade[]>(() => {
    return scopedData
      .map((trade, index) => {
        const enriched = trade as ExtendedTradeRecord;
        const marginCandidateRaw =
          typeof enriched.marginUsed === "number"
            ? enriched.marginUsed
            : typeof enriched.marginReq === "number"
              ? enriched.marginReq
              : undefined;

        const marginUsed =
          marginCandidateRaw && Number.isFinite(marginCandidateRaw) && marginCandidateRaw !== 0
            ? Math.abs(marginCandidateRaw)
            : 100;

        const realizedPL = (() => {
          if (typeof enriched.realizedPL === "number") {
            return enriched.realizedPL;
          }
          if (typeof enriched.pl === "number") {
            return enriched.pl;
          }
          if (typeof trade.resultPct === "number") {
            return (trade.resultPct / 100) * marginUsed;
          }
          return 0;
        })();

        const rawMfe =
          typeof enriched.mfePctMargin === "number"
            ? enriched.mfePctMargin
            : typeof trade.maxProfitPct === "number"
              ? trade.maxProfitPct
              : 0;

        const rawMae =
          typeof enriched.maePctMargin === "number"
            ? enriched.maePctMargin
            : typeof trade.maxLossPct === "number"
              ? trade.maxLossPct
              : 0;

        return {
          id: enriched.id ?? `${trade.strategy || "trade"}-${index}`,
          realizedPL: Number.isFinite(realizedPL) ? realizedPL : 0,
          marginUsed,
          mfePctMargin: Number.isFinite(rawMfe) ? Math.max(0, rawMfe) : 0,
          maePctMargin: Number.isFinite(rawMae)
            ? rawMae <= 0
              ? rawMae
              : -Math.abs(rawMae)
            : 0,
        } satisfies TPOptimizerTrade;
      })
      .filter((trade) => trade.marginUsed > 0);
  }, [scopedData]);

  const autoScenarioResults = useMemo<ScenarioRow[]>(() => {
    if (optimizerTrades.length === 0) return [];
    return generateBestScenariosFromExcursions(optimizerTrades, { step: 5, topN: 3 }).map((result, index) => ({
      ...result,
      scenarioLabel: `Auto ${index + 1}`,
      source: "auto",
    }));
  }, [optimizerTrades]);

  const customScenarioResults = useMemo<ScenarioRow[]>(() => {
    if (optimizerTrades.length === 0) return [];
    return evaluateScenarios(optimizerTrades, DEFAULT_CUSTOM_SCENARIOS).map((result, index) => ({
      ...result,
      scenarioLabel: `Scenario ${index + 1}`,
      source: "custom",
    }));
  }, [optimizerTrades]);

  const scenarioResults = useMemo<ScenarioRow[]>(
    () => [...autoScenarioResults, ...customScenarioResults],
    [autoScenarioResults, customScenarioResults]
  );

  const baselineScenario = useMemo(() => {
    if (optimizerTrades.length === 0) {
      return { totalReturnPct: 0, totalPL: 0 };
    }

    let totalReturnPct = 0;
    let totalPL = 0;

    optimizerTrades.forEach((trade) => {
      if (!trade.marginUsed) return;
      const returnPct = (trade.realizedPL / trade.marginUsed) * 100;
      if (Number.isFinite(returnPct)) totalReturnPct += returnPct;
      if (Number.isFinite(trade.realizedPL)) totalPL += trade.realizedPL;
    });

    return { totalReturnPct, totalPL };
  }, [optimizerTrades]);

  const bestScenarioInsight = useMemo(() => {
    if (scenarioResults.length === 0) return null;
    return findBestScenario(scenarioResults, baselineScenario);
  }, [scenarioResults, baselineScenario]);

  const bestScenarioId = bestScenarioInsight?.best.id;

  const handleOptimize = async () => {
    await runOptimization();
    if (!error) {
      setTimeout(() => {
        setActiveTab("summary");
        onOptimizationComplete?.();
      }, 1000);
    }
  };

  const chartData = results.map(result => ({
    tp: formatTPPercentage(result.tpPct),
    tpRaw: result.tpPct,
    value: objective === "totalPnL" ? result.totalPnL :
           objective === "expectancy" ? result.expectancy :
           result.profitFactor,
    isBest: best && result.tpPct === best.tpPct
  }));

  if (data.length === 0) {
    return (
      <Alert>
        <AlertDescription>
          No trading data available. Please upload your CSV file first.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Optimization Configuration */}
      <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                <Target className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
            <div className="space-y-4 flex-1">
              <div>
                <h3 className="font-semibold text-sm text-blue-900 dark:text-blue-100">
                  🎯 Auto Take-Profit Optimization
                </h3>
                <p className="text-xs text-blue-800 dark:text-blue-200">
                  Auto-TP tests every possible TP% from 1% to 15,000% using your Max Profit % data to find if any outperforms your baseline results. Stop-loss behavior remains unchanged. This comprehensive analysis may take a moment to complete.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Scope Selection */}
                <div className="space-y-2">
                  <Label htmlFor="scope">Analysis Scope</Label>
                  <Select value={scope} onValueChange={(value: "overall" | "byStrategy") => setScope(value)}>
                    <SelectTrigger id="scope">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="overall">
                        <div className="flex items-center gap-2">
                          <Target className="h-4 w-4" />
                          Overall (All Strategies)
                        </div>
                      </SelectItem>
                      <SelectItem value="byStrategy">
                        <div className="flex items-center gap-2">
                          <Calculator className="h-4 w-4" />
                          By Strategy
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Strategy Selection (only if byStrategy scope) */}
                {scope === "byStrategy" && (
                  <div className="space-y-2">
                    <Label htmlFor="strategy">Select Strategy</Label>
                    <Select value={selectedStrategy || ""} onValueChange={(value) => setSelectedStrategy(value || undefined)}>
                      <SelectTrigger id="strategy">
                        <SelectValue placeholder="Choose strategy" />
                      </SelectTrigger>
                      <SelectContent>
                        {strategies.map(strategy => (
                          <SelectItem key={strategy} value={strategy}>
                            {strategy}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Objective Selection */}
                <div className="space-y-2">
                  <Label htmlFor="objective">Optimization Objective</Label>
                  <Select value={objective} onValueChange={(value: "totalPnL" | "expectancy" | "profitFactor") => setObjective(value)}>
                    <SelectTrigger id="objective">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="totalPnL">
                        <div className="flex items-center gap-2">
                          <TrendingUp className="h-4 w-4" />
                          Total P&L
                        </div>
                      </SelectItem>
                      <SelectItem value="expectancy">
                        <div className="flex items-center gap-2">
                          <Calculator className="h-4 w-4" />
                          Expectancy
                        </div>
                      </SelectItem>
                      <SelectItem value="profitFactor">
                        <div className="flex items-center gap-2">
                          <Target className="h-4 w-4" />
                          Profit Factor
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Data Summary */}
              <div className="space-y-2">
                <Label>Current Data Summary</Label>
                <div className="flex gap-2 flex-wrap">
                  <Badge variant="outline">{scopedData.length} trades {scope === "byStrategy" && selectedStrategy ? `(${selectedStrategy})` : "(all strategies)"}</Badge>
                  <Badge variant="outline">{scope === "overall" ? new Set(data.map(t => t.strategy)).size : 1} strategies</Badge>
                  {scope === "byStrategy" && !selectedStrategy && (
                    <Badge variant="destructive">Select strategy to continue</Badge>
                  )}
                </div>
              </div>

              <Button 
                onClick={handleOptimize}
                disabled={isOptimizing || scopedData.length === 0 || (scope === "byStrategy" && !selectedStrategy)}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white gap-2"
                size="lg"
              >
                <Play className="h-4 w-4" />
                {isOptimizing ? "Optimizing..." : "🚀 Optimize Take-Profit"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Progress */}
      {isOptimizing && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Analyzing take-profit scenarios...</span>
                <span>Finding optimal level</span>
              </div>
              <Progress value={undefined} className="h-2" />
              <p className="text-xs text-muted-foreground">
                Testing all TP levels from 1% to 15,000% on {scopedData.length} trades to find the absolute best {getObjectiveLabel().toLowerCase()} {scope === "byStrategy" && selectedStrategy ? `for ${selectedStrategy}` : "(overall)"}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error Display */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Results Preview */}
      {results.length > 0 && baseline && best && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart className="h-5 w-5" />
              Complete Performance Analysis
            </CardTitle>
            <CardDescription>
              {getObjectiveLabel()} across ALL {candidates.length} TP candidates (1% to 15,000% range)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Comprehensive Summary */}
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-3 bg-muted rounded-lg">
                <div className="text-lg font-bold">{formatValue(baseline.totalPnL)}</div>
                <div className="text-xs text-muted-foreground">Baseline (Hold)</div>
                <div className="text-xs text-muted-foreground">No TP Used</div>
              </div>
              <div className="text-center p-3 bg-green-50 dark:bg-green-950 rounded-lg">
                <div className="text-lg font-bold text-green-600">
                  {formatValue(best.totalPnL)}
                </div>
                <div className="text-xs text-green-600">Peak Performance</div>
                <div className="text-xs text-green-600">@ {formatTPPercentage(best.tpPct)} TP</div>
              </div>
              <div className="text-center p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
                <div className="text-lg font-bold text-blue-600">
                  {formatValue(best.totalPnL - baseline.totalPnL)}
                </div>
                <div className="text-xs text-blue-600">Improvement</div>
                <div className="text-xs text-blue-600">vs Baseline</div>
              </div>
            </div>

            {/* Performance Curve Chart */}
            {chartData.length > 0 && (
              <div className="space-y-4">
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="tpRaw" 
                        type="number"
                        domain={['dataMin', 'dataMax']}
                        fontSize={10}
                        tickFormatter={(value) => formatTPPercentage(value)}
                        label={{ value: 'Take-Profit %', position: 'insideBottom', offset: -10 }}
                      />
                      <YAxis 
                        fontSize={10}
                        label={{ value: getObjectiveLabel(), angle: -90, position: 'insideLeft' }}
                      />
                      <Tooltip 
                        formatter={(value) => [formatValue(value as number), getObjectiveLabel()]}
                        labelFormatter={(label) => `TP: ${formatTPPercentage(label as number)}`}
                      />
                      <Bar 
                        dataKey="value" 
                        fill="#3b82f6"
                        stroke="#2563eb"
                        strokeWidth={1}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                
                {/* Chart Statistics */}
                <div className="grid grid-cols-4 gap-2 text-xs bg-muted/50 p-3 rounded">
                  <div className="text-center">
                    <div className="font-semibold">{candidates.length}</div>
                    <div className="text-muted-foreground">TP Levels Tested</div>
                  </div>
                  <div className="text-center">
                    <div className="font-semibold">{formatTPPercentage(Math.min(...candidates))}</div>
                    <div className="text-muted-foreground">Min TP</div>
                  </div>
                  <div className="text-center">
                    <div className="font-semibold">{formatTPPercentage(Math.max(...candidates))}</div>
                    <div className="text-muted-foreground">Max TP</div>
                  </div>
                  <div className="text-center">
                    <div className="font-semibold text-red-600">{formatTPPercentage(best.tpPct)}</div>
                    <div className="text-muted-foreground">Peak TP</div>
                  </div>
                </div>
                
                {/* Debug Information */}
                <details className="text-xs">
                  <summary className="cursor-pointer font-medium text-muted-foreground hover:text-foreground">
                    🔍 Debug: Optimization Details
                  </summary>
                  <div className="mt-2 p-3 bg-muted/30 rounded space-y-2">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <strong>Testing Verification:</strong>
                        <div>• Total candidates generated: {candidates.length}</div>
                        <div>• Total results computed: {results.length}</div>
                        <div>• Range: {formatTPPercentage(Math.min(...candidates))} - {formatTPPercentage(Math.max(...candidates))}</div>
                      </div>
                      <div>
                        <strong>Performance Distribution:</strong>
                        <div>• Results above baseline: {results.filter(r => r.totalPnL > baseline.totalPnL).length}</div>
                        <div>• Results at baseline: {results.filter(r => Math.abs(r.totalPnL - baseline.totalPnL) < 0.01).length}</div>
                        <div>• Results below baseline: {results.filter(r => r.totalPnL < baseline.totalPnL).length}</div>
                      </div>
                    </div>
                    <div>
                      <strong>Top 5 TP Levels:</strong>
                      {results
                        .slice()
                        .sort((a, b) => b.totalPnL - a.totalPnL)
                        .slice(0, 5)
                        .map((result, i) => (
                          <div key={i} className="ml-2">
                            #{i + 1}: {formatTPPercentage(result.tpPct)} → {formatValue(result.totalPnL)}
                          </div>
                        ))}
                    </div>
                  </div>
                </details>
              </div>
            )}

            <div className="flex justify-center">
              <Button onClick={() => setActiveTab("summary")}>
                View Detailed Results
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {optimizerTrades.length > 0 && (
        <Card>
          <CardHeader>
            <div className="space-y-1">
              <CardTitle>TP/SL Scenario Grid (MFE/MAE)</CardTitle>
              <CardDescription>
                Auto-generated take-profit / stop-loss pairs evaluated against {optimizerTrades.length} trades.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {bestScenarioInsight && (
              <div className="mb-2 text-sm text-muted-foreground space-y-1">
                <div className="font-medium text-foreground">
                  Best: TP {formatPercentValue(bestScenarioInsight.best.tpPct, 0)} / SL {formatPercentValue(bestScenarioInsight.best.slPct, 0)} (margin)
                </div>
                <div>
                  Δ Return: {formatPercentValue(bestScenarioInsight.deltaReturnPct, 2, true)} • Δ P/L: {formatCurrencyValue(bestScenarioInsight.deltaPL)}
                </div>
              </div>
            )}

            {scenarioResults.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Scenario</TableHead>
                      <TableHead>Basis</TableHead>
                      <TableHead>TP %</TableHead>
                      <TableHead>SL %</TableHead>
                      <TableHead>Win Rate</TableHead>
                      <TableHead>Avg Return</TableHead>
                      <TableHead>Total Return</TableHead>
                      <TableHead>Total P/L</TableHead>
                      <TableHead>TP Hits</TableHead>
                      <TableHead>SL Hits</TableHead>
                      <TableHead>Trades</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {scenarioResults.map((row) => {
                      const isBest = row.id === bestScenarioId;
                      return (
                        <TableRow
                          key={`${row.id}-${row.source}`}
                          className={isBest ? "bg-green-50 text-green-900 dark:bg-green-950/40" : undefined}
                        >
                          <TableCell className="font-medium">
                            <div className="flex flex-col">
                              <span>{row.scenarioLabel}</span>
                              <span className="text-xs text-muted-foreground capitalize">
                                {row.source === "auto" ? "Auto grid" : "Preset"}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="capitalize">{row.basis}</TableCell>
                          <TableCell>{formatPercentValue(row.tpPct, 0)}</TableCell>
                          <TableCell>{formatPercentValue(row.slPct, 0)}</TableCell>
                          <TableCell>{formatPercentValue(row.winRate, 1)}</TableCell>
                          <TableCell>{formatPercentValue(row.avgReturnPct, 2)}</TableCell>
                          <TableCell>{formatPercentValue(row.totalReturnPct, 2, true)}</TableCell>
                          <TableCell>{formatCurrencyValue(row.totalPL)}</TableCell>
                          <TableCell>{row.tpHits}</TableCell>
                          <TableCell>{row.slHits}</TableCell>
                          <TableCell>{row.trades}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                  <TableCaption className="text-left">
                    Combines auto-discovered grids with default scenarios to benchmark exit rules using excursion data.
                  </TableCaption>
                </Table>
              </div>
            ) : (
              <div className="rounded-md border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
                Not enough excursion data to build TP/SL scenarios yet.
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}