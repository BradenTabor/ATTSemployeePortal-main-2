/**
 * Admin Compliance Check at 9:00 AM
 * 
 * This is the core compliance checking logic for the Admin Summary Email.
 * It runs at 9:00 AM America/Chicago on weekdays (Mon-Fri) to identify users 
 * who haven't submitted their required DVIR, Equipment, and JSA forms.
 * 
 * DETERMINISTIC: No LLM involved. All decisions are based on explicit rules.
 */

import type {
  AdminComplianceCheckOptions,
  AdminComplianceSummary,
  AdminNotificationType,
  NonCompliantUser,
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

// =============================================================================
// CONSTANTS
// =============================================================================

const RUN_TYPE = 'admin_compliance_summary_9am';

// Required roles for compliance
const REQUIRED_ROLES = ['employee', 'foreman'];

// Form names for display
const FORM_NAMES = {
  dvir: 'DVIR (Daily Vehicle Inspection Report)',
  equipment: 'Daily Equipment Inspection',
  jsa: 'Daily JSA (Job Safety Analysis)',
};

// =============================================================================
// ENVIRONMENT HELPERS
// =============================================================================

declare const Deno: { env: { get(key: string): string | undefined } } | undefined;
declare const process: { env?: Record<string, string | undefined> } | undefined;

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
 * Check if a date is a weekday (Monday-Friday).
 */
export function isWeekday(dateFor: string, timezone: string): boolean {
  // Parse the date and get the day of week in the target timezone
  const date = new Date(dateFor + 'T12:00:00'); // Use noon to avoid timezone edge cases
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short',
  });
  const dayName = formatter.format(date);
  return !['Sat', 'Sun'].includes(dayName);
}

/**
 * Determine the notification type based on what forms are missing.
 */
export function computeAdminMissingType(
  hasDvir: boolean,
  hasEquipment: boolean,
  hasJsa: boolean
): AdminNotificationType | null {
  // All missing
  if (!hasDvir && !hasEquipment && !hasJsa) return 'missing_all';
  
  // Two missing
  if (!hasDvir && !hasEquipment) return 'missing_dvir_equipment';
  if (!hasDvir && !hasJsa) return 'missing_dvir_jsa';
  if (!hasEquipment && !hasJsa) return 'missing_equipment_jsa';
  
  // One missing
  if (!hasDvir) return 'missing_dvir';
  if (!hasEquipment) return 'missing_equipment';
  if (!hasJsa) return 'missing_jsa';
  
  // All present - compliant
  return null;
}

/**
 * Get human-readable list of missing forms.
 */
export function getMissingFormsList(
  hasDvir: boolean,
  hasEquipment: boolean,
  hasJsa: boolean
): string[] {
  const missing: string[] = [];
  if (!hasDvir) missing.push(FORM_NAMES.dvir);
  if (!hasEquipment) missing.push(FORM_NAMES.equipment);
  if (!hasJsa) missing.push(FORM_NAMES.jsa);
  return missing;
}

// =============================================================================
// DATABASE QUERIES
// =============================================================================

/**
 * Get all users who are required to submit daily forms.
 * Only employees and foremen with valid emails are required.
 */
async function getRequiredUsers(
  supabase: ReturnType<typeof getSupabaseAdmin>
): Promise<RequiredUser[]> {
  const { data, error } = await supabase
    .from('app_users')
    .select('user_id, email, full_name, role')
    .in('role', REQUIRED_ROLES)
    .not('email', 'is', null);

  if (error) {
    safetyLogger.error('Failed to fetch required users', { error: error.message });
    throw new Error(`Failed to fetch required users: ${error.message}`);
  }

  // Filter out users without email (extra safety) and ensure user_id exists
  return (data || []).filter(u => u.email && u.user_id) as RequiredUser[];
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
 * Get user IDs who have submitted JSA for the given date before cutoff.
 * Uses created_at timestamp converted to the target timezone's date.
 */
async function getJsaSubmitters(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  dateFor: string,
  cutoffUtc: Date,
  timezone: string
): Promise<Set<string>> {
  // We need to query JSAs where:
  // 1. The created_at date (in Chicago timezone) matches dateFor
  // 2. The created_at is before the cutoff time
  
  // Build the start and end of the day in the target timezone
  const dayStart = buildCutoffTimestamp(dateFor, '00:00', timezone);
  const dayEnd = cutoffUtc; // Use the 9 AM cutoff as the end
  
  const { data, error } = await supabase
    .from('daily_jsa')
    .select('user_id')
    .gte('created_at', toISOString(dayStart))
    .lt('created_at', toISOString(dayEnd))
    .not('user_id', 'is', null);

  if (error) {
    safetyLogger.error('Failed to fetch JSA submitters', { error: error.message });
    throw new Error(`Failed to fetch JSA submitters: ${error.message}`);
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
    status: 'success' | 'failed' | 'skipped';
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

// =============================================================================
// MAIN FUNCTION
// =============================================================================

/**
 * Run the Admin Compliance Check at 9:00 AM.
 * 
 * This function:
 * 1. Checks if today is a weekday (Mon-Fri)
 * 2. Determines the date and cutoff time
 * 3. Fetches required users (employees + foremen with email)
 * 4. Checks who has submitted DVIR, Equipment, and JSA forms
 * 5. Computes non-compliant users with specific missing forms
 * 6. Returns structured summary data
 * 
 * @param options - Configuration options
 * @returns AdminComplianceSummary with all non-compliant users
 */
export async function checkAdminCompliance9am(
  options: AdminComplianceCheckOptions = {}
): Promise<{ runId: string; summary: AdminComplianceSummary }> {
  // Resolve options with defaults
  const timezone = options.timezone || DEFAULT_TIMEZONE;
  const cutoffLocal = options.cutoffLocal || DEFAULT_CUTOFF;
  const dateFor = options.dateFor || getTodayInTimezone(timezone);
  const dryRun = options.dryRun ?? (getEnvVar('DRY_RUN') === 'true');
  const skipWeekdayCheck = options.skipWeekdayCheck ?? false;

  // Check if today is a weekday (unless overridden for testing)
  if (!skipWeekdayCheck && !isWeekday(dateFor, timezone)) {
    safetyLogger.info('Skipping compliance check - weekend day', { dateFor, timezone });
    return {
      runId: '',
      summary: {
        dateFor,
        generatedAt: nowISO(),
        totalRequired: 0,
        totalCompliant: 0,
        totalNonCompliant: 0,
        missingDvirCount: 0,
        missingEquipmentCount: 0,
        missingJsaCount: 0,
        missingAllCount: 0,
        nonCompliantUsers: [],
        skippedWeekend: true,
      },
    };
  }

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
    runType: RUN_TYPE,
  });

  try {
    // Fetch required users
    const requiredUsers = await getRequiredUsers(supabase);
    safetyLogger.info('Fetched required users', { runId, count: requiredUsers.length });

    // Fetch all submitters in parallel
    const [dvirSubmitters, equipmentSubmitters, jsaSubmitters] = await Promise.all([
      getDvirSubmitters(supabase, dateFor, cutoffUtc),
      getEquipmentSubmitters(supabase, dateFor, cutoffUtc),
      getJsaSubmitters(supabase, dateFor, cutoffUtc, timezone),
    ]);

    safetyLogger.info('Fetched submissions', {
      runId,
      dvirCount: dvirSubmitters.size,
      equipmentCount: equipmentSubmitters.size,
      jsaCount: jsaSubmitters.size,
    });

    // Compute non-compliant users
    const nonCompliantUsers: NonCompliantUser[] = [];
    let compliantCount = 0;

    for (const user of requiredUsers) {
      const hasDvir = dvirSubmitters.has(user.user_id);
      const hasEquipment = equipmentSubmitters.has(user.user_id);
      const hasJsa = jsaSubmitters.has(user.user_id);
      
      const missingType = computeAdminMissingType(hasDvir, hasEquipment, hasJsa);

      if (missingType) {
        nonCompliantUsers.push({
          userId: user.user_id,
          email: user.email,
          fullName: user.full_name,
          role: user.role,
          missingType,
          missingForms: getMissingFormsList(hasDvir, hasEquipment, hasJsa),
          hasDvir,
          hasEquipment,
          hasJsa,
        });
      } else {
        compliantCount++;
      }
    }

    // Sort non-compliant users by missing type severity (most missing first)
    const typePriority: Record<AdminNotificationType, number> = {
      'missing_all': 0,
      'missing_dvir_equipment': 1,
      'missing_dvir_jsa': 2,
      'missing_equipment_jsa': 3,
      'missing_dvir': 4,
      'missing_equipment': 5,
      'missing_jsa': 6,
    };
    nonCompliantUsers.sort((a, b) => typePriority[a.missingType] - typePriority[b.missingType]);

    // Count by missing form type
    const missingDvirCount = nonCompliantUsers.filter(u => !u.hasDvir).length;
    const missingEquipmentCount = nonCompliantUsers.filter(u => !u.hasEquipment).length;
    const missingJsaCount = nonCompliantUsers.filter(u => !u.hasJsa).length;
    const missingAllCount = nonCompliantUsers.filter(u => u.missingType === 'missing_all').length;

    // Build summary
    const summary: AdminComplianceSummary = {
      dateFor,
      generatedAt: nowISO(),
      totalRequired: requiredUsers.length,
      totalCompliant: compliantCount,
      totalNonCompliant: nonCompliantUsers.length,
      missingDvirCount,
      missingEquipmentCount,
      missingJsaCount,
      missingAllCount,
      nonCompliantUsers,
    };

    safetyLogger.info('Computed compliance summary', {
      runId,
      totalRequired: summary.totalRequired,
      totalCompliant: summary.totalCompliant,
      totalNonCompliant: summary.totalNonCompliant,
      missingDvirCount,
      missingEquipmentCount,
      missingJsaCount,
      missingAllCount,
    });

    // Update compliance run with success (we'll update webhooks_sent later)
    await updateComplianceRun(supabase, runId, {
      status: 'success',
      required_user_count: requiredUsers.length,
      missing_dvir_count: missingDvirCount,
      missing_equipment_count: missingEquipmentCount,
      missing_both_count: missingAllCount, // Reusing field for "missing all"
      finished_at: nowISO(),
    });

    return { runId, summary };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Update compliance run with failure
    await updateComplianceRun(supabase, runId, {
      status: 'failed',
      error: errorMessage,
      finished_at: nowISO(),
    });

    safetyLogger.error('Admin compliance check failed', { runId, error: errorMessage });
    throw error;
  }
}

export default checkAdminCompliance9am;

