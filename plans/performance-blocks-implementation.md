# Performance Blocks Page - Implementation Plan

## Overview
Complete rebuild of the Performance Blocks page with comprehensive charts, portfolio-level views, and strategy filtering capabilities. This page will provide deep insights into trading performance through various visualizations and metrics.

## 1. Data Processing Layer (`app/calculations/performance.py`)

### Enhanced PerformanceCalculator Class

#### Core Calculations Required:

##### 1.1 Enhanced Cumulative Equity
- Support for both linear and logarithmic scaling
- Calculate portfolio value evolution from initial capital
- Track high water marks for drawdown calculation
- Support for strategy-level equity curves

##### 1.2 Trade Distribution Analysis
```python
def calculate_trade_distributions(self, trades):
    """
    Calculate various trade distributions:
    - By day of week
    - By time of day (hourly buckets)
    - By return on margin ranges
    - By hold duration
    """
```

##### 1.3 Win/Loss Streak Analysis
```python
def calculate_streak_distributions(self, trades):
    """
    Calculate all win/loss streaks, not just maximums:
    - Distribution of streak lengths
    - Frequency of each streak length
    - Average P/L per streak
    - Time between streaks
    """
```

##### 1.4 Trade Sequence Analysis
```python
def calculate_trade_sequence_data(self, trades):
    """
    Track performance metrics over trade sequence:
    - Return per trade in sequence
    - Cumulative return progression
    - Rolling win rate
    - Trend analysis
    """
```

##### 1.5 Monthly Heatmap Data
```python
def calculate_monthly_heatmap_data(self, trades):
    """
    Structure data for calendar heatmap:
    - Year/month grid
    - Monthly returns (percentage and absolute)
    - Yearly totals
    - Best/worst months
    """
```

##### 1.6 Return on Margin (ROM) Analysis
```python
def calculate_rom_over_time(self, trades):
    """
    Calculate ROM metrics:
    - ROM per trade
    - Moving averages (customizable periods)
    - Distribution statistics
    - Outlier detection
    """
```

##### 1.7 Rolling Performance Metrics
```python
def calculate_rolling_metrics(self, trades, window_sizes=[30, 60, 90]):
    """
    Calculate rolling windows for:
    - Win rate
    - Sharpe ratio
    - Profit factor
    - Average trade
    - Volatility
    """
```

## 2. Chart Components (`app/dash_app/components/tabs/performance_charts.py`)

### Chart Implementation Details

#### 2.1 Equity Curve Chart
```python
def create_equity_curve_chart(data, scale='linear', show_drawdown_areas=True):
    """
    Features:
    - Toggle between linear/logarithmic scale
    - Highlight drawdown periods with shaded areas
    - Show high water mark line
    - Add benchmark comparison (SPY, etc.)
    - Annotations for significant events
    """
```

#### 2.2 Drawdown Chart
```python
def create_drawdown_chart(data):
    """
    Features:
    - Filled area chart (red gradient)
    - Maximum drawdown horizontal line
    - Recovery period highlighting
    - Duration labels
    """
```

#### 2.3 Trade Distribution Charts
```python
def create_day_of_week_distribution(data):
    """
    Features:
    - Bar chart with hatched pattern
    - Show trade count and average P/L
    - Color by profitability
    """

def create_rom_distribution(data):
    """
    Features:
    - Histogram with red/green bars
    - Show mean and median lines
    - Percentile markers
    """
```

#### 2.4 Win/Loss Streak Distribution
```python
def create_streak_distribution_chart(data):
    """
    Features:
    - Horizontal bar chart
    - Negative x-axis for losses, positive for wins
    - Color intensity based on frequency
    - Labels showing exact counts
    """
```

#### 2.5 Trade Sequence Analysis
```python
def create_trade_sequence_chart(data):
    """
    Features:
    - Scatter plot with trade number on x-axis
    - Returns on y-axis
    - Size based on position size
    - Color by profit/loss
    - Optional trend line
    - Moving average overlay
    """
```

#### 2.6 Monthly Return Heatmap
```python
def create_monthly_heatmap(data):
    """
    Features:
    - Calendar grid (years as rows, months as columns)
    - Color scale: red (losses) to green (profits)
    - Show percentage and absolute values
    - Yearly totals column
    - Monthly averages row
    """
```

#### 2.7 Return on Margin Over Time
```python
def create_rom_timeline_chart(data, moving_averages=[30, 60, 90]):
    """
    Features:
    - Scatter plot of ROM values
    - Multiple moving average lines
    - Highlight outliers (>2 std dev)
    - Dropdown to select MA periods
    """
```

### Additional Useful Charts

#### 2.8 Rolling Performance Metrics
```python
def create_rolling_metrics_chart(data, metrics=['sharpe', 'win_rate', 'profit_factor']):
    """
    Features:
    - Multi-line chart
    - Customizable rolling window
    - Y-axis selector for different metrics
    - Highlight significant changes
    """
```

#### 2.9 Performance by Time Period
```python
def create_period_performance_chart(data, period='quarterly'):
    """
    Features:
    - Grouped bar chart
    - Compare different periods
    - Show growth rates
    - Annotations for best/worst periods
    """
```

#### 2.10 Risk Metrics Evolution
```python
def create_risk_evolution_chart(data):
    """
    Features:
    - VaR and CVaR lines
    - Maximum adverse excursion
    - Risk-adjusted returns
    - Volatility bands
    """
```

## 3. UI Layout Structure

### Page Layout
```
Performance Blocks Page
│
├── Header Section
│   ├── Page Title: "📈 Performance Blocks"
│   ├── Strategy Filter Dropdown (multi-select)
│   ├── Date Range Picker
│   ├── Comparison Mode Toggle
│   └── Export Menu
│
├── Key Metrics Bar
│   ├── Total Return
│   ├── Sharpe Ratio
│   ├── Max Drawdown
│   ├── Win Rate
│   └── Profit Factor
│
├── Main Equity Section (full width)
│   ├── Tab: Equity Curve
│   │   ├── Linear/Log Toggle
│   │   ├── Show Drawdown Areas Toggle
│   │   └── Chart
│   └── Tab: Drawdown
│       └── Chart
│
├── Distribution Analysis (2-column grid)
│   ├── Left Column
│   │   ├── Title: "📊 Trade Distribution"
│   │   ├── Day of Week Chart
│   │   └── ROM Distribution Chart
│   └── Right Column
│       ├── Title: "🎯 Win/Loss Streaks"
│       ├── Streak Distribution Chart
│       └── Streak Statistics Table
│
├── Time-Based Analysis (2-column grid)
│   ├── Left Column
│   │   ├── Title: "📅 Monthly Returns"
│   │   └── Monthly Heatmap
│   └── Right Column
│       ├── Title: "📈 Trade Sequence"
│       └── Trade Sequence Chart
│
├── Advanced Metrics (3-column grid)
│   ├── ROM Over Time
│   ├── Rolling Metrics
│   └── Risk Evolution
│
└── Footer
    └── Data freshness indicator
```

## 4. Interactive Features

### 4.1 Strategy Filtering
- Multi-select dropdown for strategies
- "Select All" / "Clear All" buttons
- Real-time chart updates
- Comparison mode: side-by-side or overlay

### 4.2 Date Range Selection
- Preset ranges: YTD, 1Y, 6M, 3M, 1M, All Time
- Custom date picker
- Zoom to selection on charts

### 4.3 Chart Interactions
- **Hover**: Detailed tooltips with full trade information
- **Click**: Highlight related data across all charts
- **Zoom**: Box select for zooming
- **Pan**: Click and drag to pan
- **Cross-hair**: Synchronized across charts

### 4.4 Export Options
- Download individual charts as PNG
- Export all charts as PDF report
- Download underlying data as CSV
- Copy chart to clipboard

### 4.5 Customization
- Toggle chart elements on/off
- Adjust moving average periods
- Change color schemes
- Save view preferences

## 5. Performance Optimizations

### 5.1 Data Processing
- Cache expensive calculations in memory
- Use numpy vectorized operations
- Implement incremental updates for new trades
- Pre-calculate common aggregations

### 5.2 Rendering
- Lazy load charts below the fold
- Use WebGL for large datasets
- Implement virtual scrolling for tables
- Debounce filter changes

### 5.3 State Management
- Memoize component outputs
- Use callback context to prevent unnecessary updates
- Implement client-side filtering where possible
- Store processed data in browser cache

## 6. Responsive Design

### Breakpoints
- **Desktop** (>1200px): Full layout with all columns
- **Tablet** (768-1200px): 2-column max, stackable sections
- **Mobile** (<768px): Single column, collapsible sections

### Mobile Optimizations
- Touch-friendly controls (larger buttons, swipe gestures)
- Simplified charts with essential information
- Collapsible chart sections
- Horizontal scroll for wide tables
- Bottom sheet for filters

## 7. Theme Support

### Light Theme
- White backgrounds
- Gray borders (#E5E7EB)
- Green for profits (#10B981)
- Red for losses (#EF4444)
- Subtle shadows

### Dark Theme
- Dark backgrounds (#1F2937)
- Lighter borders (#374151)
- Bright green for profits (#34D399)
- Bright red for losses (#F87171)
- No shadows, use borders

## 8. File Structure

```
app/
├── calculations/
│   ├── performance.py           # Enhanced with all calculations
│   └── performance_helpers.py   # Helper functions for complex calcs
│
├── dash_app/
│   ├── components/
│   │   ├── tabs/
│   │   │   └── performance_charts.py  # Main UI component
│   │   └── charts/
│   │       ├── __init__.py
│   │       ├── equity_charts.py       # Equity curve & drawdown
│   │       ├── distribution_charts.py # Trade distributions
│   │       ├── streak_charts.py       # Win/loss streak analysis
│   │       ├── time_charts.py         # Heatmap, sequence, ROM
│   │       ├── metric_charts.py       # Rolling metrics
│   │       └── chart_utils.py         # Shared chart utilities
│   │
│   ├── callbacks/
│   │   └── performance_callbacks.py   # All performance chart callbacks
│   │
│   └── utils/
│       ├── chart_themes.py            # Theme configurations
│       └── performance_cache.py       # Caching utilities
```

## 9. Implementation Steps

### Phase 1: Data Layer
1. Enhance `PerformanceCalculator` with all required calculations
2. Create helper functions for complex calculations
3. Implement caching mechanism
4. Write comprehensive tests

### Phase 2: Core Charts
1. Create equity curve with linear/log toggle
2. Implement drawdown chart
3. Build trade distribution charts
4. Add win/loss streak visualization

### Phase 3: Advanced Charts
1. Implement monthly heatmap
2. Create trade sequence analysis
3. Build ROM over time chart
4. Add rolling metrics visualization

### Phase 4: UI Integration
1. Build main layout structure
2. Implement strategy filtering
3. Add date range selection
4. Create responsive grid system

### Phase 5: Interactivity
1. Add cross-chart interactions
2. Implement export functionality
3. Add customization options
4. Create comparison mode

### Phase 6: Polish & Optimization
1. Performance optimization
2. Theme support refinement
3. Mobile responsiveness
4. User testing and feedback

## 10. Success Metrics

### Performance
- Page load time < 2 seconds
- Chart update time < 500ms
- Smooth interactions (60 fps)

### Usability
- All charts readable on mobile
- Intuitive navigation
- Clear data presentation
- Helpful tooltips and guides

### Functionality
- All calculations accurate
- Filters work correctly
- Exports functional
- No data loss on refresh

## 11. Future Enhancements

### Phase 2 Features
- AI-powered insights and anomaly detection
- Backtesting overlay on equity curve
- Social sharing of charts
- Collaborative annotations
- Real-time updates via WebSocket

### Integration Ideas
- Connect to brokerage APIs for live data
- Comparison with market indices
- Peer performance benchmarking
- Custom indicator overlays
- Alert system for performance milestones

## 12. Testing Strategy

### Unit Tests
- Test all calculation functions
- Verify data transformations
- Check edge cases (empty data, single trade, etc.)

### Integration Tests
- Test chart rendering with various data sizes
- Verify filter interactions
- Check export functionality

### UI Tests
- Test responsive breakpoints
- Verify theme switching
- Check accessibility standards
- Test on multiple browsers

### Performance Tests
- Load test with large portfolios (10k+ trades)
- Measure render times
- Profile memory usage
- Test concurrent user scenarios

---

*This document serves as the comprehensive implementation guide for the Performance Blocks page. It should be updated as development progresses and new requirements emerge.*
