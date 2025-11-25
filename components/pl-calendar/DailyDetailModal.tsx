"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
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

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>{format(date, "MMMM d, yyyy")}</span>
            <Badge variant={pl >= 0 ? "default" : "destructive"} className="text-lg">
              {formatCurrency(pl)}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Daily Performance Summary
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 py-4">
          <div className="flex flex-col p-4 border rounded-lg bg-muted/50">
            <span className="text-sm text-muted-foreground">Trades</span>
            <span className="text-2xl font-bold">{tradeCount}</span>
          </div>
          <div className="flex flex-col p-4 border rounded-lg bg-muted/50">
            <span className="text-sm text-muted-foreground">Win Rate</span>
            <span className="text-2xl font-bold">{winRate.toFixed(1)}%</span>
          </div>
          <div className="flex flex-col p-4 border rounded-lg bg-muted/50">
            <span className="text-sm text-muted-foreground">Avg P/L</span>
            <span className={cn("text-2xl font-bold", pl >= 0 ? "text-green-600" : "text-red-600")}>
              {tradeCount > 0 ? formatCurrency(pl / tradeCount) : "$0.00"}
            </span>
          </div>
        </div>

        {dailyLog && (
          <div className="mb-6 p-4 border rounded-lg border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800">
            <h3 className="font-semibold mb-2 flex items-center gap-2">
              Reconciliation
              {reconciliationDiff !== undefined && Math.abs(reconciliationDiff) > 0.01 && (
                 <Badge variant="destructive">Mismatch</Badge>
              )}
              {reconciliationDiff !== undefined && Math.abs(reconciliationDiff) <= 0.01 && (
                 <Badge variant="outline" className="bg-green-100 text-green-800 border-green-200">Matched</Badge>
              )}
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Block P/L:</span>
                <span className="font-mono ml-2">{formatCurrency(pl)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Daily Log P/L:</span>
                <span className="font-mono ml-2">{formatCurrency(dailyLog.dailyPl)}</span>
              </div>
              {reconciliationDiff !== undefined && Math.abs(reconciliationDiff) > 0.01 && (
                <div className="col-span-2 text-red-600 font-medium">
                  Difference: {formatCurrency(reconciliationDiff)}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="space-y-4">
          <h3 className="font-semibold">Trades</h3>
          {trades.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Strategy</TableHead>
                  <TableHead>Legs</TableHead>
                  <TableHead className="text-right">P/L</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trades.map((trade, i) => (
                  <TableRow key={trade.id || i}>
                    <TableCell>
                      {trade.dateOpened ? format(new Date(trade.dateOpened), "HH:mm") : "-"}
                    </TableCell>
                    <TableCell>{trade.strategy}</TableCell>
                    <TableCell>{trade.legs}</TableCell>
                    <TableCell className={cn("text-right font-medium", (trade.pl || 0) >= 0 ? "text-green-600" : "text-red-600")}>
                      {formatCurrency(trade.pl || 0)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No trades recorded for this day.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
