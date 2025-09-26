"""Shared portfolio service helpers used by both FastAPI routes and Dash callbacks."""

from __future__ import annotations

import uuid
import logging
from copy import deepcopy
from typing import Any, Dict, List, Optional, Tuple

from app.calculations.geekistics import GeekisticsCalculator
from app.calculations.performance import PerformanceCalculator
from app.calculations.shared import (
    calculate_basic_portfolio_stats,
    calculate_strategy_breakdown,
)
from app.calculations.trade_analysis import TradeAnalysisCalculator
from app.data.daily_log_processor import DailyLogProcessor
from app.data.models import DailyLog, Portfolio, PortfolioStats, StrategyStats
from app.data.processor import PortfolioProcessor
from app.services.portfolio_cache import portfolio_cache, PortfolioCacheEntry

# Stateless processors / calculators reused across application surfaces.
processor = PortfolioProcessor()
daily_log_processor = DailyLogProcessor()
performance_calc = PerformanceCalculator()
trade_analysis_calc = TradeAnalysisCalculator()

# Simple in-memory store that mimics the behaviour of the FastAPI layer.
portfolios_store: Dict[str, Portfolio] = {}

logger = logging.getLogger(__name__)


def _ensure_portfolio(portfolio_like: Any) -> Portfolio:
    """Convert raw dict payloads into a Portfolio model."""
    if isinstance(portfolio_like, Portfolio):
        return portfolio_like
    if isinstance(portfolio_like, dict):
        return Portfolio(**portfolio_like)
    raise TypeError("Unsupported portfolio payload")


def _ensure_daily_log(daily_log_like: Optional[Any]) -> Optional[DailyLog]:
    if daily_log_like is None:
        return None
    if isinstance(daily_log_like, DailyLog):
        return daily_log_like
    if isinstance(daily_log_like, dict):
        return DailyLog(**daily_log_like)
    raise TypeError("Unsupported daily log payload")


def process_portfolio_upload(file_content: str, filename: str) -> Dict[str, Any]:
    """Parse a portfolio CSV, persist to the in-memory store, and return payload."""
    portfolio = processor.parse_csv(file_content, filename)
    portfolio_id = str(uuid.uuid4())
    portfolios_store[portfolio_id] = portfolio
    try:
        portfolio_cache.store_portfolio(portfolio_id, portfolio)
    except Exception as exc:  # pragma: no cover - defensive logging
        logger.warning("Failed to cache portfolio %s: %s", portfolio_id, exc)

    return {
        "portfolio_id": portfolio_id,
        "portfolio_data": portfolio.model_dump(),
        "filename": filename,
        "total_trades": portfolio.total_trades,
        "total_pl": portfolio.total_pl,
        "strategies": portfolio.strategies,
        "upload_timestamp": portfolio.upload_timestamp.isoformat(),
    }


def process_daily_log_upload(
    file_content: str, filename: str, portfolio_id: Optional[str] = None
) -> Dict[str, Any]:
    """Parse a daily log CSV, optionally attach to cached portfolio, and return summary payload."""
    daily_log = daily_log_processor.parse_csv(file_content, filename)

    if portfolio_id:
        try:
            portfolio_cache.update_daily_log(portfolio_id, daily_log)
        except Exception as exc:  # pragma: no cover - defensive logging
            logger.warning(
                "Failed to cache daily log %s for portfolio %s: %s",
                filename,
                portfolio_id,
                exc,
            )

    return {
        "daily_log_data": daily_log.model_dump(),
        "filename": filename,
        "total_entries": daily_log.total_entries,
        "date_range_start": daily_log.date_range_start.isoformat(),
        "date_range_end": daily_log.date_range_end.isoformat(),
        "final_portfolio_value": daily_log.final_portfolio_value,
        "max_drawdown": daily_log.max_drawdown,
        "upload_timestamp": daily_log.upload_timestamp.isoformat(),
    }


def calculate_portfolio_stats_dict(
    portfolio_payload: Any,
    *,
    daily_log_payload: Optional[Any] = None,
    is_filtered: bool = False,
) -> Dict[str, Any]:
    """Calculate aggregate portfolio statistics for the provided dataset."""

    portfolio_id = None
    if isinstance(portfolio_payload, dict):
        portfolio_id = portfolio_payload.get("portfolio_id")
    elif isinstance(portfolio_payload, str):
        portfolio_id = portfolio_payload

    if portfolio_id and not is_filtered:
        try:
            return portfolio_cache.get_portfolio_stats(portfolio_id)
        except KeyError:
            pass

    portfolio = _ensure_portfolio(portfolio_payload)
    trades_data = [trade.model_dump() for trade in portfolio.trades]

    daily_log = _ensure_daily_log(daily_log_payload)
    daily_log_entries = [entry.model_dump() for entry in daily_log.entries] if daily_log else None

    basic_stats = calculate_basic_portfolio_stats(trades_data)

    geek_calc = GeekisticsCalculator()
    max_drawdown = geek_calc.calculate_all_geekistics_stats(
        trades_data, daily_log_entries, is_filtered
    )["portfolio_stats"]["max_drawdown"]

    unique_dates = len({trade.get("date_opened") for trade in trades_data})
    avg_daily_pl = basic_stats["total_pl"] / unique_dates if unique_dates > 0 else 0

    total_commissions = sum(
        trade.get("opening_commissions_fees", 0) + trade.get("closing_commissions_fees", 0)
        for trade in trades_data
    )
    net_pl = basic_stats["total_pl"] - total_commissions

    stats = PortfolioStats(
        total_trades=basic_stats["total_trades"],
        total_pl=basic_stats["total_pl"],
        win_rate=basic_stats["win_rate"],
        avg_win=basic_stats["avg_win"],
        avg_loss=basic_stats["avg_loss"],
        max_win=basic_stats["max_win"],
        max_loss=basic_stats["max_loss"],
        max_drawdown=max_drawdown,
        avg_daily_pl=avg_daily_pl,
        total_commissions=total_commissions,
        net_pl=net_pl,
        profit_factor=basic_stats["profit_factor"],
    )
    return stats.model_dump()


def calculate_strategy_stats_dict(portfolio_payload: Any) -> Dict[str, Any]:
    """Calculate strategy-level statistics for the provided dataset."""
    portfolio = _ensure_portfolio(portfolio_payload)
    trades_data = [trade.model_dump() for trade in portfolio.trades]
    strategy_breakdown = calculate_strategy_breakdown(trades_data)

    strategy_stats: Dict[str, StrategyStats] = {}
    for strategy_name, stats in strategy_breakdown.items():
        strategy_stats[strategy_name] = StrategyStats(**stats)

    return {name: stats.model_dump() for name, stats in strategy_stats.items()}


def calculate_trades_dict(
    portfolio_payload: Any,
    *,
    strategy: Optional[str] = None,
    limit: Optional[int] = None,
    offset: Optional[int] = 0,
) -> Dict[str, Any]:
    portfolio = _ensure_portfolio(portfolio_payload)
    result = trade_analysis_calc.get_filtered_trades(
        portfolio, strategy=strategy, limit=limit, offset=offset
    )
    return result


def calculate_geekistics_stats_dict(request_payload: Dict[str, Any]) -> Dict[str, Any]:
    portfolio_payload = request_payload.get("portfolio_data", request_payload)
    daily_log_payload = request_payload.get("daily_log_data")
    config_data = request_payload.get("config", {})
    is_filtered = request_payload.get("is_filtered", False)

    portfolio_id = None
    if isinstance(portfolio_payload, dict):
        portfolio_id = portfolio_payload.get("portfolio_id")
    elif isinstance(portfolio_payload, str):
        portfolio_id = portfolio_payload

    if portfolio_id and not is_filtered and _is_default_geekistics_config(config_data):
        try:
            cached_stats = portfolio_cache.get_geekistics(portfolio_id)
            if cached_stats:
                return cached_stats
        except KeyError:
            pass

    portfolio = _ensure_portfolio(portfolio_payload)
    trades_data = [trade.model_dump() for trade in portfolio.trades]

    daily_log = _ensure_daily_log(daily_log_payload)
    daily_log_entries = [entry.model_dump() for entry in daily_log.entries] if daily_log else None

    geek_calc = GeekisticsCalculator(config_data)
    return geek_calc.calculate_all_geekistics_stats(trades_data, daily_log_entries, is_filtered)


def calculate_advanced_stats_dict(request_payload: Dict[str, Any]) -> Dict[str, Any]:
    return calculate_geekistics_stats_dict(request_payload)


def calculate_performance_data_dict(portfolio_payload: Any) -> Dict[str, Any]:
    portfolio = _ensure_portfolio(portfolio_payload)
    return performance_calc.calculate_performance_data(portfolio)


def calculate_margin_utilization_dict(portfolio_payload: Any) -> Dict[str, Any]:
    portfolio = _ensure_portfolio(portfolio_payload)
    return performance_calc.calculate_margin_utilization(portfolio)


def list_portfolios() -> List[Dict[str, Any]]:
    """Return metadata for all stored portfolios."""
    return [
        {
            "portfolio_id": portfolio_id,
            "filename": portfolio.filename,
            "total_trades": portfolio.total_trades,
            "total_pl": portfolio.total_pl,
            "upload_timestamp": portfolio.upload_timestamp.isoformat(),
        }
        for portfolio_id, portfolio in portfolios_store.items()
    ]


def get_portfolio_from_store(portfolio_id: str) -> Portfolio:
    if portfolio_id not in portfolios_store:
        raise KeyError(portfolio_id)
    return portfolios_store[portfolio_id]


def delete_portfolio(portfolio_id: str) -> None:
    if portfolio_id not in portfolios_store:
        raise KeyError(portfolio_id)
    del portfolios_store[portfolio_id]
    portfolio_cache.delete(portfolio_id)


def get_portfolio_stats_from_store(portfolio_id: str) -> Dict[str, Any]:
    try:
        return portfolio_cache.get_portfolio_stats(portfolio_id)
    except KeyError:
        portfolio = get_portfolio_from_store(portfolio_id)
        trades_data = [trade.model_dump() for trade in portfolio.trades]
        basic_stats = calculate_basic_portfolio_stats(trades_data)

        unique_dates = len({trade.get("date_opened") for trade in trades_data})
        avg_daily_pl = basic_stats["total_pl"] / unique_dates if unique_dates > 0 else 0

        total_commissions = sum(
            trade.get("opening_commissions_fees", 0) + trade.get("closing_commissions_fees", 0)
            for trade in trades_data
        )

        return {
            "total_trades": basic_stats["total_trades"],
            "total_pl": basic_stats["total_pl"],
            "win_rate": basic_stats["win_rate"],
            "avg_win": basic_stats["avg_win"],
            "avg_loss": basic_stats["avg_loss"],
            "max_win": basic_stats["max_win"],
            "max_loss": basic_stats["max_loss"],
            "max_drawdown": 0.0,
            "avg_daily_pl": avg_daily_pl,
            "total_commissions": total_commissions,
            "profit_factor": basic_stats["profit_factor"],
        }


def get_strategy_stats_from_store(portfolio_id: str) -> Dict[str, Any]:
    try:
        return portfolio_cache.get_strategy_stats(portfolio_id)
    except KeyError:
        portfolio = get_portfolio_from_store(portfolio_id)
        trades_data = [trade.model_dump() for trade in portfolio.trades]
        return calculate_strategy_breakdown(trades_data)


def get_trades_from_store(
    portfolio_id: str,
    *,
    strategy: Optional[str] = None,
    limit: Optional[int] = None,
    offset: Optional[int] = 0,
) -> Dict[str, Any]:
    try:
        return portfolio_cache.get_trades(
            portfolio_id, strategy=strategy, limit=limit, offset=offset
        )
    except KeyError:
        portfolio = get_portfolio_from_store(portfolio_id)
        return trade_analysis_calc.get_filtered_trades(
            portfolio, strategy=strategy, limit=limit, offset=offset
        )


def clear_portfolios_store() -> None:
    portfolios_store.clear()
    portfolio_cache.clear()


def _hydrate_cache_entry(portfolio_id: str) -> Optional[PortfolioCacheEntry]:
    try:
        return portfolio_cache.get_entry(portfolio_id)
    except KeyError:
        try:
            portfolio = get_portfolio_from_store(portfolio_id)
        except KeyError:
            logger.info("Portfolio %s not found in cache or store", portfolio_id)
            return None
        portfolio_cache.store_portfolio(portfolio_id, portfolio)
        try:
            return portfolio_cache.get_entry(portfolio_id)
        except KeyError:
            return None


def resolve_portfolio_payload(
    portfolio_like: Any,
) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
    """Return a portfolio payload dict regardless of input shape."""

    if not portfolio_like:
        return None, None

    if isinstance(portfolio_like, Portfolio):
        payload = portfolio_like.model_dump()
        return payload, getattr(portfolio_like, "portfolio_id", None)

    if isinstance(portfolio_like, dict):
        if "trades" in portfolio_like:
            return deepcopy(portfolio_like), portfolio_like.get("portfolio_id")

        portfolio_id = portfolio_like.get("portfolio_id")
        if portfolio_id:
            entry = _hydrate_cache_entry(portfolio_id)
            if entry:
                return deepcopy(entry.portfolio_payload), portfolio_id
            return None, portfolio_id

    if isinstance(portfolio_like, str):
        entry = _hydrate_cache_entry(portfolio_like)
        if entry:
            return deepcopy(entry.portfolio_payload), portfolio_like
        return None, portfolio_like

    return None, None


def resolve_daily_log_payload(
    daily_log_like: Optional[Any], portfolio_id: Optional[str] = None
) -> Optional[Dict[str, Any]]:
    """Return a daily log payload dict regardless of input shape."""

    if not daily_log_like and not portfolio_id:
        return None

    if isinstance(daily_log_like, DailyLog):
        return daily_log_like.model_dump()

    if isinstance(daily_log_like, dict) and "entries" in daily_log_like:
        return deepcopy(daily_log_like)

    if portfolio_id:
        try:
            entry = _hydrate_cache_entry(portfolio_id)
        except KeyError:
            return None
        if entry and entry.daily_log_payload:
            return deepcopy(entry.daily_log_payload)

    return None


def build_filtered_portfolio_payload(
    base_payload: Dict[str, Any], trades: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """Clone a portfolio payload and overwrite summary fields for filtered trades."""

    filtered = deepcopy(base_payload)
    filtered["trades"] = trades
    filtered["total_trades"] = len(trades)
    filtered["total_pl"] = sum(trade.get("pl", 0) for trade in trades)
    filtered["strategies"] = sorted(
        {trade.get("strategy", "") for trade in trades if trade.get("strategy")}
    )
    return filtered


def _is_default_geekistics_config(config_data: Dict[str, Any]) -> bool:
    """Check whether a geekistics config matches the default cached configuration."""

    if not config_data:
        return True

    defaults = {
        "risk_free_rate": 2.0,
        "annualization_factor": 252,
        "use_business_days_only": True,
        "confidence_level": 0.95,
        "drawdown_threshold": 0.05,
    }

    for key, default_value in defaults.items():
        if key in config_data and config_data[key] != default_value:
            return False

    extra_keys = set(config_data.keys()) - set(defaults.keys())
    return not extra_keys
