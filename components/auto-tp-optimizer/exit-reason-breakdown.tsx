'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { formatInt, formatPercentRaw } from '@/lib/utils/format';

interface ExitReasonData {
  reason: string;
  count: number;
  avg_missed_profit: number;
  recommended_tp: number;
}

const COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6'];

export function ExitReasonBreakdown({
  data,
}: {
  data: ExitReasonData[];
}) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        No data to display
      </div>
    );
  }

  const chartData = data.map((item) => ({
    name: item.reason,
    value: item.count,
    avg_missed_profit: item.avg_missed_profit,
  }));

  return (
    <div className="space-y-4">
      <ResponsiveContainer width="100%" height={250}>
        <BarChart
          data={chartData}
          margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="name" 
            angle={-45}
            textAnchor="end"
            height={80}
            fontSize={12}
          />
          <YAxis 
            label={{ value: 'Number of Trades', angle: -90, position: 'insideLeft' }}
            fontSize={12}
          />
          <Tooltip
            content={({ active, payload, label }) => {
              if (active && payload && payload[0]) {
                const data = payload[0].payload;
                return (
                  <div className="rounded border border-border bg-background p-2 text-xs shadow-lg">
                    <p className="font-semibold">{label}</p>
                    <p>Count: {formatInt(data.value, false)}</p>
                    <p>
                      Avg Missed: {formatPercentRaw(data.avg_missed_profit)}
                    </p>
                  </div>
                );
              }
              return null;
            }}
          />
          <Bar dataKey="value" radius={[4, 4, 0, 0]}>
            {data.map((_, index) => (
              <Cell
                key={`cell-${index}`}
                fill={COLORS[index % COLORS.length]}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Stats Table */}
      <div className="space-y-2">
        {data.map((item, idx) => (
          <div
            key={idx}
            className="flex items-center justify-between text-xs p-2 rounded border border-border/50"
          >
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded"
                style={{
                  backgroundColor: COLORS[idx % COLORS.length],
                }}
              ></div>
              <span className="font-medium">{item.reason}</span>
            </div>
            <div className="text-right">
              <div>{formatInt(item.count, false)} trades</div>
              <div className="text-muted-foreground">
                Missed: {formatPercentRaw(item.avg_missed_profit)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
