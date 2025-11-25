"use client";

import { CalendarDaySummary } from "@/lib/services/calendar-data-service";
import { cn } from "@/lib/utils";

interface RiskHeatmapProps {
  days: CalendarDaySummary[];
}

interface RiskDay {
  date: string;
  weekIndex: number;
  weekdayIndex: number;
  riskScore: number; // 0..1
}

const riskLevelClass = (score: number) => {
  if (score === 0) return "bg-neutral-900/80 border-neutral-800";
  if (score < 0.33) return "bg-emerald-900/40 border-emerald-900/60";
  if (score < 0.66) return "bg-amber-900/50 border-amber-900/70";
  return "bg-red-900/60 border-red-900/80";
};

export function RiskHeatmap({ days }: RiskHeatmapProps) {
  if (!days.length) return null;

  // Calculate week/weekday indices
  // Assuming days belong to the same month/year mostly, or we handle it by date
  // For a generic heatmap, we might want to align by actual calendar weeks.
  // But for a "Monthly" view, we usually want row 0 to be the first week of that month.
  
  // Let's find the start of the month from the first day (assuming sorted or we sort)
  const sortedDays = [...days].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const firstDate = new Date(sortedDays[0].date);
  const year = firstDate.getFullYear();
  const month = firstDate.getMonth();
  
  // First day of the month
  const monthStart = new Date(year, month, 1);
  const startDayOfWeek = monthStart.getDay(); // 0=Sun

  const riskData: RiskDay[] = sortedDays.map(d => {
    const dateObj = new Date(d.date);
    const dayOfMonth = dateObj.getDate();
    // Calculate week index relative to the start of the month grid
    // The grid starts at the first Sunday that includes the 1st, or just the 1st row?
    // Usually calendar grids start with empty cells if 1st is not Sunday.
    // Here we want to map specific dates to (col, row).
    // User asked for: 7 rows (Sun-Sat), N columns (weeks).
    // GitHub contribution graph is 7 rows (days) x 52 columns (weeks).
    // So:
    // Row = weekday (0-6)
    // Col = week index
    
    const weekdayIndex = dateObj.getDay();
    // Week index:
    // If we start from the very first day of the month's week (which might be in prev month)
    // Let's just use: (dayOfMonth + startDayOfWeek - 1) / 7
    const weekIndex = Math.floor((dayOfMonth + startDayOfWeek - 1) / 7);
    
    return {
      date: d.date,
      weekIndex,
      weekdayIndex,
      riskScore: (d.riskScore || 0) / 100 // Normalize 0-100 to 0-1
    };
  });

  const byCoords = new Map<string, RiskDay>();
  riskData.forEach((d) =>
    byCoords.set(`${d.weekIndex}-${d.weekdayIndex}`, d),
  );

  const weeks = Math.max(4, Math.max(...riskData.map((d) => d.weekIndex)) + 1);

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-medium text-neutral-200">Risk Heatmap</h3>
        <p className="text-xs text-neutral-500 max-w-sm">
          Highlights days with concentrated capital or large drawdowns.
        </p>
      </div>

      <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 px-4 py-4">
        <div className="flex gap-4">
          {/* Y axis labels */}
          <div className="flex flex-col justify-between text-[10px] text-neutral-500 py-1 pr-2">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <span key={d} className="h-6 flex items-center">
                {d}
              </span>
            ))}
          </div>

          {/* Grid */}
          <div className="flex-1 overflow-x-auto">
            <div
              className="grid"
              style={{
                gridTemplateColumns: `repeat(${weeks}, minmax(0, 1fr))`,
                gridTemplateRows: "repeat(7, 1.6rem)",
                gap: "0.25rem",
              }}
            >
              {Array.from({ length: 7 }).map((_, row) =>
                Array.from({ length: weeks }).map((_, col) => {
                  const key = `${col}-${row}`;
                  const day = byCoords.get(key);
                  return (
                    <div
                      key={key}
                      className={cn(
                        "rounded-md border transition-colors",
                        day
                          ? riskLevelClass(day.riskScore)
                          : "bg-neutral-900/40 border-neutral-900",
                      )}
                      title={
                        day
                          ? `${day.date} • Risk score ${(day.riskScore * 100).toFixed(0)}%`
                          : "No trades"
                      }
                    />
                  );
                }),
              )}
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="mt-4 flex items-center justify-end gap-3 text-[11px] text-neutral-500">
          <span className="mr-1">Low</span>
          <span className="h-3 w-3 rounded-full bg-emerald-900/60" />
          <span className="h-3 w-3 rounded-full bg-amber-900/70" />
          <span className="h-3 w-3 rounded-full bg-red-900/80" />
          <span className="ml-1">High</span>
        </div>
      </div>
    </div>
  );
}
