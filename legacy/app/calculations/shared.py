"""
Shared calculation utilities used across multiple features.

Common functions for portfolio analysis that are used by multiple tabs/features.
"""

import numpy as np
import pandas as pd
from typing import List, Dict
import logging

logger = logging.getLogger(__name__)


def calculate_initial_capital_from_trades(trades_data: List[Dict]) -> float:
    """Calculate initial capital from trades data by finding the first trade chronologically"""
    if not trades_data:
        return 0.0

    # Sort trades by date, time, and funds_at_close to handle simultaneous trades
    # For trades at the same time, the one with lowest funds_at_close is likely the first
    sorted_trades = sorted(
        trades_data,
        key=lambda x: (
            x.get("date_opened", ""),
            x.get("time_opened", ""),
            x.get("funds_at_close", 0),  # Secondary sort by funds (lowest first)
        ),
    )

    if not sorted_trades:
        return 0.0

    first_trade = sorted_trades[0]
    funds_at_close = first_trade.get("funds_at_close", 0)
    pl = first_trade.get("pl", 0)

    # Initial capital = Funds at close - P/L (P/L already includes all fees)
    initial_capital = funds_at_close - pl

    return initial_capital


def calculate_max_drawdown_from_portfolio_values(
    trades_data: List[Dict], initial_capital: float = None, daily_log_data: List[Dict] = None
) -> float:
    """
    Calculate maximum drawdown using end-of-day methodology.

    If daily_log_data is provided, uses exact daily portfolio values from OptionOmega.
    Otherwise, uses the actual "Funds at Close" values to track portfolio value accurately
    at each trade close, then interpolates for days between trades.
    """
    if not trades_data:
        return 0.0

    # If daily log data is available, use exact daily values
    if daily_log_data:
        return calculate_max_drawdown_from_daily_log(daily_log_data)

    # Calculate initial capital if not provided
    if initial_capital is None:
        initial_capital = calculate_initial_capital_from_trades(trades_data)

    # Convert string dates to pandas datetime for easier manipulation
    for trade in trades_data:
        trade["date_opened_dt"] = pd.to_datetime(trade.get("date_opened"))
        if trade.get("date_closed"):
            trade["date_closed_dt"] = pd.to_datetime(trade.get("date_closed"))

    # Build a timeline of actual portfolio values from "Funds at Close"
    portfolio_snapshots = []

    # Add initial capital as starting point
    if trades_data:
        first_trade_date = min(pd.to_datetime(t.get("date_opened")) for t in trades_data)
        portfolio_snapshots.append(
            {
                "date": first_trade_date - pd.Timedelta(days=1),
                "value": initial_capital,
                "source": "initial",
            }
        )

    # Add actual portfolio values at each trade close
    for trade in trades_data:
        if trade.get("date_closed") and trade.get("funds_at_close") is not None:
            portfolio_snapshots.append(
                {
                    "date": trade["date_closed_dt"],
                    "value": trade.get("funds_at_close", 0),
                    "source": "trade_close",
                }
            )

    # Sort snapshots by date
    portfolio_snapshots.sort(key=lambda x: x["date"])

    if len(portfolio_snapshots) < 2:
        return 0.0

    # Create daily timeline by interpolating between known values
    start_date = portfolio_snapshots[0]["date"]
    end_date = portfolio_snapshots[-1]["date"]
    date_range = pd.date_range(start=start_date, end=end_date, freq="D")

    # Build daily portfolio values
    daily_values = []

    for current_date in date_range:
        # Find the closest known values before and after this date
        before_snapshot = None
        after_snapshot = None

        for snapshot in portfolio_snapshots:
            if snapshot["date"] <= current_date:
                before_snapshot = snapshot
            elif after_snapshot is None:
                after_snapshot = snapshot
                break

        if before_snapshot and not after_snapshot:
            # Use the last known value
            daily_values.append((current_date, before_snapshot["value"]))
        elif before_snapshot and after_snapshot:
            # Interpolate between two known values
            days_total = (after_snapshot["date"] - before_snapshot["date"]).days
            days_elapsed = (current_date - before_snapshot["date"]).days

            if days_total > 0:
                progress = days_elapsed / days_total
                interpolated_value = (
                    before_snapshot["value"]
                    + (after_snapshot["value"] - before_snapshot["value"]) * progress
                )
                daily_values.append((current_date, interpolated_value))
            else:
                daily_values.append((current_date, before_snapshot["value"]))

    # Calculate maximum drawdown from the daily timeline
    if not daily_values:
        return 0.0

    peak = initial_capital
    max_drawdown = 0.0

    for _, portfolio_value in daily_values:
        # Update peak
        if portfolio_value > peak:
            peak = portfolio_value

        # Calculate drawdown from current peak
        if peak > 0:
            drawdown = (peak - portfolio_value) / peak * 100
            max_drawdown = max(max_drawdown, drawdown)

    return max_drawdown


def calculate_daily_pnl_timeline(
    trades_data: List[Dict], initial_capital: float = None, daily_log_data: List[Dict] = None
) -> List[Dict]:
    """
    Calculate daily P&L using actual portfolio values.

    If daily_log_data is provided, uses exact daily values from OptionOmega.
    Otherwise, uses actual portfolio values from "Funds at Close" and interpolation.

    Returns a list of daily P&L entries with date, portfolio value, and daily P&L.
    """
    if not trades_data:
        return []

    # If daily log data is available, use exact daily values
    if daily_log_data:
        return convert_daily_log_to_timeline(daily_log_data)

    # Calculate initial capital if not provided
    if initial_capital is None:
        initial_capital = calculate_initial_capital_from_trades(trades_data)

    # Convert string dates to pandas datetime
    for trade in trades_data:
        if not hasattr(trade, "date_closed_dt"):
            trade["date_opened_dt"] = pd.to_datetime(trade.get("date_opened"))
            if trade.get("date_closed"):
                trade["date_closed_dt"] = pd.to_datetime(trade.get("date_closed"))

    # Build a timeline of actual portfolio values from "Funds at Close"
    portfolio_snapshots = []

    # Add initial capital as starting point
    if trades_data:
        first_trade_date = min(pd.to_datetime(t.get("date_opened")) for t in trades_data)
        portfolio_snapshots.append(
            {
                "date": first_trade_date - pd.Timedelta(days=1),
                "value": initial_capital,
                "source": "initial",
            }
        )

    # Add actual portfolio values at each trade close
    for trade in trades_data:
        if trade.get("date_closed") and trade.get("funds_at_close") is not None:
            portfolio_snapshots.append(
                {
                    "date": trade.get("date_closed_dt", pd.to_datetime(trade.get("date_closed"))),
                    "value": trade.get("funds_at_close", 0),
                    "source": "trade_close",
                }
            )

    # Sort snapshots by date
    portfolio_snapshots.sort(key=lambda x: x["date"])

    if len(portfolio_snapshots) < 2:
        return []

    # Create daily timeline
    start_date = portfolio_snapshots[0]["date"]
    end_date = portfolio_snapshots[-1]["date"]
    date_range = pd.date_range(start=start_date, end=end_date, freq="D")

    # Build daily P&L timeline
    daily_pnl = []
    prev_value = initial_capital

    for current_date in date_range:
        # Find the closest known values before and after this date
        before_snapshot = None
        after_snapshot = None

        for snapshot in portfolio_snapshots:
            if snapshot["date"] <= current_date:
                before_snapshot = snapshot
            elif after_snapshot is None:
                after_snapshot = snapshot
                break

        if before_snapshot and not after_snapshot:
            # Use the last known value
            current_value = before_snapshot["value"]
        elif before_snapshot and after_snapshot:
            # Interpolate between two known values
            days_total = (after_snapshot["date"] - before_snapshot["date"]).days
            days_elapsed = (current_date - before_snapshot["date"]).days

            if days_total > 0:
                progress = days_elapsed / days_total
                current_value = (
                    before_snapshot["value"]
                    + (after_snapshot["value"] - before_snapshot["value"]) * progress
                )
            else:
                current_value = before_snapshot["value"]
        else:
            current_value = prev_value

        daily_change = current_value - prev_value
        daily_pnl.append(
            {
                "date": current_date.strftime("%Y-%m-%d"),
                "portfolio_value": current_value,
                "daily_pnl": daily_change,
                "cumulative_pnl": current_value - initial_capital,
            }
        )
        prev_value = current_value

    return daily_pnl


def calculate_basic_portfolio_stats(trades_data: List[Dict]) -> Dict[str, float]:
    """
    Calculate basic portfolio statistics that are commonly used across features.
    Returns a dictionary with basic stats like total P/L, win rate, etc.
    """
    if not trades_data:
        return {
            "total_trades": 0,
            "total_pl": 0.0,
            "win_rate": 0.0,
            "avg_win": 0.0,
            "avg_loss": 0.0,
            "max_win": 0.0,
            "max_loss": 0.0,
            "profit_factor": 0.0,
        }

    # Basic metrics
    total_trades = len(trades_data)
    total_pl = sum(trade.get("pl", 0) for trade in trades_data)

    # Win/Loss analysis
    wins = [trade.get("pl", 0) for trade in trades_data if trade.get("pl", 0) > 0]
    losses = [trade.get("pl", 0) for trade in trades_data if trade.get("pl", 0) < 0]

    win_rate = len(wins) / total_trades if total_trades > 0 else 0
    avg_win = np.mean(wins) if wins else 0
    avg_loss = np.mean(losses) if losses else 0
    max_win = max(wins) if wins else 0
    max_loss = min(losses) if losses else 0

    # Profit factor
    total_wins = sum(wins) if wins else 0
    total_losses = abs(sum(losses)) if losses else 1  # Avoid division by zero
    profit_factor = total_wins / total_losses if total_losses > 0 else float("inf")

    return {
        "total_trades": total_trades,
        "total_pl": total_pl,
        "win_rate": win_rate,
        "avg_win": avg_win,
        "avg_loss": avg_loss,
        "max_win": max_win,
        "max_loss": max_loss,
        "profit_factor": profit_factor,
    }


def calculate_strategy_breakdown(trades_data: List[Dict]) -> Dict[str, Dict[str, float]]:
    """
    Calculate statistics for each strategy in the portfolio.
    Returns a dictionary with strategy names as keys and stats as values.
    """
    if not trades_data:
        return {}

    # Group trades by strategy
    strategies = {}
    for trade in trades_data:
        strategy = trade.get("strategy", "Unknown")
        if strategy not in strategies:
            strategies[strategy] = []
        strategies[strategy].append(trade)

    strategy_stats = {}
    for strategy_name, strategy_trades in strategies.items():
        stats = calculate_basic_portfolio_stats(strategy_trades)
        strategy_stats[strategy_name] = {
            "strategy_name": strategy_name,
            "trade_count": stats["total_trades"],
            "total_pl": stats["total_pl"],
            "win_rate": stats["win_rate"],
            "avg_win": stats["avg_win"],
            "avg_loss": stats["avg_loss"],
            "max_win": stats["max_win"],
            "max_loss": stats["max_loss"],
            "success_rate": stats["win_rate"],  # Same as win_rate for now
            "profit_factor": stats["profit_factor"],
        }

    return strategy_stats


def calculate_max_drawdown_from_daily_log(daily_log_data: List[Dict]) -> float:
    """
    Calculate maximum drawdown using exact daily log data from OptionOmega.

    This provides the most accurate drawdown calculation since it uses
    the exact end-of-day portfolio values.
    """
    if not daily_log_data:
        return 0.0

    # Daily log already contains drawdown_pct values
    # Find the maximum drawdown percentage
    max_drawdown = 0.0

    for entry in daily_log_data:
        drawdown_pct = abs(entry.get("drawdown_pct", 0))  # Make sure it's positive
        max_drawdown = max(max_drawdown, drawdown_pct)

    return max_drawdown


def convert_daily_log_to_timeline(daily_log_data: List[Dict]) -> List[Dict]:
    """
    Convert daily log data to the timeline format expected by other functions.

    Returns a list of daily P&L entries with date, portfolio value, and daily P&L.
    """
    if not daily_log_data:
        return []

    # Sort by date to ensure proper ordering
    sorted_entries = sorted(daily_log_data, key=lambda x: pd.to_datetime(x.get("date")))

    timeline = []
    prev_value = None

    for entry in sorted_entries:
        current_value = entry.get("net_liquidity", 0)
        daily_change = entry.get("daily_pl", 0)

        # If this is the first entry and we don't have previous value,
        # calculate it from current value and daily P&L
        if prev_value is None:
            prev_value = current_value - daily_change

        timeline.append(
            {
                "date": entry.get("date"),
                "portfolio_value": current_value,
                "daily_pnl": daily_change,
                "cumulative_pnl": current_value
                - (
                    sorted_entries[0].get("net_liquidity", 0) - sorted_entries[0].get("daily_pl", 0)
                ),
            }
        )

        prev_value = current_value

    return timeline


def get_initial_capital_from_daily_log(daily_log_data: List[Dict]) -> float:
    """
    Calculate initial capital from daily log data.

    Uses the first entry's net liquidity minus its daily P&L.
    """
    if not daily_log_data:
        return 0.0

    # Sort by date to get the first entry
    sorted_entries = sorted(daily_log_data, key=lambda x: pd.to_datetime(x.get("date")))

    if not sorted_entries:
        return 0.0

    first_entry = sorted_entries[0]
    net_liquidity = first_entry.get("net_liquidity", 0)
    daily_pl = first_entry.get("daily_pl", 0)

    # Initial capital = Net Liquidity - Daily P&L
    return net_liquidity - daily_pl
