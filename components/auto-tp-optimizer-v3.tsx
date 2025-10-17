'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { TPClusterMap } from '@/components/charts/TPClusterMap';
import { TPGainCurve } from '@/components/charts/TPGainCurve';
import { DynamicTPOptimizer } from '@/components/charts/DynamicTPOptimizer';
import { 
  cluster_exit_behavior, 
  generate_optimization_insights, 
  simulate_tp_performance,
  TPCluster, 
  TPOptimizationInsight 
} from '@/lib/processing/tp_optimizer_engine';
import { StrategyTrade, TPSimulationPoint } from '@/lib/processing/tp_optimizer_service';

interface OptimizationState {
  clusters: TPCluster[] | null;
  insights: TPOptimizationInsight[] | null;
  selectedCluster: number | null;
  simulationData: TPSimulationPoint[] | null;
  trades: StrategyTrade[];
}

export function AutoTPOptimizerV3() {
  const [state, setState] = useState<OptimizationState>({
    clusters: null,
    insights: null,
    selectedCluster: null,
    simulationData: null,
    trades: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    const loadAndOptimize = async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/tp-optimizer-results');
        const result = await res.json();

        if (!result.data || !result.data.trades) {
          throw new Error('No trading data available');
        }

        const trades: StrategyTrade[] = result.data.trades;

        // Run clustering
        const clusters = cluster_exit_behavior(trades, 5);
        const insights = generate_optimization_insights(clusters, trades);

        // Simulate TP performance for first cluster
        const firstCluster = clusters[0];
        if (firstCluster) {
          const clusterTrades = trades.filter(t => t.strategy === firstCluster.strategies[0]);
          const simData = simulate_tp_performance(clusterTrades, [50, 75, 100, 125, 150, 175, 200, 250, 300, 400, 500]);
          
          setState({
            clusters,
            insights,
            selectedCluster: 0,
            simulationData: simData,
            trades,
          });
        } else {
          throw new Error('No clusters generated');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load optimization data');
      } finally {
        setLoading(false);
      }
    };

    loadAndOptimize();
  }, []);

  const handleClusterSelect = (clusterId: number) => {
    const cluster = state.clusters?.find(c => c.cluster_id === clusterId);
    if (cluster && state.trades) {
      const clusterTrades = state.trades.filter(t => cluster.strategies.includes(t.strategy));
      const simData = simulate_tp_performance(clusterTrades, [50, 75, 100, 125, 150, 175, 200, 250, 300, 400, 500]);

      setState(prev => ({
        ...prev,
        selectedCluster: clusterId,
        simulationData: simData,
      }));
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-12 flex flex-col items-center justify-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
          <p className="text-muted-foreground">Loading optimization engine...</p>
        </CardContent>
      </Card>
    );
  }

  if (error || !state.clusters || !state.insights) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <strong>Error:</strong> {error || 'Failed to generate optimization insights'}
        </AlertDescription>
      </Alert>
    );
  }

  const selectedClusterInsight = state.insights.find(i => i.cluster_id === state.selectedCluster);

  return (
    <div className="space-y-6">
      {/* Status Alert */}
      <Alert>
        <CheckCircle className="h-4 w-4 text-green-600" />
        <AlertDescription>
          <strong>Optimization Ready:</strong> {state.clusters.length} trade clusters identified. 
          Analyzing {state.trades.length} trades across {new Set(state.trades.map(t => t.strategy)).size} strategies.
        </AlertDescription>
      </Alert>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="clusters">Clusters</TabsTrigger>
          <TabsTrigger value="curve">TP Curve</TabsTrigger>
          <TabsTrigger value="optimizer">Optimizer</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-zinc-400">Total Clusters</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-white">{state.clusters.length}</p>
                <p className="mt-1 text-xs text-zinc-500">Trade behavior groups</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-zinc-400">Avg Improvement</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-green-400">
                  +{(state.clusters.reduce((sum, c) => sum + c.potential_improvement, 0) / state.clusters.length).toFixed(2)}%
                </p>
                <p className="mt-1 text-xs text-zinc-500">Potential P/L gain</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-zinc-400">Trades Analyzed</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-orange-400">{state.trades.length}</p>
                <p className="mt-1 text-xs text-zinc-500">Across all clusters</p>
              </CardContent>
            </Card>
          </div>

          {/* Insights Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Insights Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {state.insights.slice(0, 3).map((insight, idx) => (
                <div key={idx} className="rounded border border-zinc-800 bg-zinc-900/50 p-3 text-sm">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-white">{insight.cluster_name}</p>
                      <p className="mt-1 text-xs text-zinc-400">{insight.recommendation}</p>
                    </div>
                    <p className="text-right">
                      <span className="block font-semibold text-green-400">+{insight.expected_pl_delta_pct.toFixed(2)}%</span>
                      <span className="text-xs text-zinc-500">Expected Δ</span>
                    </p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Clusters Tab */}
        <TabsContent value="clusters" className="space-y-6">
          {state.clusters && <TPClusterMap clusters={state.clusters} />}
        </TabsContent>

        {/* TP Curve Tab */}
        <TabsContent value="curve" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Select Cluster to Analyze</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 md:grid-cols-3">
                {state.clusters.map((cluster) => (
                  <button
                    key={cluster.cluster_id}
                    onClick={() => handleClusterSelect(cluster.cluster_id)}
                    className={`rounded p-3 text-left transition-all ${
                      state.selectedCluster === cluster.cluster_id
                        ? 'border-2 border-orange-400 bg-orange-950/30'
                        : 'border border-zinc-700 bg-zinc-900 hover:border-zinc-600'
                    }`}
                  >
                    <p className="font-semibold text-white">{cluster.name}</p>
                    <p className="text-xs text-zinc-400">{cluster.trade_count} trades</p>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {state.simulationData && selectedClusterInsight && (
            <TPGainCurve 
              simulationData={state.simulationData}
              optimalTP={selectedClusterInsight.optimal_tp}
              diminishingReturnThreshold={selectedClusterInsight.diminishing_return_threshold}
            />
          )}
        </TabsContent>

        {/* Optimizer Tab */}
        <TabsContent value="optimizer" className="space-y-6">
          {state.clusters && state.insights && (
            <DynamicTPOptimizer 
              clusters={state.clusters}
              trades={state.trades}
              insights={state.insights}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
