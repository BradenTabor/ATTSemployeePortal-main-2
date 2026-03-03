/**
 * Unit tests: OSHA Form 301 fields in exports.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { exportOSHA300ITA, exportOSHA300AITA } from '@/lib/osha300Export';

vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    rpc: vi.fn(),
  },
}));

const supabase = (await import('@/lib/supabaseClient')).supabase;

describe('OSHA Form 301 fields', () => {
  beforeEach(() => {
    vi.mocked(supabase.rpc).mockReset();
  });

  it('ITA 300/301 export includes Form 301 fields (date_of_birth, sex, date_of_death)', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: [
        {
          case_number: '2025-001',
          incident_date: '2025-01-15',
          employee_name: 'Test',
          employee_job_title: 'Op',
          work_site_name: 'Site A',
          description: 'Cut',
          body_parts_affected: 'finger',
          injury_illness_type: 'injury',
          severity: 'recordable',
          days_away_from_work: 0,
          days_restricted_duty: 0,
          reported_at: null,
          what_doing_before: 'Cutting branch',
          object_substance_harmed: 'Saw',
          incident_time: '10:30',
          employee_hire_date: '2020-05-01',
          time_began_work: '07:00',
          employee_date_of_birth: '1990-01-15',
          employee_sex: 'male',
          date_of_death: null,
        },
      ],
      error: null,
    });

    let capturedBlob: Blob | null = null;
    const createObjectURL = vi.fn((blob: Blob) => {
      capturedBlob = blob;
      return 'blob:test';
    });
    global.URL.createObjectURL = createObjectURL;
    const click = vi.fn();
    const orig = document.createElement.bind(document);
    document.createElement = ((tag: string) => {
      const el = orig(tag);
      if (tag === 'a') el.click = click;
      return el;
    }) as typeof document.createElement;

    await exportOSHA300ITA(undefined, 2025);

    expect(supabase.rpc).toHaveBeenCalledWith('get_incident_log_osha_300_301', expect.any(Object));
    expect(capturedBlob).toBeInstanceOf(Blob);
    const csvText = await new Promise<string>((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result as string);
      r.onerror = rej;
      r.readAsText(capturedBlob as Blob);
    });
    expect(csvText).toContain('date_of_birth');
    expect(csvText).toContain('sex');
    expect(csvText).toContain('date_of_death');
    expect(csvText).toContain('nar_before_incident');
    expect(csvText).toContain('nar_object_substance');
    expect(csvText).toContain('1990-01-15');
    expect(csvText).toContain('male');
  });

  it('exportOSHA300AITA generates 300A ITA CSV with summary fields', async () => {
    let capturedBlob: Blob | null = null;
    global.URL.createObjectURL = vi.fn((blob: Blob) => {
      capturedBlob = blob;
      return 'blob:test';
    });
    const click = vi.fn();
    const orig = document.createElement.bind(document);
    document.createElement = ((tag: string) => {
      const el = orig(tag);
      if (tag === 'a') el.click = click;
      return el;
    }) as typeof document.createElement;

    const summary = {
      year: 2025,
      total_recordable_cases: 3,
      cases_days_away: 1,
      cases_job_transfer: 1,
      other_recordable: 1,
      total_days_away: 5,
      total_days_restricted: 10,
      total_injuries: 2,
      total_illnesses: 1,
      death_count: 0,
      total_employees_avg: 50,
      total_hours_worked: 100000,
    };

    await exportOSHA300AITA(2025, summary);

    expect(capturedBlob).toBeInstanceOf(Blob);
    const csvText = await new Promise<string>((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result as string);
      r.onerror = rej;
      r.readAsText(capturedBlob as Blob);
    });
    expect(csvText).toContain('year_filing_for');
    expect(csvText).toContain('annual_average_employees');
    expect(csvText).toContain('total_hours_worked');
    expect(csvText).toContain('total_deaths');
    expect(csvText).toContain('total_dafw_cases');
    expect(csvText).toContain('2025');
  });
});
