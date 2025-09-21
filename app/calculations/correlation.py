"""
Correlation Matrix Calculator

Calculates correlation matrices between strategies for the correlation tab.
"""
import numpy as np
import pandas as pd
from typing import List, Dict, Any
from collections import defaultdict
import logging

from app.data.models import Portfolio, CorrelationMatrix

logger = logging.getLogger(__name__)


class CorrelationCalculator:
    """Calculator for strategy correlation matrices"""

    def calculate_correlation_matrix(self, portfolio: Portfolio) -> CorrelationMatrix:
        """Calculate correlation matrix between strategies"""
        try:
            # Group trades by strategy and date
            strategy_daily_returns = defaultdict(lambda: defaultdict(float))

            for trade in portfolio.trades:
                date_key = trade.date_opened.isoformat()
                strategy_daily_returns[trade.strategy][date_key] += trade.pl

            # Convert to DataFrame for correlation calculation
            strategies = list(strategy_daily_returns.keys())
            if len(strategies) < 2:
                # Return identity matrix if less than 2 strategies
                correlation_data = [[1.0 if i == j else 0.0 for j in range(len(strategies))] for i in range(len(strategies))]
                return CorrelationMatrix(
                    strategies=strategies,
                    correlation_data=correlation_data
                )

            # Get all unique dates
            all_dates = set()
            for strategy_data in strategy_daily_returns.values():
                all_dates.update(strategy_data.keys())

            # Create DataFrame
            data = {}
            for strategy in strategies:
                data[strategy] = [strategy_daily_returns[strategy].get(date, 0.0) for date in sorted(all_dates)]

            df = pd.DataFrame(data)
            correlation_matrix = df.corr()

            # Convert to list format
            correlation_data = correlation_matrix.values.tolist()

            return CorrelationMatrix(
                strategies=strategies,
                correlation_data=correlation_data
            )

        except Exception as e:
            logger.error(f"Error calculating correlation matrix: {str(e)}")
            raise