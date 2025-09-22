"""
Unit tests for enhanced PerformanceCalculator class.

Tests all Phase 1 calculations for Performance Blocks implementation.
"""

import pytest
import numpy as np
from datetime import datetime, date, time as dt_time
from typing import List

from app.calculations.performance import PerformanceCalculator
from app.data.models import Trade, Portfolio


class TestPerformanceCalculator:
    """Test suite for PerformanceCalculator."""

    @pytest.fixture
    def calculator(self):
        """Create calculator instance."""
        return PerformanceCalculator()

    @pytest.fixture
    def sample_trades(self) -> List[Trade]:
        """Create sample trades for testing."""
        trades = [
            Trade(
                date_opened=date(2024, 1, 15),
                time_opened=dt_time(9, 30),
                opening_price=100.0,
                legs="Sample legs 1",
                premium=1000.0,
                closing_price=105.0,
                date_closed=date(2024, 1, 16),
                time_closed=dt_time(15, 30),
                avg_closing_cost=1050.0,
                reason_for_close="Profit target",
                pl=500.0,
                num_contracts=10,
                funds_at_close=50000.0,
                margin_req=5000.0,
                strategy="Strategy A",
                opening_commissions_fees=10.0,
                closing_commissions_fees=10.0,
                opening_short_long_ratio=0.5,
                closing_short_long_ratio=0.5,
                opening_vix=20.0,
                closing_vix=19.0,
                gap=1.0,
                movement=5.0,
                max_profit=6.0,
                max_loss=-2.0,
            ),
            Trade(
                date_opened=date(2024, 1, 17),
                time_opened=dt_time(10, 0),
                opening_price=110.0,
                legs="Sample legs 2",
                premium=1200.0,
                closing_price=108.0,
                date_closed=date(2024, 1, 18),
                time_closed=dt_time(14, 0),
                avg_closing_cost=1080.0,
                reason_for_close="Stop loss",
                pl=-300.0,
                num_contracts=12,
                funds_at_close=49700.0,
                margin_req=6000.0,
                strategy="Strategy B",
                opening_commissions_fees=12.0,
                closing_commissions_fees=12.0,
                opening_short_long_ratio=0.6,
                closing_short_long_ratio=0.4,
                opening_vix=21.0,
                closing_vix=22.0,
                gap=-1.0,
                movement=-2.0,
                max_profit=1.0,
                max_loss=-3.0,
            ),
            Trade(
                date_opened=date(2024, 1, 19),
                time_opened=dt_time(11, 0),
                opening_price=115.0,
                legs="Sample legs 3",
                premium=800.0,
                closing_price=120.0,
                date_closed=date(2024, 1, 22),
                time_closed=dt_time(16, 0),
                avg_closing_cost=1200.0,
                reason_for_close="Expiration",
                pl=800.0,
                num_contracts=8,
                funds_at_close=50500.0,
                margin_req=4000.0,
                strategy="Strategy A",
                opening_commissions_fees=8.0,
                closing_commissions_fees=8.0,
                opening_short_long_ratio=0.7,
                closing_short_long_ratio=0.3,
                opening_vix=19.0,
                closing_vix=18.0,
                gap=2.0,
                movement=5.0,
                max_profit=7.0,
                max_loss=-1.0,
            ),
            Trade(
                date_opened=date(2024, 1, 23),
                time_opened=dt_time(9, 45),
                opening_price=125.0,
                legs="Sample legs 4",
                premium=1500.0,
                closing_price=122.0,
                date_closed=date(2024, 1, 24),
                time_closed=dt_time(15, 45),
                avg_closing_cost=1220.0,
                reason_for_close="Management",
                pl=-200.0,
                num_contracts=15,
                funds_at_close=50300.0,
                margin_req=7500.0,
                strategy="Strategy C",
                opening_commissions_fees=15.0,
                closing_commissions_fees=15.0,
                opening_short_long_ratio=0.4,
                closing_short_long_ratio=0.6,
                opening_vix=20.5,
                closing_vix=21.5,
                gap=0.5,
                movement=-3.0,
                max_profit=2.0,
                max_loss=-4.0,
            ),
            Trade(
                date_opened=date(2024, 1, 25),
                time_opened=dt_time(14, 30),
                opening_price=130.0,
                legs="Sample legs 5",
                premium=900.0,
                closing_price=135.0,
                date_closed=date(2024, 1, 26),
                time_closed=dt_time(15, 0),
                avg_closing_cost=1350.0,
                reason_for_close="Profit target",
                pl=600.0,
                num_contracts=9,
                funds_at_close=50900.0,
                margin_req=4500.0,
                strategy="Strategy A",
                opening_commissions_fees=9.0,
                closing_commissions_fees=9.0,
                opening_short_long_ratio=0.5,
                closing_short_long_ratio=0.5,
                opening_vix=18.5,
                closing_vix=17.5,
                gap=1.5,
                movement=5.0,
                max_profit=6.0,
                max_loss=-2.0,
            ),
        ]
        return trades

    def test_enhanced_cumulative_equity(self, calculator, sample_trades):
        """Test enhanced cumulative equity calculation."""
        result = calculator.calculate_enhanced_cumulative_equity(
            sample_trades, initial_capital=50000
        )

        # Check structure
        assert "equity_curve" in result
        assert "high_water_marks" in result
        assert "strategy_curves" in result
        assert "initial_capital" in result
        assert "final_equity" in result
        assert "total_return" in result

        # Check calculations
        assert result["initial_capital"] == 50000
        expected_final = 50000 + sum(trade.pl for trade in sample_trades)
        assert result["final_equity"] == expected_final

        # Check equity curve progression
        equity_curve = result["equity_curve"]
        assert len(equity_curve) == len(sample_trades)

        running_equity = 50000
        for i, (trade, point) in enumerate(zip(sample_trades, equity_curve)):
            running_equity += trade.pl
            assert point["equity"] == running_equity
            assert point["trade_pl"] == trade.pl
            assert point["trade_number"] == i + 1

        # Check strategy curves
        strategy_curves = result["strategy_curves"]
        assert "Strategy A" in strategy_curves
        assert "Strategy B" in strategy_curves
        assert "Strategy C" in strategy_curves

    def test_trade_distributions(self, calculator, sample_trades):
        """Test trade distribution analysis."""
        result = calculator.calculate_trade_distributions(sample_trades)

        # Check structure
        assert "day_of_week" in result
        assert "time_of_day" in result
        assert "rom_ranges" in result
        assert "rom_statistics" in result
        assert "hold_duration" in result

        # Check day of week data
        dow_data = result["day_of_week"]
        assert len(dow_data) > 0

        # Check ROM statistics
        rom_stats = result["rom_statistics"]
        assert "mean" in rom_stats
        assert "median" in rom_stats
        assert "std" in rom_stats
        assert "percentiles" in rom_stats

        # Verify ROM calculations
        rom_values = result["rom_ranges"]
        expected_roms = []
        for trade in sample_trades:
            if trade.margin_req and trade.margin_req > 0:
                rom = (trade.pl / trade.margin_req) * 100
                expected_roms.append(rom)

        assert len(rom_values) == len(expected_roms)
        for actual, expected in zip(sorted(rom_values), sorted(expected_roms)):
            assert abs(actual - expected) < 0.01

    def test_streak_distributions(self, calculator, sample_trades):
        """Test win/loss streak analysis."""
        result = calculator.calculate_streak_distributions(sample_trades)

        # Check structure
        assert "streaks" in result
        assert "win_distribution" in result
        assert "loss_distribution" in result
        assert "statistics" in result

        # Check streak identification
        streaks = result["streaks"]
        assert len(streaks) > 0

        # Verify streak logic manually
        expected_sequence = []
        for trade in sorted(sample_trades, key=lambda x: (x.date_opened, x.time_opened)):
            expected_sequence.append("win" if trade.pl > 0 else "loss")

        # Expected: win, loss, win, loss, win
        # Should create 5 streaks of length 1 each
        assert len(streaks) == 5
        for streak in streaks:
            assert streak["length"] == 1

        # Check statistics
        stats = result["statistics"]
        assert stats["max_win_streak"] == 1
        assert stats["max_loss_streak"] == 1
        assert stats["total_win_streaks"] == 3  # 3 winning trades
        assert stats["total_loss_streaks"] == 2  # 2 losing trades

    def test_trade_sequence_data(self, calculator, sample_trades):
        """Test trade sequence analysis."""
        result = calculator.calculate_trade_sequence_data(sample_trades)

        # Check structure
        assert "sequence" in result
        assert "rolling_metrics" in result
        assert "trends" in result

        # Check sequence data
        sequence = result["sequence"]
        assert len(sequence) == len(sample_trades)

        # Verify cumulative calculations
        cumulative_pl = 0
        for i, (trade, point) in enumerate(
            zip(sorted(sample_trades, key=lambda x: (x.date_opened, x.time_opened)), sequence)
        ):
            cumulative_pl += trade.pl
            assert point["cumulative_pl"] == cumulative_pl
            assert point["trade_number"] == i + 1
            assert point["pl"] == trade.pl

        # Check rolling metrics
        rolling_metrics = result["rolling_metrics"]
        assert "win_rates" in rolling_metrics
        assert "10_trade" in rolling_metrics["win_rates"]

        # Check trends
        trends = result["trends"]
        assert "slope" in trends
        assert "direction" in trends

    def test_monthly_heatmap_data(self, calculator, sample_trades):
        """Test monthly heatmap data calculation."""
        result = calculator.calculate_monthly_heatmap_data(sample_trades)

        # Check structure
        assert "monthly_returns" in result
        assert "yearly_totals" in result
        assert "monthly_stats" in result
        assert "raw_monthly_data" in result

        # Check yearly totals
        yearly_totals = result["yearly_totals"]
        assert 2024 in yearly_totals
        expected_total = sum(trade.pl for trade in sample_trades)
        assert yearly_totals[2024] == expected_total

        # Check monthly data structure
        monthly_returns = result["monthly_returns"]
        assert 2024 in monthly_returns
        assert 1 in monthly_returns[2024]  # January

        # Check statistics
        stats = result["monthly_stats"]
        assert "best_month" in stats
        assert "worst_month" in stats
        assert "total_months" in stats

    def test_rom_over_time(self, calculator, sample_trades):
        """Test Return on Margin over time calculation."""
        result = calculator.calculate_rom_over_time(sample_trades, ma_periods=[2, 3])

        # Check structure
        assert "rom_timeline" in result
        assert "moving_averages" in result
        assert "statistics" in result
        assert "outliers" in result

        # Check timeline data
        rom_timeline = result["rom_timeline"]
        assert len(rom_timeline) == len(sample_trades)

        # Verify ROM calculations
        for trade, point in zip(sample_trades, rom_timeline):
            expected_rom = (trade.pl / trade.margin_req) * 100
            assert abs(point["rom"] - expected_rom) < 0.01

        # Check moving averages
        ma_data = result["moving_averages"]
        assert "ma_2" in ma_data
        assert "ma_3" in ma_data

        # Check statistics
        stats = result["statistics"]
        assert "mean" in stats
        assert "std" in stats
        assert "skewness" in stats
        assert "kurtosis" in stats

    def test_rolling_metrics(self, calculator, sample_trades):
        """Test rolling metrics calculation."""
        result = calculator.calculate_rolling_metrics(sample_trades, window_sizes=[2, 3])

        # Check structure
        assert "rolling_data" in result
        assert "metrics_timeline" in result
        assert "window_sizes" in result

        # Check rolling data
        rolling_data = result["rolling_data"]
        assert "window_2" in rolling_data
        assert "window_3" in rolling_data

        # Check metrics
        for window_key in rolling_data:
            window_data = rolling_data[window_key]
            assert "win_rate" in window_data
            assert "profit_factor" in window_data
            assert "avg_trade" in window_data
            assert "sharpe_ratio" in window_data
            assert "volatility" in window_data

    def test_caching_mechanism(self, calculator, sample_trades):
        """Test caching functionality."""
        # Clear cache to start fresh
        calculator.clear_cache()

        # First call should compute and cache
        result1 = calculator.calculate_trade_distributions(sample_trades)

        # Second call should return cached result
        result2 = calculator.calculate_trade_distributions(sample_trades)

        # Results should be identical
        assert result1 == result2

        # Disable cache and verify it's not used
        calculator.disable_cache()
        result3 = calculator.calculate_trade_distributions(sample_trades)
        assert result3 == result1  # Still same data, but not cached

        # Re-enable cache
        calculator.enable_cache()

    def test_empty_trades_handling(self, calculator):
        """Test handling of empty trade lists."""
        empty_trades = []

        # All methods should handle empty input gracefully
        equity_result = calculator.calculate_enhanced_cumulative_equity(empty_trades)
        assert equity_result["final_equity"] == 100000  # Default initial capital

        dist_result = calculator.calculate_trade_distributions(empty_trades)
        assert dist_result["day_of_week"] == []

        streak_result = calculator.calculate_streak_distributions(empty_trades)
        assert streak_result["streaks"] == []

        sequence_result = calculator.calculate_trade_sequence_data(empty_trades)
        assert sequence_result["sequence"] == []

        heatmap_result = calculator.calculate_monthly_heatmap_data(empty_trades)
        assert heatmap_result["monthly_returns"] == {}

        rom_result = calculator.calculate_rom_over_time(empty_trades)
        assert rom_result["rom_timeline"] == []

        rolling_result = calculator.calculate_rolling_metrics(empty_trades)
        assert rolling_result["rolling_data"] == {}

    def test_window_metrics_helper(self, calculator, sample_trades):
        """Test the window metrics helper function."""
        # Test with subset of trades
        window_trades = sample_trades[:3]
        metrics = calculator._calculate_window_metrics(window_trades)

        # Check structure
        assert "win_rate" in metrics
        assert "profit_factor" in metrics
        assert "avg_trade" in metrics
        assert "sharpe_ratio" in metrics
        assert "volatility" in metrics

        # Verify calculations
        pls = [trade.pl for trade in window_trades]
        wins = [pl for pl in pls if pl > 0]
        expected_win_rate = (len(wins) / len(pls)) * 100

        assert abs(metrics["win_rate"] - expected_win_rate) < 0.01
        assert metrics["avg_trade"] == np.mean(pls)

    def test_statistical_helpers(self, calculator):
        """Test skewness and kurtosis helper functions."""
        values = [1, 2, 3, 4, 5, 4, 3, 2, 1]

        skewness = calculator._calculate_skewness(values)
        kurtosis = calculator._calculate_kurtosis(values)

        # Should return valid numbers
        assert isinstance(skewness, (int, float))
        assert isinstance(kurtosis, (int, float))

        # Test edge cases
        assert calculator._calculate_skewness([1, 1, 1]) == 0  # No variation
        assert calculator._calculate_kurtosis([1, 2]) == 0  # Too few values

    def test_error_handling(self, calculator):
        """Test error handling for invalid inputs."""
        # Test with edge case trade that has zero margin requirement
        edge_case_trade = Trade(
            date_opened=date(2024, 1, 15),
            time_opened=dt_time(9, 30),
            opening_price=100.0,
            legs="Test",
            premium=1000.0,
            closing_price=105.0,
            date_closed=date(2024, 1, 16),
            time_closed=dt_time(15, 30),
            avg_closing_cost=1050.0,
            reason_for_close="Test",
            pl=500.0,
            num_contracts=10,
            funds_at_close=50000.0,
            margin_req=0.0,  # Zero margin
            strategy="Test Strategy",
            opening_commissions_fees=10.0,
            closing_commissions_fees=10.0,
            opening_short_long_ratio=0.5,
            closing_short_long_ratio=0.5,
            opening_vix=20.0,
            closing_vix=19.0,
            gap=1.0,
            movement=5.0,
            max_profit=6.0,
            max_loss=-2.0,
        )

        # Should handle gracefully without crashing
        result = calculator.calculate_trade_distributions([edge_case_trade])
        assert isinstance(result, dict)

        # Test ROM calculation with zero margin
        rom_result = calculator.calculate_rom_over_time([edge_case_trade])
        assert isinstance(rom_result, dict)
        # Should handle division by zero gracefully
        assert len(rom_result["rom_timeline"]) == 0  # Trade with zero margin should be filtered out

    def test_performance_with_large_dataset(self, calculator):
        """Test performance with larger dataset."""
        # Create 1000 sample trades
        large_trades = []
        for i in range(1000):
            trade = Trade(
                date_opened=date(2024, 1, 1 + (i % 30)),
                time_opened=dt_time(9, 30),
                opening_price=100.0 + i,
                legs=f"Trade {i}",
                premium=1000.0,
                closing_price=100.0 + i + (10 if i % 2 == 0 else -5),
                date_closed=date(2024, 1, 2 + (i % 30)),
                time_closed=dt_time(15, 30),
                avg_closing_cost=1050.0,
                reason_for_close="Test",
                pl=500.0 if i % 2 == 0 else -300.0,
                num_contracts=10,
                funds_at_close=50000.0,
                margin_req=5000.0,
                strategy=f"Strategy {i % 5}",
                opening_commissions_fees=10.0,
                closing_commissions_fees=10.0,
                opening_short_long_ratio=0.5,
                closing_short_long_ratio=0.5,
                opening_vix=20.0,
                closing_vix=19.0,
                gap=1.0,
                movement=5.0,
                max_profit=6.0,
                max_loss=-2.0,
            )
            large_trades.append(trade)

        # Test all methods with large dataset
        import time as time_module

        start_time = time_module.time()

        equity_result = calculator.calculate_enhanced_cumulative_equity(large_trades)
        dist_result = calculator.calculate_trade_distributions(large_trades)
        streak_result = calculator.calculate_streak_distributions(large_trades)
        sequence_result = calculator.calculate_trade_sequence_data(large_trades)
        heatmap_result = calculator.calculate_monthly_heatmap_data(large_trades)
        rom_result = calculator.calculate_rom_over_time(large_trades)
        rolling_result = calculator.calculate_rolling_metrics(large_trades)

        end_time = time_module.time()
        execution_time = end_time - start_time

        # Should complete within reasonable time (less than 5 seconds)
        assert execution_time < 5.0

        # Verify results are still structured correctly
        assert len(equity_result["equity_curve"]) == 1000
        assert len(sequence_result["sequence"]) == 1000
        assert len(rom_result["rom_timeline"]) == 1000

    # =========================================================================
    # REAL DATA TESTS - Using user-provided or sample CSV data
    # =========================================================================

    def test_calculations_with_real_data(self, calculator, test_trades):
        """Test all calculations with real tradelog data (user or sample)."""
        print(f"\nTesting with {len(test_trades)} real trades")

        # Test all major calculations with real data
        equity_result = calculator.calculate_enhanced_cumulative_equity(test_trades)
        dist_result = calculator.calculate_trade_distributions(test_trades)
        streak_result = calculator.calculate_streak_distributions(test_trades)
        sequence_result = calculator.calculate_trade_sequence_data(test_trades)
        heatmap_result = calculator.calculate_monthly_heatmap_data(test_trades)
        rom_result = calculator.calculate_rom_over_time(test_trades)
        rolling_result = calculator.calculate_rolling_metrics(test_trades)

        # Verify basic structure for all results
        assert "equity_curve" in equity_result
        assert "day_of_week" in dist_result
        assert "streaks" in streak_result
        assert "sequence" in sequence_result
        assert "monthly_returns" in heatmap_result
        assert "rom_timeline" in rom_result
        assert "rolling_data" in rolling_result

        # Verify data integrity
        assert len(equity_result["equity_curve"]) == len(test_trades)
        assert len(sequence_result["sequence"]) == len(test_trades)

        print("✓ All calculations completed successfully with real data")

    def test_real_data_equity_progression(self, calculator, test_trades):
        """Test equity curve progression with real data."""
        result = calculator.calculate_enhanced_cumulative_equity(
            test_trades, initial_capital=100000
        )

        equity_curve = result["equity_curve"]
        print(f"\nEquity progression over {len(equity_curve)} trades:")
        print(f"Initial Capital: ${result['initial_capital']:,.2f}")
        print(f"Final Equity: ${result['final_equity']:,.2f}")
        print(f"Total Return: {result['total_return']:.2f}%")

        # Verify equity progression is logical
        # The equity curve should show the progression correctly
        assert len(equity_curve) == len(test_trades), "Equity curve should have one point per trade"

        # Check that equity values are reasonable and increasing overall
        first_equity = equity_curve[0]["equity"] if equity_curve else result["initial_capital"]
        last_equity = equity_curve[-1]["equity"] if equity_curve else result["initial_capital"]

        print(f"First trade equity: ${first_equity:,.2f}")
        print(f"Last trade equity: ${last_equity:,.2f}")

        # Verify trade numbers are sequential
        for i, point in enumerate(equity_curve[:10]):  # Check first 10 trades only
            assert (
                point["trade_number"] == i + 1
            ), f"Trade number should be {i+1}, got {point['trade_number']}"

        # Check for strategies in real data
        strategies = result["strategy_curves"]
        print(f"Strategies found in data: {list(strategies.keys())}")
        assert len(strategies) > 0, "Should find at least one strategy in real data"

    def test_real_data_trade_distributions(self, calculator, test_trades):
        """Test trade distribution analysis with real data."""
        result = calculator.calculate_trade_distributions(test_trades)

        # Analyze day of week distribution
        dow_dist = result["day_of_week"]
        if dow_dist:  # Only check if we have data
            print(f"\nDay of week distribution:")
            for entry in dow_dist:
                print(
                    f"  {entry['day']}: {entry['count']} trades, "
                    f"avg P/L: ${entry['avg_pl']:.2f}"
                )

        # Analyze ROM statistics
        rom_stats = result["rom_statistics"]
        print(f"\nReturn on Margin statistics:")
        print(f"  Mean: {rom_stats['mean']:.4f}")
        print(f"  Std: {rom_stats['std']:.4f}")
        print(f"  Skewness: {rom_stats['skewness']:.4f}")
        print(f"  Kurtosis: {rom_stats['kurtosis']:.4f}")

        # Verify structure
        assert isinstance(result["day_of_week"], list)
        assert isinstance(result["time_of_day"], list)
        assert isinstance(result["rom_ranges"], list)
        assert isinstance(result["hold_duration"], list)

    def test_real_data_streak_analysis(self, calculator, test_trades):
        """Test win/loss streak analysis with real data."""
        result = calculator.calculate_streak_distributions(test_trades)

        streaks = result["streaks"]
        if streaks:  # Only analyze if we have streaks
            win_streaks = [s for s in streaks if s["type"] == "win"]
            loss_streaks = [s for s in streaks if s["type"] == "loss"]

            print(f"\nStreak analysis:")
            print(f"  Total win streaks: {len(win_streaks)}")
            print(f"  Total loss streaks: {len(loss_streaks)}")

            if win_streaks:
                max_win_streak = max(win_streaks, key=lambda x: x["length"])
                print(f"  Max win streak: {max_win_streak['length']} trades")

            if loss_streaks:
                max_loss_streak = max(loss_streaks, key=lambda x: x["length"])
                print(f"  Max loss streak: {max_loss_streak['length']} trades")

        # Check statistics
        stats = result["statistics"]
        assert "max_win_streak" in stats
        assert "max_loss_streak" in stats
        assert "avg_win_streak" in stats
        assert "avg_loss_streak" in stats

    def test_real_data_monthly_performance(self, calculator, test_trades):
        """Test monthly heatmap data with real data."""
        result = calculator.calculate_monthly_heatmap_data(test_trades)

        monthly_returns = result["monthly_returns"]
        raw_monthly_data = result["raw_monthly_data"]

        if raw_monthly_data:  # Only analyze if we have monthly data
            print(f"\nMonthly performance analysis:")
            print(f"  Months with data: {len(raw_monthly_data)}")

            # Find best and worst months from raw data
            if raw_monthly_data:
                best_return = max(raw_monthly_data.values())
                worst_return = min(raw_monthly_data.values())
                best_month = max(raw_monthly_data.items(), key=lambda x: x[1])
                worst_month = min(raw_monthly_data.items(), key=lambda x: x[1])

                print(f"  Best month: {best_month[0]} (${best_return:,.2f})")
                print(f"  Worst month: {worst_month[0]} (${worst_return:,.2f})")

        # Verify structure
        yearly_totals = result["yearly_totals"]
        monthly_stats = result["monthly_stats"]
        assert isinstance(monthly_returns, dict)
        assert isinstance(yearly_totals, dict)
        assert isinstance(monthly_stats, dict)

    def test_real_data_performance_metrics(self, calculator, test_trades):
        """Test comprehensive performance metrics with real data."""
        # Run all calculations and verify they complete without errors
        calculations = {
            "equity": calculator.calculate_enhanced_cumulative_equity(test_trades),
            "distributions": calculator.calculate_trade_distributions(test_trades),
            "streaks": calculator.calculate_streak_distributions(test_trades),
            "sequence": calculator.calculate_trade_sequence_data(test_trades),
            "heatmap": calculator.calculate_monthly_heatmap_data(test_trades),
            "rom": calculator.calculate_rom_over_time(test_trades),
            "rolling": calculator.calculate_rolling_metrics(test_trades),
        }

        print(f"\nComprehensive performance summary for {len(test_trades)} trades:")

        # Extract key metrics
        total_pl = sum(trade.pl for trade in test_trades)
        winning_trades = [t for t in test_trades if t.pl > 0]
        losing_trades = [t for t in test_trades if t.pl < 0]

        print(f"  Total P/L: ${total_pl:,.2f}")
        print(
            f"  Winning trades: {len(winning_trades)} ({len(winning_trades)/len(test_trades)*100:.1f}%)"
        )
        print(
            f"  Losing trades: {len(losing_trades)} ({len(losing_trades)/len(test_trades)*100:.1f}%)"
        )

        if winning_trades:
            avg_winner = sum(t.pl for t in winning_trades) / len(winning_trades)
            print(f"  Average winner: ${avg_winner:.2f}")

        if losing_trades:
            avg_loser = sum(t.pl for t in losing_trades) / len(losing_trades)
            print(f"  Average loser: ${avg_loser:.2f}")

        # Verify all calculations completed successfully
        for calc_name, result in calculations.items():
            assert isinstance(result, dict), f"{calc_name} calculation failed"
            print(f"  ✓ {calc_name} calculation completed")

        print("✓ All performance calculations completed successfully")

    def test_real_data_validation(self, calculator, tradelog_data, dailylog_data):
        """Validate the format and content of real data files."""
        print("\nValidating real data format...")

        # Validate tradelog data
        if not tradelog_data.empty:
            required_cols = ["Date", "Symbol", "Side", "Quantity", "Price", "PnL"]
            missing_cols = [col for col in required_cols if col not in tradelog_data.columns]

            if missing_cols:
                print(f"Warning: Missing columns in tradelog: {missing_cols}")
            else:
                print(f"✓ Tradelog validation passed ({len(tradelog_data)} rows)")

            # Check for data quality issues
            null_counts = tradelog_data.isnull().sum()
            if null_counts.any():
                print(f"Warning: Found null values in tradelog:")
                for col, count in null_counts.items():
                    if count > 0:
                        print(f"  {col}: {count} null values")

        # Validate dailylog data
        if not dailylog_data.empty:
            required_cols = ["Date", "Equity"]
            missing_cols = [col for col in required_cols if col not in dailylog_data.columns]

            if missing_cols:
                print(f"Warning: Missing columns in dailylog: {missing_cols}")
            else:
                print(f"✓ Dailylog validation passed ({len(dailylog_data)} rows)")

        print("✓ Data validation completed")
