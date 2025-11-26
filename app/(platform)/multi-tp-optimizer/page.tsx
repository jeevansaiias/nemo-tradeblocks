import { promises as fs } from 'fs';
import path from 'path';
import { MultiTPOptimizerPanel } from "@/components/multi-tp-optimizer/MultiTPOptimizerPanel";
import { ExcursionTrade } from "@/lib/calculations/multi-tp-optimizer";

async function getTrades(): Promise<ExcursionTrade[]> {
  try {
    const filePath = path.join(process.cwd(), 'data', 'tp_optimizer_mae_mfe.json');
    const fileContent = await fs.readFile(filePath, 'utf8');
    const data = JSON.parse(fileContent);

    // Map the JSON data to ExcursionTrade format
    // We synthesize premium/margin since the source only has percentages
    // Assuming $1000 premium basis for normalized calculation
    const BASE_PREMIUM = 1000;
    const BASE_MARGIN = 10000; // 10% yield assumption

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return data.trades.map((t: any) => ({
      id: t.trade_id,
      openedOn: new Date(t.entry_date),
      // Calculate PL based on actual_pct and our base premium
      pl: t.actual_pct * BASE_PREMIUM,
      marginReq: BASE_MARGIN,
      premium: BASE_PREMIUM,
      // MFE/MAE are already in decimal format (e.g. 0.51 for 51%)
      // The optimizer expects percentages (e.g. 51)
      maxProfitPct: t.mfe_pct * 100,
      maxLossPct: t.mae_pct * 100
    }));
  } catch (error) {
    console.error("Failed to load trades:", error);
    return [];
  }
}

export default async function MultiTPOptimizerPage() {
  const trades = await getTrades();

  return (
    <div className="space-y-6 pb-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Multi-TP Exit Optimizer
        </h1>
        <p className="text-muted-foreground mt-2">
          Experimental block for simulating multi-leg take profit strategies using MFE/MAE data.
        </p>
      </div>

      <MultiTPOptimizerPanel 
        trades={trades} 
        startingCapital={100000} 
      />
    </div>
  );
}
