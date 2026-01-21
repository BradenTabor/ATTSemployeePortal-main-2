import {
  type DVIRReport,
  type EquipmentInspection,
  type ChecklistItem,
  VEHICLE_TRAILER_ITEMS,
  AERIAL_LIFT_ITEMS,
  SPECIFIC_ITEMS,
} from "./types";

// =============================================================================
// DVIR HELPER FUNCTIONS
// =============================================================================

export function getFailedDVIRItems(report: DVIRReport) {
  const vehicleFails: string[] = [];
  const aerialFails: string[] = [];
  if (report.vehicle_trailer_checklist) {
    for (const item of VEHICLE_TRAILER_ITEMS) {
      if (report.vehicle_trailer_checklist[item.id] === "F") {
        vehicleFails.push(item.label);
      }
    }
  }
  if (report.aerial_checklist) {
    for (const item of AERIAL_LIFT_ITEMS) {
      if (report.aerial_checklist[item.id] === "F") {
        aerialFails.push(item.label);
      }
    }
  }
  return { vehicleFails, aerialFails, allFails: [...vehicleFails, ...aerialFails] };
}

/**
 * Check if a DVIR has checklist failures
 */
export function hasChecklistFailures(report: DVIRReport) {
  const { allFails } = getFailedDVIRItems(report);
  return allFails.length > 0;
}

/**
 * Check if a mechanic has recorded a fix for this DVIR
 */
export function hasMechanicUpdate(report: DVIRReport) {
  return Boolean(report.deficiency_corrected || report.mechanic_remarks || report.mechanic_date);
}

/**
 * Get the effective status of a DVIR:
 * - "failed" = has checklist failures AND no mechanic fix recorded
 * - "passed" = no failures OR mechanic has recorded a fix
 */
export function getDVIRStatus(report: DVIRReport) {
  const hasFailures = hasChecklistFailures(report);
  const hasBeenFixed = hasMechanicUpdate(report);
  
  // If there are no failures, it's passed
  if (!hasFailures) return "passed";
  
  // If there are failures but mechanic recorded a fix, consider it passed (fixed)
  if (hasBeenFixed) return "passed";
  
  // Has failures and no fix recorded = needs review
  return "failed";
}

// =============================================================================
// EQUIPMENT HELPER FUNCTIONS
// =============================================================================

/**
 * Check if an equipment inspection has checklist failures
 */
export function inspectionHasChecklistFailures(inspection: EquipmentInspection) {
  const general = inspection.general_checklist || {};
  const specific = inspection.specific_checklist || {};
  return Object.values(general).some((v) => v === "F") || Object.values(specific).some((v) => v === "F");
}

/**
 * Check if a mechanic has recorded a fix for this equipment inspection
 */
export function equipmentHasMechanicFix(inspection: EquipmentInspection) {
  return Boolean(inspection.mechanic_fixes?.trim());
}

/**
 * Get the effective status of an equipment inspection:
 * - Returns true if needs attention (has failures AND no mechanic fix)
 * - Returns false if OK (no failures OR mechanic has recorded a fix)
 */
export function inspectionNeedsAttention(inspection: EquipmentInspection) {
  const hasFailures = inspectionHasChecklistFailures(inspection);
  const hasBeenFixed = equipmentHasMechanicFix(inspection);
  
  // If there are no failures, doesn't need attention
  if (!hasFailures) return false;
  
  // If there are failures but mechanic recorded a fix, doesn't need attention
  if (hasBeenFixed) return false;
  
  // Has failures and no fix recorded = needs attention
  return true;
}

// Keep the old function name for backwards compatibility but use new logic
export function inspectionHasFailures(inspection: EquipmentInspection) {
  return inspectionNeedsAttention(inspection);
}

export function getSpecificItems(template?: string | null): ChecklistItem[] {
  if (!template) return [];
  return SPECIFIC_ITEMS[template as keyof typeof SPECIFIC_ITEMS] || [];
}

// =============================================================================
// FORMATTING HELPERS
// =============================================================================

export function formatDateTime(iso: string | null | undefined) {
  if (!iso) return "Unknown date";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Get date range start for filtering
 */
export function getDateRangeStart(range: string): string | null {
  const now = new Date();
  switch (range) {
    case "today":
      return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    case "week": {
      const weekAgo = new Date(now);
      weekAgo.setDate(now.getDate() - 7);
      return weekAgo.toISOString();
    }
    case "month": {
      const monthAgo = new Date(now);
      monthAgo.setMonth(now.getMonth() - 1);
      return monthAgo.toISOString();
    }
    default:
      return null;
  }
}
