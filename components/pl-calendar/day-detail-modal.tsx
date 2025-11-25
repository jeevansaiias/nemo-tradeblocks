"use client";

import { useMemo } from "react";
import { format } from "date-fns";
import { Timer, X } from "lucide-react";

import { useCalendarStore } from "@/lib/stores/calendar-store";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn, formatCurrency } from "@/lib/utils";

interface DayDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface MetricCardProps {
  title: string;
  value: React.ReactNode;
  sub?: string;
  valueClassName?: string;
}

function MetricCard({ title, value, sub, valueClassName }: MetricCardProps) {
  return (
    <Card className="flex h-full flex-col justify-between rounded-xl border border-[#222] bg-background/80 p-4 shadow-none">
      <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {title}
      </div>
      <div className={cn("text-3xl font-bold mt-2", valueClassName)}>{value}</div>
      {sub ? <div className="text-xs text-muted-foreground mt-1">{sub}</div> : null}
    </Card>
  );
}

export function DayDetailModal({ open, onOpenChange }: DayDetailModalProps) {
  const selectedDate = useCalendarStore((s) => s.selectedDate);
  const summary = useCalendarStore((s) => s.getSelectedDaySummary());

  const day = useMemo(() => {
    if (!summary || !selectedDate) return null;
    const utilizationMetrics = summary.utilizationData?.metrics;
    return {
      date: new Date(selectedDate),
      trades: summary.trades ?? [],
      metrics: {
        netPL: summary.realizedPL ?? 0,
        totalTrades: summary.tradeCount ?? (summary.trades?.length ?? 0),
        winRate: summary.winRate ?? 0,
        utilization: {
          avg: utilizationMetrics?.avgUtilization ?? 0,
          peak:
            utilizationMetrics?.peakUtilization ??
            summary.peakUtilizationPercent ??
            0,
          maxPositions:
            utilizationMetrics?.concurrentPositions ??
            utilizationMetrics?.maxConcurrentPositions ??
            0,
        },
      },
    };
  }, [selectedDate, summary]);

  const tradeRows = useMemo(() => {
    if (!day) return [];
    return day.trades.map((t, i) => {
      const time = t.dateOpened ? format(new Date(t.dateOpened), "HH:mm") : "-";
      const strategy = t.strategy || "Unknown";
      const shortStrategy =
        strategy.length > 14 ? `${strategy.slice(0, 14)}…` : strategy;
      const legsRaw = t.legs || "-";
      const legsLabel = `${legsRaw.slice(0, 12)}${
        legsRaw.length > 12 ? "…" : ""
      }${t.dateOpened ? ` • ${format(new Date(t.dateOpened), "MMM d")}` : ""}`;
      const pl = t.pl ?? 0;
      return {
        id: t.id?.toString() || `trade-${i}`,
        time,
        strategy,
        shortStrategy,
        legsRaw,
        legsLabel,
        pl,
      };
    });
  }, [day]);

  if (!day) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl gap-0 overflow-hidden rounded-2xl border border-[#222] bg-background/95 p-0 shadow-2xl">
        <DialogHeader className="sr-only">
          <DialogTitle>Daily Performance Review</DialogTitle>
        </DialogHeader>

        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#222] bg-background/90 px-6 py-4">
          <div>
            <h2 className="text-2xl font-semibold text-foreground">
              {format(day.date, "MMMM d, yyyy")}
            </h2>
            <p className="text-sm text-muted-foreground">Daily Performance Review</p>
          </div>
          <DialogClose className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
            <X className="h-5 w-5" aria-hidden />
            <span className="sr-only">Close</span>
          </DialogClose>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-1 gap-4 border-b border-[#222] px-6 py-6 md:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            title="Net P/L"
            value={formatCurrency(day.metrics.netPL)}
            valueClassName={
              day.metrics.netPL >= 0 ? "text-emerald-400" : "text-rose-400"
            }
          />
          <MetricCard title="Total Trades" value={day.metrics.totalTrades} />
          <MetricCard
            title="Win Rate"
            value={`${Math.round(day.metrics.winRate)}%`}
          />
          <MetricCard
            title="Utilization"
            value={`${Math.round(day.metrics.utilization.avg)}%`}
            sub={`Peak ${Math.round(
              day.metrics.utilization.peak
            )}% • Max Pos ${day.metrics.utilization.maxPositions ?? 0}`}
          />
        </div>

        {/* Body */}
        <div className="grid grid-cols-1 gap-6 px-6 py-6 lg:grid-cols-[7fr_3fr]">
          {/* Trade Log */}
          <div className="flex flex-col">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-muted-foreground">
              Trade Log{" "}
              <span className="text-xs text-muted-foreground/70">
                ({tradeRows.length} entries)
              </span>
            </h3>

            <Card className="overflow-hidden rounded-xl border border-[#222] bg-background/80">
              <div className="max-h-[260px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-10 border-b border-[#222] bg-background/90 text-xs uppercase text-muted-foreground backdrop-blur">
                    <tr>
                      <th className="p-3 text-left font-medium">Time</th>
                      <th className="p-3 text-left font-medium">Strategy</th>
                      <th className="p-3 text-left font-medium">Legs</th>
                      <th className="p-3 text-right font-medium">P/L</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tradeRows.length === 0 && (
                      <tr>
                        <td
                          colSpan={4}
                          className="p-6 text-center text-xs text-muted-foreground"
                        >
                          No trades recorded for this day.
                        </td>
                      </tr>
                    )}
                    {tradeRows.map((t) => (
                      <tr
                        key={t.id}
                        className="border-b border-[#222]/80 transition-colors last:border-0 hover:bg-muted/40"
                      >
                        <td className="p-3 font-mono text-xs text-muted-foreground">
                          {t.time}
                        </td>
                        <td className="p-3 text-sm font-medium text-foreground">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="cursor-help border-b border-dashed border-muted-foreground/40">
                                  {t.shortStrategy}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{t.strategy}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </td>
                        <td className="p-3 text-xs text-muted-foreground">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="block max-w-[220px] truncate cursor-help">
                                  {t.legsLabel}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="max-w-xs whitespace-pre-wrap">
                                  {t.legsRaw}
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </td>
                        <td
                          className={cn(
                            "p-3 text-right font-mono font-medium",
                            (t.pl || 0) >= 0 ? "text-emerald-400" : "text-rose-400"
                          )}
                        >
                          {formatCurrency(t.pl || 0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>

          {/* Right column */}
          <div className="min-w-[280px] space-y-6">
            <div className="space-y-2">
              <h3 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
                Trade Timing
              </h3>
              <Card className="flex h-32 items-center justify-center rounded-xl border border-dashed border-[#333] bg-muted/30 text-xs text-muted-foreground gap-2">
                <Timer className="h-5 w-5 opacity-60" aria-hidden />
                <span>Coming soon</span>
              </Card>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
                Daily Notes
              </h3>
              <Card className="rounded-xl border border-[#222] bg-background/80">
                <textarea
                  className="min-h-[140px] w-full resize-none bg-transparent p-4 text-sm text-muted-foreground outline-none"
                  placeholder="Notes for this day (future use)"
                  disabled
                />
              </Card>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
