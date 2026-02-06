import {
  formatDateForExport,
  formatMileage,
  formatBoolean,
  formatCurrency,
  formatMechanicPartsUsed,
  formatChecklistFull,
  formatPhotoPresent,
  type ExportColumn,
  type ChecklistItemForExport,
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
// DVIR EXPORT COLUMNS (full form data — Slice 2)
// =============================================================================

const vehicleItemsExport: ChecklistItemForExport[] = VEHICLE_TRAILER_ITEMS;
const aerialItemsExport: ChecklistItemForExport[] = AERIAL_LIFT_ITEMS;

export const dvirExportColumns: ExportColumn<DVIRReport>[] = [
  { header: "Report Date", key: "report_date", format: (v) => formatDateForExport(v as string), width: 14 },
  { header: "Date", key: "created_at", format: (v) => formatDateForExport(v as string, true), width: 22 },
  { header: "Truck Number", key: "truck_number", format: (v) => (v as string) || "N/A", width: 14 },
  { header: "Mileage", key: "mileage", format: (v) => formatMileage(v as number | null), width: 12 },
  { header: "Driver Name", key: "drivers_name", format: (v) => (v as string) || "Unknown", width: 20 },
  { header: "Chipper #", key: "chipper_number", format: (v) => (v as string) || "N/A", width: 12 },
  { header: "Trailer #", key: "trailer_number", format: (v) => (v as string) || "N/A", width: 12 },
  { header: "Truck GVWR", key: "truck_gvwr", format: (v) => (v as string) || "N/A", width: 12, includeInPdf: false },
  { header: "Trailer/Chipper GVWR", key: "trailer_chipper_gvwr", format: (v) => (v as string) || "N/A", width: 18, includeInPdf: false },
  { header: "Medical Card Required", key: "medical_card_required", format: (v) => (v as string) || "N/A", width: 18, includeInPdf: false },
  { header: "Driver License #", key: "drivers_license_number", format: (v) => (v as string) || "N/A", width: 16, includeInPdf: false },
  { header: "Driver License Class", key: "drivers_license_class", format: (v) => (v as string) || "N/A", width: 16, includeInPdf: false },
  { header: "Driver License Exp", key: "drivers_license_exp", format: (v) => formatDateForExport(v as string), width: 14, includeInPdf: false },
  { header: "Has Medical Card", key: "has_medical_card", format: (v) => (v as string) || "N/A", width: 14, includeInPdf: false },
  { header: "Medical Card Exp", key: "medical_card_exp", format: (v) => formatDateForExport(v as string), width: 14, includeInPdf: false },
  { header: "Copy of Registration", key: "copy_of_registration", format: (v) => (v as string) || "N/A", width: 14, includeInPdf: false },
  { header: "Copy of Insurance", key: "copy_of_insurance", format: (v) => (v as string) || "N/A", width: 14, includeInPdf: false },
  {
    header: "Vehicle Failures",
    key: "vehicle_trailer_checklist",
    format: (value) => {
      const failures: string[] = [];
      const checklist = value as Record<string, ChecklistValue> | null;
      if (checklist) {
        for (const item of VEHICLE_TRAILER_ITEMS) {
          if (checklist[item.id] === "F") failures.push(item.label);
        }
      }
      return failures.length > 0 ? failures.join(", ") : "None";
    },
    width: 40,
  },
  {
    header: "Vehicle Checklist",
    key: "vehicle_trailer_checklist",
    format: (value) => formatChecklistFull(value as Record<string, string> | null, vehicleItemsExport),
    width: 80,
    includeInPdf: false,
  },
  {
    header: "Aerial Failures",
    key: "aerial_checklist",
    format: (value) => {
      const failures: string[] = [];
      const checklist = value as Record<string, ChecklistValue> | null;
      if (checklist) {
        for (const item of AERIAL_LIFT_ITEMS) {
          if (checklist[item.id] === "F") failures.push(item.label);
        }
      }
      return failures.length > 0 ? failures.join(", ") : "None";
    },
    width: 35,
  },
  {
    header: "Aerial Checklist",
    key: "aerial_checklist",
    format: (value) => formatChecklistFull(value as Record<string, string> | null, aerialItemsExport),
    width: 60,
    includeInPdf: false,
  },
  { header: "Aerial Notes", key: "aerial_notes", format: (v) => (v as string) || "N/A", width: 30, includeInPdf: false },
  { header: "Driver Notes", key: "notes", format: (v) => (v as string) || "N/A", width: 30 },
  {
    header: "Has Mechanic Fix",
    key: "deficiency_corrected",
    format: (value, row) => formatBoolean(Boolean((value as string) || row.mechanic_remarks || row.mechanic_date)),
    width: 12,
  },
  { header: "Fix Applied", key: "deficiency_corrected", format: (v) => (v as string) || "N/A", width: 35 },
  { header: "Mechanic Truck #", key: "mechanic_truck_number", format: (v) => (v as string) || "N/A", width: 14 },
  { header: "Mechanic Date", key: "mechanic_date", format: (v) => formatDateForExport(v as string), width: 14 },
  { header: "Mechanic Remarks", key: "mechanic_remarks", format: (v) => (v as string) || "N/A", width: 30 },
  { header: "Mechanic Cost", key: "mechanic_cost", format: (v) => formatCurrency(v as number | null), width: 12 },
  { header: "Mechanic Parts Used", key: "mechanic_parts_used", format: (v) => formatMechanicPartsUsed(v as Array<{ part_name: string; quantity: number; part_number?: string; cost?: number }> | null), width: 40 },
  { header: "Oil/Dipstick (Present)", key: "oil_dipstick_path", format: (v) => formatPhotoPresent(v as string), width: 14, includeInPdf: false },
  { header: "Tire Photo (Present)", key: "tire_photo_path", format: (v) => formatPhotoPresent(v as string | null), width: 14, includeInPdf: false },
  { header: "Coolant Photo (Present)", key: "coolant_photo_path", format: (v) => formatPhotoPresent(v as string | null), width: 16, includeInPdf: false },
  { header: "Damage Photo (Present)", key: "damage_photo_path", format: (v) => formatPhotoPresent(v as string | null), width: 18, includeInPdf: false },
  { header: "Driver Signature (Present)", key: "final_driver_signature", format: (v) => formatPhotoPresent(v as string | null), width: 18, includeInPdf: false },
  { header: "GF Signature (Present)", key: "general_foreman_signature", format: (v) => formatPhotoPresent(v as string | null), width: 18, includeInPdf: false },
  { header: "Mechanic Signature (Present)", key: "mechanic_signature", format: (v) => formatPhotoPresent(v as string | null), width: 20, includeInPdf: false },
];

// =============================================================================
// EQUIPMENT EXPORT COLUMNS (full form data — Slice 3)
// =============================================================================

const generalEquipmentItemsExport: ChecklistItemForExport[] = GENERAL_EQUIPMENT_ITEMS;

function getSpecificItemsForExport(template: string | null): ChecklistItemForExport[] {
  if (!template) return [];
  return (SPECIFIC_ITEMS[template as keyof typeof SPECIFIC_ITEMS] || []) as ChecklistItemForExport[];
}

export const equipmentExportColumns: ExportColumn<EquipmentInspection>[] = [
  { header: "Created", key: "created_at", format: (v) => formatDateForExport(v as string, true), width: 22 },
  { header: "Inspection Date", key: "inspection_date", format: (v) => formatDateForExport(v as string), width: 14 },
  { header: "Equipment Type", key: "equipment_type", format: (v) => (v as string) || "N/A", width: 14 },
  { header: "Equipment Number", key: "equipment_number", format: (v) => (v as string) || "N/A", width: 18 },
  { header: "Template", key: "template", format: (v) => (v as string) || "N/A", width: 14 },
  { header: "Submitted By", key: "submitted_by", format: (v) => (v as string) || "Unknown", width: 20 },
  {
    header: "General Failures",
    key: "general_checklist",
    format: (value) => {
      const failures: string[] = [];
      const checklist = value as Record<string, ChecklistValue> | null;
      if (checklist) {
        for (const item of GENERAL_EQUIPMENT_ITEMS) {
          if (checklist[item.id] === "F") failures.push(item.label);
        }
      }
      return failures.length > 0 ? failures.join(", ") : "None";
    },
    width: 35,
  },
  {
    header: "General Checklist",
    key: "general_checklist",
    format: (value) => formatChecklistFull(value as Record<string, string> | null, generalEquipmentItemsExport),
    width: 70,
    includeInPdf: false,
  },
  {
    header: "Specific Failures",
    key: "specific_checklist",
    format: (value, row) => {
      const failures: string[] = [];
      const checklist = value as Record<string, ChecklistValue> | null;
      const templateItems = getSpecificItemsForExport(row.template);
      if (checklist) {
        for (const item of templateItems) {
          if (checklist[item.id] === "F") failures.push(item.label);
        }
      }
      return failures.length > 0 ? failures.join(", ") : "None";
    },
    width: 35,
  },
  {
    header: "Specific Checklist",
    key: "specific_checklist",
    format: (value, row) => formatChecklistFull(value as Record<string, string> | null, getSpecificItemsForExport(row.template)),
    width: 50,
    includeInPdf: false,
  },
  { header: "Inspector Notes", key: "notes", format: (v) => (v as string) || "N/A", width: 30 },
  {
    header: "Has Mechanic Fix",
    key: "mechanic_fixes",
    format: (v) => formatBoolean(Boolean((v as string)?.trim())),
    width: 12,
  },
  { header: "Mechanic Notes", key: "mechanic_fixes", format: (v) => (v as string)?.trim() || "N/A", width: 40 },
  { header: "Last Mechanic Updated", key: "last_mechanic_updated_at", format: (v) => (v as string) ? formatDateForExport(v as string, true) : "N/A", width: 22 },
  { header: "Mechanic Cost", key: "mechanic_cost", format: (v) => formatCurrency(v as number | null), width: 12 },
  { header: "Mechanic Parts Used", key: "mechanic_parts_used", format: (v) => formatMechanicPartsUsed(v as Array<{ part_name: string; quantity: number; part_number?: string; cost?: number }> | null), width: 40 },
  { header: "Overview Photo (Present)", key: "overview_photo_path", format: (v) => formatPhotoPresent(v as string | null), width: 18, includeInPdf: false },
  { header: "Damage Photo (Present)", key: "damage_photo_path", format: (v) => formatPhotoPresent(v as string | null), width: 18, includeInPdf: false },
  { header: "Attachments Photo (Present)", key: "attachments_photo_path", format: (v) => formatPhotoPresent(v as string | null), width: 22, includeInPdf: false },
  { header: "Hydraulic Photo (Present)", key: "hydraulic_photo_path", format: (v) => formatPhotoPresent(v as string | null), width: 20, includeInPdf: false },
];

// =============================================================================
// PDF-ONLY COLUMNS — Slim sets for readable PDFs (full data, no truncation)
// =============================================================================

export const DVIR_PDF_EXPORT_COLUMNS: ExportColumn<DVIRReport>[] = [
  { header: "Date", key: "report_date", format: (v) => formatDateForExport(v as string), width: 14 },
  { header: "Truck #", key: "truck_number", format: (v) => (v as string) || "N/A", width: 12 },
  { header: "Driver", key: "drivers_name", format: (v) => (v as string) || "Unknown", width: 18 },
  { header: "Mileage", key: "mileage", format: (v) => formatMileage(v as number | null), width: 12 },
  { header: "Vehicle Failures", key: "vehicle_trailer_checklist", format: (value) => { const failures: string[] = []; const checklist = value as Record<string, ChecklistValue> | null; if (checklist) { for (const item of VEHICLE_TRAILER_ITEMS) { if (checklist[item.id] === "F") failures.push(item.label); } } return failures.length > 0 ? failures.join(", ") : "None"; }, width: 32 },
  { header: "Aerial Failures", key: "aerial_checklist", format: (value) => { const failures: string[] = []; const checklist = value as Record<string, ChecklistValue> | null; if (checklist) { for (const item of AERIAL_LIFT_ITEMS) { if (checklist[item.id] === "F") failures.push(item.label); } } return failures.length > 0 ? failures.join(", ") : "None"; }, width: 28 },
  { header: "Notes", key: "notes", format: (v) => (v as string) || "N/A", width: 28 },
  { header: "Fix Applied", key: "deficiency_corrected", format: (v) => (v as string) || "N/A", width: 24 },
  { header: "Mechanic Date", key: "mechanic_date", format: (v) => formatDateForExport(v as string), width: 14 },
  { header: "Cost", key: "mechanic_cost", format: (v) => formatCurrency(v as number | null), width: 12 },
];

export const EQUIPMENT_PDF_EXPORT_COLUMNS: ExportColumn<EquipmentInspection>[] = [
  { header: "Date", key: "inspection_date", format: (v) => formatDateForExport(v as string), width: 14 },
  { header: "Type", key: "equipment_type", format: (v) => (v as string) || "N/A", width: 14 },
  { header: "Number", key: "equipment_number", format: (v) => (v as string) || "N/A", width: 16 },
  { header: "By", key: "submitted_by", format: (v) => (v as string) || "Unknown", width: 16 },
  { header: "General Failures", key: "general_checklist", format: (value) => { const failures: string[] = []; const checklist = value as Record<string, ChecklistValue> | null; if (checklist) { for (const item of GENERAL_EQUIPMENT_ITEMS) { if (checklist[item.id] === "F") failures.push(item.label); } } return failures.length > 0 ? failures.join(", ") : "None"; }, width: 32 },
  { header: "Specific Failures", key: "specific_checklist", format: (value, row) => { const failures: string[] = []; const checklist = value as Record<string, ChecklistValue> | null; const templateItems = getSpecificItemsForExport(row.template); if (checklist) { for (const item of templateItems) { if (checklist[item.id] === "F") failures.push(item.label); } } return failures.length > 0 ? failures.join(", ") : "None"; }, width: 32 },
  { header: "Notes", key: "notes", format: (v) => (v as string) || "N/A", width: 28 },
  { header: "Mechanic Notes", key: "mechanic_fixes", format: (v) => (v as string)?.trim() || "N/A", width: 28 },
  { header: "Cost", key: "mechanic_cost", format: (v) => formatCurrency(v as number | null), width: 12 },
  { header: "Created", key: "created_at", format: (v) => formatDateForExport(v as string, true), width: 20 },
];
