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
import { StrategyExitReasonMetric } from '@/lib/processing/exit_reason_analyzer';

interface StrategyExitReasonMatrixProps {
  data: StrategyExitReasonMetric[];
}

type SortField = keyof StrategyExitReasonMetric;
type SortOrder = 'asc' | 'desc';

export function StrategyExitReasonMatrix({
  data,
}: StrategyExitReasonMatrixProps) {
  const [sortField, setSortField] = useState<SortField>('trade_count');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [filterStrategy, setFilterStrategy] = useState<string>('');

  const strategies = Array.from(new Set(data.map(d => d.strategy)));

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const filteredData = filterStrategy
    ? data.filter(d => d.strategy === filterStrategy)
    : data;

  const sortedData = [...filteredData].sort((a, b) => {
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
      <div>
        <h3 className="text-lg font-semibold text-white">
          Strategy × Exit Reason Performance Matrix
        </h3>
        <p className="mt-1 text-sm text-zinc-400">
          Cross-analysis of strategy and exit condition performance
        </p>
      </div>

      {strategies.length > 1 && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFilterStrategy('')}
            className={`rounded px-3 py-1 text-sm font-medium transition ${
              !filterStrategy
                ? 'bg-orange-600 text-white'
                : 'border border-zinc-700 text-zinc-300 hover:bg-zinc-900'
            }`}
          >
            All Strategies
          </button>
          {strategies.map(strategy => (
            <button
              key={strategy}
              onClick={() => setFilterStrategy(strategy)}
              className={`rounded px-3 py-1 text-sm font-medium transition ${
                filterStrategy === strategy
                  ? 'bg-orange-600 text-white'
                  : 'border border-zinc-700 text-zinc-300 hover:bg-zinc-900'
              }`}
              title={strategy}
            >
              {strategy.substring(0, 20)}...
            </button>
          ))}
        </div>
      )}

      <div className="overflow-x-auto">
        <Table>
          <TableHeader className="border-b border-zinc-800 bg-zinc-900">
            <TableRow className="hover:bg-zinc-900">
              <SortHeader field="strategy" label="Strategy" />
              <SortHeader field="exit_reason" label="Exit Reason" />
              <SortHeader field="trade_count" label="Trades" />
              <SortHeader field="win_rate" label="Win Rate %" />
              <SortHeader field="avg_efficiency" label="Efficiency %" />
              <SortHeader field="missed_profit_pct" label="Missed %" />
              <SortHeader field="recommended_tp" label="Rec TP %" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedData.map((row, idx) => (
              <TableRow
                key={`${row.strategy}-${row.exit_reason}-${idx}`}
                className="border-b border-zinc-800 hover:bg-zinc-900/50"
              >
                <TableCell className="font-medium text-white">
                  <span title={row.strategy} className="block max-w-xs truncate">
                    {row.strategy}
                  </span>
                </TableCell>
                <TableCell className="text-zinc-300">{row.exit_reason}</TableCell>
                <TableCell className="text-zinc-300">{row.trade_count}</TableCell>
                <TableCell className="text-zinc-300">
                  {row.win_rate.toFixed(1)}%
                </TableCell>
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

      <div className="rounded-md bg-blue-950 p-3 text-xs text-blue-200">
        <strong>Usage:</strong> Filter by strategy to see how each exit reason performs for a
        specific strategy. Rec TP is the recommended take-profit level for optimal performance
        with that strategy-exit combination.
      </div>
    </div>
  );
}
