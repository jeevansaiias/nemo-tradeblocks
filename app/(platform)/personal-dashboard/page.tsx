"use client"

import { useState } from "react"

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
  type PersonalStats,
  parsePersonalTradeCSV,
  calculatePersonalStats
} from "@/lib/processing/personal-trade-parser"

export default function PersonalDashboardPage() {
  const [trades, setTrades] = useState<PersonalTrade[]>([])
  const [stats, setStats] = useState<PersonalStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFileUpload = async (file: File) => {
    setLoading(true)
    setError(null)
    
    try {
      const text = await file.text()
      const parsedTrades = parsePersonalTradeCSV(text)
      
      if (parsedTrades.length === 0) {
        throw new Error("No trades found in the CSV file")
      }
      
      const calculatedStats = calculatePersonalStats(parsedTrades)
      
      setTrades(parsedTrades)
      setStats(calculatedStats)
      
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse CSV file")
      setTrades([])
      setStats(null)
    } finally {
      setLoading(false)
    }
  }

  const handleClearData = () => {
    setTrades([])
    setStats(null)
    setError(null)
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
            <PersonalUploader onFileSelect={handleFileUpload} loading={loading} />
            {error && (
              <div className="mt-4 p-4 border border-red-200 bg-red-50 rounded-lg">
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Dashboard Content */}
      {trades.length > 0 && stats && (
        <>
          {/* Summary Cards */}
          <PersonalSummary stats={stats} />
          
          {/* Calendar and Analysis Row */}
          <div className="grid gap-6 lg:grid-cols-2">
            <PersonalPLCalendar trades={trades} />
            
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
                      {stats.profitFactor.toFixed(2)}
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
                      {stats.averageWin > 0 ? (stats.averageWin / Math.abs(stats.averageLoss)).toFixed(2) : '0.00'}
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
                    {stats.profitFactor < 1.5 && (
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
              <PersonalUploader onFileSelect={handleFileUpload} loading={loading} />
              {error && (
                <div className="mt-4 p-4 border border-red-200 bg-red-50 rounded-lg">
                  <p className="text-red-600 text-sm">{error}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}