"""
Daily Log Processor

Handles parsing and processing of OptionOmega daily log CSV files.
These files contain end-of-day portfolio values and performance metrics.
"""
import pandas as pd
from typing import List
from io import StringIO
import logging

from .models import DailyLogEntry, DailyLog

logger = logging.getLogger(__name__)


class DailyLogProcessor:
    """Processes daily log CSV data from OptionOmega"""

    def __init__(self):
        self.column_mapping = {
            "Date": "date",
            "Net Liquidity": "net_liquidity",
            "Current Funds": "current_funds",
            "Withdrawn": "withdrawn",
            "Trading Funds": "trading_funds",
            "P/L": "daily_pl",
            "P/L %": "daily_pl_pct",
            "Drawdown %": "drawdown_pct"
        }

    def parse_csv(self, file_content: str, filename: str) -> DailyLog:
        """Parse daily log CSV content and return DailyLog object"""
        try:
            # Read CSV with pandas
            df = pd.read_csv(StringIO(file_content))

            # Clean and process data
            df = self._clean_dataframe(df)

            # Convert to DailyLogEntry objects
            entries = self._dataframe_to_entries(df)

            # Create DailyLog
            daily_log = DailyLog.from_entries(entries, filename)

            logger.info(f"Successfully processed {len(entries)} daily entries from {filename}")
            return daily_log

        except Exception as e:
            logger.error(f"Error processing daily log CSV {filename}: {str(e)}")
            raise ValueError(f"Failed to process daily log CSV file: {str(e)}")

    def _clean_dataframe(self, df: pd.DataFrame) -> pd.DataFrame:
        """Clean and standardize the dataframe"""
        # Remove BOM character if present
        df.columns = df.columns.str.replace('\ufeff', '')

        # Rename columns using mapping
        df = df.rename(columns=self.column_mapping)

        # Convert date column
        df['date'] = pd.to_datetime(df['date']).dt.date

        # Convert numeric columns
        numeric_columns = [
            'net_liquidity', 'current_funds', 'withdrawn', 'trading_funds',
            'daily_pl', 'daily_pl_pct', 'drawdown_pct'
        ]

        for col in numeric_columns:
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors='coerce')

        # Fill any NaN values with 0 for numeric columns
        for col in numeric_columns:
            if col in df.columns:
                df[col] = df[col].fillna(0)

        return df

    def _dataframe_to_entries(self, df: pd.DataFrame) -> List[DailyLogEntry]:
        """Convert DataFrame rows to DailyLogEntry objects"""
        entries = []

        for _, row in df.iterrows():
            try:
                entry_data = row.to_dict()

                # Handle any remaining NaN values
                for field in entry_data:
                    if pd.isna(entry_data[field]):
                        entry_data[field] = 0 if field != 'date' else entry_data[field]

                entry = DailyLogEntry(**entry_data)
                entries.append(entry)

            except Exception as e:
                logger.warning(f"Skipping invalid daily log entry: {str(e)}")
                continue

        return entries