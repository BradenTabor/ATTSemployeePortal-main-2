/**
 * Constants and configuration for AdminJSA page
 */

import {
  formatDateForExport,
  type ExportColumn,
} from "../../../lib/exportUtils";
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

// =============================================================================
// STYLING
// =============================================================================

export const STATUS_BADGE: Record<string, string> = {
  draft: "bg-[#2b1a07]/80 text-[#fcdca1] border border-[#f4c979]/40",
  completed: "bg-[#0f2218]/80 text-[#9cf6d2] border border-[#6fe9b7]/35",
};

// =============================================================================
// EXPORT COLUMNS
// =============================================================================

export const JSA_EXPORT_COLUMNS: ExportColumn<AdminJsaRow>[] = [
  {
    header: "Job Date",
    key: "job_date",
    format: (value) => formatDateForExport(value as string),
    width: 14,
  },
  {
    header: "Location",
    key: "work_location",
    format: (value) => (value as string) || "N/A",
    width: 30,
  },
  {
    header: "Circuit Number",
    key: "circuit_number",
    format: (value) => (value as string) || "N/A",
    width: 15,
  },
  {
    header: "Submitted By",
    key: "user_name",
    format: (value) => (value as string) || "Unknown",
    width: 20,
  },
  {
    header: "Status",
    key: "status",
    format: (value) => {
      const status = value as string;
      return status === "completed" ? "Completed" : status === "draft" ? "Draft" : status || "N/A";
    },
    width: 12,
  },
  {
    header: "Employee Signature",
    key: "employee_signature",
    format: (value) => (value as string) || "Not signed",
    width: 20,
  },
  {
    header: "Nearest Hospital",
    key: "nearest_hospital",
    format: (value) => (value as string) || "N/A",
    width: 25,
  },
  {
    header: "Nearest Clinic",
    key: "nearest_clinic",
    format: (value) => (value as string) || "N/A",
    width: 25,
  },
  {
    header: "Notes",
    key: "notes",
    format: (value) => (value as string) || "N/A",
    width: 40,
  },
  {
    header: "Updated",
    key: "updated_at",
    format: (value) => formatDateForExport(value as string, true),
    width: 22,
  },
];
