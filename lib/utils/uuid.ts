/**
 * UUID utility function that works across different environments
 */

/**
 * Generate a random UUID v4
 * Falls back to a polyfill if crypto.randomUUID is not available
 */
export function generateUUID(): string {
  // Check if crypto.randomUUID is available (modern browsers and Node.js 16.7.0+)
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  
  // Fallback for older environments
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    // Use crypto.getRandomValues for better security
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = (crypto.getRandomValues(new Uint8Array(1))[0] & 15) >> (c === 'x' ? 0 : 2);
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
  
  // Final fallback using Math.random (less secure but compatible)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}