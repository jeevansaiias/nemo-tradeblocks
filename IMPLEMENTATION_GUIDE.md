# TP Optimizer MAE/MFE Unified Analytics - Implementation Guide

## Overview

Created a **single source of truth** for all MAE/MFE calculations that ensures identical metrics whether data comes from **manual upload** or **active block** routes.

## Architecture

### Core Module: `lib/analytics/maeMfe.ts`

**Purpose**: Unified analytics pipeline that handles mixed input scales and produces consistent results across both data entry points.

**Key Capabilities**:

1. **`normalizePercent(value: number): number`**
   - Intelligently handles both decimal (0-1) and percentage (0-100+) scales
   - Rule: if `|value| >= 2.0`, treat as percent and divide by 100
   - Returns decimal (0-1 range for normal cases)
   - Examples:
     - `0.5867` → `0.5867` (already decimal)
     - `58.67` → `0.5867` (was percent, divided by 100)
     - `134.58` → `1.3458` (was percent, divided by 100)

2. **`isWin(trade: Trade): boolean`**
   - Unified win predicate using net P/L after fees
   - Precedence:
     1. If `plNet` defined, use `plNet > 0`
     2. Otherwise, use normalized `actual_pct > 0`
   - Ensures both routes compute winRate identically

3. **`computeMaeMfe(trade: Trade)`**
   - Normalizes all four key metrics for a trade:
     - `maeDec`, `mfeDec`, `actualExitDec`, `missedProfitDec`
   - Handles mixed scales automatically

4. **`computeEfficiency(actualDec: number, mfeDec: number): number`**
   - Safe division: returns `1.0` if profit but `mfeDec = 0`
   - Returns `0` if no profit and no MFE
   - Handles negative values correctly

5. **`computeTradeMetrics(trade: Trade): TradeMetrics`**
   - Single-trade calculation combining all above
   - Returns normalized metrics plus `isWin` flag

6. **`aggregateByExitReason(trades: Trade[]): ExitReasonStats[]`**
   - Groups trades by exit reason
   - Computes per-group statistics:
     - `winRateDec`, `avgMfeDec`, `avgMaeDec`, `avgMissedDec`, `avgEfficiencyDec`
   - Returns sorted by trade count descending

7. **`aggregateTopline(trades: Trade[]): ToplineMetrics`**
   - Computes overall metrics:
     - `totalTrades`, `strategies` (Set), `winRateDec`
     - `avgMfeDec`, `avgMaeDec`, `avgMissedDec`, `avgEfficiencyDec`

8. **`sanityCheckTopline(metrics1, metrics2, tolerance): { allPass, checks }`**
   - Verifies two metric sets are nearly identical
   - Used for asserting manual vs active-block consistency
   - Default tolerance: `1e-6` (decimal scale)
   - Reports which metrics drifted if not identical

9. **`formatDecimalPercent(decimal: number, decimals?: number): string`**
   - Converts decimal (0-1) to display string
   - Example: `0.5867` → `"58.67%"`

## Testing

### `tests/unit/maeMfe.spec.ts` - 25 Tests

**Test Coverage**:
- ✅ normalizePercent: decimal/percent scales, edge cases, null/undefined
- ✅ isWin: plNet precedence, actual_pct fallback, zero/undefined
- ✅ computeEfficiency: normal ratio, zero MFE safety, negative values
- ✅ computeMaeMfe: mixed scale handling
- ✅ computeTradeMetrics: single-trade aggregation
- ✅ aggregateByExitReason: grouping, sorting, aggregation math
- ✅ aggregateTopline: topline metrics, empty lists
- ✅ sanityCheckTopline: identical detection, drift detection
- ✅ formatDecimalPercent: formatting, custom decimals, NaN/Infinity
- ✅ **Cross-route consistency**: Same trades in decimal vs percent scale produce identical results

**Key Test**: `should produce identical results for same trades regardless of input scale`
- Tests that both manual and active-block routes (using different scales) produce identical final metrics
- Verifies sanity check passes with tolerance

## Integration Steps (TODO)

### Step 1: Update `components/auto-tp-optimizer-mae-mfe.tsx`

Replace inline calculations with maeMfe module:

```typescript
import {
  aggregateTopline,
  aggregateByExitReason,
  computeTradeMetrics,
  formatDecimalPercent,
  sanityCheckTopline,
} from '@/lib/analytics/maeMfe';

// In enrichTrades() or similar:
const trades: Trade[] = [...];
const topline = aggregateTopline(trades);
const byExitReason = aggregateByExitReason(trades);

// Add sanity check (log warnings if metrics drift):
if (process.env.NODE_ENV === 'development') {
  const check = sanityCheckTopline(expectedMetrics, topline);
  if (!check.allPass) {
    console.warn('MAE/MFE metric drift detected:', check.checks);
  }
}

// Format for display:
const winRatePercent = formatDecimalPercent(topline.winRateDec); // "58.67%"
```

### Step 2: Unify Manual & Active-Block Routes

Both routes must:
1. Load trades into common `Trade[]` structure
2. Call `aggregateTopline(trades)` and `aggregateByExitReason(trades)`
3. Use `isWin(trade)` helper for win logic
4. Apply `sanityCheckTopline()` to verify consistency

### Step 3: Update UI Formatting

Replace all `.toFixed()` calls with:

```typescript
import { formatDecimalPercent } from '@/lib/analytics/maeMfe';

// Before:
<span>{(metric * 100).toFixed(2)}%</span>

// After:
<span>{formatDecimalPercent(metric)}</span>
```

### Step 4: Add Visual Polish

1. **Fixed-width numbers**: CSS class for percentage displays
   ```css
   .metric-number {
     font-family: 'Courier New', monospace;
     width: 5rem;
     text-align: right;
   }
   ```

2. **Heatmap legend**: Clamp to 0-100% range
   - Modify chart min/max to `[0, 1]` (decimal scale)
   - Ensure tick labels show 0%, 25%, 50%, 75%, 100%

3. **Consistency**: All KPIs, tooltips, tables use `formatDecimalPercent()`

## Files Created

- ✅ `lib/analytics/maeMfe.ts` (330 lines)
- ✅ `tests/unit/maeMfe.spec.ts` (390 lines)

## Files To Modify

- `components/auto-tp-optimizer-mae-mfe.tsx` - Replace inline calculations
- `components/auto-tp-optimizer/efficiency-matrix.tsx` - Use formatDecimalPercent
- `components/auto-tp-optimizer/mfe-distribution.tsx` - Use formatDecimalPercent
- `components/auto-tp-optimizer/missed-profit-chart.tsx` - Use formatDecimalPercent
- `components/auto-tp-optimizer/exit-reason-breakdown.tsx` - Use formatDecimalPercent
- Other charts that display MAE/MFE metrics

## Validation Checklist

After integration, verify:

- [ ] Both manual upload and active-block routes load and process the same test dataset
- [ ] `sanityCheckTopline()` returns `allPass: true` for both routes
- [ ] All numeric displays match to 2 decimal places
- [ ] Win rate, MFE, MAE, Efficiency, Missed Profit identical on both routes
- [ ] Charts render without errors
- [ ] Heatmap legends clamp to 0-100%
- [ ] Build succeeds: `npm run build` → 17/17 pages prerendered
- [ ] Tests pass: `npm test -- tests/unit/maeMfe.spec.ts` → 25 passing

## Benefits

✅ **Single Source of Truth**: All calculations in one place  
✅ **Mixed Scale Support**: Automatically handles decimal and percent inputs  
✅ **Cross-Route Parity**: Manual and active-block produce identical metrics  
✅ **Safe Edge Cases**: Handles zero MFE, missing data, NaN/Infinity  
✅ **Built-in Validation**: sanityCheckTopline() ensures consistency  
✅ **Comprehensive Testing**: 25 unit tests covering all scenarios  

## Example Usage

```typescript
import { aggregateTopline, aggregateByExitReason, formatDecimalPercent } from '@/lib/analytics/maeMfe';

// Load trades from either manual upload or active block
const trades = await loadTrades();

// Compute topline metrics
const topline = aggregateTopline(trades);
console.log(`Win Rate: ${formatDecimalPercent(topline.winRateDec)}`);
console.log(`Avg MFE: ${formatDecimalPercent(topline.avgMfeDec)}`);

// Compute by exit reason
const byReason = aggregateByExitReason(trades);
byReason.forEach(reason => {
  console.log(`${reason.exitReason}: ${reason.tradeCount} trades, ${formatDecimalPercent(reason.winRateDec)}`);
});
```
