/**
 * Check Compliance at 9:00 AM
 * 
 * This is the core compliance checking logic for the AI Safety + Compliance Agent.
 * It runs at 9:00 AM America/Chicago daily to identify users who haven't submitted
 * their required DVIR and equipment inspections.
 * 
 * DETERMINISTIC: No LLM involved. All decisions are based on explicit rules.
 * IDEMPOTENT: Can be run multiple times safely due to unique constraints.
 */

import type {
  ComplianceCheckOptions,
  ComplianceRunResult,
  NotificationType,
  MissingSubmission,
  RequiredUser,
} from '../types';
import { getSupabaseAdmin } from '../lib/supabaseAdmin';
import { safetyLogger } from '../lib/logger';
import {
  getTodayInTimezone,
  buildCutoffTimestamp,
  toISOString,
  nowISO,
  DEFAULT_TIMEZONE,
  DEFAULT_CUTOFF,
} from '../lib/time';
import { sendComplianceEmail } from './sendComplianceEmail';

// =============================================================================
// CONSTANTS
// =============================================================================

const RUN_TYPE = 'dvir_equipment_9am';

// Required roles for compliance
const REQUIRED_ROLES = ['employee', 'foreman'];

// Declare globals for cross-runtime compatibility
declare const Deno: { env: { get(key: string): string | undefined } } | undefined;
declare const process: { env?: Record<string, string | undefined> } | undefined;

// Detect runtime environment
const isDeno = typeof Deno !== 'undefined';

function getEnvVar(name: string): string | undefined {
  if (isDeno) {
    return Deno?.env.get(name);
  }
  if (typeof process !== 'undefined' && process?.env) {
    return process.env[name];
  }
  return undefined;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Determine the notification type based on what's missing.
 * 
 * @param hasDvir - Whether the user has submitted DVIR
 * @param hasEquipment - Whether the user has submitted equipment inspection
 * @returns The notification type, or null if nothing is missing
 */
export function computeMissingType(
  hasDvir: boolean,
  hasEquipment: boolean
): NotificationType | null {
  if (!hasDvir && !hasEquipment) return 'missing_both';
  if (!hasDvir) return 'missing_dvir';
  if (!hasEquipment) return 'missing_equipment';
  return null;
}

// =============================================================================
// DATABASE QUERIES
// =============================================================================

/**
 * Get all users who are required to submit daily forms.
 * Only employees and foremen with valid emails are required.
 */
async function getRequiredUsers(supabase: ReturnType<typeof getSupabaseAdmin>): Promise<RequiredUser[]> {
  const { data, error } = await supabase
    .from('app_users')
    .select('user_id, email, full_name, role')
    .in('role', REQUIRED_ROLES)
    .not('email', 'is', null);

  if (error) {
    safetyLogger.error('Failed to fetch required users', { error: error.message });
    throw new Error(`Failed to fetch required users: ${error.message}`);
  }

  // Filter out users without email (extra safety)
  return (data || []).filter(u => u.email) as RequiredUser[];
}

/**
 * Get user IDs who have submitted DVIR for the given date before cutoff.
 */
async function getDvirSubmitters(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  dateFor: string,
  cutoffUtc: Date
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('dvir_reports')
    .select('user_id')
    .eq('report_date', dateFor)
    .lt('created_at', toISOString(cutoffUtc))
    .not('user_id', 'is', null);

  if (error) {
    safetyLogger.error('Failed to fetch DVIR submitters', { error: error.message });
    throw new Error(`Failed to fetch DVIR submitters: ${error.message}`);
  }

  return new Set((data || []).map(d => d.user_id).filter(Boolean));
}

/**
 * Get user IDs who have submitted equipment inspection for the given date before cutoff.
 */
async function getEquipmentSubmitters(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  dateFor: string,
  cutoffUtc: Date
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('daily_equipment_inspections')
    .select('user_id')
    .eq('inspection_date', dateFor)
    .lt('created_at', toISOString(cutoffUtc))
    .not('user_id', 'is', null);

  if (error) {
    safetyLogger.error('Failed to fetch equipment submitters', { error: error.message });
    throw new Error(`Failed to fetch equipment submitters: ${error.message}`);
  }

  return new Set((data || []).map(d => d.user_id).filter(Boolean));
}

/**
 * Create a compliance run record.
 */
async function createComplianceRun(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  dateFor: string,
  cutoffUtc: Date,
  timezone: string,
  dryRun: boolean
): Promise<string> {
  const { data, error } = await supabase
    .from('compliance_runs')
    .insert({
      run_type: RUN_TYPE,
      date_for: dateFor,
      cutoff_time: toISOString(cutoffUtc),
      timezone,
      dry_run: dryRun,
      status: 'running',
    })
    .select('id')
    .single();

  if (error) {
    safetyLogger.error('Failed to create compliance run', { error: error.message });
    throw new Error(`Failed to create compliance run: ${error.message}`);
  }

  return data.id;
}

/**
 * Update a compliance run with results.
 */
async function updateComplianceRun(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  runId: string,
  result: Partial<{
    status: 'success' | 'failed';
    required_user_count: number;
    missing_dvir_count: number;
    missing_equipment_count: number;
    missing_both_count: number;
    webhooks_sent: number;
    webhooks_skipped: number;
    error: string;
    finished_at: string;
  }>
): Promise<void> {
  const { error } = await supabase
    .from('compliance_runs')
    .update(result)
    .eq('id', runId);

  if (error) {
    safetyLogger.error('Failed to update compliance run', { runId, error: error.message });
    // Don't throw - this is a secondary operation
  }
}

/**
 * Try to insert a notification record.
 * Returns true if inserted (new), false if duplicate (already exists).
 */
async function insertNotification(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  dateFor: string,
  userId: string,
  notificationType: NotificationType,
  email: string
): Promise<{ inserted: boolean; id: string | null }> {
  // Use upsert with ON CONFLICT DO NOTHING behavior
  const { data, error } = await supabase
    .from('compliance_notifications')
    .insert({
      date_for: dateFor,
      user_id: userId,
      notification_type: notificationType,
      sent_to: email,
      status: 'pending',
    })
    .select('id')
    .single();

  if (error) {
    // Check if it's a duplicate key error (code 23505)
    if (error.code === '23505') {
      return { inserted: false, id: null };
    }
    safetyLogger.error('Failed to insert notification', { userId, error: error.message });
    throw new Error(`Failed to insert notification: ${error.message}`);
  }

  return { inserted: true, id: data.id };
}

/**
 * Update a notification record after attempting to send.
 */
async function updateNotification(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  notificationId: string,
  update: Partial<{
    status: 'sent' | 'failed' | 'skipped';
    sent_at: string;
    webhook_response: unknown;
    error: string;
  }>
): Promise<void> {
  const { error } = await supabase
    .from('compliance_notifications')
    .update(update)
    .eq('id', notificationId);

  if (error) {
    safetyLogger.error('Failed to update notification', { notificationId, error: error.message });
    // Don't throw - this is a secondary operation
  }
}

// =============================================================================
// MAIN FUNCTION
// =============================================================================

/**
 * Run the 9:00 AM compliance check.
 * 
 * This function:
 * 1. Determines the date and cutoff time
 * 2. Fetches required users (employees + foremen with email)
 * 3. Checks who has submitted DVIR and equipment inspections
 * 4. Computes missing submissions
 * 5. Creates notification records (idempotent via unique constraint)
 * 6. Sends webhooks to Make.com for new notifications
 * 7. Updates audit records
 * 
 * @param options - Configuration options
 * @returns ComplianceRunResult with summary statistics
 */
export async function checkCompliance9am(
  options: ComplianceCheckOptions = {}
): Promise<ComplianceRunResult> {
  // Resolve options with defaults
  const timezone = options.timezone || DEFAULT_TIMEZONE;
  const cutoffLocal = options.cutoffLocal || DEFAULT_CUTOFF;
  const dateFor = options.dateFor || getTodayInTimezone(timezone);
  const dryRun = options.dryRun ?? (getEnvVar('DRY_RUN') === 'true');
  const notificationsEnabled = options.notificationsEnabled ?? 
    (getEnvVar('EMAIL_NOTIFICATIONS_ENABLED') !== 'false');

  // Build cutoff timestamp
  const cutoffUtc = buildCutoffTimestamp(dateFor, cutoffLocal, timezone);

  // Get Supabase admin client
  const supabase = getSupabaseAdmin();

  // Create compliance run record
  const runId = await createComplianceRun(supabase, dateFor, cutoffUtc, timezone, dryRun);

  safetyLogger.runStart(runId, dateFor, {
    cutoffLocal,
    cutoffUtc: toISOString(cutoffUtc),
    timezone,
    dryRun,
    notificationsEnabled,
  });

  try {
    // Fetch required users
    const requiredUsers = await getRequiredUsers(supabase);
    safetyLogger.info('Fetched required users', { runId, count: requiredUsers.length });

    // Fetch submitters
    const [dvirSubmitters, equipmentSubmitters] = await Promise.all([
      getDvirSubmitters(supabase, dateFor, cutoffUtc),
      getEquipmentSubmitters(supabase, dateFor, cutoffUtc),
    ]);

    safetyLogger.info('Fetched submissions', {
      runId,
      dvirCount: dvirSubmitters.size,
      equipmentCount: equipmentSubmitters.size,
    });

    // Compute missing submissions
    const missingSubmissions: MissingSubmission[] = [];

    for (const user of requiredUsers) {
      const hasDvir = dvirSubmitters.has(user.user_id);
      const hasEquipment = equipmentSubmitters.has(user.user_id);
      const missingType = computeMissingType(hasDvir, hasEquipment);

      if (missingType) {
        missingSubmissions.push({
          userId: user.user_id,
          email: user.email,
          fullName: user.full_name,
          role: user.role,
          type: missingType,
        });
      }
    }

    // Count by type
    const missingDvirCount = missingSubmissions.filter(
      m => m.type === 'missing_dvir' || m.type === 'missing_both'
    ).length;
    const missingEquipmentCount = missingSubmissions.filter(
      m => m.type === 'missing_equipment' || m.type === 'missing_both'
    ).length;
    const missingBothCount = missingSubmissions.filter(
      m => m.type === 'missing_both'
    ).length;

    safetyLogger.info('Computed missing submissions', {
      runId,
      total: missingSubmissions.length,
      missingDvirCount,
      missingEquipmentCount,
      missingBothCount,
    });

    // Process notifications
    let webhooksSent = 0;
    let webhooksSkipped = 0;

    for (const missing of missingSubmissions) {
      // Try to insert notification (idempotent)
      const { inserted, id: notificationId } = await insertNotification(
        supabase,
        dateFor,
        missing.userId,
        missing.type,
        missing.email
      );

      if (!inserted) {
        // Duplicate - already notified today
        safetyLogger.notificationSkipped(runId, missing.userId, missing.type, 'duplicate');
        webhooksSkipped++;
        continue;
      }

      // Skip sending if notifications are disabled or dry run
      if (!notificationsEnabled || dryRun) {
        const reason = dryRun ? 'dry_run' : 'notifications_disabled';
        safetyLogger.notificationSkipped(runId, missing.userId, missing.type, reason);
        
        // Update notification status
        await updateNotification(supabase, notificationId!, {
          status: 'skipped',
          error: reason,
        });
        webhooksSkipped++;
        continue;
      }

      // Send webhook to Make.com
      const result = await sendComplianceEmail({
        notificationId: notificationId!,
        dateFor,
        user: {
          id: missing.userId,
          email: missing.email,
          fullName: missing.fullName,
          role: missing.role,
        },
        missingType: missing.type,
        runId,
      });

      // Update notification with result
      if (result.success) {
        await updateNotification(supabase, notificationId!, {
          status: 'sent',
          sent_at: nowISO(),
          webhook_response: result.webhookResponse,
        });
        safetyLogger.notificationSent(runId, missing.userId, missing.type, missing.email);
        webhooksSent++;
      } else {
        await updateNotification(supabase, notificationId!, {
          status: 'failed',
          error: result.error,
          webhook_response: result.webhookResponse,
        });
        safetyLogger.error('Notification failed', {
          runId,
          userId: missing.userId,
          error: result.error,
        });
        // Still count as skipped for the run summary
        webhooksSkipped++;
      }
    }

    // Update compliance run with success
    await updateComplianceRun(supabase, runId, {
      status: 'success',
      required_user_count: requiredUsers.length,
      missing_dvir_count: missingDvirCount,
      missing_equipment_count: missingEquipmentCount,
      missing_both_count: missingBothCount,
      webhooks_sent: webhooksSent,
      webhooks_skipped: webhooksSkipped,
      finished_at: nowISO(),
    });

    const result: ComplianceRunResult = {
      runId,
      dateFor,
      requiredUserCount: requiredUsers.length,
      missingDvirCount,
      missingEquipmentCount,
      missingBothCount,
      webhooksSent,
      webhooksSkipped,
      status: 'success',
      dryRun,
    };

    safetyLogger.runEnd(runId, result as unknown as Record<string, unknown>);

    return result;

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Update compliance run with failure
    await updateComplianceRun(supabase, runId, {
      status: 'failed',
      error: errorMessage,
      finished_at: nowISO(),
    });

    safetyLogger.error('Compliance run failed', { runId, error: errorMessage });

    return {
      runId,
      dateFor,
      requiredUserCount: 0,
      missingDvirCount: 0,
      missingEquipmentCount: 0,
      missingBothCount: 0,
      webhooksSent: 0,
      webhooksSkipped: 0,
      status: 'failed',
      error: errorMessage,
      dryRun,
    };
  }
}

export default checkCompliance9am;

