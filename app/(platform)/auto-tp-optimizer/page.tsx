import { Metadata } from 'next';
import { AutoTPOptimizerV2 } from '@/components/auto-tp-optimizer-v2';

export const metadata: Metadata = {
  title: 'Dynamic Take-Profit Optimizer (v2)',
  description: 'Advanced TP optimization with multi-strategy comparison',
};

export default function AutoTPOptimizerPage() {
  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Dynamic Take-Profit Optimizer (v2)</h1>
        <p className="text-muted-foreground">Discover optimal TP levels across your strategies</p>
      </div>
      <AutoTPOptimizerV2 />
    </div>
  );
}
