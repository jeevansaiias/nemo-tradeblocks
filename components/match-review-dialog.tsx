"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import type { AlignedTradeSet } from "@/lib/stores/comparison-store";
import type { TradePair } from "@/lib/models/strategy-alignment";
import type { NormalizedTrade } from "@/lib/services/trade-reconciliation";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { Unlock, Link2, RotateCcw } from "lucide-react";

interface MatchReviewDialogProps {
  alignment: AlignedTradeSet | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (tradePairs: TradePair[]) => void;
  normalizeTo1Lot?: boolean;
  onNormalizeTo1LotChange?: (value: boolean) => void;
}

export function MatchReviewDialog({
  alignment,
  open,
  onOpenChange,
  onSave,
  normalizeTo1Lot = false,
  onNormalizeTo1LotChange,
}: MatchReviewDialogProps) {
  const [confirmedPairs, setConfirmedPairs] = useState<TradePair[]>([]);
  const [selectedBacktested, setSelectedBacktested] = useState<string | null>(null);
  const [selectedReported, setSelectedReported] = useState<string | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  useEffect(() => {
    if (alignment && open) {
      // Build pairs from the session data
      // When a user has saved custom pairs, they come through selectedBacktestedIds/selectedReportedIds
      // We need to build the pairs from what's actually matched in sessions
      const loadedPairs: TradePair[] = [];

      alignment.sessions.forEach((session) => {
        session.items.forEach((item) => {
          // Only include items that have both backtested and reported trades
          if (item.backtested && item.reported) {
            // Determine if this is a manual pair or auto pair
            // If it's auto-matched (autoBacktested && autoReported), it's auto
            // Otherwise, it's a manual pairing
            const isAuto = item.autoBacktested && item.autoReported;

            loadedPairs.push({
              backtestedId: item.backtested.id,
              reportedId: item.reported.id,
              manual: !isAuto,
            });
          }
        });
      });

      setConfirmedPairs(loadedPairs);
      setSelectedBacktested(null);
      setSelectedReported(null);
    }
  }, [alignment, open]);

  const handleUnlockPair = (pair: TradePair) => {
    setConfirmedPairs((prev) => prev.filter(
      (p) => !(p.backtestedId === pair.backtestedId && p.reportedId === pair.reportedId)
    ));
  };

  const handleCreateManualPair = () => {
    if (!selectedBacktested || !selectedReported || !alignment) return;

    const backtestedTrade = backtestedById.get(selectedBacktested);
    const reportedTrade = reportedById.get(selectedReported);

    if (!backtestedTrade || !reportedTrade) return;

    const newPair: TradePair = {
      backtestedId: selectedBacktested,
      reportedId: selectedReported,
      manual: true,
    };

    // Insert the pair in chronological order based on backtested trade time
    setConfirmedPairs((prev) => {
      const updated = [...prev, newPair];

      // Sort by backtested trade sortTime
      updated.sort((a, b) => {
        const tradeA = backtestedById.get(a.backtestedId);
        const tradeB = backtestedById.get(b.backtestedId);

        if (!tradeA || !tradeB) return 0;

        return tradeA.sortTime - tradeB.sortTime;
      });

      return updated;
    });

    setSelectedBacktested(null);
    setSelectedReported(null);
  };

  const handleResetToAuto = () => {
    // Check if there are any manual pairs
    const hasManualPairs = confirmedPairs.some(p => p.manual);

    if (hasManualPairs) {
      // Show confirmation dialog
      setShowResetConfirm(true);
    } else {
      // No manual pairs, safe to reset
      confirmResetToAuto();
    }
  };

  const confirmResetToAuto = () => {
    if (!alignment) return;

    const autoPairs: TradePair[] = [];

    alignment.sessions.forEach((session) => {
      session.items.forEach((item) => {
        if (item.backtested && item.reported && item.autoBacktested && item.autoReported) {
          autoPairs.push({
            backtestedId: item.backtested.id,
            reportedId: item.reported.id,
            manual: false,
          });
        }
      });
    });

    setConfirmedPairs(autoPairs);
    setSelectedBacktested(null);
    setSelectedReported(null);
    setShowResetConfirm(false);
  };

  const handleSave = () => {
    onSave(confirmedPairs);
  };

  const handleClose = (nextOpen: boolean) => {
    if (!nextOpen) {
      onOpenChange(false);
    } else {
      onOpenChange(true);
    }
  };

  if (!alignment) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Review Trade Matches</DialogTitle>
            <DialogDescription>
              Select a strategy mapping to review matches.
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    );
  }

  // Get paired trade IDs
  const pairedBacktestedIds = new Set(confirmedPairs.map((p) => p.backtestedId));
  const pairedReportedIds = new Set(confirmedPairs.map((p) => p.reportedId));

  // Get unmatched trades
  const unmatchedBacktested = alignment.backtestedTrades.filter(
    (trade) => !pairedBacktestedIds.has(trade.id)
  );
  const unmatchedReported = alignment.reportedTrades.filter(
    (trade) => !pairedReportedIds.has(trade.id)
  );

  // Build trade lookup maps
  const backtestedById = new Map(
    alignment.backtestedTrades.map((t) => [t.id, t])
  );
  const reportedById = new Map(
    alignment.reportedTrades.map((t) => [t.id, t])
  );

  const canCreatePair = selectedBacktested && selectedReported;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="h-[90vh] w-[calc(100vw-4rem)] !max-w-[calc(100vw-4rem)] flex flex-col">
        <DialogHeader>
          <DialogTitle>Review Trade Matches</DialogTitle>
          <div className="space-y-1 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Backtested:
              </span>
              <span className="font-semibold text-foreground">
                {alignment.backtestedStrategy}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Reported:
              </span>
              <span className="font-semibold text-foreground">
                {alignment.reportedStrategy}
              </span>
            </div>
            {normalizeTo1Lot && (
              <div className="flex items-center gap-2 pt-1">
                <Badge variant="secondary" className="text-xs">
                  Normalized to 1-lot
                </Badge>
                <span className="text-xs text-muted-foreground">
                  All values shown per contract
                </span>
              </div>
            )}
          </div>
          <DialogDescription>
            Lock in confirmed trade pairs or create manual matches between backtested and reported trades.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-6 overflow-hidden flex-1 min-h-0">
          {/* Confirmed Pairs Section */}
          <div className="flex flex-col overflow-hidden rounded-md border flex-1">
            <div className="flex items-center justify-between border-b px-4 py-3 bg-green-500/10 dark:bg-green-500/20">
              <div>
                <div className="text-sm font-semibold text-green-700 dark:text-green-400">Confirmed Pairs</div>
                <div className="text-xs text-muted-foreground">
                  {confirmedPairs.length} matched {confirmedPairs.length === 1 ? 'pair' : 'pairs'}
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Switch
                    id="normalize-dialog"
                    checked={normalizeTo1Lot}
                    onCheckedChange={onNormalizeTo1LotChange}
                    disabled={!onNormalizeTo1LotChange}
                  />
                  <Label htmlFor="normalize-dialog" className="cursor-pointer text-xs">
                    Normalize to 1-lot
                  </Label>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleResetToAuto}
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Reset to Auto
                </Button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {confirmedPairs.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  No confirmed pairs yet. Select trades below to create manual matches.
                </div>
              ) : (
                <div className="divide-y">
                  {confirmedPairs.map((pair) => {
                    const backtested = backtestedById.get(pair.backtestedId);
                    const reported = reportedById.get(pair.reportedId);

                    if (!backtested || !reported) return null;

                    return (
                      <div
                        key={`${pair.backtestedId}-${pair.reportedId}`}
                        className="flex items-center gap-4 p-4 hover:bg-muted/30 transition-colors"
                      >
                        <div className="flex-1 grid grid-cols-[1fr_auto_1fr] gap-4 items-center">
                          <TradeCard trade={backtested} label="Backtested" normalizeTo1Lot={normalizeTo1Lot} />
                          <Link2 className="h-4 w-4 text-muted-foreground shrink-0" />
                          <TradeCard trade={reported} label="Reported" normalizeTo1Lot={normalizeTo1Lot} />
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={pair.manual ? "secondary" : "default"} className="text-xs">
                            {pair.manual ? "MANUAL" : "AUTO"}
                          </Badge>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleUnlockPair(pair)}
                            aria-label="Unlock pair"
                          >
                            <Unlock className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Unmatched Trades Section */}
          <div className="flex flex-col overflow-hidden rounded-md border flex-1">
            <div className="border-b px-4 py-3 bg-amber-500/10 dark:bg-amber-500/20">
              <div className="text-sm font-semibold text-amber-700 dark:text-amber-400">Unmatched Trades</div>
              <div className="text-xs text-muted-foreground">
                Select one trade from each side to create a manual pair
              </div>
            </div>
            <div className="flex-1 overflow-hidden grid grid-cols-2 divide-x min-h-0">
              {/* Backtested Trades */}
              <div className="flex flex-col overflow-hidden">
                <div className="px-4 py-2 border-b bg-blue-500/10 dark:bg-blue-500/20">
                  <div className="text-xs font-medium uppercase tracking-wide text-blue-700 dark:text-blue-400">
                    Backtested ({unmatchedBacktested.length})
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto">
                  {unmatchedBacktested.length === 0 ? (
                    <div className="p-8 text-center text-sm text-muted-foreground">
                      All backtested trades are paired
                    </div>
                  ) : (
                    <div className="divide-y">
                      {unmatchedBacktested.map((trade) => (
                        <button
                          key={trade.id}
                          type="button"
                          onClick={() => setSelectedBacktested(
                            selectedBacktested === trade.id ? null : trade.id
                          )}
                          className={cn(
                            "w-full p-3 text-left transition-colors",
                            selectedBacktested === trade.id
                              ? "bg-primary/10 border-l-4 border-primary"
                              : "hover:bg-muted/50"
                          )}
                          aria-label={`Select backtested trade from ${formatDateTime(trade)}`}
                        >
                          <TradeListItem trade={trade} normalizeTo1Lot={normalizeTo1Lot} />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Reported Trades */}
              <div className="flex flex-col overflow-hidden">
                <div className="px-4 py-2 border-b bg-purple-500/10 dark:bg-purple-500/20">
                  <div className="text-xs font-medium uppercase tracking-wide text-purple-700 dark:text-purple-400">
                    Reported ({unmatchedReported.length})
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto">
                  {unmatchedReported.length === 0 ? (
                    <div className="p-8 text-center text-sm text-muted-foreground">
                      All reported trades are paired
                    </div>
                  ) : (
                    <div className="divide-y">
                      {unmatchedReported.map((trade) => (
                        <button
                          key={trade.id}
                          type="button"
                          onClick={() => setSelectedReported(
                            selectedReported === trade.id ? null : trade.id
                          )}
                          className={cn(
                            "w-full p-3 text-left transition-colors",
                            selectedReported === trade.id
                              ? "bg-primary/10 border-l-4 border-primary"
                              : "hover:bg-muted/50"
                          )}
                          aria-label={`Select reported trade from ${formatDateTime(trade)}`}
                        >
                          <TradeListItem trade={trade} normalizeTo1Lot={normalizeTo1Lot} />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Create Pair Button */}
            {canCreatePair && (
              <div className="border-t px-4 py-3 bg-muted/30">
                <Button
                  type="button"
                  onClick={handleCreateManualPair}
                  className="w-full"
                  size="sm"
                >
                  <Link2 className="mr-2 h-4 w-4" />
                  Create Manual Pair
                </Button>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between">
          <div className="text-xs text-muted-foreground">
            {confirmedPairs.length} pairs • {unmatchedBacktested.length} unmatched BT • {unmatchedReported.length} unmatched RPT
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSave}
            >
              Save Pairs
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>

      <AlertDialog open={showResetConfirm} onOpenChange={setShowResetConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset to Auto Matching?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove all manual trade pairs and reset to automatic matching based on time proximity.
              <br /><br />
              <strong>This action cannot be undone.</strong> Any manual pairings you created will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmResetToAuto}>
              Reset to Auto
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}

function TradeCard({ trade, label, normalizeTo1Lot }: { trade: NormalizedTrade; label: string; normalizeTo1Lot: boolean }) {
  // Normalize values if flag is set
  const displayPremium = normalizeTo1Lot && trade.contracts > 0
    ? trade.totalPremium / trade.contracts
    : trade.totalPremium;
  const displayPl = normalizeTo1Lot && trade.contracts > 0
    ? trade.pl / trade.contracts
    : trade.pl;

  return (
    <div className="space-y-1">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center gap-3">
          <div className="text-sm font-medium whitespace-nowrap">
            {formatDateTime(trade)}
          </div>
          <Badge variant="outline" className="text-xs shrink-0">
            {normalizeTo1Lot ? '1x' : `${trade.contracts}x`}
          </Badge>
          <div className="text-xs text-muted-foreground tabular-nums">
            {formatCurrency(displayPremium)}
          </div>
          <div
            className={cn(
              "text-sm font-semibold tabular-nums",
              displayPl >= 0
                ? "text-green-600 dark:text-green-500"
                : "text-red-600 dark:text-red-500"
            )}
          >
            {formatCurrency(displayPl)}
          </div>
        </div>
        {trade.legs && (
          <div className="text-xs text-muted-foreground font-mono leading-relaxed">
            {trade.legs}
          </div>
        )}
      </div>
    </div>
  );
}

function TradeListItem({ trade, normalizeTo1Lot }: { trade: NormalizedTrade; normalizeTo1Lot: boolean }) {
  // Normalize values if flag is set
  const displayPremium = normalizeTo1Lot && trade.contracts > 0
    ? trade.totalPremium / trade.contracts
    : trade.totalPremium;
  const displayPl = normalizeTo1Lot && trade.contracts > 0
    ? trade.pl / trade.contracts
    : trade.pl;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-medium">
          {formatDateTime(trade)}
        </div>
        <Badge variant="outline" className="text-xs">
          {normalizeTo1Lot ? '1x' : `${trade.contracts}x`}
        </Badge>
      </div>
      {trade.legs && (
        <div className="text-[11px] text-muted-foreground font-mono leading-relaxed">
          {trade.legs}
        </div>
      )}
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs text-muted-foreground tabular-nums">
          Premium: {formatCurrency(displayPremium)}
        </div>
        <div
          className={cn(
            "text-sm font-semibold tabular-nums",
            displayPl >= 0
              ? "text-green-600 dark:text-green-500"
              : "text-red-600 dark:text-red-500"
          )}
        >
          {formatCurrency(displayPl)}
        </div>
      </div>
    </div>
  );
}

function formatDateTime(trade: {
  dateOpened: Date;
  timeOpened?: string;
  sortTime: number;
}): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(trade.sortTime));
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}
