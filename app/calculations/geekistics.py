"""
Geekistics Tab Calculator

All calculations needed for the Geekistics tab (Combat Stats & Geekistics).
Consolidates basic portfolio stats, advanced metrics, and risk analytics.
"""

import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from collections import defaultdict
import logging

from .shared import (
    calculate_initial_capital_from_trades,
    calculate_max_drawdown_from_portfolio_values,
    calculate_basic_portfolio_stats,
    calculate_strategy_breakdown,
    get_initial_capital_from_daily_log,
    calculate_max_drawdown_from_daily_log,
)

logger = logging.getLogger(__name__)


class GeekisticsCalculator:
    """Calculator for all Geekistics tab statistics and metrics"""

    def __init__(self, analysis_config=None):
        # Use analysis config if provided, otherwise use defaults
        if analysis_config:
            self.risk_free_rate = (
                analysis_config.get("risk_free_rate", 2.0) / 100
            )  # Convert percentage to decimal
            self.annualization_factor = analysis_config.get("annualization_factor", 252)
            self.use_business_days = analysis_config.get("use_business_days_only", True)
            self.confidence_level = analysis_config.get("confidence_level", 0.95)
            self.drawdown_threshold = analysis_config.get("drawdown_threshold", 0.05)
        else:
            self.risk_free_rate = 0.02  # 2% annual risk-free rate (default)
            self.annualization_factor = 252  # Trading days per year (default)
            self.use_business_days = True
            self.confidence_level = 0.95
            self.drawdown_threshold = 0.05

    def calculate_all_geekistics_stats(
        self, trades_data: List[Dict], daily_log_data: List[Dict] = None, is_filtered: bool = False
    ) -> Dict[str, Any]:
        """
        Calculate all statistics needed for the Geekistics tab.
        If daily_log_data is provided and is_filtered=False, uses exact daily portfolio values for accuracy.
        For filtered strategies (is_filtered=True), falls back to trade-based calculations for strategy-specific metrics.
        Returns a comprehensive dictionary with all metrics.
        """
        if not trades_data:
            return self._empty_stats_response()

        # Determine if we should use daily log data for risk calculations
        # Only use daily log when showing full portfolio (not filtered by strategy)
        use_daily_log_for_risk = daily_log_data is not None and not is_filtered

        # Calculate initial capital - OptionOmega uses daily log capital even for filtered strategies
        # This ensures consistent starting capital across filtered and unfiltered views
        if daily_log_data:
            initial_capital = get_initial_capital_from_daily_log(daily_log_data)
        else:
            initial_capital = calculate_initial_capital_from_trades(trades_data)

        # OptionOmega methodology: Use full portfolio capital even for filtered strategies
        # This ensures CAGR and return metrics match OptionOmega's calculations
        strategy_allocated_capital = initial_capital

        # Store the original strategy allocation logic for reference but don't use it
        # (keeping for potential future advanced allocation features)
        calculated_strategy_capital = initial_capital
        if is_filtered:
            calculated_strategy_capital = self._calculate_strategy_allocated_capital(
                trades_data, initial_capital
            )

        # Basic portfolio stats
        basic_stats = calculate_basic_portfolio_stats(trades_data)

        # Strategy breakdown
        strategy_stats = calculate_strategy_breakdown(trades_data)

        # Advanced metrics (use daily log only for full portfolio, trade-based for filtered strategies)
        rom_stats = self.calculate_return_on_margin_stats(trades_data)
        cagr = self.calculate_cagr(
            trades_data,
            strategy_allocated_capital,
            daily_log_data if use_daily_log_for_risk else None,
        )
        sharpe_ratio = self.calculate_sharpe_ratio(
            trades_data, daily_log_data if use_daily_log_for_risk else None
        )
        sortino_ratio = self.calculate_sortino_ratio(
            trades_data, daily_log_data if use_daily_log_for_risk else None
        )
        calmar_ratio = self.calculate_calmar_ratio(
            trades_data,
            strategy_allocated_capital,
            daily_log_data if use_daily_log_for_risk else None,
        )
        # Use daily log for max drawdown only for full portfolio
        if use_daily_log_for_risk:
            max_drawdown = calculate_max_drawdown_from_daily_log(daily_log_data)
        else:
            max_drawdown = calculate_max_drawdown_from_portfolio_values(
                trades_data, strategy_allocated_capital
            )
        time_in_dd = self.calculate_time_in_drawdown(
            trades_data,
            strategy_allocated_capital,
            daily_log_data if use_daily_log_for_risk else None,
        )
        streaks = self.calculate_win_loss_streaks(trades_data)
        periodic_wr = self.calculate_periodic_win_rates(trades_data)
        kelly_criterion = self.calculate_kelly_criterion(trades_data)

        return {
            # Basic stats
            "portfolio_stats": {
                **basic_stats,
                "max_drawdown": max_drawdown,
                "avg_daily_pl": self._calculate_avg_daily_pl(trades_data),
                "total_commissions": self._calculate_total_commissions(trades_data),
                "net_pl": basic_stats["total_pl"] - self._calculate_total_commissions(trades_data),
            },
            # Strategy breakdown
            "strategy_stats": strategy_stats,
            # Advanced metrics for UI
            "return_on_margin": rom_stats,
            "cagr": cagr,
            "sharpe_ratio": sharpe_ratio,
            "sortino_ratio": sortino_ratio,
            "calmar_ratio": calmar_ratio,
            "time_in_drawdown": time_in_dd,
            "win_loss_streaks": streaks,
            "periodic_win_rates": periodic_wr,
            "kelly_criterion": kelly_criterion,
            # Configuration used
            "config_used": {
                "initial_capital": initial_capital,
                "strategy_allocated_capital": strategy_allocated_capital,
                "calculated_strategy_capital": calculated_strategy_capital,  # For debugging
                "risk_free_rate": self.risk_free_rate
                * 100,  # Convert back to percentage for display
                "annualization_factor": self.annualization_factor,
                "calculation_method": "daily_log" if use_daily_log_for_risk else "trade_based",
                "is_filtered": is_filtered,
            },
            "initial_capital": initial_capital,
        }

    def calculate_return_on_margin_stats(self, trades_data: List[Dict]) -> Dict[str, float]:
        """Calculate return on margin statistics"""
        if not trades_data:
            return {
                "avg_return_on_margin": 0.0,
                "worst_trade_pct": 0.0,
                "best_trade_pct": 0.0,
                "std_dev_rom": 0.0,
            }

        rom_values = []
        for trade in trades_data:
            pl = trade.get("pl", 0)
            margin = trade.get("margin_req", 0)

            if margin > 0:
                rom = (pl / margin) * 100  # Return on margin as percentage
                rom_values.append(rom)

        if not rom_values:
            return {
                "avg_return_on_margin": 0.0,
                "worst_trade_pct": 0.0,
                "best_trade_pct": 0.0,
                "std_dev_rom": 0.0,
            }

        return {
            "avg_return_on_margin": np.mean(rom_values),
            "worst_trade_pct": np.min(rom_values),
            "best_trade_pct": np.max(rom_values),
            "std_dev_rom": np.std(rom_values),
        }

    def calculate_cagr(
        self,
        trades_data: List[Dict],
        initial_capital: float = 10000,
        daily_log_data: List[Dict] = None,
    ) -> float:
        """Calculate Compound Annual Growth Rate using daily log data when available"""
        if not trades_data:
            return 0.0

        # Use daily log data for more accurate CAGR calculation if available
        if daily_log_data:
            return self._calculate_cagr_from_daily_log(daily_log_data)

        # Fallback to trade-based calculation
        sorted_trades = sorted(trades_data, key=lambda x: x.get("date_opened", ""))

        if len(sorted_trades) < 2:
            return 0.0

        # Calculate total return
        total_pl = sum(trade.get("pl", 0) for trade in trades_data)
        final_value = initial_capital + total_pl

        if final_value <= 0:
            return -100.0  # Total loss

        # Calculate time period in years
        start_date = pd.to_datetime(sorted_trades[0].get("date_opened"))
        end_date = pd.to_datetime(
            sorted_trades[-1].get("date_closed") or sorted_trades[-1].get("date_opened")
        )

        years = (end_date - start_date).days / 365.25

        if years <= 0:
            return 0.0

        # CAGR formula: (Ending Value / Beginning Value)^(1/years) - 1
        # Handle edge case where ratio is negative (would create complex number)
        ratio = final_value / initial_capital
        if ratio <= 0:
            return -100.0  # Total loss

        cagr = ((ratio) ** (1 / years) - 1) * 100

        return cagr

    def calculate_sharpe_ratio(
        self, trades_data: List[Dict], daily_log_data: List[Dict] = None
    ) -> float:
        """Calculate Sharpe ratio using daily log data when available"""
        if not trades_data:
            return 0.0

        # Calculate daily returns (use daily log if available)
        daily_returns = self._get_daily_returns(trades_data, daily_log_data)

        if len(daily_returns) < 2:
            return 0.0

        # Convert annual risk-free rate to daily
        daily_risk_free = self.risk_free_rate / self.annualization_factor

        # Calculate excess returns
        excess_returns = [r - daily_risk_free for r in daily_returns]

        if np.std(excess_returns) == 0:
            return 0.0

        # Sharpe ratio = (mean excess return) / (std of excess returns)
        # Annualized by multiplying by sqrt(annualization_factor)
        sharpe = (np.mean(excess_returns) / np.std(excess_returns)) * np.sqrt(
            self.annualization_factor
        )

        return sharpe

    def calculate_sortino_ratio(
        self, trades_data: List[Dict], daily_log_data: List[Dict] = None
    ) -> float:
        """Calculate Sortino ratio (only considers downside volatility) using daily log data when available"""
        if not trades_data:
            return 0.0

        daily_returns = self._get_daily_returns(trades_data, daily_log_data)

        if len(daily_returns) < 2:
            return 0.0

        daily_risk_free = self.risk_free_rate / self.annualization_factor
        excess_returns = [r - daily_risk_free for r in daily_returns]

        # Only consider negative returns for downside deviation
        downside_returns = [r for r in excess_returns if r < 0]

        if not downside_returns:
            return float("inf")  # No downside volatility

        downside_deviation = np.std(downside_returns)

        if downside_deviation == 0:
            return float("inf")

        # Sortino ratio = (mean excess return) / (downside deviation)
        sortino = (np.mean(excess_returns) / downside_deviation) * np.sqrt(
            self.annualization_factor
        )

        return sortino

    def calculate_calmar_ratio(
        self,
        trades_data: List[Dict],
        initial_capital: float = 10000,
        daily_log_data: List[Dict] = None,
    ) -> float:
        """Calculate Calmar ratio (CAGR / Max Drawdown)"""
        if not trades_data:
            return 0.0

        cagr = self.calculate_cagr(trades_data, initial_capital, daily_log_data)

        # Use daily log for max drawdown if available
        if daily_log_data:
            max_drawdown = calculate_max_drawdown_from_daily_log(daily_log_data)
        else:
            max_drawdown = calculate_max_drawdown_from_portfolio_values(
                trades_data, initial_capital
            )

        if max_drawdown == 0:
            return float("inf") if cagr > 0 else 0.0

        return abs(cagr / max_drawdown)

    def calculate_time_in_drawdown(
        self,
        trades_data: List[Dict],
        initial_capital: float = 10000,
        daily_log_data: List[Dict] = None,
    ) -> float:
        """Calculate percentage of time spent in drawdown using OptionOmega methodology"""
        if not trades_data:
            return 0.0

        # If daily log data is available, use it for more accurate calculation
        if daily_log_data:
            return self._calculate_time_in_drawdown_from_daily_log(daily_log_data)

        # Get portfolio timeline (same as max drawdown calculation)
        closed_trades = [trade for trade in trades_data if trade.get("date_closed")]
        if not closed_trades:
            return 0.0

        # Sort by close date and time
        sorted_trades = sorted(
            closed_trades, key=lambda x: (x.get("date_closed", ""), x.get("time_closed", ""))
        )

        # Track periods in drawdown
        peak = initial_capital
        periods_in_drawdown = 0
        total_periods = len(sorted_trades) + 1  # +1 for initial capital

        # Check initial state (not in drawdown)
        for trade in sorted_trades:
            portfolio_value = trade.get("funds_at_close", 0)

            # Update peak
            if portfolio_value > peak:
                peak = portfolio_value

            # Count if currently in drawdown
            if portfolio_value < peak:
                periods_in_drawdown += 1

        if total_periods == 0:
            return 0.0

        return (periods_in_drawdown / total_periods) * 100

    def calculate_win_loss_streaks(self, trades_data: List[Dict]) -> Dict[str, int]:
        """Calculate maximum win and loss streaks"""
        if not trades_data:
            return {"max_win_streak": 0, "max_loss_streak": 0}

        # Sort trades by date
        sorted_trades = sorted(trades_data, key=lambda x: x.get("date_opened", ""))

        current_win_streak = 0
        current_loss_streak = 0
        max_win_streak = 0
        max_loss_streak = 0

        for trade in sorted_trades:
            pl = trade.get("pl", 0)

            if pl > 0:  # Winning trade
                current_win_streak += 1
                current_loss_streak = 0
                max_win_streak = max(max_win_streak, current_win_streak)
            elif pl < 0:  # Losing trade
                current_loss_streak += 1
                current_win_streak = 0
                max_loss_streak = max(max_loss_streak, current_loss_streak)
            # Break-even trades (pl == 0) break both streaks
            else:
                current_win_streak = 0
                current_loss_streak = 0

        return {"max_win_streak": max_win_streak, "max_loss_streak": max_loss_streak}

    def calculate_periodic_win_rates(self, trades_data: List[Dict]) -> Dict[str, float]:
        """Calculate monthly and weekly win rates"""
        if not trades_data:
            return {"monthly_win_rate": 0.0, "weekly_win_rate": 0.0}

        # Group trades by month and week
        monthly_results = defaultdict(list)
        weekly_results = defaultdict(list)

        for trade in trades_data:
            date_str = trade.get("date_opened", "")
            if not date_str:
                continue

            try:
                date_obj = pd.to_datetime(date_str)
                pl = trade.get("pl", 0)

                # Monthly grouping (YYYY-MM)
                month_key = date_obj.strftime("%Y-%m")
                monthly_results[month_key].append(pl)

                # Weekly grouping (YYYY-WW)
                week_key = date_obj.strftime("%Y-%U")  # %U for week number
                weekly_results[week_key].append(pl)

            except Exception:
                continue

        # Calculate monthly win rate
        monthly_wins = 0
        total_months = len(monthly_results)

        for month_pls in monthly_results.values():
            month_total = sum(month_pls)
            if month_total > 0:
                monthly_wins += 1

        monthly_win_rate = (monthly_wins / total_months * 100) if total_months > 0 else 0.0

        # Calculate weekly win rate
        weekly_wins = 0
        total_weeks = len(weekly_results)

        for week_pls in weekly_results.values():
            week_total = sum(week_pls)
            if week_total > 0:
                weekly_wins += 1

        weekly_win_rate = (weekly_wins / total_weeks * 100) if total_weeks > 0 else 0.0

        return {"monthly_win_rate": monthly_win_rate, "weekly_win_rate": weekly_win_rate}

    def calculate_kelly_criterion(self, trades_data: List[Dict]) -> float:
        """Calculate Kelly criterion percentage"""
        if not trades_data:
            return 0.0

        wins = [trade.get("pl", 0) for trade in trades_data if trade.get("pl", 0) > 0]
        losses = [abs(trade.get("pl", 0)) for trade in trades_data if trade.get("pl", 0) < 0]

        if not wins or not losses:
            return 0.0

        # Calculate win probability and average win/loss
        total_trades = len(trades_data)
        win_probability = len(wins) / total_trades
        avg_win = np.mean(wins)
        avg_loss = np.mean(losses)

        if avg_loss == 0:
            return 0.0

        # Kelly formula: f = (bp - q) / b
        # where b = avg_win/avg_loss, p = win_probability, q = 1-p
        b = avg_win / avg_loss
        p = win_probability
        q = 1 - p

        kelly_fraction = (b * p - q) / b

        return kelly_fraction * 100  # Return as percentage

    def _get_daily_returns(
        self, trades_data: List[Dict], daily_log_data: List[Dict] = None
    ) -> List[float]:
        """Convert trades to daily returns, using daily log data when available for accuracy"""

        # Use actual daily log data if available (much more accurate)
        if daily_log_data:
            return self._get_actual_daily_returns_from_log(daily_log_data)

        # Fallback to trade-based estimation
        daily_pl = defaultdict(float)

        for trade in trades_data:
            date_str = trade.get("date_opened", "")
            if date_str:
                daily_pl[date_str] += trade.get("pl", 0)

        # Convert to returns (assuming some base capital)
        base_capital = 10000
        daily_returns = []

        for pl in daily_pl.values():
            daily_return = pl / base_capital
            daily_returns.append(daily_return)

        return daily_returns

    def _calculate_avg_daily_pl(self, trades_data: List[Dict]) -> float:
        """Calculate average daily P/L"""
        if not trades_data:
            return 0.0

        total_pl = sum(trade.get("pl", 0) for trade in trades_data)
        unique_dates = len(set(trade.get("date_opened") for trade in trades_data))

        return total_pl / unique_dates if unique_dates > 0 else 0.0

    def _calculate_total_commissions(self, trades_data: List[Dict]) -> float:
        """Calculate total commissions and fees"""
        total_commissions = 0.0

        for trade in trades_data:
            opening_fees = trade.get("opening_commissions_fees", 0) or 0
            closing_fees = trade.get("closing_commissions_fees", 0) or 0
            total_commissions += opening_fees + closing_fees

        return total_commissions

    def _empty_stats_response(self) -> Dict[str, Any]:
        """Return empty stats response when no trades available"""
        return {
            "portfolio_stats": {
                "total_trades": 0,
                "total_pl": 0.0,
                "win_rate": 0.0,
                "avg_win": 0.0,
                "avg_loss": 0.0,
                "max_win": 0.0,
                "max_loss": 0.0,
                "max_drawdown": 0.0,
                "avg_daily_pl": 0.0,
                "total_commissions": 0.0,
                "net_pl": 0.0,
                "profit_factor": 0.0,
            },
            "strategy_stats": {},
            "return_on_margin": {
                "avg_return_on_margin": 0.0,
                "worst_trade_pct": 0.0,
                "best_trade_pct": 0.0,
                "std_dev_rom": 0.0,
            },
            "cagr": 0.0,
            "sharpe_ratio": 0.0,
            "sortino_ratio": 0.0,
            "calmar_ratio": 0.0,
            "time_in_drawdown": 0.0,
            "win_loss_streaks": {"max_win_streak": 0, "max_loss_streak": 0},
            "periodic_win_rates": {"monthly_win_rate": 0.0, "weekly_win_rate": 0.0},
            "kelly_criterion": 0.0,
            "config_used": {
                "initial_capital": 0.0,
                "risk_free_rate": self.risk_free_rate * 100,
                "annualization_factor": self.annualization_factor,
            },
            "initial_capital": 0.0,
        }

    def _calculate_time_in_drawdown_from_daily_log(self, daily_log_data: List[Dict]) -> float:
        """Calculate time in drawdown using exact daily log data"""
        if not daily_log_data:
            return 0.0

        # Sort entries by date
        sorted_entries = sorted(daily_log_data, key=lambda x: pd.to_datetime(x.get("date")))

        if not sorted_entries:
            return 0.0

        # Calculate initial portfolio value
        first_entry = sorted_entries[0]
        initial_value = first_entry.get("net_liquidity", 0) - first_entry.get("daily_pl", 0)

        peak = initial_value
        periods_in_drawdown = 0
        total_periods = len(sorted_entries)

        for entry in sorted_entries:
            current_value = entry.get("net_liquidity", 0)

            # Update peak
            if current_value > peak:
                peak = current_value

            # Count if currently in drawdown
            if current_value < peak:
                periods_in_drawdown += 1

        if total_periods == 0:
            return 0.0

        return (periods_in_drawdown / total_periods) * 100

    def _get_actual_daily_returns_from_log(self, daily_log_data: List[Dict]) -> List[float]:
        """Get actual daily returns from daily log data (much more accurate)"""
        if not daily_log_data:
            return []

        returns = []
        sorted_entries = sorted(daily_log_data, key=lambda x: pd.to_datetime(x.get("date")))

        for entry in sorted_entries:
            net_liquidity = entry.get("net_liquidity", 0)
            daily_pl = entry.get("daily_pl", 0)

            # Calculate previous day's portfolio value
            previous_value = net_liquidity - daily_pl

            if previous_value > 0:
                daily_return = daily_pl / previous_value
                returns.append(daily_return)

        return returns

    def _calculate_cagr_from_daily_log(self, daily_log_data: List[Dict]) -> float:
        """Calculate CAGR using exact daily log data (more accurate)"""
        if not daily_log_data:
            return 0.0

        sorted_entries = sorted(daily_log_data, key=lambda x: pd.to_datetime(x.get("date")))

        if len(sorted_entries) < 2:
            return 0.0

        # Get exact start and end values
        first_entry = sorted_entries[0]
        last_entry = sorted_entries[-1]

        # Initial value = first day's net liquidity - first day's P/L
        initial_value = first_entry.get("net_liquidity", 0) - first_entry.get("daily_pl", 0)
        final_value = last_entry.get("net_liquidity", 0)

        if initial_value <= 0 or final_value <= 0:
            return -100.0  # Total loss or invalid data

        # Calculate exact time period
        start_date = pd.to_datetime(first_entry.get("date"))
        end_date = pd.to_datetime(last_entry.get("date"))

        years = (end_date - start_date).days / 365.25

        if years <= 0:
            return 0.0

        # CAGR formula: (Ending Value / Beginning Value)^(1/years) - 1
        # Handle edge case where ratio is negative (would create complex number)
        ratio = final_value / initial_value
        if ratio <= 0:
            return -100.0  # Total loss

        cagr = ((ratio) ** (1 / years) - 1) * 100

        return cagr

    def _calculate_strategy_allocated_capital(
        self, trades_data: List[Dict], full_portfolio_capital: float
    ) -> float:
        """
        Calculate the capital allocated to a specific strategy based on maximum simultaneous margin exposure.

        For options trading, this represents the peak margin requirement that would have been
        needed to execute all trades for this strategy simultaneously.
        """
        if not trades_data:
            return full_portfolio_capital

        # Build timeline of margin usage for this strategy
        margin_events = []

        for trade in trades_data:
            date_opened = trade.get("date_opened")
            date_closed = trade.get("date_closed")
            margin_req = trade.get("margin_req", 0)

            if not date_opened or margin_req <= 0:
                continue

            # Add opening event
            margin_events.append(
                {
                    "date": pd.to_datetime(date_opened),
                    "time": trade.get("time_opened", "00:00:00"),
                    "margin_change": margin_req,
                    "event_type": "open",
                }
            )

            # Add closing event if trade is closed
            if date_closed:
                margin_events.append(
                    {
                        "date": pd.to_datetime(date_closed),
                        "time": trade.get("time_closed", "23:59:59"),
                        "margin_change": -margin_req,
                        "event_type": "close",
                    }
                )

        if not margin_events:
            # If no margin data available, use proportional allocation based on P/L
            strategy_pl = sum(trade.get("pl", 0) for trade in trades_data)
            total_pl = strategy_pl  # This is already filtered trades

            # Fallback: Use 20% of portfolio capital or $10,000, whichever is larger
            return max(full_portfolio_capital * 0.2, 10000.0)

        # Sort events by date and time
        margin_events.sort(key=lambda x: (x["date"], x["time"]))

        # Calculate maximum simultaneous margin exposure
        current_margin = 0.0
        max_margin = 0.0

        for event in margin_events:
            current_margin += event["margin_change"]
            max_margin = max(max_margin, current_margin)

        # The allocated capital should be at least the maximum margin exposure
        # but also consider that there needs to be some buffer for losses
        strategy_allocated_capital = max_margin

        # Add buffer for potential losses (10% of max margin or $5,000, whichever is larger)
        buffer = max(max_margin * 0.1, 5000.0)
        strategy_allocated_capital += buffer

        # Cap at full portfolio capital
        strategy_allocated_capital = min(strategy_allocated_capital, full_portfolio_capital)

        # Ensure minimum allocation
        strategy_allocated_capital = max(strategy_allocated_capital, 10000.0)

        return strategy_allocated_capital
