'use client';

import React from 'react';
import { ExitReasonTPBin } from '@/lib/processing/exit_reason_analyzer';

interface ExitReasonTPHeatmapProps {
  data: ExitReasonTPBin[];
}

export function ExitReasonTPHeatmap({ data }: ExitReasonTPHeatmapProps) {
  const getColor = (efficiency: number) => {
    if (efficiency >= 80) return 'bg-green-600';
    if (efficiency >= 70) return 'bg-green-500';
    if (efficiency >= 60) return 'bg-lime-500';
    if (efficiency >= 50) return 'bg-yellow-500';
    if (efficiency >= 40) return 'bg-orange-500';
    if (efficiency >= 30) return 'bg-orange-600';
    return 'bg-red-600';
  };

  const tpBins = ['tp_20', 'tp_40', 'tp_60', 'tp_80', 'tp_100'] as const;

  return (
    <div className="w-full rounded-lg border border-zinc-800 bg-zinc-950 p-6">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-white">
          Exit Reason vs TP% Efficiency Heatmap
        </h3>
        <p className="mt-1 text-sm text-zinc-400">
          Efficiency at different take-profit levels by exit reason
        </p>
      </div>

      <div className="overflow-x-auto">
        <div className="inline-block min-w-full">
          {/* Header row */}
          <div className="flex">
            <div className="w-40 flex-shrink-0 border-b border-r border-zinc-700 bg-zinc-900 px-3 py-2 text-sm font-semibold text-white">
              Exit Reason
            </div>
            {tpBins.map(bin => (
              <div
                key={bin}
                className="w-24 flex-shrink-0 border-b border-r border-zinc-700 bg-zinc-900 px-2 py-2 text-center text-sm font-semibold text-orange-400"
              >
                TP {bin.split('_')[1]}%
              </div>
            ))}
          </div>

          {/* Data rows */}
          {data.map((row, idx) => (
            <div key={`${row.reason}-${idx}`}className="flex border-b border-zinc-800">
              <div className="w-40 flex-shrink-0 border-r border-zinc-800 px-3 py-2 text-sm text-white">
                {row.reason}
              </div>
              {tpBins.map(bin => {
                const efficiency = row[bin];
                return (
                  <div
                    key={`${row.reason}-${bin}`}
                    className={`w-24 flex-shrink-0 border-r border-zinc-800 px-2 py-2 text-center text-sm font-semibold text-white ${getColor(
                      efficiency
                    )} relative group`}
                    title={`${efficiency.toFixed(1)}% efficiency`}
                  >
                    {efficiency.toFixed(0)}%
                    {/* Tooltip */}
                    <div className="invisible absolute bottom-full left-1/2 z-10 mb-2 w-48 -translate-x-1/2 transform rounded bg-zinc-800 px-3 py-2 text-xs text-zinc-200 shadow-lg group-hover:visible">
                      Exit: {row.reason}
                      <br />
                      TP Level: {bin.split('_')[1]}%
                      <br />
                      Efficiency: {efficiency.toFixed(1)}%
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6">
        <p className="mb-3 text-sm font-semibold text-white">Color Scale:</p>
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 rounded bg-green-600" />
            <span className="text-xs text-zinc-300">&gt;80% (Excellent)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 rounded bg-yellow-500" />
            <span className="text-xs text-zinc-300">50-60% (Fair)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 rounded bg-red-600" />
            <span className="text-xs text-zinc-300">&lt;30% (Poor)</span>
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-md bg-blue-950 p-3 text-xs text-blue-200">
        <strong>Note:</strong> Higher efficiency percentages indicate that exits at that TP level
        capture more of the available MFE. Cells show the average efficiency for trades with that
        exit reason at each TP target.
      </div>
    </div>
  );
}
