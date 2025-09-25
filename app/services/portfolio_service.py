"""Shared portfolio service helpers used by both FastAPI routes and Dash callbacks."""

from __future__ import annotations

import uuid
import logging
from typing import Any, Dict, List, Optional

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
from app.services.portfolio_cache import portfolio_cache

# Stateless processors / calculators reused across application surfaces.
processor = PortfolioProcessor()
daily_log_processor = DailyLogProcessor()
performance_calc = PerformanceCalculator()
trade_analysis_calc = TradeAnalysisCalculator()

# Simple in-memory store that mimics the behaviour of the FastAPI layer.
portfolios_store: Dict[str, Portfolio] = {}


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
        logger = logging.getLogger(__name__)
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


def process_daily_log_upload(file_content: str, filename: str) -> Dict[str, Any]:
    """Parse a daily log CSV and return summary payload."""
    daily_log = daily_log_processor.parse_csv(file_content, filename)
    response = {
        "daily_log_data": daily_log.model_dump(),
        "filename": filename,
        "total_entries": daily_log.total_entries,
        "date_range_start": daily_log.date_range_start.isoformat(),
        "date_range_end": daily_log.date_range_end.isoformat(),
        "final_portfolio_value": daily_log.final_portfolio_value,
        "max_drawdown": daily_log.max_drawdown,
        "upload_timestamp": daily_log.upload_timestamp.isoformat(),
    }

    # Cache integration will require portfolio context; placeholder hook retained.
    return response


def calculate_portfolio_stats_dict(
    portfolio_payload: Any,
    *,
    daily_log_payload: Optional[Any] = None,
    is_filtered: bool = False,
) -> Dict[str, Any]:
    """Calculate aggregate portfolio statistics for the provided dataset."""
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
