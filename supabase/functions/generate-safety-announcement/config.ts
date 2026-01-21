/**
 * Configuration constants for generate-safety-announcement Edge Function
 */

// =============================================================================
// TIME CONFIGURATION
// =============================================================================

export const DEFAULT_TIMEZONE = 'America/Chicago';
export const DEFAULT_WINDOW_HOURS = 48;

// =============================================================================
// DATA THRESHOLDS
// =============================================================================

export const MIN_SUBMISSIONS = 3;

// =============================================================================
// CHARACTER LIMITS
// =============================================================================

export const BODY_MAX_CHARS = 283;
export const BODY_TARGET_CHARS = 238;
export const SUMMARY_MAX_CHARS = 240;
