import { create } from 'zustand'
import { Trade } from '@/lib/models/trade'
import { DailyLogEntry } from '@/lib/models/daily-log'
import { PortfolioStats } from '@/lib/models/portfolio-stats'
import {
  buildPerformanceSnapshot,
  SnapshotFilters,
  SnapshotChartData
} from '@/lib/services/performance-snapshot'
import { groupTradesByEntry } from '@/lib/utils/combine-leg-groups'

export interface DateRange {
  from: Date | undefined
  to: Date | undefined
}

export interface ChartSettings {
  equityScale: 'linear' | 'log'
  showDrawdownAreas: boolean
  showTrend: boolean
  maWindow: number
  rollingMetricType: 'win_rate' | 'sharpe' | 'profit_factor'
}

export type GroupedOutcome =
  | 'all_losses'
  | 'all_wins'
  | 'mixed'
  | 'single_direction'

export interface GroupedLegEntry {
  id: string
  dateOpened: string
  timeOpened: string
  strategy: string
  legCount: number
  positiveLegs: number
  negativeLegs: number
  outcome: GroupedOutcome
  combinedPl: number
  legPlValues: number[]
}

export interface GroupedLegSummary {
  totalEntries: number
  allLosses: number
  allWins: number
  mixedOutcomes: number
  singleDirection: number
  totalAllLossMagnitude: number
}

export interface GroupedLegOutcomes {
  entries: GroupedLegEntry[]
  summary: GroupedLegSummary
}

export interface PerformanceData extends SnapshotChartData {
  trades: Trade[]
  allTrades: Trade[]
  allRawTrades: Trade[]
  dailyLogs: DailyLogEntry[]
  allDailyLogs: DailyLogEntry[]
  portfolioStats: PortfolioStats | null
  groupedLegOutcomes: GroupedLegOutcomes | null
}

interface PerformanceStore {
  isLoading: boolean
  error: string | null
  dateRange: DateRange
  selectedStrategies: string[]
  data: PerformanceData | null
  chartSettings: ChartSettings
  normalizeTo1Lot: boolean
  setDateRange: (dateRange: DateRange) => void
  setSelectedStrategies: (strategies: string[]) => void
  updateChartSettings: (settings: Partial<ChartSettings>) => void
  fetchPerformanceData: (blockId: string) => Promise<void>
  applyFilters: () => Promise<void>
  setNormalizeTo1Lot: (value: boolean) => void
  reset: () => void
}

const initialDateRange: DateRange = {
  from: undefined,
  to: undefined
}

const initialChartSettings: ChartSettings = {
  equityScale: 'linear',
  showDrawdownAreas: true,
  showTrend: true,
  maWindow: 30,
  rollingMetricType: 'win_rate'
}

function buildSnapshotFilters(dateRange: DateRange, strategies: string[]): SnapshotFilters {
  const filters: SnapshotFilters = {}

  if (dateRange.from || dateRange.to) {
    filters.dateRange = {
      from: dateRange.from,
      to: dateRange.to
    }
  }

  if (strategies.length > 0) {
    filters.strategies = strategies
  }

  return filters
}

export const usePerformanceStore = create<PerformanceStore>((set, get) => ({
  isLoading: false,
  error: null,
  dateRange: initialDateRange,
  selectedStrategies: [],
  data: null,
  chartSettings: initialChartSettings,
  normalizeTo1Lot: false,

  setDateRange: (dateRange) => {
    set({ dateRange })
    get().applyFilters().catch(console.error)
  },

  setSelectedStrategies: (selectedStrategies) => {
    set({ selectedStrategies })
    get().applyFilters().catch(console.error)
  },

  updateChartSettings: (settings) => {
    set(state => ({
      chartSettings: { ...state.chartSettings, ...settings }
    }))
  },

  setNormalizeTo1Lot: (value) => {
    set({ normalizeTo1Lot: value })
    get().applyFilters().catch(console.error)
  },

  fetchPerformanceData: async (blockId: string) => {
    set({ isLoading: true, error: null })

    try {
      const {
        getTradesByBlockWithOptions,
        getTradesByBlock,
        getDailyLogsByBlock,
        getBlock
      } = await import('@/lib/db')

      // Fetch block to get analysis config
      const block = await getBlock(blockId)
      const combineLegGroups = block?.analysisConfig?.combineLegGroups ?? false

      const rawTrades = await getTradesByBlock(blockId)
      const trades = combineLegGroups
        ? await getTradesByBlockWithOptions(blockId, { combineLegGroups })
        : rawTrades
      const dailyLogs = await getDailyLogsByBlock(blockId)

      const state = get()
      const filters = buildSnapshotFilters(state.dateRange, state.selectedStrategies)
      const snapshot = await buildPerformanceSnapshot({
        trades,
        dailyLogs,
        filters,
        riskFreeRate: 2.0,
        normalizeTo1Lot: state.normalizeTo1Lot
      })

      const filteredRawTrades = filterTradesForSnapshot(rawTrades, filters)
      const groupedLegOutcomes = deriveGroupedLegOutcomes(filteredRawTrades)

      set({
        data: {
          trades: snapshot.filteredTrades,
          allTrades: trades,
          allRawTrades: rawTrades,
          dailyLogs: snapshot.filteredDailyLogs,
          allDailyLogs: dailyLogs,
          portfolioStats: snapshot.portfolioStats,
          groupedLegOutcomes,
          ...snapshot.chartData
        },
        isLoading: false
      })
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to load performance data',
        isLoading: false
      })
    }
  },

  applyFilters: async () => {
    const { data, dateRange, selectedStrategies, normalizeTo1Lot } = get()
    if (!data) return

    const filters = buildSnapshotFilters(dateRange, selectedStrategies)

    const snapshot = await buildPerformanceSnapshot({
      trades: data.allTrades,
      dailyLogs: data.allDailyLogs,
      filters,
      riskFreeRate: 2.0,
      normalizeTo1Lot
    })

    const filteredRawTrades = filterTradesForSnapshot(data.allRawTrades, filters)

    set(state => ({
      data: state.data ? {
        ...state.data,
        trades: snapshot.filteredTrades,
        dailyLogs: snapshot.filteredDailyLogs,
        portfolioStats: snapshot.portfolioStats,
        groupedLegOutcomes: deriveGroupedLegOutcomes(filteredRawTrades),
        ...snapshot.chartData
      } : null
    }))
  },

  reset: () => {
    set({
      isLoading: false,
      error: null,
      dateRange: initialDateRange,
      selectedStrategies: [],
      data: null,
      chartSettings: initialChartSettings,
      normalizeTo1Lot: false
    })
  }
}))

// Re-export for existing unit tests that rely on chart processing helpers
export { processChartData } from '@/lib/services/performance-snapshot'

function classifyOutcome(positiveLegs: number, negativeLegs: number, legCount: number): GroupedOutcome {
  if (legCount <= 1) return 'single_direction'
  if (negativeLegs === legCount) return 'all_losses'
  if (positiveLegs === legCount) return 'all_wins'
  if (positiveLegs > 0 && negativeLegs > 0) return 'mixed'
  return 'single_direction'
}

function deriveGroupedLegOutcomes(rawTrades: Trade[]): GroupedLegOutcomes | null {
  if (rawTrades.length === 0) {
    return null
  }

  const groups = groupTradesByEntry(rawTrades)
  const entries: GroupedLegEntry[] = []

  let allLosses = 0
  let allWins = 0
  let mixedOutcomes = 0
  let singleDirection = 0
  let totalAllLossMagnitude = 0

  for (const [key, group] of groups.entries()) {
    if (group.length < 2) continue

    const sorted = [...group].sort((a, b) => {
      const dateCompare = a.dateOpened.getTime() - b.dateOpened.getTime()
      if (dateCompare !== 0) return dateCompare
      return a.timeOpened.localeCompare(b.timeOpened)
    })

    const legPlValues = group.map(trade => trade.pl)
    const positiveLegs = legPlValues.filter(pl => pl > 0).length
    const negativeLegs = legPlValues.filter(pl => pl < 0).length
    const combinedPl = legPlValues.reduce((sum, pl) => sum + pl, 0)
    const outcome = classifyOutcome(positiveLegs, negativeLegs, group.length)

    const entry: GroupedLegEntry = {
      id: key,
      dateOpened: sorted[0].dateOpened.toISOString(),
      timeOpened: sorted[0].timeOpened,
      strategy: sorted[0].strategy,
      legCount: group.length,
      positiveLegs,
      negativeLegs,
      outcome,
      combinedPl,
      legPlValues
    }

    switch (outcome) {
      case 'all_losses':
        allLosses += 1
        totalAllLossMagnitude += Math.abs(combinedPl)
        break
      case 'all_wins':
        allWins += 1
        break
      case 'mixed':
        mixedOutcomes += 1
        break
      default:
        singleDirection += 1
    }

    entries.push(entry)
  }

  if (entries.length === 0) {
    return null
  }

  entries.sort((a, b) => {
    const dateCompare = new Date(a.dateOpened).getTime() - new Date(b.dateOpened).getTime()
    if (dateCompare !== 0) return dateCompare
    return a.timeOpened.localeCompare(b.timeOpened)
  })

  return {
    entries,
    summary: {
      totalEntries: entries.length,
      allLosses,
      allWins,
      mixedOutcomes,
      singleDirection,
      totalAllLossMagnitude
    }
  }
}

function filterTradesForSnapshot(trades: Trade[], filters: SnapshotFilters): Trade[] {
  let filtered = [...trades]

  if (filters.dateRange?.from || filters.dateRange?.to) {
    filtered = filtered.filter(trade => {
      const tradeDate = new Date(trade.dateOpened)
      if (filters.dateRange?.from && tradeDate < filters.dateRange.from) return false
      if (filters.dateRange?.to && tradeDate > filters.dateRange.to) return false
      return true
    })
  }

  if (filters.strategies && filters.strategies.length > 0) {
    const allowed = new Set(filters.strategies)
    filtered = filtered.filter(trade => allowed.has(trade.strategy || 'Unknown'))
  }

  return filtered
}
