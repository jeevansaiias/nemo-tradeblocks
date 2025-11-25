"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useMemo } from "react";
import { CalendarDaySummary } from "@/lib/services/calendar-data-service";

interface UtilizationTrendProps {
  days: CalendarDaySummary[];
}

export function UtilizationTrend({ days }: UtilizationTrendProps) {
  const data = useMemo(
    () =>
      days
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .map((d) => ({
          label: new Date(d.date).getDate().toString(),
          utilization: d.peakUtilizationPercent ?? 0,
          fullDate: d.date
        })),
    [days]
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-zinc-200">Utilization Trend</h3>
        <p className="text-xs text-zinc-400">
          Shows how much of your account margin was deployed each day.
        </p>
      </div>

      <div className="h-40 rounded-2xl border border-zinc-800/80 bg-zinc-950/80 p-3">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="utilFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22c55e" stopOpacity={0.7} />
                <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="label" tickLine={false} axisLine={false} stroke="#525252" fontSize={12} />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${v}%`}
              width={32}
              stroke="#525252"
              fontSize={12}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#020617",
                borderRadius: 8,
                border: "1px solid #27272a",
              }}
              itemStyle={{ color: "#e5e5e5" }}
              formatter={(v: number) => [`${v.toFixed(1)}%`, "Utilization"]}
              labelFormatter={(label, payload) => {
                if (payload && payload.length > 0) {
                    return payload[0].payload.fullDate;
                }
                return label;
              }}
            />
            <Area
              type="monotone"
              dataKey="utilization"
              stroke="#22c55e"
              fill="url(#utilFill)"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

