# TP/SL Optimizer (MFE/MAE Edition)

This feature lets you simulate alternate take‑profit / stop‑loss rules using the **existing MFE/MAE excursion data** that powers the Excursion Analysis charts. No reprocessing is needed—results are computed from the per‑trade excursions already in your performance snapshot.

## Where to find it
- Navigate to **Performance Blocks** → tab **TP/SL Optimizer**.
- Requires an active block with trade data (and MFE/MAE already computed via the performance snapshot).

## How it works
- Uses the `mfeMaeData` already produced by `buildPerformanceSnapshot`.
- You choose a **basis**: `margin` or `premium` (matches excursion normalization).
- You enter a **grid of scenarios** with TP% (positive) and SL% (negative).
- For each trade, the simulator checks:
  - If MFE% ≥ TP% → counts as TP hit, uses TP% as simulated return.
  - Else if MAE% ≤ SL% → counts as SL hit, uses SL% as simulated return.
  - Else → keeps the original return for that trade.
- Aggregates win rate, average/total return %, total P/L, TP/SL hit rates, and trade counts.

## Inputs
- **Basis:** `margin` or `premium` (pick the denominator matching your excursion view).
- **Scenario grid:** rows of `{ tpPct, slPct }` (e.g., TP 20, SL -10).

## Outputs (per scenario)
- Win rate, average return %, total return %, total P/L.
- TP hits, SL hits, unchanged count, hit rates.
- Median/expectancy are included when data is present.

## Tips
- Start with small grids (e.g., TP 10/20/30 vs SL -10/-15) to spot trends.
- Switch basis if your strategies are premium‑driven vs. margin‑driven.
- Results reflect **filtered trades** (date/strategy filters in Performance Blocks).

## Limitations
- Uses per‑trade excursions only; does not re‑simulate intraday path or order fill logic.
- Assumes TP/SL checked against max excursions—real fills may differ.
