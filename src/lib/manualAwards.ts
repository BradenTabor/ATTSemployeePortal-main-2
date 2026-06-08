import { supabase } from './supabaseClient';
import { logger } from './logger';
import {
  MANUAL_AWARD_DEDUCTION_PRESETS,
  MANUAL_AWARD_POSITIVE_PRESETS,
  type AwarderBudgetHint,
} from '../types/manualAwards';

export function getAvailableAwardPresets(
  isAdmin: boolean,
  budgetHint?: AwarderBudgetHint
): { positive: number[]; negative: number[] } {
  const positive = MANUAL_AWARD_POSITIVE_PRESETS.filter((preset) => {
    if (isAdmin) return true;
    if (!budgetHint) return false;
    return preset <= budgetHint.perAwardCap && preset <= budgetHint.remaining;
  });

  const negative = isAdmin ? [...MANUAL_AWARD_DEDUCTION_PRESETS] : [];

  return { positive, negative };
}

/** Map Postgres award_points exceptions to user-facing copy (DB remains authoritative). */
export function mapAwardPointsError(raw: string): string {
  const msg = raw.trim();
  if (!msg) return 'Unable to award points. Please try again.';

  if (msg.includes('Not permitted to award points')) {
    return 'You are not authorized to award points.';
  }
  if (msg.includes('Recipient not found')) {
    return 'That recipient could not be found.';
  }
  if (msg.includes('Cannot award points to yourself')) {
    return 'You cannot award points to yourself.';
  }
  if (msg.includes('Amount must be positive')) {
    return 'Amount must be a positive number.';
  }
  if (msg.includes('Amount must be non-zero')) {
    return 'Select a non-zero point amount.';
  }
  if (msg.includes('Only admins may deduct points')) {
    return 'Only admins can deduct points.';
  }
  if (msg.includes('Reason is required')) {
    return 'A reason is required.';
  }
  if (msg.includes('Invalid category')) {
    return 'Please select a valid category.';
  }
  if (msg.includes('Request id is required')) {
    return 'Request could not be processed. Please close and reopen the form.';
  }
  if (msg.includes('Exceeds per-award cap of')) {
    return msg.replace('Exceeds per-award cap of', 'This exceeds your per-award cap of');
  }
  if (msg.includes('Exceeds monthly budget of')) {
    return msg.replace('Exceeds monthly budget of', 'This exceeds your monthly budget of');
  }

  return msg;
}

export function extractRpcErrorMessage(error: { message?: string; details?: string } | null): string {
  if (!error) return 'Unable to award points. Please try again.';
  const combined = [error.message, error.details].filter(Boolean).join(' ');
  return mapAwardPointsError(combined);
}

/** Chicago month start ISO for indicative budget queries (hint only — DB enforces). */
export function getChicagoMonthStartIso(): string {
  const chicago = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' }));
  chicago.setDate(1);
  chicago.setHours(0, 0, 0, 0);
  return chicago.toISOString();
}

/**
 * Notify recipient after a successful award. Failure is logged only — award is not rolled back.
 * Content is server-built from the ledger row via notify_manual_award_recipient(request_id).
 */
export async function sendManualAwardNotification(requestId: string): Promise<void> {
  try {
    const { error } = await supabase.rpc('notify_manual_award_recipient', {
      p_request_id: requestId,
    });

    if (error) {
      logger.error('[manualAwards] Notification RPC failed after successful award:', error);
    }
  } catch (err) {
    logger.error('[manualAwards] Notification exception after successful award:', err);
  }
}
