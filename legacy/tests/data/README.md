# Test Data Directory

This directory contains test data files for running comprehensive tests with the TradeBlocks analytics platform. You can use the provided sample data or add your own trading data for testing.

## Provided Sample Data

### `tradelog.csv`
Sample trading data with the following columns:
- Date, Time, Symbol, Side, Quantity, Price, Commission, Proceeds, PnL, Strategy

### `dailylog.csv`
Sample daily portfolio performance data with the following columns:
- Date, Equity, Daily PnL, Cumulative PnL

## Using Your Own Data

You can test TradeBlocks with your own trading data by adding your files to this directory:

### 1. Add Your Trading Data
Place your files in this directory with these exact names:
- `tradelog.csv` - Your individual trade data
- `dailylog.csv` - Your daily portfolio performance data (optional)

### 2. Required CSV Format

#### `tradelog.csv` Format:
```csv
Date,Time,Symbol,Side,Quantity,Price,Commission,Proceeds,PnL,Strategy
2024-01-15,09:30:00,AAPL,Buy,100,150.00,1.00,-15001.00,0.00,Momentum
2024-01-15,15:45:00,AAPL,Sell,100,152.50,1.00,15248.00,246.00,Momentum
```

Required columns:
- **Date**: YYYY-MM-DD format
- **Time**: HH:MM:SS format
- **Symbol**: Stock ticker symbol
- **Side**: "Buy" or "Sell"
- **Quantity**: Number of shares (positive integer)
- **Price**: Execution price per share
- **Commission**: Trading commission/fees
- **Proceeds**: Total transaction amount (negative for buys, positive for sells)
- **PnL**: Profit/Loss for the trade (0 for opening trades)
- **Strategy**: Strategy name (used for filtering)

#### `dailylog.csv` Format:
```csv
Date,Equity,Daily PnL,Cumulative PnL
2024-01-15,100000.00,0.00,0.00
2024-01-16,100246.00,246.00,246.00
```

Required columns:
- **Date**: YYYY-MM-DD format
- **Equity**: Total portfolio value at end of day
- **Daily PnL**: Day's profit/loss
- **Cumulative PnL**: Running total profit/loss

### 3. Running Tests with Your Data

Once you've added your data files, the test suite will automatically detect and use them. If no files are found, the tests will use built-in mock data:

```bash
# Run all tests with your data
PYTHONPATH=/Users/davidromeo/Code/tradeblocks pytest tests/ -v

# Run only performance calculator tests with your data
PYTHONPATH=/Users/davidromeo/Code/tradeblocks pytest tests/unit/test_performance_calculator.py -v

# Run tests with verbose output to see data loading
PYTHONPATH=/Users/davidromeo/Code/tradeblocks pytest tests/ -v -s
```

### 4. Test Behavior

The test suite will:
1. **Check for real data**: If `tradelog.csv` and `dailylog.csv` exist in `tests/data/`, use those
2. **Fall back to mock data**: If files don't exist, use built-in mock data fixtures
3. **Validate data format**: Ensure your data has required columns and proper formatting
4. **Run comprehensive tests**: Execute all performance calculations and validations
5. **Generate test reports**: Show detailed results including any data issues found

## Data Privacy

- **User data stays local**: Your trading data never leaves your machine
- **No data transmission**: Tests run entirely locally without network access
- **Git ignored**: User data files are automatically excluded from version control
- **Secure testing**: All calculations happen in-memory during test execution

## Troubleshooting

### Common Issues

#### "Missing required columns" error:
- Check that your CSV has all required column headers
- Ensure column names match exactly (case-sensitive)
- Verify no extra spaces in column names

#### "Invalid date format" error:
- Dates must be in YYYY-MM-DD format
- Times must be in HH:MM:SS format
- Check for empty date/time fields

#### "No trades found" error:
- Ensure your tradelog has at least one complete buy/sell pair
- Check that PnL is calculated correctly (0 for opening trades)
- Verify Side column uses "Buy" and "Sell" (not "B"/"S")

#### Performance issues with large datasets:
- For files with >10,000 trades, tests may take longer
- Consider using a subset of your data for faster testing
- Large datasets will automatically use performance optimizations

### Getting Help

If you encounter issues:
1. Check the troubleshooting section above
2. Ensure your data format matches the examples exactly
3. Run tests with `-v -s` flags for detailed output
4. Examine the sample data files for reference formatting

## Sample Data Details

The provided sample data contains:
- **500+ realistic trades** across multiple strategies
- **6+ months of daily performance** data
- **Multiple asset classes** (stocks, options, futures)
- **Various trade patterns** (day trades, swing trades, position trades)
- **Realistic profit/loss distributions** for testing edge cases

This sample data is designed to test all aspects of the TradeBlocks analytics engine and can serve as a reference for formatting your own data.
