def test_health_endpoint(client):
    """Test health check endpoint"""
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"


def test_root_endpoint(client):
    """Test API root endpoint"""
    response = client.get("/api")
    assert response.status_code == 200
    assert "Portfolio Analysis API" in response.json()["message"]


def test_portfolio_upload(client, sample_csv_content):
    """Test portfolio file upload"""
    files = {"file": ("test.csv", sample_csv_content, "text/csv")}
    response = client.post("/api/v1/portfolio/upload", files=files)

    assert response.status_code == 200
    data = response.json()
    assert "portfolio_id" in data
    assert data["filename"] == "test.csv"
    assert data["total_trades"] == 2


def test_portfolio_upload_invalid_file(client):
    """Test portfolio upload with invalid file type"""
    files = {"file": ("test.txt", "invalid content", "text/plain")}
    response = client.post("/api/v1/portfolio/upload", files=files)

    assert response.status_code == 400
    assert "Only CSV files are allowed" in response.json()["detail"]


def test_portfolio_stats(client, sample_csv_content):
    """Test getting portfolio statistics"""
    # First upload a portfolio
    files = {"file": ("test.csv", sample_csv_content, "text/csv")}
    upload_response = client.post("/api/v1/portfolio/upload", files=files)
    portfolio_id = upload_response.json()["portfolio_id"]

    # Get statistics
    response = client.get(f"/api/v1/portfolio/{portfolio_id}/stats")
    assert response.status_code == 200

    stats = response.json()
    assert "total_trades" in stats
    assert "total_pl" in stats
    assert "win_rate" in stats
    assert stats["total_trades"] == 2


def test_portfolio_stats_not_found(client):
    """Test getting stats for non-existent portfolio"""
    response = client.get("/api/v1/portfolio/invalid-id/stats")
    assert response.status_code == 404


def test_strategy_stats(client, sample_csv_content):
    """Test getting strategy statistics"""
    # Upload portfolio
    files = {"file": ("test.csv", sample_csv_content, "text/csv")}
    upload_response = client.post("/api/v1/portfolio/upload", files=files)
    portfolio_id = upload_response.json()["portfolio_id"]

    # Get strategy stats
    response = client.get(f"/api/v1/portfolio/{portfolio_id}/strategy-stats")
    assert response.status_code == 200

    stats = response.json()
    assert "Test Strategy 1" in stats
    assert "Test Strategy 2" in stats

    strategy1_stats = stats["Test Strategy 1"]
    assert "trade_count" in strategy1_stats
    assert "total_pl" in strategy1_stats
    assert strategy1_stats["trade_count"] == 1


def test_get_trades(client, sample_csv_content):
    """Test getting trade data"""
    # Upload portfolio
    files = {"file": ("test.csv", sample_csv_content, "text/csv")}
    upload_response = client.post("/api/v1/portfolio/upload", files=files)
    portfolio_id = upload_response.json()["portfolio_id"]

    # Get trades
    response = client.get(f"/api/v1/portfolio/{portfolio_id}/trades")
    assert response.status_code == 200

    data = response.json()
    assert "trades" in data
    assert "total_count" in data
    assert len(data["trades"]) == 2
    assert data["total_count"] == 2


def test_get_trades_with_strategy_filter(client, sample_csv_content):
    """Test getting trades filtered by strategy"""
    # Upload portfolio
    files = {"file": ("test.csv", sample_csv_content, "text/csv")}
    upload_response = client.post("/api/v1/portfolio/upload", files=files)
    portfolio_id = upload_response.json()["portfolio_id"]

    # Get trades filtered by strategy
    response = client.get(
        f"/api/v1/portfolio/{portfolio_id}/trades", params={"strategy": "Test Strategy 1"}
    )
    assert response.status_code == 200

    data = response.json()
    assert len(data["trades"]) == 1
    assert data["trades"][0]["strategy"] == "Test Strategy 1"
    assert data["strategy_filter"] == "Test Strategy 1"


def test_list_portfolios(client, sample_csv_content):
    """Test listing all portfolios"""
    # Upload a portfolio first
    files = {"file": ("test.csv", sample_csv_content, "text/csv")}
    client.post("/api/v1/portfolio/upload", files=files)

    # List portfolios
    response = client.get("/api/v1/portfolios")
    assert response.status_code == 200

    data = response.json()
    assert "portfolios" in data
    assert len(data["portfolios"]) >= 1


def test_delete_portfolio(client, sample_csv_content):
    """Test deleting a portfolio"""
    # Upload portfolio
    files = {"file": ("test.csv", sample_csv_content, "text/csv")}
    upload_response = client.post("/api/v1/portfolio/upload", files=files)
    portfolio_id = upload_response.json()["portfolio_id"]

    # Delete portfolio
    response = client.delete(f"/api/v1/portfolio/{portfolio_id}")
    assert response.status_code == 200

    # Verify it's deleted
    response = client.get(f"/api/v1/portfolio/{portfolio_id}/stats")
    assert response.status_code == 404
