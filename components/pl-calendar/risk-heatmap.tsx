"use client";

import { useMemo } from "react";
import { CalendarDaySummary } from "@/lib/services/calendar-data-service";

interface RiskHeatmapProps {
  days: CalendarDaySummary[];
}

const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function riskClass(score: number) {
  if (score >= 80) return "bg-red-500/70";
  if (score >= 50) return "bg-amber-400/70";
  if (score > 0) return "bg-emerald-500/60";
  return "bg-zinc-800/60";
}

export function RiskHeatmap({ days }: RiskHeatmapProps) {
  // group by week index (0-based) and weekday
  const weeks = useMemo(() => {
    const map = new Map<number, CalendarDaySummary[]>();
    
    // Sort days first
    const sortedDays = [...days].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    if (sortedDays.length === 0) return [];

    // Find the first Sunday to align the grid properly if needed, 
    // or just use the day of the month to determine week index relative to start of month
    // The user's code uses `Math.floor((d.date.getDate() - 1) / 7)` which assumes weeks start on the 1st, 8th, etc.
    // This is a "month view" heatmap, not a continuous one.
    // Let's stick to the user's logic for now as it fits the "Calendar" view context.
    
    sortedDays.forEach((d) => {
      // Adjust for timezone if necessary, but assuming local date string "YYYY-MM-DD" is parsed correctly
      // Actually, new Date("YYYY-MM-DD") is UTC. new Date(y, m, d) is local.
      // Let's be careful. The input `d.date` is a string "YYYY-MM-DD".
      // We should parse it safely.
      const [y, m, day] = d.date.split('-').map(Number);
      const localDate = new Date(y, m - 1, day);
      
      const weekIndex = Math.floor((localDate.getDate() - 1) / 7);
      const key = weekIndex;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(d);
    });
    return Array.from(map.entries())
      .sort(([a], [b]) => a - b)
      .map(([, value]) => value);
  }, [days]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-zinc-200">Risk Heatmap</h3>
        <p className="text-xs text-zinc-400">
          Highlights days with concentrated capital or large drawdowns.
        </p>
      </div>

      <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/80 p-3 h-40 flex flex-col justify-center">
        <div className="grid grid-cols-[auto,1fr] gap-2">
          {/* y-axis labels */}
          <div className="flex flex-col justify-between py-1 text-[10px] text-zinc-500 h-[100px]">
            {weekdayLabels.map((label) => (
              <div key={label} className="flex items-center h-3">
                {label}
              </div>
            ))}
          </div>

          {/* heatmap cells */}
          <div className="flex gap-1 overflow-x-auto">
            {weeks.map((weekDays, weekIdx) => (
              <div key={weekIdx} className="flex flex-col justify-between h-[100px]">
                {weekdayLabels.map((_, weekday) => {
                  // Find day in this week that matches the weekday
                  const d = weekDays.find((x) => {
                     const [y, m, day] = x.date.split('-').map(Number);
                     const localDate = new Date(y, m - 1, day);
                     return localDate.getDay() === weekday;
                  });
                  
                  const score = d?.riskScore ?? 0;
                  return (
                    <div
                      key={weekday}
                      className={`h-3 w-3 rounded-[2px] border border-zinc-800/80 ${riskClass(
                        score
                      )}`}
                      title={
                        d
                          ? `${d.date} — risk ${score.toFixed(0)}`
                          : "No trades"
                      }
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-3 flex items-center justify-end gap-2 text-[10px] text-zinc-500">
          <span>Low</span>
          <div className="flex gap-1">
            <span className="h-3 w-3 rounded bg-emerald-500/60" />
            <span className="h-3 w-3 rounded bg-amber-400/70" />
            <span className="h-3 w-3 rounded bg-red-500/70" />
          </div>
          <span>High</span>
        </div>
      </div>
    </div>
  );
}
