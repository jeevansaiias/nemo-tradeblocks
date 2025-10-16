"use client";

import { Play, Target, TrendingUp, Calculator } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { useTPOptimizerStore } from "@/lib/stores/tp-optimizer-store";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface TPOptimizePanelProps {
  onOptimizationComplete?: () => void;
}

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

  const strategies = getStrategies();
  const scopedData = getScopedData();

  const formatTPPercentage = (tp: number) => {
    if (tp >= 1000) {
      return `${(tp / 1000).toFixed(1)}k%`;
    }
    return `${tp}%`;
  };

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
              Optimization Results Preview
            </CardTitle>
            <CardDescription>
              {getObjectiveLabel()} comparison across {candidates.length} TP candidates (1% to 15,000% range)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Quick Comparison */}
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-3 bg-muted rounded-lg">
                <div className="text-lg font-bold">{formatValue(baseline.totalPnL)}</div>
                <div className="text-xs text-muted-foreground">Baseline (Hold)</div>
              </div>
              <div className="text-center p-3 bg-green-50 dark:bg-green-950 rounded-lg">
                <div className="text-lg font-bold text-green-600">
                  {formatValue(best.totalPnL)} @ {formatTPPercentage(best.tpPct)}
                </div>
                <div className="text-xs text-green-600">Best TP</div>
              </div>
            </div>

            {/* Chart */}
            {chartData.length > 0 && (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="tp" 
                      fontSize={10}
                      angle={-45}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis fontSize={10} />
                    <Tooltip 
                      formatter={(value) => [formatValue(value as number), getObjectiveLabel()]}
                    />
                    <Bar 
                      dataKey="value" 
                      fill="#3b82f6"
                    />
                  </BarChart>
                </ResponsiveContainer>
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
    </div>
  );
}