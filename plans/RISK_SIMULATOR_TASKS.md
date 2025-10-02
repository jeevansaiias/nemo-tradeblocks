# Risk Simulator (Monte Carlo) Implementation Tasks

## Overview
Implementing a modern React/TypeScript Risk Simulator page with improved Monte Carlo architecture that **decouples simulation length from resample pool size**.

---

## Architecture Research & Design

### Key Findings from Legacy Implementation

#### Current Issues:
1. **Coupled Parameters**: `days_forward` parameter serves dual purpose:
   - Number of trades to simulate forward
   - Number of samples to draw from historical data

2. **Limited Flexibility**: Can't do scenarios like:
   - "Simulate 252 trades using only my last 60 trades" (recency bias)
   - "Simulate 100 trades from a 400-trade history" (requires resampling with replacement multiple times)

3. **Two Sampling Methods**:
   - `_bootstrap_trades()`: Resamples individual trade P&L values
   - `_bootstrap_daily_returns()`: Resamples daily aggregated returns
   - Both suffer from the same coupling issue

#### Proposed Improved Architecture:

```typescript
interface MonteCarloParams {
  // Simulation parameters
  numSimulations: number;           // How many Monte Carlo paths to run (1000-10000)
  simulationLength: number;         // How many trades/days to project forward (30-500)

  // NEW: Resampling parameters (decoupled!)
  resampleWindow?: number;          // How many recent trades to sample from (null = all)
  resampleMethod: 'trades' | 'daily'; // Sample individual trades or daily returns

  // Portfolio parameters
  initialCapital: number;           // Starting capital
  strategy?: string;                // Filter to specific strategy (null = all)

  // Advanced settings
  tradesPerYear: number;            // For annualization (252 typical)
  randomSeed?: number;              // For reproducibility
}

interface MonteCarloResult {
  simulations: number[][];          // Each simulation's cumulative returns [numSims x simLength]
  finalValues: number[];            // Final return value for each simulation
  percentiles: {                    // Percentile bands for visualization
    p5: number[];
    p25: number[];
    p50: number[];                  // Median
    p75: number[];
    p95: number[];
  };
  statistics: {
    expectedReturn: number;         // Mean of final values
    var95: number;                  // 5th percentile (95% VaR)
    probabilityOfProfit: number;    // % of sims ending positive
    maxDrawdown95: number;          // 95th percentile max drawdown
    bestCase: number;               // 95th percentile final return
    medianCase: number;             // 50th percentile final return
    worstCase: number;              // 5th percentile final return
  };
  drawdowns: number[][];            // Max drawdown for each simulation
}
```

#### Benefits of Decoupling:

1. **Recency Weighting**: Simulate future using only recent performance
   - Example: `simulationLength: 252, resampleWindow: 60`
   - Projects 252 trades forward, but only samples from last 60 trades

2. **Bootstrap Efficiency**: Clear when true bootstrapping happens
   - If `resampleWindow < simulationLength`: Must resample with replacement
   - If `resampleWindow >= simulationLength`: Can sample without replacement if desired

3. **Testing Robustness**: Easy to test "what if recent performance continues?"
   - vs "what if full history repeats?"

4. **Statistical Clarity**: Makes assumptions explicit
   - User explicitly chooses lookback window
   - Not hidden in single parameter

---

## Implementation Tasks

### Phase 1: Core Infrastructure
- [x] **Task 1**: Create TypeScript interfaces
  - [x] `MonteCarloParams` interface
  - [x] `MonteCarloResult` interface
  - [x] `SimulationStatistics` interface
  - Location: `lib/calculations/monte-carlo.ts`

- [x] **Task 2**: Implement bootstrap resampling utilities
  - [x] `resampleTrades()` - sample with replacement from trade pool
  - [x] `resampleDailyReturns()` - sample from daily aggregated returns
  - [x] Support for `resampleWindow` parameter (null = all trades)
  - [x] Random seed support for reproducibility

- [x] **Task 3**: Build core Monte Carlo simulation engine
  - [x] `runMonteCarloSimulation()` main function
  - [x] Individual trade resampling mode
  - [x] Daily returns resampling mode
  - [x] Calculate cumulative returns paths
  - [x] Track portfolio value over time (capital + P&L)

### Phase 2: Statistics & Analysis
- [x] **Task 4**: Implement percentile calculations
  - [x] Calculate P5, P25, P50, P75, P95 bands across simulations
  - [x] Per-step percentiles (for equity curve bands)
  - [x] Final value percentiles (for statistics)

- [x] **Task 5**: Calculate drawdown metrics
  - [x] Max drawdown for each simulation path
  - [x] 95th percentile max drawdown
  - [x] Drawdown distribution histogram data

- [x] **Task 6**: Calculate summary statistics
  - [x] Expected return (mean)
  - [x] Value at Risk (VaR) 95%
  - [x] Probability of profit
  - [x] Best/Median/Worst case scenarios
  - [x] Standard deviation

### Phase 3: UI Components
- [ ] **Task 7**: Create Risk Simulator page layout
  - Location: `app/(platform)/risk-simulator/page.tsx`
  - [ ] Page header (already defined in site-header.tsx)
  - [ ] Controls section (Paper/Card)
  - [ ] Charts section
  - [ ] Statistics grid

- [ ] **Task 8**: Build simulation controls panel
  - [ ] Number of simulations input (100-10000)
  - [ ] Simulation length dropdown (30, 60, 90, 180, 252, 504 trades)
  - [ ] **NEW**: Resample window slider/input (null = all, or last N trades)
  - [ ] Strategy filter dropdown
  - [ ] Initial capital input
  - [ ] Run Simulation button
  - [ ] Reset button

- [ ] **Task 9**: Add advanced settings accordion
  - [ ] Trades per year input
  - [ ] Sampling method radio (Individual Trades / Daily Returns)
  - [ ] Random seed toggle + input
  - [ ] Info tooltips for each setting

### Phase 4: Visualizations
- [ ] **Task 10**: Implement equity curve chart
  - [ ] Show percentile bands (P5, P25, P50, P75, P95) as filled areas
  - [ ] Optional: Show individual simulation paths (toggle)
  - [ ] Linear/Log scale toggle
  - [ ] X-axis: Trade number, Y-axis: Portfolio return %
  - [ ] Use Plotly with ChartWrapper

- [ ] **Task 11**: Create return distribution histogram
  - [ ] Histogram of final return values
  - [ ] Vertical lines for P5, P50, P95 percentiles
  - [ ] Color-coded by outcome (positive/negative)
  - [ ] Show mean, median on chart

- [ ] **Task 12**: Build drawdown analysis histogram
  - [ ] Histogram of maximum drawdowns
  - [ ] Vertical lines for P5, P50, P95 percentiles
  - [ ] Color-coded by severity
  - [ ] Show mean, median on chart

- [ ] **Task 13**: Create statistics cards grid
  - [ ] Expected Return card (green, trending-up icon)
  - [ ] Value at Risk 95% card (red, alert icon)
  - [ ] Probability of Profit card (blue, percentage icon)
  - [ ] Max Drawdown 95th card (orange, chart-line icon)
  - [ ] Best Case (95th) card
  - [ ] Most Likely (50th) card
  - [ ] Worst Case (5th) card
  - [ ] Each card with icon, value, description, tooltip

### Phase 5: State Management & Integration
- [ ] **Task 14**: Set up simulation state management
  - [ ] React state for parameters
  - [ ] React state for results
  - [ ] Loading state during simulation
  - [ ] Error handling

- [ ] **Task 15**: Implement simulation runner
  - [ ] Load trades from active block (via block store)
  - [ ] Filter by strategy if selected
  - [ ] Run calculation with worker/async to avoid UI blocking
  - [ ] Update UI with results

- [ ] **Task 16**: Add simulation caching
  - [ ] Cache key based on all parameters
  - [ ] Store in memory (useMemo or local state)
  - [ ] Invalidate on parameter change
  - [ ] Show "cached result" indicator

### Phase 6: Testing & Polish
- [ ] **Task 17**: Write unit tests for Monte Carlo calculations
  - Location: `tests/unit/monte-carlo.test.ts`
  - [ ] Test bootstrap resampling (with/without replacement)
  - [ ] Test simulation runs with fixed seed
  - [ ] Test percentile calculations
  - [ ] Test drawdown calculations
  - [ ] Verify parity with legacy Python implementation

- [ ] **Task 18**: Add empty/loading states
  - [ ] "No active block" placeholder
  - [ ] "Insufficient trades" warning (need min 10-20 trades)
  - [ ] Loading spinner during simulation
  - [ ] Placeholder charts before first run

- [ ] **Task 19**: Performance optimization
  - [ ] Run simulations in Web Worker if slow (>1000ms)
  - [ ] Optimize percentile calculations (avoid sorting N times)
  - [ ] Memoize expensive calculations
  - [ ] Progressive rendering for large sim counts

- [ ] **Task 20**: Final polish
  - [ ] Info tooltips on all charts
  - [ ] Responsive design for mobile
  - [ ] Dark mode support
  - [ ] Export simulation results (CSV/JSON)
  - [ ] "Share simulation" feature (copy parameters to clipboard)

---

## Key Improvements Over Legacy

### 1. Decoupled Architecture
- **Legacy**: `days_forward` = both simulation length AND resample count
- **New**: Separate `simulationLength` and `resampleWindow` parameters

### 2. Explicit Recency Weighting
- **Legacy**: Must use all historical trades
- **New**: Can specify "only use last N trades" for recency bias testing

### 3. Better UX
- **Legacy**: Python/Dash with limited interactivity
- **New**: React/TypeScript with shadcn/tailwind, modern controls

### 4. Type Safety
- **Legacy**: Python with Pydantic
- **New**: TypeScript with compile-time checks

---

## Notes

- Match legacy "building blocks" metaphor in tooltips
- Use same percentile levels (P5, P25, P50, P75, P95) as legacy
- Keep "TradeBlocks builds insights, not investment advice" disclaimers
- Initial capital should auto-populate from daily log or trade data
- Strategy dropdown should show trade counts like legacy: "Strategy Name (123 trades)"

---

## Testing Scenarios

1. **Basic Test**: 1000 simulations, 252 trades forward, all history, fixed seed=42
2. **Recency Test**: 1000 simulations, 252 trades forward, last 60 trades only
3. **Small Sample**: 1000 simulations, 30 trades forward, all history
4. **Large Sample**: 10000 simulations, 504 trades forward, all history
5. **Strategy Filter**: 1000 simulations, 252 trades forward, single strategy
6. **Daily vs Trade**: Compare results between trade-level and daily-level resampling
