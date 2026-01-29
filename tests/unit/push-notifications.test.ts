/**
 * Push Notifications Unit Tests
 *
 * Tests for NotificationBuilders used by Edge Functions and docs.
 */

import { describe, it, expect } from 'vitest';
import { NotificationBuilders } from '@/lib/pushNotifications';

describe('NotificationBuilders.newSignup', () => {
  it('targets admin role with admin_notice category', () => {
    const req = NotificationBuilders.newSignup({ email: 'jane@example.com', full_name: 'Jane Doe' });
    expect(req.target_type).toBe('role');
    expect(req.target_ref).toBe('admin');
    expect(req.category).toBe('admin_notice');
    expect(req.url).toBe('/admin/users');
  });

  it('uses full_name when provided', () => {
    const req = NotificationBuilders.newSignup({ email: 'j@x.com', full_name: 'Jane Doe' });
    expect(req.body).toBe('Jane Doe just created an account.');
  });

  it('falls back to email when full_name is empty', () => {
    const req = NotificationBuilders.newSignup({ email: 'j@x.com', full_name: '' });
    expect(req.body).toBe('j@x.com just created an account.');
  });

  it('falls back to "A new user" when both missing', () => {
    const req = NotificationBuilders.newSignup({});
    expect(req.body).toBe('A new user just created an account.');
  });
});
