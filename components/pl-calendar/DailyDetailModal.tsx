"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { format } from "date-fns"
import { CalendarDayData } from "@/lib/services/calendar-data-service"
import { formatCurrency } from "@/lib/utils"
import { cn } from "@/lib/utils"

interface DailyDetailModalProps {
  isOpen: boolean
  onClose: () => void
  dayData: CalendarDayData | null
}

export function DailyDetailModal({ isOpen, onClose, dayData }: DailyDetailModalProps) {
  if (!dayData) return null

  const { date, pl, tradeCount, winRate, trades, dailyLog, reconciliationDiff } = dayData
  const avgPL = tradeCount > 0 ? pl / tradeCount : 0

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto bg-background/95 backdrop-blur-sm border-neutral-800 p-0 gap-0">
        
        {/* Header Section */}
        <div className="p-6 border-b border-neutral-800 flex flex-col md:flex-row md:items-center justify-between gap-4 sticky top-0 bg-background/95 backdrop-blur-sm z-10">
          <div className="space-y-1">
            <DialogTitle className="text-2xl font-bold tracking-tight">
              {format(date, "MMMM d, yyyy")}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Daily performance summary
            </DialogDescription>
          </div>
          
          <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-muted/40 border border-neutral-800 text-sm font-medium">
            <span>{tradeCount} trades</span>
            <span className="text-neutral-600 dark:text-neutral-400">·</span>
            <span className={cn(pl >= 0 ? "text-green-500" : "text-red-500")}>
              {formatCurrency(pl)}
            </span>
            <span className="text-neutral-600 dark:text-neutral-400">·</span>
            <span>{Math.round(winRate)}% WR</span>
          </div>
        </div>

        <div className="p-6 space-y-8">
          {/* Stats Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard 
              label="Total P/L" 
              value={formatCurrency(pl)} 
              valueClassName={pl >= 0 ? "text-green-500" : "text-red-500"} 
            />
            <StatCard 
              label="Trades" 
              value={tradeCount.toString()} 
            />
            <StatCard 
              label="Win Rate" 
              value={`${winRate.toFixed(1)}%`} 
              valueClassName={winRate >= 50 ? "text-green-500" : "text-yellow-500"}
            />
            <StatCard 
              label="Avg P/L" 
              value={formatCurrency(avgPL)} 
              valueClassName={avgPL >= 0 ? "text-green-500" : "text-red-500"} 
            />
          </div>

          {/* Reconciliation Section */}
          {dailyLog && (
            <div className="rounded-xl border border-neutral-800 bg-muted/20 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  Reconciliation
                  {reconciliationDiff !== undefined && Math.abs(reconciliationDiff) <= 0.01 ? (
                     <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20 text-[10px] h-5">Matched</Badge>
                  ) : (
                     <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20 text-[10px] h-5">Mismatch</Badge>
                  )}
                </h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div className="flex justify-between md:block">
                  <span className="text-muted-foreground md:block md:mb-1">Block P/L</span>
                  <span className="font-mono font-medium">{formatCurrency(pl)}</span>
                </div>
                <div className="flex justify-between md:block">
                  <span className="text-muted-foreground md:block md:mb-1">Daily Log P/L</span>
                  <span className="font-mono font-medium">{formatCurrency(dailyLog.dailyPl)}</span>
                </div>
                {reconciliationDiff !== undefined && Math.abs(reconciliationDiff) > 0.01 && (
                  <div className="flex justify-between md:block">
                    <span className="text-muted-foreground md:block md:mb-1">Difference</span>
                    <span className="font-mono font-medium text-red-500">{formatCurrency(reconciliationDiff)}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Trades Table */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold tracking-tight">Trades</h3>
            {trades.length > 0 ? (
              <div className="rounded-xl border border-neutral-800 overflow-hidden">
                <Table>
                  <TableHeader className="bg-muted/40">
                    <TableRow className="hover:bg-transparent border-neutral-800">
                      <TableHead className="w-[100px]">Time</TableHead>
                      <TableHead>Strategy</TableHead>
                      <TableHead>Legs</TableHead>
                      <TableHead className="text-right">Max Profit</TableHead>
                      <TableHead className="text-right">Max Loss</TableHead>
                      <TableHead className="text-right">P/L</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {trades.map((trade, i) => (
                      <TableRow key={trade.id || i} className="hover:bg-muted/30 border-neutral-800 transition-colors">
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {trade.dateOpened ? format(new Date(trade.dateOpened), "HH:mm") : "-"}
                        </TableCell>
                        <TableCell className="font-medium text-sm">{trade.strategy}</TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate" title={trade.legs}>
                          {trade.legs}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs text-muted-foreground">
                          {trade.maxProfit ? formatCurrency(trade.maxProfit) : "-"}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs text-muted-foreground">
                          {trade.maxLoss ? formatCurrency(trade.maxLoss) : "-"}
                        </TableCell>
                        <TableCell className={cn("text-right font-mono font-medium", (trade.pl || 0) >= 0 ? "text-green-500" : "text-red-500")}>
                          {formatCurrency(trade.pl || 0)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-12 border border-dashed border-neutral-800 rounded-xl text-muted-foreground">
                No trades recorded for this day.
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function StatCard({ label, value, valueClassName }: { label: string, value: string, valueClassName?: string }) {
  return (
    <div className="flex flex-col p-4 rounded-xl border border-neutral-800 bg-muted/20 hover:bg-muted/30 transition-colors">
      <span className="text-xs font-medium text-muted-foreground mb-1">{label}</span>
      <span className={cn("text-2xl font-bold tracking-tight", valueClassName)}>
        {value}
      </span>
    </div>
  )
}
