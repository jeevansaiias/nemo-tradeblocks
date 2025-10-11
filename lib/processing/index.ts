/**
 * Processing Pipeline - Main exports
 *
 * Provides a unified interface for all CSV processing operations.
 */

export * from './csv-parser'
export * from './trade-processor'
export * from './daily-log-processor'

// Re-export validators for convenience
export * from '../models/validators'

// Unified processing types
export interface FileProcessingResult {
  success: boolean
  data?: unknown
  errors?: Array<{
    type: string
    message: string
    details?: unknown
  }>
  warnings?: string[]
  stats?: {
    processingTimeMs: number
    totalRows: number
    validRows: number
    invalidRows: number
  }
}

// File type detection
export function detectFileType(file: File): 'trade-log' | 'daily-log' | 'unknown' {
  const name = file.name.toLowerCase()

  // Check filename patterns
  if (name.includes('trade') || name.includes('portfolio')) {
    return 'trade-log'
  }

  if (name.includes('daily') || name.includes('day')) {
    return 'daily-log'
  }

  // Default to trade log for generic CSV files
  return 'trade-log'
}

// Utility function to create processing progress callback
interface ProgressInfo {
  stage: string
  progress: number
  rowsProcessed: number
  totalRows: number
  errors: number
  validEntries?: number
  validTrades?: number
  invalidEntries?: number
  invalidTrades?: number
}

export function createProgressCallback(
  onProgress: (stage: string, progress: number, details?: unknown) => void
) {
  return (progressInfo: ProgressInfo) => {
    onProgress(progressInfo.stage, progressInfo.progress, {
      rowsProcessed: progressInfo.rowsProcessed,
      totalRows: progressInfo.totalRows,
      errors: progressInfo.errors,
      validEntries: progressInfo.validEntries || progressInfo.validTrades,
      invalidEntries: progressInfo.invalidEntries || progressInfo.invalidTrades,
    })
  }
}

// File size formatter
export function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB']
  let size = bytes
  let unitIndex = 0

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`
}

// Processing time formatter
export function formatProcessingTime(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${(ms / 60000).toFixed(1)}m`
}