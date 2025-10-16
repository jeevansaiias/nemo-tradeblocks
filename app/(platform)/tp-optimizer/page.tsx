import { Metadata } from "next";

import { TPOptimizer } from "@/components/tp-optimizer/TPOptimizer";

export const metadata: Metadata = {
  title: "Auto Take-Profit Optimizer",
  description: "Optimize your take-profit levels automatically while keeping stop-loss behavior unchanged. Find the best TP percentage for your trading strategies.",
};

export default function TPOptimizerPage() {
  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Auto Take-Profit Optimizer</h2>
        <div className="text-sm text-muted-foreground">
          Find the optimal take-profit percentage for your strategies
        </div>
      </div>
      <TPOptimizer />
    </div>
  );
}