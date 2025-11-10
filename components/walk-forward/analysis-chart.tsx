"use client";

import type { Data } from "plotly.js";
import { useMemo } from "react";

import { ChartWrapper } from "@/components/performance-charts/chart-wrapper";
import { Card, CardContent } from "@/components/ui/card";
import type { WalkForwardPeriodResult } from "@/lib/models/walk-forward";

interface WalkForwardAnalysisChartProps {
  periods: WalkForwardPeriodResult[];
  targetMetricLabel: string;
}

export function WalkForwardAnalysisChart({
  periods,
  targetMetricLabel,
}: WalkForwardAnalysisChartProps) {
  const periodSignature = useMemo(() => {
    if (!periods.length) return "empty";

    return periods
      .map((period) => {
        const inSampleStart = new Date(period.inSampleStart).toISOString();
        const outOfSampleEnd = new Date(period.outOfSampleEnd).toISOString();
        const oosMetric = period.targetMetricOutOfSample.toFixed(4);

        return `${inSampleStart}-${outOfSampleEnd}-${oosMetric}`;
      })
      .join("|");
  }, [periods]);

  const timeline = useMemo(() => {
    if (!periods.length) {
      return null;
    }
    const midpoint = (start: Date, end: Date) =>
      new Date(
        (new Date(start).getTime() + new Date(end).getTime()) / 2
      ).toISOString();

    const inSampleTrace: Data = {
      type: "scatter",
      mode: "lines+markers",
      name: "In-Sample",
      x: periods.map((period) =>
        midpoint(period.inSampleStart, period.inSampleEnd)
      ),
      y: periods.map((period) =>
        Number(period.targetMetricInSample.toFixed(3))
      ),
      marker: { color: "#2563eb", size: 8 },
      line: { width: 2, color: "#2563eb" },
      hovertemplate:
        `<b>In-Sample</b><br>${targetMetricLabel}: %{y:.3f}<br>` +
        `Window: %{x}<extra></extra>`,
    };

    const outSampleTrace: Data = {
      type: "scatter",
      mode: "lines+markers",
      name: "Out-of-Sample",
      x: periods.map((period) =>
        midpoint(period.outOfSampleStart, period.outOfSampleEnd)
      ),
      y: periods.map((period) =>
        Number(period.targetMetricOutOfSample.toFixed(3))
      ),
      marker: { color: "#f97316", size: 8 },
      line: { width: 2, dash: "dot", color: "#f97316" },
      hovertemplate:
        `<b>Out-of-Sample</b><br>${targetMetricLabel}: %{y:.3f}<br>` +
        `Window: %{x}<extra></extra>`,
    };

    const shapes = periods.flatMap((period) => [
      {
        type: "rect" as const,
        xref: "x" as const,
        yref: "paper" as const,
        x0: period.inSampleStart.toISOString(),
        x1: period.inSampleEnd.toISOString(),
        y0: 0,
        y1: 0.45,
        fillcolor: "rgba(37,99,235,0.08)",
        line: { width: 0 },
      },
      {
        type: "rect" as const,
        xref: "x" as const,
        yref: "paper" as const,
        x0: period.outOfSampleStart.toISOString(),
        x1: period.outOfSampleEnd.toISOString(),
        y0: 0.55,
        y1: 1,
        fillcolor: "rgba(249,115,22,0.08)",
        line: { width: 0 },
      },
    ]);

    return {
      data: [inSampleTrace, outSampleTrace],
      layout: {
        title: undefined,
        xaxis: {
          title: { text: "Timeline" },
          type: "date" as const,
          tickformat: "%b %d",
        },
        yaxis: {
          title: { text: targetMetricLabel },
          zeroline: true,
        },
        shapes,
        legend: {
          orientation: "h" as const,
          y: -0.4,
          yanchor: "top" as const,
          x: 0,
          xanchor: "left" as const,
        },
        margin: { b: 110 },
      },
    };
  }, [periods, targetMetricLabel]);

  const parameterEvolution = useMemo(() => {
    const parameterKeys = Array.from(
      new Set(
        periods.flatMap((period) => Object.keys(period.optimalParameters))
      )
    );

    if (parameterKeys.length === 0) {
      return null;
    }

    const traces: Data[] = parameterKeys.map((key) => {
      const friendlyName = key.startsWith("strategy:")
        ? `Strategy: ${key.replace("strategy:", "")}`
        : key;

      return {
        type: "scatter",
        mode: "lines+markers",
        name: friendlyName,
        x: periods.map((_, index) => `Period ${index + 1}`),
        y: periods.map((period) => period.optimalParameters[key] ?? null),
        connectgaps: true,
      };
    });

    return {
      data: traces,
      layout: {
        title: undefined,
        xaxis: { title: { text: "Optimization Window" } },
        yaxis: { title: { text: "Parameter Value" } },
        legend: {
          orientation: "h" as const,
          y: -0.4,
          yanchor: "top" as const,
          x: 0,
          xanchor: "left" as const,
        },
        margin: { b: 110 },
      },
    };
  }, [periods]);

  if (!timeline) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Run an analysis to unlock timeline insights.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <ChartWrapper
        key={`timeline-${periodSignature}-${targetMetricLabel}`}
        title="Performance Timeline"
        description="Compare in-sample versus out-of-sample performance along the rolling windows."
        headerAddon={
          <div className="flex gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-blue-500/80" />
              In-Sample Window
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-orange-500/80" />
              Out-of-Sample Window
            </span>
          </div>
        }
        data={timeline.data}
        layout={timeline.layout}
      />
      {parameterEvolution ? (
        <ChartWrapper
          key={`parameters-${periodSignature}`}
          title="Parameter Evolution"
          description="Track how optimal sizing or risk parameters changed across walk-forward runs."
          data={parameterEvolution.data}
          layout={parameterEvolution.layout}
        />
      ) : (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No optimizable parameters were recorded for these periods.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
