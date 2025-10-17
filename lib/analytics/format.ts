/**
 * Centralized Number Formatting Utilities
 * Used consistently across all TP Optimizer tables, KPIs, and charts
 */

/**
 * Format number as percentage with 2 decimal places
 * @param value - Number to format (0-100)
 * @returns Formatted string e.g. "58.60%"
 */
export function pct2(value: number): string {
  if (!Number.isFinite(value)) return '0.00%';
  return `${value.toFixed(2)}%`;
}

/**
 * Format number as percentage with 1 decimal place
 * @param value - Number to format (0-100)
 * @returns Formatted string e.g. "58.6%"
 */
export function pct1(value: number): string {
  if (!Number.isFinite(value)) return '0.0%';
  return `${value.toFixed(1)}%`;
}

/**
 * Format number as integer with no decimal places
 * @param value - Number to format
 * @returns Formatted string e.g. "2725"
 */
export function int(value: number): string {
  if (!Number.isFinite(value)) return '0';
  return Math.round(value).toString();
}

/**
 * Format number as integer with thousand separators
 * @param value - Number to format
 * @returns Formatted string e.g. "2,725"
 */
export function k0(value: number): string {
  if (!Number.isFinite(value)) return '0';
  return Math.round(value).toLocaleString('en-US');
}

/**
 * Format number as decimal with 2 places
 * @param value - Number to format
 * @returns Formatted string e.g. "12.34"
 */
export function num2(value: number): string {
  if (!Number.isFinite(value)) return '0.00';
  return value.toFixed(2);
}

/**
 * Format number as decimal with 1 place
 * @param value - Number to format
 * @returns Formatted string e.g. "12.3"
 */
export function num1(value: number): string {
  if (!Number.isFinite(value)) return '0.0';
  return value.toFixed(1);
}

// Export all as namespace for convenience
export const fmt = {
  pct2,
  pct1,
  int,
  k0,
  num2,
  num1,
};
