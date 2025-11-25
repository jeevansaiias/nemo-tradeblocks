'use client';

import React, { useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceDot,
} from 'recharts';
import { PerStrategyTPCurve } from '@/lib/processing/strategy_exit_matrix';

interface StrategyExitTPMatrixProps {
  curves: PerStrategyTPCurve[];
  strategyFilter?: string;
}

interface ChartDataPoint {
  tp: number;
  [key: string]: number | string; // efficiency values keyed by exit reason
}

export function StrategyExitTPMatrix({
  curves,
  strategyFilter,
}: StrategyExitTPMatrixProps) {
  const [selectedStrategy, setSelectedStrategy] = useState<string | null>(
    strategyFilter || null
  );

  // Get unique strategies
  const uniqueStrategies = [...new Set(curves.map((c) => c.strategy))];

  // Filter curves if strategy selected
  const filteredCurves = selectedStrategy
    ? curves.filter((c) => c.strategy === selectedStrategy)
    : curves;

  // Color palette for exit reasons
  const colorPalette = [
    '#ff9f43',
    '#5f27cd',
    '#00d2d3',
    '#1dd1a1',
    '#feca57',
    '#48dbfb',
    '#ff6348',
    '#a4b0bd',
  ];

  const getColor = (index: number): string => colorPalette[index % colorPalette.length];

  // Prepare chart data for each strategy
  const strategyCharts = selectedStrategy
    ? [selectedStrategy]
    : uniqueStrategies.slice(0, 4); // Show max 4 strategies as small multiples

  return (
    <div className="w-full space-y-6 rounded-lg border border-zinc-800 bg-zinc-950 p-6">
      <div>
        <h3 className="text-lg font-semibold text-white">Strategy × Exit Reason TP Performance</h3>
        <p className="mt-1 text-sm text-zinc-400">
          Line charts show efficiency at different TP levels for each exit reason within a strategy
        </p>
      </div>

      {/* Strategy Filter */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setSelectedStrategy(null)}
          className={`rounded px-3 py-1.5 text-xs font-medium transition ${
            selectedStrategy === null
              ? 'bg-orange-500 text-white'
              : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
          }`}
        >
          All Strategies
        </button>
        {uniqueStrategies.map((strategy) => (
          <button
            key={strategy}
            onClick={() => setSelectedStrategy(strategy)}
            className={`rounded px-3 py-1.5 text-xs font-medium transition ${
              selectedStrategy === strategy
                ? 'bg-orange-500 text-white'
                : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
            }`}
          >
            {strategy}
          </button>
        ))}
      </div>

      {/* Grid of small multiple charts */}
      <div className="grid gap-6 md:grid-cols-2">
        {strategyCharts.map((strategy) => {
          const strategyCurves = filteredCurves.filter((c) => c.strategy === strategy);

          // Prepare data for this strategy
          const chartData: ChartDataPoint[] = [];
          if (strategyCurves.length > 0) {
            const tpLevels = strategyCurves[0].tp_levels;
            for (let i = 0; i < tpLevels.length; i++) {
              const point: ChartDataPoint = { tp: tpLevels[i] };
              strategyCurves.forEach((curve) => {
                point[`${curve.exit_reason}`] = Math.round(curve.efficiencies[i] * 100) / 100;
              });
              chartData.push(point);
            }
          }

          return (
            <div key={strategy} className="space-y-2 rounded bg-zinc-900 p-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-white">{strategy}</h4>
                <span className="text-xs text-zinc-500">{strategyCurves.length} exit reasons</span>
              </div>

              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis
                    dataKey="tp"
                    label={{ value: 'TP % of MFE', position: 'insideBottomRight', offset: -5, fill: '#a1a1a1', fontSize: 11 }}
                    tick={{ fill: '#a1a1a1', fontSize: 10 }}
                  />
                  <YAxis
                    domain={[0, 100]}
                    label={{ value: 'Efficiency %', angle: -90, position: 'insideLeft', fill: '#a1a1a1', fontSize: 11 }}
                    tick={{ fill: '#a1a1a1', fontSize: 10 }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1a1a1a',
                      border: '1px solid #444',
                      borderRadius: '6px',
                      padding: '8px',
                    }}
                    labelStyle={{ color: '#fff', fontSize: '12px' }}
                    formatter={(value: number) => `${value.toFixed(2)}%`}
                    labelFormatter={(label) => `${label}% MFE`}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />

                  {strategyCurves.map((curve, idx) => {
                    const optimalIdx = curve.tp_levels.indexOf(curve.optimal_tp);
                    return (
                      <Line
                        key={curve.exit_reason}
                        type="monotone"
                        dataKey={curve.exit_reason}
                        stroke={getColor(idx)}
                        strokeWidth={2}
                        dot={false}
                        isAnimationActive={false}
                      >
                        {/* Mark optimal TP point */}
                        {optimalIdx >= 0 && (
                          <ReferenceDot
                            x={curve.tp_levels[optimalIdx]}
                            y={curve.efficiencies[optimalIdx]}
                            r={4}
                            fill={getColor(idx)}
                            stroke="white"
                            strokeWidth={2}
                          />
                        )}
                      </Line>
                    );
                  })}
                </LineChart>
              </ResponsiveContainer>

              {/* Curve metadata */}
              <div className="grid gap-2 text-xs text-zinc-400">
                {strategyCurves.map((curve, idx) => (
                  <div key={curve.exit_reason} className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <div
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: getColor(idx) }}
                      />
                      {curve.exit_reason}
                    </span>
                    <span>
                      {curve.trades} trades | Optimal TP: <span className="text-white font-semibold">{curve.optimal_tp.toFixed(0)}%</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Note about chart interpretation */}
      <div className="rounded bg-zinc-900 p-4 text-xs text-zinc-400">
        <p>
          <span className="font-semibold text-white">How to read:</span> Each line shows efficiency as TP % increases.
          Points marked with circles indicate optimal TP for that exit reason. Higher and flatter lines indicate better and
          more stable performance.
        </p>
      </div>
    </div>
  );
}
