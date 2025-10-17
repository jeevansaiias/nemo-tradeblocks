'use client';

import { useState, useEffect } from 'react';
import { MFEDistribution } from './auto-tp-optimizer/mfe-distribution';
import { MissedProfitChart } from './auto-tp-optimizer/missed-profit-chart';
import { ExitReasonBreakdown } from './auto-tp-optimizer/exit-reason-breakdown';
import { EfficiencyMatrix } from './auto-tp-optimizer/efficiency-matrix';
import { ExitReasonAttributionMatrix } from './charts/ExitReasonAttributionMatrix';
import { ExitReasonContributionChart } from './charts/ExitReasonContributionChart';
import { ExitReasonTPHeatmap } from './charts/ExitReasonTPHeatmap';
import { StrategyExitReasonMatrix } from './charts/StrategyExitReasonMatrix';
import { AutoInsightsSummary } from './charts/AutoInsightsSummary';
import {
  analyzeByExitReason,
  strategyExitReasonCrosstab,
  analyzeTPBinsByExitReason,
  generateAutoInsights,
} from '@/lib/processing/exit_reason_analyzer';

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStrategies, setSelectedStrategies] = useState<string[]>([]);
  const [uploadStatus, setUploadStatus] = useState('');

  // Load seed data on mount
  useEffect(() => {
    const loadSeedData = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch('/api/tp-optimizer-mae-mfe');
        if (!res.ok) throw new Error('Failed to load seed data');
        const jsonData: APIResponse = await res.json();
        setData(jsonData);
        setSelectedStrategies(jsonData.strategies.map((s) => s.strategy));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    loadSeedData();
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setUploadStatus('Uploading...');

    try {
      const text = await selectedFile.text();
      const res = await fetch('/api/tp-optimizer-mae-mfe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csvContent: text }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(
          errData.message || 'Failed to process CSV'
        );
      }

      const jsonData: APIResponse = await res.json();
      setData(jsonData);
      setSelectedStrategies(jsonData.strategies.map((s) => s.strategy));
      setUploadStatus(
        `✓ Loaded ${jsonData.trades.length} trades from ${selectedFile.name}`
      );

      // Reset file input
      if (e.target) e.target.value = '';
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setUploadStatus(`✗ Error: ${message}`);
      setError(message);
    }
  };

  const filteredTrades = data?.trades.filter((t) =>
    selectedStrategies.includes(t.strategy)
  ) || [];
  const filteredStrategies = data?.strategies.filter((s) =>
    selectedStrategies.includes(s.strategy)
  ) || [];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading MAE/MFE data...</p>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
        <h3 className="font-semibold text-destructive mb-2">Error</h3>
        <p className="text-sm text-destructive/90">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Upload Section */}
      <div className="rounded-lg border border-dashed border-muted-foreground/25 p-6 text-center">
        <label className="cursor-pointer">
          <div className="space-y-2">
            <div className="text-sm font-medium">Upload Trade Log CSV</div>
            <p className="text-xs text-muted-foreground">
              Or use sample data below
            </p>
            <input
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>
        </label>
        {uploadStatus && (
          <p className="mt-3 text-sm font-medium">{uploadStatus}</p>
        )}
      </div>

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
        </div>
      )}
    </div>
  );
}
