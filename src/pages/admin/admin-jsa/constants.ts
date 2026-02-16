/**
 * Constants and configuration for AdminJSA page
 */

import {
  formatDateForExport,
  formatSpansSummary,
  formatPhotoPresent,
  formatJsaPhotoCount,
  formatPPESummary,
  formatCheckedLabels,
  type ExportColumn,
} from "../../../lib/exportUtils";
import { PPE_ITEMS } from "../../forms/dailyJSAFormState";
import type { AdminJsaRow } from "./types";

// =============================================================================
// PAGINATION
// =============================================================================

export const PAGE_SIZE_OPTIONS = [20, 50, 100];
export const DEFAULT_PAGE_SIZE = 20;

// =============================================================================
// WEATHER OPTIONS
// =============================================================================

export const WEATHER_CONDITIONS = [
  { key: "sunny", label: "Sunny" },
  { key: "rain", label: "Rain" },
  { key: "overcast", label: "Overcast" },
  { key: "windy", label: "Windy" },
];

export const WEATHER_MODIFIERS = [
  { key: "hot_dry", label: "Hot / Dry" },
  { key: "wet", label: "Wet" },
  { key: "cold", label: "Cold" },
  { key: "ice_snow", label: "Ice / Snow" },
];

// =============================================================================
// HAZARD OPTIONS
// =============================================================================

export const HAZARD_ITEMS = [
  { key: "lines_energized", label: "Lines energized" },
  { key: "secondary_voltage", label: "Secondary voltage" },
  { key: "open_wire_secondary", label: "Open-wire secondary" },
  { key: "guy_wire_present", label: "Guy wire present" },
  { key: "rotten_poles", label: "Rotten poles" },
  { key: "broken_poles", label: "Broken/damaged poles" },
  { key: "line_clearances_signed", label: "Line clearances needed & signed" },
  { key: "voltages_grounded", label: "Voltages grounded" },
  { key: "voltages_verified", label: "Grounds verified" },
];

export const TRAFFIC_HAZARDS = [
  { key: "hills", label: "Hills" },
  { key: "curves", label: "Curves" },
  { key: "heavy_traffic", label: "Heavy traffic" },
  { key: "construction_zone", label: "Construction zone" },
  { key: "school_zone", label: "School zone" },
  { key: "closing_lane", label: "Closing a lane" },
  { key: "flagger_needed", label: "Flagger needed" },
  { key: "flagger_trained", label: "Flagger trained" },
  { key: "has_stop_paddles", label: "Stop/Slow paddles ready" },
  { key: "has_radios", label: "Required radios ready" },
];

export const TRAFFIC_SETUP = [
  { key: "warning_signs_used", label: "Proper warning signs used" },
  { key: "warning_signs_distance", label: "Signs at correct distance" },
  { key: "reflective_cones", label: "Reflective cones placed" },
  { key: "cone_separation", label: "Cone separation correct" },
  { key: "buffer_zone", label: "Buffer/Taper zone correct" },
];

// =============================================================================
// FILTERS
// =============================================================================

export const STATUS_FILTERS = [
  { label: "All", value: "all" },
  { label: "Draft", value: "draft" },
  { label: "Completed", value: "completed" },
];

export const TYPE_FILTERS = [
  { label: "All", value: "all" },
  { label: "Digital", value: "digital" },
  { label: "Paper", value: "paper" },
];

// =============================================================================
// STYLING
// =============================================================================

export const STATUS_BADGE: Record<string, string> = {
  draft: "bg-[#2b1a07]/80 text-[#fcdca1] border border-[#f4c979]/40",
  completed: "bg-[#0f2218]/80 text-[#9cf6d2] border border-[#6fe9b7]/35",
};

// =============================================================================
// EXPORT COLUMNS (full form data — Safety Compliance Export Upgrade Slice 1)
// =============================================================================

function formatJobsPerformed(value: unknown): string {
  const jobs = value as Array<{ label?: string; key?: string }> | null | undefined;
  if (!jobs?.length) return "N/A";
  return jobs.map((j) => j.label || j.key || "").filter(Boolean).join(", ");
}

function formatWeatherConditions(value: unknown): string {
  const w = value as { conditions?: Record<string, boolean>; modifiers?: Record<string, boolean> } | null | undefined;
  if (!w) return "";
  const conds = w.conditions ? WEATHER_CONDITIONS.filter((c) => w.conditions![c.key]).map((c) => c.label) : [];
  const mods = w.modifiers ? WEATHER_MODIFIERS.filter((m) => w.modifiers![m.key]).map((m) => m.label) : [];
  return [...conds, ...mods].join(", ") || "—";
}

function formatObserverSignatures(value: unknown): string {
  const sigs = value as Array<{ name?: string; timestamp?: string }> | null | undefined;
  if (!sigs?.length) return "None";
  return sigs.map((s) => `${s.name ?? "—"} (${s.timestamp ? formatDateForExport(s.timestamp) : "—"})`).join("; ");
}

function formatSharedWith(value: unknown): string {
  const users = value as Array<{ email?: string }> | null | undefined;
  if (!users?.length) return "None";
  return users.map((u) => u.email ?? "").filter(Boolean).join(", ");
}

/** Truncate for PDF readability (single-line hint). */
function truncateForPdf(s: string, maxLen = 70): string {
  const t = (s || "").trim();
  if (t.length <= maxLen) return t || "—";
  return t.slice(0, maxLen - 3) + "...";
}

/** Build "Conditions & PPE" summary for PDF: weather + weather hazards + short PPE list. */
function formatConditionsPpeSummary(_v: unknown, row: AdminJsaRow): string {
  const parts: string[] = [];
  const w = formatWeatherConditions(row.weather_conditions);
  if (w && w !== "—") parts.push(w);
  const wh = (row.weather_hazards as string)?.trim();
  if (wh) parts.push(wh);
  const ppe = formatPPESummary(row.ppe as Record<string, { required?: boolean; condition?: string }> | null, PPE_ITEMS);
  if (ppe && ppe !== "N/A") parts.push(truncateForPdf(ppe, 50));
  return parts.length ? parts.join("; ") : "—";
}

/** Build "Site Hazards & Traffic" summary for PDF: hazards + traffic hazards + traffic setup. */
function formatSiteHazardsTrafficSummary(_v: unknown, row: AdminJsaRow): string {
  const parts: string[] = [];
  const hazards = formatCheckedLabels(row.hazards_present as Record<string, boolean> | null, HAZARD_ITEMS);
  if (hazards && hazards !== "—") parts.push(hazards);
  const traffic = formatCheckedLabels(row.traffic_hazards as Record<string, boolean> | null, TRAFFIC_HAZARDS);
  if (traffic && traffic !== "—") parts.push(traffic);
  const setup = formatCheckedLabels(row.traffic_setup as Record<string, boolean> | null, TRAFFIC_SETUP);
  if (setup && setup !== "—") parts.push(setup);
  const combined = parts.join("; ");
  return truncateForPdf(combined, 80) || "—";
}

/** Full "Conditions & PPE" (no truncation) for PDF. */
function formatConditionsPpeSummaryFull(_v: unknown, row: AdminJsaRow): string {
  const parts: string[] = [];
  const w = formatWeatherConditions(row.weather_conditions);
  if (w && w !== "—") parts.push(w);
  const wh = (row.weather_hazards as string)?.trim();
  if (wh) parts.push(wh);
  const ppe = formatPPESummary(row.ppe as Record<string, { required?: boolean; condition?: string }> | null, PPE_ITEMS);
  if (ppe && ppe !== "N/A") parts.push(ppe);
  return parts.length ? parts.join("; ") : "—";
}

/** Full "Site Hazards & Traffic" (no truncation) for PDF. */
function formatSiteHazardsTrafficSummaryFull(_v: unknown, row: AdminJsaRow): string {
  const parts: string[] = [];
  const hazards = formatCheckedLabels(row.hazards_present as Record<string, boolean> | null, HAZARD_ITEMS);
  if (hazards && hazards !== "—") parts.push(hazards);
  const traffic = formatCheckedLabels(row.traffic_hazards as Record<string, boolean> | null, TRAFFIC_HAZARDS);
  if (traffic && traffic !== "—") parts.push(traffic);
  const setup = formatCheckedLabels(row.traffic_setup as Record<string, boolean> | null, TRAFFIC_SETUP);
  if (setup && setup !== "—") parts.push(setup);
  const combined = parts.join("; ");
  return combined || "—";
}

// PDF uses a reduced column set (includeInPdf !== false) to avoid horizontal overflow and unreadable layout.
// Full data remains in CSV/Excel. See docs/SafetyCompliance-Export-Summary.md §4.5.
export const JSA_EXPORT_COLUMNS: ExportColumn<AdminJsaRow>[] = [
  // Job info (all in PDF)
  { header: "Job Date", key: "job_date", format: (v) => formatDateForExport(v as string), width: 14 },
  { header: "Location", key: "work_location", format: (v) => (v as string) || "N/A", width: 30 },
  { header: "Circuit Number", key: "circuit_number", format: (v) => (v as string) || "N/A", width: 15 },
  { header: "Call In", key: "call_in_time", format: (v) => (v as string) || "N/A", width: 12, includeInPdf: false },
  { header: "Call Out", key: "call_out_time", format: (v) => (v as string) || "N/A", width: 12, includeInPdf: false },
  { header: "Jobs Performed", key: "jobs_performed", format: (v) => formatJobsPerformed(v), width: 40, includeInPdf: false },
  { header: "Submitted By", key: "user_name", format: (v) => (v as string) || "Unknown", width: 20 },
  { header: "Submitter Email", key: "user_email", format: (v) => (v as string) || "N/A", width: 28, includeInPdf: false },
  { header: "Status", key: "status", format: (v) => ((v as string) === "completed" ? "Completed" : (v as string) === "draft" ? "Draft" : (v as string) || "N/A"), width: 12 },
  { header: "Type", key: "submission_type", format: (v) => (v === "paper" ? "Paper" : (v === "digital" ? "Digital" : (v as string) || "Digital")), width: 10 },
  { header: "JSA Type", key: "jsa_type", format: (v) => (v as string) || "N/A", width: 14 },
  // Contacts (all in PDF for quick reference)
  { header: "OC Contact", key: "oc_contact", format: (v) => (v as string) || "N/A", width: 20 },
  { header: "DOC Contact", key: "doc_contact", format: (v) => (v as string) || "N/A", width: 20 },
  { header: "GF Contact", key: "gf_contact", format: (v) => (v as string) || "N/A", width: 20 },
  { header: "Safety Contact", key: "safety_contact", format: (v) => (v as string) || "N/A", width: 20 },
  { header: "Nearest Hospital", key: "nearest_hospital", format: (v) => (v as string) || "N/A", width: 25 },
  { header: "Nearest Clinic", key: "nearest_clinic", format: (v) => (v as string) || "N/A", width: 25 },
  // PDF-only combined columns for readability (full detail remains in CSV/Excel below)
  { header: "Conditions & PPE", key: "conditions_ppe_summary", format: formatConditionsPpeSummary, width: 38, includeInPdf: true },
  { header: "Site Hazards & Traffic", key: "site_hazards_traffic_summary", format: formatSiteHazardsTrafficSummary, width: 42, includeInPdf: true },
  // Long summary columns — CSV/Excel only (PDF uses combined columns above)
  { header: "PPE Summary", key: "ppe", format: (_v, row) => formatPPESummary(row.ppe as Record<string, { required?: boolean; condition?: string }> | null, PPE_ITEMS), width: 60, includeInPdf: false },
  { header: "Weather", key: "weather_conditions", format: (v) => formatWeatherConditions(v), width: 30, includeInPdf: false },
  { header: "Weather Hazards", key: "weather_hazards", format: (v) => (v as string) || "—", width: 30, includeInPdf: false },
  { header: "Hazards Present", key: "hazards_present", format: (_v, row) => formatCheckedLabels(row.hazards_present as Record<string, boolean> | null, HAZARD_ITEMS), width: 50, includeInPdf: false },
  { header: "Traffic Hazards", key: "traffic_hazards", format: (_v, row) => formatCheckedLabels(row.traffic_hazards as Record<string, boolean> | null, TRAFFIC_HAZARDS), width: 45, includeInPdf: false },
  { header: "Traffic Setup", key: "traffic_setup", format: (_v, row) => formatCheckedLabels(row.traffic_setup as Record<string, boolean> | null, TRAFFIC_SETUP), width: 45, includeInPdf: false },
  { header: "Spans", key: "spans_summary", format: (_v, row) => truncateForPdf(formatSpansSummary(row.spans as Array<{ location?: string; hazards?: string; mitigation?: string; initials?: string }> | null), 55), width: 28, includeInPdf: false },
  { header: "Spans (full)", key: "spans", format: (_v, row) => formatSpansSummary(row.spans as Array<{ location?: string; hazards?: string; mitigation?: string; initials?: string }> | null), width: 80, includeInPdf: false },
  // Signatures — included in PDF so export shows employee and observer signatures
  { header: "Employee Signature", key: "employee_signature", format: (v) => (v as string)?.trim() || "Not signed", width: 18, includeInPdf: true },
  { header: "Signed", key: "employee_signature_path", format: (v) => formatPhotoPresent(v as string | null), width: 10 },
  { header: "Observer Signatures", key: "observer_signatures", format: (v) => formatObserverSignatures(v), width: 45, includeInPdf: true },
  { header: "Shared With", key: "shared_with_users", format: (v) => formatSharedWith(v), width: 40, includeInPdf: false },
  // Other
  { header: "Notes", key: "notes", format: (v) => (v as string) || "N/A", width: 40, includeInPdf: false },
  // Paper JSA Photos — CSV/Excel: placeholder (URLs populated at export time); PDF: count
  { header: "Paper JSA Photos", key: "jsa_photo_paths", format: (v) => {
    const paths = v as string[] | null;
    if (!paths || paths.length === 0) return "None";
    return `${paths.length} photo(s) — see CSV export for links`;
  }, width: 35, includeInPdf: false },
  { header: "Documentation Note", key: "jsa_photo_paths", format: (v) => {
    const paths = v as string[] | null;
    if (!paths || paths.length === 0) return "";
    return "Paper JSA form images retained digitally to support workplace safety documentation practices. Photo links expire 7 days after export.";
  }, width: 60, includeInPdf: false },
  { header: "Created", key: "created_at", format: (v) => formatDateForExport(v as string, true), width: 22 },
  { header: "Updated", key: "updated_at", format: (v) => formatDateForExport(v as string, true), width: 22 },
  { header: "Status Changed At", key: "status_changed_at", format: (v) => formatDateForExport(v as string, true), width: 22, includeInPdf: false },
  { header: "Completed At", key: "completed_at", format: (v) => formatDateForExport(v as string, true), width: 22, includeInPdf: false },
];

// =============================================================================
// PDF-ONLY COLUMNS — Fewer columns, short headers, full data (no truncation).
// Text wraps within cells via overflow: linebreak in exportUtils.
// =============================================================================

export const JSA_PDF_EXPORT_COLUMNS: ExportColumn<AdminJsaRow>[] = [
  { header: "Job Date", key: "job_date", format: (v) => formatDateForExport(v as string), width: 18 },
  { header: "Location", key: "work_location", format: (v) => (v as string) || "N/A", width: 36 },
  { header: "By", key: "user_name", format: (v) => (v as string) || "Unknown", width: 14 },
  { header: "Status", key: "status", format: (v) => ((v as string) === "completed" ? "Done" : (v as string) === "draft" ? "Draft" : (v as string) || "—"), width: 10 },
  { header: "Type", key: "submission_type", format: (v) => (v === "paper" ? "Paper" : (v === "digital" ? "Digital" : "Digital")), width: 10 },
  { header: "Conditions & PPE", key: "conditions_ppe_summary", format: formatConditionsPpeSummaryFull, width: 42 },
  { header: "Hazards & Traffic", key: "site_hazards_traffic_summary", format: formatSiteHazardsTrafficSummaryFull, width: 38 },
  { header: "Emp. Sig.", key: "employee_signature", format: (v) => (v as string)?.trim() || "Not signed", width: 24 },
  { header: "Obs. Sig.", key: "observer_signatures", format: (v) => formatObserverSignatures(v), width: 32 },
  { header: "Signed", key: "employee_signature_path", format: (v) => formatPhotoPresent(v as string | null), width: 10 },
  { header: "Photos", key: "jsa_photo_paths", format: (v) => formatJsaPhotoCount(v as string[] | null), width: 12 },
  { header: "Created", key: "created_at", format: (v) => formatDateForExport(v as string, true), width: 20 },
];
