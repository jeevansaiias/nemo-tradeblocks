'use client';

import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import { TPSimulationPoint } from '@/lib/processing/tp_optimizer_service';

interface TPGainCurveProps {
  simulationData: TPSimulationPoint[];
  optimalTP?: number;
  diminishingReturnThreshold?: number;
}

export function TPGainCurve({ simulationData, optimalTP, diminishingReturnThreshold }: TPGainCurveProps) {
  if (!simulationData || simulationData.length === 0) {
    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-6">
        <p className="text-center text-sm text-zinc-400">No simulation data available</p>
      </div>
    );
  }

  const chartData = simulationData.map((point) => ({
    tp: point.tp,
    efficiency: Math.round(point.plPct * 100) / 100,
    winRate: Math.round(point.winRate * 10) / 10,
    profitFactor: Math.round(point.profitFactor * 100) / 100,
    expectancy: Math.round(point.expectancy * 100) / 100,
  }));

  // Calculate diminishing returns zone
  let diminishingReturnsStart = null;
  if (diminishingReturnThreshold) {
    for (let i = 1; i < chartData.length; i++) {
      const improvement = chartData[i].efficiency - chartData[i - 1].efficiency;
      if (improvement < diminishingReturnThreshold) {
        diminishingReturnsStart = chartData[i].tp;
        break;
      }
    }
  }

  return (
    <div className="w-full space-y-4 rounded-lg border border-zinc-800 bg-zinc-950 p-6">
      <div>
        <h3 className="text-lg font-semibold text-white">Take-Profit Performance Curve</h3>
        <p className="mt-1 text-sm text-zinc-400">Efficiency vs. Take-Profit Level</p>
      </div>

      <ResponsiveContainer width="100%" height={350}>
        <LineChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 60 }}>
          <defs>
            <linearGradient id="diminishingZone" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#dc2626" stopOpacity={0.1} />
              <stop offset="100%" stopColor="#dc2626" stopOpacity={0} />
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="3 3" stroke="#333" />
          <XAxis 
            dataKey="tp" 
            label={{ value: 'Take-Profit Level %', position: 'insideBottomRight', offset: -10 }}
            tick={{ fill: '#a1a1a1' }} 
          />
          <YAxis 
            label={{ value: 'Efficiency %', angle: -90, position: 'insideLeft' }}
            tick={{ fill: '#a1a1a1' }}
          />
          <Tooltip
            contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #444', borderRadius: '6px' }}
            formatter={(value: number, name: string) => {
              if (name === 'efficiency') return `${value.toFixed(2)}%`;
              if (name === 'winRate') return `${value.toFixed(1)}%`;
              if (name === 'profitFactor') return value.toFixed(2);
              return value.toFixed(2);
            }}
          />
          <Legend />

          {diminishingReturnsStart && (
            <ReferenceLine 
              x={diminishingReturnsStart} 
              stroke="#dc2626" 
              strokeDasharray="5 5"
              label={{ value: 'Diminishing Returns', position: 'top', fill: '#dc2626', fontSize: 12 }}
            />
          )}

          {optimalTP && (
            <ReferenceLine 
              x={optimalTP} 
              stroke="#22c55e" 
              strokeDasharray="5 5"
              label={{ value: `Optimal TP: ${optimalTP}%`, position: 'top', fill: '#22c55e', fontSize: 12 }}
            />
          )}

          <Line 
            type="monotone" 
            dataKey="efficiency" 
            stroke="#ff9f43" 
            strokeWidth={2}
            dot={{ fill: '#ff9f43', r: 4 }}
            activeDot={{ r: 6 }}
            name="Efficiency %"
          />
          <Line 
            type="monotone" 
            dataKey="winRate" 
            stroke="#5f27cd" 
            strokeWidth={1.5}
            strokeDasharray="5 5"
            dot={false}
            name="Win Rate %"
          />
        </LineChart>
      </ResponsiveContainer>

      {/* Metrics Summary */}
      <div className="grid gap-3 md:grid-cols-4">
        {[chartData[0], optimalTP ? chartData.find(d => d.tp === optimalTP) : null, chartData[chartData.length - 1]].map((point, idx) => {
          if (!point) return null;
          return (
            <div key={idx} className="rounded bg-zinc-900 p-3 border-l-2 border-orange-400">
              <p className="text-xs font-semibold text-zinc-400">TP {point.tp}%</p>
              <div className="mt-2 space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-zinc-500">Efficiency:</span>
                  <span className="font-semibold text-white">{point.efficiency.toFixed(2)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Win Rate:</span>
                  <span className="font-semibold text-white">{point.winRate.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Profit Factor:</span>
                  <span className="font-semibold text-white">{point.profitFactor.toFixed(2)}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {diminishingReturnsStart && (
        <div className="rounded border border-red-900/50 bg-red-950/30 p-3 text-xs text-red-200">
          <p className="font-semibold">Diminishing Returns Detected</p>
          <p className="mt-1 text-red-300/80">Efficiency gains become marginal beyond {diminishingReturnsStart}% TP level</p>
        </div>
      )}
    </div>
  );
}
