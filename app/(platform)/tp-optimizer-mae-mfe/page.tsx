import { AutoTPOptimizerMAEMFE } from '@/components/auto-tp-optimizer-mae-mfe';

export const metadata = {
  title: 'TP Optimizer (MAE/MFE Edition)',
  description: 'Analyze Maximum Favorable and Adverse Excursions to optimize take-profit levels',
};

export default function TPOptimizerMAEMFEPage() {
  return (
    <div className="space-y-6 pb-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          TP Optimizer (MAE/MFE Edition)
        </h1>
        <p className="text-muted-foreground mt-2">
          Analyze Maximum Favorable Excursion (MFE) and Maximum Adverse Excursion (MAE) to identify optimal take-profit levels for your strategies. Upload your trade logs to see detailed analysis and efficiency metrics.
        </p>
      </div>

      <AutoTPOptimizerMAEMFE />
    </div>
  );
}
