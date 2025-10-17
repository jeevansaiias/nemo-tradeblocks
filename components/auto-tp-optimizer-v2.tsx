'use client';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { StrategyComparison, StrategyData } from '@/components/auto-tp-optimizer/strategy-comparison';

export function AutoTPOptimizerV2() {
  const [data, setData] = useState<StrategyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/tp-optimizer-results');
        const result = await res.json();
        if (result.data) setData(result.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) return <Card><CardContent className="p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin" /></CardContent></Card>;
  if (error || !data) return <Card><CardContent className="p-6"><p className="text-red-600">Error: {error}</p></CardContent></Card>;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>TP Optimizer v2</CardTitle></CardHeader>
        <CardContent><p className="text-sm text-muted-foreground">Compare optimal TP levels across strategies</p></CardContent>
      </Card>
      <StrategyComparison data={data} />
    </div>
  );
}
