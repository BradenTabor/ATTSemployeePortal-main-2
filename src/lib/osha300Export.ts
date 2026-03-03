/**
 * OSHA 300 Log export (Phase 2).
 * Fetches via get_incident_log_osha_300_301 RPC (SECURITY DEFINER) and downloads
 * as CSV for regulatory use. Only recordable, lost_time, and fatality are included.
 */

import { supabase } from './supabaseClient';
import { logger } from './logger';
import { logReportExported } from './safetyAuditLog';

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
  privacy_case?: boolean | null;
  what_doing_before?: string | null;
  object_substance_harmed?: string | null;
  incident_time?: string | null;
  employee_hire_date?: string | null;
  time_began_work?: string | null;
  emergency_room_treatment?: boolean | null;
  hospitalized_overnight?: boolean | null;
  physician_name?: string | null;
  treatment_facility?: string | null;
  employee_street_address?: string | null;
  employee_city?: string | null;
  employee_state?: string | null;
  employee_zip?: string | null;
  employee_date_of_birth?: string | null;
  employee_sex?: string | null;
  date_of_death?: string | null;
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
  const employee_name = row.privacy_case ? 'Privacy Case' : row.employee_name;

  return {
    case_number: row.case_number,
    employee_name,
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
  const fromDate = new Date(dateTo);
  fromDate.setDate(fromDate.getDate() - MAX_RPC_DAYS);
  const dateFrom = fromDate.toISOString().slice(0, 10);
  try {
    await logReportExported({
      reportType: 'osha_300',
      format: 'csv',
      dateFrom,
      dateTo,
      totalRecords: rows.length,
    });
  } catch (e) {
    logger.error('[osha300Export] audit log failed', e);
  }
}

// =============================================================================
// ITA-Compatible CSV Exports (OSHA Injury Tracking Application)
// =============================================================================

/** ITA 300A CSV headers per OSHA template */
const ITA_300A_HEADERS = [
  'establishment_name',
  'ein',
  'company_name',
  'street_address',
  'city',
  'state',
  'zip',
  'naics_code',
  'industry_description',
  'size',
  'establishment_type',
  'year_filing_for',
  'annual_average_employees',
  'total_hours_worked',
  'no_injuries_illnesses',
  'total_deaths',
  'total_dafw_cases',
  'total_djtr_cases',
  'total_other_cases',
  'total_dafw_days',
  'total_djtr_days',
  'total_injuries',
  'total_skin_disorders',
  'total_respiratory_conditions',
  'total_poisonings',
  'total_hearing_loss',
  'total_other_illnesses',
  'change_reason',
];

/** ITA 300/301 case-level CSV headers */
const ITA_300_301_HEADERS = [
  'establishment_name',
  'year_of_filing',
  'case_number',
  'job_title',
  'date_of_incident',
  'incident_location',
  'incident_description',
  'incident_outcome',
  'dafw_num_away',
  'djtr_num_tr',
  'type_of_incident',
  'date_of_birth',
  'date_of_hire',
  'sex',
  'treatment_facility_type',
  'treatment_in_patient',
  'time_started_work',
  'time_of_incident',
  'time_unknown',
  'nar_before_incident',
  'nar_what_happened',
  'nar_injury_illness',
  'nar_object_substance',
  'date_of_death',
];

interface OSHA300ASummaryForITA {
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

/**
 * Generate and download ITA-compatible 300A summary CSV.
 */
export async function exportOSHA300AITA(
  year: number,
  summary: OSHA300ASummaryForITA,
  establishment?: {
    name?: string;
    ein?: string;
    companyName?: string;
    streetAddress?: string;
    city?: string;
    state?: string;
    zip?: string;
    naicsCode?: string;
    industryDescription?: string;
    size?: string;
  }
): Promise<void> {
  const skin = 0;
  const respiratory = 0;
  const poisoning = 0;
  const hearingLoss = 0;
  const otherIllnesses = Math.max(0, summary.total_illnesses - skin - respiratory - poisoning - hearingLoss);
  const row = [
    escapeCsvField(establishment?.name ?? ''),
    escapeCsvField(establishment?.ein ?? ''),
    escapeCsvField(establishment?.companyName ?? ''),
    escapeCsvField(establishment?.streetAddress ?? ''),
    escapeCsvField(establishment?.city ?? ''),
    escapeCsvField(establishment?.state ?? ''),
    escapeCsvField(establishment?.zip ?? ''),
    escapeCsvField(establishment?.naicsCode ?? ''),
    escapeCsvField(establishment?.industryDescription ?? ''),
    escapeCsvField(establishment?.size ?? ''),
    '',
    escapeCsvField(year),
    escapeCsvField(summary.total_employees_avg ?? ''),
    escapeCsvField(summary.total_hours_worked ?? ''),
    escapeCsvField(summary.total_recordable_cases === 0 ? '1' : '0'),
    escapeCsvField(summary.death_count),
    escapeCsvField(summary.cases_days_away),
    escapeCsvField(summary.cases_job_transfer),
    escapeCsvField(summary.other_recordable),
    escapeCsvField(summary.total_days_away),
    escapeCsvField(summary.total_days_restricted),
    escapeCsvField(summary.total_injuries),
    escapeCsvField(skin),
    escapeCsvField(respiratory),
    escapeCsvField(poisoning),
    escapeCsvField(hearingLoss),
    escapeCsvField(otherIllnesses),
    '',
  ];
  const csv = [ITA_300A_HEADERS.join(','), row.join(',')].join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `OSHA-300A-ITA-${year}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function incidentOutcomeFromSeverity(severity: string | null): string {
  if (!severity) return '';
  switch (severity) {
    case 'fatality': return 'Death';
    case 'lost_time': return 'Days away from work';
    case 'recordable': return 'Job transfer or restriction';
    default: return 'Other recordable';
  }
}

/**
 * Fetch raw RPC rows (with Form 301 fields) for ITA export.
 */
async function fetchIncidentLogRaw(
  dateFrom: string,
  dateTo: string
): Promise<IncidentLogRow[]> {
  const { data, error } = await supabase.rpc('get_incident_log_osha_300_301', {
    p_date_from: dateFrom,
    p_date_to: dateTo,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as IncidentLogRow[];
}

/**
 * Export OSHA 300/301 case data in ITA-compatible CSV format.
 */
export async function exportOSHA300ITA(
  establishmentName?: string,
  year?: number
): Promise<void> {
  const now = new Date();
  const y = year ?? now.getFullYear();
  const dateFrom = `${y}-01-01`;
  const dateTo = `${y}-12-31`;
  const rows = await fetchIncidentLogRaw(dateFrom, dateTo);
  const filtered = rows.filter((r) => r.severity && OSHA_300_SEVERITIES.includes(r.severity));

  const lines = filtered.map((r) => {
    const desc = r.description ?? '';
    const bodyParts = r.body_parts_affected?.trim();
    const incidentDesc = bodyParts ? `${desc} | Body parts: ${bodyParts}`.trim() : desc;
    return [
      escapeCsvField(establishmentName ?? ''),
      escapeCsvField(y),
      escapeCsvField(r.case_number),
      escapeCsvField(r.employee_job_title),
      escapeCsvField(r.incident_date),
      escapeCsvField(r.work_site_name),
      escapeCsvField(incidentDesc),
      escapeCsvField(incidentOutcomeFromSeverity(r.severity)),
      escapeCsvField(r.days_away_from_work ?? ''),
      escapeCsvField(r.days_restricted_duty ?? ''),
      escapeCsvField(r.injury_illness_type ?? ''),
      escapeCsvField(r.employee_date_of_birth ?? ''),
      escapeCsvField(r.employee_hire_date ?? ''),
      escapeCsvField(r.employee_sex ?? ''),
      escapeCsvField(r.treatment_facility ?? ''),
      escapeCsvField(r.hospitalized_overnight ? '1' : '0'),
      escapeCsvField(r.time_began_work ?? ''),
      escapeCsvField(r.incident_time ?? ''),
      escapeCsvField(''),
      escapeCsvField(r.what_doing_before ?? ''),
      escapeCsvField(r.description ?? ''),
      escapeCsvField(r.injury_illness_type ?? ''),
      escapeCsvField(r.object_substance_harmed ?? ''),
      escapeCsvField(r.date_of_death ?? ''),
    ].join(',');
  });

  const csv = [ITA_300_301_HEADERS.join(','), ...lines].join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `OSHA-300-301-ITA-${y}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Alias: Form 301 data is in the same ITA format as Form 300. */
export const exportOSHA301ITA = exportOSHA300ITA;
