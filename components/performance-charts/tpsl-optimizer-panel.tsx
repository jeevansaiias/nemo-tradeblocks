"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { usePerformanceStore } from "@/lib/stores/performance-store";
import type { TPSlScenarioConfig } from "@/lib/types/exit-optimization";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Trade } from "@/lib/models/trade";

function formatPct(value: number, digits = 1) {
  if (!isFinite(value)) return "–";
  return `${value.toFixed(digits)}%`;
}

function formatCurrency(value: number) {
  if (!isFinite(value)) return "–";
  return value.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

export function TPSLOptimizerPanel() {
  const {
    data,
    tpSlBasis,
    tpSlGrid,
    tpSlResults,
    setTpSlBasis,
    setTpSlGrid,
    runTpSlOptimizer,
    isLoading,
  } = usePerformanceStore();

  if (!data?.mfeMaeData || data.mfeMaeData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>TP/SL Optimizer (MFE/MAE Edition)</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Load an active block with excursion data to simulate alternate TP/SL
          rules.
        </CardContent>
      </Card>
    );
  }

  const handleGridChange = (index: number, field: keyof TPSlScenarioConfig, value: string) => {
    const numeric = Number(value);
    const updated = [...tpSlGrid];
    updated[index] = {
      ...updated[index],
      [field]: isFinite(numeric) ? numeric : updated[index][field],
    };
    setTpSlGrid(updated);
  };

  const addRow = () => {
    setTpSlGrid([...tpSlGrid, { tpPct: 25, slPct: -10 }]);
  };

  const removeRow = (index: number) => {
    const next = tpSlGrid.filter((_, i) => i !== index);
    setTpSlGrid(next.length ? next : [{ tpPct: 20, slPct: -10 }]);
  };

  // Baseline metrics for the selected basis using filtered trades
  const computeBaseline = (trades: Trade[], basis: "margin" | "premium") => {
    let totalReturnPct = 0;
    let totalPl = 0;
    let count = 0;

    trades.forEach((trade) => {
      const denom =
        basis === "margin"
          ? trade.marginReq
          : typeof trade.premium === "number"
            ? trade.premium
            : undefined;

      if (!denom || denom === 0) return;

      const returnPct = (trade.pl / denom) * 100;
      totalReturnPct += returnPct;
      totalPl += trade.pl;
      count += 1;
    });

    const avgReturnPct = count > 0 ? totalReturnPct / count : 0;
    return { totalReturnPct, avgReturnPct, totalPl, trades: count };
  };

  const baseline = computeBaseline(data.trades, tpSlBasis);
  const bestScenario =
    tpSlResults && tpSlResults.length > 0
      ? [...tpSlResults].sort((a, b) => {
          // Prioritize average return pct (quality), then total return (size), then win rate
          if (b.avgReturnPct !== a.avgReturnPct) {
            return b.avgReturnPct - a.avgReturnPct;
          }
          if (b.totalReturnPct !== a.totalReturnPct) {
            return b.totalReturnPct - a.totalReturnPct;
          }
          return b.winRate - a.winRate;
        })[0]
      : null;

  const deltaReturnPct =
    bestScenario && baseline.trades > 0
      ? bestScenario.totalReturnPct - baseline.totalReturnPct
      : 0;
  const deltaPl =
    bestScenario && baseline.trades > 0
      ? bestScenario.totalPl - baseline.totalPl
      : 0;

  return (
    <Card>
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <CardTitle>TP/SL Optimizer (MFE/MAE Edition)</CardTitle>
          <p className="text-sm text-muted-foreground">
            Uses existing excursion data to simulate alternate exit rules.
          </p>
          {bestScenario && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Badge variant="secondary">
                Best: TP {formatPct(bestScenario.tpPct, 0)} / SL{" "}
                {formatPct(bestScenario.slPct, 0)} ({bestScenario.basis})
              </Badge>
              <span className="text-foreground">
                Δ Return: {formatPct(deltaReturnPct, 2)} • Δ P/L: {formatCurrency(deltaPl)}
              </span>
            </div>
          )}
        </div>
        <Badge variant="secondary">What-if</Badge>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-[200px,1fr]">
          <div className="space-y-2">
            <Label htmlFor="basis-select">Basis</Label>
            <Select
              value={tpSlBasis}
              onValueChange={(value) => setTpSlBasis(value as typeof tpSlBasis)}
              disabled={isLoading}
            >
              <SelectTrigger id="basis-select">
                <SelectValue placeholder="Select basis" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="margin">Margin %</SelectItem>
                <SelectItem value="premium">Premium %</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Matches the normalization used in excursion analysis.
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Scenario Grid</Label>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={addRow} disabled={isLoading}>
                  Add row
                </Button>
                <Button variant="default" size="sm" onClick={() => runTpSlOptimizer()} disabled={isLoading}>
                  Run scenarios
                </Button>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              {tpSlGrid.map((row, index) => (
                <div
                  key={`${row.tpPct}-${row.slPct}-${index}`}
                  className="rounded-lg border bg-card/40 p-3 space-y-3"
                >
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Scenario {index + 1}</span>
                    <button
                      className="text-destructive hover:underline"
                      onClick={() => removeRow(index)}
                      type="button"
                      aria-label={`Remove scenario ${index + 1}`}
                    >
                      Remove
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor={`tp-${index}`} className="text-xs">
                        TP %
                      </Label>
                      <Input
                        id={`tp-${index}`}
                        type="number"
                        inputMode="decimal"
                        step="1"
                        value={row.tpPct}
                        onChange={(e) => handleGridChange(index, "tpPct", e.target.value)}
                        disabled={isLoading}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`sl-${index}`} className="text-xs">
                        SL %
                      </Label>
                      <Input
                        id={`sl-${index}`}
                        type="number"
                        inputMode="decimal"
                        step="1"
                        value={row.slPct}
                        onChange={(e) => handleGridChange(index, "slPct", e.target.value)}
                        disabled={isLoading}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Scenario Results</h3>
            <p className="text-xs text-muted-foreground">
              Based on {data.filteredTrades.length} filtered trades.
            </p>
          </div>
          {tpSlResults && tpSlResults.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Basis</TableHead>
                  <TableHead>TP %</TableHead>
                  <TableHead>SL %</TableHead>
                  <TableHead>Win Rate</TableHead>
                  <TableHead>Avg Return</TableHead>
                  <TableHead>Total Return</TableHead>
                  <TableHead>Total P/L</TableHead>
                  <TableHead>TP Hits</TableHead>
                  <TableHead>SL Hits</TableHead>
                  <TableHead>Trades</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tpSlResults.map((result) => (
                  <TableRow key={result.id}>
                    <TableCell className="capitalize">{result.basis}</TableCell>
                    <TableCell>{formatPct(result.tpPct, 0)}</TableCell>
                    <TableCell>{formatPct(result.slPct, 0)}</TableCell>
                    <TableCell>{formatPct(result.winRate, 1)}</TableCell>
                    <TableCell>{formatPct(result.avgReturnPct, 2)}</TableCell>
                    <TableCell>{formatPct(result.totalReturnPct, 2)}</TableCell>
                    <TableCell>{formatCurrency(result.totalPl)}</TableCell>
                    <TableCell>{result.tpHits}</TableCell>
                    <TableCell>{result.slHits}</TableCell>
                    <TableCell>{result.trades}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableCaption>
                Simulated outcomes using per-trade MFE/MAE excursions; unchanged trades retain
                original returns.
              </TableCaption>
            </Table>
          ) : (
            <div className="rounded-md border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
              No TP/SL simulations yet. Adjust the grid and run scenarios.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
