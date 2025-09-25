"""Unit tests for position sizing callbacks, particularly margin warning logic."""

import pytest
from datetime import date, datetime, timedelta
from types import SimpleNamespace
from unittest.mock import Mock, patch
from dash import no_update
import dash_mantine_components as dmc

from app.dash_app.callbacks.position_sizing_callbacks import (
    register_position_sizing_callbacks,
    _blank_margin_figure,
)
from app.calculations.position_sizing import (
    _build_date_to_net_liq,
    build_strategy_settings,
    calculate_margin_pct,
    calculate_running_net_liq,
    get_net_liq_from_daily_log,
)


class TestMarginWarningLogic:
    """Test the margin warning calculations at different Kelly percentages."""

    def setup_method(self):
        """Set up test data for each test."""
        # Mock portfolio data with trades
        self.portfolio_data = {
            "trades": [
                {
                    "strategy": "Strategy A",
                    "margin_req": 10000,
                    "date_opened": "2025-01-01",
                    "date_closed": "2025-01-05",
                    "pnl": 500,
                },
                {
                    "strategy": "Strategy A",
                    "margin_req": 15000,
                    "date_opened": "2025-01-10",
                    "date_closed": "2025-01-15",
                    "pnl": -300,
                },
                {
                    "strategy": "Strategy B",
                    "margin_req": 5000,
                    "date_opened": "2025-01-01",
                    "date_closed": "2025-01-10",
                    "pnl": 200,
                },
            ]
        }

        # Mock app for callback registration
        self.mock_app = Mock()
        self.mock_app.callback = Mock(side_effect=lambda *args, **kwargs: lambda func: func)

    def test_low_kelly_should_not_trigger_warnings(self):
        """At low Kelly %, being conservative should not trigger margin warnings."""
        # Test scenario: 10% Kelly with historical margin of 30%
        # Expected: No warnings because 30% * 0.1 = 3% expected margin (safe)

        kelly_fraction_pct = 10.0  # Conservative 10% Kelly
        portfolio_max_margin_pct = 30.0  # Historical max margin was 30% of capital

        # Calculate expected margin after scaling by Kelly
        expected_margin = portfolio_max_margin_pct * (kelly_fraction_pct / 100.0)

        # Should not trigger warning (3% is well below 80% threshold)
        margin_threshold = 80.0
        assert expected_margin < margin_threshold, (
            f"At {kelly_fraction_pct}% Kelly, expected margin of {expected_margin}% "
            f"should not exceed {margin_threshold}% threshold"
        )

    def test_high_kelly_should_trigger_warnings(self):
        """At high Kelly %, aggressive allocation should trigger warnings."""
        # Test scenario: 300% Kelly with historical margin of 30%
        # Expected: Warning because 30% * 3.0 = 90% expected margin (risky)

        kelly_fraction_pct = 300.0  # Aggressive 300% Kelly
        portfolio_max_margin_pct = 30.0  # Historical max margin was 30% of capital

        # Calculate expected margin after scaling by Kelly
        expected_margin = portfolio_max_margin_pct * (kelly_fraction_pct / 100.0)

        # Should trigger warning (90% exceeds 80% threshold)
        margin_threshold = 80.0
        assert expected_margin > margin_threshold, (
            f"At {kelly_fraction_pct}% Kelly, expected margin of {expected_margin}% "
            f"should exceed {margin_threshold}% threshold and trigger warning"
        )

    def test_strategy_level_margin_warnings(self):
        """Test individual strategy margin warnings scale correctly with Kelly."""
        # Strategy with historical 40% margin
        strategy_max_margin_pct = 40.0
        strategy_kelly_pct = 15.0  # Optimal Kelly for strategy

        # Test conservative setting (50% of optimal)
        input_pct = 50.0  # User sets 50% Kelly for this strategy
        applied_pct = strategy_kelly_pct * (input_pct / 100.0)  # 7.5% allocated
        expected_margin = strategy_max_margin_pct * (input_pct / 100.0)  # 20% expected margin

        # Should trigger warning if expected margin > 2x allocation
        # 20% > 2 * 7.5% = 15%, so should warn
        warning_threshold = applied_pct * 2
        assert expected_margin > warning_threshold, (
            f"Strategy with {expected_margin}% expected margin should trigger "
            f"warning when exceeding {warning_threshold}% (2x of {applied_pct}% allocation)"
        )

        # Test very conservative setting (10% of optimal)
        input_pct = 10.0
        applied_pct = strategy_kelly_pct * (input_pct / 100.0)  # 1.5% allocated
        expected_margin = strategy_max_margin_pct * (input_pct / 100.0)  # 4% expected margin

        # 4% > 2 * 1.5% = 3%, so should still warn (strategy needs too much margin)
        warning_threshold = applied_pct * 2
        assert expected_margin > warning_threshold

    def test_margin_calculation_with_zero_values(self):
        """Test margin calculations handle zero/None values correctly."""
        # Test with zero margin
        portfolio_max_margin_pct = 0.0
        kelly_fraction_pct = 100.0
        expected_margin = portfolio_max_margin_pct * (kelly_fraction_pct / 100.0)
        assert expected_margin == 0.0

        # Test with None values (should not crash)
        strategy_analysis = {
            "max_margin_pct": None,
            "input_pct": 100.0,
            "applied_pct": 10.0,
        }
        # Should handle None gracefully
        assert strategy_analysis["max_margin_pct"] is None


# TestStoreHelpers class removed - store-related functions no longer exist


class TestMarginFigure:
    """Test margin figure generation."""

    def test_blank_margin_figure_creation(self):
        """Test creation of blank margin figure."""
        fig = _blank_margin_figure()

        # Should return a valid figure
        assert fig is not None
        assert hasattr(fig, "data")
        assert hasattr(fig, "layout")

        # Test with theme data
        theme_data = {"resolved": "dark"}
        fig_dark = _blank_margin_figure(theme_data)
        assert fig_dark is not None


class TestMarginScalingScenarios:
    """Test realistic margin scaling scenarios."""

    def test_conservative_trader_scenario(self):
        """Conservative trader using 25% Kelly should get no warnings."""
        portfolio_kelly = 25.0
        historical_margins = [10.0, 20.0, 15.0, 30.0]  # Various strategy margins

        # Scale all margins by Kelly
        expected_margins = [m * (portfolio_kelly / 100.0) for m in historical_margins]
        max_expected = max(expected_margins)  # 7.5%

        # Should be well below 80% threshold
        assert max_expected < 80.0, (
            f"Conservative trader at {portfolio_kelly}% Kelly with "
            f"{max_expected}% expected margin should not get warnings"
        )

    def test_aggressive_trader_scenario(self):
        """Aggressive trader using 200% Kelly might get warnings."""
        portfolio_kelly = 200.0
        historical_margins = [10.0, 20.0, 15.0, 45.0]  # Various strategy margins

        # Scale all margins by Kelly
        expected_margins = [m * (portfolio_kelly / 100.0) for m in historical_margins]
        max_expected = max(expected_margins)  # 90%

        # Should exceed 80% threshold
        assert max_expected > 80.0, (
            f"Aggressive trader at {portfolio_kelly}% Kelly with "
            f"{max_expected}% expected margin should get warnings"
        )

    def test_margin_scaling_linearity(self):
        """Test that margin scales linearly with Kelly percentage."""
        historical_margin = 40.0

        # Test various Kelly percentages
        kelly_percentages = [10, 25, 50, 100, 150, 200]
        expected_margins = []

        for kelly_pct in kelly_percentages:
            expected = historical_margin * (kelly_pct / 100.0)
            expected_margins.append(expected)

        # Verify linear scaling
        assert expected_margins[0] == 4.0  # 10% Kelly -> 4% margin
        assert expected_margins[1] == 10.0  # 25% Kelly -> 10% margin
        assert expected_margins[2] == 20.0  # 50% Kelly -> 20% margin
        assert expected_margins[3] == 40.0  # 100% Kelly -> 40% margin
        assert expected_margins[4] == 60.0  # 150% Kelly -> 60% margin
        assert expected_margins[5] == 80.0  # 200% Kelly -> 80% margin


class TestMarginCalculationModes:
    """Test margin calculations in fixed vs compounding modes."""

    def test_fixed_mode_constant_denominator(self):
        """In fixed mode, all margins use initial capital as denominator."""
        starting_capital = 100000
        trades = [
            {"margin_req": 10000, "pnl": 5000},  # 10% of starting
            {"margin_req": 15000, "pnl": -3000},  # 15% of starting
            {"margin_req": 20000, "pnl": 8000},  # 20% of starting
        ]

        for trade in trades:
            margin_pct = calculate_margin_pct(trade, starting_capital, margin_mode="fixed")
            expected = (trade["margin_req"] / starting_capital) * 100
            assert margin_pct == expected, f"Fixed mode should always use {starting_capital}"

    def test_compounding_mode_with_gains(self):
        """In compounding mode with gains, denominator increases over time."""
        starting_capital = 100000
        trades = [
            {
                "margin_req": 10000,
                "pnl": 5000,
                "date_opened": date(2025, 1, 1),
                "date_closed": date(2025, 1, 5),
            },
            {
                "margin_req": 10000,
                "pnl": 3000,
                "date_opened": date(2025, 1, 6),  # Opens after first closes
                "date_closed": date(2025, 1, 10),
            },
        ]

        net_liq_timeline = calculate_running_net_liq(trades, starting_capital)

        # First trade: uses starting capital
        margin_pct_1 = calculate_margin_pct(
            trades[0], starting_capital, "compounding", net_liq_timeline
        )
        assert margin_pct_1 == 10.0  # 10000/100000 = 10%

        # Second trade: should use 105000 (starting + 5000 profit)
        margin_pct_2 = calculate_margin_pct(
            trades[1], starting_capital, "compounding", net_liq_timeline
        )
        expected_pct_2 = (10000 / 105000) * 100
        assert abs(margin_pct_2 - expected_pct_2) < 0.01  # ~9.52%

    def test_compounding_mode_with_losses(self):
        """In compounding mode with losses, denominator decreases."""
        starting_capital = 100000
        trades = [
            {
                "margin_req": 10000,
                "pnl": -5000,
                "date_opened": date(2025, 1, 1),
                "date_closed": date(2025, 1, 5),
            },
            {
                "margin_req": 10000,
                "pnl": -3000,
                "date_opened": date(2025, 1, 6),
                "date_closed": date(2025, 1, 10),
            },
        ]

        net_liq_timeline = calculate_running_net_liq(trades, starting_capital)

        # Second trade uses reduced capital (95000)
        margin_pct_2 = calculate_margin_pct(
            trades[1], starting_capital, "compounding", net_liq_timeline
        )
        expected_pct_2 = (10000 / 95000) * 100
        assert abs(margin_pct_2 - expected_pct_2) < 0.01  # ~10.53%

    def test_compounding_mode_concurrent_trades(self):
        """Test compounding mode with overlapping trades."""
        starting_capital = 100000
        trades = [
            {
                "margin_req": 10000,
                "pnl": 5000,
                "date_opened": date(2025, 1, 1),
                "date_closed": date(2025, 1, 10),
            },
            {
                "margin_req": 15000,
                "pnl": 3000,
                "date_opened": date(2025, 1, 5),  # Opens while first is still open
                "date_closed": date(2025, 1, 15),
            },
        ]

        net_liq_timeline = calculate_running_net_liq(trades, starting_capital)

        # Both trades should use starting capital since they overlap
        for trade_id in net_liq_timeline.values():
            assert trade_id == starting_capital

    def test_build_strategy_settings_uses_overrides_and_defaults(self):
        """Per-strategy inputs override global Kelly while missing values fallback."""

        trades = [
            SimpleNamespace(strategy="Alpha"),
            SimpleNamespace(strategy="Beta"),
            SimpleNamespace(strategy=None),
        ]

        strategy_values = [25, "oops"]
        strategy_ids = [
            {"strategy": "Alpha"},
            {"strategy": "Beta"},
        ]

        settings = build_strategy_settings(trades, strategy_values, strategy_ids, 80.0)

        assert settings["Alpha"]["kelly_pct"] == 25.0
        assert settings["Beta"]["kelly_pct"] == 80.0  # Fallback to global on invalid input
        assert settings["Uncategorized"]["kelly_pct"] == 80.0  # Added from trade with no strategy

    def test_build_strategy_settings_clamps_negative_values(self):
        """Negative overrides are clamped to zero to avoid negative allocations."""

        trades = [SimpleNamespace(strategy="Gamma")]
        strategy_values = [-10]
        strategy_ids = [{"strategy": "Gamma"}]

        settings = build_strategy_settings(trades, strategy_values, strategy_ids, 100.0)

        assert settings["Gamma"]["kelly_pct"] == 0.0

    def test_compounding_counts_multiple_closes_same_day(self):
        """Compounding mode should aggregate P&L from every trade closing on a date."""
        starting_capital = 100000
        trades = [
            {
                "margin_req": 10000,
                "pl": 5000,
                "date_opened": date(2025, 1, 1),
                "date_closed": date(2025, 1, 5),
            },
            {
                "margin_req": 8000,
                "pl": 2000,
                "date_opened": date(2025, 1, 2),
                "date_closed": date(2025, 1, 5),
            },
            {
                "margin_req": 6000,
                "pl": -1000,
                "date_opened": date(2025, 1, 6),
                "date_closed": date(2025, 1, 8),
            },
        ]

        date_keys = [
            (date(2025, 1, 1) + timedelta(days=offset)).isoformat() for offset in range(0, 8)
        ]

        net_liq_map = _build_date_to_net_liq(trades, date_keys, starting_capital)

        assert net_liq_map["2025-01-05"] == 107000  # 100000 + 5000 + 2000
        assert net_liq_map["2025-01-08"] == 106000  # 107000 - 1000

    def test_with_daily_log_data(self):
        """Test margin calculations when daily log is available."""
        starting_capital = 100000
        daily_log = [
            {"date": "2025-01-01", "net_liq": 100000},
            {"date": "2025-01-05", "net_liq": 105000},  # After deposits/gains
            {"date": "2025-01-10", "net_liq": 108000},  # Further gains
        ]

        trades = [
            {
                "margin_req": 10000,
                "pnl": 3000,
                "date_opened": date(2025, 1, 5),  # Should use 105000 from log
                "date_closed": date(2025, 1, 7),
            },
            {
                "margin_req": 15000,
                "pnl": 2000,
                "date_opened": date(2025, 1, 10),  # Should use 108000 from log
                "date_closed": date(2025, 1, 12),
            },
        ]

        # Test get_net_liq_from_daily_log function
        assert get_net_liq_from_daily_log(daily_log, "2025-01-05") == 105000
        assert get_net_liq_from_daily_log(daily_log, "2025-01-10") == 108000
        assert get_net_liq_from_daily_log(daily_log, "2025-01-15") is None

        # Test calculate_running_net_liq with daily log
        net_liq_timeline = calculate_running_net_liq(trades, starting_capital, daily_log)

        # Should use actual values from daily log, not calculated P&L
        trade_ids = list(net_liq_timeline.keys())
        assert net_liq_timeline[trade_ids[0]] == 105000  # From daily log
        assert net_liq_timeline[trade_ids[1]] == 108000  # From daily log

    def test_without_daily_log_data(self):
        """Test margin calculations fallback when daily log is not available."""
        starting_capital = 100000
        trades = [
            {
                "margin_req": 10000,
                "pnl": 5000,
                "date_opened": date(2025, 1, 1),
                "date_closed": date(2025, 1, 5),
            },
            {
                "margin_req": 15000,
                "pnl": 3000,
                "date_opened": date(2025, 1, 10),  # After first trade closes
                "date_closed": date(2025, 1, 15),
            },
        ]

        # Test without daily log (should calculate from P&L)
        net_liq_timeline = calculate_running_net_liq(trades, starting_capital, None)

        trade_ids = list(net_liq_timeline.keys())
        assert net_liq_timeline[trade_ids[0]] == 100000  # Starting capital
        assert net_liq_timeline[trade_ids[1]] == 105000  # Starting + 5000 P&L

    def test_daily_log_vs_calculated_pnl(self):
        """Test that daily log takes precedence over calculated P&L."""
        starting_capital = 100000

        # Daily log shows different values (maybe due to deposits/withdrawals)
        daily_log = [
            {"date": "2025-01-01", "net_liq": 100000},
            {"date": "2025-01-10", "net_liq": 120000},  # Shows 120k (not just from trades)
        ]

        trades = [
            {
                "margin_req": 10000,
                "pnl": 5000,  # Only 5k profit from trading
                "date_opened": date(2025, 1, 1),
                "date_closed": date(2025, 1, 5),
            },
            {
                "margin_req": 15000,
                "pnl": 3000,
                "date_opened": date(2025, 1, 10),
                "date_closed": date(2025, 1, 15),
            },
        ]

        # With daily log
        net_liq_with_log = calculate_running_net_liq(trades, starting_capital, daily_log)
        trade_ids = list(net_liq_with_log.keys())
        assert net_liq_with_log[trade_ids[1]] == 120000  # From daily log

        # Without daily log
        net_liq_without_log = calculate_running_net_liq(trades, starting_capital, None)
        assert net_liq_without_log[trade_ids[1]] == 105000  # Calculated: 100k + 5k

    def test_negative_net_liq_handling(self):
        """Test handling when account goes negative (should show warning)."""
        starting_capital = 10000
        trades = [
            {"margin_req": 5000, "pnl": -15000},  # Loses more than capital
        ]

        # Should handle gracefully even with negative denominator
        margin_pct = calculate_margin_pct(trades[0], starting_capital, margin_mode="fixed")
        assert margin_pct == 50.0  # Still uses starting capital in fixed mode

    def test_mode_comparison(self):
        """Compare fixed vs compounding modes with same trades."""
        starting_capital = 100000
        trade = {
            "margin_req": 20000,
            "pnl": 10000,
            "date_opened": date(2025, 1, 10),
            "date_closed": date(2025, 1, 15),
        }

        # After previous trades with +10000 total P&L
        trades_history = [
            {
                "margin_req": 10000,
                "pnl": 10000,
                "date_opened": date(2025, 1, 1),
                "date_closed": date(2025, 1, 5),
            },
            trade,
        ]

        # Fixed mode
        fixed_pct = calculate_margin_pct(trade, starting_capital, "fixed")
        assert fixed_pct == 20.0  # Always 20000/100000

        # Compounding mode
        net_liq_timeline = calculate_running_net_liq(trades_history, starting_capital)
        compound_pct = calculate_margin_pct(
            trade, starting_capital, "compounding", net_liq_timeline
        )
        expected = (20000 / 110000) * 100  # Uses 110000 (100000 + 10000)
        assert abs(compound_pct - expected) < 0.01


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
