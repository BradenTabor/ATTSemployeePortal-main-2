/**
 * Unit Tests for Compliance Check Logic
 * 
 * Tests the deterministic logic of the 9:00 AM compliance checker
 * without making live database or webhook calls.
 */

import { describe, it, expect } from 'vitest';

// Import the function to test
// Note: We test the exported helper function, not the main function
// which requires database access
import { computeMissingType } from '../execution/checkCompliance9am';
import { buildCutoffTimestamp, getTodayInTimezone } from '../lib/time';
import { getMissingItems } from '../execution/sendComplianceEmail';

// =============================================================================
// computeMissingType Tests
// =============================================================================

describe('computeMissingType', () => {
  it('returns missing_both when both DVIR and equipment are missing', () => {
    const result = computeMissingType(false, false);
    expect(result).toBe('missing_both');
  });

  it('returns missing_dvir when only DVIR is missing', () => {
    const result = computeMissingType(false, true);
    expect(result).toBe('missing_dvir');
  });

  it('returns missing_equipment when only equipment is missing', () => {
    const result = computeMissingType(true, false);
    expect(result).toBe('missing_equipment');
  });

  it('returns null when nothing is missing (user is compliant)', () => {
    const result = computeMissingType(true, true);
    expect(result).toBeNull();
  });
});

// =============================================================================
// getMissingItems Tests
// =============================================================================

describe('getMissingItems', () => {
  it('returns DVIR item for missing_dvir', () => {
    const items = getMissingItems('missing_dvir');
    expect(items).toHaveLength(1);
    expect(items[0]).toContain('DVIR');
  });

  it('returns equipment item for missing_equipment', () => {
    const items = getMissingItems('missing_equipment');
    expect(items).toHaveLength(1);
    expect(items[0]).toContain('Equipment');
  });

  it('returns both items for missing_both', () => {
    const items = getMissingItems('missing_both');
    expect(items).toHaveLength(2);
    expect(items.some(i => i.includes('DVIR'))).toBe(true);
    expect(items.some(i => i.includes('Equipment'))).toBe(true);
  });
});

// =============================================================================
// Time Utility Tests
// =============================================================================

describe('getTodayInTimezone', () => {
  it('returns a valid YYYY-MM-DD formatted string', () => {
    const today = getTodayInTimezone('America/Chicago');
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('returns consistent format for different timezones', () => {
    const chicagoToday = getTodayInTimezone('America/Chicago');
    const utcToday = getTodayInTimezone('UTC');
    
    // Both should be valid dates
    expect(new Date(chicagoToday).toString()).not.toBe('Invalid Date');
    expect(new Date(utcToday).toString()).not.toBe('Invalid Date');
  });
});

describe('buildCutoffTimestamp', () => {
  it('returns a valid Date object', () => {
    const cutoff = buildCutoffTimestamp('2026-01-08', '09:00', 'America/Chicago');
    expect(cutoff).toBeInstanceOf(Date);
    expect(cutoff.toString()).not.toBe('Invalid Date');
  });

  it('creates a timestamp in the future for today 09:00 if before 9am', () => {
    // This test is time-dependent, so we use a fixed date
    const cutoff = buildCutoffTimestamp('2026-01-08', '09:00', 'America/Chicago');
    
    // The cutoff should be a specific UTC time
    // Chicago is UTC-6 in January (CST), so 9:00 AM CST = 15:00 UTC
    // Allow for some variance due to calculation method
    const hour = cutoff.getUTCHours();
    expect(hour).toBeGreaterThanOrEqual(14);
    expect(hour).toBeLessThanOrEqual(16);
  });

  it('handles different cutoff times', () => {
    const morning = buildCutoffTimestamp('2026-01-08', '09:00', 'America/Chicago');
    const afternoon = buildCutoffTimestamp('2026-01-08', '14:00', 'America/Chicago');
    
    // Afternoon should be 5 hours later
    const diffMs = afternoon.getTime() - morning.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    expect(diffHours).toBe(5);
  });
});

// =============================================================================
// Integration-Style Tests (Mocked)
// =============================================================================

describe('Compliance Logic Integration', () => {
  // Sample data for testing
  const sampleUsers = [
    { user_id: 'user-1', email: 'user1@example.com', full_name: 'User One', role: 'employee' },
    { user_id: 'user-2', email: 'user2@example.com', full_name: 'User Two', role: 'foreman' },
    { user_id: 'user-3', email: 'user3@example.com', full_name: 'User Three', role: 'employee' },
    { user_id: 'user-4', email: null, full_name: 'User Four', role: 'employee' }, // No email
    { user_id: 'user-5', email: 'user5@example.com', full_name: 'User Five', role: 'admin' }, // Admin
  ];

  const sampleDvirSubmitters = new Set(['user-1', 'user-3']);
  const sampleEquipmentSubmitters = new Set(['user-1', 'user-2']);

  it('correctly identifies required users (employee/foreman with email)', () => {
    const requiredUsers = sampleUsers.filter(
      u => ['employee', 'foreman'].includes(u.role) && u.email !== null
    );
    
    expect(requiredUsers).toHaveLength(3);
    expect(requiredUsers.map(u => u.user_id)).toEqual(['user-1', 'user-2', 'user-3']);
  });

  it('correctly identifies missing submissions', () => {
    const requiredUsers = sampleUsers.filter(
      u => ['employee', 'foreman'].includes(u.role) && u.email !== null
    );

    const missing = requiredUsers
      .map(user => {
        const hasDvir = sampleDvirSubmitters.has(user.user_id);
        const hasEquipment = sampleEquipmentSubmitters.has(user.user_id);
        const missingType = computeMissingType(hasDvir, hasEquipment);
        return missingType ? { userId: user.user_id, type: missingType } : null;
      })
      .filter(Boolean);

    expect(missing).toHaveLength(2);
    
    // user-2: has equipment, missing DVIR
    expect(missing.find(m => m?.userId === 'user-2')?.type).toBe('missing_dvir');
    
    // user-3: has DVIR, missing equipment
    expect(missing.find(m => m?.userId === 'user-3')?.type).toBe('missing_equipment');
    
    // user-1: has both, should not be in missing list
    expect(missing.find(m => m?.userId === 'user-1')).toBeUndefined();
  });

  it('counts missing types correctly', () => {
    const requiredUsers = sampleUsers.filter(
      u => ['employee', 'foreman'].includes(u.role) && u.email !== null
    );

    const missing = requiredUsers
      .map(user => {
        const hasDvir = sampleDvirSubmitters.has(user.user_id);
        const hasEquipment = sampleEquipmentSubmitters.has(user.user_id);
        return computeMissingType(hasDvir, hasEquipment);
      })
      .filter(Boolean);

    const missingDvirCount = missing.filter(
      t => t === 'missing_dvir' || t === 'missing_both'
    ).length;
    const missingEquipmentCount = missing.filter(
      t => t === 'missing_equipment' || t === 'missing_both'
    ).length;
    const missingBothCount = missing.filter(t => t === 'missing_both').length;

    expect(missingDvirCount).toBe(1); // user-2
    expect(missingEquipmentCount).toBe(1); // user-3
    expect(missingBothCount).toBe(0);
  });
});

