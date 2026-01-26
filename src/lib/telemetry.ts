/**
 * ATTS Telemetry Client
 *
 * Production instrumentation for form analytics, engagement tracking,
 * and ROI measurement.
 *
 * Features:
 * - Session management via sessionStorage (persists across page reloads)
 * - Batched inserts with 5-second flush interval
 * - Guaranteed delivery via sendBeacon on page unload
 * - Feature flag support (VITE_TELEMETRY_ENABLED)
 * - Privacy-first: no PII in events
 *
 * @module telemetry
 * @see docs/Telemetry_plan.md for full documentation
 */

import { supabase } from './supabaseClient';
import { CONFIG } from './config';
import { logger } from './logger';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Telemetry event structure (matches database schema)
 */
interface TelemetryEvent {
  user_id: string | null;
  session_id: string;
  event_name: TelemetryEventName;
  properties: Record<string, unknown>;
  route: string;
  form_type?: string | null;
}

/**
 * Allowed event names (constrained to match database CHECK constraint)
 */
export type TelemetryEventName =
  | 'form_started'
  | 'form_submitted'
  | 'form_submit_error'
  | 'announcement_viewed'
  | 'form_duplicate_detected'
  | 'form_duplicate_prevented'
  | 'form_duplicate_overridden'
  | 'avatar_uploaded'
  | 'avatar_removed'
  | 'avatar_upload_failed';

/**
 * Form types (constrained to match database CHECK constraint)
 */
export type FormType = 'dvir' | 'equipment' | 'rto' | 'jsa';

/**
 * Properties for form_started event
 */
export interface FormStartedProps {
  form_type: FormType;
  [key: string]: unknown;
}

/**
 * Properties for form_submitted event
 */
export interface FormSubmittedProps {
  form_type: FormType;
  duration_seconds: number;
  [key: string]: unknown;
}

/**
 * Properties for form_submit_error event
 */
export interface FormSubmitErrorProps {
  form_type: FormType;
  error_code: 'VALIDATION_FAILED' | 'NETWORK_ERROR' | 'SERVER_ERROR' | 'AUTH_ERROR' | 'RLS_VIOLATION';
  field_name?: string;
  [key: string]: unknown;
}

/**
 * Properties for announcement_viewed event
 */
export interface AnnouncementViewedProps {
  announcement_id: string;
  is_ai_generated: boolean;
  source: 'dashboard' | 'announcements_page' | 'notification' | 'featured_section';
  [key: string]: unknown;
}

/**
 * Properties for duplicate detection events
 */
export interface DuplicateEventProps {
  form_type: FormType;
  entity_id: string;
  date_for?: string;
  [key: string]: unknown;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Session storage key for telemetry session ID */
const SESSION_KEY = 'atts_telemetry_session_id';

/** Batch flush interval in milliseconds */
const BATCH_INTERVAL_MS = 5000;

/** Maximum events per batch insert */
const MAX_BATCH_SIZE = 50;

/** Supabase URL for sendBeacon endpoint */
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';

// ============================================================================
// STATE
// ============================================================================

/** Event queue for batching */
let eventQueue: TelemetryEvent[] = [];

/** Flush timer reference */
let flushTimer: ReturnType<typeof setTimeout> | null = null;

/** Current user ID (set by setCurrentUserId) */
let currentUserId: string | null = null;

/** Flag to prevent multiple beforeunload handlers */
let beforeUnloadRegistered = false;

// ============================================================================
// SESSION MANAGEMENT
// ============================================================================

/**
 * Initialize or retrieve the telemetry session ID.
 *
 * Session persists across page reloads (sessionStorage) but resets
 * when the browser is closed.
 *
 * @returns Session ID in format: sess_<uuid>
 */
export function initSession(): string {
  if (typeof window === 'undefined') {
    return `sess_server_${Date.now()}`;
  }

  let id = sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    id = `sess_${crypto.randomUUID()}`;
    sessionStorage.setItem(SESSION_KEY, id);
    logger.debug('[Telemetry] New session initialized:', id);
  }
  return id;
}

/**
 * Get the current session ID (creates one if it doesn't exist).
 *
 * @returns Session ID
 */
export function getSessionId(): string {
  if (typeof window === 'undefined') {
    return `sess_server_${Date.now()}`;
  }
  return sessionStorage.getItem(SESSION_KEY) || initSession();
}

/**
 * Clear the current session ID.
 *
 * Call this on user logout to ensure a new session starts
 * when they log back in.
 */
export function clearSession(): void {
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem(SESSION_KEY);
    logger.debug('[Telemetry] Session cleared');
  }
}

/**
 * Clear all telemetry-related localStorage data.
 * SEC-001: Called on logout to prevent data leakage.
 */
export function clearTelemetryStorage(): void {
  if (typeof window !== 'undefined') {
    try {
      // Clear any telemetry-related localStorage keys
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith('telemetry_') || key.startsWith('session_')) {
          localStorage.removeItem(key);
        }
      });
      logger.debug('[Telemetry] Telemetry storage cleared');
    } catch (error) {
      logger.warn('[Telemetry] Failed to clear telemetry storage:', error);
    }
  }
}

// ============================================================================
// USER CONTEXT
// ============================================================================

/**
 * Set the current user ID for telemetry events.
 *
 * Call this when user authentication state changes (login/logout).
 *
 * @param userId - User ID from Supabase auth, or null if logged out
 */
export function setCurrentUserId(userId: string | null): void {
  currentUserId = userId;
  logger.debug('[Telemetry] User ID set:', userId ? 'authenticated' : 'anonymous');
}

/**
 * Get the current user ID.
 *
 * @returns User ID or null
 */
function getCurrentUserId(): string | null {
  return currentUserId;
}

// ============================================================================
// FLUSH LOGIC
// ============================================================================

/**
 * Flush the event queue to Supabase.
 *
 * Sends up to MAX_BATCH_SIZE events in a single insert.
 * Errors are logged but don't prevent future flushes.
 */
async function flush(): Promise<void> {
  if (eventQueue.length === 0) return;

  const batch = eventQueue.splice(0, MAX_BATCH_SIZE);
  const batchSize = batch.length;

  try {
    const { error } = await supabase
      .from('telemetry_events')
      .insert(batch);

    if (error) {
      logger.warn('[Telemetry] Batch insert failed:', error.message);
      // Don't re-queue on failure to avoid infinite loops
      // Events are lost but this is acceptable for analytics
    } else {
      logger.debug(`[Telemetry] Flushed ${batchSize} events`);
    }
  } catch (err) {
    logger.error('[Telemetry] Flush error:', err);
  }

  // If there are still events in queue, schedule another flush
  if (eventQueue.length > 0) {
    scheduleFlush();
  }
}

/**
 * Schedule a flush after BATCH_INTERVAL_MS.
 *
 * Cancels any existing scheduled flush (debouncing).
 */
function scheduleFlush(): void {
  if (flushTimer) {
    clearTimeout(flushTimer);
  }

  flushTimer = setTimeout(() => {
    flush();
    flushTimer = null;
  }, BATCH_INTERVAL_MS);

  // Immediate flush if queue is full
  if (eventQueue.length >= MAX_BATCH_SIZE) {
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    flush();
  }
}

// ============================================================================
// MAIN TRACKING FUNCTION
// ============================================================================

/**
 * Track a telemetry event.
 *
 * Events are queued and flushed in batches for performance.
 * Use specific typed functions (trackFormStarted, etc.) when possible.
 *
 * @param eventName - Event name (from TelemetryEventName union)
 * @param properties - Event properties (varies by event type)
 */
export function track(
  eventName: TelemetryEventName,
  properties: Record<string, unknown> = {}
): void {
  // Check feature flag
  if (!CONFIG.telemetry?.enabled) {
    return;
  }

  // Build event object
  const event: TelemetryEvent = {
    user_id: getCurrentUserId(),
    session_id: getSessionId(),
    event_name: eventName,
    properties: {
      ...properties,
      // Include session_id in properties for redundancy/validation
      session_id: getSessionId(),
    },
    route: typeof window !== 'undefined' ? window.location.pathname : '',
    form_type: (properties.form_type as string) || null,
  };

  // Add to queue
  eventQueue.push(event);

  // Schedule flush
  scheduleFlush();

  logger.debug('[Telemetry] Event queued:', eventName, properties);
}

// ============================================================================
// TYPED TRACKING FUNCTIONS
// ============================================================================

/**
 * Track when a user opens a form.
 *
 * Call this in useEffect on form component mount.
 */
export function trackFormStarted(props: FormStartedProps): void {
  track('form_started', props);
}

/**
 * Track when a form is successfully submitted.
 *
 * Call this after successful form submission.
 */
export function trackFormSubmitted(props: FormSubmittedProps): void {
  track('form_submitted', props);
}

/**
 * Track when a form submission fails.
 *
 * Call this when form submission encounters an error.
 * Do NOT include error messages that may contain user data.
 */
export function trackFormSubmitError(props: FormSubmitErrorProps): void {
  track('form_submit_error', props);
}

/**
 * Track when an announcement is viewed.
 *
 * Call this when announcement enters viewport.
 * Implement deduplication in the calling component.
 */
export function trackAnnouncementViewed(props: AnnouncementViewedProps): void {
  track('announcement_viewed', props);
}

/**
 * Track when a duplicate submission is detected.
 */
export function trackDuplicateDetected(props: DuplicateEventProps): void {
  track('form_duplicate_detected', props);
}

/**
 * Track when a duplicate submission is prevented (user cancels).
 */
export function trackDuplicatePrevented(props: Omit<DuplicateEventProps, 'date_for'>): void {
  track('form_duplicate_prevented', props);
}

/**
 * Track when a user overrides duplicate warning and submits anyway.
 */
export function trackDuplicateOverridden(props: Omit<DuplicateEventProps, 'date_for'>): void {
  track('form_duplicate_overridden', props);
}

// ============================================================================
// PAGE UNLOAD HANDLER
// ============================================================================

/**
 * Register the beforeunload handler for guaranteed delivery.
 *
 * Uses sendBeacon to ensure events are sent even when the page closes.
 */
function registerBeforeUnload(): void {
  if (typeof window === 'undefined' || beforeUnloadRegistered) {
    return;
  }

  window.addEventListener('beforeunload', () => {
    if (eventQueue.length === 0) return;

    // Use sendBeacon for guaranteed delivery
    // This bypasses RLS so we use an Edge Function
    const payload = JSON.stringify({ events: eventQueue });
    const endpoint = `${SUPABASE_URL}/functions/v1/flush-telemetry`;

    const queued = navigator.sendBeacon(endpoint, payload);

    if (!queued) {
      // sendBeacon failed (rare - usually quota exceeded)
      logger.warn('[Telemetry] sendBeacon failed to queue events');
    } else {
      logger.debug(`[Telemetry] sendBeacon queued ${eventQueue.length} events`);
    }

    // Clear queue (beacon handles delivery)
    eventQueue = [];
  });

  beforeUnloadRegistered = true;
  logger.debug('[Telemetry] beforeunload handler registered');
}

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initialize the telemetry system.
 *
 * This is called automatically when the module loads,
 * but can be called again to reinitialize.
 */
export function initTelemetry(): void {
  if (typeof window === 'undefined') {
    return;
  }

  // Initialize session
  initSession();

  // Register beforeunload handler
  registerBeforeUnload();

  logger.debug('[Telemetry] Initialized', {
    enabled: CONFIG.telemetry?.enabled,
    sessionId: getSessionId(),
  });
}

// Auto-initialize on module load (client-side only)
if (typeof window !== 'undefined') {
  initTelemetry();
}

// ============================================================================
// UTILITY: FORM DURATION TRACKING
// ============================================================================

/**
 * Create a timer for tracking form completion time.
 *
 * Usage:
 * ```typescript
 * const timer = createFormTimer();
 * // ... user fills out form ...
 * const duration = timer.getDuration();
 * trackFormSubmitted({ form_type: 'dvir', duration_seconds: duration });
 * ```
 */
export function createFormTimer(): { getDuration: () => number; reset: () => void } {
  let startTime = Date.now();

  return {
    getDuration: () => Math.round((Date.now() - startTime) / 1000),
    reset: () => {
      startTime = Date.now();
    },
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  track,
  trackFormStarted,
  trackFormSubmitted,
  trackFormSubmitError,
  trackAnnouncementViewed,
  trackDuplicateDetected,
  trackDuplicatePrevented,
  trackDuplicateOverridden,
  initSession,
  getSessionId,
  clearSession,
  setCurrentUserId,
  createFormTimer,
  initTelemetry,
};
