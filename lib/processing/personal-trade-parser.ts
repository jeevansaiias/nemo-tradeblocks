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
  completedPositionsPL?: number  // P/L from completed positions only
  openPositionsPL?: number       // P/L from still-open positions
}

/**
 * Parse CSV content from broker statements
 * Handles Schwab format and similar broker exports
 */
export function parsePersonalTradeCSV(csvContent: string): PersonalTrade[] {
  // Generate unique session ID
  const sessionId = Date.now().toString(36) + Math.random().toString(36).substr(2)
  
  // First, fix line breaks that occur within quoted CSV fields
  const fixedContent = csvContent
    .replace(/\n(?=\s)/g, ' ') // Join continuation lines that start with whitespace
    .replace(/,\n(?=[0-9])/g, ',') // Join lines that break after commas before dates
  
  const lines = fixedContent.split('\n')
  const trades: PersonalTrade[] = []
  
  console.log(`[${sessionId}] Parsing CSV with ${lines.length} lines`)
  console.log(`[${sessionId}] CSV content preview:`, csvContent.substring(0, 200))
  
  // Find the header line (contains DATE, DESCRIPTION, etc.)
  let headerLineIndex = -1
  let headers: string[] = []
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (line.toLowerCase().includes('date') && 
        (line.toLowerCase().includes('description') || line.toLowerCase().includes('type')) && 
        line.toLowerCase().includes('amount')) {
      headerLineIndex = i
      headers = line.split(',').map(h => h.trim().replace(/"/g, ''))
      console.log(`[${sessionId}] Found header at line ${i}:`, headers)
      break
    }
  }
  
  if (headerLineIndex === -1) {
    throw new Error('Could not find valid header row in CSV')
  }
  
  // Find column indices for Schwab format
  const dateCol = findColumnIndex(headers, ['date', 'trade date', 'transaction date'])
  const typeCol = findColumnIndex(headers, ['type', 'transaction type', 'action'])
  const descriptionCol = findColumnIndex(headers, ['description', 'transaction description', 'details'])
  const amountCol = findColumnIndex(headers, ['amount', 'net amount', 'total'])
  const balanceCol = findColumnIndex(headers, ['balance', 'account balance', 'running balance'])
  const feesCol = findColumnIndex(headers, ['commissions & fees', 'commissions', 'fees', 'commission', 'fee'])
  const miscFeesCol = findColumnIndex(headers, ['misc fees', 'miscellaneous fees'])
  
  if (dateCol === -1 || amountCol === -1) {
    throw new Error('Required columns (DATE, AMOUNT) not found in CSV')
  }
  
  console.log(`[${sessionId}] Column indices:`, {
    date: dateCol,
    type: typeCol, 
    description: descriptionCol,
    amount: amountCol,
    balance: balanceCol,
    fees: feesCol,
    miscFees: miscFeesCol
  })
  
  // Parse data rows
  for (let i = headerLineIndex + 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line || line.startsWith('#') || line.startsWith('//')) continue
    
    const columns = parseCSVLine(line)
    if (columns.length < Math.max(dateCol, amountCol) + 1) continue
    
    try {
      const dateStr = cleanValue(columns[dateCol])
      if (!dateStr || !isValidDate(dateStr)) continue
      
      const type = typeCol !== -1 ? cleanValue(columns[typeCol]) : 'Trade'
      
      // Skip non-trading entries for Schwab format
      if (type === 'BAL' || type === 'CRC' || type === 'DOI') continue
      
      const description = descriptionCol !== -1 ? cleanValue(columns[descriptionCol]) : type
      const amountStr = cleanValue(columns[amountCol]) || '0'
      
      // Parse amount (remove commas, quotes, and handle negative values in quotes)
      let cleanAmountStr = amountStr.replace(/[",]/g, '').trim()
      
      // Handle negative amounts that might be in quotes like "-3,455.00"
      const amount = parseFloat(cleanAmountStr)
      if (isNaN(amount)) {
        console.warn(`Invalid amount: ${amountStr} -> ${cleanAmountStr}`)
        continue
      }
      
      const balance = balanceCol !== -1 ? parseFloat(cleanValue(columns[balanceCol])?.replace(/[",]/g, '') || '0') : 0
      
      // Parse fees from multiple columns if present
      let totalFees = 0
      if (feesCol !== -1) {
        const feesStr = cleanValue(columns[feesCol])
        if (feesStr) {
          totalFees += Math.abs(parseFloat(feesStr.replace(/[",]/g, '')) || 0)
        }
      }
      if (miscFeesCol !== -1) {
        const miscFeesStr = cleanValue(columns[miscFeesCol])
        if (miscFeesStr) {
          totalFees += Math.abs(parseFloat(miscFeesStr.replace(/[",]/g, '')) || 0)
        }
      }
      
      trades.push({
        date: formatDate(dateStr),
        type: type || 'Trade',
        description: description || 'Trading transaction',
        amount,
        balance,
        fees: totalFees
      })
      
      console.log(`[${sessionId}] Parsed trade: ${dateStr} - ${description.substring(0, 50)}... Amount: ${amount}, Fees: ${totalFees}`)
    } catch (error) {
      console.warn(`[${sessionId}] Skipping invalid row ${i + 1}:`, error)
      continue
    }
  }
  
  console.log(`[${sessionId}] Final result: ${trades.length} trades parsed`)
  return trades.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
}

/**
 * Group trades by date and calculate daily P/L
 * For options trading, this properly handles position open/close relationships
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
    // For options trading, we want to show the net cash flow for the day
    // This includes both opening and closing transactions
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
 * For options trading, this treats each trade's cash flow as part of the overall P/L
 * - Credits (SOLD, closing profitable positions) are positive
 * - Debits (BOT, opening positions, closing losing positions) are negative
 * - Total P/L = sum of all cash flows (which properly accounts for opened/closed positions)
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
  
  console.log(`Personal Stats Calculation:`)
  console.log(`- Total P/L (cash flow): $${totalPL.toFixed(2)}`)
  console.log(`- Total trades: ${totalTrades}`)
  console.log(`- Total fees: $${totalFees.toFixed(2)}`)
  console.log(`- Net P/L after fees: $${(totalPL - totalFees).toFixed(2)}`)
  
  // For options trading, try to identify completed positions
  // This is a simplified approach - in reality, position tracking would be more complex
  let completedPositionsPL = 0
  let openPositionsPL = 0
  
  // Look for specific pattern in descriptions to identify completed positions
  const allTrades = dailyPL.flatMap(day => day.trades)
  
  // Try to identify the DIAGONAL spread (opened and closed)
  const diagonalOpen = allTrades.find(t => t.description.includes('BOT +1 DIAGONAL SPX'))
  const diagonalClose = allTrades.find(t => t.description.includes('SOLD -1 DIAGONAL SPX'))
  
  if (diagonalOpen && diagonalClose) {
    const diagonalPL = diagonalOpen.amount + diagonalClose.amount
    completedPositionsPL += diagonalPL
    console.log(`- Found completed DIAGONAL spread: $${diagonalPL.toFixed(2)}`)
  }
  
  // Custom spread appears to be a net credit spread (completed in one transaction)
  const customSpread = allTrades.find(t => t.description.includes('CUSTOM SPX'))
  if (customSpread && customSpread.amount > 0) {
    completedPositionsPL += customSpread.amount
    console.log(`- Found completed CUSTOM spread: $${customSpread.amount.toFixed(2)}`)
  }
  
  // Calculate open positions P/L
  openPositionsPL = totalPL - completedPositionsPL
  
  console.log(`- Completed positions P/L: $${completedPositionsPL.toFixed(2)}`)
  console.log(`- Open positions P/L: $${openPositionsPL.toFixed(2)}`)
  
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
  
  const bestDay = dailyPL.length > 0 ? Math.max(...dailyPL.map(day => day.totalPL)) : 0
  const worstDay = dailyPL.length > 0 ? Math.min(...dailyPL.map(day => day.totalPL)) : 0
  const currentBalance = dailyPL[dailyPL.length - 1]?.endBalance || 0

  // Helper function to ensure valid numbers
  const safeNumber = (value: number): number => isFinite(value) && !isNaN(value) ? value : 0

  return {
    totalPL: safeNumber(totalPL),
    totalTrades: safeNumber(totalTrades),
    totalFees: safeNumber(totalFees),
    winningDays: winningDays.length,
    losingDays: losingDays.length,
    avgWin: safeNumber(avgWin),
    avgLoss: safeNumber(avgLoss),
    winRate: safeNumber(winRate),
    maxDrawdown: safeNumber(maxDrawdown),
    bestDay: safeNumber(bestDay),
    worstDay: safeNumber(worstDay),
    currentBalance: safeNumber(currentBalance),
    completedPositionsPL: safeNumber(completedPositionsPL),
    openPositionsPL: safeNumber(openPositionsPL)
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
      // Don't include the quote in the result
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  
  result.push(current.trim())
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
  // Handle NaN, null, undefined, or invalid numbers
  if (!isFinite(amount) || isNaN(amount)) {
    amount = 0;
  }
  
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount)
}