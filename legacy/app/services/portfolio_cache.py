"""In-memory cache for portfolio analytics payloads."""

from __future__ import annotations

import time
import logging
import json
from dataclasses import dataclass, field
from threading import RLock
from collections import OrderedDict
from typing import Any, Dict, Iterable, List, Optional, Tuple
from datetime import date, datetime, time as datetime_time, timedelta
from decimal import Decimal
from copy import deepcopy

import numpy as np
from pydantic import BaseModel

from app.calculations.geekistics import GeekisticsCalculator
from app.calculations.performance import PerformanceCalculator
from app.calculations.shared import (
    calculate_basic_portfolio_stats,
    calculate_strategy_breakdown,
)
from app.calculations.trade_analysis import TradeAnalysisCalculator
from app.data.models import Portfolio, DailyLog, Trade

logger = logging.getLogger(__name__)


def _json_ready(value: Any) -> Any:
    """Convert complex values to JSON-serialisable primitives."""

    if value is None:
        return None

    if isinstance(value, (str, bool, int, float)):
        return value

    if isinstance(value, Decimal):
        return float(value)

    if isinstance(value, (datetime, date)):
        return value.isoformat()

    if isinstance(value, datetime_time):
        return value.isoformat()

    if isinstance(value, timedelta):
        return value.total_seconds()

    if isinstance(value, BaseModel):
        try:
            return _json_ready(value.model_dump(mode="json"))
        except TypeError:
            return _json_ready(value.model_dump())

    if isinstance(value, np.generic):
        return _json_ready(value.item())

    if isinstance(value, dict):
        return {key: _json_ready(val) for key, val in value.items()}

    if isinstance(value, (list, tuple, set)):
        return [_json_ready(item) for item in value]

    if hasattr(value, "tolist"):
        try:
            return _json_ready(value.tolist())
        except Exception:  # pragma: no cover - defensive fallback
            pass

    return value


@dataclass
class PortfolioCacheEntry:
    """Container for cached portfolio analytics."""

    portfolio: Portfolio
    portfolio_payload: Dict[str, Any]
    trades_data: List[Dict[str, Any]]
    geekistics: Dict[str, Any]
    portfolio_stats: Dict[str, Any]
    performance: Dict[str, Any]
    margin: Dict[str, Any]
    strategy_stats: Dict[str, Any]
    trade_lookup: Dict[str, Any]
    daily_log: Optional[DailyLog] = None
    daily_log_payload: Optional[Dict[str, Any]] = None
    created_at: float = field(default_factory=time.time)
    performance_blocks_cache: "OrderedDict[str, PerformanceBlocksCacheRecord]" = field(
        default_factory=OrderedDict
    )


@dataclass
class PerformanceBlocksCacheRecord:
    """Cached dataset for Performance Blocks visualisations."""

    dataset: Dict[str, Any]
    trades: List[Trade]
    filters: Dict[str, Any]
    created_at: float = field(default_factory=time.time)
    last_used: float = field(default_factory=time.time)


class PortfolioCache:
    """Simple LRU cache with TTL for portfolio analytics."""

    def __init__(self, max_entries: int = 8, ttl_seconds: int = 4 * 60 * 60) -> None:
        self._entries: "OrderedDict[str, PortfolioCacheEntry]" = OrderedDict()
        self._max_entries = max_entries
        self._ttl_seconds = ttl_seconds
        self._lock = RLock()
        self._performance_calc = PerformanceCalculator()
        self._trade_calc = TradeAnalysisCalculator()

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------
    def store_portfolio(
        self,
        portfolio_id: str,
        portfolio: Portfolio,
        daily_log: Optional[DailyLog] = None,
    ) -> None:
        """Compute analytics for the portfolio and cache the results."""
        with self._lock:
            entry = self._build_entry(portfolio, daily_log)
            entry.portfolio_payload.setdefault("portfolio_id", portfolio_id)
            if entry.daily_log_payload is not None:
                entry.daily_log_payload.setdefault("portfolio_id", portfolio_id)
            self._entries.pop(portfolio_id, None)
            self._entries[portfolio_id] = entry
            self._evict_expired_locked()
            self._evict_excess_locked()

    def update_daily_log(self, portfolio_id: str, daily_log: DailyLog) -> None:
        """Attach a daily log to an existing cache entry and refresh analytics."""
        with self._lock:
            entry = self._entries.get(portfolio_id)
            if not entry:
                return
            portfolio = entry.portfolio
            refreshed = self._build_entry(portfolio, daily_log)
            refreshed.portfolio_payload.setdefault("portfolio_id", portfolio_id)
            if refreshed.daily_log_payload is not None:
                refreshed.daily_log_payload.setdefault("portfolio_id", portfolio_id)
            self._entries[portfolio_id] = refreshed

    def get_entry(self, portfolio_id: str) -> PortfolioCacheEntry:
        with self._lock:
            self._evict_expired_locked()
            entry = self._entries.get(portfolio_id)
            if not entry:
                raise KeyError(portfolio_id)
            self._entries.move_to_end(portfolio_id)
            return entry

    def get_portfolio(self, portfolio_id: str) -> Portfolio:
        return self.get_entry(portfolio_id).portfolio

    def get_portfolio_stats(self, portfolio_id: str) -> Dict[str, Any]:
        return deepcopy(self.get_entry(portfolio_id).portfolio_stats)

    def get_strategy_stats(self, portfolio_id: str) -> Dict[str, Any]:
        return deepcopy(self.get_entry(portfolio_id).strategy_stats)

    def get_geekistics(self, portfolio_id: str) -> Dict[str, Any]:
        return deepcopy(self.get_entry(portfolio_id).geekistics)

    def get_performance_data(self, portfolio_id: str) -> Dict[str, Any]:
        return deepcopy(self.get_entry(portfolio_id).performance)

    def get_margin_data(self, portfolio_id: str) -> Dict[str, Any]:
        return deepcopy(self.get_entry(portfolio_id).margin)

    def get_performance_blocks_dataset(
        self,
        portfolio_id: str,
        *,
        strategies: Optional[Iterable[str]] = None,
        date_range: Optional[str] = None,
        rom_ma_period: Optional[Any] = None,
        rolling_metric_type: Optional[str] = None,
    ) -> Tuple[Dict[str, Any], List[Trade], str, bool]:
        """Return cached Performance Blocks dataset, computing it if missing.

        Returns a tuple of (dataset, trades, cache_key, from_cache).
        """

        normalized_strategies: Tuple[str, ...] = ()
        if strategies:
            normalized_strategies = tuple(sorted({s for s in strategies if s}))

        normalized_date_range = (date_range or "all").lower()
        normalized_rom_period = str(rom_ma_period or "30")
        normalized_metric = (rolling_metric_type or "win_rate").lower()

        cache_key = json.dumps(
            {
                "portfolio_id": portfolio_id,
                "strategies": normalized_strategies,
                "date_range": normalized_date_range,
                "rom_ma_period": normalized_rom_period,
                "rolling_metric_type": normalized_metric,
            },
            sort_keys=True,
        )

        with self._lock:
            self._evict_expired_locked()
            entry = self._entries.get(portfolio_id)
            if not entry:
                raise KeyError(portfolio_id)

            record = entry.performance_blocks_cache.get(cache_key)
            if record:
                record.last_used = time.time()
                entry.performance_blocks_cache.move_to_end(cache_key)
                return deepcopy(record.dataset), list(record.trades), cache_key, True

            # Copy reference to portfolio for computation outside lock
            portfolio = entry.portfolio

        trades = self._filter_trades_for_performance(
            list(portfolio.trades), normalized_strategies, normalized_date_range
        )

        dataset = self._build_performance_blocks_dataset(trades)

        record = PerformanceBlocksCacheRecord(
            dataset=deepcopy(dataset),
            trades=list(trades),
            filters={
                "strategies": list(normalized_strategies),
                "date_range": normalized_date_range,
                "rom_ma_period": normalized_rom_period,
                "rolling_metric_type": normalized_metric,
            },
        )

        with self._lock:
            entry = self._entries.get(portfolio_id)
            if not entry:
                raise KeyError(portfolio_id)
        entry.performance_blocks_cache[cache_key] = record
        entry.performance_blocks_cache.move_to_end(cache_key)
        self._trim_performance_blocks_cache(entry)

        return deepcopy(dataset), list(trades), cache_key, False

    def get_trades(
        self,
        portfolio_id: str,
        *,
        strategy: Optional[str] = None,
        limit: Optional[int] = None,
        offset: Optional[int] = 0,
    ) -> Dict[str, Any]:
        entry = self.get_entry(portfolio_id)
        try:
            portfolio = entry.portfolio
            return self._trade_calc.get_filtered_trades(
                portfolio, strategy=strategy, limit=limit, offset=offset
            )
        except Exception as exc:  # pragma: no cover - defensive
            logger.error("Trade filter failed for %s: %s", portfolio_id, exc)
            raise

    def delete(self, portfolio_id: str) -> None:
        with self._lock:
            self._entries.pop(portfolio_id, None)

    def clear(self) -> None:
        with self._lock:
            self._entries.clear()

    # ------------------------------------------------------------------
    # Internal helpers for Performance Blocks caching
    # ------------------------------------------------------------------

    def _trim_performance_blocks_cache(self, entry: PortfolioCacheEntry) -> None:
        """Keep per-portfolio Performance Blocks cache bounded."""

        max_entries = 16
        while len(entry.performance_blocks_cache) > max_entries:
            entry.performance_blocks_cache.popitem(last=False)

    def _filter_trades_for_performance(
        self,
        trades: List[Trade],
        strategies: Tuple[str, ...],
        date_range: str,
    ) -> List[Trade]:
        if not trades:
            return []

        filtered = trades
        if strategies:
            selected = set(strategies)
            filtered = [trade for trade in filtered if trade.strategy in selected]

        if date_range and date_range not in {"all", "", None}:
            latest_date = max((trade.date_opened for trade in filtered), default=None)
            if not latest_date:
                latest_date = max((trade.date_opened for trade in trades), default=date.today())

            start_date: Optional[date] = None
            if date_range == "ytd":
                start_date = date(latest_date.year, 1, 1)
            elif date_range == "1y":
                start_date = latest_date - timedelta(days=365)
            elif date_range == "6m":
                start_date = latest_date - timedelta(days=182)
            elif date_range == "3m":
                start_date = latest_date - timedelta(days=91)
            elif date_range == "1m":
                start_date = latest_date - timedelta(days=30)

            if start_date:
                filtered = [trade for trade in filtered if trade.date_opened >= start_date]

        return filtered

    def _build_performance_blocks_dataset(self, trades: List[Trade]) -> Dict[str, Any]:
        if not trades:
            return {
                "equity_data": {},
                "distribution_data": {},
                "streak_data": {},
                "monthly_data": {},
                "sequence_data": {},
                "rom_data": {},
                "rolling_data": {},
                "trades": [],
            }

        calc = self._performance_calc

        equity_data = calc.calculate_enhanced_cumulative_equity(trades)
        distribution_data = calc.calculate_trade_distributions(trades)
        streak_data = calc.calculate_streak_distributions(trades)
        monthly_data = calc.calculate_monthly_heatmap_data(trades)
        sequence_data = calc.calculate_trade_sequence_data(trades)
        rom_data = calc.calculate_rom_over_time(trades)
        rolling_data = calc.calculate_rolling_metrics(trades)

        dataset = {
            "equity_data": equity_data,
            "distribution_data": distribution_data,
            "streak_data": streak_data,
            "monthly_data": monthly_data,
            "sequence_data": sequence_data,
            "rom_data": rom_data,
            "rolling_data": rolling_data,
            "trades": [trade.model_dump(mode="json") for trade in trades],
        }

        return _json_ready(dataset)

        return _json_ready(dataset)

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------
    def _build_entry(
        self, portfolio: Portfolio, daily_log: Optional[DailyLog]
    ) -> PortfolioCacheEntry:
        trades_data = [trade.model_dump() for trade in portfolio.trades]
        portfolio_payload = portfolio.model_dump()
        daily_log_payload = daily_log.model_dump() if daily_log is not None else None

        geekistics: Dict[str, Any] = {}
        try:
            geekistics = GeekisticsCalculator().calculate_all_geekistics_stats(
                trades_data, daily_log_payload.get("entries") if daily_log_payload else None
            )
        except Exception as exc:  # pragma: no cover - defensive
            logger.warning("Geekistics precompute failed: %s", exc)

        portfolio_stats: Dict[str, Any] = {}
        if geekistics:
            portfolio_stats = geekistics.get("portfolio_stats", {})

        if not portfolio_stats:
            try:
                basic_stats = calculate_basic_portfolio_stats(trades_data)
                unique_dates = len({trade.get("date_opened") for trade in trades_data})
                avg_daily_pl = basic_stats["total_pl"] / unique_dates if unique_dates else 0
                total_commissions = sum(
                    trade.get("opening_commissions_fees", 0)
                    + trade.get("closing_commissions_fees", 0)
                    for trade in trades_data
                )
                portfolio_stats = {
                    "total_trades": basic_stats["total_trades"],
                    "total_pl": basic_stats["total_pl"],
                    "win_rate": basic_stats["win_rate"],
                    "avg_win": basic_stats["avg_win"],
                    "avg_loss": basic_stats["avg_loss"],
                    "max_win": basic_stats["max_win"],
                    "max_loss": basic_stats["max_loss"],
                    "avg_daily_pl": avg_daily_pl,
                    "total_commissions": total_commissions,
                    "net_pl": basic_stats["total_pl"] - total_commissions,
                    "profit_factor": basic_stats["profit_factor"],
                }
            except Exception as exc:  # pragma: no cover - defensive
                logger.warning("Basic stats fallback failed: %s", exc)

        performance: Dict[str, Any] = {}
        margin: Dict[str, Any] = {}
        try:
            performance = self._performance_calc.calculate_performance_data(portfolio)
            margin = self._performance_calc.calculate_margin_utilization(portfolio)
        except Exception as exc:  # pragma: no cover - defensive
            logger.warning("Performance precompute failed: %s", exc)

        strategy_stats: Dict[str, Any] = {}
        try:
            strategy_stats = calculate_strategy_breakdown(trades_data)
        except Exception as exc:  # pragma: no cover - defensive
            logger.warning("Strategy breakdown failed: %s", exc)

        return PortfolioCacheEntry(
            portfolio=portfolio,
            portfolio_payload=portfolio_payload,
            trades_data=trades_data,
            geekistics=geekistics,
            portfolio_stats=portfolio_stats,
            performance=performance,
            margin=margin,
            strategy_stats=strategy_stats,
            trade_lookup={"trades": trades_data},
            daily_log=daily_log,
            daily_log_payload=daily_log_payload,
        )

    def _evict_expired_locked(self) -> None:
        if self._ttl_seconds <= 0:
            return
        now = time.time()
        expired_keys = [
            key
            for key, entry in self._entries.items()
            if now - entry.created_at > self._ttl_seconds
        ]
        for key in expired_keys:
            self._entries.pop(key, None)

    def _evict_excess_locked(self) -> None:
        while len(self._entries) > self._max_entries:
            key, _ = self._entries.popitem(last=False)
            logger.debug("Evicted portfolio %s due to cache size limit", key)


# Shared cache instance for application modules
portfolio_cache = PortfolioCache()
