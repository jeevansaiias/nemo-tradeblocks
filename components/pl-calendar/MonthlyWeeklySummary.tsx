import React from "react";
import type { WeeklySummary } from "@/lib/services/calendar-data-service";
import { formatCompactCurrency } from "@/lib/formatters/number-format";

interface MonthlyWeeklySummaryProps {
  weeklySummaries: WeeklySummary[];
}

export const MonthlyWeeklySummary: React.FC<MonthlyWeeklySummaryProps> = ({
  weeklySummaries,
}) => {
  if (!weeklySummaries.length) return null;

  return (
    <aside className="flex h-full flex-col gap-3 rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4 text-sm">
      <header className="flex items-center justify-between">
        <div className="font-mono text-xs uppercase tracking-[0.18em] text-zinc-400">
          Weekly P/L
        </div>
        <div className="text-[0.7rem] text-zinc-500">
          {weeklySummaries.length} weeks
        </div>
      </header>

      <div className="flex flex-col gap-2 overflow-y-auto">
        {weeklySummaries.map((week) => {
          const isPositive = week.netPL >= 0;
          const plColor = isPositive ? "text-emerald-400" : "text-rose-400";
          const bgColor = isPositive
            ? "bg-emerald-500/10"
            : "bg-rose-500/10";

          return (
            <div
              key={week.weekLabel}
              className={`flex flex-col gap-1 rounded-xl px-3 py-2 ${bgColor}`}
            >
              <div className="flex items-center justify-between">
                <div className="text-xs font-medium text-zinc-300">
                  {week.weekLabel}
                </div>
                <div className={`font-mono text-sm ${plColor}`}>
                  {formatCompactCurrency(week.netPL)}
                </div>
              </div>

              <div className="flex items-center justify-between text-[0.7rem] text-zinc-500">
                <span>
                  {week.trades} {week.trades === 1 ? "trade" : "trades"}
                </span>
                {week.winRate != null && (
                  <span>{Math.round(week.winRate * 100)}% win</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
};
