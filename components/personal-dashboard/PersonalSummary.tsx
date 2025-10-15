"use client"

import { useMemo } from "react"
import { TrendingUp, TrendingDown, Calendar, Target, DollarSign, Activity } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  calculatePersonalStats,
  formatCurrency,
  type DailyPersonalPL
} from "@/lib/processing/personal-trade-parser"

interface PersonalSummaryProps {
  dailyPL: DailyPersonalPL[]
}

export function PersonalSummary({ dailyPL }: PersonalSummaryProps) {
  const stats = useMemo(() => calculatePersonalStats(dailyPL), [dailyPL])

  const summaryCards = [
    {
      title: "Total P/L",
      value: formatCurrency(stats.totalPL),
      change: `${stats.totalTrades} trades`,
      icon: Target,
      color: stats.totalPL >= 0 ? "text-green-600" : "text-red-600"
    },
    {
      title: "Win Rate",
      value: `${stats.winRate.toFixed(1)}%`,
      change: `${stats.winningDays}W / ${stats.losingDays}L`,
      icon: TrendingUp,
      color: stats.winRate >= 50 ? "text-green-600" : "text-red-600"
    },
    {
      title: "Average Win",
      value: formatCurrency(stats.avgWin),
      change: `${stats.winningDays} winning days`,
      icon: TrendingUp,
      color: "text-green-600"
    },
    {
      title: "Average Loss",
      value: formatCurrency(stats.avgLoss),
      change: `${stats.losingDays} losing days`,
      icon: TrendingDown,
      color: "text-red-600"
    },
    {
      title: "Best Day",
      value: formatCurrency(stats.bestDay),
      change: "Single day profit",
      icon: TrendingUp,
      color: "text-green-600"
    },
    {
      title: "Worst Day",
      value: formatCurrency(stats.worstDay),
      change: "Single day loss",
      icon: TrendingDown,
      color: "text-red-600"
    },
    {
      title: "Max Drawdown",
      value: formatCurrency(-stats.maxDrawdown),
      change: "Peak to trough",
      icon: TrendingDown,
      color: "text-red-600"
    },
    {
      title: "Total Fees",
      value: formatCurrency(stats.totalFees),
      change: "Commission costs",
      icon: DollarSign,
      color: "text-muted-foreground"
    }
  ]

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {summaryCards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
              <card.icon className={`h-4 w-4 ${card.color}`} />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${card.color}`}>
                {card.value}
              </div>
              <p className="text-xs text-muted-foreground">
                {card.change}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Current Balance Card */}
      {stats.currentBalance > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Account Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Current Balance</span>
                <span className="text-2xl font-bold">
                  {formatCurrency(stats.currentBalance)}
                </span>
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Trading Days</span>
                    <span>{stats.winningDays + stats.losingDays}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Trades</span>
                    <span>{stats.totalTrades}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Avg Trades/Day</span>
                    <span>
                      {stats.winningDays + stats.losingDays > 0 
                        ? (stats.totalTrades / (stats.winningDays + stats.losingDays)).toFixed(1)
                        : '0'}
                    </span>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Profit Factor</span>
                    <span>
                      {stats.avgLoss !== 0 
                        ? Math.abs(stats.avgWin * stats.winningDays / (stats.avgLoss * stats.losingDays)).toFixed(2)
                        : '∞'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Fees</span>
                    <span className="text-red-600">{formatCurrency(stats.totalFees)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Net P/L</span>
                    <span className={stats.totalPL >= 0 ? "text-green-600" : "text-red-600"}>
                      {formatCurrency(stats.totalPL - stats.totalFees)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Performance Insights */}
      <Card>
        <CardHeader>
          <CardTitle>Performance Insights</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {stats.winRate >= 60 && (
              <div className="flex items-center gap-2 text-green-600">
                <TrendingUp className="h-4 w-4" />
                <span className="text-sm">Excellent win rate above 60%</span>
              </div>
            )}
            
            {stats.avgWin > Math.abs(stats.avgLoss) * 1.5 && (
              <div className="flex items-center gap-2 text-green-600">
                <Target className="h-4 w-4" />
                <span className="text-sm">Strong risk-reward ratio</span>
              </div>
            )}
            
            {stats.maxDrawdown < stats.totalPL * 0.1 && stats.totalPL > 0 && (
              <div className="flex items-center gap-2 text-green-600">
                <Activity className="h-4 w-4" />
                <span className="text-sm">Low drawdown relative to profits</span>
              </div>
            )}
            
            {stats.totalFees > Math.abs(stats.totalPL) * 0.1 && (
              <div className="flex items-center gap-2 text-amber-600">
                <DollarSign className="h-4 w-4" />
                <span className="text-sm">Consider optimizing for lower commission costs</span>
              </div>
            )}
            
            {stats.winRate < 40 && (
              <div className="flex items-center gap-2 text-red-600">
                <TrendingDown className="h-4 w-4" />
                <span className="text-sm">Win rate below 40% - review strategy</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}