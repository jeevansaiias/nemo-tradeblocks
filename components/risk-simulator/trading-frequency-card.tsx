"use client";

import { Card } from "@/components/ui/card";
import { TrendingUp, Calendar, Activity } from "lucide-react";
import { useMemo } from "react";
import type { Trade } from "@/lib/models/trade";

interface TradingFrequencyCardProps {
  trades: Trade[];
  tradesPerYear: number;
}

export function TradingFrequencyCard({ trades, tradesPerYear }: TradingFrequencyCardProps) {
  const stats = useMemo(() => {
    if (trades.length < 2) {
      return {
        totalTrades: trades.length,
        daysElapsed: 0,
        monthsElapsed: 0,
        yearsElapsed: 0,
        tradesPerDay: 0,
        tradesPerMonth: 0,
      };
    }

    // Get date range
    const sortedTrades = [...trades].sort(
      (a, b) => a.dateOpened.getTime() - b.dateOpened.getTime()
    );
    const firstDate = sortedTrades[0].dateOpened;
    const lastDate = sortedTrades[sortedTrades.length - 1].dateOpened;

    // Calculate time elapsed
    const daysElapsed = Math.max(
      1,
      (lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    const monthsElapsed = daysElapsed / 30.44; // Average days per month
    const yearsElapsed = daysElapsed / 365.25;

    // Calculate rates
    const tradesPerDay = trades.length / daysElapsed;
    const tradesPerMonth = trades.length / monthsElapsed;

    return {
      totalTrades: trades.length,
      daysElapsed: Math.round(daysElapsed),
      monthsElapsed,
      yearsElapsed,
      tradesPerDay,
      tradesPerMonth,
    };
  }, [trades]);

  // Format the time period nicely
  const formatTimePeriod = () => {
    if (stats.yearsElapsed >= 1) {
      return `${stats.yearsElapsed.toFixed(1)} years`;
    } else if (stats.monthsElapsed >= 1) {
      return `${Math.round(stats.monthsElapsed)} months`;
    } else {
      return `${stats.daysElapsed} days`;
    }
  };

  // Format the trading rate nicely
  const formatTradingRate = () => {
    if (tradesPerYear >= 10000) {
      // High frequency trader
      return `${Math.round(stats.tradesPerDay)} trades/day`;
    } else if (tradesPerYear >= 1000) {
      // Active trader
      return `${Math.round(tradesPerYear / 52)} trades/week`;
    } else if (tradesPerYear >= 100) {
      // Regular trader
      return `${Math.round(stats.tradesPerMonth)} trades/month`;
    } else {
      // Occasional trader
      return `${tradesPerYear} trades/year`;
    }
  };

  return (
    <Card className="p-4 bg-muted/30 border-muted">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-medium">Your Trading Frequency</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <TrendingUp className="h-5 w-5 text-blue-500" />
              <span className="text-2xl font-bold">{tradesPerYear.toLocaleString()}</span>
              <span className="text-lg text-muted-foreground">trades/year</span>
            </div>
            <div className="text-sm text-muted-foreground">
              ({formatTradingRate()})
            </div>
          </div>
        </div>
        <div className="text-right space-y-1">
          <div className="flex items-center gap-1.5 justify-end">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Based on</p>
          </div>
          <p className="text-sm">
            <span className="font-semibold">{stats.totalTrades.toLocaleString()}</span> trades
            over <span className="font-semibold">{formatTimePeriod()}</span>
          </p>
        </div>
      </div>
    </Card>
  );
}