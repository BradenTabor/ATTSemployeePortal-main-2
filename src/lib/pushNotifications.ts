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
import { logger } from './logger';
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
  logger.debug('[pushNotifications] Sending notification:', {
    category: request.category,
    target_type: request.target_type,
    title: request.title,
  });

  const { data, error } = await supabase.functions.invoke<
    CreateNotificationResponse | CreateNotificationErrorResponse
  >('admin-create-notification', {
    body: request,
  });

  if (error) {
    logger.error('[pushNotifications] Edge Function error:', error);
    throw new Error(error.message || 'Failed to send notification');
  }

  if (!data) {
    throw new Error('No response from notification server');
  }

  // Check if response indicates failure
  if ('success' in data && data.success === false) {
    const errorData = data as CreateNotificationErrorResponse;
    throw new Error(errorData.error || 'Unknown notification error');
  }

  const successData = data as CreateNotificationResponse;
  logger.info('[pushNotifications] Notification sent:', {
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
    // Log the error with structured data for debugging
    logger.warn('[pushNotifications] Notification failed (silent):', {
      error: error instanceof Error ? error.message : 'Unknown error',
      category: request.category,
      target_type: request.target_type,
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
};

// Export types for convenience
export type { CreateNotificationRequest, CreateNotificationResponse };

