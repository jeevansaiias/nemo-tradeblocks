"""Portfolio API Endpoints"""

from fastapi import APIRouter, UploadFile, File, HTTPException
from typing import Dict, Optional
import logging

from app.data.models import PortfolioStats, StrategyStats
from app.services.portfolio_service import (
    calculate_advanced_stats_dict,
    calculate_geekistics_stats_dict,
    calculate_margin_utilization_dict,
    calculate_performance_data_dict,
    calculate_portfolio_stats_dict,
    calculate_strategy_stats_dict,
    calculate_trades_dict,
    delete_portfolio,
    get_portfolio_stats_from_store,
    get_strategy_stats_from_store,
    get_trades_from_store,
    list_portfolios,
    process_daily_log_upload,
    process_portfolio_upload,
)

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}


@router.get("/")
async def root():
    """Root endpoint"""
    return {"message": "TradeBlocks Portfolio Analysis API", "status": "running"}


@router.post("/portfolio/upload", response_model=dict)
async def upload_portfolio(file: UploadFile = File(...)):
    """Upload and process a portfolio CSV file"""
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are allowed")

    try:
        content = await file.read()
        file_content = content.decode("utf-8")
        return process_portfolio_upload(file_content, file.filename)
    except Exception as exc:  # pragma: no cover - defensive logging
        logger.error("Error processing upload: %s", exc)
        raise HTTPException(status_code=400, detail=f"Error processing file: {exc}")


@router.post("/daily-log/upload", response_model=dict)
async def upload_daily_log(file: UploadFile = File(...)):
    """Upload and process a daily log CSV file"""
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are allowed")

    try:
        content = await file.read()
        file_content = content.decode("utf-8")
        return process_daily_log_upload(file_content, file.filename)
    except Exception as exc:  # pragma: no cover - defensive logging
        logger.error("Error processing daily log upload: %s", exc)
        raise HTTPException(status_code=400, detail=f"Error processing daily log file: {exc}")


@router.post("/calculate/portfolio-stats", response_model=PortfolioStats)
async def calculate_portfolio_stats(request_data: dict):
    """Calculate overall portfolio statistics from provided data"""
    try:
        portfolio_data = request_data.get("portfolio_data", request_data)
        daily_log_data = request_data.get("daily_log_data")
        is_filtered = request_data.get("is_filtered", False)
        return calculate_portfolio_stats_dict(
            portfolio_data, daily_log_payload=daily_log_data, is_filtered=is_filtered
        )
    except Exception as exc:
        logger.error("Error calculating portfolio stats: %s", exc)
        raise HTTPException(status_code=500, detail=f"Error calculating stats: {exc}")


@router.post("/calculate/strategy-stats", response_model=Dict[str, StrategyStats])
async def calculate_strategy_stats(portfolio_data: dict):
    """Calculate statistics for each strategy from provided data"""
    try:
        return calculate_strategy_stats_dict(portfolio_data)
    except Exception as exc:
        logger.error("Error calculating strategy stats: %s", exc)
        raise HTTPException(status_code=500, detail=f"Error calculating strategy stats: {exc}")


@router.post("/calculate/trades")
async def get_trades_from_data(
    portfolio_data: dict,
    strategy: Optional[str] = None,
    limit: Optional[int] = None,
    offset: Optional[int] = 0,
):
    """Get trades with optional filtering from provided data"""
    try:
        return calculate_trades_dict(portfolio_data, strategy=strategy, limit=limit, offset=offset)
    except Exception as exc:
        logger.error("Error processing trades: %s", exc)
        raise HTTPException(status_code=500, detail=f"Error processing trades: {exc}")


@router.post("/calculate/geekistics-stats")
async def calculate_geekistics_stats(request_data: dict):
    """Calculate ALL statistics for Geekistics tab using the consolidated calculator"""
    try:
        return calculate_geekistics_stats_dict(request_data)
    except Exception as exc:
        logger.error("Error calculating geekistics stats: %s", exc)
        raise HTTPException(status_code=500, detail=f"Error calculating geekistics stats: {exc}")


@router.post("/calculate/advanced-stats")
async def calculate_advanced_stats(request_data: dict):
    """Legacy endpoint - redirects to geekistics-stats for backward compatibility"""
    try:
        return calculate_advanced_stats_dict(request_data)
    except Exception as exc:
        logger.error("Error calculating advanced stats: %s", exc)
        raise HTTPException(status_code=500, detail=f"Error calculating geekistics stats: {exc}")


@router.post("/calculate/performance-data")
async def calculate_performance_data(portfolio_data: dict):
    """Calculate data for performance charts from provided data"""
    try:
        return calculate_performance_data_dict(portfolio_data)
    except Exception as exc:
        logger.error("Error calculating performance data: %s", exc)
        raise HTTPException(status_code=500, detail=f"Error calculating performance data: {exc}")


@router.post("/calculate/margin-utilization")
async def calculate_margin_utilization(portfolio_data: dict):
    """Calculate margin utilization data"""
    try:
        return calculate_margin_utilization_dict(portfolio_data)
    except Exception as exc:
        logger.error("Error calculating margin utilization: %s", exc)
        raise HTTPException(status_code=500, detail=f"Error calculating margin utilization: {exc}")


@router.get("/portfolio/{portfolio_id}/stats")
async def get_portfolio_stats(portfolio_id: str):
    """Get portfolio statistics by ID"""
    try:
        return get_portfolio_stats_from_store(portfolio_id)
    except KeyError:
        raise HTTPException(status_code=404, detail="Portfolio not found")


@router.get("/portfolio/{portfolio_id}/strategy-stats")
async def get_strategy_stats(portfolio_id: str):
    """Get strategy statistics by portfolio ID"""
    try:
        return get_strategy_stats_from_store(portfolio_id)
    except KeyError:
        raise HTTPException(status_code=404, detail="Portfolio not found")


@router.get("/portfolio/{portfolio_id}/trades")
async def get_trades(
    portfolio_id: str,
    strategy: Optional[str] = None,
    limit: Optional[int] = None,
    offset: Optional[int] = 0,
):
    """Get trades by portfolio ID with optional filtering"""
    try:
        return get_trades_from_store(portfolio_id, strategy=strategy, limit=limit, offset=offset)
    except KeyError:
        raise HTTPException(status_code=404, detail="Portfolio not found")


@router.get("/portfolios")
async def list_portfolios_endpoint():
    """List all portfolios"""
    return {"portfolios": list_portfolios()}


@router.delete("/portfolio/{portfolio_id}")
async def delete_portfolio_endpoint(portfolio_id: str):
    """Delete a portfolio by ID"""
    try:
        delete_portfolio(portfolio_id)
    except KeyError:
        raise HTTPException(status_code=404, detail="Portfolio not found")
    return {"message": "Portfolio deleted successfully"}
