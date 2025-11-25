import { getTradesByBlock } from "@/lib/db"
import { startOfDay, endOfDay } from "date-fns"

export interface DailyUtilization {
  date: Date
  metrics: {
    totalMarginRequired: number
    peakUtilization: number
    avgUtilization: number
    accountValue: number
    utilizationPercent: number
    tradesOpened: number
    tradesClosed: number
    concurrentPositions: number
    realizedPL: number
    unrealizedPL: number
    dailyPLPercent: number
    strategyUtilization: Record<string, {
      marginRequired: number
      tradeCount: number
      plPercent: number
    }>
  }
  intradaySnapshots?: Array<{
    timestamp: Date
    marginRequired: number
    openPositions: string[] // trade IDs
  }>
}

export async function calculateDailyUtilization(
  blockId: string,
  dateRange: { start: Date; end: Date }
): Promise<DailyUtilization[]> {
  const trades = await getTradesByBlock(blockId)
  
  // Filter trades that overlap with the date range
  const relevantTrades = trades.filter(trade => {
    const openDate = new Date(trade.dateOpened)
    const closeDate = trade.dateClosed ? new Date(trade.dateClosed) : new Date() // Assume open if no close date? Or maybe ignore open trades for now if not supported
    
    // Check if trade overlaps with date range
    return openDate <= dateRange.end && closeDate >= dateRange.start
  })

  const days: DailyUtilization[] = []
  const currentDate = new Date(dateRange.start)

  while (currentDate <= dateRange.end) {
    const dayStart = startOfDay(currentDate)
    const dayEnd = endOfDay(currentDate)
    
    // Find trades active on this day
    const activeTrades = relevantTrades.filter(trade => {
      const openDate = new Date(trade.dateOpened)
      const closeDate = trade.dateClosed ? new Date(trade.dateClosed) : new Date(8640000000000000) // Far future
      
      // Active if it opened before or on this day AND closed on or after this day
      return openDate <= dayEnd && closeDate >= dayStart
    })

    // Calculate metrics for the day
    let totalMarginRequired = 0
    let tradesOpened = 0
    let tradesClosed = 0
    let realizedPL = 0
    const unrealizedPL = 0 // Not easily calculable without daily snapshots, assume 0 for now or estimate
    
    // Strategy breakdown
    const strategyUtilization: Record<string, {
      marginRequired: number
      tradeCount: number
      plPercent: number
    }> = {}

    // Account value estimation
    // Ideally we have a daily log for account value. 
    // If not, we might use the fundsAtClose of the last closed trade of the day, or carry forward.
    // For now, let's try to find the max fundsAtClose of any trade closed on this day or before.
    // This is a rough approximation.
    let accountValue = 0
    
    // Find the most recent account value from closed trades up to this day
    const closedTradesUpToToday = trades.filter(t => t.dateClosed && new Date(t.dateClosed) <= dayEnd)
    if (closedTradesUpToToday.length > 0) {
        // Sort by close date desc
        closedTradesUpToToday.sort((a, b) => new Date(b.dateClosed!).getTime() - new Date(a.dateClosed!).getTime())
        accountValue = closedTradesUpToToday[0].fundsAtClose || 0
    }

    // If no account value found (e.g. start of block), maybe use the first trade's fundsAtClose - PL? 
    // Or just 0 if we can't determine.
    
    activeTrades.forEach(trade => {
      const openDate = new Date(trade.dateOpened)
      const closeDate = trade.dateClosed ? new Date(trade.dateClosed) : null

      // Margin
      totalMarginRequired += trade.marginReq || 0

      // Strategy breakdown
      if (!strategyUtilization[trade.strategy]) {
        strategyUtilization[trade.strategy] = { marginRequired: 0, tradeCount: 0, plPercent: 0 }
      }
      strategyUtilization[trade.strategy].marginRequired += trade.marginReq || 0
      strategyUtilization[trade.strategy].tradeCount += 1

      // Opened today?
      if (openDate >= dayStart && openDate <= dayEnd) {
        tradesOpened++
      }

      // Closed today?
      if (closeDate && closeDate >= dayStart && closeDate <= dayEnd) {
        tradesClosed++
        realizedPL += trade.pl || 0
      }
    })

    const utilizationPercent = accountValue > 0 ? (totalMarginRequired / accountValue) * 100 : 0
    
    // Intraday snapshots approximation
    // We'll create snapshots at open and close of each trade on this day
    const snapshotTimes = new Set<number>()
    snapshotTimes.add(dayStart.getTime())
    snapshotTimes.add(dayEnd.getTime())
    
    activeTrades.forEach(t => {
        const openTime = new Date(t.dateOpened).getTime()
        if (openTime >= dayStart.getTime() && openTime <= dayEnd.getTime()) snapshotTimes.add(openTime)
        
        if (t.dateClosed) {
            const closeTime = new Date(t.dateClosed).getTime()
            if (closeTime >= dayStart.getTime() && closeTime <= dayEnd.getTime()) snapshotTimes.add(closeTime)
        }
    })
    
    const sortedTimes = Array.from(snapshotTimes).sort((a, b) => a - b)
    const intradaySnapshots = sortedTimes.map(time => {
        const timestamp = new Date(time)
        // Calculate margin at this specific moment
        let marginAtTime = 0
        const openPositions: string[] = []
        
        activeTrades.forEach(t => {
            const tOpen = new Date(t.dateOpened).getTime()
            const tClose = t.dateClosed ? new Date(t.dateClosed).getTime() : Number.MAX_VALUE
            
            // Trade is open if tOpen <= time < tClose (or <= depending on precision)
            // Let's say inclusive of open, exclusive of close for margin release?
            // Or inclusive of both?
            if (tOpen <= time && time < tClose) {
                marginAtTime += t.marginReq || 0
                if (t.id !== undefined) {
                    openPositions.push(t.id.toString())
                }
            }
        })
        
        return {
            timestamp,
            marginRequired: marginAtTime,
            openPositions
        }
    })

    // Peak utilization from snapshots
    const peakMargin = Math.max(...intradaySnapshots.map(s => s.marginRequired), 0)
    const peakUtilization = accountValue > 0 ? (peakMargin / accountValue) * 100 : 0
    const avgUtilization = utilizationPercent // Simplified for now

    days.push({
      date: new Date(currentDate),
      metrics: {
        totalMarginRequired,
        peakUtilization,
        avgUtilization,
        accountValue,
        utilizationPercent,
        tradesOpened,
        tradesClosed,
        concurrentPositions: activeTrades.length,
        realizedPL,
        unrealizedPL,
        dailyPLPercent: accountValue > 0 ? (realizedPL / accountValue) * 100 : 0,
        strategyUtilization
      },
      intradaySnapshots
    })

    // Next day
    currentDate.setDate(currentDate.getDate() + 1)
  }

  return days
}
