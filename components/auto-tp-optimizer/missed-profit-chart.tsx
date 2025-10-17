'use client';

import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface Trade {
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

interface ChartData {
  actual: number;
  missed: number;
  strategy: string;
  exitReason: string;
}

export function MissedProfitChart({ trades }: { trades: Trade[] }) {
  const data: ChartData[] = trades.map((trade) => ({
    actual: trade.actual_pct,
    missed: trade.missed_profit_pct,
    strategy: trade.strategy,
    exitReason: trade.exit_reason,
  }));

  if (trades.length === 0) {
    return (
      <div className="flex items-center justify-center h-80 text-muted-foreground">
        No trades to display
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          dataKey="actual"
          name="Actual Return %"
          type="number"
          label={{ value: 'Actual Return %', position: 'insideBottomRight', offset: -10 }}
        />
        <YAxis
          dataKey="missed"
          name="Missed Profit %"
          type="number"
          label={{ value: 'Missed Profit %', angle: -90, position: 'insideLeft' }}
        />
        <Tooltip
          cursor={{ strokeDasharray: '3 3' }}
          content={({ active, payload }) => {
            if (active && payload && payload[0]) {
              const data = payload[0].payload as ChartData;
              return (
                <div className="rounded border border-border bg-background p-2 text-xs shadow-lg">
                  <p className="font-semibold">{data.strategy}</p>
                  <p>Actual: {data.actual.toFixed(2)}%</p>
                  <p>Missed: {data.missed.toFixed(2)}%</p>
                  <p>Exit: {data.exitReason}</p>
                </div>
              );
            }
            return null;
          }}
        />
        <Scatter
          name="Trades"
          data={data}
          fill="#8884d8"
          fillOpacity={0.7}
        />
      </ScatterChart>
    </ResponsiveContainer>
  );
}
