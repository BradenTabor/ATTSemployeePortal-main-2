/**
 * OSHA 300A Annual Summary types.
 */

export interface OSHA300ASummary {
  year: number;
  total_recordable_cases: number;
  cases_days_away: number;
  cases_job_transfer: number;
  other_recordable: number;
  total_days_away: number;
  total_days_restricted: number;
  total_injuries: number;
  total_illnesses: number;
  death_count: number;
  total_employees_avg: number | null;
  total_hours_worked: number | null;
}

export interface OSHA300ACertification {
  id: string;
  year: number;
  certified_by_name: string;
  certified_by_title: string;
  certified_at: string;
  signature: string;
  total_employees_avg: number | null;
  total_hours_worked: number | null;
  summary_data: OSHA300ASummary;
  posted_date: string | null;
}
