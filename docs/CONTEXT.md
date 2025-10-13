# Context for Next Session

## What We Just Completed

### 1. Fixed UI Bug in Comparison Blocks Page
**File:** [app/(platform)/comparison-blocks/page.tsx](../app/(platform)/comparison-blocks/page.tsx)

**Issues Fixed:**
- ✅ Aligned "Add Strategy Mapping" button inline with CardDescription (moved to flex layout in CardHeader)
- ✅ Fixed bug where Reconciliation Summary showed stale data when switching blocks via left nav
  - Added `comparisonLastBlockId` from comparison store
  - Updated `summaryRows` useMemo to check if comparison data matches current `activeBlockId`
  - Clear alignments immediately when block changes to prevent race conditions

**Key Changes:**
- Lines 560-577: Restructured CardHeader with flex layout for button alignment
- Lines 78, 291: Added `comparisonLastBlockId` check to prevent stale data display
- Lines 145, 149: Clear alignments synchronously when block changes

### 2. Created Comprehensive Enhancement Plan
**File:** [docs/comparison-blocks.md](../docs/comparison-blocks.md)

**What It Contains:**
A detailed, checklist-based roadmap for enhancing the Comparison Blocks feature with:
- **Phase 1:** Statistical Analysis (paired t-tests, correlation, slippage analysis)
- **Phase 2:** 7 Visualization Components (charts for slippage, equity curves, heat maps, waterfall, etc.)
- **Phase 3:** Enhanced Data Tables
- **Phase 4:** Advanced Analytics (slippage attribution, rolling windows, exception detection)
- **Phase 5-8:** UX, performance, testing, documentation

**Key Insights:**
- All necessary data is already captured in the reconciliation system
- Need to implement statistical calculations (t-test, correlation, distribution analysis)
- Focus on making slippage analysis actionable and visual
- T-test was requested by users - it's a paired t-test to determine if backtested vs reported performance differences are statistically significant

## Current State of Codebase

### Reconciliation System Architecture

**Key Files:**
1. **[lib/services/trade-reconciliation.ts](../lib/services/trade-reconciliation.ts)**
   - Core reconciliation engine
   - Matches backtested vs reported trades
   - Already calculates: match rate, slippage per contract, size variance
   - Has session-based matching with 30-minute tolerance window

2. **[lib/stores/comparison-store.ts](../lib/stores/comparison-store.ts)**
   - Zustand store managing comparison state
   - Tracks `lastBlockId` to identify which block data belongs to
   - Methods: `refresh()`, `reset()`

3. **[app/(platform)/comparison-blocks/page.tsx](../app/(platform)/comparison-blocks/page.tsx)**
   - Main UI page for strategy alignment
   - Shows alignment mappings, reconciliation summary table
   - Has Match Review Dialog for manual trade pairing

4. **[components/match-review-dialog.tsx](../components/match-review-dialog.tsx)**
   - Interactive dialog for reviewing and manually pairing trades
   - Session-based view with auto-pairing logic

### Data Structures Already in Place

**NormalizedTrade:**
```typescript
{
  id, strategy, dateOpened, timeOpened, sortTime, session,
  dateClosed, premiumPerContract, totalPremium, contracts,
  pl, openingFees, closingFees, legs
}
```

**AlignmentMetrics:**
```typescript
{
  backtested: TradeTotals,
  reported: TradeTotals,
  delta: TradeDeltaTotals,
  matchRate, slippagePerContract, sizeVariance
}
```

**AlignedTradeSet:**
Contains matched pairs, unmatched trades, metrics, sessions, selected trade IDs

### Test Data Available
- **[tests/data/MEIC Test Data/](../tests/data/MEIC%20Test%20Data/)**
  - `meic-strategy-trade-log.csv` - Backtested strategy log
  - `meic-tradelog.csv` - Reported/live tradelog
- **[tests/data/EMA Test Data/](../tests/data/EMA%20Test%20Data/)** - Alternative test data

## What to Work on Next

### Immediate Next Steps (Recommended Order)

1. **Start with Phase 1.1 - Paired T-Test Implementation**
   - Create `/lib/calculations/reconciliation-stats.ts`
   - Implement `calculatePairedTTest()` function
   - This is user-requested and provides immediate value
   - Reference: [docs/comparison-blocks.md](../docs/comparison-blocks.md) lines 28-85

2. **Then Phase 2.1 - Reconciliation Metrics Dashboard**
   - Create summary cards showing key metrics
   - Visual, high-impact component
   - Shows off the t-test results you just calculated
   - Reference: [docs/comparison-blocks.md](../docs/comparison-blocks.md) lines 133-169

3. **Follow with Phase 2.2 - Slippage Distribution Chart**
   - User specifically interested in slippage analysis
   - Histogram with percentiles
   - Reference: [docs/comparison-blocks.md](../docs/comparison-blocks.md) lines 171-200

### Important Notes

**User's Testing Workflow:**
- User doesn't want you to run the application to validate UI changes
- User will test and provide feedback
- You can run tests to validate logic

**T-Test Context:**
- Paired t-test compares matched trade pairs (reported P/L - backtested P/L)
- Null hypothesis: No significant difference in performance
- p < 0.05 means statistically significant difference
- Users asked about this specifically, so it's important

**Slippage Definition:**
- Difference between backtested premium and reported premium
- Can be positive (better than expected) or negative (worse)
- Already calculated as `slippagePerContract` but needs deeper analysis

## Key Commands

```bash
# Run tests
npm test

# Run specific test file
npm test -- path/to/test-file.test.ts

# Run dev server (user will do this)
npm run dev

# Lint
npm run lint

# Build
npm run build
```

## Architecture Patterns to Follow

1. **Calculation Logic:** Pure functions in `/lib/calculations/`
2. **Charts:** Recharts-based components in `/components/` (create `/components/reconciliation-charts/`)
3. **State Management:** Zustand stores in `/lib/stores/`
4. **Data Access:** IndexedDB via `/lib/db/` functions
5. **Type Definitions:** Interfaces in `/lib/models/`

## Recent Insights

- The comparison data can be "stale" when switching blocks - need to check `comparisonLastBlockId`
- Alignments need to be cleared immediately when block changes to prevent race conditions
- The `activeBlock` object reference might not change, so use `activeBlockId` as dependency
- Two useEffects manage data: one loads alignments, another refreshes comparison

## User Preferences

- Concise responses
- No emojis unless requested
- Show file paths with line numbers for references (e.g., `file.ts:42`)
- Don't run the app - user tests UI
- Follow existing patterns in codebase

---

**Last Updated:** 2025-10-12
**Current Branch:** features/automationReportingUpload (clean, no uncommitted changes)
**Next File to Create:** `/lib/calculations/reconciliation-stats.ts`
