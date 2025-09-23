"""
Portfolio API Endpoints

Updated to use the new modular calculation architecture.
"""

from fastapi import APIRouter, UploadFile, File, HTTPException
from typing import Dict, Optional
import logging

from app.data.models import Portfolio, PortfolioStats, StrategyStats, DailyLog
from app.data.processor import PortfolioProcessor
from app.data.daily_log_processor import DailyLogProcessor
from app.calculations.geekistics import GeekisticsCalculator
from app.calculations.correlation import CorrelationCalculator
from app.calculations.performance import PerformanceCalculator
from app.calculations.optimization import OptimizationCalculator
from app.calculations.trade_analysis import TradeAnalysisCalculator
from app.calculations.monte_carlo import MonteCarloSimulator
from app.calculations.shared import calculate_basic_portfolio_stats, calculate_strategy_breakdown

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter()

# Initialize processors (stateless)
processor = PortfolioProcessor()
daily_log_processor = DailyLogProcessor()
correlation_calc = CorrelationCalculator()
performance_calc = PerformanceCalculator()
optimization_calc = OptimizationCalculator()
trade_analysis_calc = TradeAnalysisCalculator()
mc_simulator = MonteCarloSimulator()

# In-memory storage for tests (in production this would be a database)
portfolios_store = {}


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

    # Validate file type
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are allowed")

    try:
        # Read file content
        content = await file.read()
        file_content = content.decode("utf-8")

        # Process the CSV
        portfolio = processor.parse_csv(file_content, file.filename)

        # Generate portfolio ID and store for stateful endpoints
        import uuid

        portfolio_id = str(uuid.uuid4())
        portfolios_store[portfolio_id] = portfolio

        # Return the full portfolio data for client-side storage
        return {
            "portfolio_id": portfolio_id,
            "portfolio_data": portfolio.model_dump(),
            "filename": file.filename,
            "total_trades": portfolio.total_trades,
            "total_pl": portfolio.total_pl,
            "strategies": portfolio.strategies,
            "upload_timestamp": portfolio.upload_timestamp.isoformat(),
        }

    except Exception as e:
        logger.error(f"Error processing upload: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Error processing file: {str(e)}")


@router.post("/daily-log/upload", response_model=dict)
async def upload_daily_log(file: UploadFile = File(...)):
    """Upload and process a daily log CSV file"""

    # Validate file type
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are allowed")

    try:
        # Read file content
        content = await file.read()
        file_content = content.decode("utf-8")

        # Process the CSV
        daily_log = daily_log_processor.parse_csv(file_content, file.filename)

        # Return the full daily log data for client-side storage
        return {
            "daily_log_data": daily_log.model_dump(),
            "filename": file.filename,
            "total_entries": daily_log.total_entries,
            "date_range_start": daily_log.date_range_start.isoformat(),
            "date_range_end": daily_log.date_range_end.isoformat(),
            "final_portfolio_value": daily_log.final_portfolio_value,
            "max_drawdown": daily_log.max_drawdown,
            "upload_timestamp": daily_log.upload_timestamp.isoformat(),
        }

    except Exception as e:
        logger.error(f"Error processing daily log upload: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Error processing daily log file: {str(e)}")


@router.post("/calculate/portfolio-stats", response_model=PortfolioStats)
async def calculate_portfolio_stats(request_data: dict):
    """Calculate overall portfolio statistics from provided data"""
    try:
        # Extract portfolio data, daily log data, and filtering info
        portfolio_data = request_data.get("portfolio_data", request_data)
        daily_log_data = request_data.get("daily_log_data")
        is_filtered = request_data.get("is_filtered", False)

        # Convert dict back to Portfolio object
        portfolio = Portfolio(**portfolio_data)
        trades_data = [trade.model_dump() for trade in portfolio.trades]

        # Extract daily log entries if available
        daily_log_entries = None
        if daily_log_data:
            daily_log = DailyLog(**daily_log_data)
            daily_log_entries = [entry.model_dump() for entry in daily_log.entries]

        # Calculate basic stats using shared functions
        basic_stats = calculate_basic_portfolio_stats(trades_data)

        # Create a GeekisticsCalculator instance for additional metrics (with daily log support)
        geek_calc = GeekisticsCalculator()
        max_drawdown = geek_calc.calculate_all_geekistics_stats(
            trades_data, daily_log_entries, is_filtered
        )["portfolio_stats"]["max_drawdown"]

        # Calculate unique dates for avg daily PL
        unique_dates = len(set(trade.get("date_opened") for trade in trades_data))
        avg_daily_pl = basic_stats["total_pl"] / unique_dates if unique_dates > 0 else 0

        # Calculate commissions
        total_commissions = sum(
            trade.get("opening_commissions_fees", 0) + trade.get("closing_commissions_fees", 0)
            for trade in trades_data
        )
        net_pl = basic_stats["total_pl"] - total_commissions

        return PortfolioStats(
            total_trades=basic_stats["total_trades"],
            total_pl=basic_stats["total_pl"],
            win_rate=basic_stats["win_rate"],
            avg_win=basic_stats["avg_win"],
            avg_loss=basic_stats["avg_loss"],
            max_win=basic_stats["max_win"],
            max_loss=basic_stats["max_loss"],
            max_drawdown=max_drawdown,
            avg_daily_pl=avg_daily_pl,
            total_commissions=total_commissions,
            net_pl=net_pl,
            profit_factor=basic_stats["profit_factor"],
        )
    except Exception as e:
        logger.error(f"Error calculating portfolio stats: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error calculating stats: {str(e)}")


@router.post("/calculate/strategy-stats", response_model=Dict[str, StrategyStats])
async def calculate_strategy_stats(portfolio_data: dict):
    """Calculate statistics for each strategy from provided data"""
    try:
        # Convert dict back to Portfolio object
        portfolio = Portfolio(**portfolio_data)
        trades_data = [trade.model_dump() for trade in portfolio.trades]

        # Calculate strategy breakdown using shared function
        strategy_breakdown = calculate_strategy_breakdown(trades_data)

        # Convert to StrategyStats format
        strategy_stats = {}
        for strategy_name, stats in strategy_breakdown.items():
            strategy_stats[strategy_name] = StrategyStats(**stats)

        return strategy_stats
    except Exception as e:
        logger.error(f"Error calculating strategy stats: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error calculating strategy stats: {str(e)}")


@router.post("/calculate/trades")
async def get_trades_from_data(
    portfolio_data: dict,
    strategy: Optional[str] = None,
    limit: Optional[int] = None,
    offset: Optional[int] = 0,
):
    """Get trades with optional filtering from provided data"""
    try:
        # Convert dict back to Portfolio object
        portfolio = Portfolio(**portfolio_data)

        # Use the trade analysis calculator
        result = trade_analysis_calc.get_filtered_trades(
            portfolio, strategy=strategy, limit=limit, offset=offset
        )

        return result
    except Exception as e:
        logger.error(f"Error processing trades: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error processing trades: {str(e)}")


@router.post("/calculate/geekistics-stats")
async def calculate_geekistics_stats(request_data: dict):
    """Calculate ALL statistics for Geekistics tab using the consolidated calculator"""
    try:
        # Extract portfolio data, daily log data, configuration, and filtering info
        portfolio_data = request_data.get("portfolio_data", request_data)
        daily_log_data = request_data.get("daily_log_data")
        config_data = request_data.get("config", {})
        is_filtered = request_data.get("is_filtered", False)

        # Convert dict back to Portfolio object and get trades
        portfolio = Portfolio(**portfolio_data)
        trades_data = [trade.model_dump() for trade in portfolio.trades]

        # Extract daily log entries if available
        daily_log_entries = None
        if daily_log_data:
            daily_log = DailyLog(**daily_log_data)
            daily_log_entries = [entry.model_dump() for entry in daily_log.entries]

        # Create geekistics calculator with analysis configuration
        geek_calc = GeekisticsCalculator(config_data)

        # Calculate ALL geekistics stats in one call, including daily log data and filtering info
        all_stats = geek_calc.calculate_all_geekistics_stats(
            trades_data, daily_log_entries, is_filtered
        )

        return all_stats
    except Exception as e:
        logger.error(f"Error calculating geekistics stats: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error calculating geekistics stats: {str(e)}")


# Legacy endpoint for backward compatibility
@router.post("/calculate/advanced-stats")
async def calculate_advanced_stats(request_data: dict):
    """Legacy endpoint - redirects to geekistics-stats for backward compatibility"""
    return await calculate_geekistics_stats(request_data)


@router.post("/calculate/performance-data")
async def calculate_performance_data(portfolio_data: dict):
    """Calculate data for performance charts from provided data"""
    try:
        # Convert dict back to Portfolio object
        portfolio = Portfolio(**portfolio_data)
        performance_data = performance_calc.calculate_performance_data(portfolio)
        return performance_data
    except Exception as e:
        logger.error(f"Error calculating performance data: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error calculating performance data: {str(e)}")


@router.post("/calculate/margin-utilization")
async def calculate_margin_utilization(portfolio_data: dict):
    """Calculate margin utilization data"""
    try:
        # Convert dict back to Portfolio object
        portfolio = Portfolio(**portfolio_data)
        margin_data = performance_calc.calculate_margin_utilization(portfolio)
        return margin_data
    except Exception as e:
        logger.error(f"Error calculating margin utilization: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Error calculating margin utilization: {str(e)}"
        )


# Stateful endpoints for testing (use stored portfolios)


@router.get("/portfolio/{portfolio_id}/stats")
async def get_portfolio_stats(portfolio_id: str):
    """Get portfolio statistics by ID"""
    if portfolio_id not in portfolios_store:
        raise HTTPException(status_code=404, detail="Portfolio not found")

    portfolio = portfolios_store[portfolio_id]
    trades_data = [trade.model_dump() for trade in portfolio.trades]

    # Calculate basic stats
    basic_stats = calculate_basic_portfolio_stats(trades_data)

    # Calculate additional metrics
    unique_dates = len(set(trade.get("date_opened") for trade in trades_data))
    avg_daily_pl = basic_stats["total_pl"] / unique_dates if unique_dates > 0 else 0

    total_commissions = sum(
        trade.get("opening_commissions_fees", 0) + trade.get("closing_commissions_fees", 0)
        for trade in trades_data
    )

    return {
        "total_trades": basic_stats["total_trades"],
        "total_pl": basic_stats["total_pl"],
        "win_rate": basic_stats["win_rate"],
        "avg_win": basic_stats["avg_win"],
        "avg_loss": basic_stats["avg_loss"],
        "max_win": basic_stats["max_win"],
        "max_loss": basic_stats["max_loss"],
        "max_drawdown": 0,  # Simplified for tests
        "avg_daily_pl": avg_daily_pl,
        "total_commissions": total_commissions,
        "profit_factor": basic_stats["profit_factor"],
    }


@router.get("/portfolio/{portfolio_id}/strategy-stats")
async def get_strategy_stats(portfolio_id: str):
    """Get strategy statistics by portfolio ID"""
    if portfolio_id not in portfolios_store:
        raise HTTPException(status_code=404, detail="Portfolio not found")

    portfolio = portfolios_store[portfolio_id]
    trades_data = [trade.model_dump() for trade in portfolio.trades]

    # Calculate strategy breakdown
    strategy_breakdown = calculate_strategy_breakdown(trades_data)

    return strategy_breakdown


@router.get("/portfolio/{portfolio_id}/trades")
async def get_trades(
    portfolio_id: str,
    strategy: Optional[str] = None,
    limit: Optional[int] = None,
    offset: Optional[int] = 0,
):
    """Get trades by portfolio ID with optional filtering"""
    if portfolio_id not in portfolios_store:
        raise HTTPException(status_code=404, detail="Portfolio not found")

    portfolio = portfolios_store[portfolio_id]

    # Use the trade analysis calculator
    result = trade_analysis_calc.get_filtered_trades(
        portfolio, strategy=strategy, limit=limit, offset=offset
    )

    return result


@router.get("/portfolios")
async def list_portfolios():
    """List all portfolios"""
    portfolios_list = []
    for portfolio_id, portfolio in portfolios_store.items():
        portfolios_list.append(
            {
                "portfolio_id": portfolio_id,
                "filename": portfolio.filename,
                "total_trades": portfolio.total_trades,
                "total_pl": portfolio.total_pl,
                "upload_timestamp": portfolio.upload_timestamp.isoformat(),
            }
        )

    return {"portfolios": portfolios_list}


@router.delete("/portfolio/{portfolio_id}")
async def delete_portfolio(portfolio_id: str):
    """Delete a portfolio by ID"""
    if portfolio_id not in portfolios_store:
        raise HTTPException(status_code=404, detail="Portfolio not found")

    del portfolios_store[portfolio_id]
    return {"message": "Portfolio deleted successfully"}
