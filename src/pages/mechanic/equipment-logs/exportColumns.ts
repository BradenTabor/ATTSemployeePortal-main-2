import {
  formatDateForExport,
  formatMileage,
  formatBoolean,
  type ExportColumn,
} from "../../../lib/exportUtils";
import {
  type DVIRReport,
  type EquipmentInspection,
  type ChecklistValue,
  VEHICLE_TRAILER_ITEMS,
  AERIAL_LIFT_ITEMS,
  GENERAL_EQUIPMENT_ITEMS,
  SPECIFIC_ITEMS,
} from "./types";

// =============================================================================
// DVIR EXPORT COLUMNS
// =============================================================================

export const dvirExportColumns: ExportColumn<DVIRReport>[] = [
  {
    header: "Date",
    key: "created_at",
    format: (value) => formatDateForExport(value as string, true),
    width: 22,
  },
  {
    header: "Truck Number",
    key: "truck_number",
    format: (value) => (value as string) || "N/A",
    width: 14,
  },
  {
    header: "Driver Name",
    key: "drivers_name",
    format: (value) => (value as string) || "Unknown",
    width: 20,
  },
  {
    header: "Mileage",
    key: "mileage",
    format: (value) => formatMileage(value as number | null),
    width: 12,
  },
  {
    header: "Chipper #",
    key: "chipper_number",
    format: (value) => (value as string) || "N/A",
    width: 12,
  },
  {
    header: "Trailer #",
    key: "trailer_number",
    format: (value) => (value as string) || "N/A",
    width: 12,
  },
  {
    header: "Vehicle Failures",
    key: "vehicle_trailer_checklist",
    format: (value) => {
      const failures: string[] = [];
      const checklist = value as Record<string, ChecklistValue> | null;
      if (checklist) {
        for (const item of VEHICLE_TRAILER_ITEMS) {
          if (checklist[item.id] === "F") {
            failures.push(item.label);
          }
        }
      }
      return failures.length > 0 ? failures.join(", ") : "None";
    },
    width: 40,
  },
  {
    header: "Aerial Failures",
    key: "aerial_checklist",
    format: (value) => {
      const failures: string[] = [];
      const checklist = value as Record<string, ChecklistValue> | null;
      if (checklist) {
        for (const item of AERIAL_LIFT_ITEMS) {
          if (checklist[item.id] === "F") {
            failures.push(item.label);
          }
        }
      }
      return failures.length > 0 ? failures.join(", ") : "None";
    },
    width: 35,
  },
  {
    header: "Has Mechanic Fix",
    key: "deficiency_corrected",
    format: (value, row) => {
      const hasFix = Boolean(
        (value as string) || row.mechanic_remarks || row.mechanic_date
      );
      return formatBoolean(hasFix);
    },
    width: 12,
  },
  {
    header: "Fix Applied",
    key: "deficiency_corrected",
    format: (value) => (value as string) || "N/A",
    width: 35,
  },
  {
    header: "Mechanic Remarks",
    key: "mechanic_remarks",
    format: (value) => (value as string) || "N/A",
    width: 30,
  },
  {
    header: "Driver Notes",
    key: "notes",
    format: (value) => (value as string) || "N/A",
    width: 30,
  },
];

// =============================================================================
// EQUIPMENT EXPORT COLUMNS
// =============================================================================

export const equipmentExportColumns: ExportColumn<EquipmentInspection>[] = [
  {
    header: "Inspection Date",
    key: "inspection_date",
    format: (value) => formatDateForExport(value as string),
    width: 14,
  },
  {
    header: "Equipment Number",
    key: "equipment_number",
    format: (value) => (value as string) || "N/A",
    width: 18,
  },
  {
    header: "Equipment Type",
    key: "equipment_type",
    format: (value) => (value as string) || "N/A",
    width: 14,
  },
  {
    header: "Submitted By",
    key: "submitted_by",
    format: (value) => (value as string) || "Unknown",
    width: 20,
  },
  {
    header: "General Failures",
    key: "general_checklist",
    format: (value) => {
      const failures: string[] = [];
      const checklist = value as Record<string, ChecklistValue> | null;
      if (checklist) {
        for (const item of GENERAL_EQUIPMENT_ITEMS) {
          if (checklist[item.id] === "F") {
            failures.push(item.label);
          }
        }
      }
      return failures.length > 0 ? failures.join(", ") : "None";
    },
    width: 35,
  },
  {
    header: "Specific Failures",
    key: "specific_checklist",
    format: (value, row) => {
      const failures: string[] = [];
      const checklist = value as Record<string, ChecklistValue> | null;
      const templateItems = SPECIFIC_ITEMS[row.template as keyof typeof SPECIFIC_ITEMS] || [];
      if (checklist) {
        for (const item of templateItems) {
          if (checklist[item.id] === "F") {
            failures.push(item.label);
          }
        }
      }
      return failures.length > 0 ? failures.join(", ") : "None";
    },
    width: 35,
  },
  {
    header: "Has Mechanic Fix",
    key: "mechanic_fixes",
    format: (value) => formatBoolean(Boolean((value as string)?.trim())),
    width: 12,
  },
  {
    header: "Mechanic Notes",
    key: "mechanic_fixes",
    format: (value) => (value as string)?.trim() || "N/A",
    width: 40,
  },
  {
    header: "Inspector Notes",
    key: "notes",
    format: (value) => (value as string) || "N/A",
    width: 30,
  },
  {
    header: "Last Updated",
    key: "last_mechanic_updated_at",
    format: (value) => (value as string) ? formatDateForExport(value as string, true) : "N/A",
    width: 22,
  },
];
