# Position Sizing Enhancements Plan

## Objectives
- Deliver actionable position sizing guidance that leverages historical backtest data while staying flexible enough for user-provided context.
- Support portfolios with multiple strategies by surfacing allocation trade-offs and trade-level capital requirements.
- Make room for incremental upgrades so we can ship value quickly and iterate toward advanced tooling.

## Data We Already Have
- Per-trade fields: date opened/closed, P/L, number of contracts, margin requirement, funds at close, commissions, strategy name, and optional volatility metrics (`opening_vix`, `closing_vix`).
- Portfolio-level metadata: list of strategies, aggregate P/L, total trade count.
- Derived stats already computed: Kelly %, return on margin, drawdowns (via daily log where provided), Sharpe/Sortino, strategy breakdowns.
- UI baseline (screenshot): Win %, PCR, CAGR, MDD, MAR, allocation %, max contracts, max allocation $. Indicates that users already reason about allocations and per-strategy sizing.

## Opportunities From Existing Data
1. **Margin-Aware Sizing Curves**
   - Use `margin_req`, `funds_at_close`, and `num_contracts` to chart historical capital usage per strategy.
   - Surface max/avg margin utilization so users can size trades while respecting a portfolio-level ceiling.
2. **Per-Strategy Kelly Variants**
   - Reuse shared Kelly metrics to show full/half/quarter Kelly for each strategy and blended portfolio Kelly.
   - Provide sliders that let users lock in a fraction (e.g., 0.5× Kelly) and see implied contracts/margin.
3. **Risk Buckets & Alerts**
   - Flag stretches where drawdown + Kelly would exceed available capital.
   - Build “what-if” prompts based on streaks and volatility fields (e.g., reduce sizing after 3 losses).
4. **Historical Contract Replay**
   - Re-run trades using different fractions of Kelly or fixed fractional to compare ending equity curves.
   - Offer quick presets (fixed-dollar, fixed-fractional, volatility-adjusted) fed by trade history.

## User-Provided Inputs To Unlock More
1. **Starting Portfolio & Risk Guardrails**
   - Capture starting net liquidity (if daily log missing), target max drawdown %, and risk tolerance sliders.
2. **Per-Trade Budget Overrides**
   - Allow users to enter their default contract size or cash-per-trade when backtest data omits it.
   - Optionally collect per-strategy capital ceilings to reconcile against recommended Kelly sizing.
3. **Execution Constraints**
   - Number of parallel trades allowed, broker margin multiplier, trading schedule (days enabled/disabled).
4. **Benchmarks & Fees**
   - Let users override commission structure or add borrow costs so sizing recommendations match live conditions.
   - All inputs remain manual (no account syncing) and will be persisted locally so the user can pick up where they left off.

## Implementation Patterns To Reuse
- **Local storage persistence**: The Dash shell already keeps `current-portfolio-data`, `current-daily-log-data`, and filenames in `dcc.Store` components with `storage_type="local"` (see `app/dash_app/app.py:155-158`) and clears them through the existing `clear_portfolio` callback. Position sizing preferences should reuse this pattern to stay aligned with the rest of the app.
- **Server-side heavy lifting**: Monte Carlo simulations execute inside the Python callback `run_monte_carlo_simulation` (`app/dash_app/callbacks/monte_carlo_callbacks.py`) using `MonteCarloSimulator`, confirming the work happens on the server. New sizing backtests or replay engines should follow the same server-side pattern so we avoid pushing large computations into the browser.
- **Manual-first inputs**: With no syncing planned, every advanced control needs clear manual entry defaults and helpful copy to explain required fields before we stash them into local storage.

## Suggested Delivery Milestones
1. **Shared Kelly + Portfolio Summary (in progress)**
   - Finish consolidating Kelly logic (done) and expose helper so the UI can render consistent metrics.
2. **Sizing Insights MVP**
   - Add cards for half/quarter Kelly, historical margin utilization chart, and warnings when Kelly sizing breaches historical max margin usage.
3. **User Input Layer**
   - Build a lightweight modal storing per-portfolio settings (starting capital, desired Kelly fraction, parallel trade cap).
4. **Scenario Simulator**
   - Replay historical trades using chosen sizing rules; output updated CAGR/MDD/ending balance.
5. **Strategy Allocator**
   - Combine per-strategy Kelly + margin usage to suggest capital weights under total-risk constraints.

## Open Questions & Current Direction
- **Local storage scoping/versioning**: Introduce a dedicated `position-sizing-store` (local storage) that keeps a map keyed by a portfolio fingerprint (e.g., hash of filename, upload timestamp, and total trades). Each record stores a `version` field so we can migrate schema changes cleanly and a `strategies` object for per-strategy overrides. This mirrors how we namespace Monte Carlo cache data while guaranteeing the sizing inputs stay aligned with the specific backtest loaded.
- **Manual-input UX**: Model the controls after the Monte Carlo tab—stacked `dmc.Paper` sections with grouped `NumberInput`/`Select` components, collapsible subtabs for advanced fields, and a reset button that writes defaults back to local storage. Initial MVP: a primary “Portfolio Settings” card (starting capital, Kelly fraction, guardrails) and a secondary “Strategy Overrides” accordion so we reuse familiar patterns without overwhelming users.
- **Replay processing pipeline**: Stick with the existing server-side callback pattern plus optional caching (similar to `mc-simulation-cache`). We don’t need batching/background jobs yet; just monitor callback duration and add caching/invalidation hooks as we scale up.

Document owner: Position Sizing team
Last updated: September 24, 2025
