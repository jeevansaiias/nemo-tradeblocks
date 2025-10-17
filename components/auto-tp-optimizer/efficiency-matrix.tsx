'use client';

interface StrategyMetrics {
  strategy: string;
  trade_count: number;
  avg_mfe: number;
  avg_mae: number;
  avg_missed_profit: number;
  recommended_tp: number;
  win_rate: number;
  efficiency_score: number;
}

export function EfficiencyMatrix({
  strategies,
}: {
  strategies: StrategyMetrics[];
}) {
  if (strategies.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        No strategies to display
      </div>
    );
  }

  // Sort strategies by efficiency score descending
  const sorted = [...strategies].sort(
    (a, b) => b.efficiency_score - a.efficiency_score
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <th className="text-left py-3 px-4 font-semibold">Strategy</th>
            <th className="text-right py-3 px-4 font-semibold">Trades</th>
            <th className="text-right py-3 px-4 font-semibold">Win Rate</th>
            <th className="text-right py-3 px-4 font-semibold">
              Efficiency
            </th>
            <th className="text-right py-3 px-4 font-semibold">Avg MFE</th>
            <th className="text-right py-3 px-4 font-semibold">Avg MAE</th>
            <th className="text-right py-3 px-4 font-semibold">
              Missed Profit
            </th>
            <th className="text-right py-3 px-4 font-semibold">Rec TP</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((strategy, idx) => (
            <tr
              key={idx}
              className="border-b hover:bg-muted/50 transition-colors"
            >
              <td className="py-3 px-4 font-medium">{strategy.strategy}</td>
              <td className="text-right py-3 px-4">
                {strategy.trade_count}
              </td>
              <td className="text-right py-3 px-4">
                <span className="inline-flex items-center justify-center w-8 h-6 rounded bg-green-100 text-green-800 text-xs font-semibold">
                  {strategy.win_rate}%
                </span>
              </td>
              <td className="text-right py-3 px-4">
                <div className="flex items-center justify-end gap-2">
                  <div className="flex-shrink-0 h-6 rounded bg-blue-100">
                    <div
                      className="h-6 rounded bg-blue-600 flex items-center justify-center text-white text-xs font-semibold"
                      style={{
                        width: `${(strategy.efficiency_score / 100) * 100}%`,
                      }}
                    >
                      {strategy.efficiency_score > 20
                        ? `${strategy.efficiency_score}%`
                        : ''}
                    </div>
                  </div>
                  <span className="w-10 text-right">{strategy.efficiency_score}%</span>
                </div>
              </td>
              <td className="text-right py-3 px-4">
                <span className="text-blue-600 font-semibold">
                  {strategy.avg_mfe.toFixed(2)}%
                </span>
              </td>
              <td className="text-right py-3 px-4">
                <span className="text-red-600">
                  {strategy.avg_mae.toFixed(2)}%
                </span>
              </td>
              <td className="text-right py-3 px-4">
                <span className="text-amber-600 font-semibold">
                  {strategy.avg_missed_profit.toFixed(2)}%
                </span>
              </td>
              <td className="text-right py-3 px-4 font-semibold">
                {strategy.recommended_tp.toFixed(2)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
