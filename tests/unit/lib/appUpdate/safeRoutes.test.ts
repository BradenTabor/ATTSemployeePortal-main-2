import { describe, it, expect } from 'vitest';
import { isAutoApplySafeRoute } from '@/lib/appUpdate/safeRoutes';

describe('isAutoApplySafeRoute', () => {
  it.each([
    '/dashboard',
    '/forms',
    '/forms-history',
    '/forms-history/dvir',
    '/announcements',
    '/resources',
    '/resources/doc/safety/ppe',
    '/profile',
    '/settings',
    '/admin',
    '/admin/dashboard',
    '/safety-officer/field-audit/history',
    '/mechanic-dashboard',
    '/dashboard/',
    '/dashboard?tab=1',
  ])('allows auto-apply on %s', (path) => {
    expect(isAutoApplySafeRoute(path)).toBe(true);
  });

  it.each([
    '/',
    '',
    '/forms/jsa',
    '/forms/jsa/tree-felling',
    '/forms/jsa/abc-123',
    '/dashboard/forms/dvir',
    '/dashboard/forms/request-time-off',
    '/dashboard/forms/near-miss',
    '/resources/certification/skid-steer/test',
    '/resources/certification/skid-steer/practical/u1',
    '/safety-officer/field-audit',
    '/general-foreman/attendance',
    '/foreman/daily-reports',
    '/mechanic/parts-repairs',
    '/reset-password',
    '/verify/ABC',
    '/emergency-action-plan',
    '/admin/users',
    '/admin/jsa',
  ])('never auto-reloads on %s', (path) => {
    expect(isAutoApplySafeRoute(path)).toBe(false);
  });

  it('does not treat similarly prefixed safe routes as unsafe', () => {
    expect(isAutoApplySafeRoute('/forms-history/jsa')).toBe(true);
  });
});
