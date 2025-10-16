"use client"

import React, { useState } from "react"

import { PersonalUploader } from "@/components/personal-dashboard/PersonalUploader"
import { PersonalSummary } from "@/components/personal-dashboard/PersonalSummary"
import { PersonalPLCalendar } from "@/components/personal-dashboard/PersonalPLCalendar"
import { PersonalTradeTable } from "@/components/personal-dashboard/PersonalTradeTable"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { RefreshCw, Download, Upload, FileText } from "lucide-react"
import {
  type PersonalTrade,
  type PersonalTradeStats,
  type DailyPersonalPL,
  parsePersonalTradeCSV,
  groupTradesByDate,
  calculatePersonalStats
} from "@/lib/processing/personal-trade-parser"

export default function PersonalDashboardPage() {
  const [trades, setTrades] = useState<PersonalTrade[]>([])
  const [dailyPL, setDailyPL] = useState<DailyPersonalPL[]>([])
  const [stats, setStats] = useState<PersonalTradeStats | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [currentDate, setCurrentDate] = useState<Date>(new Date())
  const [dataKey, setDataKey] = useState<string>(Date.now().toString()) // Force re-render key

  // Clear any potential localStorage or sessionStorage
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('personalTrades')
      localStorage.removeItem('personalStats')
      sessionStorage.removeItem('personalTrades')
      sessionStorage.removeItem('personalStats')
    }
  }, [])

  const handleDataParsed = (trades: PersonalTrade[], parsedDailyPL: DailyPersonalPL[]) => {
    // Force complete reset
    setTrades([])
    setDailyPL([])
    setStats(null)
    setError(null)
    
    // Small delay to ensure state is cleared
    setTimeout(() => {
      try {
        if (trades.length === 0) {
          throw new Error("No trades found in the CSV file")
        }
        
        console.log('Calculating stats for', trades.length, 'trades')
        console.log('First few trades:', trades.slice(0, 3))
        
        const calculatedStats = calculatePersonalStats(parsedDailyPL)
        console.log('Calculated stats:', calculatedStats)
        
        setTrades(trades)
        setDailyPL(parsedDailyPL)
        setStats(calculatedStats)
        setDataKey(Date.now().toString()) // Update key to force re-render
        
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to process trade data")
        setTrades([])
        setDailyPL([])
        setStats(null)
        setDataKey(Date.now().toString())
      }
    }, 100)
  }

  const handleClearData = () => {
    console.log('Clearing all data...')
    setTrades([])
    setDailyPL([])
    setStats(null)
    setError(null)
    setDataKey(Date.now().toString()) // Update key to force re-render
  }

  const handleHardReset = () => {
    if (typeof window !== 'undefined') {
      window.location.reload()
    }
  }

  const forceClearAll = () => {
    console.log('🔥 FORCE CLEARING ALL DATA')
    setTrades([])
    setDailyPL([])
    setStats(null)
    setError(null)
    setCurrentDate(new Date())
    setDataKey(Date.now().toString())
    
    // Clear any browser storage
    if (typeof window !== 'undefined') {
      localStorage.clear()
      sessionStorage.clear()
      console.log('🔥 CLEARED ALL BROWSER STORAGE')
    }
  }

  // Nuclear reset - force complete page reload and clear everything
  const nuclearReset = () => {
    console.log('🚀 NUCLEAR RESET - CLEARING EVERYTHING')
    
    // Clear all React state
    setTrades([])
    setDailyPL([])
    setStats(null)
    setError(null)
    setCurrentDate(new Date())
    setDataKey(Date.now().toString())
    
    if (typeof window !== 'undefined') {
      // Clear all storage
      localStorage.clear()
      sessionStorage.clear()
      
      // Clear all cookies
      document.cookie.split(";").forEach(function(c) { 
        document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/"); 
      })
      
      // Force reload without cache
      window.location.reload()
    }
  }

  const debugCurrentData = () => {
    console.log('=== DEBUG CURRENT DATA ===')
    console.log('Trades count:', trades.length)
    console.log('First 3 trades:', trades.slice(0, 3))
    console.log('Stats:', stats)
    console.log('Daily P/L count:', dailyPL.length)
    console.log('Data key:', dataKey)
    alert(`Current data: ${trades.length} trades, Stats: ${stats ? 'loaded' : 'null'}`)
  }

  const exportData = () => {
    if (trades.length === 0) return
    
    const dataStr = JSON.stringify({
      trades,
      stats,
      exportDate: new Date().toISOString(),
      totalTrades: trades.length
    }, null, 2)
    
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = `personal-trades-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Personal Dashboard</h1>
          <p className="text-muted-foreground">
            Upload your broker CSV files to analyze your trading performance
          </p>
        </div>
        
        {trades.length > 0 && (
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1">
              <FileText className="h-3 w-3" />
              {trades.length} trades
            </Badge>
            <Button variant="outline" size="sm" onClick={exportData}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Button variant="outline" size="sm" onClick={handleClearData}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Clear
            </Button>
            <Button variant="destructive" size="sm" onClick={forceClearAll}>
              🗑️ Force Clear
            </Button>
            <Button variant="destructive" size="sm" onClick={nuclearReset}>
              ☢️ Nuclear Reset
            </Button>
            <Button variant="destructive" size="sm" onClick={handleHardReset}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Hard Reset
            </Button>
            <Button variant="secondary" size="sm" onClick={debugCurrentData}>
              🐛 Debug
            </Button>
          </div>
        )}
      </div>

      {/* Upload Section */}
      {trades.length === 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Upload Trading Data
            </CardTitle>
          </CardHeader>
          <CardContent>
            <PersonalUploader onDataParsed={handleDataParsed} />
            {error && (
              <div className="mt-4 p-4 border border-red-200 bg-red-50 rounded-lg">
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Dashboard Content */}
      {trades.length > 0 && stats && dailyPL.length > 0 && (
        <div key={dataKey}>
          {/* Summary Cards */}
          <PersonalSummary dailyPL={dailyPL} />
          
          {/* Calendar and Analysis Row */}
          <div className="grid gap-6 lg:grid-cols-2">
            <PersonalPLCalendar 
              dailyPL={dailyPL} 
              currentDate={currentDate}
              onDateChange={setCurrentDate}
            />
            
            {/* Quick Stats Card */}
            <Card>
              <CardHeader>
                <CardTitle>Performance Insights</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-4 border rounded-lg">
                    <div className="text-2xl font-bold text-green-600">
                      {stats.winRate.toFixed(1)}%
                    </div>
                    <div className="text-sm text-muted-foreground">Win Rate</div>
                  </div>
                  
                  <div className="text-center p-4 border rounded-lg">
                    <div className="text-2xl font-bold">
                      {stats.avgWin > 0 && stats.avgLoss < 0 ? (stats.avgWin / Math.abs(stats.avgLoss)).toFixed(2) : '0.00'}
                    </div>
                    <div className="text-sm text-muted-foreground">Profit Factor</div>
                  </div>
                  
                  <div className="text-center p-4 border rounded-lg">
                    <div className={`text-2xl font-bold ${
                      stats.totalPL >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      ${Math.abs(stats.totalPL).toLocaleString()}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {stats.totalPL >= 0 ? 'Total Profit' : 'Total Loss'}
                    </div>
                  </div>
                  
                  <div className="text-center p-4 border rounded-lg">
                    <div className="text-2xl font-bold">
                      {stats.avgWin > 0 ? (stats.avgWin / Math.abs(stats.avgLoss)).toFixed(2) : '0.00'}
                    </div>
                    <div className="text-sm text-muted-foreground">Risk/Reward</div>
                  </div>
                </div>
                
                {/* Performance Recommendations */}
                <div className="pt-4 border-t">
                  <h4 className="font-semibold mb-2">Recommendations</h4>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    {stats.winRate < 50 && (
                      <li>• Consider improving your entry strategy (win rate below 50%)</li>
                    )}
                    {stats.avgWin > 0 && stats.avgLoss < 0 && (stats.avgWin / Math.abs(stats.avgLoss)) < 1.5 && (
                      <li>• Focus on improving profit factor (target: 1.5+)</li>
                    )}
                    {stats.maxDrawdown < -1000 && (
                      <li>• Consider implementing better risk management</li>
                    )}
                    {stats.totalFees > Math.abs(stats.totalPL) * 0.1 && (
                      <li>• Review trading frequency to reduce commission costs</li>
                    )}
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>
          
          {/* Trade Table */}
          <PersonalTradeTable trades={trades} />
          
          {/* Re-upload Section */}
          <Card>
            <CardHeader>
              <CardTitle>Upload New Data</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground mb-4">
                Upload a new CSV file to replace the current data or analyze a different time period.
              </div>
              <PersonalUploader onDataParsed={handleDataParsed} />
              {error && (
                <div className="mt-4 p-4 border border-red-200 bg-red-50 rounded-lg">
                  <p className="text-red-600 text-sm">{error}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}