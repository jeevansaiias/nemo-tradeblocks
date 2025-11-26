"use client";

import { useState, useMemo } from "react";
import { Calculator, Play, Settings2, TrendingUp, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ExcursionTrade,
  MultiTPScenarioResult,
  runMultiTPGridSearch,
  runAutoMultiTPGridSearch,
  computeBaselineMetrics,
  scoreScenarioRelative,
  MultiTPRule,
  ExitBasis
} from "@/lib/calculations/multi-tp-optimizer";

function computeTotalBasis(trades: ExcursionTrade[], basis: ExitBasis): number {
  return trades.reduce((sum, trade) => {
    const value = basis === "premium" ? trade.premium : trade.marginReq;
    return sum + Math.max(0, value || 0);
  }, 0);
}

interface ScoredScenario extends MultiTPScenarioResult {
  score: number;
  deltaPL: number;
  deltaCapture: number;
  deltaDrawdown: number;
}

interface MultiTPOptimizerPanelProps {
  trades: ExcursionTrade[];
  startingCapital: number;
}

export function MultiTPOptimizerPanel({ trades, startingCapital }: MultiTPOptimizerPanelProps) {
  // Mode State
  const [mode, setMode] = useState<"auto" | "manual">("auto");

  // Configuration State
  const [basis, setBasis] = useState<ExitBasis>("margin");
  
  // Auto Mode State
  const [tpMin, setTpMin] = useState<string>("20");
  const [tpMax, setTpMax] = useState<string>("140");
  const [tpStep, setTpStep] = useState<string>("20");
  
  const [slMin, setSlMin] = useState<string>("-10");
  const [slMax, setSlMax] = useState<string>("-50");
  const [slStep, setSlStep] = useState<string>("-10");
  
  const [maxTargets, setMaxTargets] = useState<1 | 2 | 3>(3);

  // Manual Mode State - TP1
  const [tp1Level, setTp1Level] = useState<string>("40");
  const [tp1Fraction, setTp1Fraction] = useState<string>("0.25");
  
  // TP2
  const [tp2Level, setTp2Level] = useState<string>("80");
  const [tp2Fraction, setTp2Fraction] = useState<string>("0.25");
  
  // TP3
  const [tp3Level, setTp3Level] = useState<string>("120");
  const [tp3Fraction, setTp3Fraction] = useState<string>("0.25");
  
  // Stop Loss (Manual)
  const [stopLoss, setStopLoss] = useState<string>("-30");

  // Results State
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [results, setResults] = useState<ScoredScenario[]>([]);
  const [baseline, setBaseline] = useState<MultiTPScenarioResult | null>(null);

  const totalBasis = useMemo(() => computeTotalBasis(trades, basis), [trades, basis]);
  const baselineCaptureUI = baseline && totalBasis > 0
    ? (baseline.totalPL / totalBasis) * 100
    : baseline?.captureRate ?? 0;

  const handleUseDefaults = () => {
    if (mode === "auto") {
      setTpMin("20");
      setTpMax("140");
      setTpStep("20");
      setSlMin("-10");
      setSlMax("-50");
      setSlStep("-10");
      setMaxTargets(3);
    } else {
      setTp1Level("40");
      setTp1Fraction("0.25");
      setTp2Level("80");
      setTp2Fraction("0.25");
      setTp3Level("120");
      setTp3Fraction("0.25");
      setStopLoss("-30");
    }
  };

  const handleRunOptimization = async () => {
    if (trades.length === 0) return;
    
    setIsOptimizing(true);
    setResults([]); // Clear previous results
    
    // Allow UI to update before heavy calculation
    setTimeout(() => {
      try {
        // 1. Compute Baseline
        const baselineMetrics = computeBaselineMetrics(trades, basis, startingCapital);
        setBaseline(baselineMetrics);

        let rawScenarios: MultiTPScenarioResult[] = [];

        if (mode === "auto") {
          rawScenarios = runAutoMultiTPGridSearch(trades, {
            basis,
            startingCapital,
            tpMin: parseFloat(tpMin),
            tpMax: parseFloat(tpMax),
            tpStep: parseFloat(tpStep),
            slMin: parseFloat(slMin),
            slMax: parseFloat(slMax),
            slStep: parseFloat(slStep),
            maxTargets
          });
        } else {
          // Manual Mode Logic
          const tp1 = parseFloat(tp1Level);
          const f1 = parseFloat(tp1Fraction);
          const tp2 = parseFloat(tp2Level);
          const f2 = parseFloat(tp2Fraction);
          const tp3 = parseFloat(tp3Level);
          const f3 = parseFloat(tp3Fraction);
          const sl = parseFloat(stopLoss);

          // Build grid config around user inputs (±10% range for levels)
          const config = {
            basis,
            startingCapital,
            tp1Levels: [tp1 * 0.9, tp1, tp1 * 1.1].map(n => Math.round(n)),
            tp2Levels: [tp2 * 0.9, tp2, tp2 * 1.1].map(n => Math.round(n)),
            tp3Levels: [tp3 * 0.9, tp3, tp3 * 1.1].map(n => Math.round(n)),
            
            tp1Fractions: [f1],
            tp2Fractions: [f2],
            tp3Fractions: [f3],
            
            tp1TrailStops: [0, 10],
            tp2TrailStops: [10, 20],
            tp3TrailStops: [20, 30],
            
            stopLossLevels: [sl, sl - 10, sl + 10].filter(n => n < 0),
            
            maxDrawdownConstraintPct: 50,
            minWinRatePct: 0
          };

          rawScenarios = runMultiTPGridSearch(trades, config);
        }
        
        // 2. Score Scenarios Relative to Baseline
        const scoredScenarios: ScoredScenario[] = rawScenarios.map(s => {
          const scoring = scoreScenarioRelative(baselineMetrics, s);
          return {
            ...s,
            score: scoring.score,
            deltaPL: scoring.deltaPL,
            deltaCapture: scoring.deltaCapture,
            deltaDrawdown: scoring.deltaDrawdown
          };
        });

        // 3. Sort by Score
        scoredScenarios.sort((a, b) => b.score - a.score);

        setResults(scoredScenarios);
      } catch (error) {
        console.error("Optimization failed:", error);
      } finally {
        setIsOptimizing(false);
      }
    }, 100);
  };

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);

  const describeRule = (rule: MultiTPRule) => {
    if (!rule.takeProfits.length) return `SL ${rule.stopLossPct}%`;
    
    const tps = rule.takeProfits.map((tp, i) => 
      `TP${i+1}: ${tp.levelPct}% (${(tp.closeFraction * 100).toFixed(0)}%)`
    ).join(" / ");
    
    return `${tps} | SL ${rule.stopLossPct}%`;
  };

  if (trades.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="pt-6 text-center space-y-4">
          <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center">
            <AlertCircle className="h-6 w-6 text-muted-foreground" />
          </div>
          <div>
            <h3 className="font-semibold">No Trade Data Available</h3>
            <p className="text-sm text-muted-foreground">
              Please load a backtest or excursion dataset to use the Multi-TP Optimizer.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Calculator className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle>Multi-TP Exit Optimizer (Experimental)</CardTitle>
              <CardDescription>
                Simulate scaling out at multiple take-profit levels with trailing stops using MFE/MAE data.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Controls */}
          <div className="space-y-6">
            {/* Mode Selection */}
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label>Optimization Mode</Label>
                <p className="text-xs text-muted-foreground">
                  Choose how to find the best exit strategy.
                </p>
              </div>
              <Tabs value={mode} onValueChange={(v) => setMode(v as "auto" | "manual")} className="w-[400px]">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="auto">Auto Search</TabsTrigger>
                  <TabsTrigger value="manual">Manual Scenario</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {/* Basis Selection */}
            <div className="space-y-3">
              <Label>Optimization Basis</Label>
              <div className="flex gap-2 max-w-md">
                <Button 
                  variant={basis === "margin" ? "default" : "outline"}
                  onClick={() => setBasis("margin")}
                  className="flex-1"
                >
                  Margin
                </Button>
                <Button 
                  variant={basis === "premium" ? "default" : "outline"}
                  onClick={() => setBasis("premium")}
                  className="flex-1"
                >
                  Premium
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Determines the denominator for % return calculations.
              </p>
            </div>

            {mode === "auto" ? (
              /* Auto Mode Controls */
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 border-t pt-6">
                <div className="space-y-3">
                  <Label>TP Range (%)</Label>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <span className="text-xs text-muted-foreground">Min</span>
                      <Input type="number" value={tpMin} onChange={(e) => setTpMin(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <span className="text-xs text-muted-foreground">Max</span>
                      <Input type="number" value={tpMax} onChange={(e) => setTpMax(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <span className="text-xs text-muted-foreground">Step</span>
                      <Input type="number" value={tpStep} onChange={(e) => setTpStep(e.target.value)} />
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <Label>SL Range (%)</Label>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <span className="text-xs text-muted-foreground">Min</span>
                      <Input type="number" value={slMin} onChange={(e) => setSlMin(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <span className="text-xs text-muted-foreground">Max</span>
                      <Input type="number" value={slMax} onChange={(e) => setSlMax(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <span className="text-xs text-muted-foreground">Step</span>
                      <Input type="number" value={slStep} onChange={(e) => setSlStep(e.target.value)} />
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <Label>Max Targets</Label>
                  <div className="flex gap-2">
                    {[1, 2, 3].map((n) => (
                      <Button
                        key={n}
                        variant={maxTargets === n ? "default" : "outline"}
                        onClick={() => setMaxTargets(n as 1 | 2 | 3)}
                        className="flex-1"
                      >
                        {n}
                      </Button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Allow up to {maxTargets} scale-out levels.
                  </p>
                </div>
              </div>
            ) : (
              /* Manual Mode Controls */
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 border-t pt-6">
                {/* TP1 Config */}
                <div className="space-y-3">
                  <Label className="flex items-center gap-2">
                    <Badge variant="outline" className="h-5">TP1</Badge>
                    First Target
                  </Label>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <span className="text-xs text-muted-foreground">Level %</span>
                      <Input 
                        type="number" 
                        value={tp1Level} 
                        onChange={(e) => setTp1Level(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <span className="text-xs text-muted-foreground">Fraction (0-1)</span>
                      <Input 
                        type="number" 
                        step="0.05"
                        max="1"
                        value={tp1Fraction} 
                        onChange={(e) => setTp1Fraction(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                {/* TP2 Config */}
                <div className="space-y-3">
                  <Label className="flex items-center gap-2">
                    <Badge variant="outline" className="h-5">TP2</Badge>
                    Second Target
                  </Label>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <span className="text-xs text-muted-foreground">Level %</span>
                      <Input 
                        type="number" 
                        value={tp2Level} 
                        onChange={(e) => setTp2Level(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <span className="text-xs text-muted-foreground">Fraction (0-1)</span>
                      <Input 
                        type="number" 
                        step="0.05"
                        max="1"
                        value={tp2Fraction} 
                        onChange={(e) => setTp2Fraction(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                {/* TP3 Config */}
                <div className="space-y-3">
                  <Label className="flex items-center gap-2">
                    <Badge variant="outline" className="h-5">TP3</Badge>
                    Third Target
                  </Label>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <span className="text-xs text-muted-foreground">Level %</span>
                      <Input 
                        type="number" 
                        value={tp3Level} 
                        onChange={(e) => setTp3Level(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <span className="text-xs text-muted-foreground">Fraction (0-1)</span>
                      <Input 
                        type="number" 
                        step="0.05"
                        max="1"
                        value={tp3Fraction} 
                        onChange={(e) => setTp3Fraction(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                {/* Stop Loss (Manual) */}
                <div className="space-y-3">
                  <Label>Stop Loss %</Label>
                  <Input 
                    type="number" 
                    value={stopLoss} 
                    onChange={(e) => setStopLoss(e.target.value)}
                    className="text-red-600 font-medium"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-col md:flex-row gap-6 items-end border-t pt-6">
            <div className="flex gap-2 ml-auto">
              <Button variant="outline" onClick={handleUseDefaults} className="gap-2">
                <Settings2 className="h-4 w-4" />
                Use Defaults
              </Button>
              <Button onClick={handleRunOptimization} disabled={isOptimizing} className="gap-2 min-w-[140px]">
                {isOptimizing ? (
                  "Optimizing..."
                ) : (
                  <>
                    <Play className="h-4 w-4" />
                    Run Optimization
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results Table */}
      {results.length > 0 && baseline && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
              Top Scenarios
            </CardTitle>
            <CardDescription>
              Showing top {Math.min(results.length, 10)} results based on <span className="font-medium">baseline-adjusted performance score</span> (Total P/L, Capture Rate, Max DD).
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Best Result Summary */}
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 mb-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
                    Best Configuration Found
                  </p>
                  <p className="text-lg font-semibold mt-1">
                    {describeRule(results[0].rule)}
                  </p>
                  <div className="text-xs text-muted-foreground space-x-2 mt-1">
                    <span>Baseline P/L: {formatCurrency(baseline.totalPL)}</span>
                    <span>•</span>
                    <span>Baseline Capture: {baselineCaptureUI.toFixed(2)}%</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-green-600">
                    {formatCurrency(results[0].totalPL)}
                  </p>
                  <div className="mt-1 text-sm space-x-2">
                    <span>
                      Δ P/L:{" "}
                      <span className={results[0].deltaPL >= 0 ? "text-emerald-600" : "text-red-600"}>
                        {formatCurrency(results[0].deltaPL)}
                      </span>
                    </span>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-amber-500/20">
                <div>
                  <span className="text-xs text-muted-foreground">Win Rate</span>
                  <p className="font-medium">{results[0].winRate.toFixed(1)}%</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Capture Rate</span>
                  {(() => {
                    const best = results[0];
                    const bestCaptureUI = totalBasis > 0 ? (best.totalPL / totalBasis) * 100 : best.captureRate;
                    const deltaCaptureUI = bestCaptureUI - baselineCaptureUI;

                    return (
                      <div className="flex items-baseline gap-1">
                        <p className="font-medium">{bestCaptureUI.toFixed(2)}%</p>
                        <span className={`text-xs ${deltaCaptureUI >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                          ({deltaCaptureUI >= 0 ? "+" : ""}{deltaCaptureUI.toFixed(2)})
                        </span>
                      </div>
                    );
                  })()}
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Max Drawdown</span>
                  <div className="flex items-baseline gap-1">
                    <p className="font-medium text-red-600">{results[0].maxDrawdownPct.toFixed(1)}%</p>
                    <span className={`text-xs ${results[0].deltaDrawdown >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                      ({results[0].deltaDrawdown >= 0 ? "+" : ""}{results[0].deltaDrawdown.toFixed(1)}%)
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rank</TableHead>
                  <TableHead>Rule Summary</TableHead>
                  <TableHead className="text-right">Capture Rate</TableHead>
                  <TableHead className="text-right">Win Rate</TableHead>
                  <TableHead className="text-right">Max DD</TableHead>
                  <TableHead className="text-right">Total P/L</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.slice(0, 10).map((result, idx) => (
                  <TableRow key={idx} className={idx === 0 ? "bg-muted/50" : ""}>
                    <TableCell className="font-medium">
                      {idx === 0 ? (
                        <Badge className="bg-green-600">Best</Badge>
                      ) : (
                        `#${idx + 1}`
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {describeRule(result.rule)}
                    </TableCell>
                    <TableCell className="text-right">
                      {(totalBasis > 0 ? (result.totalPL / totalBasis) * 100 : result.captureRate).toFixed(2)}%
                    </TableCell>
                    <TableCell className="text-right">
                      {result.winRate.toFixed(1)}%
                    </TableCell>
                    <TableCell className="text-right text-red-600">
                      {result.maxDrawdownPct.toFixed(1)}%
                    </TableCell>
                    <TableCell className={`text-right font-medium ${result.totalPL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(result.totalPL)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
