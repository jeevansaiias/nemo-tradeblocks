'use client';

import {
  BarChart,
  Bar,
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

interface MFEBucket {
  range: string;
  count: number;
}

export function MFEDistribution({ trades }: { trades: Trade[] }) {
  // Create MFE distribution buckets
  const buckets: Record<string, number> = {
    '0-1%': 0,
    '1-2%': 0,
    '2-3%': 0,
    '3-5%': 0,
    '5-10%': 0,
    '10%+': 0,
  };

  trades.forEach((trade) => {
    const mfe = trade.mfe_pct;
    if (mfe < 1) buckets['0-1%']++;
    else if (mfe < 2) buckets['1-2%']++;
    else if (mfe < 3) buckets['2-3%']++;
    else if (mfe < 5) buckets['3-5%']++;
    else if (mfe < 10) buckets['5-10%']++;
    else buckets['10%+']++;
  });

  const data: MFEBucket[] = [
    { range: '0-1%', count: buckets['0-1%'] },
    { range: '1-2%', count: buckets['1-2%'] },
    { range: '2-3%', count: buckets['2-3%'] },
    { range: '3-5%', count: buckets['3-5%'] },
    { range: '5-10%', count: buckets['5-10%'] },
    { range: '10%+', count: buckets['10%+'] },
  ];

  if (trades.length === 0) {
    return (
      <div className="flex items-center justify-center h-80 text-muted-foreground">
        No trades to display
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="range" />
        <YAxis />
        <Tooltip />
        <Bar dataKey="count" fill="#8884d8" />
      </BarChart>
    </ResponsiveContainer>
  );
}
