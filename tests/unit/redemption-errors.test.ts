import { describe, it, expect } from 'vitest';
import { mapRedemptionError } from '@/lib/redemptionErrors';

describe('mapRedemptionError', () => {
  it('maps insufficient balance to friendly copy', () => {
    expect(mapRedemptionError('Insufficient balance')).toBe(
      'You do not have enough points for this reward.',
    );
  });

  it('maps out of stock to friendly copy', () => {
    expect(mapRedemptionError('Out of stock')).toBe(
      'This item is out of stock. Check back later.',
    );
  });

  it('maps invalid transition errors', () => {
    expect(mapRedemptionError('Invalid transition: cannot fulfill denied redemption')).toBe(
      'This redemption can no longer be updated.',
    );
  });
});
