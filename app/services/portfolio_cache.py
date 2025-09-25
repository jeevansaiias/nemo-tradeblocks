"""In-memory cache for portfolio analytics payloads."""

from __future__ import annotations

import time
import logging
from dataclasses import dataclass, field
from threading import RLock
from collections import OrderedDict
from typing import Any, Dict, List, Optional

from app.calculations.geekistics import GeekisticsCalculator
from app.calculations.performance import PerformanceCalculator
from app.calculations.shared import (
    calculate_basic_portfolio_stats,
    calculate_strategy_breakdown,
)
from app.calculations.trade_analysis import TradeAnalysisCalculator
from app.data.models import Portfolio, DailyLog

logger = logging.getLogger(__name__)


@dataclass
class PortfolioCacheEntry:
    """Container for cached portfolio analytics."""

    portfolio: Portfolio
    trades_data: List[Dict[str, Any]]
    geekistics: Dict[str, Any]
    portfolio_stats: Dict[str, Any]
    performance: Dict[str, Any]
    margin: Dict[str, Any]
    strategy_stats: Dict[str, Any]
    trade_lookup: Dict[str, Any]
    created_at: float = field(default_factory=time.time)
    daily_log_data: Optional[List[Dict[str, Any]]] = None


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
        return self.get_entry(portfolio_id).portfolio_stats

    def get_strategy_stats(self, portfolio_id: str) -> Dict[str, Any]:
        return self.get_entry(portfolio_id).strategy_stats

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
    # Internal helpers
    # ------------------------------------------------------------------
    def _build_entry(
        self, portfolio: Portfolio, daily_log: Optional[DailyLog]
    ) -> PortfolioCacheEntry:
        trades_data = [trade.model_dump() for trade in portfolio.trades]
        daily_log_data = (
            [entry.model_dump() for entry in daily_log.entries] if daily_log is not None else None
        )

        geekistics: Dict[str, Any] = {}
        try:
            geekistics = GeekisticsCalculator().calculate_all_geekistics_stats(
                trades_data, daily_log_data
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
            trades_data=trades_data,
            geekistics=geekistics,
            portfolio_stats=portfolio_stats,
            performance=performance,
            margin=margin,
            strategy_stats=strategy_stats,
            trade_lookup={"trades": trades_data},
            daily_log_data=daily_log_data,
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
