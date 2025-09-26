import { create } from 'zustand'

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

  // Actions
  setActiveBlock: (blockId: string) => void
  clearActiveBlock: () => void
  addBlock: (block: Omit<Block, 'id' | 'created'>) => void
  updateBlock: (id: string, updates: Partial<Block>) => void
  deleteBlock: (id: string) => void
}

// Mock data that matches our existing structure
const mockBlocks: Block[] = [
  {
    id: "2025-demo",
    name: "2025 Over 100k Trials",
    description: "High-volume testing with over 100k trial runs",
    isActive: true,
    created: new Date("2025-01-15"),
    lastModified: new Date("2025-09-18"),
    tradeLog: {
      fileName: "2025-Over-100k-With-Trial-Tests.csv",
      rowCount: 749,
      fileSize: 1.2 * 1024 * 1024
    },
    dailyLog: {
      fileName: "2025-Over-100k-With-Trial-Tests (1).csv",
      rowCount: 178,
      fileSize: 0.3 * 1024 * 1024
    },
    stats: {
      totalPnL: 12450,
      winRate: 68.2,
      totalTrades: 749,
      avgWin: 245,
      avgLoss: -156
    }
  },
  {
    id: "2024-swing",
    name: "2024 Swing Book",
    description: "Swing trading strategy performance for 2024",
    isActive: false,
    created: new Date("2024-01-01"),
    lastModified: new Date("2025-08-02"),
    tradeLog: {
      fileName: "2024-Swing-Trades.csv",
      rowCount: 553,
      fileSize: 0.9 * 1024 * 1024
    },
    dailyLog: {
      fileName: "2024-Swing-Notes.csv",
      rowCount: 211,
      fileSize: 0.2 * 1024 * 1024
    },
    stats: {
      totalPnL: 8920,
      winRate: 71.2,
      totalTrades: 553,
      avgWin: 312,
      avgLoss: -98
    }
  },
  {
    id: "scalp-tests",
    name: "Scalp Tests",
    description: "Short-term scalping experiments",
    isActive: false,
    created: new Date("2025-03-10"),
    lastModified: new Date("2025-07-15"),
    tradeLog: {
      fileName: "Scalp-Tests.csv",
      rowCount: 234,
      fileSize: 0.4 * 1024 * 1024
    },
    stats: {
      totalPnL: 1120,
      winRate: 62.4,
      totalTrades: 234,
      avgWin: 89,
      avgLoss: -45
    }
  }
]

export const useBlockStore = create<BlockStore>((set) => ({
  // Initialize with mock data
  blocks: mockBlocks,
  activeBlockId: "2025-demo", // Set the first block as active

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

  addBlock: (blockData) => {
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
  },

  updateBlock: (id: string, updates: Partial<Block>) => {
    set(state => ({
      blocks: state.blocks.map(block =>
        block.id === id
          ? { ...block, ...updates, lastModified: new Date() }
          : block
      )
    }))
  },

  deleteBlock: (id: string) => {
    set(state => {
      const remainingBlocks = state.blocks.filter(block => block.id !== id)
      const wasActive = state.activeBlockId === id

      return {
        blocks: remainingBlocks,
        // If we deleted the active block, clear the active state
        activeBlockId: wasActive ? null : state.activeBlockId
      }
    })
  }
}))