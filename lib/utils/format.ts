/**
 * Numeric Formatting Utilities for TP Optimizer
 * 
 * Provides consistent formatting across tables, charts, and KPI displays
 * All values handled as DECIMAL values (0-1 range), converted to percentages for display
 * e.g., 0.5867 -> "58.67%"
 */

/**
 * Format a decimal value (0-1 range) as a percentage with 2 decimal places
 * @param value - Decimal value (e.g., 0.5867)
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted string with % sign (e.g., "58.67%")
 */
export function formatPercent(value: number | null | undefined, decimals: number = 2): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return '0.00%';
  }
  
  // If value is already in percentage range (e.g., 58.67), use as-is
  // If value is in decimal range (e.g., 0.5867), multiply by 100
  const isDecimal = Math.abs(value) < 1 && value !== 0;
  const percentValue = isDecimal ? value * 100 : value;
  
  return `${percentValue.toFixed(decimals)}%`;
}

/**
 * Format a percentage value (already as 0-100 range) with 2 decimal places
 * @param value - Percentage value (e.g., 58.67)
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted string with % sign (e.g., "58.67%")
 */
export function formatPercentRaw(value: number | null | undefined, decimals: number = 2): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return '0.00%';
  }
  
  return `${value.toFixed(decimals)}%`;
}

/**
 * Format an integer value with optional thousand separators
 * @param value - Integer value
 * @param useCommas - Whether to include thousand separators (default: true)
 * @returns Formatted string (e.g., "2,725")
 */
export function formatInt(value: number | null | undefined, useCommas: boolean = true): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return '0';
  }
  
  const intValue = Math.round(value);
  
  if (useCommas) {
    return intValue.toLocaleString('en-US');
  }
  
  return intValue.toString();
}

/**
 * Format a value as compact notation (K for thousands, M for millions)
 * @param value - Numeric value
 * @returns Formatted string (e.g., "2.7K", "1.5M")
 */
export function formatCompact(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return '0';
  }
  
  const absValue = Math.abs(value);
  
  if (absValue >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  
  if (absValue >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }
  
  return value.toFixed(2);
}

/**
 * Format a decimal value with fixed decimal places (no % sign)
 * @param value - Decimal value
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted string (e.g., "58.67")
 */
export function formatDecimal(value: number | null | undefined, decimals: number = 2): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return '0.00';
  }
  
  return value.toFixed(decimals);
}

/**
 * Format a value for Recharts tickformat (returns format string, not formatted value)
 * @returns Format string compatible with Recharts (e.g., ".2%")
 */
export function getChartPercentFormat(): string {
  return '.2%';
}

/**
 * Format a value for Plotly tickformat (returns format string)
 * @returns Format string compatible with Plotly (e.g., ",.0%")
 */
export function getPlotlyPercentFormat(): string {
  return ',.0%';
}

/**
 * Export namespace for convenient usage throughout application
 */
export const fmt = {
  percent: formatPercent,
  percentRaw: formatPercentRaw,
  int: formatInt,
  compact: formatCompact,
  decimal: formatDecimal,
};
