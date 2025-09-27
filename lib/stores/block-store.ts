import { create } from 'zustand'
import { getAllBlocks, getBlock, updateBlock as dbUpdateBlock, deleteBlock as dbDeleteBlock, getTradesByBlock, getDailyLogsByBlock } from '../db'
import { ProcessedBlock } from '../models/block'

export interface Block {
  id: string
  name: string
  description?: string
  isActive: boolean
  created: Date
  lastModified: Date
  tradeLog: {
    fileName: string
    rowCount: number
    fileSize: number
  }
  dailyLog?: {
    fileName: string
    rowCount: number
    fileSize: number
  }
  stats: {
    totalPnL: number
    winRate: number
    totalTrades: number
    avgWin: number
    avgLoss: number
  }
}

interface BlockStore {
  // State
  blocks: Block[]
  activeBlockId: string | null
  isLoading: boolean
  isInitialized: boolean
  error: string | null

  // Actions
  loadBlocks: () => Promise<void>
  setActiveBlock: (blockId: string) => void
  clearActiveBlock: () => void
  addBlock: (block: Omit<Block, 'id' | 'created'>) => Promise<void>
  updateBlock: (id: string, updates: Partial<Block>) => Promise<void>
  deleteBlock: (id: string) => Promise<void>
  refreshBlock: (id: string) => Promise<void>
}

/**
 * Convert ProcessedBlock from DB to Block for UI
 */
function convertProcessedBlockToBlock(processedBlock: ProcessedBlock, tradeCount: number, dailyLogCount: number): Block {
  return {
    id: processedBlock.id,
    name: processedBlock.name,
    description: processedBlock.description,
    isActive: false, // Will be set by active block logic
    created: processedBlock.created,
    lastModified: processedBlock.lastModified,
    tradeLog: {
      fileName: processedBlock.tradeLog.fileName,
      rowCount: tradeCount,
      fileSize: processedBlock.tradeLog.fileSize,
    },
    dailyLog: processedBlock.dailyLog ? {
      fileName: processedBlock.dailyLog.fileName,
      rowCount: dailyLogCount,
      fileSize: processedBlock.dailyLog.fileSize,
    } : undefined,
    stats: {
      totalPnL: 0, // Will be calculated from trades
      winRate: 0,
      totalTrades: tradeCount,
      avgWin: 0,
      avgLoss: 0,
    }
  }
}


export const useBlockStore = create<BlockStore>((set, get) => ({
  // Initialize with empty state
  blocks: [],
  activeBlockId: null,
  isLoading: false,
  isInitialized: false,
  error: null,

  // Load blocks from IndexedDB
  loadBlocks: async () => {
    const state = get()

    // Prevent multiple concurrent loads
    if (state.isLoading || state.isInitialized) {
      return
    }

    set({ isLoading: true, error: null })

    try {
      const processedBlocks = await getAllBlocks()
      const blocks: Block[] = []

      // Convert each ProcessedBlock to Block with trade/daily log counts
      for (const processedBlock of processedBlocks) {
        const trades = await getTradesByBlock(processedBlock.id)
        const dailyLogs = await getDailyLogsByBlock(processedBlock.id)

        // Calculate stats from trades
        const stats = trades.length > 0 ? {
          totalPnL: trades.reduce((sum, trade) => sum + trade.pl, 0),
          winRate: (trades.filter(t => t.pl > 0).length / trades.length) * 100,
          totalTrades: trades.length,
          avgWin: trades.filter(t => t.pl > 0).length > 0
            ? trades.filter(t => t.pl > 0).reduce((sum, t) => sum + t.pl, 0) / trades.filter(t => t.pl > 0).length
            : 0,
          avgLoss: trades.filter(t => t.pl < 0).length > 0
            ? trades.filter(t => t.pl < 0).reduce((sum, t) => sum + t.pl, 0) / trades.filter(t => t.pl < 0).length
            : 0,
        } : {
          totalPnL: 0,
          winRate: 0,
          totalTrades: 0,
          avgWin: 0,
          avgLoss: 0,
        }

        const block = convertProcessedBlockToBlock(processedBlock, trades.length, dailyLogs.length)
        block.stats = stats
        blocks.push(block)
      }

      set({ blocks, isLoading: false, isInitialized: true })
    } catch (error) {
      console.error('Failed to load blocks:', error)
      set({
        error: error instanceof Error ? error.message : 'Failed to load blocks',
        isLoading: false,
        isInitialized: true
      })
    }
  },

  // Actions
  setActiveBlock: (blockId: string) => {
    set(state => ({
      blocks: state.blocks.map(block => ({
        ...block,
        isActive: block.id === blockId
      })),
      activeBlockId: blockId
    }))
  },

  clearActiveBlock: () => {
    set(state => ({
      blocks: state.blocks.map(block => ({
        ...block,
        isActive: false
      })),
      activeBlockId: null
    }))
  },

  addBlock: async (blockData) => {
    try {
      const newBlock: Block = {
        ...blockData,
        id: crypto.randomUUID(),
        created: new Date(),
        lastModified: new Date(),
      }

      set(state => ({
        blocks: [...state.blocks, newBlock],
        // If this is marked as active, update the active block
        ...(newBlock.isActive && {
          activeBlockId: newBlock.id,
          blocks: [
            ...state.blocks.map(b => ({ ...b, isActive: false })),
            newBlock
          ]
        })
      }))
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to add block' })
    }
  },

  updateBlock: async (id: string, updates: Partial<Block>) => {
    try {
      // Update in IndexedDB
      await dbUpdateBlock(id, {
        name: updates.name,
        description: updates.description,
        // Add other updatable fields as needed
      })

      // Update local state
      set(state => ({
        blocks: state.blocks.map(block =>
          block.id === id
            ? { ...block, ...updates, lastModified: new Date() }
            : block
        )
      }))
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to update block' })
    }
  },

  deleteBlock: async (id: string) => {
    try {
      // Delete from IndexedDB
      await dbDeleteBlock(id)

      // Update local state
      set(state => {
        const remainingBlocks = state.blocks.filter(block => block.id !== id)
        const wasActive = state.activeBlockId === id

        return {
          blocks: remainingBlocks,
          // If we deleted the active block, clear the active state
          activeBlockId: wasActive ? null : state.activeBlockId
        }
      })
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to delete block' })
    }
  },

  refreshBlock: async (id: string) => {
    try {
      const processedBlock = await getBlock(id)
      if (!processedBlock) return

      const trades = await getTradesByBlock(id)
      const dailyLogs = await getDailyLogsByBlock(id)

      // Calculate fresh stats
      const stats = trades.length > 0 ? {
        totalPnL: trades.reduce((sum, trade) => sum + trade.pl, 0),
        winRate: (trades.filter(t => t.pl > 0).length / trades.length) * 100,
        totalTrades: trades.length,
        avgWin: trades.filter(t => t.pl > 0).length > 0
          ? trades.filter(t => t.pl > 0).reduce((sum, t) => sum + t.pl, 0) / trades.filter(t => t.pl > 0).length
          : 0,
        avgLoss: trades.filter(t => t.pl < 0).length > 0
          ? trades.filter(t => t.pl < 0).reduce((sum, t) => sum + t.pl, 0) / trades.filter(t => t.pl < 0).length
          : 0,
      } : {
        totalPnL: 0,
        winRate: 0,
        totalTrades: 0,
        avgWin: 0,
        avgLoss: 0,
      }

      const updatedBlock = convertProcessedBlockToBlock(processedBlock, trades.length, dailyLogs.length)
      updatedBlock.stats = stats

      // Update in store
      set(state => ({
        blocks: state.blocks.map(block =>
          block.id === id ? { ...updatedBlock, isActive: block.isActive } : block
        )
      }))
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to refresh block' })
    }
  }
}))