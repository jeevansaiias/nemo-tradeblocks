import { TradeProcessor } from '../../lib/processing/trade-processor'

describe('TradeProcessor validateRawTradeData', () => {
  it('normalizes blank strategy values to Unknown', () => {
    const processor = new TradeProcessor()

    const row: Record<string, string> = {
      'Date Opened': '2025-09-23',
      'Time Opened': '09:32:00',
      'Opening Price': '6694.8',
      'Legs': 'Test Legs',
      'Premium': '55',
      'Closing Price': '',
      'Date Closed': '',
      'Time Closed': '',
      'Avg. Closing Cost': '',
      'Reason For Close': '',
      'P/L': '4930.2',
      'No. of Contracts': '99',
      'Funds at Close': '945113.8',
      'Margin Req.': '93555',
      'Strategy': '',
      'Opening Commissions + Fees': '514.8',
      'Opening Short/Long Ratio': '1.48',
      'Gap': '-1.31',
      'Movement': '2.36',
      'Max Profit': '100',
      'Max Loss': '-400',
    }

    // @ts-expect-error accessing private method for targeted validation
    const normalized = processor['validateRawTradeData'](row, 1)

    expect(normalized).not.toBeNull()
    expect(normalized?.['Strategy']).toBe('Unknown')
  })
})
