"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { AlertTriangle, CalendarIcon, Loader2, Target } from "lucide-react";
import { DateRange } from "react-day-picker";

import { TPSLOptimizerPanel } from "@/components/performance-charts/tpsl-optimizer-panel";
import { MultiSelect } from "@/components/multi-select";
import { SizingModeToggle } from "@/components/sizing-mode-toggle";
import { Button } from "@/components/ui/button";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useBlockStore } from "@/lib/stores/block-store";
import { usePerformanceStore } from "@/lib/stores/performance-store";
import { cn } from "@/lib/utils";

const NORMALIZE_KEY_PREFIX = "tpsl:normalizeTo1Lot:";

export default function TpSlOptimizerPage() {
  const activeBlock = useBlockStore((state) => {
    const activeBlockId = state.activeBlockId;
    return activeBlockId ? state.blocks.find((block) => block.id === activeBlockId) : null;
  });
  const isBlockLoading = useBlockStore((state) => state.isLoading);
  const blockIsInitialized = useBlockStore((state) => state.isInitialized);
  const loadBlocks = useBlockStore((state) => state.loadBlocks);

  const {
    isLoading,
    error,
    fetchPerformanceData,
    data,
    setDateRange,
    setSelectedStrategies,
    normalizeTo1Lot,
    setNormalizeTo1Lot,
  } = usePerformanceStore();

  const [dateRange, setLocalDateRange] = useState<DateRange | undefined>(undefined);

  const handleDateRangeChange = (newDateRange: DateRange | undefined) => {
    setLocalDateRange(newDateRange);
    setDateRange({
      from: newDateRange?.from,
      to: newDateRange?.to,
    });
  };

  useEffect(() => {
    if (!blockIsInitialized) {
      loadBlocks().catch(console.error);
    }
  }, [blockIsInitialized, loadBlocks]);

  const activeBlockId = activeBlock?.id;

  useEffect(() => {
    if (!activeBlockId) return;
    fetchPerformanceData(activeBlockId).catch(console.error);
  }, [activeBlockId, fetchPerformanceData]);

  useEffect(() => {
    if (!activeBlockId || typeof window === "undefined") return;
    const storageKey = `${NORMALIZE_KEY_PREFIX}${activeBlockId}`;
    const stored = window.localStorage.getItem(storageKey);
    setNormalizeTo1Lot(stored === "true");
  }, [activeBlockId, setNormalizeTo1Lot]);

  useEffect(() => {
    if (!activeBlockId || typeof window === "undefined") return;
    const storageKey = `${NORMALIZE_KEY_PREFIX}${activeBlockId}`;
    window.localStorage.setItem(storageKey, normalizeTo1Lot ? "true" : "false");
  }, [activeBlockId, normalizeTo1Lot]);

  const getStrategyOptions = () => {
    if (!data || data.allTrades.length === 0) return [];
    const uniqueStrategies = [...new Set(data.allTrades.map((trade) => trade.strategy || "Unknown"))];
    return uniqueStrategies.map((strategy) => ({
      label: strategy,
      value: strategy,
    }));
  };

  if (!blockIsInitialized || isBlockLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin" />
          <p className="text-muted-foreground">Loading blocks...</p>
        </div>
      </div>
    );
  }

  if (!activeBlock) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="max-w-md text-center">
          <AlertTriangle className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          <h3 className="mb-2 text-lg font-semibold">No Active Block Selected</h3>
          <p className="text-muted-foreground">Select a block from the sidebar to run TP/SL simulations.</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin" />
          <p className="text-muted-foreground">Loading {activeBlock.name} data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="max-w-md text-center">
          <AlertTriangle className="mx-auto mb-4 h-12 w-12 text-red-500" />
          <h3 className="mb-2 text-lg font-semibold">Error Loading Data</h3>
          <p className="text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  if (!data || data.allTrades.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="max-w-md text-center">
          <AlertTriangle className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          <h3 className="mb-2 text-lg font-semibold">No Trade Data</h3>
          <p className="text-muted-foreground">Upload trades to run TP/SL what-if simulations.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-2">
          <Label>Date Range</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-[280px] justify-start text-left font-normal",
                  !dateRange && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateRange?.from ? (
                  dateRange.to ? (
                    <>
                      {format(dateRange.from, "LLL dd, y")} - {format(dateRange.to, "LLL dd, y")}
                    </>
                  ) : (
                    format(dateRange.from, "LLL dd, y")
                  )
                ) : (
                  <span>All time</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <DateRangePicker date={dateRange} onDateChange={handleDateRangeChange} />
            </PopoverContent>
          </Popover>
        </div>

        <div className="min-w-[250px] flex-1 space-y-2">
          <Label>Strategies</Label>
          <MultiSelect
            options={getStrategyOptions()}
            onValueChange={setSelectedStrategies}
            placeholder="All strategies"
            maxCount={3}
            hideSelectAll
            className="w-full"
          />
        </div>

        <SizingModeToggle
          id="tpsl-normalize"
          className="min-w-[240px] flex-1"
          checked={normalizeTo1Lot}
          onCheckedChange={setNormalizeTo1Lot}
          title="Normalize to 1-lot"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Target className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">TP/SL Optimizer</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Simulate take-profit and stop-loss grids using MFE/MAE excursion data from the active block.
        </p>
      </div>

      <TPSLOptimizerPanel />
    </div>
  );
}
