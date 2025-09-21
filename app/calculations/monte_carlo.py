import numpy as np
import pandas as pd
from typing import List, Dict, Any
import logging
from collections import defaultdict

from app.data.models import Portfolio, MonteCarloRequest, MonteCarloResult

logger = logging.getLogger(__name__)


class MonteCarloSimulator:
    """Monte Carlo simulation for portfolio analysis"""

    def run_simulation(self, portfolio: Portfolio, request: MonteCarloRequest) -> MonteCarloResult:
        """Run Monte Carlo simulation on portfolio or specific strategy"""
        try:
            # Filter trades by strategy if specified
            if request.strategy:
                trades = [trade for trade in portfolio.trades if trade.strategy == request.strategy]
                if not trades:
                    raise ValueError(f"No trades found for strategy: {request.strategy}")
            else:
                trades = portfolio.trades

            # Calculate historical returns
            daily_returns = self._calculate_daily_returns(trades)

            if len(daily_returns) < 2:
                raise ValueError("Insufficient data for Monte Carlo simulation")

            # Calculate statistical parameters
            mean_return = np.mean(daily_returns)
            std_return = np.std(daily_returns)

            logger.info(f"Running Monte Carlo with {request.num_simulations} simulations, "
                       f"mean return: {mean_return:.4f}, std: {std_return:.4f}")

            # Run simulations
            simulations = []
            final_values = []

            for _ in range(request.num_simulations):
                # Generate random returns
                random_returns = np.random.normal(mean_return, std_return, request.days_forward)

                # Calculate cumulative path
                cumulative_returns = np.cumsum(random_returns)
                simulations.append(cumulative_returns.tolist())

                # Final value
                final_values.append(cumulative_returns[-1])

            # Calculate percentiles
            percentiles = {}
            for confidence_level in request.confidence_levels:
                percentile_value = np.percentile(final_values, confidence_level * 100)
                percentiles[f"p{int(confidence_level * 100)}"] = percentile_value

            # Calculate VaR (Value at Risk) at 95%
            var_95 = np.percentile(final_values, 5)  # 5th percentile = 95% VaR

            # Calculate expected metrics
            expected_return = np.mean(final_values)
            std_deviation = np.std(final_values)

            logger.info(f"Monte Carlo completed. Expected return: {expected_return:.2f}, "
                       f"VaR 95%: {var_95:.2f}")

            return MonteCarloResult(
                simulations=simulations,
                percentiles=percentiles,
                final_values=final_values,
                var_95=var_95,
                expected_return=expected_return,
                std_deviation=std_deviation
            )

        except Exception as e:
            logger.error(f"Error running Monte Carlo simulation: {str(e)}")
            raise

    def _calculate_daily_returns(self, trades: List) -> List[float]:
        """Calculate daily returns from trades"""
        try:
            # Group trades by date
            daily_pl = defaultdict(float)

            for trade in trades:
                date_key = trade.date_opened.isoformat()
                daily_pl[date_key] += trade.pl

            # Convert to sorted list of returns
            sorted_dates = sorted(daily_pl.keys())
            daily_returns = []

            # Calculate returns relative to some base capital (assuming $100k starting capital)
            base_capital = 100000

            for i, date in enumerate(sorted_dates):
                # Simple return calculation: daily_pl / capital
                # In practice, you might want to track actual capital changes
                daily_return = daily_pl[date] / base_capital
                daily_returns.append(daily_return)

            return daily_returns

        except Exception as e:
            logger.error(f"Error calculating daily returns: {str(e)}")
            raise

    def run_strategy_comparison(self, portfolio: Portfolio, strategies: List[str],
                               num_simulations: int = 1000, days_forward: int = 252) -> Dict[str, MonteCarloResult]:
        """Run Monte Carlo simulation for multiple strategies for comparison"""
        try:
            results = {}

            for strategy in strategies:
                request = MonteCarloRequest(
                    strategy=strategy,
                    num_simulations=num_simulations,
                    days_forward=days_forward
                )
                results[strategy] = self.run_simulation(portfolio, request)

            return results

        except Exception as e:
            logger.error(f"Error running strategy comparison: {str(e)}")
            raise