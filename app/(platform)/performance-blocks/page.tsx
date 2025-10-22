"use client";

import { useBlockStore } from "@/lib/stores/block-store";
import { usePerformanceStore } from "@/lib/stores/performance-store";
import { format } from "date-fns";
import {
  AlertTriangle,
  BarChart3,
  CalendarIcon,
  Gauge,
  Loader2,
  TrendingUp,
  Zap,
} from "lucide-react";
import { useEffect, useState } from "react";
import { DateRange as ReactDateRange } from "react-day-picker";
import { DateRange } from "@/lib/stores/performance-store";

// Chart Components
import { DayOfWeekChart } from "@/components/performance-charts/day-of-week-chart";
import { DrawdownChart } from "@/components/performance-charts/drawdown-chart";
import { EquityCurveChart } from "@/components/performance-charts/equity-curve-chart";
import { ExitReasonChart } from "@/components/performance-charts/exit-reason-chart";
import { HoldingDurationChart } from "@/components/performance-charts/holding-duration-chart";
import { MarginUtilizationChart } from "@/components/performance-charts/margin-utilization-chart";
import { MFEMAEScatterChart } from "@/components/performance-charts/mfe-mae-scatter-chart";
import { MonthlyReturnsChart } from "@/components/performance-charts/monthly-returns-chart";
import { PremiumEfficiencyChart } from "@/components/performance-charts/premium-efficiency-chart";
import { ReturnDistributionChart } from "@/components/performance-charts/return-distribution-chart";
import { RiskEvolutionChart } from "@/components/performance-charts/risk-evolution-chart";
import { RollingMetricsChart } from "@/components/performance-charts/rolling-metrics-chart";
import { ROMTimelineChart } from "@/components/performance-charts/rom-timeline-chart";
import { TradeSequenceChart } from "@/components/performance-charts/trade-sequence-chart";
import { VixRegimeChart } from "@/components/performance-charts/vix-regime-chart";
import { WinLossStreaksChart } from "@/components/performance-charts/win-loss-streaks-chart";

// UI Components
import { MultiSelect } from "@/components/multi-select";
import { Button } from "@/components/ui/button";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export default function PerformanceBlocksPage() {
  // Block store
  const activeBlock = useBlockStore((state) => {
    const activeBlockId = state.activeBlockId;
    return activeBlockId
      ? state.blocks.find((block) => block.id === activeBlockId)
      : null;
  });
  const isBlockLoading = useBlockStore((state) => state.isLoading);
  const blockIsInitialized = useBlockStore((state) => state.isInitialized);
  const loadBlocks = useBlockStore((state) => state.loadBlocks);

  // Performance store
  const {
    isLoading,
    error,
    fetchPerformanceData,
    data,
    setDateRange,
    setSelectedStrategies,
  } = usePerformanceStore();

  // Local state for date range picker
  const [dateRange, setLocalDateRange] = useState<DateRange | undefined>(
    undefined
  );

  // Handle date range changes
    const handleDateRangeChange = (newDateRange: ReactDateRange | undefined) => {
    console.log('Date range changed:', newDateRange);
    setDateRange({
      from: newDateRange?.from,
      to: newDateRange?.to,
    });
  };

  // Initialize blocks if needed
  useEffect(() => {
    if (!blockIsInitialized) {
      loadBlocks().catch(console.error);
    }
  }, [blockIsInitialized, loadBlocks]);

  // Fetch performance data when active block changes
  const activeBlockId = activeBlock?.id;

  useEffect(() => {
    if (!activeBlockId) return;

    fetchPerformanceData(activeBlockId).catch(console.error);
  }, [activeBlockId, fetchPerformanceData]);

  // Helper functions
  const getStrategyOptions = () => {
    if (!data || data.allTrades.length === 0) return [];

    const uniqueStrategies = [
      ...new Set(data.allTrades.map((trade) => trade.strategy || "Unknown")),
    ];
    return uniqueStrategies.map((strategy) => ({
      label: strategy,
      value: strategy,
    }));
  };

  // Show loading state
  if (!blockIsInitialized || isBlockLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading blocks...</p>
        </div>
      </div>
    );
  }

  // Show message if no active block
  if (!activeBlock) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center max-w-md">
          <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">
            No Active Block Selected
          </h3>
          <p className="text-muted-foreground mb-4">
            Please select a block from the sidebar to view its performance
            analysis.
          </p>
        </div>
      </div>
    );
  }

  // Show loading state for performance data
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">
            Loading {activeBlock.name} performance data...
          </p>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center max-w-md">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">
            Error Loading Performance Data
          </h3>
          <p className="text-muted-foreground mb-4">{error}</p>
        </div>
      </div>
    );
  }

  // Show empty state if no data
  if (!data || data.allTrades.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center max-w-md">
          <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Trade Data</h3>
          <p className="text-muted-foreground mb-4">
            This block doesn&apos;t contain any trades yet. Upload trading data
            to see performance analytics.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
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
                      {format(dateRange.from, "LLL dd, y")} -{" "}
                      {format(dateRange.to, "LLL dd, y")}
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
              <DateRangePicker
                date={dateRange}
                onDateChange={handleDateRangeChange}
              />
            </PopoverContent>
          </Popover>
        </div>
        <div className="space-y-2 flex-1 min-w-[250px]">
          <Label>Strategies</Label>
          <MultiSelect
            options={getStrategyOptions()}
            onValueChange={setSelectedStrategies}
            placeholder="All strategies"
            maxCount={3}
            className="w-full"
          />
        </div>
      </div>

      {/* Tabbed Interface */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList>
          <TabsTrigger value="overview" className="px-2.5 sm:px-3">
            <code className="flex items-center gap-1 text-[13px] [&>svg]:h-4 [&>svg]:w-4">
              <BarChart3 /> Overview
            </code>
          </TabsTrigger>
          <TabsTrigger value="returns" className="px-2.5 sm:px-3">
            <code className="flex items-center gap-1 text-[13px] [&>svg]:h-4 [&>svg]:w-4">
              <TrendingUp /> Returns Analysis
            </code>
          </TabsTrigger>
          <TabsTrigger value="risk" className="px-2.5 sm:px-3">
            <code className="flex items-center gap-1 text-[13px] [&>svg]:h-4 [&>svg]:w-4">
              <Gauge /> Risk & Margin
            </code>
          </TabsTrigger>
          <TabsTrigger value="efficiency" className="px-2.5 sm:px-3">
            <code className="flex items-center gap-1 text-[13px] [&>svg]:h-4 [&>svg]:w-4">
              <Zap /> Trade Efficiency
            </code>
          </TabsTrigger>
          <TabsTrigger value="excursion" className="px-2.5 sm:px-3">
            <code className="flex items-center gap-1 text-[13px] [&>svg]:h-4 [&>svg]:w-4">
              <AlertTriangle /> Excursion Analysis (Beta)
            </code>
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Overview */}
        <TabsContent value="overview" className="space-y-6">
          <EquityCurveChart />
          <DrawdownChart />
          <WinLossStreaksChart />
        </TabsContent>

        {/* Tab 2: Returns Analysis */}
        <TabsContent value="returns" className="space-y-6">
          <MonthlyReturnsChart />
          <ReturnDistributionChart />
          <DayOfWeekChart />
          <TradeSequenceChart />
          <RollingMetricsChart />
          <VixRegimeChart />
        </TabsContent>

        {/* Tab 3: Risk & Margin */}
        <TabsContent value="risk" className="space-y-6">
          <ROMTimelineChart />
          <MarginUtilizationChart />
          <RiskEvolutionChart />
          <HoldingDurationChart />
        </TabsContent>

        {/* Tab 4: Trade Efficiency */}
        <TabsContent value="efficiency" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ExitReasonChart />
            <PremiumEfficiencyChart />
          </div>
          {/* Additional efficiency metrics can go here */}
        </TabsContent>

        {/* Tab 5: Excursion Analysis */}
        <TabsContent value="excursion" className="space-y-6">
          <MFEMAEScatterChart />
        </TabsContent>
      </Tabs>
    </div>
  );
}
