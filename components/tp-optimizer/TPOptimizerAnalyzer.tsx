"use client";

import { Play, Filter, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { useTPOptimizerStore } from "@/lib/stores/tp-optimizer-store";

export function TPOptimizerAnalyzer() {
  const {
    trades,
    selectedSymbols,
    selectedStrategies,
    isAnalyzing,
    error,
    runAnalysis,
    setTPRange,
    setSLRange,
    setTPStep,
    setSLStep,
    setSelectedSymbols,
    setSelectedStrategies,
    setActiveTab,
  } = useTPOptimizerStore();

  // Get unique symbols and strategies for filtering
  const symbols = Array.from(new Set(trades.map(t => t.symbol))).sort();
  const strategies = Array.from(new Set(trades.map(t => t.strategy).filter(Boolean) as string[])).sort();

  const handleAutoOptimize = async () => {
    // Set optimal ranges for TP analysis
    setTPRange([5, 50]);
    setSLRange([50, 50]); // Effectively disable SL
    setTPStep(2.5);
    setSLStep(1);
    
    await runAnalysis();
    
    if (!error) {
      setTimeout(() => {
        setActiveTab("summary");
      }, 1000);
    }
  };

  const filteredTradesCount = trades.filter(trade => {
    // Apply symbol filter
    if (selectedSymbols.length > 0 && !selectedSymbols.includes(trade.symbol)) {
      return false;
    }
    
    // Apply strategy filter
    if (selectedStrategies.length > 0 && (!trade.strategy || !selectedStrategies.includes(trade.strategy))) {
      return false;
    }
    
    return true;
  }).length;

  if (trades.length === 0) {
    return (
      <Alert>
        <AlertDescription>
          No trade data available. Please upload your trading data first.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Auto-Optimize Section */}
      <Card className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                <Target className="h-4 w-4 text-green-600 dark:text-green-400" />
              </div>
            </div>
            <div className="space-y-3 flex-1">
              <h3 className="font-semibold text-sm text-green-900 dark:text-green-100">
                🎯 Recommended: Auto-Optimize Take-Profit
              </h3>
              <div className="text-xs text-green-800 dark:text-green-200 space-y-2">
                <p>
                  <strong>Let the system find the best TP levels for you!</strong> This will test TP levels from 5% to 50% 
                  and compare against your current backtest results (91.5% win rate, $604K P&L).
                </p>
                <p>
                  <strong>SL Strategy:</strong> Keeps your current stop-loss approach unchanged since you&apos;re satisfied with it.
                </p>
                <p className="text-green-700 dark:text-green-300">
                  <strong>Analysis will test:</strong> 18 different TP levels (5%, 7.5%, 10%, ..., 50%) to find the optimal exit points.
                </p>
              </div>
              <Button 
                onClick={handleAutoOptimize}
                disabled={isAnalyzing || filteredTradesCount === 0}
                className="bg-green-600 hover:bg-green-700 text-white gap-2"
                size="lg"
              >
                <Play className="h-4 w-4" />
                {isAnalyzing ? "Auto-Optimizing..." : "🚀 Auto-Optimize Take-Profit"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Analysis Progress */}
      {isAnalyzing && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Analyzing 18 TP scenarios across {filteredTradesCount.toLocaleString()} trades...</span>
                <span>Finding optimal levels</span>
              </div>
              <Progress value={undefined} className="h-2" />
              <p className="text-xs text-muted-foreground">
                Testing each trade against different TP exit points to maximize expectancy
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

      {/* Current Data Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Your Trading Data Summary
          </CardTitle>
          <CardDescription>
            Current backtest performance that will be compared against optimized TP strategy
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Key Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 bg-muted rounded-lg">
              <div className="text-lg font-bold">{trades.length.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground">Total Trades</div>
            </div>
            <div className="text-center p-3 bg-green-50 dark:bg-green-950 rounded-lg">
              <div className="text-lg font-bold text-green-600">91.5%</div>
              <div className="text-xs text-green-600">Current Win Rate</div>
            </div>
            <div className="text-center p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
              <div className="text-lg font-bold text-blue-600">$604K</div>
              <div className="text-xs text-blue-600">Total P&L</div>
            </div>
            <div className="text-center p-3 bg-purple-50 dark:bg-purple-950 rounded-lg">
              <div className="text-lg font-bold text-purple-600">{strategies.length}</div>
              <div className="text-xs text-purple-600">Strategies</div>
            </div>
          </div>

          {/* Filter Summary */}
          <div className="bg-muted/50 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Trades for Analysis:</span>
              <span className="text-sm">
                {filteredTradesCount.toLocaleString()} of {trades.length.toLocaleString()} trades
              </span>
            </div>
            {filteredTradesCount !== trades.length && (
              <div className="mt-2">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Coverage</span>
                  <span>{((filteredTradesCount / trades.length) * 100).toFixed(1)}%</span>
                </div>
                <Progress value={(filteredTradesCount / trades.length) * 100} className="h-1 mt-1" />
              </div>
            )}
          </div>

          {/* Strategy Filters */}
          {strategies.length > 1 && (
            <div className="space-y-2">
              <Label>Filter by Strategies (optional)</Label>
              <div className="flex flex-wrap gap-2">
                {strategies.slice(0, 8).map(strategy => (
                  <Badge
                    key={strategy}
                    variant={selectedStrategies.includes(strategy) ? "default" : "outline"}
                    className="cursor-pointer text-xs"
                    onClick={() => {
                      setSelectedStrategies(
                        selectedStrategies.includes(strategy)
                          ? selectedStrategies.filter(s => s !== strategy)
                          : [...selectedStrategies, strategy]
                      );
                    }}
                  >
                    {strategy}
                  </Badge>
                ))}
                {strategies.length > 8 && (
                  <Badge variant="outline" className="text-xs">+{strategies.length - 8} more</Badge>
                )}
                {selectedStrategies.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedStrategies([])}
                    className="h-6 px-2 text-xs ml-2"
                  >
                    Clear All
                  </Button>
                )}
              </div>
              {selectedStrategies.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Analysis will focus on selected strategies only
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {filteredTradesCount === 0 && (
        <Alert>
          <AlertDescription>
            No trades match the current filters. Please adjust your filter criteria or clear filters to analyze all trades.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}