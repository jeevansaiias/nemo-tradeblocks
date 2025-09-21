"""
Portfolio CSV Processor

Handles CSV parsing, cleaning, and conversion to structured models.
No calculations - only data processing and transformation.
"""
import pandas as pd
from datetime import datetime, time
from typing import List
from io import StringIO
import logging

from .models import Trade, Portfolio

logger = logging.getLogger(__name__)


class PortfolioProcessor:
    """Processes portfolio CSV data and converts to structured models"""

    def __init__(self):
        self.column_mapping = {
            "Date Opened": "date_opened",
            "Time Opened": "time_opened",
            "Opening Price": "opening_price",
            "Legs": "legs",
            "Premium": "premium",
            "Closing Price": "closing_price",
            "Date Closed": "date_closed",
            "Time Closed": "time_closed",
            "Avg. Closing Cost": "avg_closing_cost",
            "Reason For Close": "reason_for_close",
            "P/L": "pl",
            "No. of Contracts": "num_contracts",
            "Funds at Close": "funds_at_close",
            "Margin Req.": "margin_req",
            "Strategy": "strategy",
            "Opening Commissions + Fees": "opening_commissions_fees",
            "Closing Commissions + Fees": "closing_commissions_fees",
            "Opening Short/Long Ratio": "opening_short_long_ratio",
            "Closing Short/Long Ratio": "closing_short_long_ratio",
            "Opening VIX": "opening_vix",
            "Closing VIX": "closing_vix",
            "Gap": "gap",
            "Movement": "movement",
            "Max Profit": "max_profit",
            "Max Loss": "max_loss"
        }

    def parse_csv(self, file_content: str, filename: str) -> Portfolio:
        """Parse CSV content and return Portfolio object"""
        try:
            # Read CSV with pandas
            df = pd.read_csv(StringIO(file_content))

            # Clean and process data
            df = self._clean_dataframe(df)

            # Convert to Trade objects
            trades = self._dataframe_to_trades(df)

            # Create Portfolio
            portfolio = Portfolio.from_trades(trades, filename)

            logger.info(f"Successfully processed {len(trades)} trades from {filename}")
            return portfolio

        except Exception as e:
            logger.error(f"Error processing CSV {filename}: {str(e)}")
            raise ValueError(f"Failed to process CSV file: {str(e)}")

    def _clean_dataframe(self, df: pd.DataFrame) -> pd.DataFrame:
        """Clean and standardize the dataframe"""
        # Remove BOM character if present
        df.columns = df.columns.str.replace('\ufeff', '')

        # Rename columns using mapping
        df = df.rename(columns=self.column_mapping)

        # Convert date columns
        df['date_opened'] = pd.to_datetime(df['date_opened']).dt.date
        df['date_closed'] = pd.to_datetime(df['date_closed'], errors='coerce').dt.date

        # Convert time columns
        df['time_opened'] = pd.to_datetime(df['time_opened'], format='%H:%M:%S').dt.time
        df['time_closed'] = pd.to_datetime(df['time_closed'], format='%H:%M:%S', errors='coerce').dt.time

        # Convert numeric columns
        numeric_columns = [
            'opening_price', 'premium', 'closing_price', 'avg_closing_cost', 'pl',
            'num_contracts', 'funds_at_close', 'margin_req', 'opening_commissions_fees',
            'closing_commissions_fees', 'opening_short_long_ratio', 'closing_short_long_ratio',
            'opening_vix', 'closing_vix', 'gap', 'movement', 'max_profit', 'max_loss'
        ]

        for col in numeric_columns:
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors='coerce')

        # Fill NaN values appropriately - use empty string for text fields, keep NaN for numeric
        text_columns = ['reason_for_close']
        for col in text_columns:
            if col in df.columns:
                df[col] = df[col].fillna('')

        # For other columns, NaN/None values will be handled in the Trade model conversion

        return df

    def _dataframe_to_trades(self, df: pd.DataFrame) -> List[Trade]:
        """Convert DataFrame rows to Trade objects"""
        trades = []

        for _, row in df.iterrows():
            try:
                trade_data = row.to_dict()

                # Handle None values for optional fields
                for field in ['closing_price', 'date_closed', 'time_closed', 'avg_closing_cost',
                             'reason_for_close', 'closing_short_long_ratio', 'closing_vix',
                             'gap', 'movement', 'max_profit', 'max_loss']:
                    if pd.isna(trade_data.get(field)):
                        trade_data[field] = None

                trade = Trade(**trade_data)
                trades.append(trade)

            except Exception as e:
                logger.warning(f"Skipping invalid trade row: {str(e)}")
                continue

        return trades