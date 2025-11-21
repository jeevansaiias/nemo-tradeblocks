"use client";

import { useMemo } from "react";
import { Target, BarChart3, Trophy } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useTPOptimizerStore } from "@/lib/stores/tp-optimizer-store";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export function TPSummary() {
  const { data, baseline, best, results, candidates, objective, scope, selectedStrategy } = useTPOptimizerStore();

  const summaryData = useMemo(() => {
    if (!baseline || !best || results.length === 0) return null;

    // Calculate improvement
    const improvement = ((best.totalPnL - baseline.totalPnL) / Math.abs(baseline.totalPnL)) * 100;
    const winRateImprovement = (best.winRate - baseline.winRate) * 100;

    // Prepare chart data
    const chartData = results.map(result => ({
      tpPct: result.tpPct,
      totalPnL: result.totalPnL,
      expectancy: result.expectancy,
      profitFactor: result.profitFactor,
      isBest: result.tpPct === best.tpPct
    }));

    // Top 5 results
    const sortedResults = [...results].sort((a, b) => {
      switch (objective) {
        case "totalPnL": return b.totalPnL - a.totalPnL;
        case "expectancy": return b.expectancy - a.expectancy;
        case "profitFactor": return b.profitFactor - a.profitFactor;
        default: return 0;
      }
    }).slice(0, 5);

    return {
      improvement,
      winRateImprovement,
      chartData,
      sortedResults
    };
  }, [baseline, best, results, objective]);

  const formatPercentage = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  const formatCurrency = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  const formatMetric = (value: number) => {
    if (value === Number.POSITIVE_INFINITY) return "∞";
    return value.toFixed(2);
  };

  const formatTPPercentage = (tp: number) => {
    if (tp >= 1000) {
      return `${(tp / 1000).toFixed(1)}k%`;
    }
    return `${tp}%`;
  };

  const generateNarrative = () => {
    if (!baseline || !best || !summaryData) return "";

    const tpLevel = formatTPPercentage(best.tpPct);
    const improvement = summaryData.improvement;
    const winRateChange = summaryData.winRateImprovement;
    const scopeText = scope === "byStrategy" && selectedStrategy ? ` for ${selectedStrategy}` : " overall";

    if (improvement <= 0) {
      return `Auto-TP analysis shows that your baseline (actual results) strategy outperforms take-profit exits${scopeText}. Keeping your current exit rules may be better than implementing a ${tpLevel} TP.`;
    }

    return `Auto-TP at ${tpLevel} improved total P&L by ${improvement.toFixed(1)}%${scopeText} over baseline (win rate ${winRateChange >= 0 ? '+' : ''}${winRateChange.toFixed(1)}pp, PF ${baseline.profitFactor === Number.POSITIVE_INFINITY ? '∞' : baseline.profitFactor.toFixed(2)} → ${best.profitFactor === Number.POSITIVE_INFINITY ? '∞' : best.profitFactor.toFixed(2)}).`;
  };

  if (!baseline || !best || !summaryData) {
    return (
      <Alert>
        <AlertDescription>
          No optimization results available. Please run the optimization first.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Narrative Summary */}
      <Card className="bg-gradient-to-r from-blue-50 to-green-50 dark:from-blue-950 dark:to-green-950 border-blue-200 dark:border-blue-800">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-green-500 flex items-center justify-center">
                <Trophy className="h-4 w-4 text-white" />
              </div>
            </div>
            <div>
              <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                📊 Auto-TP Optimization Results
              </h3>
              <p className="text-sm text-blue-800 dark:text-blue-200">
                {generateNarrative()}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Baseline Outperforms Alert */}
      {best && baseline && best.totalPnL <= baseline.totalPnL && (
        <Alert className="border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950">
          <Target className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800 dark:text-amber-200">
            <strong>Baseline outperforms Auto-TP</strong> for the selected scope. Your current exit strategy appears to be working well - consider keeping your existing approach rather than implementing take-profit rules.
          </AlertDescription>
        </Alert>
      )}

      {/* Side-by-Side Comparison */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Baseline Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-gray-600" />
              Baseline (Actual Results)
            </CardTitle>
            <CardDescription>Your actual trading performance</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-3 bg-muted rounded-lg">
                <div className="text-lg font-bold">{formatCurrency(baseline.totalPnL)}</div>
                <div className="text-xs text-muted-foreground">Total P&L</div>
              </div>
              <div className="text-center p-3 bg-muted rounded-lg">
                <div className="text-lg font-bold">{formatPercentage(baseline.winRate * 100)}</div>
                <div className="text-xs text-muted-foreground">Win Rate</div>
              </div>
              <div className="text-center p-3 bg-muted rounded-lg">
                <div className="text-lg font-bold">{formatCurrency(baseline.expectancy)}</div>
                <div className="text-xs text-muted-foreground">Expectancy</div>
              </div>
              <div className="text-center p-3 bg-muted rounded-lg">
                <div className="text-lg font-bold">{formatMetric(baseline.profitFactor)}</div>
                <div className="text-xs text-muted-foreground">Profit Factor</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Auto-TP Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-green-600" />
              Auto-TP ({formatTPPercentage(best.tpPct)})
              <Badge variant="default" className="ml-2">Optimized</Badge>
            </CardTitle>
            <CardDescription>Best take-profit strategy found</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-3 bg-green-50 dark:bg-green-950 rounded-lg">
                <div className="text-lg font-bold text-green-700 dark:text-green-300">
                  {formatCurrency(best.totalPnL)}
                </div>
                <div className="text-xs text-green-600 dark:text-green-400">Total P&L</div>
              </div>
              <div className="text-center p-3 bg-green-50 dark:bg-green-950 rounded-lg">
                <div className="text-lg font-bold text-green-700 dark:text-green-300">
                  {formatPercentage(best.winRate * 100)}
                </div>
                <div className="text-xs text-green-600 dark:text-green-400">Win Rate</div>
              </div>
              <div className="text-center p-3 bg-green-50 dark:bg-green-950 rounded-lg">
                <div className="text-lg font-bold text-green-700 dark:text-green-300">
                  {formatCurrency(best.expectancy)}
                </div>
                <div className="text-xs text-green-600 dark:text-green-400">Expectancy</div>
              </div>
              <div className="text-center p-3 bg-green-50 dark:bg-green-950 rounded-lg">
                <div className="text-lg font-bold text-green-700 dark:text-green-300">
                  {formatMetric(best.profitFactor)}
                </div>
                <div className="text-xs text-green-600 dark:text-green-400">Profit Factor</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Performance Chart */}
      <Card>
        <CardHeader>
          <CardTitle>TP % vs {objective === "totalPnL" ? "Total P&L" : objective === "expectancy" ? "Expectancy" : "Profit Factor"}</CardTitle>
          <CardDescription>
            Performance across all {candidates.length} tested take-profit levels (1% to 15,000% comprehensive range)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={summaryData.chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="tpPct" 
                  label={{ value: 'Take-Profit %', position: 'insideBottom', offset: -5 }}
                />
                <YAxis 
                  label={{ 
                    value: objective === "totalPnL" ? "Total P&L %" : 
                           objective === "expectancy" ? "Expectancy %" : "Profit Factor",
                    angle: -90, 
                    position: 'insideLeft' 
                  }}
                />
                <Tooltip 
                  formatter={(value) => [
                    objective === "profitFactor" ? formatMetric(value as number) : formatCurrency(value as number),
                    objective === "totalPnL" ? "Total P&L" : 
                    objective === "expectancy" ? "Expectancy" : "Profit Factor"
                  ]}
                  labelFormatter={(label) => `TP: ${label}%`}
                />
                <Line 
                  type="monotone" 
                  dataKey={objective} 
                  stroke="#3b82f6" 
                  strokeWidth={2}
                  dot={(props) => {
                    const { payload } = props;
                    return payload?.isBest ? (
                      <circle cx={props.cx} cy={props.cy} r={6} fill="#16a34a" stroke="#16a34a" strokeWidth={2} />
                    ) : (
                      <circle cx={props.cx} cy={props.cy} r={3} fill="#3b82f6" />
                    );
                  }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Top 5 TP Levels Table */}
      <Card>
        <CardHeader>
          <CardTitle>Top 5 Take-Profit Levels</CardTitle>
          <CardDescription>
            Best performing TP percentages ranked by {objective === "totalPnL" ? "total P&L" : objective}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Rank</th>
                  <th className="text-left p-2">TP %</th>
                  <th className="text-left p-2">Total P&L</th>
                  <th className="text-left p-2">Win Rate</th>
                  <th className="text-left p-2">Expectancy</th>
                  <th className="text-left p-2">Profit Factor</th>
                  <th className="text-left p-2">Trades</th>
                </tr>
              </thead>
              <tbody>
                {summaryData.sortedResults.map((result, index) => (
                  <tr key={result.tpPct} className={`border-b hover:bg-muted/50 ${result.tpPct === best.tpPct ? 'bg-green-50 dark:bg-green-950' : ''}`}>
                    <td className="p-2 font-medium">
                      {index + 1}
                      {result.tpPct === best.tpPct && <Badge variant="outline" className="ml-1 text-xs">Best</Badge>}
                    </td>
                    <td className="p-2 font-medium">{formatTPPercentage(result.tpPct)}</td>
                    <td className="p-2">{formatCurrency(result.totalPnL)}</td>
                    <td className="p-2">{formatPercentage(result.winRate * 100)}</td>
                    <td className="p-2">{formatCurrency(result.expectancy)}</td>
                    <td className="p-2">{formatMetric(result.profitFactor)}</td>
                    <td className="p-2">{result.trades}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Implementation Note */}
      <Card className="border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-950">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <div className="flex-shrink-0">
              <Target className="h-5 w-5 text-yellow-600" />
            </div>
            <div>
              <h4 className="font-semibold text-yellow-900 dark:text-yellow-100 mb-1">
                Implementation Recommendation
              </h4>
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                Based on this analysis{scope === "byStrategy" && selectedStrategy ? ` for ${selectedStrategy}` : ""}, consider implementing a {formatTPPercentage(best.tpPct)} take-profit rule for your {data.length} trades. 
                This would maintain your existing stop-loss strategy while potentially improving performance by {summaryData.improvement >= 0 ? '+' : ''}{summaryData.improvement.toFixed(1)}%.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}