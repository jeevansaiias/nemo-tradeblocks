# NemoBlocks (TradeBlocks fork)

A beginner-friendly, browser-based analytics workspace for options trading. Upload your trade CSVs, explore performance, test exit rules, and keep everything private in your browser storage.

## What you get
- **Blocks:** Import trade (and optional daily) CSVs into named blocks you can activate and revisit.
- **Performance & Excursion:** Equity curves, returns, MFE/MAE scatter, exit reasons, premium efficiency.
- **TP/SL Optimizer:** Simulate take-profit/stop-loss grids using existing MFE/MAE data (no reprocessing).
- **Custom tools:** TP Optimizer (MAE/MFE), P/L Calendar, correlation matrix, risk simulator, position sizing.
- **Client-side data:** Stored in IndexedDB; nothing is sent to a server.

## Quick start
Prereqs: Node.js 20+ and npm.

```bash
git clone https://github.com/jeevansaiias/nemo-tradeblocks.git
cd nemo-tradeblocks
npm install
npm run dev
```

Open http://localhost:3000 (the root redirects to `/blocks`).

## Import your data
1) Go to **Block Management** → **New Block**.  
2) Upload a trade log CSV (required) and optional daily log.  
   - Trade log headers follow OptionOmega exports (e.g., `Date Opened`, `Time Opened`, `P/L`, `Strategy`, `Opening Commissions + Fees`).  
   - Daily log headers (optional): `Date`, `Net Liquidity`, `P/L`, `P/L %`, `Drawdown %`.  
3) Activate the block to see stats everywhere.  
4) Data lives in your browser; clear IndexedDB/localStorage to reset.

## Key views
- **Blocks / Block Stats:** Manage blocks, view high-level cards.
- **Performance Blocks:** Equity, drawdowns, return distribution, streaks, ROM, premium efficiency, excursion charts.
- **TP/SL Optimizer (MFE/MAE edition):** In Performance → “TP/SL Optimizer” tab. Adjust TP/SL grids, pick basis (margin/premium), compare scenarios.
- **TP Optimizer (MAE/MFE):** Import CSVs, tune take-profit targets.
- **TP/SL Optimizer Page:** Dedicated route `/tp-sl-optimizer` to run what-if exit rules outside the main performance tab.
- **P/L Calendar:** Monthly and yearly P/L.
- **Risk & Sizing:** Monte Carlo simulator, position sizing, correlation matrix.

## Scripts
- `npm run dev` — start the dev server (Turbopack).
- `npm run build` / `npm start` — production build and serve.
- `npm run lint` — ESLint.
- `npm test` — Jest tests (uses fake-indexeddb).
- `npm run test:watch`, `npm run test:coverage` — test helpers.

## Project layout (high level)
- `app/(platform)/` — main pages (blocks, performance, calendar, TP optimizers, risk, sizing).
- `components/` — shadcn/ui wrappers and analytics widgets (charts, panels).
- `lib/` — calculations (portfolio stats, MFE/MAE, TP/SL sim), DB adapters (IndexedDB), stores (Zustand), models, utilities.
- `tests/` — unit/integration tests with fixtures under `tests/data/`.

## Troubleshooting
- **No charts/data:** Ensure a block is active and has a trade CSV.  
- **Build fails on missing deps:** Run `npm install` to pull @next/swc binaries.  
- **Want to reset data:** Clear IndexedDB + `localStorage` keys `nemoblocks-*`.

Happy analyzing! Contributions welcome—open a feature branch, add tests where it makes sense, and run `npm run lint` / `npm test` before PRs.
