import pytest
import pandas as pd
import os
from pathlib import Path
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
def sample_single_backtest_csv_content():
    """Sample CSV content for testing file upload"""
    csv_content = """"Date Opened","Time Opened","Opening Price","Legs","Premium","Closing Price","Date Closed","Time Closed","Avg. Closing Cost","Reason For Close","P/L","No. of Contracts","Funds at Close","Margin Req.","Strategy","Opening Commissions + Fees","Closing Commissions + Fees","Opening Short/Long Ratio","Closing Short/Long Ratio","Gap","Movement","Max Profit","Max Loss"
"2025-08-22","15:02:00",6469.83,"208 Aug 27 6410 P STO 8.70 | 208 Aug 27 6520 C STO 5.80 | 208 Aug 29 6410 P BTO 18.45 | 208 Aug 29 6520 C BTO 17.70",-2175,6462.47,"2025-08-22","15:59:00",-2095,"Backtest Completed",-19136,208,3004512,452400,"",1248,1248,0.4,0.381,14.42,85.24,1.84,-3.68
"2025-08-15","15:02:00",6456.59,"252 Aug 20 6395 P STO 8.85 | 252 Aug 20 6505 C STO 6.80 | 252 Aug 22 6395 P BTO 17.25 | 252 Aug 22 6505 C BTO 16.30",-1800,6443.11,"2025-08-19","09:38:00",-1795,"Below Short/Long Ratio",-4284,252,3023648,453600,"",1512,1512,0.47,0.172,8.84,-20.79,14.44,-1.11
"""
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


@pytest.fixture
def test_data_dir():
    """Get the test data directory path"""
    return Path(__file__).parent / "data"


@pytest.fixture
def tradelog_data(test_data_dir):
    """Load tradelog data - real data if exists, otherwise mock data"""
    data_file = test_data_dir / "tradelog.csv"

    if data_file.exists():
        print(f"\nUsing real tradelog data: {data_file}")
        return pd.read_csv(data_file)
    else:
        print(f"\nUsing mock tradelog data (no tradelog.csv found)")
        # Return mock data
        return pd.DataFrame(
            {
                "Date Opened": [
                    "2024-01-15",
                    "2024-01-16",
                    "2024-01-17",
                    "2024-01-18",
                    "2024-01-19",
                ],
                "Time Opened": ["09:30:00", "10:15:00", "14:30:00", "09:45:00", "15:00:00"],
                "Opening Price": [100.0, 102.5, 98.75, 105.0, 103.25],
                "Legs": [
                    "Mock Trade 1",
                    "Mock Trade 2",
                    "Mock Trade 3",
                    "Mock Trade 4",
                    "Mock Trade 5",
                ],
                "Premium": [-1000, -1500, -800, -1200, -900],
                "Closing Price": [105.0, 101.0, 102.5, 108.0, 100.0],
                "Date Closed": [
                    "2024-01-16",
                    "2024-01-17",
                    "2024-01-18",
                    "2024-01-19",
                    "2024-01-22",
                ],
                "Time Closed": ["15:30:00", "16:00:00", "15:45:00", "14:30:00", "16:00:00"],
                "Avg. Closing Cost": [-500, -1600, -600, -800, -1000],
                "Reason For Close": [
                    "Profit Target",
                    "Stop Loss",
                    "Time Decay",
                    "Profit Target",
                    "Expiration",
                ],
                "P/L": [500, -100, 200, 400, -100],
                "No. of Contracts": [10, 15, 8, 12, 9],
                "Funds at Close": [100500, 100400, 100600, 101000, 100900],
                "Margin Req.": [5000, 7500, 4000, 6000, 4500],
                "Strategy": [
                    "Mock Strategy A",
                    "Mock Strategy B",
                    "Mock Strategy A",
                    "Mock Strategy C",
                    "Mock Strategy B",
                ],
                "Opening Commissions + Fees": [10, 15, 8, 12, 9],
                "Closing Commissions + Fees": [10, 15, 8, 12, 9],
                "Opening Short/Long Ratio": [0.5, 0.3, 0.7, 0.4, 0.6],
                "Closing Short/Long Ratio": [0.5, 0.3, 0.7, 0.4, 0.6],
                "Opening VIX": [15.0, 16.5, 14.2, 17.8, 15.9],
                "Closing VIX": [15.5, 16.0, 14.8, 17.2, 16.1],
                "Gap": [0.5, -1.2, 2.1, -0.8, 1.5],
                "Movement": [5.0, -1.5, 3.75, 3.0, -3.25],
                "Max Profit": [100, 50, 75, 120, 45],
                "Max Loss": [-200, -150, -100, -250, -180],
            }
        )


@pytest.fixture
def dailylog_data(test_data_dir):
    """Load dailylog data - real data if exists, otherwise mock data"""
    data_file = test_data_dir / "dailylog.csv"

    if data_file.exists():
        print(f"\nUsing real dailylog data: {data_file}")
        return pd.read_csv(data_file)
    else:
        print(f"\nUsing mock dailylog data (no dailylog.csv found)")
        # Return mock data
        return pd.DataFrame(
            {
                "Date": ["2024-01-15", "2024-01-16", "2024-01-17", "2024-01-18", "2024-01-19"],
                "Equity": [100000, 100500, 100400, 100600, 101000],
                "Daily PnL": [0, 500, -100, 200, 400],
                "Cumulative PnL": [0, 500, 400, 600, 1000],
            }
        )


@pytest.fixture
def test_trades(tradelog_data):
    """Convert tradelog DataFrame to Trade objects for testing"""
    trades = []

    for _, row in tradelog_data.iterrows():
        try:
            # Handle the actual column names from the sample data
            trade_data = {
                "date_opened": str(row.get("Date Opened", "")),
                "time_opened": str(row.get("Time Opened", "10:00:00")),
                "opening_price": (
                    float(row.get("Opening Price", 0))
                    if pd.notna(row.get("Opening Price"))
                    else 0.0
                ),
                "legs": str(row.get("Legs", "UNKNOWN")),
                "premium": float(row.get("Premium", 0)) if pd.notna(row.get("Premium")) else 0.0,
                "closing_price": (
                    float(row.get("Closing Price", 0))
                    if pd.notna(row.get("Closing Price"))
                    else 0.0
                ),
                "date_closed": str(row.get("Date Closed", "")),
                "time_closed": str(row.get("Time Closed", "16:00:00")),
                "avg_closing_cost": (
                    float(row.get("Avg. Closing Cost", 0))
                    if pd.notna(row.get("Avg. Closing Cost"))
                    else 0.0
                ),
                "reason_for_close": str(row.get("Reason For Close", "Test Close")),
                "pl": float(row.get("P/L", 0)) if pd.notna(row.get("P/L")) else 0.0,
                "num_contracts": (
                    int(abs(float(row.get("No. of Contracts", 1))))
                    if pd.notna(row.get("No. of Contracts"))
                    else 1
                ),
                "funds_at_close": (
                    float(row.get("Funds at Close", 100000.0))
                    if pd.notna(row.get("Funds at Close"))
                    else 100000.0
                ),
                "margin_req": (
                    float(row.get("Margin Req.", 1000.0))
                    if pd.notna(row.get("Margin Req."))
                    else 1000.0
                ),
                "strategy": str(row.get("Strategy", "Default")),
                "opening_commissions_fees": (
                    float(row.get("Opening Commissions + Fees", 1))
                    if pd.notna(row.get("Opening Commissions + Fees"))
                    else 1.0
                ),
                "closing_commissions_fees": (
                    float(row.get("Closing Commissions + Fees", 1))
                    if pd.notna(row.get("Closing Commissions + Fees"))
                    else 1.0
                ),
                "opening_short_long_ratio": (
                    float(row.get("Opening Short/Long Ratio", 0.5))
                    if pd.notna(row.get("Opening Short/Long Ratio"))
                    else 0.5
                ),
                "closing_short_long_ratio": (
                    float(row.get("Closing Short/Long Ratio", 0.5))
                    if pd.notna(row.get("Closing Short/Long Ratio"))
                    else 0.5
                ),
                "opening_vix": (
                    float(row.get("Opening VIX", 15.0))
                    if pd.notna(row.get("Opening VIX"))
                    else 15.0
                ),
                "closing_vix": (
                    float(row.get("Closing VIX", 15.0))
                    if pd.notna(row.get("Closing VIX"))
                    else 15.0
                ),
                "gap": float(row.get("Gap", 0.0)) if pd.notna(row.get("Gap")) else 0.0,
                "movement": (
                    float(row.get("Movement", 0.0)) if pd.notna(row.get("Movement")) else 0.0
                ),
                "max_profit": (
                    float(row.get("Max Profit", 100.0))
                    if pd.notna(row.get("Max Profit"))
                    else 100.0
                ),
                "max_loss": (
                    float(row.get("Max Loss", -100.0)) if pd.notna(row.get("Max Loss")) else -100.0
                ),
            }

            # Skip rows with empty dates (likely headers or empty rows)
            if not trade_data["date_opened"] or not trade_data["date_closed"]:
                continue

            trades.append(Trade(**trade_data))
        except Exception as e:
            print(f"Warning: Skipping invalid trade row: {e}")
            continue

    if not trades:
        pytest.skip("No valid trades found in tradelog data")

    print(f"\nLoaded {len(trades)} trades for testing")
    return trades
