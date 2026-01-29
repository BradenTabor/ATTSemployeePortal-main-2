/**
 * Push Notification Helper Library
 * 
 * Provides helper functions for creating and dispatching push notifications
 * through the admin-create-notification Edge Function.
 * 
 * USAGE:
 * - Use `createNotificationSilent()` for automatic triggers (non-blocking)
 * - Use `createNotification()` when you need to handle errors explicitly
 * - Use `NotificationBuilders` for type-safe notification payloads
 */

import { supabase } from './supabaseClient';
import type {
  CreateNotificationRequest,
  CreateNotificationResponse,
  CreateNotificationErrorResponse,
  NotificationSeverity,
} from '../types/notifications';

// ============================================
// Core Functions
// ============================================

/**
 * Create and dispatch a notification via the Edge Function.
 * 
 * @param request - The notification request payload
 * @returns The success response with event_id, dispatched count, and skipped count
 * @throws Error if the Edge Function call fails or returns an error
 * 
 * @example
 * ```typescript
 * const result = await createNotification({
 *   category: 'job_update',
 *   severity: 'medium',
 *   target_type: 'crew',
 *   target_ref: jobId,
 *   title: 'New Assignment',
 *   body: 'You have been assigned to a new job',
 * });
 * console.log(`Sent to ${result.dispatched} users`);
 * ```
 */
export async function createNotification(
  request: CreateNotificationRequest
): Promise<CreateNotificationResponse> {
  // Always log notification attempts (even in production)
  console.log('[pushNotifications] 📤 Calling admin-create-notification edge function:', {
    category: request.category,
    target_type: request.target_type,
    target_ref: request.target_ref,
    title: request.title,
  });

  const { data, error } = await supabase.functions.invoke<
    CreateNotificationResponse | CreateNotificationErrorResponse
  >('admin-create-notification', {
    body: request,
  });

  if (error) {
    console.error('[pushNotifications] ❌ Edge Function error:', error);
    throw new Error(error.message || 'Failed to send notification');
  }

  if (!data) {
    console.error('[pushNotifications] ❌ No response from notification server');
    throw new Error('No response from notification server');
  }

  // Check if response indicates failure
  if ('success' in data && data.success === false) {
    const errorData = data as CreateNotificationErrorResponse;
    console.error('[pushNotifications] ❌ Server returned error:', errorData);
    throw new Error(errorData.error || 'Unknown notification error');
  }

  const successData = data as CreateNotificationResponse;
  console.log('[pushNotifications] ✅ Notification sent successfully:', {
    event_id: successData.event_id,
    dispatched: successData.dispatched,
    skipped: successData.skipped,
  });

  return successData;
}

/**
 * Create and dispatch a notification silently (non-blocking).
 * 
 * This function catches all errors and logs them, returning null on failure.
 * Use this for automatic triggers where notification failure should NOT
 * block the primary action (e.g., job creation, announcement publishing).
 * 
 * @param request - The notification request payload
 * @returns The success response, or null if the notification failed
 * 
 * @example
 * ```typescript
 * // After successful job creation
 * const notificationResult = await createNotificationSilent({
 *   category: 'job_update',
 *   severity: 'medium',
 *   target_type: 'crew',
 *   target_ref: jobId,
 *   title: 'New Assignment',
 * });
 * 
 * if (notificationResult) {
 *   toast.success(`Job created and ${notificationResult.dispatched} crew members notified!`);
 * } else {
 *   toast.success('Job created successfully');
 * }
 * ```
 */
export async function createNotificationSilent(
  request: CreateNotificationRequest
): Promise<CreateNotificationResponse | null> {
  try {
    return await createNotification(request);
  } catch (error) {
    // Always log silent failures in production so we can debug
    console.error('[pushNotifications] ⚠️ Notification failed (silent mode):', {
      error: error instanceof Error ? error.message : 'Unknown error',
      category: request.category,
      target_type: request.target_type,
      target_ref: request.target_ref,
      title: request.title,
    });
    
    return null;
  }
}

/**
 * Log a notification payload in development mode without sending.
 * Useful for debugging notification payloads before enabling actual dispatch.
 * 
 * @param request - The notification request payload to log
 */
export function logNotification(request: CreateNotificationRequest): void {
  if (import.meta.env.DEV) {
    console.group('📧 Notification (Dev Mode - Not Sent)');
    console.log('Category:', request.category);
    console.log('Severity:', request.severity);
    console.log('Target:', request.target_type, request.target_ref ?? '(all)');
    console.log('Title:', request.title);
    console.log('Body:', request.body ?? '(none)');
    console.log('URL:', request.url ?? '(none)');
    console.groupEnd();
  }
}

// ============================================
// Notification Builders
// ============================================

/**
 * Type-safe notification builders for common events.
 * 
 * These ensure consistent notification formatting and prevent typos
 * in notification payloads throughout the application.
 */
export const NotificationBuilders = {
  /**
   * Build a notification for job crew assignment.
   * Notifies all crew members assigned to the job.
   * 
   * @param job - Job details including id, name, location, and start date
   * @returns CreateNotificationRequest for crew assignment
   */
  jobAssignment: (job: {
    id: string;
    job_name: string;
    job_location?: string | null;
    start_date: string;
  }): CreateNotificationRequest => {
    // Format the start date for display
    const formattedDate = new Date(job.start_date).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });

    const locationText = job.job_location ? ` at ${job.job_location}` : '';
    
    return {
      category: 'job_update',
      severity: 'medium',
      target_type: 'crew',
      target_ref: job.id,
      title: `📋 New Assignment: ${job.job_name}`,
      body: `You've been assigned to ${job.job_name}${locationText}. Start date: ${formattedDate}`,
      url: `/jobs/${job.id}`,
      entity_type: 'job',
      entity_id: job.id,
    };
  },

  /**
   * Build a notification for job status change.
   * Notifies all crew members assigned to the job.
   * 
   * @param jobId - The job UUID
   * @param status - The new job status
   * @param jobName - Optional job name for the notification body
   * @returns CreateNotificationRequest for status change
   */
  jobStatusChange: (
    jobId: string,
    status: string,
    jobName?: string
  ): CreateNotificationRequest => {
    // Map status to emoji and severity
    const statusConfig: Record<string, { emoji: string; severity: NotificationSeverity }> = {
      completed: { emoji: '✅', severity: 'low' },
      cancelled: { emoji: '🚫', severity: 'medium' },
      paused: { emoji: '⏸️', severity: 'low' },
      active: { emoji: '▶️', severity: 'low' },
    };

    const config = statusConfig[status] || { emoji: '📋', severity: 'low' };
    const statusLabel = status.charAt(0).toUpperCase() + status.slice(1);
    const jobLabel = jobName || 'Job';

    return {
      category: 'job_update',
      severity: config.severity,
      target_type: 'crew',
      target_ref: jobId,
      title: `${config.emoji} Job ${statusLabel}`,
      body: `${jobLabel} has been marked as ${status}.`,
      url: `/jobs/${jobId}`,
      entity_type: 'job',
      entity_id: jobId,
    };
  },

  /**
   * Build a notification for a new announcement.
   * Notifies all users in the system.
   * 
   * @param announcement - Announcement details including title and message
   * @returns CreateNotificationRequest for announcement
   */
  announcement: (announcement: {
    title: string;
    message: string;
  }): CreateNotificationRequest => {
    // Truncate message to 200 characters for notification body
    const truncatedMessage = announcement.message.length > 200
      ? announcement.message.substring(0, 197) + '...'
      : announcement.message;

    return {
      category: 'announcement',
      severity: 'low',
      target_type: 'all',
      title: `📢 ${announcement.title}`,
      body: truncatedMessage,
      url: '/announcements',
      entity_type: 'announcement',
    };
  },

  /**
   * Build a HIGH PRIORITY notification for AI-generated safety announcements.
   * Notifies all users with requireInteraction behavior (won't auto-dismiss).
   * 
   * @param announcement - Safety announcement details
   * @returns CreateNotificationRequest for safety announcement with high priority
   */
  safetyAnnouncement: (announcement: {
    id?: string;
    title: string;
    body: string;
    summary?: string;
  }): CreateNotificationRequest => {
    // Use summary if available (shorter), otherwise truncate body
    const notificationBody = announcement.summary 
      ? announcement.summary
      : announcement.body.length > 200
        ? announcement.body.substring(0, 197) + '...'
        : announcement.body;

    return {
      category: 'safety_alert',
      severity: 'high', // High priority - will require interaction and show prominently
      target_type: 'all',
      title: `⚠️ ${announcement.title}`,
      body: notificationBody,
      url: '/announcements',
      entity_type: 'announcement',
      entity_id: announcement.id,
    };
  },

  /**
   * Build a notification for new signup (admin-only).
   * Used by the notify-admins-new-signup Edge Function when a new user is inserted into app_users.
   * Frontend does not call this; the Database Webhook on app_users INSERT invokes the Edge Function.
   *
   * @param user - New user details (email, full_name)
   * @returns CreateNotificationRequest targeting admin role
   */
  newSignup: (user: { email?: string | null; full_name?: string | null }): CreateNotificationRequest => {
    const displayName = (user.full_name ?? '').trim() || user.email || 'A new user';
    return {
      category: 'admin_notice',
      severity: 'medium',
      target_type: 'role',
      target_ref: 'admin',
      title: 'New signup',
      body: `${displayName} just created an account.`,
      url: '/admin/users',
      entity_type: 'user',
    };
  },
};

// ============================================
// Specialized Notification Functions
// ============================================

/**
 * Defect alert interface matching the detectDefects execution script
 */
export interface DefectAlert {
  id: string;
  truck_number?: string;
  equipment_number?: string;
  equipment_type: 'vehicle' | 'equipment' | 'trailer' | 'aerial';
  defect_items: string[];
  severity: 'critical' | 'warning';
  reported_by: string;
  reported_by_name?: string;
  reported_at: Date;
  source_table: 'dvir_reports' | 'daily_equipment_inspections';
  source_id: string;
}

/**
 * Risk score interface matching the calculateRiskScore execution script
 */
export interface RiskScore {
  total: number;
  level: 'LOW' | 'MODERATE' | 'ELEVATED' | 'HIGH' | 'CRITICAL';
  drivers: string[];
  recommendations: string[];
}

/**
 * Send defect alert to all mechanics.
 * 
 * Used by the Jidoka Maintenance Automation feature to notify mechanics
 * when equipment defects are reported via DVIR or Equipment Inspections.
 * 
 * @param defect - The defect alert details
 * @returns Promise resolving when notification is sent
 * 
 * @example
 * ```typescript
 * await sendDefectAlert({
 *   id: 'dvir-123',
 *   truck_number: '104',
 *   equipment_type: 'vehicle',
 *   defect_items: ['Brake lights', 'Turn signals'],
 *   severity: 'critical',
 *   reported_by: 'user-uuid',
 *   reported_by_name: 'John Smith',
 *   reported_at: new Date(),
 *   source_table: 'dvir_reports',
 *   source_id: '123',
 * });
 * ```
 */
export async function sendDefectAlert(defect: DefectAlert): Promise<void> {
  const itemLabel = defect.truck_number 
    ? `Truck ${defect.truck_number}` 
    : defect.equipment_number || 'Equipment';
  
  const reporterName = defect.reported_by_name || 'Unknown';
  const issueCount = defect.defect_items.length;
  const issueText = issueCount === 1 ? 'issue' : 'issues';

  const result = await createNotificationSilent({
    category: 'safety_alert',
    severity: defect.severity === 'critical' ? 'critical' : 'high',
    target_type: 'role',
    target_ref: 'mechanic',
    title: `🔧 Defect: ${itemLabel}`,
    body: `${reporterName} flagged ${issueCount} ${issueText}. Inspection required.`,
    url: '/mechanic/equipment-logs',
    entity_type: 'defect',
    entity_id: defect.source_id,
  });

  if (result) {
    console.log('[sendDefectAlert] Sent to mechanics:', {
      defect_id: defect.id,
      severity: defect.severity,
      dispatched: result.dispatched,
    });
  }
}

/**
 * Send safety forecast notifications to leadership roles.
 * 
 * Used by the Admin Safety Forecast feature to notify admin, general_foreman,
 * and safety_officer roles when the daily risk level is ELEVATED or higher.
 * 
 * NOTE: Only sends notifications if risk level >= ELEVATED (score >= 2.0)
 * 
 * @param riskScore - The calculated risk score for the day
 * @param dateFor - The date the forecast is for (YYYY-MM-DD format)
 * @returns Promise resolving when all notifications are sent
 * 
 * @example
 * ```typescript
 * await sendSafetyForecastNotifications(
 *   { total: 2.4, level: 'ELEVATED', drivers: ['Wind gusts 28mph'], recommendations: [] },
 *   '2026-01-20'
 * );
 * ```
 */
export async function sendSafetyForecastNotifications(
  riskScore: RiskScore,
  dateFor: string
): Promise<void> {
  // Only notify for ELEVATED+ risk levels
  if (riskScore.total < 2.0) {
    console.log('[sendSafetyForecastNotifications] Risk below ELEVATED, skipping notifications');
    return;
  }

  const emoji: Record<RiskScore['level'], string> = {
    LOW: '✅',
    MODERATE: '📊',
    ELEVATED: '⚠️',
    HIGH: '🔴',
    CRITICAL: '🚨',
  };

  const severity: CreateNotificationRequest['severity'] = 
    riskScore.level === 'CRITICAL' ? 'critical' 
    : riskScore.level === 'HIGH' ? 'high' 
    : 'medium';

  const targetRoles = ['admin', 'general_foreman', 'safety_officer'];
  const topDriver = riskScore.drivers[0] || 'Check email for details.';

  for (const role of targetRoles) {
    const result = await createNotificationSilent({
      category: 'safety_alert',
      severity,
      target_type: 'role',
      target_ref: role,
      title: `${emoji[riskScore.level]} Safety Forecast: ${riskScore.level} Risk`,
      body: `Risk ${riskScore.total.toFixed(1)}/5.0 for ${dateFor}. ${topDriver}`,
      url: '/admin/dashboard',
      entity_type: 'forecast',
    });

    if (result) {
      console.log('[sendSafetyForecastNotifications] Sent to role:', role, 'dispatched:', result.dispatched);
    }
  }
}

// Export types for convenience
export type { CreateNotificationRequest, CreateNotificationResponse };
