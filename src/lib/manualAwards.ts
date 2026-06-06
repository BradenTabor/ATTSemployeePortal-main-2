import { supabase } from './supabaseClient';
import { logger } from './logger';
import {
  MANUAL_AWARD_CATEGORY_LABELS,
  type ManualAwardCategory,
} from '../types/manualAwards';
import type { CreateNotificationRequest } from '../types/notifications';

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
 * Note: admin-create-notification requires admin role; granted non-admins will get 403 (expected).
 */
export async function sendManualAwardNotification(params: {
  recipientId: string;
  amount: number;
  category: ManualAwardCategory;
  reason: string;
  awarderName?: string | null;
}): Promise<void> {
  const { recipientId, amount, category, reason, awarderName } = params;
  const categoryLabel = MANUAL_AWARD_CATEGORY_LABELS[category];

  const payload: CreateNotificationRequest = {
    category: 'admin_notice',
    severity: 'medium',
    target_type: 'user',
    target_ref: recipientId,
    title: `You received ${amount} safety reward point${amount === 1 ? '' : 's'}!`,
    body: [
      awarderName ? `${awarderName} awarded you ${amount} points.` : `You were awarded ${amount} points.`,
      `Category: ${categoryLabel}.`,
      reason ? `Reason: ${reason}` : undefined,
    ]
      .filter(Boolean)
      .join(' '),
    url: '/safety-rewards',
    entity_type: 'manual_award',
  };

  try {
    const { data, error } = await supabase.functions.invoke('admin-create-notification', {
      body: payload,
    });

    if (error) {
      logger.error('[manualAwards] Notification invoke failed after successful award:', error);
      return;
    }

    if (data && typeof data === 'object' && 'success' in data && data.success === false) {
      logger.error('[manualAwards] Notification rejected after successful award:', data);
    }
  } catch (err) {
    logger.error('[manualAwards] Notification exception after successful award:', err);
  }
}
