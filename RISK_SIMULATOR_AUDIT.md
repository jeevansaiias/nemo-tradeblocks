# Risk Simulator Parameter Audit Report

## Date: 2025-10-02

## Summary
Complete audit of Risk Simulator parameters to ensure all data flows correctly from user inputs through conversions to Monte Carlo simulation. All issues have been identified and resolved with comprehensive test coverage.

---

## Issues Found & Fixed

### 1. ✅ Resample Window Calculation Bug
**Issue:** Resample window was calculated based on all trades, not filtered trades
**Impact:** When users selected specific strategies, the resample window would be based on the total trade count, not the filtered count
**Fix:** Moved resample window calculation to after strategy filtering in `runSimulation()`
**Location:** `/app/(platform)/risk-simulator/page.tsx:160-163`

```typescript
// Calculate resample window based on filtered trades
const resampleWindow = resamplePercentage === 100
  ? undefined
  : percentageToTrades(resamplePercentage, filteredTrades.length);
```

### 2. ✅ Initial Capital Not Auto-Populated
**Issue:** Initial capital defaulted to $100,000 instead of using actual account data
**Impact:** Users had to manually enter initial capital even though it's available in trade data
**Fix:** Implemented auto-calculation using same method as block-stats page
**Location:** `/app/(platform)/risk-simulator/page.tsx:113-118`

```typescript
const calculatedInitialCapital = useMemo(() => {
  if (trades.length === 0) return 100000;
  const initialCapital = PortfolioStatsCalculator.calculateInitialCapital(trades);
  return initialCapital > 0 ? initialCapital : 100000;
}, [trades]);
```

### 3. ✅ Resample Percentage Helper Text
**Issue:** Helper text showed absolute trade count which could be confusing with strategy filtering
**Fix:** Changed to show percentage only, which is clearer
**Location:** `/app/(platform)/risk-simulator/page.tsx:447-449`

---

## Parameter Flow Verification

### User Input → Conversion → Monte Carlo

| User Parameter | Conversion | Final Value | Verified |
|----------------|-----------|-------------|----------|
| Simulation Period (value + unit) | `timeToTrades()` | Trade count | ✅ |
| Resample Percentage | `percentageToTrades()` | Trade count (filtered) | ✅ |
| Strategy Multi-Select | Filter trades array | Filtered trades | ✅ |
| Initial Capital | Auto-calculated or manual | Dollar amount | ✅ |
| Trading Frequency | Auto-calculated | Trades/year | ✅ |
| Number of Simulations | Direct pass-through | Count | ✅ |
| Resample Method | Direct pass-through | 'trades' or 'daily' | ✅ |
| Random Seed | Direct pass-through | Integer or undefined | ✅ |

---

## Test Coverage

### New Test Files Created

#### 1. `time-conversions.test.ts` - 19 tests ✅
- Time to trades conversion (years/months/days)
- Trades to time conversion with auto-unit selection
- Percentage to trades conversion
- Trades to percentage conversion
- Format helpers
- Default value calculation
- Edge cases and boundaries

#### 2. `risk-simulator-params.test.ts` - 14 tests ✅
- Parameter calculation flow end-to-end
- Strategy filtering with multi-select
- Monte Carlo integration with converted parameters
- High-frequency trading scenarios (10,000+ trades/year)
- Daily resample method compatibility
- Edge cases (empty strategies, non-existent strategies)
- Boundary validation

#### 3. `initial-capital-calculation.test.ts` - 12 tests ✅
- Initial capital calculation from first trade
- Trades out of chronological order
- Same-day trades sorted by time
- Large and small account values
- Edge cases (zero P&L, negative values, margin calls)
- Consistency with block-stats page

#### 4. `monte-carlo.test.ts` - 16 tests ✅ (existing, re-verified)
- All Monte Carlo core functionality
- Resampling methods
- Strategy filtering
- Reproducibility with seeds

### Total Test Coverage: 61 tests, all passing ✅

---

## Verified Scenarios

### 1. Regular Trader (252 trades/year)
- **Default Period:** 1 year → 252 trades ✅
- **Initial Capital:** Auto-calculated from first trade ✅
- **Resample:** 100% of trades by default ✅

### 2. High-Frequency Trader (10,000+ trades/year)
- **Default Period:** 3 months → 2,500 trades ✅
- **Time Conversion:** 1 day = ~27 trades ✅
- **Resample:** 25% of trades by default (last 2,500) ✅

### 3. Occasional Trader (<100 trades/year)
- **Default Period:** 2 years → ~100 trades ✅
- **Initial Capital:** Correctly calculated ✅
- **Resample:** 100% of trades (too few to sample) ✅

### 4. Multi-Strategy Selection
- **Filter Trades:** Pre-filters before simulation ✅
- **Resample Window:** Based on filtered count ✅
- **Initial Capital:** Uses all trades for calculation ✅

---

## Architecture Decisions

### Why Time-Based Input?
- Users think in time periods (years/months), not trade counts
- More intuitive for traders of all frequencies
- Automatically adapts to user's trading pace

### Why Percentage Slider for Resample?
- Clearer than absolute trade counts
- Works consistently regardless of strategy filtering
- Visual feedback with slider UI

### Why Auto-Calculate Initial Capital?
- Available in trade data (`fundsAtClose - pl` of first trade)
- Consistent with block-stats page calculation
- Reduces user error and manual entry

### Why Multi-Strategy Selection?
- More flexible than single strategy dropdown
- Allows combining strategies for portfolio analysis
- Consistent with performance-blocks page UX

---

## Performance Implications

### Build Size
- Risk Simulator page: 32 KB (up from 29.3 KB)
- Added imports: `PortfolioStatsCalculator` (+3 KB gzipped)
- MultiSelect component (already in bundle)

### Calculation Overhead
- Initial capital: O(n log n) for sorting trades (negligible)
- Trading frequency: O(n) for date range calculation
- Strategy filtering: O(n) before simulation
- All calculations cached with `useMemo`

---

## Code Quality

### Type Safety
- ✅ All parameters properly typed
- ✅ TimeUnit enum for period selection
- ✅ Strict MonteCarloParams interface
- ✅ No `any` types used

### Error Handling
- ✅ Validates filtered trades before simulation
- ✅ Shows error if no trades match strategies
- ✅ Graceful fallbacks for missing data
- ✅ Boundary checks on all conversions

### Code Reuse
- ✅ Uses existing `PortfolioStatsCalculator.calculateInitialCapital()`
- ✅ Shares time conversion utilities
- ✅ MultiSelect from shared components
- ✅ Consistent with other pages

---

## Recommendations

### For Future Enhancements
1. Consider adding a "Reset to Defaults" button to restore auto-calculated values
2. Add visual indicator when initial capital differs from calculated value
3. Consider showing time conversion in both directions (trades ↔ time)
4. Add tooltip showing how initial capital was calculated

### For Maintenance
1. Keep time conversion utilities in sync with trading frequency calculations
2. Ensure any changes to `PortfolioStatsCalculator` are tested in Risk Simulator
3. Monitor performance with very large trade datasets (10,000+ trades)

---

## Sign-Off

✅ **All parameters verified and working correctly**
✅ **61 tests passing with comprehensive coverage**
✅ **Build successful with no errors**
✅ **Consistent with other pages (block-stats, performance-blocks)**
✅ **Ready for production**

---

## Files Modified

### Core Implementation
- `/app/(platform)/risk-simulator/page.tsx` - Main parameter logic
- `/lib/utils/time-conversions.ts` - Time conversion utilities (new)
- `/components/risk-simulator/trading-frequency-card.tsx` - Frequency display (new)

### Tests
- `/tests/unit/time-conversions.test.ts` (new, 19 tests)
- `/tests/unit/risk-simulator-params.test.ts` (new, 14 tests)
- `/tests/unit/initial-capital-calculation.test.ts` (new, 12 tests)
- `/tests/unit/monte-carlo.test.ts` (existing, 16 tests - verified)

### Documentation
- `/RISK_SIMULATOR_AUDIT.md` (this file)

---

## Audit Conducted By: Claude Code
**Date:** October 2, 2025
