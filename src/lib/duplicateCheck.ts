/**
 * Duplicate Detection Utility
 *
 * Pre-submit check for duplicate form submissions.
 * Checks for same date_for + entity (truck/equipment) + user combination.
 *
 * @module duplicateCheck
 * @see docs/Telemetry_plan.md for full documentation
 */

import { supabase } from './supabaseClient';
import { logger } from './logger';

// ============================================================================
// TYPES
// ============================================================================

export interface DuplicateCheckParams {
  /** Form type: 'dvir' | 'equipment' */
  formType: 'dvir' | 'equipment';
  /** User ID performing the check */
  userId: string;
  /** Date of the inspection (YYYY-MM-DD format) */
  dateFor: string;
  /** Entity identifier (truck number or equipment number) */
  entityId: string;
}

export interface DuplicateCheckResult {
  /** Whether a duplicate was found */
  isDuplicate: boolean;
  /** Existing record if found */
  existingRecord?: {
    id: string;
    created_at: string;
    submitted_by?: string;
  };
  /** Error message if check failed */
  error?: string;
}

// ============================================================================
// TABLE CONFIGURATION
// ============================================================================

const TABLE_CONFIG = {
  dvir: {
    table: 'dvir_reports',
    dateColumn: 'report_date',
    entityColumn: 'truck_number',
  },
  equipment: {
    table: 'daily_equipment_inspections',
    dateColumn: 'inspection_date',
    entityColumn: 'equipment_number',
  },
} as const;

// ============================================================================
// MAIN FUNCTION
// ============================================================================

/**
 * Check for duplicate form submission.
 *
 * Queries the database to see if a submission already exists for the
 * same date, entity, and user combination.
 *
 * @param params - Check parameters
 * @returns Result indicating if duplicate exists
 *
 * @example
 * ```typescript
 * const result = await checkForDuplicate({
 *   formType: 'dvir',
 *   userId: user.id,
 *   dateFor: '2026-01-16',
 *   entityId: 'B132',
 * });
 *
 * if (result.isDuplicate) {
 *   // Show warning modal
 * }
 * ```
 */
export async function checkForDuplicate(
  params: DuplicateCheckParams
): Promise<DuplicateCheckResult> {
  const { formType, userId, dateFor, entityId } = params;
  const config = TABLE_CONFIG[formType];

  if (!config) {
    logger.error('[DuplicateCheck] Unknown form type:', formType);
    return { isDuplicate: false, error: 'Unknown form type' };
  }

  try {
    const { data, error } = await supabase
      .from(config.table)
      .select('id, created_at, submitted_by')
      .eq('user_id', userId)
      .eq(config.dateColumn, dateFor)
      .eq(config.entityColumn, entityId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      logger.error('[DuplicateCheck] Query error:', error.message);
      return { isDuplicate: false, error: error.message };
    }

    if (data) {
      logger.info('[DuplicateCheck] Duplicate found:', {
        formType,
        entityId,
        dateFor,
        existingId: data.id,
      });

      return {
        isDuplicate: true,
        existingRecord: {
          id: data.id,
          created_at: data.created_at,
          submitted_by: data.submitted_by,
        },
      };
    }

    return { isDuplicate: false };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logger.error('[DuplicateCheck] Unexpected error:', message);
    return { isDuplicate: false, error: message };
  }
}

/**
 * Format the duplicate warning message.
 *
 * @param formType - Form type
 * @param entityId - Entity identifier
 * @param dateFor - Date string
 * @param existingRecord - Existing record details
 * @returns Formatted message
 */
export function formatDuplicateMessage(
  formType: 'dvir' | 'equipment',
  entityId: string,
  dateFor: string,
  existingRecord: { created_at: string; submitted_by?: string }
): string {
  const formLabel = formType === 'dvir' ? 'DVIR' : 'Equipment Inspection';
  const entityLabel = formType === 'dvir' ? 'truck' : 'equipment';
  const date = new Date(dateFor).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const time = new Date(existingRecord.created_at).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return `A ${formLabel} for ${entityLabel} ${entityId} on ${date} was already submitted at ${time}${
    existingRecord.submitted_by ? ` by ${existingRecord.submitted_by}` : ''
  }.`;
}

export default checkForDuplicate;
