/**
 * Dynamic Take-Profit Optimizer (MAE/MFE Edition)
 * 
 * Analyzes Maximum Favorable Excursion (MFE) and Maximum Adverse Excursion (MAE)
 * to determine optimal take-profit levels for each strategy.
 */

export interface Trade {
  trade_id: string;
  strategy: string;
  entry_date: string;
  exit_date: string;
  entry_price: number;
  exit_price: number;
  max_price: number;
  min_price: number;
  contracts: number;
  exit_reason: string;
}

export interface EnrichedTrade {
  trade_id: string;
  strategy: string;
  entry_price: number;
  exit_price: number;
  actual_pct: number;
  max_profit_pct: number;
  max_loss_pct: number;
  mfe_pct: number;
  mae_pct: number;
  exit_reason: string;
  optimal_tp: number;
  missed_profit_pct: number;
  efficiency: number;
}

export interface StrategyMetrics {
  strategy: string;
  trade_count: number;
  avg_mfe: number;
  avg_mae: number;
  avg_missed_profit: number;
  recommended_tp: number;
  win_rate: number;
  efficiency_score: number;
}

export interface ExitReasonBreakdown {
  reason: string;
  count: number;
  avg_missed_profit: number;
  recommended_tp: number;
}

/**
 * Calculate MFE (Maximum Favorable Excursion) and MAE (Maximum Adverse Excursion)
 * MFE: How much profit the trade reached before exiting
 * MAE: How much loss the trade reached before exiting
 */
export function calculateExcursions(trade: Trade): {
  mfe_pct: number;
  mae_pct: number;
  max_profit_pct: number;
  max_loss_pct: number;
} {
  // MFE: Maximum price reached relative to entry
  const mfe_pct = ((trade.max_price - trade.entry_price) / trade.entry_price) * 100;

  // MAE: Minimum price reached relative to entry
  const mae_pct = ((trade.min_price - trade.entry_price) / trade.entry_price) * 100;

  // Actual result
  const actual_pct = ((trade.exit_price - trade.entry_price) / trade.entry_price) * 100;

  // Max loss would be the most negative point
  const max_loss_pct = Math.min(mae_pct, actual_pct);

  // Max profit would be if we exited at the highest point
  const max_profit_pct = mfe_pct;

  return { mfe_pct, mae_pct, max_profit_pct, max_loss_pct };
}

/**
 * Determine optimal TP level based on MFE
 * Optimal TP is slightly below MFE to account for slippage
 */
export function calculateOptimalTP(mfe_pct: number, actual_pct: number): number {
  // Use 90% of MFE as optimal TP (accounts for slippage/market dynamics)
  const theoretical_tp = mfe_pct * 0.90;
  
  // But never set TP below actual exit (that wouldn't make sense)
  const optimal_tp = Math.max(actual_pct, theoretical_tp);
  
  // Round to nearest 5%
  return Math.round(optimal_tp / 5) * 5;
}

/**
 * Calculate missed profit percentage
 * How much better the trade could have been
 */
export function calculateMissedProfit(actual_pct: number, optimal_tp: number): number {
  if (optimal_tp <= actual_pct) return 0;
  return optimal_tp - actual_pct;
}

/**
 * Calculate efficiency score (0-100)
 * How well did we exit relative to the maximum available profit
 */
export function calculateEfficiency(actual_pct: number, max_profit_pct: number): number {
  if (max_profit_pct <= 0) return 100; // Loss trades are 100% efficient (can't improve)
  if (actual_pct <= 0) return 0; // Loss when profit was available is 0% efficient
  
  return Math.round((actual_pct / max_profit_pct) * 100);
}

/**
 * Enrich trades with MAE/MFE analysis
 */
export function enrichTrades(trades: Trade[]): EnrichedTrade[] {
  return trades.map(trade => {
    const { mfe_pct, mae_pct, max_profit_pct, max_loss_pct } = calculateExcursions(trade);
    const actual_pct = ((trade.exit_price - trade.entry_price) / trade.entry_price) * 100;
    const optimal_tp = calculateOptimalTP(mfe_pct, actual_pct);
    const missed_profit_pct = calculateMissedProfit(actual_pct, optimal_tp);
    const efficiency = calculateEfficiency(actual_pct, max_profit_pct);

    return {
      trade_id: trade.trade_id,
      strategy: trade.strategy,
      entry_price: trade.entry_price,
      exit_price: trade.exit_price,
      actual_pct: Math.round(actual_pct * 100) / 100,
      max_profit_pct: Math.round(max_profit_pct * 100) / 100,
      max_loss_pct: Math.round(max_loss_pct * 100) / 100,
      mfe_pct: Math.round(mfe_pct * 100) / 100,
      mae_pct: Math.round(mae_pct * 100) / 100,
      exit_reason: trade.exit_reason,
      optimal_tp: optimal_tp,
      missed_profit_pct: Math.round(missed_profit_pct * 100) / 100,
      efficiency: efficiency
    };
  });
}

/**
 * Calculate strategy-level metrics
 */
export function calculateStrategyMetrics(enrichedTrades: EnrichedTrade[]): Map<string, StrategyMetrics> {
  const byStrategy = new Map<string, EnrichedTrade[]>();

  enrichedTrades.forEach(trade => {
    const list = byStrategy.get(trade.strategy) || [];
    list.push(trade);
    byStrategy.set(trade.strategy, list);
  });

  const metrics = new Map<string, StrategyMetrics>();

  byStrategy.forEach((trades, strategy) => {
    const avg_mfe = trades.reduce((sum, t) => sum + t.mfe_pct, 0) / trades.length;
    const avg_mae = trades.reduce((sum, t) => sum + t.mae_pct, 0) / trades.length;
    const avg_missed_profit = trades.reduce((sum, t) => sum + t.missed_profit_pct, 0) / trades.length;
    const win_rate = (trades.filter(t => t.actual_pct > 0).length / trades.length) * 100;
    const efficiency_score = trades.reduce((sum, t) => sum + t.efficiency, 0) / trades.length;

    // Recommended TP is the median optimal TP for the strategy
    const optimal_tps = trades.map(t => t.optimal_tp).sort((a, b) => a - b);
    const recommended_tp = optimal_tps[Math.floor(optimal_tps.length / 2)];

    metrics.set(strategy, {
      strategy,
      trade_count: trades.length,
      avg_mfe: Math.round(avg_mfe * 100) / 100,
      avg_mae: Math.round(avg_mae * 100) / 100,
      avg_missed_profit: Math.round(avg_missed_profit * 100) / 100,
      recommended_tp,
      win_rate: Math.round(win_rate * 100) / 100,
      efficiency_score: Math.round(efficiency_score)
    });
  });

  return metrics;
}

/**
 * Break down metrics by exit reason
 */
export function breakdownByExitReason(enrichedTrades: EnrichedTrade[]): ExitReasonBreakdown[] {
  const byReason = new Map<string, EnrichedTrade[]>();

  enrichedTrades.forEach(trade => {
    const list = byReason.get(trade.exit_reason) || [];
    list.push(trade);
    byReason.set(trade.exit_reason, list);
  });

  const breakdowns: ExitReasonBreakdown[] = [];

  byReason.forEach((trades, reason) => {
    const avg_missed_profit = trades.reduce((sum, t) => sum + t.missed_profit_pct, 0) / trades.length;
    const optimal_tps = trades.map(t => t.optimal_tp).sort((a, b) => a - b);
    const recommended_tp = optimal_tps[Math.floor(optimal_tps.length / 2)];

    breakdowns.push({
      reason,
      count: trades.length,
      avg_missed_profit: Math.round(avg_missed_profit * 100) / 100,
      recommended_tp
    });
  });

  return breakdowns.sort((a, b) => b.count - a.count);
}

/**
 * Parse CSV with flexible column matching
 */
export function parseTradesFromCSV(csvContent: string): Trade[] {
  const lines = csvContent.trim().split('\n');
  if (lines.length < 2) throw new Error('Invalid CSV format');

  // Parse header - handle quoted fields
  const headerLine = lines[0];
  const headers = headerLine
    .split(',')
    .map(h => h.trim().replace(/^"|"$/g, '').toLowerCase()); // Remove quotes
  
  // Find column indices with flexible matching
  let strategyIdx = -1, entryDateIdx = -1, exitDateIdx = -1;
  let entryPriceIdx = -1, exitPriceIdx = -1, maxPriceIdx = -1, minPriceIdx = -1;
  let contractsIdx = -1, exitReasonIdx = -1;
  let maxProfitIdx = -1, maxLossIdx = -1;

  headers.forEach((h, i) => {
    if (h.includes('strategy')) strategyIdx = i;
    if (h.includes('date') && h.includes('open')) entryDateIdx = i;
    if (h.includes('date') && h.includes('clos')) exitDateIdx = i;
    if ((h.includes('opening') || h.includes('entry')) && h.includes('price')) entryPriceIdx = i;
    // For exit price, prefer "Closing Price" column (not "Avg. Closing Cost" which is for multi-leg costs)
    if (h.includes('closing') && h.includes('price') && !h.includes('avg')) exitPriceIdx = i;
    if (h.includes('high') || (h.includes('max') && h.includes('price'))) maxPriceIdx = i;
    if (h.includes('low') || (h.includes('min') && h.includes('price'))) minPriceIdx = i;
    if (h.includes('contract') || h.includes('qty') || h.includes('quantity')) contractsIdx = i;
    if (h.includes('reason') && h.includes('close')) exitReasonIdx = i;
    if (h.includes('max') && h.includes('profit')) maxProfitIdx = i;
    if (h.includes('max') && h.includes('loss')) maxLossIdx = i;
  });

  const trades: Trade[] = [];
  let tradeCounter = 0;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Parse CSV line handling quoted fields
    const values: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim().replace(/^"|"$/g, ''));
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim().replace(/^"|"$/g, ''));

    const strategy = values[strategyIdx] || 'Unknown';
    const entryDate = values[entryDateIdx] || new Date().toISOString();
    const exitDate = values[exitDateIdx] || new Date().toISOString();
    const entryPrice = parseFloat(values[entryPriceIdx] || '0');
    const exitPrice = parseFloat(values[exitPriceIdx] || '0');
    
    // Handle max/min prices - use actual max/min or derive from profit/loss percentages
    let maxPrice = exitPrice;
    let minPrice = exitPrice;
    
    if (maxPriceIdx >= 0 && values[maxPriceIdx]) {
      // If we have an actual high price column, use it
      maxPrice = parseFloat(values[maxPriceIdx]);
    } else if (maxProfitIdx >= 0 && values[maxProfitIdx]) {
      // Otherwise, use Max Profit % to calculate: maxPrice = entryPrice * (1 + maxProfit%)
      const maxProfitPct = parseFloat(values[maxProfitIdx]);
      maxPrice = entryPrice * (1 + maxProfitPct / 100);
    }
    
    if (minPriceIdx >= 0 && values[minPriceIdx]) {
      // If we have an actual low price column, use it
      minPrice = parseFloat(values[minPriceIdx]);
    } else if (maxLossIdx >= 0 && values[maxLossIdx]) {
      // Otherwise, use Max Loss % to calculate: minPrice = entryPrice * (1 - |maxLoss%|)
      const maxLossPct = Math.abs(parseFloat(values[maxLossIdx]));
      minPrice = Math.max(0, entryPrice * (1 - maxLossPct / 100));
    }
    
    const contracts = parseInt(values[contractsIdx] || '1');
    const exitReason = values[exitReasonIdx] || 'Manual';

    // Validate we have required prices
    if (entryPrice > 0 && exitPrice > 0) {
      trades.push({
        trade_id: `${strategy}-${tradeCounter++}`,
        strategy,
        entry_date: entryDate,
        exit_date: exitDate,
        entry_price: entryPrice,
        exit_price: exitPrice,
        max_price: maxPrice > 0 ? maxPrice : exitPrice,
        min_price: minPrice > 0 ? minPrice : exitPrice,
        contracts,
        exit_reason: exitReason
      });
    }
  }

  return trades;
}
