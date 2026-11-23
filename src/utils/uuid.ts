/**
 * Generates a unique identifier.
 * Uses crypto.randomUUID() if available (requires secure context).
 * Falls back to a time-based pseudo-random string for non-secure contexts (e.g. testing over IP).
 */
export function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  
  // Fallback for non-secure contexts (HTTP)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  }) + '-' + Date.now().toString(16);
}
