import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from collections import defaultdict
import logging

from app.data.models import calculate_max_drawdown_from_portfolio_values

logger = logging.getLogger(__name__)


class AdvancedStatsCalculator:
    """Calculate advanced portfolio statistics for the Geekistics tab"""

    def __init__(self, analysis_config=None):
        # Use analysis config if provided, otherwise use defaults
        if analysis_config:
            self.risk_free_rate = analysis_config.get("risk_free_rate", 2.0) / 100  # Convert percentage to decimal
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

    def calculate_return_on_margin_stats(self, trades_data: List[Dict]) -> Dict[str, float]:
        """Calculate return on margin statistics"""
        if not trades_data:
            return {
                'avg_return_on_margin': 0.0,
                'worst_trade_pct': 0.0,
                'best_trade_pct': 0.0,
                'std_dev_rom': 0.0
            }

        rom_values = []
        for trade in trades_data:
            pl = trade.get('pl', 0)
            margin = trade.get('margin_req', 0)

            if margin > 0:
                rom = (pl / margin) * 100  # Return on margin as percentage
                rom_values.append(rom)

        if not rom_values:
            return {
                'avg_return_on_margin': 0.0,
                'worst_trade_pct': 0.0,
                'best_trade_pct': 0.0,
                'std_dev_rom': 0.0
            }

        return {
            'avg_return_on_margin': np.mean(rom_values),
            'worst_trade_pct': np.min(rom_values),
            'best_trade_pct': np.max(rom_values),
            'std_dev_rom': np.std(rom_values)
        }

    def calculate_cagr(self, trades_data: List[Dict], initial_capital: float = 10000) -> float:
        """Calculate Compound Annual Growth Rate"""
        if not trades_data:
            return 0.0

        # Sort trades by date
        sorted_trades = sorted(trades_data, key=lambda x: x.get('date_opened', ''))

        if len(sorted_trades) < 2:
            return 0.0

        # Calculate total return
        total_pl = sum(trade.get('pl', 0) for trade in trades_data)
        final_value = initial_capital + total_pl

        if final_value <= 0:
            return -100.0  # Total loss

        # Calculate time period in years
        start_date = pd.to_datetime(sorted_trades[0].get('date_opened'))
        end_date = pd.to_datetime(sorted_trades[-1].get('date_closed') or sorted_trades[-1].get('date_opened'))

        years = (end_date - start_date).days / 365.25

        if years <= 0:
            return 0.0

        # CAGR formula: (Ending Value / Beginning Value)^(1/years) - 1
        cagr = ((final_value / initial_capital) ** (1 / years) - 1) * 100

        return cagr

    def calculate_sharpe_ratio(self, trades_data: List[Dict]) -> float:
        """Calculate Sharpe ratio"""
        if not trades_data:
            return 0.0

        # Calculate daily returns
        daily_returns = self._get_daily_returns(trades_data)

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
        sharpe = (np.mean(excess_returns) / np.std(excess_returns)) * np.sqrt(self.annualization_factor)

        return sharpe

    def calculate_sortino_ratio(self, trades_data: List[Dict]) -> float:
        """Calculate Sortino ratio (only considers downside volatility)"""
        if not trades_data:
            return 0.0

        daily_returns = self._get_daily_returns(trades_data)

        if len(daily_returns) < 2:
            return 0.0

        daily_risk_free = self.risk_free_rate / self.annualization_factor
        excess_returns = [r - daily_risk_free for r in daily_returns]

        # Only consider negative returns for downside deviation
        downside_returns = [r for r in excess_returns if r < 0]

        if not downside_returns:
            return float('inf')  # No downside volatility

        downside_deviation = np.std(downside_returns)

        if downside_deviation == 0:
            return float('inf')

        # Sortino ratio = (mean excess return) / (downside deviation)
        sortino = (np.mean(excess_returns) / downside_deviation) * np.sqrt(self.annualization_factor)

        return sortino

    def calculate_calmar_ratio(self, trades_data: List[Dict], initial_capital: float = 10000) -> float:
        """Calculate Calmar ratio (CAGR / Max Drawdown)"""
        if not trades_data:
            return 0.0

        cagr = self.calculate_cagr(trades_data, initial_capital)
        max_drawdown = self._calculate_max_drawdown_percentage(trades_data, initial_capital)

        if max_drawdown == 0:
            return float('inf') if cagr > 0 else 0.0

        return abs(cagr / max_drawdown)

    def calculate_time_in_drawdown(self, trades_data: List[Dict], initial_capital: float = 10000) -> float:
        """Calculate percentage of time spent in drawdown using OptionOmega methodology"""
        if not trades_data:
            return 0.0

        # Get portfolio timeline (same as max drawdown calculation)
        closed_trades = [trade for trade in trades_data if trade.get('date_closed')]
        if not closed_trades:
            return 0.0

        # Sort by close date and time
        sorted_trades = sorted(closed_trades, key=lambda x: (
            x.get('date_closed', ''),
            x.get('time_closed', '')
        ))

        # Track periods in drawdown
        peak = initial_capital
        periods_in_drawdown = 0
        total_periods = len(sorted_trades) + 1  # +1 for initial capital

        # Check initial state (not in drawdown)
        for trade in sorted_trades:
            portfolio_value = trade.get('funds_at_close', 0)

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
            return {'max_win_streak': 0, 'max_loss_streak': 0}

        # Sort trades by date
        sorted_trades = sorted(trades_data, key=lambda x: x.get('date_opened', ''))

        current_win_streak = 0
        current_loss_streak = 0
        max_win_streak = 0
        max_loss_streak = 0

        for trade in sorted_trades:
            pl = trade.get('pl', 0)

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

        return {
            'max_win_streak': max_win_streak,
            'max_loss_streak': max_loss_streak
        }

    def calculate_periodic_win_rates(self, trades_data: List[Dict]) -> Dict[str, float]:
        """Calculate monthly and weekly win rates"""
        if not trades_data:
            return {'monthly_win_rate': 0.0, 'weekly_win_rate': 0.0}

        # Group trades by month and week
        monthly_results = defaultdict(list)
        weekly_results = defaultdict(list)

        for trade in trades_data:
            date_str = trade.get('date_opened', '')
            if not date_str:
                continue

            try:
                date_obj = pd.to_datetime(date_str)
                pl = trade.get('pl', 0)

                # Monthly grouping (YYYY-MM)
                month_key = date_obj.strftime('%Y-%m')
                monthly_results[month_key].append(pl)

                # Weekly grouping (YYYY-WW)
                week_key = date_obj.strftime('%Y-%U')  # %U for week number
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

        return {
            'monthly_win_rate': monthly_win_rate,
            'weekly_win_rate': weekly_win_rate
        }

    def calculate_kelly_criterion(self, trades_data: List[Dict]) -> float:
        """Calculate Kelly criterion percentage"""
        if not trades_data:
            return 0.0

        wins = [trade.get('pl', 0) for trade in trades_data if trade.get('pl', 0) > 0]
        losses = [abs(trade.get('pl', 0)) for trade in trades_data if trade.get('pl', 0) < 0]

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

    def _get_daily_returns(self, trades_data: List[Dict]) -> List[float]:
        """Convert trades to daily returns"""
        daily_pl = defaultdict(float)

        for trade in trades_data:
            date_str = trade.get('date_opened', '')
            if date_str:
                daily_pl[date_str] += trade.get('pl', 0)

        # Convert to returns (assuming some base capital)
        base_capital = 10000
        daily_returns = []

        for pl in daily_pl.values():
            daily_return = pl / base_capital
            daily_returns.append(daily_return)

        return daily_returns

    def _calculate_max_drawdown_percentage(self, trades_data: List[Dict], initial_capital: float) -> float:
        """Calculate maximum drawdown as percentage using OptionOmega methodology"""
        return calculate_max_drawdown_from_portfolio_values(trades_data, initial_capital)