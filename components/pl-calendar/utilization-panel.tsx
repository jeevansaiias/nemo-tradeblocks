"use client"

import { DailyUtilization } from "@/lib/calculations/utilization-analyzer"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface UtilizationPanelProps {
  data: DailyUtilization[]
}

export function UtilizationPanel({ data }: UtilizationPanelProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card className="border-neutral-800 bg-neutral-900/50">
        <CardHeader>
          <CardTitle className="text-lg font-medium">Utilization Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm border border-dashed border-neutral-800 rounded-lg">
            Utilization Chart Placeholder ({data.length} days)
          </div>
        </CardContent>
      </Card>
      
      <Card className="border-neutral-800 bg-neutral-900/50">
        <CardHeader>
          <CardTitle className="text-lg font-medium">Risk Heatmap</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm border border-dashed border-neutral-800 rounded-lg">
            Risk Heatmap Placeholder
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
