import { Metadata } from 'next';
import { AutoTPOptimizerV3 } from '@/components/auto-tp-optimizer-v3';

export const metadata: Metadata = {
  title: 'Dynamic Take-Profit Optimizer (v3)',
  description: 'Advanced TP optimization with clustering, simulation, and dynamic adjustment',
};

export default function AutoTPOptimizerV3Page() {
  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Dynamic Take-Profit Optimizer (v3)</h1>
        <p className="text-muted-foreground">AI-driven TP clustering, simulation, and optimization</p>
      </div>
      <AutoTPOptimizerV3 />
    </div>
  );
}
