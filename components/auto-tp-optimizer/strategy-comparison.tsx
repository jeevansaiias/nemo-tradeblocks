'use client';
import { useMemo, useState } from 'react';
import { ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export interface SimulationPoint {
  tp: number;
  expectancy: number;
}

export interface StrategyData {
  [key: string]: SimulationPoint[];
}

function getColor(name: string): string {
  const colors = ['#ff9f43', '#0fc5b0', '#6c63ff', '#ff6b6b', '#4ecdc4'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash << 5) - hash + name.charCodeAt(i);
  return colors[Math.abs(hash) % colors.length];
}

export function StrategyComparison({ data }: { data: StrategyData }) {
  const [visible, setVisible] = useState(new Set(Object.keys(data)));

  const chartData = useMemo(() => {
    const allTPs = new Set<number>();
    Object.values(data).forEach(sims => sims.forEach(s => allTPs.add(s.tp)));
    
    return Array.from(allTPs)
      .sort((a, b) => a - b)
      .map(tp => {
        const point: Record<string, number> = { tp };
        Object.entries(data).forEach(([s, sims]) => {
          const sim = sims.find(x => x.tp === tp);
          if (sim) point[s] = sim.expectancy;
        });
        return point;
      });
  }, [data]);

  const strategies = Object.keys(data);

  return (
    <Card>
      <CardHeader>
        <CardTitle>TP Strategy Comparison</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {strategies.map(s => (
            <Badge
              key={s}
              variant={visible.has(s) ? 'default' : 'outline'}
              className="cursor-pointer"
              onClick={() => {
                const v = new Set(visible);
                v.has(s) ? v.delete(s) : v.add(s);
                setVisible(v);
              }}
              style={visible.has(s) ? { backgroundColor: getColor(s) } : {}}
            >
              {s}
            </Badge>
          ))}
        </div>

        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={chartData}>
            <CartesianGrid />
            <XAxis dataKey="tp" />
            <YAxis />
            <Tooltip />
            {strategies.map(s =>
              visible.has(s) ? (
                <Line
                  key={s}
                  type="monotone"
                  dataKey={s}
                  stroke={getColor(s)}
                  dot={false}
                  name={s}
                  strokeWidth={2}
                />
              ) : null
            )}
            <Legend />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
