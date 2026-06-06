/** Map Postgres redemption RPC exceptions to user-facing copy (DB remains authoritative). */
export function mapRedemptionError(raw: string): string {
  const msg = raw.trim();
  if (!msg) return 'Unable to complete this action. Please try again.';

  if (msg.includes('Insufficient balance')) {
    return 'You do not have enough points for this reward.';
  }
  if (msg.includes('Out of stock')) {
    return 'This item is out of stock. Check back later.';
  }
  if (msg.includes('Item is not available') || msg.includes('Item not found')) {
    return 'This reward is no longer available.';
  }
  if (msg.includes('Not authenticated')) {
    return 'Please sign in and try again.';
  }
  if (msg.includes('Request id is required')) {
    return 'Request could not be processed. Please close and try again.';
  }
  if (msg.includes('Not permitted to fulfill')) {
    return 'You are not authorized to fulfill redemptions.';
  }
  if (msg.includes('Not permitted to deny')) {
    return 'You are not authorized to deny redemptions.';
  }
  if (msg.includes('Not permitted to cancel')) {
    return 'You cannot cancel this redemption.';
  }
  if (msg.includes('Redemption not found')) {
    return 'This redemption could not be found.';
  }
  if (msg.includes('Invalid transition')) {
    return 'This redemption can no longer be updated.';
  }

  return msg;
}

export function extractRedemptionErrorMessage(
  error: { message?: string; details?: string } | null,
): string {
  const raw = error?.message ?? error?.details ?? '';
  return mapRedemptionError(raw);
}
