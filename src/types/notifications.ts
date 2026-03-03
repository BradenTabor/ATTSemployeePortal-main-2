/**
 * Notification System Types
 * 
 * These types are shared between frontend components and Edge Functions.
 * SECURITY: No secrets or sensitive configuration should be defined here.
 */

// ============================================
// Enum-like Union Types
// ============================================

/**
 * Categories for notification classification
 * Matches database constraint on notification_events.category
 */
export type NotificationCategory =
  | 'schedule'
  | 'announcement'
  | 'safety_alert'
  | 'job_update'
  | 'rto_decision'
  | 'admin_notice'
  | 'certification_expiry'
  | 'certification_expiry_digest';

/**
 * Severity levels for notification prioritization
 * Affects display styling and notification behavior (e.g., requireInteraction for critical)
 */
export type NotificationSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Target type for recipient resolution
 * - 'all': All users in the system
 * - 'role': Users with a specific role (target_ref = role name)
 * - 'crew': Users assigned to a specific job (target_ref = job_id)
 * - 'user': Single user (target_ref = user_id)
 */
export type NotificationTargetType = 'all' | 'role' | 'crew' | 'user';

/**
 * User roles that can be targeted
 * Matches database constraint on app_users.role
 */
export type UserRole =
  | 'employee'
  | 'admin'
  | 'manager'
  | 'mechanic'
  | 'general_foreman'
  | 'safety_officer'
  | 'foreman';

// ============================================
// Request/Response Types for Edge Functions
// ============================================

/**
 * Request body for admin-create-notification Edge Function
 * Frontend sends this to create and dispatch a notification
 */
export interface CreateNotificationRequest {
  /** Notification category for filtering and preferences */
  category: NotificationCategory;
  
  /** Priority level affecting display and behavior */
  severity: NotificationSeverity;
  
  /** How to resolve recipients */
  target_type: NotificationTargetType;
  
  /** 
   * Reference for target resolution:
   * - For 'user': user UUID
   * - For 'role': role name (e.g., 'mechanic')
   * - For 'crew': job UUID
   * - For 'all': null/undefined
   */
  target_ref?: string | null;
  
  /** Notification title (required) */
  title: string;
  
  /** Notification body text (optional) */
  body?: string;
  
  /** URL to open when notification is clicked (optional) */
  url?: string;
  
  /** Related entity type for deep linking (optional) */
  entity_type?: string;
  
  /** Related entity ID for deep linking (optional) */
  entity_id?: string;
}

/**
 * Success response from admin-create-notification Edge Function
 */
export interface CreateNotificationResponse {
  success: true;
  
  /** UUID of the created notification event */
  event_id: string;
  
  /** Number of users who will receive the notification */
  dispatched: number;
  
  /** Number of users skipped (e.g., disabled push notifications) */
  skipped: number;
}

/**
 * Error response from admin-create-notification Edge Function
 */
export interface CreateNotificationErrorResponse {
  success: false;
  
  /** Human-readable error message */
  error: string;
  
  /** Optional error details (only in non-production) */
  details?: string;
}

// ============================================
// Database Record Types
// ============================================

/**
 * Notification event record from notification_events table
 */
export interface NotificationEvent {
  id: string;
  created_at: string;
  category: NotificationCategory;
  severity: NotificationSeverity;
  target_type: NotificationTargetType;
  target_ref: string | null;
  title: string;
  body: string | null;
  url: string | null;
  actor_user_id: string | null;
  org_id: string | null;
  entity_type: string | null;
  entity_id: string | null;
}

/**
 * Outbox entry for pending notification delivery
 */
export interface NotificationOutboxEntry {
  id: string;
  event_id: string;
  user_id: string;
  created_at: string;
  category: NotificationCategory;
  severity: NotificationSeverity;
  push_enabled: boolean;
  sms_enabled: boolean;
  status: 'pending' | 'processing' | 'sent' | 'failed' | 'skipped';
  attempts: number;
  max_attempts: number;
  last_error: string | null;
  title: string;
  body: string | null;
  url: string | null;
  dedupe_key: string;
  scheduled_for: string;
  processed_at: string | null;
}

/**
 * User notification preferences per category
 */
export interface NotificationPreference {
  id: string;
  user_id: string;
  category: NotificationCategory;
  created_at: string;
  updated_at: string;
  push_enabled: boolean;
  sms_enabled: boolean;
  quiet_hours: {
    enabled: boolean;
    start: string;
    end: string;
    timezone: string;
  };
}

// ============================================
// UI Helper Types
// ============================================

/**
 * Category options for form select
 */
export const NOTIFICATION_CATEGORIES: { value: NotificationCategory; label: string }[] = [
  { value: 'announcement', label: 'Announcement' },
  { value: 'safety_alert', label: 'Safety Alert' },
  { value: 'job_update', label: 'Job Update' },
  { value: 'schedule', label: 'Schedule Change' },
  { value: 'rto_decision', label: 'Time Off Decision' },
  { value: 'admin_notice', label: 'Admin Notice' },
];

/**
 * Severity options for form select
 */
export const NOTIFICATION_SEVERITIES: { value: NotificationSeverity; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
];

/**
 * Target type options for form select
 */
export const NOTIFICATION_TARGET_TYPES: { value: NotificationTargetType; label: string }[] = [
  { value: 'user', label: 'Just Me (Test)' },
  { value: 'all', label: 'All Users' },
  { value: 'role', label: 'Specific Role' },
  { value: 'crew', label: 'Job Crew' },
];

/**
 * Role options for targeting
 */
export const TARGETABLE_ROLES: { value: UserRole; label: string }[] = [
  { value: 'employee', label: 'Employees' },
  { value: 'mechanic', label: 'Mechanics' },
  { value: 'foreman', label: 'Foremen' },
  { value: 'general_foreman', label: 'General Foremen' },
  { value: 'safety_officer', label: 'Safety Officers' },
  { value: 'manager', label: 'Managers' },
  { value: 'admin', label: 'Admins' },
];

