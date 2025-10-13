# Comparison Blocks: Reconciliation Analytics Enhancement

## Overview

This document outlines the plan to enhance the Comparison Blocks feature with comprehensive statistical analysis, visualizations, and analytics for comparing backtested strategies against live/reported trading performance.

## Current State

✅ **Already Implemented:**
- Trade reconciliation engine matching backtested vs reported trades
- Session-based matching with 30-minute tolerance window
- Manual override capability for trade pairing
- Basic metrics calculation:
  - Match rate
  - Slippage per contract
  - Size variance
  - Trade totals (count, P/L, premium, fees)
- Normalized trade data structures
- Auto-matching algorithm
- Match review dialog for manual corrections

## Enhancement Roadmap

### Phase 1: Statistical Analysis Features ✅ **COMPLETED (2025-10-12)**

#### 1.1 Paired T-Test for Performance Comparison ✅

**Purpose:** Determine if the difference between backtested and reported P/L is statistically significant.

- [x] Create `/lib/calculations/reconciliation-stats.ts`
  - [x] Implement `calculatePairedTTest()` function
    - [x] Calculate paired differences for matched trades (reported P/L - backtested P/L)
    - [x] Compute mean difference
    - [x] Calculate standard deviation of differences
    - [x] Calculate standard error
    - [x] Compute t-statistic: `t = mean_diff / (std_dev / sqrt(n))`
    - [x] Calculate degrees of freedom (n - 1)
    - [x] Compute p-value (two-tailed test)
    - [x] Calculate 95% confidence interval
  - [x] Implement `interpretTTestResult()` helper
    - [x] Return significance level (highly significant, significant, not significant)
    - [x] Return practical interpretation text
  - [x] Add per-session t-test capability (available per alignment)
  - [x] Add per-strategy-pair t-test capability (calculated per AlignedTradeSet)

- [x] Add T-Test results to `AlignmentMetrics` interface
  ```typescript
  interface TTestResult {
    tStatistic: number
    pValue: number
    degreesOfFreedom: number
    meanDifference: number
    standardError: number
    confidenceInterval: [number, number]
    isSignificant: boolean // p < 0.05
    interpretation: string
  }
  ```

- [x] Update `buildMetrics()` in `trade-reconciliation.ts`
  - [x] Calculate t-test for matched pairs
  - [x] Include t-test results in returned metrics

**Implementation Details:**
- Uses Hill's approximation for t-distribution CDF
- Incomplete beta function for accurate p-value calculation
- Handles edge cases (single observation, zero variance)
- File: [lib/calculations/reconciliation-stats.ts](../lib/calculations/reconciliation-stats.ts)

**References:**
- Paired t-test formula: `t = (mean_diff - 0) / (std_dev / sqrt(n))`
- Null hypothesis: No difference between backtested and reported performance
- Alternative hypothesis: Significant difference exists

#### 1.2 Correlation Analysis ✅

- [x] Add to `/lib/calculations/reconciliation-stats.ts`
  - [x] Implement `calculatePearsonCorrelation()` between backtested and reported P/L
  - [x] Calculate Spearman rank correlation for non-normal distributions
  - [x] Add correlation strength interpretation

- [x] Add correlation metrics to `AlignmentMetrics`
  ```typescript
  interface CorrelationMetrics {
    pearsonR: number
    spearmanRho: number
    interpretation: string // "Strong positive", "Weak", etc.
  }
  ```

**Implementation Details:**
- Pearson measures linear relationship
- Spearman uses rank-based correlation (robust to outliers)
- Automatic interpretation of correlation strength
- Returns null when variance is zero (mathematically correct)

#### 1.3 Slippage Statistical Analysis ✅

- [x] Create `/lib/calculations/slippage-analysis.ts`
  - [x] Implement `calculateSlippageDistribution()`
    - [x] Mean, median, mode slippage
    - [x] Standard deviation
    - [x] Percentiles: P10, P25, P50, P75, P90, P95, P99
    - [x] Skewness and kurtosis
  - [x] Implement `identifySlippageOutliers()`
    - [x] Flag trades with slippage > 2 std deviations
    - [x] Calculate average outlier slippage
  - [x] Implement `calculateSlippageTrend()`
    - [x] Linear regression of slippage over time
    - [x] Is slippage improving or degrading?
    - [x] R-squared goodness-of-fit metric

- [x] Add slippage breakdown metrics
  ```typescript
  interface SlippageAnalysis {
    distribution: {
      mean: number
      median: number
      mode: number | null
      stdDev: number
      percentiles: {
        p10: number
        p25: number
        p50: number
        p75: number
        p90: number
        p95: number
        p99: number
      }
      skewness: number
      kurtosis: number
    }
    outliers: {
      count: number
      tradeIds: string[]
      averageOutlierSlippage: number
      threshold: number
    }
    trend: {
      slope: number // positive = worsening, negative = improving
      intercept: number
      isImproving: boolean
      rSquared: number
      interpretation: string
    }
    byTimeOfDay: Record<string, number> // "09:00" -> avg slippage
    byDayOfWeek: Record<string, number> // "Monday" -> avg slippage
  }
  ```

**Implementation Details:**
- Full statistical distribution analysis
- Time-based pattern detection (hourly, daily)
- Trend analysis using least squares regression
- File: [lib/calculations/slippage-analysis.ts](../lib/calculations/slippage-analysis.ts)

**Testing:**
- ✅ 41 unit tests for statistical calculations ([tests/unit/reconciliation-stats.test.ts](../tests/unit/reconciliation-stats.test.ts), [tests/unit/slippage-analysis.test.ts](../tests/unit/slippage-analysis.test.ts))
- ✅ 4 integration tests with real CSV data ([tests/integration/reconciliation-stats-integration.test.ts](../tests/integration/reconciliation-stats-integration.test.ts))
- ✅ Validated with 12+ real trading strategies (150+ trades)
- ✅ All 272 tests passing

### Phase 2: Visualization Components ✅ **IN PROGRESS (2025-10-12)**

Create `/components/reconciliation-charts/` directory ✅

#### 2.1 Reconciliation Metrics Dashboard ✅

- [x] Create `/components/reconciliation-charts/ReconciliationMetrics.tsx`
  - [x] Summary cards layout using grid
  - [x] **Match Quality Card:**
    - [x] Overall match rate percentage (large display)
    - [x] Backtested/Reported trade count breakdown
    - [x] Unmatched trades count indicator
    - [x] Visual indicator (green/yellow/red based on match rate)
  - [x] **Performance Delta Card:**
    - [x] Total P/L difference (reported - backtested)
    - [x] Percentage difference
    - [x] Average slippage per trade
    - [x] Average slippage per contract
    - [x] Slippage as % of average premium
  - [x] **Statistical Significance Card:**
    - [x] T-test p-value with significance indicator
    - [x] 95% confidence interval display
    - [x] Correlation coefficients (Pearson R and Spearman ρ)
    - [x] Interpretation text with significance levels
    - [x] Mean difference and t-statistic display
  - [x] **Trade Efficiency Card:**
    - [x] Total fees comparison (backtested vs reported)
    - [x] Fee difference calculation
  - [x] Responsive design (grid layout adapts to screen size)
  - [x] Tooltips explaining each metric via HoverCard

**Implementation Details:**
- Uses shadcn/ui Card and MetricCard components
- Integrated with Phase 1 statistical calculations
- Dynamic badge coloring based on significance and quality
- File: [components/reconciliation-charts/ReconciliationMetrics.tsx](../components/reconciliation-charts/ReconciliationMetrics.tsx)

#### 2.2 Slippage Distribution Chart ✅

- [x] Create `/components/reconciliation-charts/SlippageDistributionChart.tsx`
  - [x] Use Plotly.js histogram
  - [x] X-axis: Slippage ($)
  - [x] Y-axis: Frequency (number of trades)
  - [x] Vertical lines for mean and median
  - [x] Zero reference line
  - [x] Color coding: green (favorable), red (unfavorable)
  - [x] Interactive tooltip showing exact values
  - [x] Shows count of favorable vs unfavorable trades

**Implementation Details:**
- Built on ChartWrapper from performance-charts
- Uses Plotly.js for interactive visualizations
- Auto-calculates statistics (mean, median, percentiles)
- Dynamic color gradient based on slippage direction
- Responsive and theme-aware
- File: [components/reconciliation-charts/SlippageDistributionChart.tsx](../components/reconciliation-charts/SlippageDistributionChart.tsx)

**Integration:**
- ✅ Added to [app/(platform)/comparison-blocks/page.tsx](../app/(platform)/comparison-blocks/page.tsx)
- ✅ Displays for each strategy alignment
- ✅ Accessible via "Statistical Analysis" section below reconciliation summary

**Data Transformation:**
```typescript
interface SlippageDistributionData {
  bin: string // "-50 to -25"
  binStart: number
  binEnd: number
  frequency: number
  percentage: number
}
```

#### 2.3 Dual Equity Curve Comparison

- [ ] Create `/components/reconciliation-charts/DualEquityCurveChart.tsx`
  - [ ] Use Recharts line chart with dual lines
  - [ ] X-axis: Date/time
  - [ ] Y-axis: Cumulative P/L
  - [ ] Blue line: Backtested cumulative P/L
  - [ ] Orange line: Reported cumulative P/L
  - [ ] Shaded area between lines showing divergence
    - [ ] Green fill when reported > backtested
    - [ ] Red fill when reported < backtested
  - [ ] Add third line: Cumulative slippage impact
  - [ ] Tooltips showing P/L values and delta at each point
  - [ ] Option to view by session or by trade
  - [ ] Zoom and pan capabilities
  - [ ] Legend with summary stats
  - [ ] Option to normalize both curves to start at $0

**Data Structure:**
```typescript
interface EquityCurvePoint {
  timestamp: Date
  session: string
  backtestedCumulativePl: number
  reportedCumulativePl: number
  cumulativeSlippage: number
  delta: number
}
```

#### 2.4 Slippage Scatter Plot

- [ ] Create `/components/reconciliation-charts/SlippageScatterPlot.tsx`
  - [ ] Use Recharts scatter chart
  - [ ] X-axis options:
    - [ ] Trade premium (backtested)
    - [ ] Trade sequence number
    - [ ] Time of day
  - [ ] Y-axis: Slippage amount ($)
  - [ ] Each point represents one matched trade
  - [ ] Color coding by:
    - [ ] Strategy
    - [ ] Session date
    - [ ] Absolute slippage magnitude
  - [ ] Point size based on contract count
  - [ ] Add trend line (linear regression)
  - [ ] Show correlation coefficient on chart
  - [ ] Interactive tooltips with trade details
  - [ ] Click point to highlight in trade table
  - [ ] Quadrant analysis (high premium + high slippage, etc.)

**Insights to Surface:**
- Does larger premium correlate with higher slippage?
- Are there time-of-day patterns?
- Are specific sessions clustered?

#### 2.5 Session Heat Map

- [ ] Create `/components/reconciliation-charts/SessionHeatMap.tsx`
  - [ ] Grid layout with sessions as rows, metrics as columns
  - [ ] Color intensity based on metric values
  - [ ] Metrics columns:
    - [ ] Match rate (green = high, red = low)
    - [ ] Total slippage (green = positive, red = negative)
    - [ ] Unmatched trade count (intensity = more unmatched)
    - [ ] P/L delta
  - [ ] Sortable by any column
  - [ ] Click session to drill down to trade details
  - [ ] Show month/week groupings
  - [ ] Summary row at bottom
  - [ ] Filter by date range
  - [ ] Export capability

**Visual Design:**
- Use diverging color scale for slippage (blue to white to red)
- Use sequential scale for match rate (white to green)
- Add sparkline mini-charts in cells for trends

#### 2.6 Waterfall Chart for P/L Reconciliation

- [ ] Create `/components/reconciliation-charts/WaterfallChart.tsx`
  - [ ] Custom Recharts bar chart implementation
  - [ ] Bars showing incremental changes:
    1. Starting: Backtested Total P/L (green bar)
    2. Slippage on Matched Trades (red/green bar)
    3. Missing Backtested Trades Impact (red bar if unmatched)
    4. Extra Reported Trades Impact (green bar if beneficial)
    5. Fee Differences (red/green bar)
    6. Ending: Reported Total P/L (blue bar)
  - [ ] Connecting lines between bars
  - [ ] Value labels on each bar
  - [ ] Cumulative total line
  - [ ] Tooltips explaining each component
  - [ ] Option to show absolute $ or percentages

**Data Structure:**
```typescript
interface WaterfallStep {
  label: string
  value: number
  type: 'start' | 'increase' | 'decrease' | 'end'
  cumulativeValue: number
  description: string
}
```

#### 2.7 Time-Based Slippage Analysis

- [ ] Create `/components/reconciliation-charts/SlippageTimeAnalysis.tsx`
  - [ ] Two sub-charts:
    - [ ] **By Time of Day:** Bar chart showing avg slippage for each hour
    - [ ] **By Day of Week:** Bar chart showing avg slippage by day
  - [ ] Color bars by favorable/unfavorable
  - [ ] Show sample size for each bar
  - [ ] Statistical significance indicators
  - [ ] Identify best/worst times visually

### Phase 3: Enhanced Data Tables

#### 3.1 Detailed Session Breakdown Table

- [ ] Enhance existing reconciliation summary table
  - [ ] Make expandable rows
  - [ ] Click session row to expand and show:
    - [ ] All matched pairs in that session
    - [ ] Individual trade details (time, premium, slippage)
    - [ ] Unmatched trades listed separately
  - [ ] Add column sorting
  - [ ] Add column filters
  - [ ] Show mini sparklines in cells for trends
  - [ ] Add export button (CSV/Excel)
  - [ ] Highlight rows with anomalies (red background)

#### 3.2 Trade-Level Details Table

- [ ] Create new detailed view component
  - [ ] Columns:
    - [ ] Session Date
    - [ ] Time Opened (both BT and RPT)
    - [ ] Backtested Premium
    - [ ] Reported Premium
    - [ ] Slippage ($)
    - [ ] Slippage (%)
    - [ ] Contracts (BT vs RPT)
    - [ ] P/L (BT vs RPT)
    - [ ] P/L Delta
    - [ ] Match Type (Auto/Manual)
    - [ ] Legs (strategy details)
  - [ ] Sortable, filterable columns
  - [ ] Pagination for large datasets
  - [ ] Click row to highlight in charts
  - [ ] Export functionality

### Phase 4: Advanced Analytics

#### 4.1 Slippage Attribution Analysis

- [ ] Add to `/lib/calculations/slippage-analysis.ts`
  - [ ] Implement `attributeSlippage()` function
  - [ ] Break down slippage components:
    - [ ] **Fill Price Slippage:** Difference in reported vs backtested premium
    - [ ] **Size Slippage:** Impact from contract count differences
    - [ ] **Timing Slippage:** Impact from execution time differences
    - [ ] **Missing Trades:** Impact of unmatched trades
  - [ ] Calculate percentage contribution of each component
  - [ ] Return prioritized list of slippage drivers

- [ ] Create visualization component
  - [ ] Pie chart or stacked bar showing attribution breakdown
  - [ ] Drill-down capability to see examples

#### 4.2 Rolling Window Analysis

- [ ] Create `/lib/calculations/rolling-window-analysis.ts`
  - [ ] Implement `calculateRollingMetrics()`
    - [ ] 30-day rolling correlation
    - [ ] 30-day rolling average slippage
    - [ ] 30-day rolling match rate
  - [ ] Return time series data for charting

- [ ] Create `/components/reconciliation-charts/RollingMetricsChart.tsx`
  - [ ] Multi-line chart showing trends over time
  - [ ] Identify improving vs degrading periods
  - [ ] Highlight periods with significant changes

#### 4.3 Exception Reporting

- [ ] Create `/lib/services/exception-detection.ts`
  - [ ] Implement automated flagging:
    - [ ] `detectAbnormalSessions()`: Sessions with slippage >2 std dev from mean
    - [ ] `detectLargeSlippageTrades()`: Individual trades with excessive slippage
    - [ ] `detectSystematicPatterns()`: Recurring issues (e.g., always worse at market open)
  - [ ] Return structured exception reports

- [ ] Create UI component for exceptions
  - [ ] Alert-style cards highlighting issues
  - [ ] Actionable recommendations
  - [ ] Link to detailed views
  - [ ] Acknowledge/dismiss functionality

#### 4.4 Comparative Performance Metrics

- [ ] Add advanced metrics to dashboard:
  - [ ] **Win Rate Comparison:** Backtested vs Reported win %
  - [ ] **Average Winner/Loser Comparison**
  - [ ] **Sharpe Ratio Impact:** How slippage affects risk-adjusted returns
  - [ ] **Max Drawdown Comparison:** Does slippage worsen drawdowns?
  - [ ] **Recovery Time:** How long to recover from slippage impact

### Phase 5: User Experience Enhancements

#### 5.1 Interactive Dashboard Page

- [ ] Create comprehensive dashboard view at top of page
  - [ ] Summary metrics cards (Phase 2.1)
  - [ ] Key charts in dashboard (2-3 most important)
  - [ ] Quick filters: date range, strategy, session
  - [ ] "Deep Dive" button to expand to full analysis

#### 5.2 Tabbed Analysis Views

- [ ] Restructure comparison blocks page with tabs:
  - [ ] **Overview Tab:** High-level metrics and charts
  - [ ] **Statistical Analysis Tab:** T-tests, correlations, distributions
  - [ ] **Slippage Analysis Tab:** All slippage charts and breakdowns
  - [ ] **Session Details Tab:** Detailed tables and heat maps
  - [ ] **Exceptions Tab:** Flagged issues and recommendations

#### 5.3 Export and Reporting

- [ ] Add export functionality:
  - [ ] Export all metrics to CSV
  - [ ] Export charts as PNG/SVG
  - [ ] Generate PDF report with key findings
  - [ ] Copy metrics to clipboard for sharing

#### 5.4 Settings and Preferences

- [ ] Save user preferences per block:
  - [ ] Default view/tab
  - [ ] Favorite charts
  - [ ] Custom metric thresholds
  - [ ] Alert settings

#### 5.5 Contextual Help

- [ ] Add info icons with tooltips explaining:
  - [ ] What each metric means
  - [ ] How to interpret charts
  - [ ] What actions to take based on findings
  - [ ] Statistical concepts (p-value, correlation, etc.)

### Phase 6: Performance Optimization

#### 6.1 Computation Caching

- [ ] Implement caching for expensive calculations:
  - [ ] Cache t-test results in `AlignedTradeSet`
  - [ ] Cache chart data transformations
  - [ ] Invalidate cache only when alignments change

#### 6.2 Lazy Loading

- [ ] Load charts on-demand:
  - [ ] Render visible charts first
  - [ ] Lazy load hidden tabs
  - [ ] Progressive enhancement for large datasets

#### 6.3 Web Workers

- [ ] Consider using web workers for:
  - [ ] Statistical calculations
  - [ ] Large dataset transformations
  - [ ] Distribution calculations

### Phase 7: Testing and Validation

#### 7.1 Unit Tests

- [ ] Test statistical calculations:
  - [ ] Verify t-test calculations with known datasets
  - [ ] Test correlation calculations
  - [ ] Validate slippage attribution logic
  - [ ] Test edge cases (no matches, all matches, etc.)

#### 7.2 Integration Tests

- [ ] Test data flow:
  - [ ] Reconciliation → Stats → Charts
  - [ ] User interactions (filtering, sorting)
  - [ ] Export functionality

#### 7.3 Visual Regression Tests

- [ ] Snapshot testing for charts
- [ ] Ensure consistent rendering

### Phase 8: Documentation

#### 8.1 User Documentation

- [ ] Create user guide:
  - [ ] How to interpret each chart
  - [ ] What good vs bad metrics look like
  - [ ] Troubleshooting common issues
  - [ ] Best practices for trade matching

#### 8.2 Developer Documentation

- [ ] Document architecture:
  - [ ] Data flow diagrams
  - [ ] Component hierarchy
  - [ ] Calculation methodologies
  - [ ] Extension points for new metrics

## Data Requirements

### Available Data (Already Captured)

✅ **From NormalizedTrade:**
- Trade ID
- Strategy name
- Date/time opened and closed
- Premium per contract and total premium
- Contract count
- P/L
- Opening and closing fees
- Legs (trade structure)
- Session identifier

✅ **From AlignedTradeSet:**
- Matched trade pairs
- Unmatched trades (both sides)
- Auto-match vs manual-match indicators
- Selected trade IDs for calculations

✅ **From AlignmentMetrics:**
- Basic totals (count, P/L, premium, fees)
- Match rate
- Slippage per contract
- Size variance

### New Data to Calculate

🔄 **Statistical Metrics:**
- T-test results (t-statistic, p-value, confidence interval)
- Correlation coefficients
- Distribution statistics (percentiles, skewness, kurtosis)
- Outlier identification

🔄 **Time-Based Aggregations:**
- Hourly slippage averages
- Daily slippage trends
- Rolling window metrics

🔄 **Attribution Data:**
- Slippage component breakdown
- Missing trade impact quantification

## Technical Implementation Notes

### Statistical Calculations

**T-Test Implementation:**
```typescript
function calculatePairedTTest(pairs: MatchedPair[]): TTestResult {
  const differences = pairs.map(p => p.reported.pl - p.backtested.pl)
  const n = differences.length
  const mean = differences.reduce((sum, d) => sum + d, 0) / n
  const variance = differences.reduce((sum, d) => sum + Math.pow(d - mean, 2), 0) / (n - 1)
  const stdDev = Math.sqrt(variance)
  const stdError = stdDev / Math.sqrt(n)
  const tStatistic = mean / stdError
  const degreesOfFreedom = n - 1
  // Use t-distribution library or approximation for p-value
  const pValue = calculatePValue(tStatistic, degreesOfFreedom)
  const criticalValue = 1.96 // for 95% CI
  const confidenceInterval: [number, number] = [
    mean - criticalValue * stdError,
    mean + criticalValue * stdError
  ]
  return {
    tStatistic,
    pValue,
    degreesOfFreedom,
    meanDifference: mean,
    confidenceInterval,
    isSignificant: pValue < 0.05,
    interpretation: interpretTTest(tStatistic, pValue)
  }
}
```

### Chart Data Transformation Patterns

**For Slippage Distribution:**
```typescript
function prepareSlippageDistribution(pairs: MatchedPair[]): SlippageDistributionData[] {
  const slippages = pairs.map(p => p.reported.totalPremium - p.backtested.totalPremium)
  const min = Math.min(...slippages)
  const max = Math.max(...slippages)
  const binCount = 20
  const binWidth = (max - min) / binCount

  const bins = Array.from({ length: binCount }, (_, i) => ({
    binStart: min + i * binWidth,
    binEnd: min + (i + 1) * binWidth,
    bin: `$${(min + i * binWidth).toFixed(0)} to $${(min + (i + 1) * binWidth).toFixed(0)}`,
    frequency: 0,
    percentage: 0
  }))

  slippages.forEach(slippage => {
    const binIndex = Math.min(Math.floor((slippage - min) / binWidth), binCount - 1)
    bins[binIndex].frequency++
  })

  bins.forEach(bin => {
    bin.percentage = (bin.frequency / slippages.length) * 100
  })

  return bins
}
```

## Success Criteria

### Functionality
- [ ] All charts render correctly with real data
- [ ] Statistical calculations are accurate (verified against test data)
- [ ] Interactive features work smoothly (filtering, sorting, drilling down)
- [ ] Export functionality works for all formats

### Performance
- [ ] Page loads in < 2 seconds with typical dataset (100-200 trades)
- [ ] Charts render in < 500ms
- [ ] Smooth scrolling and interactions (60fps)

### User Experience
- [ ] Intuitive navigation between views
- [ ] Clear, actionable insights presented
- [ ] Helpful tooltips and explanations
- [ ] Responsive design works on tablet/desktop

### Code Quality
- [ ] All new code has unit tests (>80% coverage)
- [ ] Components follow existing patterns
- [ ] TypeScript types are complete
- [ ] No console errors or warnings

## Future Enhancements (Post-MVP)

- [ ] Machine learning for slippage prediction
- [ ] Automated recommendations for reducing slippage
- [ ] Comparison across multiple blocks
- [ ] Real-time streaming updates (if live trading)
- [ ] Mobile app views
- [ ] API endpoints for external analysis tools
- [ ] Custom metric builder (user-defined formulas)
- [ ] Scenario analysis ("What if slippage was 10% better?")

## References and Resources

### Statistical Methods
- **Paired T-Test:** Standard statistical test for comparing paired observations
- **Pearson Correlation:** Measures linear relationship between two variables
- **P-Value Interpretation:** p < 0.05 = statistically significant

### Slippage Analysis
- **Types of Slippage:**
  1. **Execution Slippage:** Fill price vs expected price
  2. **Timing Slippage:** Delay between signal and execution
  3. **Size Slippage:** Partial fills or size discrepancies

### Trading Performance Metrics
- **Match Rate:** Percentage of trades successfully matched
- **Slippage Per Contract:** Average difference in fill price per contract
- **Attribution Analysis:** Breaking down performance differences by cause

### Visualization Best Practices
- Use diverging colors for deltas (red/green or blue/red)
- Use sequential colors for magnitudes
- Include confidence intervals on estimates
- Show sample sizes with percentages
- Provide context through comparison benchmarks

---

**Document Version:** 1.0
**Last Updated:** 2025-10-12
**Status:** Ready for Implementation
