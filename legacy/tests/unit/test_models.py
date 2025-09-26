from datetime import date, time

from app.data.models import Portfolio, Trade


def test_trade_creation(sample_trade_data):
    """Test Trade model creation"""
    trade = Trade(**sample_trade_data)

    assert trade.date_opened == date(2025, 9, 18)
    assert trade.time_opened == time(10, 31, 0)
    assert trade.opening_price == 6655.17
    assert trade.pl == -6850.6
    assert trade.strategy == "Test Strategy"


def test_trade_serialization(sample_trade):
    """Test Trade model serialization"""
    trade_dict = sample_trade.dict()

    assert "date_opened" in trade_dict
    assert "pl" in trade_dict
    assert "strategy" in trade_dict

    # Check that dates are properly handled
    assert isinstance(trade_dict["date_opened"], date)


def test_portfolio_from_trades(sample_trade):
    """Test Portfolio creation from trades"""
    trades = [sample_trade]
    portfolio = Portfolio.from_trades(trades, "test.csv")

    assert portfolio.filename == "test.csv"
    assert portfolio.total_trades == 1
    assert portfolio.total_pl == sample_trade.pl
    assert sample_trade.strategy in portfolio.strategies


def test_portfolio_multiple_strategies():
    """Test portfolio with multiple strategies"""
    trade1_data = {
        "date_opened": date(2025, 9, 18),
        "time_opened": time(10, 31, 0),
        "opening_price": 6655.17,
        "legs": "test legs",
        "premium": -3205,
        "pl": 1000,
        "num_contracts": 5,
        "funds_at_close": 100000,
        "margin_req": 16025,
        "strategy": "Strategy A",
        "opening_commissions_fees": 17.8,
        "closing_commissions_fees": 7.8,
        "opening_short_long_ratio": 0.03,
        "opening_vix": 15.5,
    }

    trade2_data = trade1_data.copy()
    trade2_data["strategy"] = "Strategy B"
    trade2_data["pl"] = -500

    trade1 = Trade(**trade1_data)
    trade2 = Trade(**trade2_data)

    portfolio = Portfolio.from_trades([trade1, trade2], "test.csv")

    assert portfolio.total_trades == 2
    assert portfolio.total_pl == 500  # 1000 + (-500)
    assert len(portfolio.strategies) == 2
    assert "Strategy A" in portfolio.strategies
    assert "Strategy B" in portfolio.strategies
