import { render, screen } from "@testing-library/react";
import { TradingFrequencyCard } from "@/components/risk-simulator/trading-frequency-card";
import { Trade } from "@/lib/models/trade";

// Mock trade generator
function createMockTrades(count: number, startDate: Date, endDate: Date): Trade[] {
  const trades: Trade[] = [];
  const timeSpan = endDate.getTime() - startDate.getTime();

  for (let i = 0; i < count; i++) {
    const tradeDate = new Date(startDate.getTime() + (timeSpan * i / count));
    trades.push({
      id: `trade-${i}`,
      dateOpened: tradeDate,
      dateClosed: tradeDate,
      timeOpened: "09:30:00",
      timeClosed: "10:30:00",
      ticker: "SPY",
      strategy: "Test Strategy",
      quantity: 100,
      entryPrice: 100,
      exitPrice: 101,
      pl: 100,
      plPercent: 1,
      commission: 1,
      totalCommissions: 2,
      openingCommissionsFees: 1,
      closingCommissionsFees: 1,
      tradeType: "LONG",
      marginUsed: 10000,
      accountBalance: 100000,
      accountPeak: 100000,
      capitalEfficiency: 1,
      kelly: 0.05,
    });
  }

  return trades;
}

describe("TradingFrequencyCard", () => {
  it("should display correct frequency for regular trader (252 trades/year)", () => {
    const startDate = new Date("2023-01-01");
    const endDate = new Date("2024-01-01");
    const trades = createMockTrades(252, startDate, endDate);

    render(<TradingFrequencyCard trades={trades} tradesPerYear={252} />);

    expect(screen.getByText("252")).toBeInTheDocument();
    expect(screen.getByText("trades/year")).toBeInTheDocument();
    expect(screen.getByText(/21 trades\/month/)).toBeInTheDocument();
    expect(screen.getByText("252 trades")).toBeInTheDocument();
    expect(screen.getByText(/1\.0 year/)).toBeInTheDocument();
  });

  it("should display correct frequency for high-frequency trader", () => {
    const startDate = new Date("2024-01-01");
    const endDate = new Date("2024-01-31"); // 1 month
    const trades = createMockTrades(800, startDate, endDate); // ~40 trades/day

    render(<TradingFrequencyCard trades={trades} tradesPerYear={10400} />);

    expect(screen.getByText("10,400")).toBeInTheDocument();
    expect(screen.getByText("trades/year")).toBeInTheDocument();
    expect(screen.getByText(/40 trades\/day/)).toBeInTheDocument(); // 10400/260 trading days
    expect(screen.getByText("800 trades")).toBeInTheDocument();
    expect(screen.getByText(/1 month/)).toBeInTheDocument();
  });

  it("should display correct frequency for active trader", () => {
    const startDate = new Date("2023-01-01");
    const endDate = new Date("2023-06-30"); // 6 months
    const trades = createMockTrades(1000, startDate, endDate);

    render(<TradingFrequencyCard trades={trades} tradesPerYear={2000} />);

    expect(screen.getByText("2,000")).toBeInTheDocument();
    expect(screen.getByText("trades/year")).toBeInTheDocument();
    expect(screen.getByText(/38 trades\/week/)).toBeInTheDocument(); // 2000/52 weeks
    expect(screen.getByText("1,000 trades")).toBeInTheDocument();
    expect(screen.getByText(/6 months/)).toBeInTheDocument();
  });

  it("should display correct frequency for occasional trader", () => {
    const startDate = new Date("2022-01-01");
    const endDate = new Date("2024-01-01"); // 2 years
    const trades = createMockTrades(100, startDate, endDate);

    render(<TradingFrequencyCard trades={trades} tradesPerYear={50} />);

    expect(screen.getByText("50")).toBeInTheDocument();
    expect(screen.getByText("trades/year")).toBeInTheDocument();
    expect(screen.getByText(/50 trades\/year/)).toBeInTheDocument();
    expect(screen.getByText("100 trades")).toBeInTheDocument();
    expect(screen.getByText(/2\.0 years/)).toBeInTheDocument();
  });

  it("should handle edge case with less than 2 trades", () => {
    const trades = createMockTrades(1, new Date("2024-01-01"), new Date("2024-01-01"));

    render(<TradingFrequencyCard trades={trades} tradesPerYear={252} />);

    expect(screen.getByText("252")).toBeInTheDocument();
    expect(screen.getByText("1 trade")).toBeInTheDocument(); // Singular
  });

  it("should handle empty trades array", () => {
    render(<TradingFrequencyCard trades={[]} tradesPerYear={252} />);

    expect(screen.getByText("252")).toBeInTheDocument();
    expect(screen.getByText("0 trades")).toBeInTheDocument();
  });

  it("should display trading rate correctly for different frequencies", () => {
    // Test formatTradingRate logic
    const startDate = new Date("2024-01-01");
    const endDate = new Date("2024-01-02");

    // Very high frequency: 40+ trades per day
    let trades = createMockTrades(40, startDate, endDate);
    const { rerender } = render(<TradingFrequencyCard trades={trades} tradesPerYear={14600} />);
    expect(screen.getByText(/40 trades\/day/)).toBeInTheDocument();

    // Active weekly trader
    rerender(<TradingFrequencyCard trades={trades} tradesPerYear={1040} />);
    expect(screen.getByText(/20 trades\/week/)).toBeInTheDocument();

    // Monthly trader
    rerender(<TradingFrequencyCard trades={trades} tradesPerYear={240} />);
    expect(screen.getByText(/20 trades\/month/)).toBeInTheDocument();

    // Occasional trader
    rerender(<TradingFrequencyCard trades={trades} tradesPerYear={50} />);
    expect(screen.getByText(/50 trades\/year/)).toBeInTheDocument();
  });

  it("should format time period correctly", () => {
    const startDate = new Date("2024-01-01");

    // Test years display
    let endDate = new Date("2025-06-01"); // 1.5 years
    let trades = createMockTrades(100, startDate, endDate);
    const { rerender } = render(<TradingFrequencyCard trades={trades} tradesPerYear={252} />);
    expect(screen.getByText(/1\.4 years/)).toBeInTheDocument();

    // Test months display
    endDate = new Date("2024-04-01"); // 3 months
    trades = createMockTrades(100, startDate, endDate);
    rerender(<TradingFrequencyCard trades={trades} tradesPerYear={252} />);
    expect(screen.getByText(/3 months/)).toBeInTheDocument();

    // Test days display
    endDate = new Date("2024-01-15"); // 14 days
    trades = createMockTrades(100, startDate, endDate);
    rerender(<TradingFrequencyCard trades={trades} tradesPerYear={252} />);
    expect(screen.getByText(/14 days/)).toBeInTheDocument();
  });
});