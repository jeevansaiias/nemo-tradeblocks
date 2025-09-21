"""
Trade Analysis Calculator

Handles trade data analysis and filtering for the trade data tab.
"""

from typing import List, Dict, Any, Optional
import logging

from app.data.models import Portfolio

logger = logging.getLogger(__name__)


class TradeAnalysisCalculator:
    """Calculator for trade data analysis and filtering"""

    def get_filtered_trades(
        self,
        portfolio: Portfolio,
        strategy: Optional[str] = None,
        limit: Optional[int] = None,
        offset: Optional[int] = 0,
    ) -> Dict[str, Any]:
        """Get trades with optional filtering"""
        try:
            trades = portfolio.trades

            # Filter by strategy if specified
            if strategy:
                trades = [trade for trade in trades if trade.strategy == strategy]

            # Apply pagination
            if limit:
                trades = trades[offset : offset + limit]

            # Convert to dict for JSON serialization
            trades_data = [trade.model_dump() for trade in trades]

            return {
                "trades": trades_data,
                "total_count": len(portfolio.trades),
                "filtered_count": len(trades_data),
                "strategy_filter": strategy,
            }
        except Exception as e:
            logger.error(f"Error processing trades: {str(e)}")
            raise

    def calculate_trade_statistics(self, portfolio: Portfolio) -> Dict[str, Any]:
        """Calculate various trade-level statistics"""
        try:
            if not portfolio.trades:
                return {}

            # Basic trade stats
            trade_pls = [trade.pl for trade in portfolio.trades]
            durations = []

            for trade in portfolio.trades:
                if trade.date_closed and trade.date_opened:
                    duration = (trade.date_closed - trade.date_opened).days
                    durations.append(duration)

            return {
                "total_trades": len(portfolio.trades),
                "winning_trades": len([pl for pl in trade_pls if pl > 0]),
                "losing_trades": len([pl for pl in trade_pls if pl < 0]),
                "breakeven_trades": len([pl for pl in trade_pls if pl == 0]),
                "avg_duration": sum(durations) / len(durations) if durations else 0,
                "min_duration": min(durations) if durations else 0,
                "max_duration": max(durations) if durations else 0,
                "strategies": list(set(trade.strategy for trade in portfolio.trades)),
            }
        except Exception as e:
            logger.error(f"Error calculating trade statistics: {str(e)}")
            raise
