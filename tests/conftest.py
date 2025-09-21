import pytest
from fastapi.testclient import TestClient

from app.data.models import Trade
from app.data.processor import PortfolioProcessor
from app.main import app


@pytest.fixture
def client():
    """FastAPI test client"""
    return TestClient(app)


@pytest.fixture
def sample_trade_data():
    """Sample trade data for testing"""
    return {
        "date_opened": "2025-09-18",
        "time_opened": "10:31:00",
        "opening_price": 6655.17,
        "legs": "5 Sep 18 6625 C BTO 32.95 | 5 Sep 18 6685 C STO 1.00",
        "premium": -3205,
        "closing_price": 6639.12,
        "date_closed": "2025-09-18",
        "time_closed": "10:53:00",
        "avg_closing_cost": -1840,
        "reason_for_close": "Underlying Price Move Down",
        "pl": -6850.6,
        "num_contracts": 5,
        "funds_at_close": 1643961.04,
        "margin_req": 16025,
        "strategy": "Test Strategy",
        "opening_commissions_fees": 17.8,
        "closing_commissions_fees": 7.8,
        "opening_short_long_ratio": 0.03,
        "closing_short_long_ratio": 0.016,
        "opening_vix": 15.5,
        "closing_vix": 15.69,
        "gap": 26.5,
        "movement": 28.32,
        "max_profit": 1.09,
        "max_loss": -41.97,
    }


@pytest.fixture
def sample_trade(sample_trade_data):
    """Sample Trade object"""
    return Trade(**sample_trade_data)


@pytest.fixture
def sample_csv_content():
    """Sample CSV content for testing file upload"""
    csv_content = """Date Opened,Time Opened,Opening Price,Legs,Premium,Closing Price,Date Closed,Time Closed,Avg. Closing Cost,Reason For Close,P/L,No. of Contracts,Funds at Close,Margin Req.,Strategy,Opening Commissions + Fees,Closing Commissions + Fees,Opening Short/Long Ratio,Closing Short/Long Ratio,Opening VIX,Closing VIX,Gap,Movement,Max Profit,Max Loss
2025-09-18,10:31:00,6655.17,"5 Sep 18 6625 C BTO 32.95 | 5 Sep 18 6685 C STO 1.00",-3205,6639.12,2025-09-18,10:53:00,-1840,Underlying Price Move Down,-6850.6,5,1643961.04,16025,Test Strategy 1,17.8,7.8,0.03,0.016,15.5,15.69,26.5,28.32,1.09,-41.97
2025-09-17,10:01:00,6631.83,"11 Sep 18 6635 C BTO 10.45 | 11 Sep 18 6675 C STO 0.70",-985,6631.96,2025-09-18,16:00:00,0,Expired,-10874.16,11,1586111.24,22660,Test Strategy 2,39.16,0,0.07,0.5,15.24,15.77,26.5,4.98,126.4,-100"""
    return csv_content


@pytest.fixture
def sample_portfolio(sample_csv_content):
    """Sample Portfolio object"""
    processor = PortfolioProcessor()
    return processor.parse_csv(sample_csv_content, "test.csv")


@pytest.fixture
def portfolio_processor():
    """Portfolio processor instance"""
    return PortfolioProcessor()


@pytest.fixture
def mock_file_upload(sample_csv_content):
    """Mock file upload data"""
    return {"filename": "test_portfolio.csv", "content": sample_csv_content.encode("utf-8")}
