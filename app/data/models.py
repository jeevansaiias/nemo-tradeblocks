from datetime import datetime, date, time
from typing import Optional, List, Dict
from pydantic import BaseModel, Field


class Trade(BaseModel):
    """Individual trade record from portfolio CSV"""

    date_opened: date
    time_opened: time
    opening_price: float
    legs: str  # Option legs description
    premium: float
    closing_price: Optional[float] = None
    date_closed: Optional[date] = None
    time_closed: Optional[time] = None
    avg_closing_cost: Optional[float] = None
    reason_for_close: Optional[str] = None
    pl: float  # Profit/Loss
    num_contracts: int
    funds_at_close: float
    margin_req: float
    strategy: str
    opening_commissions_fees: float
    closing_commissions_fees: float
    opening_short_long_ratio: float
    closing_short_long_ratio: Optional[float] = None
    opening_vix: float
    closing_vix: Optional[float] = None
    gap: Optional[float] = None
    movement: Optional[float] = None
    max_profit: Optional[float] = None
    max_loss: Optional[float] = None

    class Config:
        json_encoders = {
            date: lambda v: v.isoformat(),
            time: lambda v: v.isoformat(),
        }


class Portfolio(BaseModel):
    """Collection of trades with metadata"""

    trades: List[Trade]
    upload_timestamp: datetime
    filename: str
    total_trades: int
    total_pl: float
    strategies: List[str]

    @classmethod
    def from_trades(cls, trades: List[Trade], filename: str):
        return cls(
            trades=trades,
            upload_timestamp=datetime.now(),
            filename=filename,
            total_trades=len(trades),
            total_pl=sum(trade.pl for trade in trades),
            strategies=list(set(trade.strategy for trade in trades)),
        )


class PortfolioStats(BaseModel):
    """Portfolio statistics and metrics"""

    total_trades: int
    total_pl: float
    win_rate: float
    avg_win: float
    avg_loss: float
    max_win: float
    max_loss: float
    sharpe_ratio: Optional[float] = None
    max_drawdown: float
    avg_daily_pl: float
    total_commissions: float
    net_pl: float
    profit_factor: float


class StrategyStats(BaseModel):
    """Statistics for individual strategy"""

    strategy_name: str
    trade_count: int
    total_pl: float
    win_rate: float
    avg_win: float
    avg_loss: float
    max_win: float
    max_loss: float
    avg_dte: Optional[float] = None
    success_rate: float
    profit_factor: float


class MonteCarloRequest(BaseModel):
    """Request for Monte Carlo simulation"""

    strategy: Optional[str] = None  # None = all strategies
    num_simulations: int = Field(default=1000, ge=100, le=10000)
    days_forward: int = Field(default=252, ge=1, le=1000)
    confidence_levels: List[float] = Field(default=[0.05, 0.25, 0.5, 0.75, 0.95])


class MonteCarloResult(BaseModel):
    """Monte Carlo simulation results"""

    simulations: List[List[float]]  # Each simulation's daily returns
    percentiles: dict  # Confidence levels and their values
    final_values: List[float]  # Final portfolio values
    var_95: float  # Value at Risk at 95%
    expected_return: float
    std_deviation: float


class CorrelationMatrix(BaseModel):
    """Correlation matrix for strategies"""

    strategies: List[str]
    correlation_data: List[List[float]]
    p_values: Optional[List[List[float]]] = None


class OptimizationRequest(BaseModel):
    """Portfolio optimization request"""

    strategies: List[str]
    target_return: Optional[float] = None
    risk_tolerance: float = Field(default=1.0, ge=0.1, le=5.0)
    max_allocation: float = Field(default=0.4, ge=0.1, le=1.0)
    min_allocation: float = Field(default=0.05, ge=0.0, le=0.5)


class OptimizationResult(BaseModel):
    """Portfolio optimization results"""

    optimal_weights: dict  # Strategy -> weight mapping
    expected_return: float
    volatility: float
    sharpe_ratio: float
    efficient_frontier: List[dict]  # Risk/return combinations


class AnalysisConfig(BaseModel):
    """Analysis configuration settings for portfolio analysis"""

    # Analysis parameters that affect calculations
    risk_free_rate: float = Field(
        default=2.0,
        ge=0.0,
        le=20,
        description="Annual risk-free rate for Sharpe/Sortino calculations",
    )

    # Time-based calculation preferences
    use_business_days_only: bool = Field(
        default=True, description="Use only business days for time calculations"
    )
    annualization_factor: int = Field(
        default=252,
        ge=200,
        le=365,
        description="Days per year for annualization (252 for business days, 365 for calendar days)",
    )

    # Advanced analysis settings
    confidence_level: float = Field(
        default=0.95, ge=0.8, le=0.99, description="Confidence level for VaR and other risk metrics"
    )
    drawdown_threshold: float = Field(
        default=0.05, ge=0.01, le=0.5, description="Minimum drawdown % to consider significant"
    )

    @classmethod
    def get_default(cls):
        """Get default configuration"""
        return cls()


class DailyLogEntry(BaseModel):
    """Individual daily log entry from OptionOmega daily CSV"""

    date: date
    net_liquidity: float
    current_funds: float
    withdrawn: float
    trading_funds: float
    daily_pl: float
    daily_pl_pct: float
    drawdown_pct: float

    class Config:
        json_encoders = {
            date: lambda v: v.isoformat(),
        }


class DailyLog(BaseModel):
    """Collection of daily log entries with metadata"""

    entries: List[DailyLogEntry]
    upload_timestamp: datetime
    filename: str
    total_entries: int
    date_range_start: date
    date_range_end: date
    final_portfolio_value: float
    max_drawdown: float

    @classmethod
    def from_entries(cls, entries: List[DailyLogEntry], filename: str):
        if not entries:
            raise ValueError("Cannot create DailyLog with empty entries")

        # Sort entries by date
        sorted_entries = sorted(entries, key=lambda x: x.date)

        return cls(
            entries=sorted_entries,
            upload_timestamp=datetime.now(),
            filename=filename,
            total_entries=len(sorted_entries),
            date_range_start=sorted_entries[0].date,
            date_range_end=sorted_entries[-1].date,
            final_portfolio_value=sorted_entries[-1].net_liquidity,
            max_drawdown=min(entry.drawdown_pct for entry in sorted_entries),
        )
