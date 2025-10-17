'use client';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Upload } from 'lucide-react';
import { StrategyComparison, StrategyData } from '@/components/auto-tp-optimizer/strategy-comparison';

export function AutoTPOptimizerV2() {
  const [data, setData] = useState<StrategyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);

    try {
      const text = await file.text();
      const res = await fetch('/api/tp-optimizer-results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csvContent: text })
      });

      const result = await res.json();
      if (result.data) {
        setData(result.data);
      } else {
        setError(result.error || 'Failed to process file');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'File upload failed');
    } finally {
      setUploading(false);
      if (e.target) e.target.value = '';
    }
  };

  if (loading) return <Card><CardContent className="p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin" /></CardContent></Card>;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>TP Optimizer v2</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">Compare optimal TP levels across strategies</p>
          
          {/* File Upload */}
          <div className="border-2 border-dashed rounded-lg p-6 text-center hover:bg-muted/50 transition">
            <label className="cursor-pointer flex flex-col items-center gap-2">
              <Upload className="w-8 h-8 text-muted-foreground" />
              <span className="font-medium">Upload Your Trade Log</span>
              <span className="text-xs text-muted-foreground">CSV format: strategy, maxProfitPct, resultPct</span>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                disabled={uploading}
                className="hidden"
              />
              <Button variant="outline" size="sm" disabled={uploading}>
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  'Choose CSV File'
                )}
              </Button>
            </label>
          </div>

          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded text-sm text-red-700 dark:text-red-200">
              {error}
            </div>
          )}

          {data && (
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{Object.keys(data).length} strategies loaded</Badge>
              <span className="text-xs text-muted-foreground">Ready to optimize</span>
            </div>
          )}
        </CardContent>
      </Card>

      {!data ? (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            Upload a CSV file to get started
          </CardContent>
        </Card>
      ) : (
        <StrategyComparison data={data} />
      )}
    </div>
  );
}
