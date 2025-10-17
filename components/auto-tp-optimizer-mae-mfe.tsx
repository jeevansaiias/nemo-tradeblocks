'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useBlockStore } from '@/lib/stores/block-store';
import { getTradesByBlock } from '@/lib/db';
import { Trade } from '@/lib/models/trade';
import {
  pctOfPremium,
  mfePercent,
  maePercent,
  efficiencyPct,
  missedProfitPct,
  winRatePct,
  validateEfficiencies,
} from '@/lib/analytics/returns';
import { MFEDistribution } from './auto-tp-optimizer/mfe-distribution';
import { MissedProfitChart } from './auto-tp-optimizer/missed-profit-chart';
import { ExitReasonBreakdown } from './auto-tp-optimizer/exit-reason-breakdown';
import { EfficiencyMatrix } from './auto-tp-optimizer/efficiency-matrix';
import { ExitReasonAttributionMatrix } from './charts/ExitReasonAttributionMatrix';
import { ExitReasonContributionChart } from './charts/ExitReasonContributionChart';
import { ExitReasonTPHeatmap } from './charts/ExitReasonTPHeatmap';
import { StrategyExitReasonMatrix } from './charts/StrategyExitReasonMatrix';
import { AutoInsightsSummary } from './charts/AutoInsightsSummary';
import { StrategyExitHeatmap } from './charts/StrategyExitHeatmap';
import { StrategyExitTPMatrix } from './charts/StrategyExitTPMatrix';
import { WeightedExitImpactTable } from './charts/WeightedExitImpactTable';
import { AutoInsights3 } from './charts/AutoInsights3';
import {
  analyzeByExitReason,
  strategyExitReasonCrosstab,
  analyzeTPBinsByExitReason,
  generateAutoInsights,
} from '@/lib/processing/exit_reason_analyzer';
import {
  strategyExitHeatmapData,
  perStrategyTPCurves,
  weightedExitImpactTable,
  generateAutoInsights3,
} from '@/lib/processing/strategy_exit_matrix';

interface ExitReasonData {
  reason: string;
  count: number;
  avg_missed_profit: number;
  recommended_tp: number;
}

interface GlobalMetrics {
  total_trades: number;
  total_strategies: number;
  overall_win_rate: number;
  overall_avg_efficiency: number;
  overall_avg_mfe: number;
  overall_avg_missed_profit: number;
}

interface EnrichedTrade {
  trade_id: string;
  strategy: string;
  entry_date: string;
  exit_date: string;
  entry_price: number;
  exit_price: number;
  max_price: number;
  min_price: number;
  contracts: number;
  exit_reason: string;
  actual_pct: number;
  max_profit_pct: number;
  max_loss_pct: number;
  mfe_pct: number;
  mae_pct: number;
  optimal_tp: number;
  missed_profit_pct: number;
  efficiency: number;
}

interface StrategyMetrics {
  strategy: string;
  trade_count: number;
  avg_mfe: number;
  avg_mae: number;
  avg_missed_profit: number;
  recommended_tp: number;
  win_rate: number;
  efficiency_score: number;
}

export interface APIResponse {
  status: string;
  source: string;
  globalMetrics: GlobalMetrics;
  trades: EnrichedTrade[];
  strategies: StrategyMetrics[];
  exitReasonBreakdowns: Record<string, ExitReasonData[]>;
}

export function AutoTPOptimizerMAEMFE() {
  const [data, setData] = useState<APIResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedStrategies, setSelectedStrategies] = useState<string[]>([]);
  const [selectedExitReasons, setSelectedExitReasons] = useState<string[]>([]);

  // Get active block from store
  const activeBlock = useBlockStore(state => {
    const activeBlockId = state.activeBlockId;
    return activeBlockId ? state.blocks.find(block => block.id === activeBlockId) : null;
  });
  const isInitialized = useBlockStore(state => state.isInitialized);
  const loadBlocks = useBlockStore(state => state.loadBlocks);

  // Load blocks if not initialized
  useEffect(() => {
    if (!isInitialized) {
      loadBlocks().catch(console.error);
    }
  }, [isInitialized, loadBlocks]);

  // Fetch and process trades when active block changes
  useEffect(() => {
    if (!activeBlock) {
      setData(null);
      setError(null);
      return;
    }

    const fetchBlockData = async () => {
      setLoading(true);
      setError(null);

      try {
        const trades = await getTradesByBlock(activeBlock.id);
        if (trades.length === 0) {
          setError('No trades found in this block');
          setData(null);
          return;
        }

        // Enrich trades and build API response
        const enrichedTrades = enrichTrades(trades);
        const apiResponse = buildAPIResponse(enrichedTrades);
        
        setData(apiResponse);
        setSelectedStrategies(apiResponse.strategies.map((s) => s.strategy));
        const allExitReasons = [...new Set(apiResponse.trades.map((t) => t.exit_reason))];
        setSelectedExitReasons(allExitReasons);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load trades';
        setError(message);
        setData(null);
      } finally {
        setLoading(false);
      }
    };

    fetchBlockData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBlock?.id]);

  // Helper function to convert Trade to EnrichedTrade using consistent analytics
  const enrichTrades = (trades: Trade[]): EnrichedTrade[] => {
    return trades.map((trade) => {
      // Use standardized analytics: all as % of premium
      const actualPct = pctOfPremium(trade.pl || 0, trade.openingPrice, trade.numContracts);
      const mfePct = mfePercent(
        trade.maxProfit ? trade.openingPrice + (trade.maxProfit / trade.numContracts) : trade.openingPrice,
        trade.openingPrice,
        trade.numContracts
      );
      const maePct = maePercent(
        trade.maxLoss ? trade.openingPrice - (Math.abs(trade.maxLoss) / trade.numContracts) : trade.openingPrice,
        trade.openingPrice,
        trade.numContracts
      );
      const efficiency = efficiencyPct(actualPct, mfePct);
      const missedProfit = missedProfitPct(mfePct, actualPct);

      return {
        trade_id: `${trade.strategy}-${trade.dateOpened}`,
        strategy: trade.strategy,
        entry_date: new Date(trade.dateOpened).toISOString().split('T')[0],
        exit_date: trade.closingPrice ? new Date(trade.dateOpened).toISOString().split('T')[0] : '',
        entry_price: trade.openingPrice,
        exit_price: trade.closingPrice || 0,
        max_price: trade.maxProfit ? trade.openingPrice + (trade.maxProfit / trade.numContracts) : trade.openingPrice,
        min_price: trade.maxLoss ? trade.openingPrice - (Math.abs(trade.maxLoss) / trade.numContracts) : trade.openingPrice,
        contracts: trade.numContracts,
        exit_reason: trade.reasonForClose || 'Unknown',
        actual_pct: actualPct,
        max_profit_pct: mfePct,
        max_loss_pct: maePct,
        mfe_pct: mfePct,
        mae_pct: maePct,
        optimal_tp: actualPct > 0 ? actualPct * 0.95 : 0,
        missed_profit_pct: missedProfit,
        efficiency: efficiency,
      };
    });
  };

  // Helper function to build API response structure
  const buildAPIResponse = (trades: EnrichedTrade[]): APIResponse => {
    const strategies = new Map<string, EnrichedTrade[]>();
    const exitReasons = new Map<string, EnrichedTrade[]>();

    trades.forEach((trade) => {
      if (!strategies.has(trade.strategy)) {
        strategies.set(trade.strategy, []);
      }
      strategies.get(trade.strategy)!.push(trade);

      if (!exitReasons.has(trade.exit_reason)) {
        exitReasons.set(trade.exit_reason, []);
      }
      exitReasons.get(trade.exit_reason)!.push(trade);
    });

    const strategyMetrics: StrategyMetrics[] = Array.from(strategies).map(([strategy, stratTrades]) => {
      const actualPcts = stratTrades.map((t) => t.actual_pct);
      
      // Calculate efficiency for each trade and validate
      const efficiencies = stratTrades.map((t) => t.efficiency);
      validateEfficiencies(efficiencies, `Strategy: ${strategy}`);
      
      // Filter valid values only for calculations
      const validTrades = stratTrades.filter((t) => 
        Number.isFinite(t.mfe_pct) && Number.isFinite(t.mae_pct) && 
        Number.isFinite(t.efficiency) && t.mfe_pct > 0
      );
      
      const avgMFE = validTrades.length > 0 
        ? validTrades.reduce((sum, t) => sum + t.mfe_pct, 0) / validTrades.length 
        : 0;
      const avgMAE = validTrades.length > 0 
        ? validTrades.reduce((sum, t) => sum + t.mae_pct, 0) / validTrades.length 
        : 0;
      const avgMissed = validTrades.length > 0 
        ? validTrades.reduce((sum, t) => sum + t.missed_profit_pct, 0) / validTrades.length 
        : 0;
      const avgEfficiency = validTrades.length > 0 
        ? validTrades.reduce((sum, t) => sum + t.efficiency, 0) / validTrades.length 
        : 0;

      return {
        strategy,
        trade_count: stratTrades.length,
        avg_mfe: Number.isFinite(avgMFE) ? avgMFE : 0,
        avg_mae: Number.isFinite(avgMAE) ? avgMAE : 0,
        avg_missed_profit: Number.isFinite(avgMissed) ? avgMissed : 0,
        recommended_tp: Number.isFinite(avgMFE) ? avgMFE * 0.9 : 0,
        win_rate: winRatePct(actualPcts),
        efficiency_score: Number.isFinite(avgEfficiency) ? avgEfficiency : 0,
      };
    });

    // Calculate global metrics using analytics functions
    const actualPcts = trades.map((t) => t.actual_pct);
    const efficiencies = trades.map((t) => t.efficiency);
    validateEfficiencies(efficiencies, 'Global');
    
    // Filter valid trades for global metrics
    const validTrades = trades.filter((t) => 
      Number.isFinite(t.mfe_pct) && Number.isFinite(t.mae_pct) && 
      Number.isFinite(t.efficiency) && t.mfe_pct > 0
    );
    
    const avgEfficiency = validTrades.length > 0 
      ? validTrades.reduce((sum, t) => sum + t.efficiency, 0) / validTrades.length 
      : 0;
    const avgMFE = validTrades.length > 0 
      ? validTrades.reduce((sum, t) => sum + t.mfe_pct, 0) / validTrades.length 
      : 0;
    const avgMissed = validTrades.length > 0 
      ? validTrades.reduce((sum, t) => sum + t.missed_profit_pct, 0) / validTrades.length 
      : 0;

    const exitReasonBreakdowns: Record<string, ExitReasonData[]> = {};
    strategies.forEach((_stratTrades, strategy) => {
      const stratExitReasons = Array.from(exitReasons).map(([reason, reasonTrades]) => {
        const stratReasonTrades = reasonTrades.filter((t) => t.strategy === strategy);
        return {
          reason,
          count: stratReasonTrades.length,
          avg_missed_profit: stratReasonTrades.length > 0 ? stratReasonTrades.reduce((sum, t) => sum + t.missed_profit_pct, 0) / stratReasonTrades.length : 0,
          recommended_tp: 0,
        };
      });
      exitReasonBreakdowns[strategy] = stratExitReasons.filter((x) => x.count > 0);
    });

    return {
      status: 'success',
      source: 'active_block',
      globalMetrics: {
        total_trades: trades.length,
        total_strategies: strategies.size,
        overall_win_rate: winRatePct(actualPcts),
        overall_avg_efficiency: Number.isFinite(avgEfficiency) ? avgEfficiency : 0,
        overall_avg_mfe: Number.isFinite(avgMFE) ? avgMFE : 0,
        overall_avg_missed_profit: Number.isFinite(avgMissed) ? avgMissed : 0,
      },
      trades,
      strategies: strategyMetrics,
      exitReasonBreakdowns,
    };
  };

  const filteredTrades = data?.trades.filter((t) =>
    selectedStrategies.includes(t.strategy) &&
    selectedExitReasons.includes(t.exit_reason)
  ) || [];
  const filteredStrategies = data?.strategies.filter((s) =>
    selectedStrategies.includes(s.strategy)
  ) || [];
  
  // Get unique exit reasons for filter
  const allExitReasons = [...new Set(data?.trades.map((t) => t.exit_reason) || [])];

  if (loading || !isInitialized) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">
            {isInitialized ? `Loading ${activeBlock?.name || 'block'} MAE/MFE data...` : 'Initializing...'}
          </p>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center max-w-md">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">
            {activeBlock ? 'Error Loading Block Data' : 'No Active Block Selected'}
          </h3>
          <p className="text-muted-foreground">
            {activeBlock ? error : 'Please select a block from the sidebar to view TP Optimizer data.'}
          </p>
        </div>
      </div>
    );
  }

  if (!activeBlock) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center max-w-md">
          <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Active Block</h3>
          <p className="text-muted-foreground">
            Select a block from the sidebar to view TP Optimizer (MAE/MFE) analysis.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Active Block Info */}
      {activeBlock && (
        <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-4">
          <p className="text-sm font-medium text-blue-200">
            📊 Analyzing block: <span className="font-semibold">{activeBlock.name}</span>
          </p>
        </div>
      )}

      {/* Strategy & Exit Reason Filters */}
      {data && (
        <div className="space-y-3 rounded-lg border border-zinc-800 bg-zinc-950 p-4">
          <div>
            <p className="text-xs font-semibold text-zinc-400 uppercase mb-2">Strategy Filter</p>
            <div className="flex flex-wrap gap-2">
              {data.strategies.map((strategy) => (
                <button
                  key={strategy.strategy}
                  onClick={() => {
                    setSelectedStrategies((prev) =>
                      prev.includes(strategy.strategy)
                        ? prev.filter((s) => s !== strategy.strategy)
                        : [...prev, strategy.strategy]
                    );
                  }}
                  className={`rounded px-3 py-1.5 text-xs font-medium transition ${
                    selectedStrategies.includes(strategy.strategy)
                      ? 'bg-orange-500 text-white'
                      : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                  }`}
                >
                  {strategy.strategy} ({strategy.trade_count})
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-zinc-400 uppercase mb-2">Exit Reason Filter</p>
            <div className="flex flex-wrap gap-2">
              {allExitReasons.map((reason) => (
                <button
                  key={reason}
                  onClick={() => {
                    setSelectedExitReasons((prev) =>
                      prev.includes(reason)
                        ? prev.filter((r) => r !== reason)
                        : [...prev, reason]
                    );
                  }}
                  className={`rounded px-3 py-1.5 text-xs font-medium transition ${
                    selectedExitReasons.includes(reason)
                      ? 'bg-orange-500 text-white'
                      : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                  }`}
                >
                  {reason}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Global Metrics Cards */}
      {data && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          <div className="rounded-lg border p-4">
            <div className="text-xs font-medium text-muted-foreground">
              Total Trades
            </div>
            <div className="text-2xl font-bold">
              {data.globalMetrics.total_trades}
            </div>
          </div>
          <div className="rounded-lg border p-4">
            <div className="text-xs font-medium text-muted-foreground">
              Strategies
            </div>
            <div className="text-2xl font-bold">
              {data.globalMetrics.total_strategies}
            </div>
          </div>
          <div className="rounded-lg border p-4">
            <div className="text-xs font-medium text-muted-foreground">
              Win Rate
            </div>
            <div className="text-2xl font-bold">
              {data.globalMetrics.overall_win_rate}%
            </div>
          </div>
          <div className="rounded-lg border p-4">
            <div className="text-xs font-medium text-muted-foreground">
              Avg Efficiency
            </div>
            <div className="text-2xl font-bold">
              {data.globalMetrics.overall_avg_efficiency}%
            </div>
          </div>
          <div className="rounded-lg border p-4">
            <div className="text-xs font-medium text-muted-foreground">
              Avg MFE
            </div>
            <div className="text-2xl font-bold">
              {data.globalMetrics.overall_avg_mfe.toFixed(2)}%
            </div>
          </div>
          <div className="rounded-lg border p-4">
            <div className="text-xs font-medium text-muted-foreground">
              Avg Missed Profit
            </div>
            <div className="text-2xl font-bold">
              {data.globalMetrics.overall_avg_missed_profit.toFixed(2)}%
            </div>
          </div>
        </div>
      )}

      {/* Charts Section */}
      {data && (
        <div className="space-y-6">
          {/* MFE Distribution */}
          <div className="rounded-lg border p-6">
            <h3 className="font-semibold mb-4">MFE Distribution</h3>
            <MFEDistribution trades={filteredTrades} />
          </div>

          {/* Missed Profit Chart */}
          <div className="rounded-lg border p-6">
            <h3 className="font-semibold mb-4">Missed Profit Analysis</h3>
            <MissedProfitChart trades={filteredTrades} />
          </div>

          {/* Exit Reason Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredStrategies.map((strategy) => (
              <div key={strategy.strategy} className="rounded-lg border p-6">
                <h3 className="font-semibold mb-4">{strategy.strategy}</h3>
                <ExitReasonBreakdown
                  data={data.exitReasonBreakdowns[strategy.strategy] || []}
                />
              </div>
            ))}
          </div>

          {/* Efficiency Matrix */}
          <div className="rounded-lg border p-6">
            <h3 className="font-semibold mb-4">Efficiency Matrix</h3>
            <EfficiencyMatrix strategies={filteredStrategies} />
          </div>

          {/* Exit Reason Attribution Section */}
          <div className="space-y-6 border-t pt-6">
            <div>
              <h2 className="text-2xl font-bold">Exit Reason Attribution Analysis</h2>
              <p className="text-muted-foreground mt-2">
                Deep dive into how each exit condition impacts your P&L and efficiency
              </p>
            </div>

            {/* Auto Insights */}
            {filteredTrades.length > 0 && (
              <AutoInsightsSummary
                insight={generateAutoInsights(
                  filteredTrades,
                  analyzeByExitReason(filteredTrades)
                )}
              />
            )}

            {/* Exit Reason Attribution Matrix */}
            {filteredTrades.length > 0 && (
              <ExitReasonAttributionMatrix
                data={analyzeByExitReason(filteredTrades)}
              />
            )}

            {/* Exit Reason Contribution Chart */}
            {filteredTrades.length > 0 && (
              <ExitReasonContributionChart
                data={analyzeByExitReason(filteredTrades)}
              />
            )}

            {/* Exit Reason vs TP Heatmap */}
            {filteredTrades.length > 0 && (
              <ExitReasonTPHeatmap
                data={analyzeTPBinsByExitReason(filteredTrades)}
              />
            )}

            {/* Strategy vs Exit Reason Matrix */}
            {filteredTrades.length > 0 && (
              <StrategyExitReasonMatrix
                data={strategyExitReasonCrosstab(filteredTrades)}
              />
            )}
          </div>

          {/* Strategy × Exit Reason Advanced Analysis Section */}
          <div className="space-y-6 border-t pt-6">
            <div>
              <h2 className="text-2xl font-bold">Strategy × Exit Reason Advanced Analysis</h2>
              <p className="text-muted-foreground mt-2">
                Multi-dimensional performance heatmaps, TP curves, and AI-driven insights across all combinations
              </p>
            </div>

            {/* Auto Insights 3.0 */}
            {filteredTrades.length > 0 && (
              <AutoInsights3
                insights={generateAutoInsights3(
                  filteredTrades,
                  strategyExitHeatmapData(filteredTrades)
                )}
              />
            )}

            {/* Strategy × Exit Reason Heatmap */}
            {filteredTrades.length > 0 && (
              <StrategyExitHeatmap
                data={strategyExitHeatmapData(filteredTrades)}
              />
            )}

            {/* Weighted Exit Impact Table */}
            {filteredTrades.length > 0 && (
              <WeightedExitImpactTable
                data={weightedExitImpactTable(filteredTrades)}
              />
            )}

            {/* Strategy × Exit Reason TP Performance Matrix */}
            {filteredTrades.length > 0 && (
              <StrategyExitTPMatrix
                curves={perStrategyTPCurves(filteredTrades)}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
