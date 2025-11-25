"use client"

import { CalendarDaySummary } from "@/lib/services/calendar-data-service"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine } from "recharts"
import { format } from "date-fns"
import { Info } from "lucide-react"
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface UtilizationTrendProps {
  days: CalendarDaySummary[]
}

export function UtilizationTrend({ days }: UtilizationTrendProps) {
  const hasData = days.some(d => d.peakUtilizationPercent !== null && d.peakUtilizationPercent > 0)

  // Sort days by date
  const sortedDays = [...days].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  return (
    <Card className="border-neutral-800 bg-neutral-900/50">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <CardTitle className="text-lg font-medium">Utilization Trend</CardTitle>
          <TooltipProvider>
            <UITooltip>
              <TooltipTrigger>
                <Info className="h-4 w-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-xs">Utilization is based on margin requirements vs account value. Higher values indicate more capital at work.</p>
              </TooltipContent>
            </UITooltip>
          </TooltipProvider>
        </div>
        <CardDescription>Time-weighted daily capital usage as a percentage of account value.</CardDescription>
      </CardHeader>
      <CardContent>
        {hasData ? (
          <div className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sortedDays}>
                <XAxis 
                  dataKey="date" 
                  tickFormatter={(val) => format(new Date(val), "MMM d")}
                  stroke="#525252"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis 
                  domain={[0, 100]} 
                  tickFormatter={(v) => `${v}%`} 
                  stroke="#525252"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: "#171717", borderColor: "#262626", borderRadius: "8px" }}
                  itemStyle={{ color: "#e5e5e5" }}
                  formatter={(v: number) => [`${v.toFixed(1)}%`, "Utilization"]}
                  labelFormatter={(label) => format(new Date(label), "MMMM d, yyyy")}
                />
                <ReferenceLine y={50} stroke="#f59e0b" strokeDasharray="3 3" opacity={0.5} />
                <ReferenceLine y={80} stroke="#ef4444" strokeDasharray="3 3" opacity={0.5} />
                <Line
                  type="monotone"
                  dataKey="peakUtilizationPercent"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: "#10b981" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-[220px] flex items-center justify-center text-center p-4 border border-dashed border-neutral-800 rounded-lg">
            <p className="text-xs text-muted-foreground">
              No utilization data for this period. Upload trades with margin requirements or daily logs to enable this view.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
