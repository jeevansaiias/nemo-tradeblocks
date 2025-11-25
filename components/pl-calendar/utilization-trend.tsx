"use client";

import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CalendarDaySummary } from "@/lib/services/calendar-data-service";

interface UtilizationTrendProps {
  days: CalendarDaySummary[];
}

interface UtilizationPoint {
  day: number; // 1–31
  utilizationPct: number; // 0–100
  date: string;
}

export function UtilizationTrend({
  days,
}: UtilizationTrendProps) {
  if (!days.length) {
    return (
      <div className="h-40 rounded-2xl border border-neutral-800 flex items-center justify-center text-xs text-neutral-500">
        No utilization data for this period.
      </div>
    );
  }

  const data: UtilizationPoint[] = days
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .map((d) => ({
      day: new Date(d.date).getDate(),
      utilizationPct: d.peakUtilizationPercent || 0,
      date: d.date
    }));

  const max = Math.max(...data.map((d) => d.utilizationPct));
  const min = Math.min(...data.map((d) => d.utilizationPct));
  const padding = Math.max(5, (max - min) * 0.15);
  const domainMax = Math.min(100, max + padding);
  const domainMin = Math.max(0, Math.min(min - padding, 0));

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-medium text-neutral-200">
          Utilization Trend
        </h3>
        <p className="text-xs text-neutral-500">
          Shows how much of your account margin was deployed each day.
        </p>
      </div>

      <div className="h-56 rounded-2xl border border-neutral-800 bg-neutral-950/60 px-4 py-3">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="utilizationGradient" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#22c55e" stopOpacity={0.7} />
                <stop offset="100%" stopColor="#22c55e" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="day"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 10, fill: "#6b7280" }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              domain={[domainMin, domainMax]}
              tickFormatter={(v) => `${Math.round(v)}%`}
              tick={{ fontSize: 10, fill: "#6b7280" }}
            />
            <Tooltip
              cursor={{ stroke: "#374151", strokeWidth: 1 }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const p = payload[0].payload as UtilizationPoint;
                return (
                  <div className="rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-xs text-neutral-200 shadow-lg">
                    <div className="font-medium">Day {p.day}</div>
                    <div className="mt-1 text-emerald-400">
                      {p.utilizationPct.toFixed(1)}% utilization
                    </div>
                  </div>
                );
              }}
            />
            <Area
              type="monotone"
              dataKey="utilizationPct"
              stroke="#22c55e"
              strokeWidth={1.8}
              fill="url(#utilizationGradient)"
              activeDot={{ r: 3 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

