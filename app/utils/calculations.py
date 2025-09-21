import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from collections import defaultdict
import logging

from app.data.models import (
    Portfolio, Trade, CorrelationMatrix,
    OptimizationRequest, OptimizationResult
)

logger = logging.getLogger(__name__)


class PortfolioCalculator:
    """Utility class for portfolio calculations and metrics"""

    def calculate_correlation_matrix(self, portfolio: Portfolio) -> CorrelationMatrix:
        """Calculate correlation matrix between strategies"""
        try:
            # Group trades by strategy and date
            strategy_daily_returns = defaultdict(lambda: defaultdict(float))

            for trade in portfolio.trades:
                date_key = trade.date_opened.isoformat()
                strategy_daily_returns[trade.strategy][date_key] += trade.pl

            # Convert to DataFrame for correlation calculation
            strategies = list(strategy_daily_returns.keys())
            if len(strategies) < 2:
                # Return identity matrix if less than 2 strategies
                correlation_data = [[1.0 if i == j else 0.0 for j in range(len(strategies))] for i in range(len(strategies))]
                return CorrelationMatrix(
                    strategies=strategies,
                    correlation_data=correlation_data
                )

            # Get all unique dates
            all_dates = set()
            for strategy_data in strategy_daily_returns.values():
                all_dates.update(strategy_data.keys())

            # Create DataFrame
            data = {}
            for strategy in strategies:
                data[strategy] = [strategy_daily_returns[strategy].get(date, 0.0) for date in sorted(all_dates)]

            df = pd.DataFrame(data)
            correlation_matrix = df.corr()

            # Convert to list format
            correlation_data = correlation_matrix.values.tolist()

            return CorrelationMatrix(
                strategies=strategies,
                correlation_data=correlation_data
            )

        except Exception as e:
            logger.error(f"Error calculating correlation matrix: {str(e)}")
            raise

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
                cumulative_pl.append({
                    'date': date_key,
                    'cumulative_pl': running_total,
                    'trade_pl': trade.pl
                })

            # Calculate drawdown
            peak = 0
            drawdown_data = []
            for entry in cumulative_pl:
                if entry['cumulative_pl'] > peak:
                    peak = entry['cumulative_pl']
                drawdown = (entry['cumulative_pl'] - peak) / peak if peak != 0 else 0
                drawdown_data.append({
                    'date': entry['date'],
                    'drawdown': drawdown,
                    'peak': peak
                })

            # Monthly aggregation
            monthly_pl = defaultdict(float)
            for date_str, pl in daily_pl.items():
                month_key = date_str[:7]  # YYYY-MM
                monthly_pl[month_key] += pl

            monthly_data = [{'month': month, 'pl': pl} for month, pl in monthly_pl.items()]

            # Strategy performance
            strategy_performance = defaultdict(float)
            strategy_trade_count = defaultdict(int)

            for trade in portfolio.trades:
                strategy_performance[trade.strategy] += trade.pl
                strategy_trade_count[trade.strategy] += 1

            strategy_data = []
            for strategy, total_pl in strategy_performance.items():
                strategy_data.append({
                    'strategy': strategy,
                    'total_pl': total_pl,
                    'trade_count': strategy_trade_count[strategy],
                    'avg_pl_per_trade': total_pl / strategy_trade_count[strategy] if strategy_trade_count[strategy] > 0 else 0
                })

            return {
                'cumulative_pl': cumulative_pl,
                'drawdown': drawdown_data,
                'daily_pl': [{'date': date, 'pl': pl} for date, pl in daily_pl.items()],
                'monthly_pl': monthly_data,
                'strategy_performance': strategy_data
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
                margin_data.append({
                    'date': trade.date_opened.isoformat(),
                    'margin_req': trade.margin_req,
                    'funds_at_close': trade.funds_at_close,
                    'utilization': (trade.margin_req / trade.funds_at_close) * 100 if trade.funds_at_close > 0 else 0
                })

                if trade.margin_req > peak_margin:
                    peak_margin = trade.margin_req

                total_funds_data.append({
                    'date': trade.date_opened.isoformat(),
                    'funds': trade.funds_at_close
                })

            # Calculate average utilization
            avg_utilization = np.mean([entry['utilization'] for entry in margin_data])
            max_utilization = max([entry['utilization'] for entry in margin_data]) if margin_data else 0

            # Margin efficiency (P/L per dollar of margin)
            total_margin_used = sum([trade.margin_req for trade in portfolio.trades])
            total_pl = sum([trade.pl for trade in portfolio.trades])
            margin_efficiency = total_pl / total_margin_used if total_margin_used > 0 else 0

            return {
                'margin_timeline': margin_data,
                'funds_timeline': total_funds_data,
                'peak_margin': peak_margin,
                'avg_utilization': avg_utilization,
                'max_utilization': max_utilization,
                'margin_efficiency': margin_efficiency,
                'total_margin_used': total_margin_used
            }

        except Exception as e:
            logger.error(f"Error calculating margin utilization: {str(e)}")
            raise

    def optimize_portfolio(self, portfolio: Portfolio, request: OptimizationRequest) -> OptimizationResult:
        """Optimize portfolio allocation (simplified implementation)"""
        try:
            # Filter strategies if specified
            strategies = request.strategies if request.strategies else portfolio.strategies

            # Calculate returns for each strategy
            strategy_returns = {}
            strategy_volatility = {}

            for strategy in strategies:
                strategy_trades = [trade for trade in portfolio.trades if trade.strategy == strategy]
                if not strategy_trades:
                    continue

                returns = [trade.pl for trade in strategy_trades]
                strategy_returns[strategy] = np.mean(returns)
                strategy_volatility[strategy] = np.std(returns) if len(returns) > 1 else 0

            if not strategy_returns:
                raise ValueError("No valid strategies found for optimization")

            # Simple equal-weight optimization (in production, use proper optimization)
            num_strategies = len(strategy_returns)
            optimal_weights = {strategy: 1.0 / num_strategies for strategy in strategy_returns.keys()}

            # Calculate portfolio metrics
            expected_return = sum(weight * strategy_returns[strategy] for strategy, weight in optimal_weights.items())
            volatility = np.sqrt(sum((weight * strategy_volatility[strategy]) ** 2 for strategy, weight in optimal_weights.items()))
            sharpe_ratio = expected_return / volatility if volatility > 0 else 0

            # Generate simple efficient frontier (placeholder)
            efficient_frontier = []
            for risk_level in np.linspace(0.1, 2.0, 10):
                efficient_frontier.append({
                    'risk': risk_level * volatility,
                    'return': risk_level * expected_return * 0.8  # Simplified
                })

            return OptimizationResult(
                optimal_weights=optimal_weights,
                expected_return=expected_return,
                volatility=volatility,
                sharpe_ratio=sharpe_ratio,
                efficient_frontier=efficient_frontier
            )

        except Exception as e:
            logger.error(f"Error optimizing portfolio: {str(e)}")
            raise