"use client"

import React, { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  parsePersonalTradeCSV,
  groupTradesByDate,
  calculatePersonalStats,
  formatCurrency,
  type PersonalTrade,
  type DailyPersonalPL,
  type PersonalTradeStats
} from "@/lib/processing/personal-trade-parser"

export default function CSVTestPage() {
  const [result, setResult] = useState<string>("")
  const [stats, setStats] = useState<PersonalTradeStats | null>(null)

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const sessionId = Date.now().toString()
    console.log(`[TEST-${sessionId}] Processing file:`, file.name)

    try {
      const content = await file.text()
      console.log(`[TEST-${sessionId}] Content preview:`, content.substring(0, 200))

      const trades = parsePersonalTradeCSV(content)
      console.log(`[TEST-${sessionId}] Parsed trades:`, trades.length)

      const dailyPL = groupTradesByDate(trades)
      const calculatedStats = calculatePersonalStats(dailyPL)

      setStats(calculatedStats)
      setResult(`
✅ SUCCESS - Fresh Parse Results:
📊 File: ${file.name}
📈 Trades found: ${trades.length}
💰 Total P/L: ${formatCurrency(calculatedStats.totalPL)}
🎯 Completed Positions: ${formatCurrency(calculatedStats.completedPositionsPL || 0)}
🔄 Open Positions: ${formatCurrency(calculatedStats.openPositionsPL || 0)}
💳 Current Balance: ${formatCurrency(calculatedStats.currentBalance)}
📅 Trading Days: ${calculatedStats.winningDays + calculatedStats.losingDays}

First 3 trades:
${trades.slice(0, 3).map((t, i) => `${i+1}. ${t.date} - ${t.description.substring(0, 40)}... - ${formatCurrency(t.amount)}`).join('\n')}
      `)

    } catch (error) {
      console.error(`[TEST-${sessionId}] Error:`, error)
      setResult(`❌ ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }

    // Clear the input
    event.target.value = ''
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle>🔬 CSV Parser Test - No Cache</CardTitle>
          <p className="text-sm text-muted-foreground">
            Direct CSV parsing test to bypass any caching issues
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
            <input
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="mb-4"
            />
            <p className="text-sm text-gray-600">
              Upload your CSV file to test parsing directly
            </p>
          </div>

          {result && (
            <Card>
              <CardHeader>
                <CardTitle>📋 Parse Results</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="whitespace-pre-wrap text-sm bg-gray-100 p-4 rounded">
                  {result}
                </pre>
              </CardContent>
            </Card>
          )}

          {stats && (
            <Card>
              <CardHeader>
                <CardTitle>📊 Detailed Stats</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <strong>Total P/L:</strong> {formatCurrency(stats.totalPL)}
                  </div>
                  <div>
                    <strong>Win Rate:</strong> {stats.winRate.toFixed(1)}%
                  </div>
                  <div>
                    <strong>Total Trades:</strong> {stats.totalTrades}
                  </div>
                  <div>
                    <strong>Total Fees:</strong> {formatCurrency(stats.totalFees)}
                  </div>
                  <div>
                    <strong>Completed Positions P/L:</strong> {formatCurrency(stats.completedPositionsPL || 0)}
                  </div>
                  <div>
                    <strong>Open Positions P/L:</strong> {formatCurrency(stats.openPositionsPL || 0)}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  )
}