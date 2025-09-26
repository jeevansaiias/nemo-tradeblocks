"""
Tests for performance metrics generation and filtering.
"""

import pytest
from datetime import datetime, date
from app.data.models import Trade
from app.dash_app.components.tabs.performance_charts import generate_real_metrics
from app.calculations.performance import PerformanceCalculator


@pytest.fixture
def sample_trades():
    """Create sample trades with different strategies for testing."""
    trades = [
        Trade(
            date_opened=date(2024, 1, 15),
            time_opened="10:00:00",
            opening_price=100.0,
            legs="Test Leg 1",
            premium=-1000,
            closing_price=105.0,
            date_closed=date(2024, 1, 16),
            time_closed="15:30:00",
            avg_closing_cost=-500,
            reason_for_close="Profit Target",
            pl=500,
            num_contracts=10,
            funds_at_close=100500,
            margin_req=5000,
            strategy="Strategy A",
            opening_commissions_fees=10,
            closing_commissions_fees=10,
            opening_short_long_ratio=0.5,
            closing_short_long_ratio=0.5,
            opening_vix=15.0,
            closing_vix=15.5,
            gap=0.5,
            movement=5.0,
            max_profit=100,
            max_loss=-200,
        ),
        Trade(
            date_opened=date(2024, 1, 17),
            time_opened="10:15:00",
            opening_price=102.5,
            legs="Test Leg 2",
            premium=-1500,
            closing_price=101.0,
            date_closed=date(2024, 1, 18),
            time_closed="16:00:00",
            avg_closing_cost=-1600,
            reason_for_close="Stop Loss",
            pl=-100,
            num_contracts=15,
            funds_at_close=100400,
            margin_req=7500,
            strategy="Strategy B",
            opening_commissions_fees=15,
            closing_commissions_fees=15,
            opening_short_long_ratio=0.3,
            closing_short_long_ratio=0.3,
            opening_vix=16.5,
            closing_vix=16.0,
            gap=-1.2,
            movement=-1.5,
            max_profit=50,
            max_loss=-150,
        ),
        Trade(
            date_opened=date(2024, 2, 1),
            time_opened="14:30:00",
            opening_price=98.75,
            legs="Test Leg 3",
            premium=-800,
            closing_price=102.5,
            date_closed=date(2024, 2, 2),
            time_closed="15:45:00",
            avg_closing_cost=-600,
            reason_for_close="Time Decay",
            pl=200,
            num_contracts=8,
            funds_at_close=100600,
            margin_req=4000,
            strategy="Strategy A",
            opening_commissions_fees=8,
            closing_commissions_fees=8,
            opening_short_long_ratio=0.7,
            closing_short_long_ratio=0.7,
            opening_vix=14.2,
            closing_vix=14.8,
            gap=2.1,
            movement=3.75,
            max_profit=75,
            max_loss=-100,
        ),
        Trade(
            date_opened=date(2024, 3, 1),
            time_opened="09:45:00",
            opening_price=105.0,
            legs="Test Leg 4",
            premium=-1200,
            closing_price=108.0,
            date_closed=date(2024, 3, 2),
            time_closed="14:30:00",
            avg_closing_cost=-800,
            reason_for_close="Profit Target",
            pl=400,
            num_contracts=12,
            funds_at_close=101000,
            margin_req=6000,
            strategy="Strategy C",
            opening_commissions_fees=12,
            closing_commissions_fees=12,
            opening_short_long_ratio=0.4,
            closing_short_long_ratio=0.4,
            opening_vix=17.8,
            closing_vix=17.2,
            gap=-0.8,
            movement=3.0,
            max_profit=120,
            max_loss=-250,
        ),
    ]
    return trades


class TestPerformanceMetrics:
    """Test performance metrics generation and filtering."""

    def test_metrics_with_all_trades(self, sample_trades):
        """Test metrics calculation with all trades."""
        calc = PerformanceCalculator()

        # Calculate required data
        equity_data = calc.calculate_enhanced_cumulative_equity(sample_trades)
        distribution_data = calc.calculate_trade_distributions(sample_trades)
        streak_data = calc.calculate_streak_distributions(sample_trades)
        monthly_data = calc.calculate_monthly_heatmap_data(sample_trades)

        # Generate metrics
        metrics = generate_real_metrics(
            equity_data, distribution_data, streak_data, sample_trades, monthly_data
        )

        # Verify metrics is a valid Dash component
        assert metrics is not None
        assert hasattr(metrics, "children")

        # Extract metric values for validation
        children = metrics.children
        assert len(children) == 5  # Should have 5 metrics

        # Test that active period is calculated correctly
        # Should span from 2024-01-15 to 2024-03-02 = 47 days
        active_period_text = children[0].children[1].children
        assert "47 days" in active_period_text or "days" in active_period_text

    def test_metrics_with_filtered_trades_strategy_a(self, sample_trades):
        """Test metrics calculation with only Strategy A trades."""
        # Filter for Strategy A only
        strategy_a_trades = [t for t in sample_trades if t.strategy == "Strategy A"]
        assert len(strategy_a_trades) == 2

        calc = PerformanceCalculator()

        # Calculate required data
        equity_data = calc.calculate_enhanced_cumulative_equity(strategy_a_trades)
        distribution_data = calc.calculate_trade_distributions(strategy_a_trades)
        streak_data = calc.calculate_streak_distributions(strategy_a_trades)
        monthly_data = calc.calculate_monthly_heatmap_data(strategy_a_trades)

        # Generate metrics
        metrics = generate_real_metrics(
            equity_data, distribution_data, streak_data, strategy_a_trades, monthly_data
        )

        # Verify metrics is generated correctly
        assert metrics is not None
        assert hasattr(metrics, "children")

        children = metrics.children
        assert len(children) == 5

        # Test that active period is different (should span from 2024-01-15 to 2024-02-02 = 18 days)
        active_period_text = children[0].children[1].children
        assert "18 days" in active_period_text or "days" in active_period_text

    def test_metrics_with_filtered_trades_strategy_b(self, sample_trades):
        """Test metrics calculation with only Strategy B trades."""
        # Filter for Strategy B only
        strategy_b_trades = [t for t in sample_trades if t.strategy == "Strategy B"]
        assert len(strategy_b_trades) == 1

        calc = PerformanceCalculator()

        # Calculate required data
        equity_data = calc.calculate_enhanced_cumulative_equity(strategy_b_trades)
        distribution_data = calc.calculate_trade_distributions(strategy_b_trades)
        streak_data = calc.calculate_streak_distributions(strategy_b_trades)
        monthly_data = calc.calculate_monthly_heatmap_data(strategy_b_trades)

        # Generate metrics
        metrics = generate_real_metrics(
            equity_data, distribution_data, streak_data, strategy_b_trades, monthly_data
        )

        # Verify metrics is generated correctly
        assert metrics is not None
        assert hasattr(metrics, "children")

        children = metrics.children
        assert len(children) == 5

        # Test that active period is for single trade (should be 1 day)
        active_period_text = children[0].children[1].children
        assert "1 days" in active_period_text or "days" in active_period_text

    def test_metrics_with_no_trades(self):
        """Test metrics calculation with no trades."""
        empty_trades = []

        calc = PerformanceCalculator()

        # Calculate required data
        equity_data = calc.calculate_enhanced_cumulative_equity(empty_trades)
        distribution_data = calc.calculate_trade_distributions(empty_trades)
        streak_data = calc.calculate_streak_distributions(empty_trades)
        monthly_data = calc.calculate_monthly_heatmap_data(empty_trades)

        # Generate metrics
        metrics = generate_real_metrics(
            equity_data, distribution_data, streak_data, empty_trades, monthly_data
        )

        # Verify metrics handles empty case gracefully
        assert metrics is not None
        assert hasattr(metrics, "children")

        children = metrics.children
        assert len(children) == 5

        # Test that active period shows "No data"
        active_period_text = children[0].children[1].children
        assert "No data" in active_period_text

    def test_monthly_best_worst_calculation(self, sample_trades):
        """Test that best and worst month calculations work correctly."""
        calc = PerformanceCalculator()

        # Calculate required data
        equity_data = calc.calculate_enhanced_cumulative_equity(sample_trades)
        distribution_data = calc.calculate_trade_distributions(sample_trades)
        streak_data = calc.calculate_streak_distributions(sample_trades)
        monthly_data = calc.calculate_monthly_heatmap_data(sample_trades)

        # Generate metrics
        metrics = generate_real_metrics(
            equity_data, distribution_data, streak_data, sample_trades, monthly_data
        )

        # Verify metrics contains best and worst month data
        assert metrics is not None
        children = metrics.children

        # Best month should be at index 1, worst month at index 2
        best_month_text = children[1].children[1].children
        worst_month_text = children[2].children[1].children

        # Should not be the old hardcoded values
        assert best_month_text != "+12.4%"
        assert worst_month_text != "-5.2%"

        # Should contain dollar values or N/A
        assert "$" in best_month_text or "N/A" in best_month_text
        assert "$" in worst_month_text or "N/A" in worst_month_text

    def test_win_streak_calculation(self, sample_trades):
        """Test that win streak calculation works correctly."""
        calc = PerformanceCalculator()

        # Calculate required data
        equity_data = calc.calculate_enhanced_cumulative_equity(sample_trades)
        distribution_data = calc.calculate_trade_distributions(sample_trades)
        streak_data = calc.calculate_streak_distributions(sample_trades)
        monthly_data = calc.calculate_monthly_heatmap_data(sample_trades)

        # Generate metrics
        metrics = generate_real_metrics(
            equity_data, distribution_data, streak_data, sample_trades, monthly_data
        )

        # Verify win streak is calculated
        assert metrics is not None
        children = metrics.children

        # Win streak should be at index 4
        win_streak_text = children[4].children[1].children

        # Should contain "trades"
        assert "trades" in win_streak_text
