// Type definition for react-calendar-heatmap to avoid eslint any warnings
declare module 'react-calendar-heatmap' {
  interface Value {
    date: string
    value?: number
    count?: number
  }
  
  interface Props {
    startDate: Date
    endDate: Date
    values: Value[]
    classForValue: (value: Value | null) => string
    onClick?: (value: Value | null) => void
    tooltipDataAttrs?: (value: Value | null) => Record<string, string>
  }
  
  const CalendarHeatmap: React.ComponentType<Props>
  export default CalendarHeatmap
}