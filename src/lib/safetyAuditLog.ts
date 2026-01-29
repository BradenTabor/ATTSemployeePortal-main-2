/**
 * Safety Audit Log — app-side writes for report exports.
 * RLS allows INSERT when event_type = 'report_exported' and user is admin/supervisor.
 */

import { supabase } from './supabaseClient';
import { logger } from './logger';

export interface ReportExportPayload {
  reportType: string;
  dateFrom?: string | null;
  dateTo?: string | null;
  format?: string;
  totalRecords?: number;
}

/**
 * Log a report export to safety_audit_log for regulator/insurer audit trail.
 * Call after successful CSV/PDF/Excel export. Fails silently if not admin/supervisor.
 */
export async function logReportExported(
  payload: ReportExportPayload,
  options?: { userId?: string; role?: string }
): Promise<void> {
  try {
    const { error } = await supabase.from('safety_audit_log').insert({
      event_type: 'report_exported',
      table_name: 'report_export',
      record_id: null,
      user_id: options?.userId ?? undefined,
      role: options?.role ?? undefined,
      occurred_at: new Date().toISOString(),
      payload_snapshot: payload as unknown as Record<string, unknown>,
    });
    if (error) {
      logger.warn('[safetyAuditLog] report_exported insert failed', { error: error.message });
    }
  } catch (e) {
    logger.warn('[safetyAuditLog] logReportExported error', e);
  }
}
