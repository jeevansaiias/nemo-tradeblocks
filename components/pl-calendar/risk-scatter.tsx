"use client"

import { CalendarDaySummary } from "@/lib/services/calendar-data-service"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid, Tooltip, ReferenceLine, Cell } from "recharts"
import { format } from "date-fns"
import { Info } from "lucide-react"
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface RiskScatterProps {
  days: CalendarDaySummary[]
}

export function RiskScatter({ days }: RiskScatterProps) {
  // Filter out days with no utilization or no P/L to avoid clutter
  const data = days.filter(d => 
    (d.peakUtilizationPercent !== null && d.peakUtilizationPercent > 0) || 
    d.realizedPL !== 0
  ).map(d => ({
    ...d,
    // Ensure we have numbers for the chart
    x: d.peakUtilizationPercent || 0,
    y: d.realizedPL,
    z: d.riskScore || 0,
    dateObj: new Date(d.date)
  }))

  const hasData = data.length > 0

  // Determine color based on P/L and Utilization
  const getPointColor = (entry: typeof data[0]) => {
    if (entry.y < 0 && entry.x > 50) return "#ef4444" // High Util + Loss = Red (Danger)
    if (entry.y < 0) return "#f87171" // Loss = Light Red
    if (entry.x > 80) return "#f59e0b" // High Util + Win = Amber (Caution)
    return "#10b981" // Win + Normal Util = Green
  }

  return (
    <Card className="border-neutral-800 bg-neutral-900/50">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <CardTitle className="text-lg font-medium">Risk Efficiency</CardTitle>
          <TooltipProvider>
            <UITooltip>
              <TooltipTrigger>
                <Info className="h-4 w-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-xs">Compares Capital Utilization (X) vs P/L (Y). <br/>Top-Right: Efficient Capital Use.<br/>Bottom-Right: High Risk (Large Loss on Large Capital).</p>
              </TooltipContent>
            </UITooltip>
          </TooltipProvider>
        </div>
        <CardDescription>Are you losing money when you bet big?</CardDescription>
      </CardHeader>
      <CardContent>
        {hasData ? (
          <div className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 10, right: 10, bottom: 10, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
                <XAxis 
                  type="number" 
                  dataKey="x" 
                  name="Utilization" 
                  unit="%" 
                  domain={[0, 100]}
                  tickFormatter={(v) => `${v}%`}
                  stroke="#525252"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis 
                  type="number" 
                  dataKey="y" 
                  name="P/L" 
                  unit="$" 
                  stroke="#525252"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) => `$${val >= 1000 ? (val/1000).toFixed(1) + 'k' : val}`}
                />
                <ZAxis type="number" dataKey="z" range={[50, 400]} name="Risk Score" />
                <Tooltip 
                  cursor={{ strokeDasharray: '3 3' }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-neutral-900 border border-neutral-800 p-2 rounded shadow-lg text-xs">
                          <p className="font-medium mb-1">{format(data.dateObj, "MMM d, yyyy")}</p>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                            <span className="text-muted-foreground">P/L:</span>
                            <span className={data.y >= 0 ? "text-green-500" : "text-red-500"}>
                              ${data.y.toFixed(2)}
                            </span>
                            <span className="text-muted-foreground">Util:</span>
                            <span className="text-blue-400">{data.x.toFixed(1)}%</span>
                            <span className="text-muted-foreground">Risk:</span>
                            <span className="text-purple-400">{data.z.toFixed(0)}</span>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <ReferenceLine y={0} stroke="#525252" strokeDasharray="3 3" />
                <ReferenceLine x={50} stroke="#525252" strokeDasharray="3 3" label={{ value: "High Util", position: 'insideTopRight', fill: '#525252', fontSize: 10 }} />
                <Scatter name="Days" data={data} shape="circle">
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={getPointColor(entry)} />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-[220px] flex items-center justify-center text-center p-4 border border-dashed border-neutral-800 rounded-lg">
            <p className="text-xs text-muted-foreground">
              No data available for risk analysis.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
