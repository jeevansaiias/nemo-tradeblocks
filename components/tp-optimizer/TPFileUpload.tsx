"use client";

import { useCallback, useState } from "react";
import { Upload, FileText, AlertCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { useTPOptimizerStore } from "@/lib/stores/tp-optimizer-store";
import Papa from "papaparse";
import { TradeRecord } from "@/lib/stores/tp-optimizer-store";
import { pct } from "@/lib/processing/auto-tp";
import { addTrades, createBlock, updateTradesForBlock } from "@/lib/db";
import { useBlockStore } from "@/lib/stores/block-store";
import type { Trade } from "@/lib/models/trade";

interface TPFileUploadProps {
  onDataLoaded?: () => void;
}

export function TPFileUpload({ onDataLoaded }: TPFileUploadProps) {
  const { setData, data, setActiveTab } = useTPOptimizerStore();
  const [replaceMode, setReplaceMode] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parseCSVData = useCallback((csvText: string): TradeRecord[] => {
    const parsed = Papa.parse(csvText, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header: string) => header.trim()
    });

    if (parsed.errors.length > 0) {
      throw new Error(`CSV parsing error: ${parsed.errors[0].message}`);
    }

    const rows = parsed.data as Record<string, string | number>[];
    const trades: TradeRecord[] = [];

    for (const row of rows) {
      try {
        // Map headers to TradeRecord fields - support multiple column name formats
        const strategy = String(row["Strategy"] || row["strategy"] || "Unknown");
        
        // Handle dates - support your CSV format
        const entryDate = parseDate(String(
          row["Date Opened"] || row["Entry Date"] || row["entry_date"] || row["Date"]
        ));
        const exitDate = parseDate(String(
          row["Date Closed"] || row["Exit Date"] || row["exit_date"] || row["Date"]
        ));
        
        // Handle percentages/values - support your CSV format
        const maxProfitPct = parsePercentage(
          row["Max Profit"] || row["Max Profit %"] || row["max_profit_pct"] || row["max_profit"]
        );
        const maxLossPct = parsePercentage(
          row["Max Loss"] || row["Max Loss %"] || row["max_loss_pct"] || row["max_loss"]
        );
        const resultPct = parsePercentage(
          row["P/L"] || row["Result %"] || row["result_pct"] || row["Result"] || row["PnL"]
        );

        if (isNaN(maxProfitPct) || isNaN(maxLossPct) || isNaN(resultPct)) {
          console.warn("Skipping row with invalid percentages:", row);
          continue;
        }

        trades.push({
          strategy,
          entryDate: entryDate.toISOString(),
          exitDate: exitDate.toISOString(),
          maxProfitPct,
          maxLossPct,
          resultPct
        });
      } catch (err) {
        console.warn("Skipping invalid row:", row, err);
      }
    }

    if (trades.length === 0) {
      throw new Error("No valid trades found in CSV. Please check column headers and data format.");
    }

    return trades;
  }, []);

  // Try to map a raw CSV row (header normalized) to full Trade model when possible
  const tryMapRawRowsToTrades = useCallback((rows: Record<string, string | number>[]): Trade[] => {
    const mapped: Trade[] = [];
    const parseNumber = (v: unknown): number => {
      if (v === null || v === undefined || v === "") return 0;
      const s = String(v).replace(/[$,%]/g, "").replace(/,/g, "").trim();
      const n = Number(s);
      return Number.isFinite(n) ? n : 0;
    };

    for (const row of rows) {
      try {
        const dateOpenedRaw = (row["Date Opened"] ?? row["Entry Date"] ?? row["Date"] ?? "") as string;
        const dateClosedRaw = (row["Date Closed"] ?? row["Exit Date"] ?? "") as string;

        const dateOpened = dateOpenedRaw ? new Date(String(dateOpenedRaw)) : new Date();
        const dateClosed = dateClosedRaw ? new Date(String(dateClosedRaw)) : undefined;

        const trade: Trade = {
          dateOpened,
          timeOpened: String(row["Time Opened"] ?? row["Time"] ?? "00:00:00"),
          openingPrice: parseNumber(row["Opening Price"] ?? 0),
          legs: String(row["Legs"] ?? ""),
          premium: parseNumber(row["Premium"] ?? 0),
          premiumPrecision: undefined,
          closingPrice: parseNumber(row["Closing Price"] ?? 0) || undefined,
          dateClosed: dateClosed,
          timeClosed: String(row["Time Closed"] ?? ""),
          avgClosingCost: parseNumber(row["Avg. Closing Cost"] ?? 0) || undefined,
          reasonForClose: String(row["Reason For Close"] ?? row["Reason"] ?? ""),
          pl: parseNumber(row["P/L"] ?? row["Result"] ?? row["PnL"] ?? 0),
          numContracts: parseNumber(row["No. of Contracts"] ?? row["Contracts"] ?? 1),
          fundsAtClose: parseNumber(row["Funds at Close"] ?? 100000),
          marginReq: parseNumber(row["Margin Req."] ?? row["Margin Req"] ?? 0),
          strategy: String(row["Strategy"] ?? row["strategy"] ?? "Unknown"),
          openingCommissionsFees: parseNumber(row["Opening Commissions + Fees"] ?? row["Opening comms & fees"] ?? 0),
          closingCommissionsFees: parseNumber(row["Closing Commissions + Fees"] ?? 0),
          openingShortLongRatio: parseNumber(row["Opening Short/Long Ratio"] ?? 0),
          closingShortLongRatio: parseNumber(row["Closing Short/Long Ratio"] ?? 0) || undefined,
        } as Trade;

        mapped.push(trade);
      } catch {
        // Skip invalid rows
        continue;
      }
    }

    return mapped;
  }, []);

  const parseDate = (dateStr: string): Date => {
    if (!dateStr) throw new Error("Date is required");
    
    // Try different date formats
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      throw new Error(`Invalid date format: ${dateStr}`);
    }
    
    return date;
  };

  const parsePercentage = (value: string | number): number => {
    try {
      return pct(value);
    } catch {
      throw new Error(`Invalid percentage: ${value}`);
    }
  };

  const handleFile = useCallback((file: File) => {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setError("Please upload a CSV file");
      return;
    }

    setIsProcessing(true);
    setError(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const csvText = e.target?.result as string;

        // Parse raw CSV first so we can detect whether it's a full trade log
        const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true, transformHeader: (h: string) => h.trim() });
        const rows = parsed.data as Record<string, string | number>[];

        // If CSV looks like a full trade log (has Date Opened or P/L), try mapping to full Trade model and persist
        const headerSet = new Set((parsed.meta.fields || []).map((f: string) => f.trim()));
        const looksLikeTradeLog = headerSet.has("Date Opened") || headerSet.has("P/L") || headerSet.has("No. of Contracts");

        if (looksLikeTradeLog) {
          const mappedTrades = tryMapRawRowsToTrades(rows);

          if (mappedTrades.length === 0) {
            throw new Error("No valid trade rows found for persistence. Falling back to TP optimizer format.");
          }

          // Persist into active block or create a new block
          (async () => {
            try {
              const activeBlockId = useBlockStore.getState().activeBlockId;

              let targetBlockId = activeBlockId;

              if (!targetBlockId) {
                // Create a new block in DB and set it active in store
                const newBlock = await createBlock({
                  name: file.name.replace(/\.csv$/i, ""),
                  description: "Imported via CSV upload",
                  isActive: true,
                  tradeLog: {
                    fileName: file.name,
                    fileSize: file.size,
                    originalRowCount: rows.length,
                    processedRowCount: mappedTrades.length,
                    uploadedAt: new Date(),
                  },
                  processingStatus: 'completed',
                  dataReferences: { tradesStorageKey: '' },
                  analysisConfig: {
                    riskFreeRate: 2.0,
                    useBusinessDaysOnly: true,
                    annualizationFactor: 252,
                    confidenceLevel: 95,
                    combineLegGroups: false,
                  },
                });
                targetBlockId = newBlock.id;
                // Refresh block list and set active
                await useBlockStore.getState().loadBlocks();
                useBlockStore.getState().setActiveBlock(targetBlockId);
              }

              if (targetBlockId) {
                if (replaceMode) {
                  await updateTradesForBlock(targetBlockId, mappedTrades);
                } else {
                  await addTrades(targetBlockId, mappedTrades);
                }
                // Refresh the block's cached stats
                await useBlockStore.getState().refreshBlock(targetBlockId);
                // Notify user
                toast.success(
                  replaceMode
                    ? `Replaced ${mappedTrades.length} trades in block.`
                    : `Added ${mappedTrades.length} trades to block.`
                );
              }
            } catch (err) {
              console.error("Failed to persist trades to block:", err);
              toast.error(err instanceof Error ? err.message : "Failed to persist trades to block");
            }
          })();

          // Also set TP optimizer store so the optimizer UI has data (convert to TradeRecord if possible)
          try {
            const tpRecords: TradeRecord[] = rows.map((r) => ({
              strategy: String(r["Strategy"] ?? r["strategy"] ?? "Unknown"),
              entryDate: String(r["Date Opened"] ?? r["Entry Date"] ?? r["Date"] ?? new Date().toISOString()),
              exitDate: String(r["Date Closed"] ?? r["Exit Date"] ?? new Date().toISOString()),
              maxProfitPct: pct(r["Max Profit"] ?? r["Max Profit %"] ?? r["Max Profit %"] ?? 0),
              maxLossPct: pct(r["Max Loss"] ?? r["Max Loss %"] ?? 0),
              resultPct: pct(r["P/L"] ?? r["Result %"] ?? r["Result"] ?? 0),
            }));

            setData(tpRecords.filter(tr => !isNaN(tr.maxProfitPct)));
          } catch {
            // ignore
          }

          setIsProcessing(false);
          onDataLoaded?.();
          return;
        }

        // Fallback to TP optimizer format parsing
        const trades = parseCSVData(csvText);
        setData(trades);
        setIsProcessing(false);
        onDataLoaded?.();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to parse CSV file");
        setIsProcessing(false);
      }
    };

    reader.onerror = () => {
      setError("Failed to read file");
      setIsProcessing(false);
    };

    reader.readAsText(file);
  }, [parseCSVData, setData, onDataLoaded, tryMapRawRowsToTrades, replaceMode]);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    const csvFile = files.find(file => file.name.toLowerCase().endsWith('.csv'));

    if (csvFile) {
      handleFile(csvFile);
    } else {
      setError("Please drop a CSV file");
    }
  }, [handleFile]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
  }, [handleFile]);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  if (data.length > 0) {
    return (
      <div className="space-y-4">
        {/* Success State */}
        <Alert>
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>
            Successfully loaded {data.length} trades from your CSV file.
          </AlertDescription>
        </Alert>

        {/* Data Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-muted rounded-lg">
            <div className="text-2xl font-bold">{data.length}</div>
            <div className="text-sm text-muted-foreground">Total Trades</div>
          </div>
          <div className="text-center p-4 bg-muted rounded-lg">
            <div className="text-2xl font-bold">
              {new Set(data.map(t => t.strategy)).size}
            </div>
            <div className="text-sm text-muted-foreground">Strategies</div>
          </div>
          <div className="text-center p-4 bg-green-50 dark:bg-green-950 rounded-lg">
            <div className="text-2xl font-bold text-green-600">
              {data.filter(t => t.resultPct > 0).length}
            </div>
            <div className="text-sm text-green-600">Winners</div>
          </div>
          <div className="text-center p-4 bg-red-50 dark:bg-red-950 rounded-lg">
            <div className="text-2xl font-bold text-red-600">
              {data.filter(t => t.resultPct <= 0).length}
            </div>
            <div className="text-sm text-red-600">Losers</div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button 
            onClick={() => setActiveTab("optimize")}
            className="flex-1"
          >
            Proceed to Optimization
          </Button>
          <Button 
            variant="outline" 
            onClick={() => setData([])}
          >
            Upload Different File
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* File Upload Area */}
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          isDragOver
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-muted-foreground/50"
        }`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <div className="space-y-4">
          <div className="flex justify-center">
            <Upload className="h-12 w-12 text-muted-foreground" />
          </div>
          
          <div>
            <h3 className="text-lg font-semibold">Upload Trading Data</h3>
            <p className="text-muted-foreground">
              Drag and drop your CSV file here, or click to browse
            </p>
          </div>

          <label className="block">
            <input
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              className="sr-only"
              disabled={isProcessing}
            />
            <Button 
              variant="outline" 
              disabled={isProcessing}
              className="cursor-pointer"
              asChild
            >
              <span>
                {isProcessing ? "Processing..." : "Choose CSV File"}
              </span>
            </Button>
          </label>
          {/* Replace vs Append toggle */}
          <div className="mt-2 flex items-center justify-center gap-2 text-sm">
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={replaceMode}
                onChange={(e) => setReplaceMode(e.target.checked)}
                className="rounded"
              />
              <span>Replace existing trades for target block (overwrite)</span>
            </label>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Format Requirements */}
      <div className="bg-muted/50 rounded-lg p-4">
        <h4 className="font-semibold mb-2 flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Required CSV Format
        </h4>
        <div className="space-y-1 text-sm text-muted-foreground">
          <p><strong>Supported columns:</strong></p>
          <p>• <strong>Strategy:</strong> Strategy name</p>
          <p>• <strong>Dates:</strong> Date Opened/Entry Date, Date Closed/Exit Date</p>
          <p>• <strong>Performance:</strong> Max Profit, Max Loss, P/L/Result %</p>
          <p><strong>Date format:</strong> YYYY-MM-DD, MM/DD/YYYY, or any standard format</p>
          <p><strong>Number format:</strong> Supports large values like 2,345.67% or $1,234.56 (commas, %, $ automatically stripped)</p>
          <div className="mt-2">
            <Badge variant="outline" className="text-xs">
              Your CSV format is supported: Date Opened, Date Closed, Strategy, Max Profit, Max Loss, P/L
            </Badge>
          </div>
        </div>
      </div>
    </div>
  );
}