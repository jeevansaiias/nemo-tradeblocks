/**
 * Personal Trade Parser for Broker CSV Files
 * Handles CSV parsing from various brokers (Schwab format)
 */

export interface PersonalTrade {
  date: string
  type: string
  description: string
  amount: number
  balance: number
  fees: number
}

export interface DailyPersonalPL {
  date: string
  totalPL: number
  tradeCount: number
  totalFees: number
  endBalance: number
  trades: PersonalTrade[]
}

export interface PersonalTradeStats {
  totalPL: number
  totalTrades: number
  totalFees: number
  winningDays: number
  losingDays: number
  avgWin: number
  avgLoss: number
  winRate: number
  maxDrawdown: number
  bestDay: number
  worstDay: number
  currentBalance: number
}

/**
 * Parse CSV content from broker statements
 * Handles Schwab format and similar broker exports
 */
export function parsePersonalTradeCSV(csvContent: string): PersonalTrade[] {
  const lines = csvContent.split('\n')
  const trades: PersonalTrade[] = []
  
  // Find the header line (contains DATE, DESCRIPTION, etc.)
  let headerLineIndex = -1
  let headers: string[] = []
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (line.toLowerCase().includes('date') && 
        line.toLowerCase().includes('description') && 
        line.toLowerCase().includes('amount')) {
      headerLineIndex = i
      headers = line.split(',').map(h => h.trim().replace(/"/g, ''))
      break
    }
  }
  
  if (headerLineIndex === -1) {
    throw new Error('Could not find valid header row in CSV')
  }
  
  // Find column indices
  const dateCol = findColumnIndex(headers, ['date', 'trade date', 'transaction date'])
  const descriptionCol = findColumnIndex(headers, ['description', 'transaction description', 'details'])
  const typeCol = findColumnIndex(headers, ['type', 'transaction type', 'action'])
  const amountCol = findColumnIndex(headers, ['amount', 'net amount', 'total'])
  const balanceCol = findColumnIndex(headers, ['balance', 'account balance', 'running balance'])
  const feesCol = findColumnIndex(headers, ['commissions', 'fees', 'commission', 'fee'])
  
  if (dateCol === -1 || descriptionCol === -1 || amountCol === -1) {
    throw new Error('Required columns (DATE, DESCRIPTION, AMOUNT) not found in CSV')
  }
  
  // Parse data rows
  for (let i = headerLineIndex + 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line || line.startsWith('#') || line.startsWith('//')) continue
    
    const columns = parseCSVLine(line)
    if (columns.length < Math.max(dateCol, descriptionCol, amountCol) + 1) continue
    
    try {
      const dateStr = cleanValue(columns[dateCol])
      if (!dateStr || !isValidDate(dateStr)) continue
      
      const amount = parseFloat(cleanValue(columns[amountCol]) || '0')
      const balance = balanceCol !== -1 ? parseFloat(cleanValue(columns[balanceCol]) || '0') : 0
      const fees = feesCol !== -1 ? Math.abs(parseFloat(cleanValue(columns[feesCol]) || '0')) : 0
      const type = typeCol !== -1 ? cleanValue(columns[typeCol]) : 'Trade'
      const description = cleanValue(columns[descriptionCol])
      
      // Skip non-trading entries (deposits, withdrawals, etc.)
      if (isNonTradingTransaction(description, type)) continue
      
      trades.push({
        date: formatDate(dateStr),
        type,
        description,
        amount,
        balance,
        fees
      })
    } catch (error) {
      console.warn(`Skipping invalid row ${i + 1}:`, error)
      continue
    }
  }
  
  return trades.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
}

/**
 * Group trades by date and calculate daily P/L
 */
export function groupTradesByDate(trades: PersonalTrade[]): DailyPersonalPL[] {
  const grouped = new Map<string, PersonalTrade[]>()
  
  trades.forEach(trade => {
    const date = trade.date
    if (!grouped.has(date)) {
      grouped.set(date, [])
    }
    grouped.get(date)!.push(trade)
  })
  
  const dailyPL: DailyPersonalPL[] = []
  
  for (const [date, dayTrades] of grouped) {
    const totalPL = dayTrades.reduce((sum, trade) => sum + trade.amount, 0)
    const totalFees = dayTrades.reduce((sum, trade) => sum + trade.fees, 0)
    const endBalance = dayTrades[dayTrades.length - 1]?.balance || 0
    
    dailyPL.push({
      date,
      totalPL,
      tradeCount: dayTrades.length,
      totalFees,
      endBalance,
      trades: dayTrades
    })
  }
  
  return dailyPL.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
}

/**
 * Calculate comprehensive statistics from daily P/L data
 */
export function calculatePersonalStats(dailyPL: DailyPersonalPL[]): PersonalTradeStats {
  if (dailyPL.length === 0) {
    return {
      totalPL: 0,
      totalTrades: 0,
      totalFees: 0,
      winningDays: 0,
      losingDays: 0,
      avgWin: 0,
      avgLoss: 0,
      winRate: 0,
      maxDrawdown: 0,
      bestDay: 0,
      worstDay: 0,
      currentBalance: 0
    }
  }
  
  const totalPL = dailyPL.reduce((sum, day) => sum + day.totalPL, 0)
  const totalTrades = dailyPL.reduce((sum, day) => sum + day.tradeCount, 0)
  const totalFees = dailyPL.reduce((sum, day) => sum + day.totalFees, 0)
  
  const winningDays = dailyPL.filter(day => day.totalPL > 0)
  const losingDays = dailyPL.filter(day => day.totalPL < 0)
  
  const avgWin = winningDays.length > 0 
    ? winningDays.reduce((sum, day) => sum + day.totalPL, 0) / winningDays.length 
    : 0
  const avgLoss = losingDays.length > 0 
    ? losingDays.reduce((sum, day) => sum + day.totalPL, 0) / losingDays.length 
    : 0
  
  const winRate = dailyPL.length > 0 ? (winningDays.length / dailyPL.length) * 100 : 0
  
  // Calculate max drawdown
  let peak = 0
  let maxDrawdown = 0
  let runningPL = 0
  
  for (const day of dailyPL) {
    runningPL += day.totalPL
    if (runningPL > peak) {
      peak = runningPL
    }
    const drawdown = peak - runningPL
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown
    }
  }
  
  const bestDay = Math.max(...dailyPL.map(day => day.totalPL))
  const worstDay = Math.min(...dailyPL.map(day => day.totalPL))
  const currentBalance = dailyPL[dailyPL.length - 1]?.endBalance || 0
  
  return {
    totalPL,
    totalTrades,
    totalFees,
    winningDays: winningDays.length,
    losingDays: losingDays.length,
    avgWin,
    avgLoss,
    winRate,
    maxDrawdown,
    bestDay,
    worstDay,
    currentBalance
  }
}

// Helper functions

function findColumnIndex(headers: string[], possibleNames: string[]): number {
  for (const name of possibleNames) {
    const index = headers.findIndex(header => 
      header.toLowerCase().includes(name.toLowerCase())
    )
    if (index !== -1) return index
  }
  return -1
}

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    
    if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === ',' && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += char
    }
  }
  
  result.push(current)
  return result
}

function cleanValue(value: string): string {
  return value.replace(/['"]/g, '').trim()
}

function isValidDate(dateStr: string): boolean {
  const date = new Date(dateStr)
  return !isNaN(date.getTime())
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toISOString().split('T')[0] // YYYY-MM-DD format
}

function isNonTradingTransaction(description: string, type: string): boolean {
  const nonTradingKeywords = [
    'deposit', 'withdrawal', 'transfer', 'dividend', 'interest', 
    'fee adjustment', 'journal', 'wire', 'ach', 'check'
  ]
  
  const text = `${description} ${type}`.toLowerCase()
  return nonTradingKeywords.some(keyword => text.includes(keyword))
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount)
}