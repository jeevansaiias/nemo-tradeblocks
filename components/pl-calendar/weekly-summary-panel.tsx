"use client";

import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { formatCompactPL } from "@/lib/utils/format";
import type { WeeklyBucket, CalendarColorMode } from "@/lib/services/calendar-data-service";

interface WeeklySummaryPanelProps {
  monthStart: Date;
  weeks: WeeklyBucket[];
  metric: CalendarColorMode;
  onWeekHover?: (week: WeeklyBucket | null) => void;
}

export function WeeklySummaryPanel({
  monthStart,
  weeks,
  metric,
  onWeekHover,
}: WeeklySummaryPanelProps) {
  const monthLabel = format(monthStart, "MMMM yyyy");

  return (
    <aside className="flex h-full flex-col gap-4">
      <header className="flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-sm font-medium text-muted-foreground">
            Weekly summary
          </span>
          <span className="text-xs text-muted-foreground/70">
            {monthLabel}
          </span>
        </div>
      </header>

      <div className="flex flex-col gap-3 overflow-y-auto pr-1">
        {weeks.length === 0 && (
          <div className="rounded-xl border border-dashed border-border px-4 py-3 text-xs text-muted-foreground">
            No trades recorded this month.
          </div>
        )}

        {weeks.map((week) => {
          const isProfit = week.netPL > 0;
          const isFlat = week.netPL === 0;
          const plLabel = formatCompactPL(week.netPL);

          return (
            <div
              key={week.weekIndex}
              onMouseEnter={() => onWeekHover?.(week)}
              onMouseLeave={() => onWeekHover?.(null)}
              className={cn(
                "flex cursor-pointer flex-col gap-1 rounded-2xl px-4 py-3 text-sm transition",
                "border bg-card/40 hover:bg-card hover:border-primary/40",
                isProfit &&
                  "border-emerald-500/30 bg-emerald-950/40 hover:bg-emerald-950/60",
                !isProfit &&
                  !isFlat &&
                  "border-red-500/30 bg-red-950/40 hover:bg-red-950/60",
                isFlat && "border-border/60 bg-card/40"
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  Week {week.weekIndex}
                </span>
                <span
                  className={cn(
                    "text-xs font-medium",
                    isProfit && "text-emerald-300",
                    !isProfit && !isFlat && "text-red-300",
                    isFlat && "text-muted-foreground"
                  )}
                >
                  {format(week.startDate, "MMM d")} –{" "}
                  {format(week.endDate, "MMM d")}
                </span>
              </div>

              {/* main P/L line */}
              <div className="flex items-baseline justify-between">
                <div className="flex items-baseline gap-1">
                  <span
                    className={cn(
                      "text-lg font-semibold",
                      isProfit && "text-emerald-300",
                      !isProfit && !isFlat && "text-red-300",
                      isFlat && "text-muted-foreground"
                    )}
                  >
                    {plLabel}
                  </span>
                  <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    {metric === "pl"
                      ? "P/L"
                      : metric === "count"
                      ? "Trades"
                      : metric === "utilization"
                      ? "Util"
                      : "Risk"}
                  </span>
                </div>

                <div className="flex flex-col items-end text-[11px] text-muted-foreground">
                  <span>
                    {week.tradeCount}{" "}
                    {week.tradeCount === 1 ? "trade" : "trades"}
                  </span>
                  <span>{week.daysTraded} days</span>
                  {typeof week.winRate === "number" && (
                    <span>{(week.winRate * 100).toFixed(0)}% win</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
