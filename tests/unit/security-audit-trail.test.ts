/**
 * Security audit trail — logReportExported()
 * Verifies that export audit logging does not throw and calls safety_audit_log correctly.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { logReportExported } from '@/lib/safetyAuditLog';

const mockInsert = vi.fn();

vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    from: () => ({
      insert: (row: unknown) => {
        mockInsert(row);
        return Promise.resolve({ data: null, error: null });
      },
    }),
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    warn: vi.fn(),
  },
}));

describe('logReportExported', () => {
  beforeEach(() => {
    mockInsert.mockClear();
  });

  it('calls safety_audit_log insert with correct fields', async () => {
    await logReportExported(
      {
        reportType: 'osha_300',
        format: 'csv',
        dateFrom: '2025-01-01',
        dateTo: '2025-01-31',
        totalRecords: 42,
      },
      { userId: 'user-1', role: 'admin' }
    );

    expect(mockInsert).toHaveBeenCalledTimes(1);
    const inserted = mockInsert.mock.calls[0][0] as Record<string, unknown>;
    expect(inserted.event_type).toBe('report_exported');
    expect(inserted.table_name).toBe('report_export');
    expect(inserted.user_id).toBe('user-1');
    expect(inserted.role).toBe('admin');
    expect(inserted.payload_snapshot).toEqual({
      reportType: 'osha_300',
      format: 'csv',
      dateFrom: '2025-01-01',
      dateTo: '2025-01-31',
      totalRecords: 42,
    });
  });

  it('does not throw when insert returns an error', async () => {
    mockInsert.mockImplementationOnce(() =>
      Promise.resolve({ data: null, error: { message: 'RLS denied' } })
    );

    await expect(
      logReportExported({ reportType: 'dvir_history', format: 'csv' })
    ).resolves.not.toThrow();
  });

  it('does not throw when insert throws', async () => {
    mockInsert.mockImplementationOnce(() =>
      Promise.reject(new Error('Network error'))
    );

    await expect(
      logReportExported({ reportType: 'compliance_data', format: 'pdf' })
    ).resolves.not.toThrow();
  });
});
