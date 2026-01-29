/**
 * OSHA 300 Log export (Phase 2).
 * Fetches via get_incident_log_osha_300_301 RPC (SECURITY DEFINER) and downloads
 * as CSV for regulatory use. Only recordable, lost_time, and fatality are included.
 */

import { supabase } from './supabaseClient';
import { logger } from './logger';

export interface Osha300Row {
  case_number: string | null;
  employee_name: string | null;
  job_title: string | null;
  date_of_injury: string | null;
  where_event_occurred: string | null;
  description_with_body_parts: string | null;
  classification: string | null;
  days_away: number | null;
  days_restricted: number | null;
  injury_illness_type: string | null;
  reported_at: string | null;
}

/** Row shape returned by get_incident_log_osha_300_301 RPC */
interface IncidentLogRow {
  case_number: string | null;
  incident_date: string | null;
  employee_name: string | null;
  employee_job_title: string | null;
  work_site_name: string | null;
  description: string | null;
  body_parts_affected: string | null;
  injury_illness_type: string | null;
  severity: string | null;
  days_away_from_work: number | null;
  days_restricted_duty: number | null;
  reported_at: string | null;
}

const OSHA_300_CSV_HEADERS = [
  'Case Number',
  'Employee Name',
  'Job Title',
  'Date of Injury or Illness',
  'Where the event occurred',
  'Describe injury or illness, parts of body affected',
  'Classification (e.g. Death, Days away, Job transfer)',
  'Days Away',
  'Days of Restricted Work or Job Transfer',
  'Injury or illness type',
  'Reported at',
];

const OSHA_300_SEVERITIES = ['recordable', 'lost_time', 'fatality'];

function escapeCsvField(value: string | number | null | undefined): string {
  if (value == null) return '';
  const s = String(value);
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function rowToCsvLine(row: Osha300Row): string {
  return [
    escapeCsvField(row.case_number),
    escapeCsvField(row.employee_name),
    escapeCsvField(row.job_title),
    escapeCsvField(row.date_of_injury),
    escapeCsvField(row.where_event_occurred),
    escapeCsvField(row.description_with_body_parts),
    escapeCsvField(row.classification),
    escapeCsvField(row.days_away),
    escapeCsvField(row.days_restricted),
    escapeCsvField(row.injury_illness_type),
    escapeCsvField(row.reported_at),
  ].join(',');
}

function classificationFromSeverity(
  severity: string | null,
  daysRestricted: number | null
): string {
  if (!severity) return 'N/A';
  switch (severity) {
    case 'fatality':
      return 'Death';
    case 'lost_time':
      return 'Days Away From Work';
    case 'recordable':
      return (daysRestricted ?? 0) > 0 ? 'Job Transfer or Restriction' : 'Other Recordable Cases';
    default:
      return 'N/A';
  }
}

function incidentRowToOsha300(row: IncidentLogRow): Osha300Row {
  const desc = row.description ?? '';
  const bodyParts = row.body_parts_affected?.trim();
  const description_with_body_parts = bodyParts
    ? `${desc} | Body parts: ${bodyParts}`.trim()
    : desc || null;

  return {
    case_number: row.case_number,
    employee_name: row.employee_name,
    job_title: row.employee_job_title,
    date_of_injury: row.incident_date,
    where_event_occurred: row.work_site_name,
    description_with_body_parts: description_with_body_parts || null,
    classification: classificationFromSeverity(row.severity, row.days_restricted_duty),
    days_away: row.days_away_from_work ?? null,
    days_restricted: row.days_restricted_duty ?? null,
    injury_illness_type: row.injury_illness_type,
    reported_at: row.reported_at,
  };
}

/**
 * Try RPC get_incident_log_osha_300_301; on failure try view osha_300_log.
 * Returns rows in Osha300Row shape and the date string for filename.
 */
const MAX_RPC_DAYS = 366;

/**
 * Fetch OSHA 300 log rows for preview or export (last 366 days, recordable/lost_time/fatality only).
 */
export async function fetchOsha300Rows(): Promise<{ rows: Osha300Row[]; dateTo: string }> {
  const now = new Date();
  const dateTo = now.toISOString().slice(0, 10);
  const fromDate = new Date(now);
  fromDate.setDate(fromDate.getDate() - MAX_RPC_DAYS);
  const dateFrom = fromDate.toISOString().slice(0, 10);

  const { data: rpcData, error: rpcError } = await supabase.rpc('get_incident_log_osha_300_301', {
    p_date_from: dateFrom,
    p_date_to: dateTo,
  });

  if (!rpcError && rpcData != null) {
    const raw = rpcData as IncidentLogRow[];
    const rows = raw
      .filter((r) => r.severity && OSHA_300_SEVERITIES.includes(r.severity))
      .map(incidentRowToOsha300);
    return { rows, dateTo };
  }

  logger.warn('[osha300Export] RPC failed, trying osha_300_log view', rpcError);

  const { data: viewData, error: viewError } = await supabase
    .from('osha_300_log')
    .select('*')
    .order('date_of_injury', { ascending: false });

  if (!viewError && viewData != null) {
    const rows = viewData as Osha300Row[];
    return { rows, dateTo };
  }

  logger.error('[osha300Export] Both RPC and view failed', { rpcError, viewError });
  const err = rpcError ?? viewError;
  const message = err?.message ?? 'Unknown error';
  const hint = err?.code === '42883' ? ' Run Supabase migrations to add the export function.' : '';
  throw new Error(`${message}${hint ? ` ${hint}` : ''}`);
}

/**
 * Download OSHA 300 log as CSV from pre-fetched rows (use after preview to avoid double fetch).
 */
export function downloadOsha300CsvFromRows(rows: Osha300Row[], dateTo: string): void {
  const headerLine = OSHA_300_CSV_HEADERS.join(',');
  const bodyLines = rows.map(rowToCsvLine);
  const csv = [headerLine, ...bodyLines].join('\r\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `OSHA-300-Log-${dateTo}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Fetch OSHA 300 log data and download as CSV.
 * Tries get_incident_log_osha_300_301 RPC first, then osha_300_log view.
 */
export async function exportOsha300Csv(): Promise<void> {
  const { rows, dateTo } = await fetchOsha300Rows();
  downloadOsha300CsvFromRows(rows, dateTo);
}
