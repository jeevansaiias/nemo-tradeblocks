"""
Performance Charts Calculator

Calculates data for performance charts and visualizations.
Enhanced with comprehensive analysis methods for Performance Blocks.
"""

import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional, Tuple
from collections import defaultdict, Counter
import logging

from app.data.models import Portfolio, Trade

logger = logging.getLogger(__name__)


class PerformanceCalculator:
    """Calculator for performance charts and visualizations"""

    def __init__(self):
        """Initialize calculator with caching mechanism."""
        self._cache = {}
        self._cache_enabled = True

    def _get_cache_key(self, method_name: str, *args, **kwargs) -> str:
        """Generate cache key for method and arguments."""
        import hashlib

        # Create a string representation of args and kwargs
        cache_str = f"{method_name}_{str(args)}_{str(sorted(kwargs.items()))}"
        return hashlib.md5(cache_str.encode()).hexdigest()

    def _get_cached_result(self, method_name: str, *args, **kwargs):
        """Get cached result if available."""
        if not self._cache_enabled:
            return None

        cache_key = self._get_cache_key(method_name, *args, **kwargs)
        return self._cache.get(cache_key)

    def _cache_result(self, method_name: str, result: Any, *args, **kwargs):
        """Cache method result."""
        if not self._cache_enabled:
            return

        cache_key = self._get_cache_key(method_name, *args, **kwargs)
        self._cache[cache_key] = result

        # Simple cache size management - keep last 100 entries
        if len(self._cache) > 100:
            # Remove oldest entries
            oldest_keys = list(self._cache.keys())[:20]
            for key in oldest_keys:
                del self._cache[key]

    def clear_cache(self):
        """Clear all cached results."""
        self._cache.clear()

    def disable_cache(self):
        """Disable caching."""
        self._cache_enabled = False

    def enable_cache(self):
        """Enable caching."""
        self._cache_enabled = True

    def calculate_performance_data(self, portfolio: Portfolio) -> Dict[str, Any]:
        """Calculate performance data for charts"""
        try:
            # Sort trades by date
            sorted_trades = sorted(portfolio.trades, key=lambda x: (x.date_opened, x.time_opened))

            # Calculate cumulative P/L
            cumulative_pl = []
            daily_pl = defaultdict(float)
            running_total = 0

            for trade in sorted_trades:
                running_total += trade.pl
                date_key = trade.date_opened.isoformat()
                daily_pl[date_key] += trade.pl
                cumulative_pl.append(
                    {"date": date_key, "cumulative_pl": running_total, "trade_pl": trade.pl}
                )

            # Calculate drawdown
            peak = 0
            drawdown_data = []
            for entry in cumulative_pl:
                if entry["cumulative_pl"] > peak:
                    peak = entry["cumulative_pl"]
                drawdown = (entry["cumulative_pl"] - peak) / peak if peak != 0 else 0
                drawdown_data.append({"date": entry["date"], "drawdown": drawdown, "peak": peak})

            # Monthly aggregation
            monthly_pl = defaultdict(float)
            for date_str, pl in daily_pl.items():
                month_key = date_str[:7]  # YYYY-MM
                monthly_pl[month_key] += pl

            monthly_data = [{"month": month, "pl": pl} for month, pl in monthly_pl.items()]

            # Strategy performance
            strategy_performance = defaultdict(float)
            strategy_trade_count = defaultdict(int)

            for trade in portfolio.trades:
                strategy_performance[trade.strategy] += trade.pl
                strategy_trade_count[trade.strategy] += 1

            strategy_data = []
            for strategy, total_pl in strategy_performance.items():
                strategy_data.append(
                    {
                        "strategy": strategy,
                        "total_pl": total_pl,
                        "trade_count": strategy_trade_count[strategy],
                        "avg_pl_per_trade": (
                            total_pl / strategy_trade_count[strategy]
                            if strategy_trade_count[strategy] > 0
                            else 0
                        ),
                    }
                )

            return {
                "cumulative_pl": cumulative_pl,
                "drawdown": drawdown_data,
                "daily_pl": [{"date": date, "pl": pl} for date, pl in daily_pl.items()],
                "monthly_pl": monthly_data,
                "strategy_performance": strategy_data,
            }

        except Exception as e:
            logger.error(f"Error calculating performance data: {str(e)}")
            raise

    def calculate_margin_utilization(self, portfolio: Portfolio) -> Dict[str, Any]:
        """Calculate margin utilization metrics"""
        try:
            # Sort trades by date
            sorted_trades = sorted(portfolio.trades, key=lambda x: (x.date_opened, x.time_opened))

            margin_data = []
            peak_margin = 0
            total_funds_data = []

            for trade in sorted_trades:
                margin_data.append(
                    {
                        "date": trade.date_opened.isoformat(),
                        "margin_req": trade.margin_req,
                        "funds_at_close": trade.funds_at_close,
                        "utilization": (
                            (trade.margin_req / trade.funds_at_close) * 100
                            if trade.funds_at_close > 0
                            else 0
                        ),
                    }
                )

                if trade.margin_req > peak_margin:
                    peak_margin = trade.margin_req

                total_funds_data.append(
                    {"date": trade.date_opened.isoformat(), "funds": trade.funds_at_close}
                )

            # Calculate average utilization
            avg_utilization = np.mean([entry["utilization"] for entry in margin_data])
            max_utilization = (
                max([entry["utilization"] for entry in margin_data]) if margin_data else 0
            )

            # Margin efficiency (P/L per dollar of margin)
            total_margin_used = sum([trade.margin_req for trade in portfolio.trades])
            total_pl = sum([trade.pl for trade in portfolio.trades])
            margin_efficiency = total_pl / total_margin_used if total_margin_used > 0 else 0

            return {
                "margin_timeline": margin_data,
                "funds_timeline": total_funds_data,
                "peak_margin": peak_margin,
                "avg_utilization": avg_utilization,
                "max_utilization": max_utilization,
                "margin_efficiency": margin_efficiency,
                "total_margin_used": total_margin_used,
            }

        except Exception as e:
            logger.error(f"Error calculating margin utilization: {str(e)}")
            raise

    # Phase 1: Enhanced Performance Blocks Calculations

    def calculate_enhanced_cumulative_equity(
        self, trades: List[Trade], initial_capital: float = 100000
    ) -> Dict[str, Any]:
        """
        Calculate enhanced cumulative equity with support for linear/log scaling
        and strategy-level breakdown.
        """
        try:
            sorted_trades = sorted(trades, key=lambda x: (x.date_opened, x.time_opened))

            equity_data = []
            high_water_marks = []
            running_equity = initial_capital
            peak_equity = initial_capital

            # Strategy-level tracking
            strategy_equity = defaultdict(lambda: initial_capital)

            for i, trade in enumerate(sorted_trades):
                running_equity += trade.pl

                # Track high water mark
                if running_equity > peak_equity:
                    peak_equity = running_equity

                # Strategy-level equity
                strategy_equity[trade.strategy] += trade.pl

                equity_point = {
                    "date": trade.date_opened.isoformat(),
                    "equity": running_equity,
                    "trade_pl": trade.pl,
                    "high_water_mark": peak_equity,
                    "trade_number": i + 1,
                    "strategy": trade.strategy,
                    "drawdown_pct": (
                        ((running_equity - peak_equity) / peak_equity * 100)
                        if peak_equity > 0
                        else 0
                    ),
                }

                equity_data.append(equity_point)
                high_water_marks.append(
                    {"date": trade.date_opened.isoformat(), "high_water_mark": peak_equity}
                )

            # Strategy-level equity curves
            strategy_curves = {}
            for strategy in set(trade.strategy for trade in sorted_trades):
                strategy_trades = [t for t in sorted_trades if t.strategy == strategy]
                strategy_running = initial_capital
                curve = []

                for i, trade in enumerate(strategy_trades):
                    strategy_running += trade.pl
                    curve.append(
                        {
                            "date": trade.date_opened.isoformat(),
                            "equity": strategy_running,
                            "trade_pl": trade.pl,
                            "trade_number": i + 1,
                        }
                    )

                strategy_curves[strategy] = curve

            return {
                "equity_curve": equity_data,
                "high_water_marks": high_water_marks,
                "strategy_curves": strategy_curves,
                "initial_capital": initial_capital,
                "final_equity": running_equity,
                "total_return": (
                    ((running_equity - initial_capital) / initial_capital * 100)
                    if initial_capital > 0
                    else 0
                ),
            }

        except Exception as e:
            logger.error(f"Error calculating enhanced cumulative equity: {str(e)}")
            raise

    def calculate_trade_distributions(self, trades: List[Trade]) -> Dict[str, Any]:
        """
        Calculate various trade distribution analyses.
        """
        try:
            if not trades:
                return {"day_of_week": [], "time_of_day": [], "rom_ranges": [], "hold_duration": []}

            # Day of week distribution
            dow_data = defaultdict(lambda: {"count": 0, "total_pl": 0, "avg_pl": 0})
            dow_names = [
                "Monday",
                "Tuesday",
                "Wednesday",
                "Thursday",
                "Friday",
                "Saturday",
                "Sunday",
            ]

            # Time of day distribution (hourly buckets)
            hour_data = defaultdict(lambda: {"count": 0, "total_pl": 0, "avg_pl": 0})

            # Return on margin ranges
            rom_values = []

            # Hold duration distribution
            duration_data = defaultdict(lambda: {"count": 0, "total_pl": 0, "avg_pl": 0})

            for trade in trades:
                # Day of week
                if hasattr(trade.date_opened, "weekday"):
                    dow = trade.date_opened.weekday()
                    dow_name = dow_names[dow]
                    dow_data[dow_name]["count"] += 1
                    dow_data[dow_name]["total_pl"] += trade.pl

                # Time of day
                if hasattr(trade, "time_opened") and trade.time_opened:
                    hour = trade.time_opened.hour if hasattr(trade.time_opened, "hour") else 0
                    hour_data[hour]["count"] += 1
                    hour_data[hour]["total_pl"] += trade.pl

                # Return on margin
                if trade.margin_req and trade.margin_req > 0:
                    rom = (trade.pl / trade.margin_req) * 100
                    rom_values.append(rom)

                # Hold duration (if we have both dates)
                if hasattr(trade, "date_closed") and trade.date_closed:
                    try:
                        duration = (trade.date_closed - trade.date_opened).days
                        duration_key = f"{duration} days"
                        duration_data[duration_key]["count"] += 1
                        duration_data[duration_key]["total_pl"] += trade.pl
                    except Exception:
                        pass  # Skip if date calculation fails

            # Calculate averages
            for day_data in dow_data.values():
                if day_data["count"] > 0:
                    day_data["avg_pl"] = day_data["total_pl"] / day_data["count"]

            for hour_data_point in hour_data.values():
                if hour_data_point["count"] > 0:
                    hour_data_point["avg_pl"] = (
                        hour_data_point["total_pl"] / hour_data_point["count"]
                    )

            for duration_point in duration_data.values():
                if duration_point["count"] > 0:
                    duration_point["avg_pl"] = duration_point["total_pl"] / duration_point["count"]

            # Convert to lists for easier consumption
            dow_list = [{"day": day, **data} for day, data in dow_data.items()]
            hour_list = [{"hour": hour, **data} for hour, data in hour_data.items()]
            duration_list = [
                {"duration": duration, **data} for duration, data in duration_data.items()
            ]

            # ROM distribution statistics
            rom_stats = {}
            if rom_values:
                rom_stats = {
                    "mean": np.mean(rom_values),
                    "median": np.median(rom_values),
                    "std": np.std(rom_values),
                    "min": np.min(rom_values),
                    "max": np.max(rom_values),
                    "skewness": self._calculate_skewness(rom_values),
                    "kurtosis": self._calculate_kurtosis(rom_values),
                    "percentiles": {
                        "5th": np.percentile(rom_values, 5),
                        "25th": np.percentile(rom_values, 25),
                        "75th": np.percentile(rom_values, 75),
                        "95th": np.percentile(rom_values, 95),
                    },
                }

            return {
                "day_of_week": dow_list,
                "time_of_day": hour_list,
                "rom_ranges": rom_values,
                "rom_statistics": rom_stats,
                "hold_duration": duration_list,
            }

        except Exception as e:
            logger.error(f"Error calculating trade distributions: {str(e)}")
            raise

    def calculate_streak_distributions(self, trades: List[Trade]) -> Dict[str, Any]:
        """
        Calculate comprehensive win/loss streak analysis.
        """
        try:
            if not trades:
                return {"streaks": [], "distribution": {}, "statistics": {}}

            sorted_trades = sorted(trades, key=lambda x: (x.date_opened, x.time_opened))

            # Identify all streaks
            streaks = []
            current_streak = {"type": None, "length": 0, "total_pl": 0, "trades": []}

            for trade in sorted_trades:
                is_win = trade.pl > 0
                streak_type = "win" if is_win else "loss"

                if current_streak["type"] == streak_type:
                    # Continue current streak
                    current_streak["length"] += 1
                    current_streak["total_pl"] += trade.pl
                    current_streak["trades"].append(trade)
                else:
                    # End current streak and start new one
                    if current_streak["type"] is not None:
                        streaks.append(current_streak.copy())

                    current_streak = {
                        "type": streak_type,
                        "length": 1,
                        "total_pl": trade.pl,
                        "trades": [trade],
                    }

            # Don't forget the last streak
            if current_streak["type"] is not None:
                streaks.append(current_streak)

            # Calculate streak distribution
            win_streaks = [s["length"] for s in streaks if s["type"] == "win"]
            loss_streaks = [s["length"] for s in streaks if s["type"] == "loss"]

            win_distribution = Counter(win_streaks)
            loss_distribution = Counter(loss_streaks)

            # Calculate statistics
            statistics = {
                "max_win_streak": max(win_streaks) if win_streaks else 0,
                "max_loss_streak": max(loss_streaks) if loss_streaks else 0,
                "avg_win_streak": np.mean(win_streaks) if win_streaks else 0,
                "avg_loss_streak": np.mean(loss_streaks) if loss_streaks else 0,
                "total_win_streaks": len(win_streaks),
                "total_loss_streaks": len(loss_streaks),
            }

            # Time between streaks (if we have dates)
            streak_intervals = []
            for i in range(1, len(streaks)):
                try:
                    prev_end = streaks[i - 1]["trades"][-1].date_opened
                    curr_start = streaks[i]["trades"][0].date_opened
                    interval = (curr_start - prev_end).days
                    streak_intervals.append(interval)
                except Exception:
                    pass

            if streak_intervals:
                statistics["avg_time_between_streaks"] = np.mean(streak_intervals)

            return {
                "streaks": streaks,
                "win_distribution": dict(win_distribution),
                "loss_distribution": dict(loss_distribution),
                "statistics": statistics,
                "streak_intervals": streak_intervals,
            }

        except Exception as e:
            logger.error(f"Error calculating streak distributions: {str(e)}")
            raise

    def calculate_trade_sequence_data(self, trades: List[Trade]) -> Dict[str, Any]:
        """
        Calculate trade sequence analysis data.
        """
        try:
            if not trades:
                return {"sequence": [], "rolling_metrics": {}, "trends": {}}

            sorted_trades = sorted(trades, key=lambda x: (x.date_opened, x.time_opened))

            sequence_data = []
            cumulative_return = 0
            rolling_wins = []

            for i, trade in enumerate(sorted_trades):
                is_win = trade.pl > 0
                rolling_wins.append(1 if is_win else 0)

                # Calculate rolling win rate (last 10, 20, 50 trades)
                rolling_10 = (
                    np.mean(rolling_wins[-10:])
                    if len(rolling_wins) >= 10
                    else np.mean(rolling_wins)
                )
                rolling_20 = (
                    np.mean(rolling_wins[-20:])
                    if len(rolling_wins) >= 20
                    else np.mean(rolling_wins)
                )
                rolling_50 = (
                    np.mean(rolling_wins[-50:])
                    if len(rolling_wins) >= 50
                    else np.mean(rolling_wins)
                )

                # Return on margin for this trade
                rom = (
                    (trade.pl / trade.margin_req * 100)
                    if trade.margin_req and trade.margin_req > 0
                    else 0
                )

                cumulative_return += trade.pl

                sequence_point = {
                    "trade_number": i + 1,
                    "date": trade.date_opened.isoformat(),
                    "pl": trade.pl,
                    "rom": rom,
                    "cumulative_pl": cumulative_return,
                    "rolling_wr_10": rolling_10,
                    "rolling_wr_20": rolling_20,
                    "rolling_wr_50": rolling_50,
                    "strategy": trade.strategy,
                    "margin_req": trade.margin_req or 0,
                    "is_win": is_win,
                }

                sequence_data.append(sequence_point)

            # Calculate trend analysis
            if len(sequence_data) > 10:
                # Simple linear trend of returns
                trade_numbers = np.array([p["trade_number"] for p in sequence_data])
                returns = np.array([p["pl"] for p in sequence_data])

                # Linear regression
                coeffs = np.polyfit(trade_numbers, returns, 1)
                trend_slope = coeffs[0]
                trend_direction = (
                    "improving" if trend_slope > 0 else "declining" if trend_slope < 0 else "flat"
                )
            else:
                trend_slope = 0
                trend_direction = "insufficient_data"

            # Rolling metrics over time
            rolling_metrics = {
                "win_rates": {
                    "10_trade": [p["rolling_wr_10"] for p in sequence_data],
                    "20_trade": [p["rolling_wr_20"] for p in sequence_data],
                    "50_trade": [p["rolling_wr_50"] for p in sequence_data],
                }
            }

            trends = {
                "slope": trend_slope,
                "direction": trend_direction,
                "r_squared": 0,  # Could calculate correlation coefficient if needed
            }

            return {"sequence": sequence_data, "rolling_metrics": rolling_metrics, "trends": trends}

        except Exception as e:
            logger.error(f"Error calculating trade sequence data: {str(e)}")
            raise

    def calculate_monthly_heatmap_data(self, trades: List[Trade]) -> Dict[str, Any]:
        """
        Calculate data for monthly returns heatmap.
        """
        try:
            if not trades:
                return {"monthly_returns": {}, "yearly_totals": {}, "monthly_stats": {}}

            # Group trades by year-month
            monthly_data = defaultdict(float)
            yearly_data = defaultdict(float)

            for trade in trades:
                year = trade.date_opened.year
                month = trade.date_opened.month
                year_month = f"{year}-{month:02d}"

                monthly_data[year_month] += trade.pl
                yearly_data[year] += trade.pl

            # Convert to structured format
            monthly_returns = {}
            years = sorted(set(trade.date_opened.year for trade in trades))
            months = list(range(1, 13))

            for year in years:
                monthly_returns[year] = {}
                for month in months:
                    year_month = f"{year}-{month:02d}"
                    monthly_returns[year][month] = monthly_data.get(year_month, 0)

            # Calculate statistics
            monthly_values = list(monthly_data.values())
            monthly_stats = {}
            if monthly_values:
                monthly_stats = {
                    "best_month": max(monthly_values),
                    "worst_month": min(monthly_values),
                    "avg_month": np.mean(monthly_values),
                    "median_month": np.median(monthly_values),
                    "std_month": np.std(monthly_values),
                    "positive_months": sum(1 for x in monthly_values if x > 0),
                    "negative_months": sum(1 for x in monthly_values if x < 0),
                    "total_months": len(monthly_values),
                }

                if monthly_stats["total_months"] > 0:
                    monthly_stats["win_rate"] = (
                        monthly_stats["positive_months"] / monthly_stats["total_months"]
                    ) * 100

            return {
                "monthly_returns": monthly_returns,
                "yearly_totals": dict(yearly_data),
                "monthly_stats": monthly_stats,
                "raw_monthly_data": dict(monthly_data),
            }

        except Exception as e:
            logger.error(f"Error calculating monthly heatmap data: {str(e)}")
            raise

    def calculate_rom_over_time(
        self, trades: List[Trade], ma_periods: List[int] = [10, 30, 50]
    ) -> Dict[str, Any]:
        """
        Calculate Return on Margin over time with moving averages.
        """
        try:
            if not trades:
                return {"rom_timeline": [], "moving_averages": {}, "statistics": {}, "outliers": []}

            sorted_trades = sorted(trades, key=lambda x: (x.date_opened, x.time_opened))

            rom_timeline = []
            rom_values = []

            for i, trade in enumerate(sorted_trades):
                if trade.margin_req and trade.margin_req > 0:
                    rom = (trade.pl / trade.margin_req) * 100
                    rom_values.append(rom)

                    rom_point = {
                        "trade_number": i + 1,
                        "date": trade.date_opened.isoformat(),
                        "rom": rom,
                        "pl": trade.pl,
                        "margin_req": trade.margin_req,
                        "strategy": trade.strategy,
                    }

                    rom_timeline.append(rom_point)

            # Calculate moving averages
            moving_averages = {}
            for period in ma_periods:
                if len(rom_values) >= period:
                    ma_values = []
                    for i in range(len(rom_values)):
                        if i >= period - 1:
                            ma_value = np.mean(rom_values[i - period + 1 : i + 1])
                            ma_values.append(ma_value)
                        else:
                            ma_values.append(np.nan)
                    moving_averages[f"ma_{period}"] = ma_values

            # Calculate statistics and outliers
            statistics = {}
            outliers = []

            if rom_values:
                mean_rom = np.mean(rom_values)
                std_rom = np.std(rom_values)

                statistics = {
                    "mean": mean_rom,
                    "median": np.median(rom_values),
                    "std": std_rom,
                    "min": np.min(rom_values),
                    "max": np.max(rom_values),
                    "skewness": self._calculate_skewness(rom_values),
                    "kurtosis": self._calculate_kurtosis(rom_values),
                }

                # Identify outliers (>2 standard deviations)
                for i, point in enumerate(rom_timeline):
                    if abs(point["rom"] - mean_rom) > 2 * std_rom:
                        outliers.append(
                            {
                                **point,
                                "outlier_type": "high" if point["rom"] > mean_rom else "low",
                                "std_devs": (
                                    abs(point["rom"] - mean_rom) / std_rom if std_rom > 0 else 0
                                ),
                            }
                        )

            return {
                "rom_timeline": rom_timeline,
                "moving_averages": moving_averages,
                "statistics": statistics,
                "outliers": outliers,
            }

        except Exception as e:
            logger.error(f"Error calculating ROM over time: {str(e)}")
            raise

    def calculate_rolling_metrics(
        self, trades: List[Trade], window_sizes: List[int] = [30, 60, 90]
    ) -> Dict[str, Any]:
        """
        Calculate rolling performance metrics with customizable windows.
        """
        try:
            if not trades:
                return {"rolling_data": {}, "metrics": []}

            sorted_trades = sorted(trades, key=lambda x: (x.date_opened, x.time_opened))

            rolling_data = {}
            metrics_timeline = []

            for window in window_sizes:
                rolling_data[f"window_{window}"] = {
                    "win_rate": [],
                    "profit_factor": [],
                    "avg_trade": [],
                    "sharpe_ratio": [],
                    "volatility": [],
                }

                for i in range(len(sorted_trades)):
                    start_idx = max(0, i - window + 1)
                    window_trades = sorted_trades[start_idx : i + 1]

                    if len(window_trades) >= min(
                        window, 10
                    ):  # Minimum trades for meaningful metrics
                        metrics = self._calculate_window_metrics(window_trades)

                        rolling_data[f"window_{window}"]["win_rate"].append(metrics["win_rate"])
                        rolling_data[f"window_{window}"]["profit_factor"].append(
                            metrics["profit_factor"]
                        )
                        rolling_data[f"window_{window}"]["avg_trade"].append(metrics["avg_trade"])
                        rolling_data[f"window_{window}"]["sharpe_ratio"].append(
                            metrics["sharpe_ratio"]
                        )
                        rolling_data[f"window_{window}"]["volatility"].append(metrics["volatility"])

                        if window == window_sizes[0]:  # Only create timeline once
                            metrics_timeline.append(
                                {
                                    "trade_number": i + 1,
                                    "date": sorted_trades[i].date_opened.isoformat(),
                                    **metrics,
                                }
                            )
                    else:
                        # Not enough trades yet
                        for metric in rolling_data[f"window_{window}"]:
                            rolling_data[f"window_{window}"][metric].append(np.nan)

            return {
                "rolling_data": rolling_data,
                "metrics_timeline": metrics_timeline,
                "window_sizes": window_sizes,
            }

        except Exception as e:
            logger.error(f"Error calculating rolling metrics: {str(e)}")
            raise

    def _calculate_window_metrics(self, trades: List[Trade]) -> Dict[str, float]:
        """Helper method to calculate metrics for a window of trades."""
        if not trades:
            return {
                "win_rate": 0,
                "profit_factor": 0,
                "avg_trade": 0,
                "sharpe_ratio": 0,
                "volatility": 0,
            }

        pls = [trade.pl for trade in trades]
        wins = [pl for pl in pls if pl > 0]
        losses = [pl for pl in pls if pl < 0]

        win_rate = len(wins) / len(pls) if pls else 0
        avg_trade = np.mean(pls) if pls else 0
        volatility = np.std(pls) if len(pls) > 1 else 0

        profit_factor = 0
        if losses:
            total_wins = sum(wins) if wins else 0
            total_losses = abs(sum(losses))
            profit_factor = total_wins / total_losses if total_losses > 0 else 0

        # Simple Sharpe approximation (assuming daily trades)
        sharpe_ratio = avg_trade / volatility if volatility > 0 else 0

        return {
            "win_rate": win_rate * 100,  # Convert to percentage
            "profit_factor": profit_factor,
            "avg_trade": avg_trade,
            "sharpe_ratio": sharpe_ratio,
            "volatility": volatility,
        }

    def _calculate_skewness(self, values: List[float]) -> float:
        """Calculate skewness of a distribution."""
        if len(values) < 3:
            return 0

        mean = np.mean(values)
        std = np.std(values)

        if std == 0:
            return 0

        skew = np.mean([((x - mean) / std) ** 3 for x in values])
        return skew

    def _calculate_kurtosis(self, values: List[float]) -> float:
        """Calculate kurtosis of a distribution."""
        if len(values) < 4:
            return 0

        mean = np.mean(values)
        std = np.std(values)

        if std == 0:
            return 0

        kurt = np.mean([((x - mean) / std) ** 4 for x in values]) - 3  # Excess kurtosis
        return kurt
