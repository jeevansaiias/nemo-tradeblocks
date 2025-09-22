import numpy as np
import pandas as pd
from typing import List, Dict, Any, Optional
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

            logger.info(
                f"Running Monte Carlo with {request.num_simulations} simulations, "
                f"mean return: {mean_return:.4f}, std: {std_return:.4f}"
            )

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

            logger.info(
                f"Monte Carlo completed. Expected return: {expected_return:.2f}, "
                f"VaR 95%: {var_95:.2f}"
            )

            return MonteCarloResult(
                simulations=simulations,
                percentiles=percentiles,
                final_values=final_values,
                var_95=var_95,
                expected_return=expected_return,
                std_deviation=std_deviation,
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

    def run_strategy_comparison(
        self,
        portfolio: Portfolio,
        strategies: List[str],
        num_simulations: int = 1000,
        days_forward: int = 252,
    ) -> Dict[str, MonteCarloResult]:
        """Run Monte Carlo simulation for multiple strategies for comparison"""
        try:
            results = {}

            for strategy in strategies:
                request = MonteCarloRequest(
                    strategy=strategy, num_simulations=num_simulations, days_forward=days_forward
                )
                results[strategy] = self.run_simulation(portfolio, request)

            return results

        except Exception as e:
            logger.error(f"Error running strategy comparison: {str(e)}")
            raise

    def run_bootstrap_simulation(
        self, portfolio: Portfolio, request: MonteCarloRequest, use_daily_returns: bool = False
    ) -> MonteCarloResult:
        """
        Run Monte Carlo simulation using bootstrap resampling from historical data.

        Args:
            portfolio: Portfolio containing historical trades
            request: Monte Carlo simulation parameters
            use_daily_returns: If True, bootstrap daily returns. If False, bootstrap individual trades

        Returns:
            MonteCarloResult with bootstrap-based simulations
        """
        try:
            # Filter trades by strategy if specified
            if request.strategy:
                trades = [trade for trade in portfolio.trades if trade.strategy == request.strategy]
                if not trades:
                    raise ValueError(f"No trades found for strategy: {request.strategy}")
            else:
                trades = portfolio.trades

            if len(trades) < 10:
                raise ValueError(
                    f"Insufficient trades for bootstrap simulation. Found {len(trades)} trades, need at least 10."
                )

            logger.info(f"Running bootstrap simulation with {len(trades)} historical trades")

            if use_daily_returns:
                # Bootstrap from daily returns
                return self._bootstrap_daily_returns(trades, request)
            else:
                # Bootstrap from individual trades
                return self._bootstrap_trades(trades, request)

        except Exception as e:
            logger.error(f"Error running bootstrap simulation: {str(e)}")
            raise

    def _bootstrap_trades(self, trades: List, request: MonteCarloRequest) -> MonteCarloResult:
        """Bootstrap from individual trade P/L values"""
        try:
            # Extract P/L values from trades
            trade_pls = [trade.pl for trade in trades]

            # Get base capital (use first trade's funds or default)
            base_capital = trades[0].funds_at_close if trades[0].funds_at_close > 0 else 100000

            simulations = []
            final_values = []

            for sim_idx in range(request.num_simulations):
                # Bootstrap sample trades with replacement
                sampled_pls = np.random.choice(trade_pls, size=request.days_forward, replace=True)

                # Calculate cumulative returns
                capital = base_capital
                path = []

                for pl in sampled_pls:
                    # Convert P/L to return
                    daily_return = pl / capital
                    capital += pl
                    path.append(daily_return)

                cumulative_returns = np.cumsum(path)
                simulations.append(cumulative_returns.tolist())
                final_values.append(cumulative_returns[-1])

            # Calculate percentiles
            percentiles = {}
            for confidence_level in request.confidence_levels:
                percentile_value = np.percentile(final_values, confidence_level * 100)
                percentiles[f"p{int(confidence_level * 100)}"] = percentile_value

            # Calculate VaR and statistics
            var_95 = np.percentile(final_values, 5)
            expected_return = np.mean(final_values)
            std_deviation = np.std(final_values)

            logger.info(
                f"Bootstrap completed. Expected return: {expected_return:.4f}, "
                f"VaR 95%: {var_95:.4f}, Std: {std_deviation:.4f}"
            )

            return MonteCarloResult(
                simulations=simulations,
                percentiles=percentiles,
                final_values=final_values,
                var_95=var_95,
                expected_return=expected_return,
                std_deviation=std_deviation,
            )

        except Exception as e:
            logger.error(f"Error in bootstrap trades: {str(e)}")
            raise

    def _bootstrap_daily_returns(
        self, trades: List, request: MonteCarloRequest
    ) -> MonteCarloResult:
        """Bootstrap from daily returns calculated from trades"""
        try:
            # Calculate daily returns from trades
            daily_returns = self._calculate_daily_returns(trades)

            if len(daily_returns) < 5:
                raise ValueError(
                    f"Insufficient daily returns for bootstrap. Found {len(daily_returns)}, need at least 5."
                )

            simulations = []
            final_values = []

            for sim_idx in range(request.num_simulations):
                # Bootstrap sample daily returns with replacement
                sampled_returns = np.random.choice(
                    daily_returns, size=request.days_forward, replace=True
                )

                # Calculate cumulative path
                cumulative_returns = np.cumsum(sampled_returns)
                simulations.append(cumulative_returns.tolist())
                final_values.append(cumulative_returns[-1])

            # Calculate percentiles
            percentiles = {}
            for confidence_level in request.confidence_levels:
                percentile_value = np.percentile(final_values, confidence_level * 100)
                percentiles[f"p{int(confidence_level * 100)}"] = percentile_value

            # Calculate VaR and statistics
            var_95 = np.percentile(final_values, 5)
            expected_return = np.mean(final_values)
            std_deviation = np.std(final_values)

            logger.info(
                f"Bootstrap (daily) completed. Expected return: {expected_return:.4f}, "
                f"VaR 95%: {var_95:.4f}, Std: {std_deviation:.4f}"
            )

            return MonteCarloResult(
                simulations=simulations,
                percentiles=percentiles,
                final_values=final_values,
                var_95=var_95,
                expected_return=expected_return,
                std_deviation=std_deviation,
            )

        except Exception as e:
            logger.error(f"Error in bootstrap daily returns: {str(e)}")
            raise
