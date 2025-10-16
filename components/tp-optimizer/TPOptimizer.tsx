"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Upload, Target, BarChart3 } from "lucide-react";
import { TPFileUpload } from "./TPFileUpload";
import { TPOptimizePanel } from "./TPOptimizePanel";
import { TPSummary } from "./TPSummary";
import { useTPOptimizerStore } from "@/lib/stores/tp-optimizer-store";

export function TPOptimizer() {
  const { data, baseline, best, activeTab, setActiveTab } = useTPOptimizerStore();

  const hasData = data.length > 0;
  const hasResults = baseline && best;

  return (
    <div className="space-y-6">
      {/* Status Indicators */}
      <div className="flex gap-2">
        <Badge variant={hasData ? "default" : "outline"}>
          {hasData ? `${data.length} trades loaded` : "No data"}
        </Badge>
        <Badge variant={hasResults ? "default" : "outline"}>
          {hasResults ? `Optimized (${best.tpPct}% TP)` : "Not optimized"}
        </Badge>
      </div>

      {/* Feature Description */}
      <Alert>
        <Target className="h-4 w-4" />
        <AlertDescription>
          <strong>Auto Take-Profit Analysis:</strong> Upload your trading data and automatically discover 
          the single best take-profit percentage. This tool keeps your existing stop-loss behavior unchanged 
          and compares optimized results against your baseline (hold to expiry) performance.
        </AlertDescription>
      </Alert>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="upload" className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Upload Data
          </TabsTrigger>
          <TabsTrigger value="optimize" disabled={!hasData} className="flex items-center gap-2">
            <Target className="h-4 w-4" />
            Optimize TP
          </TabsTrigger>
          <TabsTrigger value="summary" disabled={!hasResults} className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Results Summary
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Upload Trading Data</CardTitle>
              <CardDescription>
                Upload your CSV file with trading data. Required columns: Strategy, Entry Date, Exit Date, 
                Max Profit %, Max Loss %, Result %
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TPFileUpload onDataLoaded={() => setActiveTab("optimize")} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="optimize" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Take-Profit Optimization</CardTitle>
              <CardDescription>
                Choose your optimization objective and run the automatic take-profit analysis
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TPOptimizePanel onOptimizationComplete={() => setActiveTab("summary")} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="summary" className="space-y-6">
          <TPSummary />
        </TabsContent>
      </Tabs>
    </div>
  );
}