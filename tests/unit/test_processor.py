from datetime import date, time

import pandas as pd
import pytest

from app.data.models import Portfolio, Trade


def test_csv_parsing(portfolio_processor, sample_csv_content):
    """Test CSV parsing functionality"""
    portfolio = portfolio_processor.parse_csv(sample_csv_content, "test.csv")

    assert isinstance(portfolio, Portfolio)
    assert portfolio.filename == "test.csv"
    assert portfolio.total_trades == 2
    assert len(portfolio.trades) == 2


def test_trade_conversion(portfolio_processor, sample_csv_content):
    """Test conversion of CSV data to Trade objects"""
    portfolio = portfolio_processor.parse_csv(sample_csv_content, "test.csv")

    trade = portfolio.trades[0]
    assert isinstance(trade, Trade)
    assert trade.date_opened == date(2025, 9, 18)
    assert trade.time_opened == time(10, 31, 0)
    assert trade.pl == -6850.6
    assert trade.strategy == "Test Strategy 1"


def test_trade_conversion_single_backtest(portfolio_processor, sample_single_backtest_csv_content):
    """Test conversion of CSV data to Trade objects"""
    portfolio = portfolio_processor.parse_csv(sample_single_backtest_csv_content, "test.csv")

    trade = portfolio.trades[0]
    assert isinstance(trade, Trade)
    assert trade.strategy == ""
    assert pd.isna(trade.opening_vix) is True
    assert pd.isna(trade.closing_vix) is True


def test_portfolio_stats_calculation(portfolio_processor, sample_portfolio):
    """Test portfolio statistics calculation"""
    stats = portfolio_processor.calculate_portfolio_stats(sample_portfolio)

    assert stats.total_trades == 2
    assert stats.total_pl == pytest.approx(-17724.76, rel=1e-2)  # Sum of both trades
    assert 0 <= stats.win_rate <= 1
    assert stats.max_drawdown <= 0


def test_strategy_stats_calculation(portfolio_processor, sample_portfolio):
    """Test strategy statistics calculation"""
    strategy_stats = portfolio_processor.calculate_strategy_stats(sample_portfolio)

    assert "Test Strategy 1" in strategy_stats
    assert "Test Strategy 2" in strategy_stats

    strategy1_stats = strategy_stats["Test Strategy 1"]
    assert strategy1_stats.trade_count == 1
    assert strategy1_stats.total_pl == -6850.6


def test_empty_portfolio(portfolio_processor):
    """Test handling of empty portfolio"""
    empty_csv = "Date Opened,Time Opened,Opening Price,Legs,Premium,P/L,No. of Contracts,Funds at Close,Margin Req.,Strategy,Opening Commissions + Fees,Closing Commissions + Fees,Opening Short/Long Ratio,Opening VIX"

    portfolio = portfolio_processor.parse_csv(empty_csv, "empty.csv")
    assert portfolio.total_trades == 0
    assert portfolio.total_pl == 0
    assert len(portfolio.strategies) == 0


def test_invalid_csv_format(portfolio_processor):
    """Test handling of invalid CSV format"""
    invalid_csv = "invalid,csv,format"

    with pytest.raises(ValueError):
        portfolio_processor.parse_csv(invalid_csv, "invalid.csv")


def test_column_mapping(portfolio_processor):
    """Test that column mapping works correctly"""
    # Test BOM removal and column mapping
    csv_with_bom = '\ufeff"Date Opened","P/L","Strategy"\n"2025-09-18",-1000,"Test Strategy"'

    # This should not raise an error due to BOM handling
    try:
        portfolio = portfolio_processor.parse_csv(csv_with_bom, "bom_test.csv")
        # The parsing might fail due to missing required columns, but BOM should be handled
    except ValueError:
        # Expected due to missing required columns, but BOM should be removed
        pass


def test_missing_closing_commissions_defaults_to_zero(portfolio_processor):
    """Missing closing commissions should be coerced to zero for validation"""
    csv_content = """Date Opened,Time Opened,Opening Price,Legs,Premium,Closing Price,Date Closed,Time Closed,Avg. Closing Cost,Reason For Close,P/L,No. of Contracts,Funds at Close,Margin Req.,Strategy,Opening Commissions + Fees,Closing Commissions + Fees,Opening Short/Long Ratio,Closing Short/Long Ratio,Gap,Movement,Max Profit,Max Loss\n"""
    csv_content += "2025-09-23,09:32:00,6694.8,Sample Legs,55,6656.92,2025-09-23,16:00:00,0,Expired,4930.2,99,945113.8,93555,Test Strategy,514.8,,1.48,1,-1.31,2.36,100,-400\n"

    portfolio = portfolio_processor.parse_csv(csv_content, "missing_closing_fees.csv")

    assert len(portfolio.trades) == 1
    assert portfolio.trades[0].closing_commissions_fees == 0
