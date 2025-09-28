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
    name: processedBlock.name || 'Unnamed Block',
    description: processedBlock.description,
    isActive: false, // Will be set by active block logic
    created: processedBlock.created,
    lastModified: processedBlock.lastModified,
    tradeLog: {
      fileName: processedBlock.tradeLog?.fileName || 'unknown.csv',
      rowCount: tradeCount,
      fileSize: processedBlock.tradeLog?.fileSize || 0,
    },
    dailyLog: processedBlock.dailyLog ? {
      fileName: processedBlock.dailyLog.fileName || 'unknown.csv',
      rowCount: dailyLogCount,
      fileSize: processedBlock.dailyLog.fileSize || 0,
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
      // Restore active block ID from localStorage
      const savedActiveBlockId = localStorage.getItem('tradeblocks-active-block-id')

      const processedBlocks = await getAllBlocks()
      const blocks: Block[] = []

      // Convert each ProcessedBlock to Block with trade/daily log counts
      for (const processedBlock of processedBlocks) {
        try {
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

          // Mark as active if this was the previously active block
          block.isActive = block.id === savedActiveBlockId

          blocks.push(block)
        } catch (blockError) {
          console.error(`Failed to load block ${processedBlock.id}:`, blockError)
          // Continue loading other blocks instead of failing completely
        }
      }

      // Set the active block ID if one was restored
      const activeBlockId = savedActiveBlockId && blocks.some(b => b.id === savedActiveBlockId)
        ? savedActiveBlockId
        : null

      set({ blocks, activeBlockId, isLoading: false, isInitialized: true })
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
    // Save to localStorage for persistence
    localStorage.setItem('tradeblocks-active-block-id', blockId)

    set(state => ({
      blocks: state.blocks.map(block => ({
        ...block,
        isActive: block.id === blockId
      })),
      activeBlockId: blockId
    }))
  },

  clearActiveBlock: () => {
    // Remove from localStorage
    localStorage.removeItem('tradeblocks-active-block-id')

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

      // Save to localStorage if this block is active
      if (newBlock.isActive) {
        localStorage.setItem('tradeblocks-active-block-id', newBlock.id)
      }
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

        // If we deleted the active block, clear localStorage
        if (wasActive) {
          localStorage.removeItem('tradeblocks-active-block-id')
        }

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