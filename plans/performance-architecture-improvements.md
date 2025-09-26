# Performance & Architecture Stabilization Plan

## Objective
Cut CPU spikes and memory growth on the Render Free plan (1 vCPU / 2 GB RAM) without scaling vertically by reducing redundant computation, moving heavy data off Dash callback payloads, and caching precomputed analytics.

## Current Pain Points
- Each Dash callback rehydrates the full trade list and runs Geekistics + performance calculators, so even UI toggles trigger multi-second CPU bursts.
- `dcc.Store` entries keep the raw portfolio JSON in browser storage but resend it to the server on every callback, saturating the single worker.
- Upload handlers hold full `Portfolio` objects in-process with no eviction; multiple portfolios push the app toward the 2 GB RAM ceiling.
- CSV ingestion relies on pandas defaults (dtype inference, per-row object creation), consuming excessive CPU/heap during uploads.

## Workstreams & Milestones

### 1. Server-Side Portfolio Cache Service
- [x] Create a cache layer (`app/services/portfolio_cache.py`) that stores parsed trades plus precomputed aggregates keyed by `portfolio_id`.
- [x] On upload, compute once and persist:
  - canonical trade table (NumPy/Arrow or dict list)
  - Geekistics bundle (basic + advanced stats)
  - performance datasets (equity, distributions, rolling metrics)
  - strategy summaries/trade slices
- [x] Add TTL or LRU eviction; optionally back with Redis or SQLite so memory does not grow unbounded.
- [x] Expose lightweight fetch helpers that return slices by key instead of recomputing.

### 2. Callback Payload Slimming
- [x] Switch Dash stores from full JSON payloads to a lightweight `{ "portfolio_id": ..., "filters": ... }` shape.
- [x] Update callbacks to call the cache helpers and only return the data needed for the figure/table being updated.
- [ ] Add clientside filtering (e.g., strategy dropdown) where possible so the server avoids needless round-trips.

### 3. Calculator Reuse & Memoization
- [ ] Treat `GeekisticsCalculator` and `PerformanceCalculator` as singletons; expose explicit `get_*` methods that reuse cached results per portfolio.
- [ ] Remove the extra Geekistics run inside `calculate_portfolio_stats_dict`; ask the cache for `max_drawdown` instead of recomputing.
- [ ] Guard Monte Carlo callbacks so Chart-style prop changes reuse cached simulations without rebuilding `Portfolio` objects.

### 4. CSV Ingestion Optimization
- [ ] Define explicit pandas/Polars schemas for trade + daily log CSVs (dates, floats, ints) to skip expensive dtype inference.
- [ ] Evaluate migrating to Polars `scan_csv` for streaming ingestion with lower peak memory.
- [ ] Delay Pydantic model construction until serialization time; internally keep Arrow/NumPy columns for bulk math.

### 5. Observability & Guardrails
- [ ] Add timing/logging decorators around cache hits/misses and major callbacks to verify CPU savings.
- [ ] Track process RSS and hit rates via `/metrics` endpoint or simple logs to Render for early regression detection.
- [ ] Add unit tests for cache invalidation and strategy/date filter correctness.

## Success Criteria
- Median callback latency < 300 ms on Render free tier under typical load.
- Peak CPU usage during tab interactions < 60% of single core.
- Memory footprint stable (< 1.4 GB RSS) after multiple portfolio uploads in one session.
- Upload → analytics ready time reduced by ≥40% compared to current baseline.

## Dependencies
- Decide on caching backend (in-memory LRU vs Redis vs SQLite) based on deployment constraints.
- Ensure instrumentation/logging storage fits within Render quotas.

## Next Actions (Week 1)
1. ✅ Prototype cache service in-memory with TTL + size cap (cached analytics now generated on upload).
2. ✅ Shift Dash stores/callbacks to ID-only payloads and pull data from the cache.
3. Reuse calculator instances and strip redundant Geekistics/performance runs.
4. Profile upload path with pandas vs Polars on sample OptionOmega exports.
5. Wire up timing/logging around caches and callbacks for regression detection.
