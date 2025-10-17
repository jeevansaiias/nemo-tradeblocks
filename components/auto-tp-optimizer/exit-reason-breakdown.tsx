'use client';

import {
  PieChart,
  Pie,
  Cell,
  Legend,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

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
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, value }) => `${name}: ${value}`}
            outerRadius={80}
            fill="#8884d8"
            dataKey="value"
          >
            {data.map((_, index) => (
              <Cell
                key={`cell-${index}`}
                fill={COLORS[index % COLORS.length]}
              />
            ))}
          </Pie>
          <Tooltip
            content={({ active, payload }) => {
              if (active && payload && payload[0]) {
                const data = payload[0].payload;
                return (
                  <div className="rounded border border-border bg-background p-2 text-xs shadow-lg">
                    <p className="font-semibold">{data.name}</p>
                    <p>Count: {data.value}</p>
                    <p>
                      Avg Missed: {data.avg_missed_profit.toFixed(2)}%
                    </p>
                  </div>
                );
              }
              return null;
            }}
          />
          <Legend />
        </PieChart>
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
              <div>{item.count} trades</div>
              <div className="text-muted-foreground">
                Missed: {item.avg_missed_profit.toFixed(2)}%
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
