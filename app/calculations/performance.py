"""
Performance Charts Calculator

Calculates data for performance charts and visualizations.
"""

import numpy as np
from typing import List, Dict, Any
from collections import defaultdict
import logging

from app.data.models import Portfolio

logger = logging.getLogger(__name__)


class PerformanceCalculator:
    """Calculator for performance charts and visualizations"""

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
