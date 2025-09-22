# Monte Carlo Risk Simulation - Realistic Implementation Plan

## Executive Summary
A practical implementation plan for Monte Carlo simulations that leverages existing TradeBlocks components and focuses on features that will actually work with available data.

## What We Actually Have to Work With

### Existing Code Components to Reuse
1. **`app/calculations/correlation.py`** - CorrelationCalculator already groups trades by strategy/date
2. **`app/calculations/monte_carlo.py`** - Basic Monte Carlo with normal distribution
3. **`app/data/daily_log_processor.py`** - Processes daily portfolio values
4. **`app/calculations/shared.py`** - Drawdown calculations from daily logs
5. **`app/dash_app/components/tabs/correlation_matrix.py`** - UI patterns for heatmaps
6. **`app/utils/theme.py`** - Dark/light theme support for charts

### Available Data
- **Trade Log**: Individual trades with P/L, strategies, dates, margins
- **Daily Log**: Portfolio values, P/L %, **drawdown % already calculated**

## Realistic Implementation Phases

## Phase 1: Bootstrap Resampling Engine ✅ REALISTIC
**Difficulty: EASY-MEDIUM**
**Reuses: Existing MonteCarloSimulator class**

### What We'll Actually Build
```python
# Extend existing monte_carlo.py
class BootstrapMonteCarloSimulator(MonteCarloSimulator):
    def run_bootstrap_simulation(self, portfolio: Portfolio, request: MonteCarloRequest):
        # Sample from actual historical trades
        historical_trades = portfolio.trades

        # For each simulation
        for i in range(request.num_simulations):
            # Randomly sample trades with replacement
            sampled_trades = np.random.choice(
                historical_trades,
                size=request.days_forward,
                replace=True
            )
            # Calculate cumulative P/L path
```

### Why This Works
- We have actual trade P/L data
- Bootstrap preserves real distributions (fat tails, skew)
- Simple to implement, hard to mess up
- No distribution assumptions needed

---

## Phase 2: Drawdown Analysis from Daily Logs ✅ VERY REALISTIC
**Difficulty: EASY**
**Reuses: DailyLogProcessor, existing drawdown calculations**
**Timeline: 1 day**

### What We'll Actually Build
```python
# Use daily log data that ALREADY HAS drawdown percentages
def analyze_historical_drawdowns(daily_log: DailyLog):
    # Drawdowns are already in daily_log_data['drawdown_pct']!
    drawdowns = [entry.drawdown_pct for entry in daily_log.entries]

    # Calculate statistics
    return {
        'max_drawdown': max(drawdowns),
        'avg_drawdown': np.mean([d for d in drawdowns if d > 0]),
        'time_in_drawdown': len([d for d in drawdowns if d > 0]) / len(drawdowns),
        'percentiles': np.percentile(drawdowns, [50, 75, 90, 95, 99])
    }
```

### Why This Works
- **Drawdown percentages are already calculated in the daily log!**
- No complex path-dependent calculations needed
- Can immediately show historical drawdown distributions
- Recovery time analysis is straightforward

---

## Phase 3: Multi-Strategy Simulations ✅ REALISTIC
**Difficulty: EASY-MEDIUM**
**Reuses: CorrelationCalculator**

### What We'll Actually Build
```python
# Leverage existing correlation calculator
def run_correlated_bootstrap(portfolio: Portfolio, strategies: List[str]):
    # Use existing CorrelationCalculator to get correlation matrix
    corr_calc = CorrelationCalculator()
    correlation_matrix = corr_calc.calculate_correlation_matrix(portfolio)

    # Bootstrap each strategy separately
    strategy_simulations = {}
    for strategy in strategies:
        strategy_trades = [t for t in portfolio.trades if t.strategy == strategy]
        strategy_simulations[strategy] = bootstrap_sample(strategy_trades)

    # Combine based on historical allocations or equal weight
```

### Why This Works
- CorrelationCalculator already exists and works
- Can reuse correlation matrix UI components
- Strategy filtering already implemented in portfolio

---

## Phase 4: Simple Position Sizing ✅ REALISTIC
**Difficulty: MEDIUM**

### What We'll Actually Build
```python
def calculate_kelly_fraction(trades: List[Trade]):
    wins = [t.pl for t in trades if t.pl > 0]
    losses = [abs(t.pl) for t in trades if t.pl < 0]

    win_rate = len(wins) / len(trades)
    avg_win = np.mean(wins) if wins else 0
    avg_loss = np.mean(losses) if losses else 0

    if avg_loss == 0:
        return 0  # Can't calculate

    # Kelly formula
    edge_odds_ratio = (win_rate * avg_win - (1-win_rate) * avg_loss) / avg_loss
    kelly_pct = edge_odds_ratio / (avg_win / avg_loss)

    # Apply safety factor (typically 0.25)
    return min(kelly_pct * 0.25, 0.15)  # Cap at 15% per position
```

### Why This Works
- Simple formula with clear inputs
- Can calculate from historical trades
- Conservative safety factors prevent blow-ups
- Easy to explain to users

---

## Phase 5: Portfolio Growth Projections ✅ REALISTIC
**Difficulty: EASY-MEDIUM**

### What We'll Actually Build
```python
def project_portfolio_growth(initial_capital: float, bootstrap_results: List):
    projections = []

    for simulation in bootstrap_results:
        capital = initial_capital
        growth_path = [capital]

        for daily_return in simulation:
            capital *= (1 + daily_return)
            growth_path.append(capital)

        projections.append({
            'final_value': capital,
            'cagr': (capital/initial_capital) ** (1/years) - 1,
            'path': growth_path
        })

    return projections
```

### Why This Works
- Straightforward compound growth calculation
- Uses bootstrap results from Phase 1
- Clear visualization with percentile bands
- Users understand growth projections

---

## What We're NOT Building (and Why)

### ❌ Market Regime Detection
**Why Not:**
- Requires sophisticated ML models
- Limited VIX data in trades
- Regime identification is notoriously unreliable
- Would need years of data for validation

### ❌ Hidden Markov Models
**Why Not:**
- Complex implementation
- Difficult to validate
- Users won't understand it
- Marginal improvement over bootstrap

### ❌ Real-Time VaR
**Why Not:**
- Need intraday data (we only have daily)
- Computational complexity
- Limited practical value for options traders

### ❌ Optimal Portfolio Allocation
**Why Not:**
- Requires stable correlation estimates
- Mean-variance optimization often fails in practice
- Would need transaction cost modeling

---

## Simplified File Structure

```
app/
├── calculations/
│   ├── monte_carlo.py (extend with bootstrap)
│   ├── position_sizing.py (new - Kelly criterion)
│   └── drawdown_stats.py (new - analyze daily logs)
├── dash_app/
│   └── components/
│       └── tabs/
│           └── risk_simulator.py (new - replace placeholder)
```

---

## UI Components (Reusing Existing Patterns)

### Control Panel (like Correlation Matrix)
- Number of simulations slider
- Time horizon selector
- Strategy checkboxes
- Risk-free rate input (reuse from Geekistics)

### Visualizations (reuse chart patterns)
1. **Equity Curves with Percentiles** (like Performance Charts)
2. **Drawdown Distribution** (histogram like Trade Distribution)
3. **Strategy Contribution** (pie chart like existing)
4. **Growth Projection** (line chart with confidence bands)

---

## Implementation Order

1. **Core Bootstrap + UI**
   - Extend MonteCarloSimulator with bootstrap
   - Create basic Risk Simulator UI
   - Add simulation controls

2. **Drawdown + Multi-Strategy**
   - Integrate daily log drawdown analysis
   - Add multi-strategy support
   - Reuse correlation matrix components

3. **Position Sizing + Projections**
   - Implement Kelly criterion
   - Add growth projections
   - Polish visualizations

---

## Success Metrics

✅ **Achievable Goals:**
- Bootstrap 1000 simulations in < 1 second
- Display historical drawdown distribution accurately
- Calculate Kelly fraction for each strategy
- Show 1-year growth projections with confidence intervals

❌ **Not Attempting:**
- Regime detection accuracy
- Optimal portfolio weights
- Intraday risk metrics
- ML-based predictions

---

## Code to Reuse

### From correlation.py:
```python
# Already groups trades by strategy and date
strategy_daily_returns = defaultdict(lambda: defaultdict(float))
for trade in portfolio.trades:
    date_key = trade.date_opened.isoformat()
    strategy_daily_returns[trade.strategy][date_key] += trade.pl
```

### From shared.py:
```python
# Already calculates drawdowns from daily log
def calculate_max_drawdown_from_daily_log(daily_log_data: List[Dict]) -> float:
    # Daily log already contains drawdown_pct values
    max_drawdown = max(entry.get("drawdown_pct", 0) for entry in daily_log_data)
```

### From monte_carlo.py:
```python
# Existing structure to extend
class MonteCarloSimulator:
    def run_simulation(self, portfolio: Portfolio, request: MonteCarloRequest)
    # Just need to replace np.random.normal with bootstrap sampling
```

---
