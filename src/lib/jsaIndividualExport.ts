/**
 * Individual & batch JSA PDF/CSV/Excel export engine.
 *
 * - generateIndividualJsaPdf() — branded single-JSA PDF with togglable sections
 * - generateBatchJsaPdf()      — multi-JSA PDF with page breaks + optional TOC
 * - exportJsaCsv / exportJsaExcel — tabular via DataExporter
 * - buildJsaFilename()         — structured file naming
 *
 * All section renderers are null-safe: empty data renders a single italic
 * "No data recorded" row instead of an empty table or crash.
 */

import { format } from 'date-fns';
import {
  DataExporter,
  formatDateForExport,
  formatCheckedLabels,
  type ExportMetadata,
} from './exportUtils';
import { PPE_ITEMS } from '../pages/forms/dailyJSAFormState';
import {
  JSA_EXPORT_COLUMNS,
  WEATHER_CONDITIONS,
  WEATHER_MODIFIERS,
  HAZARD_ITEMS,
  TRAFFIC_HAZARDS,
  TRAFFIC_SETUP,
} from '../pages/admin/admin-jsa/constants';
import type { AdminJsaRow } from '../pages/admin/admin-jsa/types';
import { logger } from './logger';

type JsPDFModule = typeof import('jspdf');
type AutoTableModule = typeof import('jspdf-autotable');

// ─── Section keys ──────────────────────────────────────────────────────────

export const JSA_SECTIONS = [
  { key: 'jobInfo', label: 'Job Information' },
  { key: 'emergency', label: 'Emergency Contacts' },
  { key: 'ppe', label: 'PPE Summary' },
  { key: 'weather', label: 'Weather & Conditions' },
  { key: 'hazards', label: 'Site Hazards & Traffic' },
  { key: 'spans', label: 'Span Walk-through' },
  { key: 'observers', label: 'Observer Signatures' },
  { key: 'shared', label: 'Shared With' },
  { key: 'notes', label: 'Notes' },
  { key: 'signature', label: 'Signature Block' },
] as const;

export type JsaSectionKey = (typeof JSA_SECTIONS)[number]['key'];

export interface JsaExportOptions {
  sections: Set<JsaSectionKey>;
}

const BATCH_CAP = 50;
const MARGIN_PT = 54; // 0.75 in
const MARGIN_MM = MARGIN_PT * 0.3528; // ≈ 19 mm
const COMPANY_NAME = 'All Terrain Tree Service';
const REPORT_TITLE = 'Job Safety Analysis Report';
const TOTAL_PAGES_PLACEHOLDER = '{total_pages_jsa}';

// ─── File naming ───────────────────────────────────────────────────────────

function sanitizeForFilename(s: string, maxLen = 30): string {
  return s
    .trim()
    .slice(0, maxLen)
    .replace(/[^a-zA-Z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function extractLastName(record: AdminJsaRow): string {
  const name = record.user_name || (record.employee_signature as string) || 'Unknown';
  const parts = name.trim().split(/\s+/);
  return sanitizeForFilename(parts[parts.length - 1] || 'Unknown', 20);
}

export function buildJsaFilename(
  ext: 'pdf' | 'csv' | 'xlsx',
  record?: AdminJsaRow,
  batchCount?: number,
): string {
  return buildFilename(ext, record, batchCount);
}

// Avoid name collision with date-fns `format`
function buildFilename(
  ext: 'pdf' | 'csv' | 'xlsx',
  record?: AdminJsaRow,
  batchCount?: number,
): string {
  const today = format(new Date(), 'yyyy-MM-dd');

  if (batchCount && batchCount > 1) {
    return `JSA-Batch-${batchCount}-records-${today}.${ext}`;
  }

  if (!record) {
    return `JSA-Export-${today}.${ext}`;
  }

  const location = sanitizeForFilename(record.work_location || 'Unknown');
  const jobDate = record.job_date
    ? format(new Date(record.job_date), 'yyyy-MM-dd')
    : today;
  const lastName = extractLastName(record);

  return `JSA-${location}-${jobDate}-${lastName}.${ext}`;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

const s = (v: unknown, fallback = '—'): string => {
  if (v === null || v === undefined || v === '') return fallback;
  return String(v);
};

type JsPDF = import('jspdf').jsPDF;
type AutoTableFn = (doc: JsPDF, opts: Record<string, unknown>) => void;

interface PdfContext {
  doc: JsPDF;
  autoTable: AutoTableFn;
  pageWidth: number;
  pageHeight: number;
  y: number;
}

function sectionHeader(ctx: PdfContext, title: string): void {
  if (ctx.y > ctx.pageHeight - 40) {
    ctx.doc.addPage();
    ctx.y = MARGIN_MM + 5;
  }
  ctx.doc.setFontSize(11);
  ctx.doc.setFont('helvetica', 'bold');
  ctx.doc.setTextColor(60);
  ctx.doc.text(title, MARGIN_MM, ctx.y);
  ctx.y += 2;
  ctx.doc.setDrawColor(180);
  ctx.doc.line(MARGIN_MM, ctx.y, ctx.pageWidth - MARGIN_MM, ctx.y);
  ctx.y += 4;
  ctx.doc.setFont('helvetica', 'normal');
  ctx.doc.setTextColor(0);
}

function noDataRow(ctx: PdfContext): void {
  ctx.doc.setFontSize(9);
  ctx.doc.setFont('helvetica', 'italic');
  ctx.doc.setTextColor(120);
  ctx.doc.text('No data recorded for this section.', MARGIN_MM + 2, ctx.y);
  ctx.doc.setFont('helvetica', 'normal');
  ctx.doc.setTextColor(0);
  ctx.y += 8;
}

function kvRow(ctx: PdfContext, label: string, value: string): void {
  ctx.doc.setFontSize(9);
  ctx.doc.setFont('helvetica', 'bold');
  ctx.doc.text(label + ':', MARGIN_MM + 2, ctx.y);
  ctx.doc.setFont('helvetica', 'normal');
  ctx.doc.text(s(value), MARGIN_MM + 50, ctx.y);
  ctx.y += 5;
  if (ctx.y > ctx.pageHeight - 20) {
    ctx.doc.addPage();
    ctx.y = MARGIN_MM + 5;
  }
}

function getAutoTableEndY(ctx: PdfContext): number {
  // jspdf-autotable stores the last table's final Y on the doc
  return (ctx.doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? ctx.y;
}

// ─── Section renderers ─────────────────────────────────────────────────────

function renderJobInfo(ctx: PdfContext, r: AdminJsaRow): void {
  sectionHeader(ctx, 'Job Information');
  kvRow(ctx, 'Job Date', formatDateForExport(r.job_date as string));
  kvRow(ctx, 'Location', s(r.work_location));
  kvRow(ctx, 'Circuit Number', s(r.circuit_number));
  kvRow(ctx, 'Call In Time', s(r.call_in_time));
  kvRow(ctx, 'Call Out Time', s(r.call_out_time));

  const jobs = r.jobs_performed as Array<{ label?: string; key?: string }> | null;
  const jobsStr = jobs?.length
    ? jobs.map(j => j.label || j.key || '').filter(Boolean).join(', ')
    : '—';
  kvRow(ctx, 'Jobs Performed', jobsStr);
  kvRow(ctx, 'Submitted By', s(r.user_name, 'Unknown'));
  kvRow(ctx, 'Status', s(r.status));
  kvRow(ctx, 'Type', r.submission_type === 'paper' ? 'Paper' : 'Digital');
  ctx.y += 3;
}

function renderEmergency(ctx: PdfContext, r: AdminJsaRow): void {
  sectionHeader(ctx, 'Emergency Contacts');
  const hasData = r.nearest_hospital || r.nearest_clinic || r.oc_contact || r.doc_contact || r.gf_contact || r.safety_contact;
  if (!hasData) { noDataRow(ctx); return; }
  kvRow(ctx, 'Nearest Hospital', s(r.nearest_hospital));
  kvRow(ctx, 'Nearest Clinic', s(r.nearest_clinic));
  kvRow(ctx, 'OC Contact', s(r.oc_contact));
  kvRow(ctx, 'DOC Contact', s(r.doc_contact));
  kvRow(ctx, 'GF Contact', s(r.gf_contact));
  kvRow(ctx, 'Safety Contact', s(r.safety_contact));
  ctx.y += 3;
}

function renderPpe(ctx: PdfContext, r: AdminJsaRow): void {
  sectionHeader(ctx, 'PPE Summary');
  const ppe = r.ppe as Record<string, { required?: boolean; condition?: string }> | null;
  if (!ppe || Object.keys(ppe).length === 0) { noDataRow(ctx); return; }

  const body = PPE_ITEMS.map(item => {
    const state = ppe[item.key];
    const req = state?.required ? 'Yes' : 'No';
    const cond = state?.required ? (state.condition || 'Not specified') : '—';
    return [item.label, req, cond];
  });

  ctx.autoTable(ctx.doc as never, {
    startY: ctx.y,
    head: [['PPE Item', 'Required', 'Condition']],
    body,
    styles: { fontSize: 8, cellPadding: 2, overflow: 'linebreak' as const },
    headStyles: { fillColor: [100, 60, 150], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 243, 250] },
    margin: { left: MARGIN_MM, right: MARGIN_MM },
    tableWidth: 'auto' as const,
  });
  ctx.y = getAutoTableEndY(ctx) + 6;
}

function renderWeather(ctx: PdfContext, r: AdminJsaRow): void {
  sectionHeader(ctx, 'Weather & Conditions');
  const wc = r.weather_conditions as { conditions?: Record<string, boolean>; modifiers?: Record<string, boolean> } | null;
  const conds = wc?.conditions ? WEATHER_CONDITIONS.filter(c => wc.conditions![c.key]).map(c => c.label) : [];
  const mods = wc?.modifiers ? WEATHER_MODIFIERS.filter(m => wc.modifiers![m.key]).map(m => m.label) : [];
  const allWeather = [...conds, ...mods];

  if (allWeather.length === 0 && !r.weather_hazards) { noDataRow(ctx); return; }

  if (allWeather.length > 0) kvRow(ctx, 'Conditions', allWeather.join(', '));
  kvRow(ctx, 'Weather Hazards', s(r.weather_hazards as string));
  ctx.y += 3;
}

function renderHazards(ctx: PdfContext, r: AdminJsaRow): void {
  sectionHeader(ctx, 'Site Hazards & Traffic');
  const hazards = formatCheckedLabels(r.hazards_present as Record<string, boolean> | null, HAZARD_ITEMS);
  const traffic = formatCheckedLabels(r.traffic_hazards as Record<string, boolean> | null, TRAFFIC_HAZARDS);
  const setup = formatCheckedLabels(r.traffic_setup as Record<string, boolean> | null, TRAFFIC_SETUP);

  if ((!hazards || hazards === 'None') && (!traffic || traffic === 'None') && (!setup || setup === 'None')) {
    noDataRow(ctx);
    return;
  }

  kvRow(ctx, 'Hazards Present', hazards || 'None');
  kvRow(ctx, 'Traffic Hazards', traffic || 'None');
  kvRow(ctx, 'Work Zone Setup', setup || 'None');
  ctx.y += 3;
}

function renderSpans(ctx: PdfContext, r: AdminJsaRow): void {
  sectionHeader(ctx, 'Span Walk-through');
  const spans = r.spans as Array<{ spanNumber?: number; location?: string; hazards?: string; mitigation?: string; initials?: string }> | null;
  if (!spans || spans.length === 0) { noDataRow(ctx); return; }

  const body = spans.map((sp, i) => [
    String(sp.spanNumber ?? i + 1),
    s(sp.location),
    s(sp.hazards),
    s(sp.mitigation),
    s(sp.initials),
  ]);

  ctx.autoTable(ctx.doc as never, {
    startY: ctx.y,
    head: [['Span #', 'Location', 'Hazards', 'Mitigation', 'Initials']],
    body,
    styles: { fontSize: 8, cellPadding: 2, overflow: 'linebreak' as const },
    headStyles: { fillColor: [100, 60, 150], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 243, 250] },
    margin: { left: MARGIN_MM, right: MARGIN_MM },
    tableWidth: 'auto' as const,
    columnStyles: {
      0: { cellWidth: 15 },
      4: { cellWidth: 20 },
    },
  });
  ctx.y = getAutoTableEndY(ctx) + 6;
}

function renderObservers(ctx: PdfContext, r: AdminJsaRow): void {
  sectionHeader(ctx, 'Observer Signatures');
  const obs = r.observer_signatures as Array<{ name?: string; role?: string; timestamp?: string; signature_data?: string }> | null;
  if (!obs || obs.length === 0) { noDataRow(ctx); return; }

  const body = obs.map(o => [
    s(o.name),
    s(o.role),
    o.timestamp ? formatDateForExport(o.timestamp, true) : 'Pending',
    o.signature_data ? 'Signed' : 'Pending',
  ]);

  ctx.autoTable(ctx.doc as never, {
    startY: ctx.y,
    head: [['Name', 'Role', 'Date', 'Status']],
    body,
    styles: { fontSize: 8, cellPadding: 2, overflow: 'linebreak' as const },
    headStyles: { fillColor: [100, 60, 150], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 243, 250] },
    margin: { left: MARGIN_MM, right: MARGIN_MM },
    tableWidth: 'auto' as const,
  });
  ctx.y = getAutoTableEndY(ctx) + 6;
}

function renderShared(ctx: PdfContext, r: AdminJsaRow): void {
  sectionHeader(ctx, 'Shared With');
  const users = r.shared_with_users as Array<{ full_name?: string; email?: string; role?: string }> | null;
  if (!users || users.length === 0) { noDataRow(ctx); return; }

  const body = users.map(u => [s(u.full_name), s(u.email), s(u.role)]);

  ctx.autoTable(ctx.doc as never, {
    startY: ctx.y,
    head: [['Name', 'Email', 'Role']],
    body,
    styles: { fontSize: 8, cellPadding: 2, overflow: 'linebreak' as const },
    headStyles: { fillColor: [100, 60, 150], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 243, 250] },
    margin: { left: MARGIN_MM, right: MARGIN_MM },
    tableWidth: 'auto' as const,
  });
  ctx.y = getAutoTableEndY(ctx) + 6;
}

function renderNotes(ctx: PdfContext, r: AdminJsaRow): void {
  sectionHeader(ctx, 'Notes');
  const notes = (r.notes as string)?.trim();
  if (!notes) { noDataRow(ctx); return; }

  ctx.doc.setFontSize(9);
  const lines = ctx.doc.splitTextToSize(notes, ctx.pageWidth - 2 * MARGIN_MM - 4);
  for (const line of lines) {
    if (ctx.y > ctx.pageHeight - 20) {
      ctx.doc.addPage();
      ctx.y = MARGIN_MM + 5;
    }
    ctx.doc.text(line, MARGIN_MM + 2, ctx.y);
    ctx.y += 4.5;
  }
  ctx.y += 3;
}

function renderSignature(ctx: PdfContext, r: AdminJsaRow): void {
  sectionHeader(ctx, 'Signature Block');
  const sig = (r.employee_signature as string)?.trim();
  kvRow(ctx, 'Employee Signature', sig || 'Pending');
  kvRow(ctx, 'Signature Image', r.employee_signature_path ? 'On file' : 'Pending');
  kvRow(ctx, 'Completed At', r.completed_at ? formatDateForExport(r.completed_at as string, true) : 'Pending');
  ctx.y += 3;
}

const SECTION_RENDERERS: Record<JsaSectionKey, (ctx: PdfContext, r: AdminJsaRow) => void> = {
  jobInfo: renderJobInfo,
  emergency: renderEmergency,
  ppe: renderPpe,
  weather: renderWeather,
  hazards: renderHazards,
  spans: renderSpans,
  observers: renderObservers,
  shared: renderShared,
  notes: renderNotes,
  signature: renderSignature,
};

// ─── Document header / footer ──────────────────────────────────────────────

function renderDocHeader(ctx: PdfContext, record: AdminJsaRow): void {
  ctx.doc.setFontSize(16);
  ctx.doc.setFont('helvetica', 'bold');
  ctx.doc.text(COMPANY_NAME, ctx.pageWidth / 2, ctx.y, { align: 'center' });
  ctx.y += 7;

  ctx.doc.setFontSize(11);
  ctx.doc.setFont('helvetica', 'normal');
  ctx.doc.text(REPORT_TITLE, ctx.pageWidth / 2, ctx.y, { align: 'center' });
  ctx.y += 5;

  ctx.doc.setFontSize(9);
  ctx.doc.setTextColor(100);
  const subtitle = `${s(record.work_location, 'Unknown Location')} — ${formatDateForExport(record.job_date as string)} — ${s(record.user_name, 'Unknown')}`;
  ctx.doc.text(subtitle, ctx.pageWidth / 2, ctx.y, { align: 'center' });
  ctx.doc.setTextColor(0);
  ctx.y += 3;

  ctx.doc.setDrawColor(100);
  ctx.doc.setLineWidth(0.5);
  ctx.doc.line(MARGIN_MM, ctx.y, ctx.pageWidth - MARGIN_MM, ctx.y);
  ctx.y += 8;
}

function addPageFooters(ctx: PdfContext, exportedBy: string): void {
  const pageCount = ctx.doc.getNumberOfPages();
  const footerY = ctx.pageHeight - 10;
  for (let i = 1; i <= pageCount; i++) {
    ctx.doc.setPage(i);
    ctx.doc.setFontSize(7);
    ctx.doc.setTextColor(140);
    ctx.doc.text(
      `Page ${i} of ${TOTAL_PAGES_PLACEHOLDER}`,
      ctx.pageWidth / 2,
      footerY,
      { align: 'center' },
    );
    ctx.doc.text(
      `Generated by ATTS Employee Portal — ${format(new Date(), "MMM dd, yyyy 'at' h:mm a")}`,
      MARGIN_MM,
      footerY,
    );
    if (exportedBy) {
      ctx.doc.text(`Exported by: ${exportedBy}`, ctx.pageWidth - MARGIN_MM, footerY, { align: 'right' });
    }
    ctx.doc.setTextColor(0);
  }
  ctx.doc.putTotalPages(TOTAL_PAGES_PLACEHOLDER);
}

// ─── Single JSA PDF ────────────────────────────────────────────────────────

function renderSingleJsa(ctx: PdfContext, record: AdminJsaRow, sections: Set<JsaSectionKey>): void {
  renderDocHeader(ctx, record);
  for (const sec of JSA_SECTIONS) {
    if (sections.has(sec.key)) {
      SECTION_RENDERERS[sec.key](ctx, record);
    }
  }
}

export async function generateIndividualJsaPdf(
  record: AdminJsaRow,
  options: JsaExportOptions,
  exportedBy = '',
): Promise<Blob> {
  const [jsPDFModule, autoTableModule]: [JsPDFModule, AutoTableModule] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);
  const jsPDF = jsPDFModule.default;
  const autoTable = autoTableModule.default;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const ctx: PdfContext = { doc, autoTable: autoTable as unknown as AutoTableFn, pageWidth, pageHeight, y: MARGIN_MM };

  renderSingleJsa(ctx, record, options.sections);
  addPageFooters(ctx, exportedBy);

  return doc.output('blob');
}

// ─── Batch JSA PDF ─────────────────────────────────────────────────────────

export async function generateBatchJsaPdf(
  records: AdminJsaRow[],
  options: JsaExportOptions,
  exportedBy = '',
): Promise<Blob> {
  if (records.length > BATCH_CAP) {
    throw new Error(`Batch export is capped at ${BATCH_CAP} records. Received ${records.length}.`);
  }
  if (records.length === 0) {
    throw new Error('No records provided for export.');
  }

  const [jsPDFModule, autoTableModule]: [JsPDFModule, AutoTableModule] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);
  const jsPDF = jsPDFModule.default;
  const autoTable = autoTableModule.default;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const ctx: PdfContext = { doc, autoTable: autoTable as unknown as AutoTableFn, pageWidth, pageHeight, y: MARGIN_MM };

  const includeToc = records.length >= 3;
  const tocPageNumbers: Array<{ location: string; date: string; submitter: string; page: number }> = [];

  if (includeToc) {
    // Reserve TOC page — we'll fill it in after all records are rendered
    ctx.doc.setFontSize(16);
    ctx.doc.setFont('helvetica', 'bold');
    ctx.doc.text(COMPANY_NAME, pageWidth / 2, MARGIN_MM, { align: 'center' });
    ctx.doc.setFontSize(12);
    ctx.doc.setFont('helvetica', 'normal');
    ctx.doc.text(`Batch JSA Export — ${records.length} Records`, pageWidth / 2, MARGIN_MM + 8, { align: 'center' });
    ctx.doc.text('Table of Contents', pageWidth / 2, MARGIN_MM + 16, { align: 'center' });
    // TOC table will be added at the end via a second pass
  }

  for (let i = 0; i < records.length; i++) {
    if (i > 0 || includeToc) {
      doc.addPage();
    }
    ctx.y = MARGIN_MM;

    const pageNum = doc.getNumberOfPages();
    tocPageNumbers.push({
      location: s(records[i].work_location, 'Unknown'),
      date: formatDateForExport(records[i].job_date as string),
      submitter: s(records[i].user_name, 'Unknown'),
      page: pageNum,
    });

    renderSingleJsa(ctx, records[i], options.sections);
  }

  // Fill in TOC on page 1
  if (includeToc) {
    doc.setPage(1);
    const tocBody = tocPageNumbers.map((entry, i) => [
      String(i + 1),
      entry.location,
      entry.date,
      entry.submitter,
      String(entry.page),
    ]);

    (autoTable as unknown as AutoTableFn)(doc as never, {
      startY: MARGIN_MM + 22,
      head: [['#', 'Location', 'Date', 'Submitter', 'Page']],
      body: tocBody,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [100, 60, 150], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 243, 250] },
      margin: { left: MARGIN_MM, right: MARGIN_MM },
      tableWidth: 'auto',
      columnStyles: {
        0: { cellWidth: 10 },
        4: { cellWidth: 15 },
      },
    });
  }

  addPageFooters(ctx, exportedBy);

  return doc.output('blob');
}

// ─── CSV / Excel ───────────────────────────────────────────────────────────

function buildMetadata(
  records: AdminJsaRow[],
  exportedBy: string,
  filters?: Record<string, string>,
): ExportMetadata {
  return {
    reportType: 'JSA Export — All Terrain Tree Service',
    generatedAt: new Date(),
    exportedBy,
    filters: filters || {},
    totalRecords: records.length,
  };
}

export function exportJsaCsv(
  records: AdminJsaRow[],
  exportedBy = '',
  filters?: Record<string, string>,
): void {
  const exporter = new DataExporter<AdminJsaRow>();
  exporter.exportCSV({
    data: records,
    columns: JSA_EXPORT_COLUMNS,
    filename: buildFilename('csv', records.length === 1 ? records[0] : undefined, records.length > 1 ? records.length : undefined),
    metadata: buildMetadata(records, exportedBy, filters),
  });
}

export async function exportJsaExcel(
  records: AdminJsaRow[],
  exportedBy = '',
  filters?: Record<string, string>,
): Promise<void> {
  const exporter = new DataExporter<AdminJsaRow>();
  await exporter.exportExcel({
    data: records,
    columns: JSA_EXPORT_COLUMNS,
    filename: buildFilename('xlsx', records.length === 1 ? records[0] : undefined, records.length > 1 ? records.length : undefined),
    metadata: buildMetadata(records, exportedBy, filters),
  });
}

// ─── Download / Share helpers ──────────────────────────────────────────────

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function shareOrDownload(
  blob: Blob,
  filename: string,
  mimeType: string,
  title: string,
): Promise<'shared' | 'downloaded'> {
  try {
    const file = new File([blob], filename, { type: mimeType });
    if (typeof navigator.share === 'function' && navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title });
      return 'shared';
    }
  } catch (err) {
    logger.warn('[jsaExport] Web Share API failed, falling back to download', err);
  }
  downloadBlob(blob, filename);
  return 'downloaded';
}

export { BATCH_CAP };
