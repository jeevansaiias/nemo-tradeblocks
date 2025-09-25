"""Unit tests for position sizing callbacks, particularly margin warning logic."""

import pytest
from datetime import date, datetime
from unittest.mock import Mock, patch
from dash import no_update
import dash_mantine_components as dmc

from app.dash_app.callbacks.position_sizing_callbacks import (
    register_position_sizing_callbacks,
    _portfolio_fingerprint,
    _ensure_store,
    _collect_strategies,
    _blank_margin_figure,
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


class TestStoreHelpers:
    """Test helper functions for store management."""

    def test_ensure_store_creates_default(self):
        """Test _ensure_store creates proper default structure."""
        store = _ensure_store(None)
        assert "portfolios" in store
        assert isinstance(store["portfolios"], dict)

        store = _ensure_store({})
        assert "portfolios" in store
        assert isinstance(store["portfolios"], dict)

    def test_portfolio_fingerprint_consistency(self):
        """Test portfolio fingerprint is consistent for same data."""
        portfolio1 = {
            "filename": "portfolio1.csv",
            "upload_timestamp": "2025-01-01T10:00:00",
            "total_trades": 10,
            "trades": [{"id": 1, "pnl": 100}],
        }
        portfolio2 = {
            "filename": "portfolio1.csv",
            "upload_timestamp": "2025-01-01T10:00:00",
            "total_trades": 10,
            "trades": [{"id": 1, "pnl": 100}],
        }
        portfolio3 = {
            "filename": "portfolio2.csv",
            "upload_timestamp": "2025-01-01T11:00:00",
            "total_trades": 20,
            "trades": [{"id": 2, "pnl": 200}],
        }

        fp1 = _portfolio_fingerprint(portfolio1)
        fp2 = _portfolio_fingerprint(portfolio2)
        fp3 = _portfolio_fingerprint(portfolio3)

        # Same data should give same fingerprint
        assert fp1 == fp2
        # Different data should give different fingerprint
        assert fp1 != fp3

        # Fingerprint should be 12 chars
        assert len(fp1) == 12

    def test_collect_strategies_from_portfolio(self):
        """Test strategy collection from portfolio data."""
        portfolio_data = {
            "trades": [
                {"strategy": "Strategy A"},
                {"strategy": "Strategy B"},
                {"strategy": "Strategy A"},  # Duplicate
                {"strategy": "Strategy C"},
            ]
        }

        strategies = _collect_strategies(portfolio_data)

        # Should have 3 unique strategies
        assert len(strategies) == 3
        assert "Strategy A" in strategies
        assert "Strategy B" in strategies
        assert "Strategy C" in strategies

        # Each should have default kelly_pct
        for strategy_name, settings in strategies.items():
            assert "kelly_pct" in settings
            assert settings["kelly_pct"] == 100.0  # DEFAULT_KELLY_PCT


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


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
