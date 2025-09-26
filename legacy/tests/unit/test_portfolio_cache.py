import uuid
from datetime import datetime, timedelta
from decimal import Decimal

import pytest

from app.services.portfolio_cache import portfolio_cache
from app.dash_app.callbacks.portfolio_callbacks import _jsonify_for_store


@pytest.fixture(autouse=True)
def clear_portfolio_cache():
    """Ensure cache is clean before and after each test."""
    portfolio_cache.clear()
    yield
    portfolio_cache.clear()


def _store_sample_portfolio(sample_portfolio):
    portfolio_id = str(uuid.uuid4())
    portfolio_cache.store_portfolio(portfolio_id, sample_portfolio)
    return portfolio_id


def test_get_performance_blocks_dataset_caches_results(sample_portfolio):
    portfolio_id = _store_sample_portfolio(sample_portfolio)

    dataset, trades, cache_key, hit = portfolio_cache.get_performance_blocks_dataset(
        portfolio_id,
        strategies=[],
        date_range="all",
        rom_ma_period="30",
        rolling_metric_type="win_rate",
    )

    assert hit is False
    assert cache_key
    assert dataset.get("equity_data")
    assert len(trades) == sample_portfolio.total_trades

    dataset2, trades2, cache_key2, hit2 = portfolio_cache.get_performance_blocks_dataset(
        portfolio_id,
        strategies=[],
        date_range="all",
        rom_ma_period="30",
        rolling_metric_type="win_rate",
    )

    assert hit2 is True
    assert cache_key2 == cache_key
    assert len(trades2) == len(trades)
    assert dataset2.keys() == dataset.keys()


def test_get_performance_blocks_dataset_filters_by_strategy(sample_portfolio):
    portfolio_id = _store_sample_portfolio(sample_portfolio)

    dataset, trades, _, _ = portfolio_cache.get_performance_blocks_dataset(
        portfolio_id,
        strategies=["Test Strategy 1"],
        date_range="all",
        rom_ma_period="30",
        rolling_metric_type="win_rate",
    )

    assert trades
    assert {trade.strategy for trade in trades} == {"Test Strategy 1"}
    assert len(dataset.get("trades", [])) == len(trades)


def test_jsonify_for_store_handles_basemodel_and_temporal(sample_trade):
    payload = {
        "model": sample_trade,
        "opened": datetime(2025, 1, 1, 9, 30),
        "elapsed": timedelta(days=2, seconds=30),
        "amount": Decimal("12.5"),
    }

    result = _jsonify_for_store(payload)

    assert result["model"]["date_opened"] == "2025-09-18"
    assert result["opened"] == "2025-01-01T09:30:00"
    assert result["elapsed"] == pytest.approx(172830.0)
    assert result["amount"] == pytest.approx(12.5)
