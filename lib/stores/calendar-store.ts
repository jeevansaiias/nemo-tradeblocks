import { create } from 'zustand'
import { CalendarColorMode, CalendarDaySummary, CalendarViewMode, CalendarDataService } from '@/lib/services/calendar-data-service'
import { DailyUtilization } from '@/lib/calculations/utilization-analyzer'
import { startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear } from 'date-fns'

import { format } from 'date-fns'

interface CalendarState {
  view: CalendarViewMode
  colorBy: CalendarColorMode
  currentDate: Date
  selectedDate: Date | null
  daySummaries: CalendarDaySummary[]
  dailyUtilizations: DailyUtilization[]
  isLoading: boolean
  error: string | null
  
  // Actions
  setView: (view: CalendarViewMode) => void
  setColorBy: (colorBy: CalendarColorMode) => void
  setCurrentDate: (date: Date) => void
  setSelectedDate: (date: Date | null) => void
  loadData: (blockId: string) => Promise<void>
  getSelectedDaySummary: () => CalendarDaySummary | undefined
}

export const useCalendarStore = create<CalendarState>((set, get) => ({
  view: 'month',
  colorBy: 'pl',
  currentDate: new Date(),
  selectedDate: null,
  daySummaries: [],
  dailyUtilizations: [],
  isLoading: false,
  error: null,

  setView: (view) => set({ view }),
  setColorBy: (colorBy) => set({ colorBy }),
  setCurrentDate: (currentDate) => set({ currentDate }),
  setSelectedDate: (selectedDate) => set({ selectedDate }),
  
  getSelectedDaySummary: () => {
    const { daySummaries, selectedDate } = get()
    if (!selectedDate) return undefined
    const dateKey = format(selectedDate, 'yyyy-MM-dd')
    return daySummaries.find(s => s.date === dateKey)
  },
  
  loadData: async (blockId: string) => {
    set({ isLoading: true, error: null })
    try {
      const { view, currentDate, colorBy } = get()
      let start: Date, end: Date
      
      if (view === 'month') {
        start = startOfMonth(currentDate)
        end = endOfMonth(currentDate)
      } else if (view === 'quarter') {
        start = startOfQuarter(currentDate)
        end = endOfQuarter(currentDate)
      } else {
        start = startOfYear(currentDate)
        end = endOfYear(currentDate)
      }
      
      const { summaries, utilizations } = await CalendarDataService.buildCalendarDaySummaries(
        blockId,
        { start, end },
        colorBy
      )
      
      set({ daySummaries: summaries, dailyUtilizations: utilizations, isLoading: false })
    } catch (error) {
      console.error("Failed to load calendar data:", error)
      set({ error: "Failed to load calendar data", isLoading: false })
    }
  }
}))
