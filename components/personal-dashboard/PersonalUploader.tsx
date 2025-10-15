"use client"

import { AlertCircle, CheckCircle, FileText, Upload } from "lucide-react"
import { useRef, useState } from "react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
    groupTradesByDate,
    parsePersonalTradeCSV,
    type DailyPersonalPL,
    type PersonalTrade
} from "@/lib/processing/personal-trade-parser"

interface PersonalUploaderProps {
  onDataParsed: (trades: PersonalTrade[], dailyPL: DailyPersonalPL[]) => void
}

export function PersonalUploader({ onDataParsed }: PersonalUploaderProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [previewData, setPreviewData] = useState<PersonalTrade[] | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    setError(null)
    setSuccess(null)
    setPreviewData(null)

    try {
      const content = await file.text()
      const trades = parsePersonalTradeCSV(content)
      
      if (trades.length === 0) {
        throw new Error("No valid trades found in the CSV file")
      }

      const dailyPL = groupTradesByDate(trades)
      
      // Show preview of first 5 trades
      setPreviewData(trades.slice(0, 5))
      setSuccess(`Successfully parsed ${trades.length} trades across ${dailyPL.length} trading days`)
      
      // Pass data to parent component
      onDataParsed(trades, dailyPL)
      
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse CSV file")
    } finally {
      setIsUploading(false)
    }
  }

  const handleUploadClick = () => {
    fileInputRef.current?.click()
  }

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault()
  }

  const handleDrop = async (event: React.DragEvent) => {
    event.preventDefault()
    const files = event.dataTransfer.files
    if (files.length > 0) {
      const fakeEvent = {
        target: { files }
      } as React.ChangeEvent<HTMLInputElement>
      await handleFileSelect(fakeEvent)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Upload Broker Statement
        </CardTitle>
        <CardDescription>
          Upload your broker CSV file (Schwab, TD Ameritrade, etc.) to analyze your personal trading performance
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Upload Area */}
        <div
          className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center hover:border-muted-foreground/50 transition-colors cursor-pointer"
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={handleUploadClick}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileSelect}
            className="hidden"
          />
          
          <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-medium mb-2">
            {isUploading ? "Processing..." : "Drop your CSV file here"}
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            or click to browse files
          </p>
          <Button disabled={isUploading} variant="outline">
            {isUploading ? "Processing..." : "Select File"}
          </Button>
        </div>

        {/* Error Message */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Success Message */}
        {success && (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}

        {/* Preview Data */}
        {previewData && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Preview - First 5 Trades</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {previewData.map((trade, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between py-2 px-3 bg-muted/50 rounded-md text-sm"
                  >
                    <div className="flex items-center gap-3">
                      <Badge variant="outline">{trade.date}</Badge>
                      <span className="font-medium">{trade.type}</span>
                      <span className="text-muted-foreground truncate max-w-[200px]">
                        {trade.description}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`font-semibold ${
                          trade.amount >= 0 ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        ${trade.amount.toFixed(2)}
                      </span>
                      {trade.fees > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          ${trade.fees.toFixed(2)} fees
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Format Guidelines */}
        <div className="text-xs text-muted-foreground">
          <p className="font-medium mb-1">Supported CSV formats:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Schwab account statements with DATE, DESCRIPTION, AMOUNT columns</li>
            <li>TD Ameritrade transaction exports</li>
            <li>Similar broker CSV files with standard column names</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}