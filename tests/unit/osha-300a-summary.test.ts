/**
 * Unit tests: OSHA 300A summary and privacy case masking.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchOsha300Rows, downloadOsha300CsvFromRows } from '@/lib/osha300Export';

vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    rpc: vi.fn(),
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        order: vi.fn(() => Promise.resolve({ data: [], error: null })),
      })),
    })),
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@/lib/safetyAuditLog', () => ({
  logReportExported: vi.fn(() => Promise.resolve()),
}));

const supabase = (await import('@/lib/supabaseClient')).supabase;

describe('OSHA 300A / 300 export', () => {
  beforeEach(() => {
    vi.mocked(supabase.rpc).mockReset();
  });

  describe('fetchOsha300Rows - privacy case masking', () => {
    it('masks employee name with "Privacy Case" when privacy_case is true', async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: [
          {
            case_number: '2025-001',
            incident_date: '2025-01-15',
            employee_name: 'John Doe',
            employee_job_title: 'Operator',
            work_site_name: 'Site A',
            description: 'Cut',
            body_parts_affected: 'finger',
            injury_illness_type: 'injury',
            severity: 'recordable',
            days_away_from_work: 0,
            days_restricted_duty: 0,
            reported_at: '2025-01-15T10:00:00Z',
            privacy_case: true,
          },
        ],
        error: null,
      });

      const { rows } = await fetchOsha300Rows();
      expect(rows).toHaveLength(1);
      expect(rows[0].employee_name).toBe('Privacy Case');
      expect(rows[0].case_number).toBe('2025-001');
    });

    it('keeps employee name when privacy_case is false', async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: [
          {
            case_number: '2025-002',
            incident_date: '2025-01-16',
            employee_name: 'Jane Smith',
            employee_job_title: 'Tech',
            work_site_name: 'Site B',
            description: 'Strain',
            body_parts_affected: 'back',
            injury_illness_type: 'injury',
            severity: 'recordable',
            days_away_from_work: 2,
            days_restricted_duty: 0,
            reported_at: '2025-01-16T10:00:00Z',
            privacy_case: false,
          },
        ],
        error: null,
      });

      const { rows } = await fetchOsha300Rows();
      expect(rows).toHaveLength(1);
      expect(rows[0].employee_name).toBe('Jane Smith');
    });

    it('filters to recordable, lost_time, fatality only', async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: [
          { severity: 'recordable', case_number: '1', incident_date: '2025-01-01', employee_name: 'A', employee_job_title: null, work_site_name: null, description: '', body_parts_affected: null, injury_illness_type: null, days_away_from_work: null, days_restricted_duty: null, reported_at: null },
          { severity: 'near_miss', case_number: '2', incident_date: '2025-01-02', employee_name: 'B', employee_job_title: null, work_site_name: null, description: '', body_parts_affected: null, injury_illness_type: null, days_away_from_work: null, days_restricted_duty: null, reported_at: null },
        ],
        error: null,
      });

      const { rows } = await fetchOsha300Rows();
      expect(rows).toHaveLength(1);
      expect(rows[0].case_number).toBe('1');
    });
  });

  describe('downloadOsha300CsvFromRows', () => {
    it('generates valid CSV with header and rows', async () => {
      let capturedBlob: Blob | null = null;
      const createObjectURL = vi.fn((blob: Blob) => {
        capturedBlob = blob;
        return 'blob:test';
      });
      const revokeObjectURL = vi.fn();
      const originalCreate = global.URL.createObjectURL;
      const originalRevoke = global.URL.revokeObjectURL;
      global.URL.createObjectURL = createObjectURL;
      global.URL.revokeObjectURL = revokeObjectURL;

      const click = vi.fn();
      const originalCreateElement = document.createElement.bind(document);
      document.createElement = ((tag: string) => {
        const el = originalCreateElement(tag);
        if (tag === 'a') el.click = click;
        return el;
      }) as typeof document.createElement;

      const rows = [
        {
          case_number: '2025-001',
          employee_name: 'Privacy Case',
          job_title: 'Op',
          date_of_injury: '2025-01-15',
          where_event_occurred: 'Site A',
          description_with_body_parts: 'Cut | Body parts: finger',
          classification: 'Other Recordable Cases',
          days_away: 0,
          days_restricted: 0,
          injury_illness_type: 'injury',
          reported_at: '2025-01-15T10:00:00Z',
        },
      ];
      downloadOsha300CsvFromRows(rows, '2025-01-20');

      expect(createObjectURL).toHaveBeenCalled();
      expect(capturedBlob).toBeInstanceOf(Blob);
      const text = await new Promise<string>((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result as string);
        r.onerror = rej;
        r.readAsText(capturedBlob as Blob);
      });
      expect(text).toContain('Case Number');
      expect(text).toContain('2025-001');
      expect(text).toContain('Privacy Case');
      expect(click).toHaveBeenCalled();

      global.URL.createObjectURL = originalCreate;
      global.URL.revokeObjectURL = originalRevoke;
      document.createElement = originalCreateElement;
    });
  });
});
