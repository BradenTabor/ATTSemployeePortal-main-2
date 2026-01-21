/**
 * Utility functions for generate-safety-announcement Edge Function
 */

// =============================================================================
// DATE/TIME UTILITIES
// =============================================================================

/**
 * Get today's date in the specified timezone (YYYY-MM-DD format)
 */
export function getTodayInTimezone(timezone: string): string {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(now);
}

/**
 * Check if the given date is a weekday (Monday-Friday)
 */
export function isWeekday(dateFor: string, timezone: string): boolean {
  const date = new Date(dateFor + 'T12:00:00');
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short',
  });
  const dayName = formatter.format(date);
  return !['Sat', 'Sun'].includes(dayName);
}

/**
 * Format date for display (e.g., "Saturday, January 11, 2026")
 */
export function formatDateLong(timezone: string): string {
  const now = new Date();
  return now.toLocaleDateString('en-US', {
    timeZone: timezone,
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

// =============================================================================
// TEXT UTILITIES
// =============================================================================

/**
 * Truncate text at a word or sentence boundary
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  
  const truncateAt = maxLength - 3; // Room for "..."
  
  // Try to find end of sentence
  const sentenceEnd = text.lastIndexOf('. ', truncateAt);
  if (sentenceEnd > truncateAt * 0.7) {
    return text.slice(0, sentenceEnd + 1);
  }
  
  // Try to find end of word
  const wordEnd = text.lastIndexOf(' ', truncateAt);
  if (wordEnd > truncateAt * 0.5) {
    return text.slice(0, wordEnd) + '...';
  }
  
  // Hard truncate
  return text.slice(0, truncateAt) + '...';
}

// =============================================================================
// CORS
// =============================================================================

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
