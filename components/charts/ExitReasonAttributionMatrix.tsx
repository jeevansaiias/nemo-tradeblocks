'use client';

import React, { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { ExitReasonMetrics, formatExitReasonsAsCSV } from '@/lib/processing/exit_reason_analyzer';

interface ExitReasonAttributionMatrixProps {
  data: ExitReasonMetrics[];
}

type SortField = keyof ExitReasonMetrics;
type SortOrder = 'asc' | 'desc';

export function ExitReasonAttributionMatrix({
  data,
}: ExitReasonAttributionMatrixProps) {
  const [sortField, setSortField] = useState<SortField>('trade_count');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const sortedData = [...data].sort((a, b) => {
    const aVal = a[sortField];
    const bVal = b[sortField];

    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
    }

    const aStr = String(aVal).toLowerCase();
    const bStr = String(bVal).toLowerCase();
    return sortOrder === 'asc'
      ? aStr.localeCompare(bStr)
      : bStr.localeCompare(aStr);
  });

  const handleExportCSV = () => {
    const csv = formatExitReasonsAsCSV(data);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `exit-reason-attribution-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const getEfficiencyColor = (efficiency: number) => {
    if (efficiency >= 80) return 'text-green-500';
    if (efficiency >= 60) return 'text-yellow-500';
    return 'text-red-500';
  };

  const SortHeader = ({ field, label }: { field: SortField; label: string }) => (
    <TableHead
      className="cursor-pointer select-none hover:bg-zinc-900"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-2">
        {label}
        {sortField === field && (
          <span className="text-xs text-orange-400">
            {sortOrder === 'asc' ? '↑' : '↓'}
          </span>
        )}
      </div>
    </TableHead>
  );

  return (
    <div className="w-full space-y-4 rounded-lg border border-zinc-800 bg-zinc-950 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">
            Exit Reason Attribution Matrix
          </h3>
          <p className="mt-1 text-sm text-zinc-400">
            Analyze performance metrics by exit condition
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleExportCSV}
          className="gap-2 border-zinc-700 text-zinc-300 hover:bg-zinc-900"
        >
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader className="border-b border-zinc-800 bg-zinc-900">
            <TableRow className="hover:bg-zinc-900">
              <SortHeader field="reason" label="Exit Reason" />
              <SortHeader field="trade_count" label="Trades" />
              <SortHeader field="win_rate" label="Win Rate %" />
              <SortHeader field="avg_mfe" label="Avg MFE %" />
              <SortHeader field="avg_mae" label="Avg MAE %" />
              <SortHeader field="avg_efficiency" label="Efficiency %" />
              <SortHeader field="missed_profit_pct" label="Missed %" />
              <SortHeader field="recommended_tp" label="Rec TP %" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedData.map((row, idx) => (
              <TableRow
                key={`${row.reason}-${idx}`}
                className="border-b border-zinc-800 hover:bg-zinc-900/50"
              >
                <TableCell className="font-medium text-white">
                  {row.reason}
                </TableCell>
                <TableCell className="text-zinc-300">{row.trade_count}</TableCell>
                <TableCell className="text-zinc-300">
                  {row.win_rate.toFixed(1)}%
                </TableCell>
                <TableCell className="text-zinc-300">
                  {row.avg_mfe.toFixed(2)}%
                </TableCell>
                <TableCell className="text-red-500">{row.avg_mae.toFixed(2)}%</TableCell>
                <TableCell className={getEfficiencyColor(row.avg_efficiency)}>
                  <span className="font-semibold">{row.avg_efficiency.toFixed(1)}%</span>
                </TableCell>
                <TableCell className="text-orange-400">
                  {row.missed_profit_pct.toFixed(2)}%
                </TableCell>
                <TableCell className="font-semibold text-orange-400">
                  {row.recommended_tp}%
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-4 rounded bg-zinc-900 p-4 text-sm">
        <div>
          <p className="text-zinc-400">Avg Efficiency across all reasons:</p>
          <p className="text-lg font-semibold text-orange-400">
            {(data.reduce((sum, d) => sum + d.avg_efficiency, 0) / data.length).toFixed(1)}%
          </p>
        </div>
        <div>
          <p className="text-zinc-400">Total trades analyzed:</p>
          <p className="text-lg font-semibold text-white">
            {data.reduce((sum, d) => sum + d.trade_count, 0)}
          </p>
        </div>
        <div>
          <p className="text-zinc-400">Avg missed profit:</p>
          <p className="text-lg font-semibold text-orange-400">
            {(data.reduce((sum, d) => sum + d.missed_profit_pct, 0) / data.length).toFixed(2)}%
          </p>
        </div>
      </div>

      <div className="rounded-md bg-blue-950 p-3 text-xs text-blue-200">
        <strong>Legend:</strong> Efficiency = (Actual Exit % / MFE %) × 100. Higher is better.
        Missed % = MFE % − Actual %. Rec TP = Recommended take-profit for this exit reason.
      </div>
    </div>
  );
}
