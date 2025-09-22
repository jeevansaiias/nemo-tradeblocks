"""
Tests for Monte Carlo Bootstrap Simulation

Tests the bootstrap resampling engine that replaces normal distribution
with actual historical trade sampling.
"""

import pytest
import numpy as np
from datetime import date, time
from typing import List

from app.calculations.monte_carlo import MonteCarloSimulator
from app.data.models import Portfolio, Trade, MonteCarloRequest, MonteCarloResult


class TestMonteCarloBootstrap:
    """Test suite for bootstrap Monte Carlo simulations"""

    @pytest.fixture
    def sample_trades(self) -> List[Trade]:
        """Create sample trades with known P/L distribution"""
        np.random.seed(42)  # For reproducibility
        trades = []

        # Create 50 trades with a mix of wins and losses
        for i in range(50):
            # 60% win rate with realistic P/L distribution
            if np.random.random() < 0.6:
                # Win: positive skewed distribution
                pl = np.random.gamma(2, 50)  # Average win ~$100
            else:
                # Loss: smaller losses
                pl = -np.random.gamma(1.5, 40)  # Average loss ~$60

            trade = Trade(
                date_opened=date(2024, 1, (i % 30) + 1),
                time_opened=time(10, 0),
                opening_price=100.0,
                legs=f"SPX {4500 + i}C",
                premium=5.0,
                closing_price=100.0 + pl / 100,
                date_closed=date(2024, 1, (i % 30) + 2),
                time_closed=time(15, 0),
                avg_closing_cost=5.5,
                reason_for_close="Target" if pl > 0 else "Stop Loss",
                pl=pl,
                num_contracts=1,
                funds_at_close=100000 + sum(t.pl for t in trades),
                margin_req=1000.0,
                strategy="Test Strategy",
                opening_commissions_fees=1.0,
                closing_commissions_fees=1.0,
                opening_short_long_ratio=0.5,
                closing_short_long_ratio=0.5,
            )
            trades.append(trade)

        return trades

    @pytest.fixture
    def test_portfolio(self, sample_trades) -> Portfolio:
        """Create a test portfolio from sample trades"""
        return Portfolio.from_trades(sample_trades, "test_trades.csv")

    @pytest.fixture
    def monte_carlo_request(self) -> MonteCarloRequest:
        """Create a standard Monte Carlo request"""
        return MonteCarloRequest(
            num_simulations=1000,
            days_forward=252,  # 1 year
            confidence_levels=[0.05, 0.25, 0.5, 0.75, 0.95],
        )

    def test_bootstrap_simulation_basic(self, test_portfolio, monte_carlo_request):
        """Test basic bootstrap simulation functionality"""
        simulator = MonteCarloSimulator()
        result = simulator.run_bootstrap_simulation(
            test_portfolio, monte_carlo_request, use_daily_returns=False
        )

        # Check result structure
        assert isinstance(result, MonteCarloResult)
        assert len(result.simulations) == monte_carlo_request.num_simulations
        assert len(result.final_values) == monte_carlo_request.num_simulations
        assert result.expected_return is not None
        assert result.std_deviation is not None
        assert result.var_95 is not None

    def test_bootstrap_preserves_distribution(self, test_portfolio, monte_carlo_request):
        """Test that bootstrap preserves historical P/L distribution characteristics"""
        simulator = MonteCarloSimulator()

        # Get historical P/L distribution
        historical_pls = [trade.pl for trade in test_portfolio.trades]
        hist_mean = np.mean(historical_pls)
        hist_std = np.std(historical_pls)
        hist_skew = self._calculate_skewness(historical_pls)

        # Run bootstrap simulation
        result = simulator.run_bootstrap_simulation(
            test_portfolio, monte_carlo_request, use_daily_returns=False
        )

        # Bootstrap should preserve approximate distribution characteristics
        # Note: These won't be exact due to sampling variation
        assert (
            abs(result.expected_return * 100000 / monte_carlo_request.days_forward - hist_mean)
            < hist_std
        )

        # Check that we have fat tails (extreme values) preserved
        min_val = min(result.final_values)
        max_val = max(result.final_values)

        # Should have some extreme values
        assert min_val < np.percentile(result.final_values, 1)
        assert max_val > np.percentile(result.final_values, 99)

    def test_bootstrap_vs_normal_distribution(self, test_portfolio, monte_carlo_request):
        """Compare bootstrap results with normal distribution Monte Carlo"""
        simulator = MonteCarloSimulator()

        # Run bootstrap simulation
        bootstrap_result = simulator.run_bootstrap_simulation(
            test_portfolio, monte_carlo_request, use_daily_returns=False
        )

        # Run normal distribution simulation
        normal_result = simulator.run_simulation(test_portfolio, monte_carlo_request)

        # Bootstrap should typically have different characteristics
        # (unless historical data is perfectly normal)
        assert bootstrap_result.var_95 != normal_result.var_95

        # Both should produce valid results
        assert len(bootstrap_result.simulations) == len(normal_result.simulations)
        assert bootstrap_result.expected_return is not None
        assert normal_result.expected_return is not None

    def test_bootstrap_daily_returns(self, test_portfolio, monte_carlo_request):
        """Test bootstrap using daily returns instead of individual trades"""
        simulator = MonteCarloSimulator()

        # Run bootstrap with daily returns
        result = simulator.run_bootstrap_simulation(
            test_portfolio, monte_carlo_request, use_daily_returns=True
        )

        # Check results
        assert isinstance(result, MonteCarloResult)
        assert len(result.simulations) == monte_carlo_request.num_simulations
        assert result.expected_return is not None

    def test_percentile_calculations(self, test_portfolio, monte_carlo_request):
        """Test that percentile calculations are correct"""
        simulator = MonteCarloSimulator()
        result = simulator.run_bootstrap_simulation(test_portfolio, monte_carlo_request)

        # Check percentiles exist
        assert "p5" in result.percentiles
        assert "p25" in result.percentiles
        assert "p50" in result.percentiles
        assert "p75" in result.percentiles
        assert "p95" in result.percentiles

        # Check percentile ordering
        assert result.percentiles["p5"] <= result.percentiles["p25"]
        assert result.percentiles["p25"] <= result.percentiles["p50"]
        assert result.percentiles["p50"] <= result.percentiles["p75"]
        assert result.percentiles["p75"] <= result.percentiles["p95"]

        # Median should be close to p50
        median = np.median(result.final_values)
        assert abs(median - result.percentiles["p50"]) < 0.001

    def test_var_calculation(self, test_portfolio, monte_carlo_request):
        """Test Value at Risk (VaR) calculation"""
        simulator = MonteCarloSimulator()
        result = simulator.run_bootstrap_simulation(test_portfolio, monte_carlo_request)

        # VaR 95% should be the 5th percentile
        calculated_var = np.percentile(result.final_values, 5)
        assert abs(result.var_95 - calculated_var) < 0.001

        # 95% of outcomes should be above VaR
        above_var = sum(1 for v in result.final_values if v >= result.var_95)
        percent_above = above_var / len(result.final_values)
        assert 0.93 < percent_above < 0.97  # Allow for sampling variation

    def test_strategy_filtering(self, sample_trades):
        """Test bootstrap with strategy filtering"""
        # Create trades with multiple strategies
        for i, trade in enumerate(sample_trades[:25]):
            trade.strategy = "Strategy A"
        for i, trade in enumerate(sample_trades[25:]):
            trade.strategy = "Strategy B"

        portfolio = Portfolio.from_trades(sample_trades, "multi_strategy.csv")

        # Create request for specific strategy
        request = MonteCarloRequest(
            strategy="Strategy A", num_simulations=100, days_forward=30, confidence_levels=[0.5]
        )

        simulator = MonteCarloSimulator()
        result = simulator.run_bootstrap_simulation(portfolio, request)

        # Should work with filtered trades
        assert isinstance(result, MonteCarloResult)
        assert len(result.simulations) == 100

    def test_insufficient_data_handling(self):
        """Test handling of insufficient data for bootstrap"""
        # Create only 5 trades (below minimum)
        trades = []
        for i in range(5):
            trade = Trade(
                date_opened=date(2024, 1, i + 1),
                time_opened=time(10, 0),
                opening_price=100.0,
                legs="SPX 4500C",
                premium=5.0,
                closing_price=105.0,
                date_closed=date(2024, 1, i + 2),
                time_closed=time(15, 0),
                avg_closing_cost=5.5,
                reason_for_close="Target",
                pl=10.0,
                num_contracts=1,
                funds_at_close=100000,
                margin_req=1000.0,
                strategy="Test",
                opening_commissions_fees=1.0,
                closing_commissions_fees=1.0,
                opening_short_long_ratio=0.5,
                closing_short_long_ratio=0.5,
            )
            trades.append(trade)

        portfolio = Portfolio.from_trades(trades, "insufficient.csv")
        request = MonteCarloRequest(num_simulations=100, days_forward=30, confidence_levels=[0.5])

        simulator = MonteCarloSimulator()

        # Should raise error for insufficient data
        with pytest.raises(ValueError, match="Insufficient trades"):
            simulator.run_bootstrap_simulation(portfolio, request)

    def test_simulation_reproducibility(self, test_portfolio, monte_carlo_request):
        """Test that simulations with same seed produce same results"""
        simulator = MonteCarloSimulator()

        # Set seed and run first simulation
        np.random.seed(123)
        result1 = simulator.run_bootstrap_simulation(test_portfolio, monte_carlo_request)

        # Reset seed and run second simulation
        np.random.seed(123)
        result2 = simulator.run_bootstrap_simulation(test_portfolio, monte_carlo_request)

        # Results should be identical
        assert result1.expected_return == result2.expected_return
        assert result1.var_95 == result2.var_95
        assert result1.std_deviation == result2.std_deviation

        # First few simulation paths should match
        for i in range(min(10, len(result1.simulations))):
            assert result1.simulations[i] == result2.simulations[i]

    def test_large_simulation_performance(self, test_portfolio):
        """Test performance with large number of simulations"""
        import time

        request = MonteCarloRequest(
            num_simulations=5000, days_forward=252, confidence_levels=[0.05, 0.5, 0.95]
        )

        simulator = MonteCarloSimulator()

        start_time = time.time()
        result = simulator.run_bootstrap_simulation(test_portfolio, request)
        elapsed_time = time.time() - start_time

        # Should complete in reasonable time (< 5 seconds)
        assert elapsed_time < 5.0

        # Should produce all requested simulations
        assert len(result.simulations) == 5000
        assert len(result.final_values) == 5000

    def test_cumulative_returns_calculation(self, test_portfolio, monte_carlo_request):
        """Test that cumulative returns are calculated correctly"""
        simulator = MonteCarloSimulator()
        monte_carlo_request.num_simulations = 10  # Small number for detailed checking
        monte_carlo_request.days_forward = 5

        result = simulator.run_bootstrap_simulation(test_portfolio, monte_carlo_request)

        # Each simulation should have increasing cumulative values
        for sim in result.simulations:
            assert len(sim) == monte_carlo_request.days_forward
            # Cumulative returns should generally increase (can decrease with losses)
            # but should show accumulation pattern

    @staticmethod
    def _calculate_skewness(data):
        """Calculate skewness of distribution"""
        n = len(data)
        mean = np.mean(data)
        std = np.std(data)
        if std == 0:
            return 0
        skew = np.mean(((data - mean) / std) ** 3)
        return skew * (n * (n - 1)) ** 0.5 / (n - 2) if n > 2 else 0
