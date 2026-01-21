import type { DVIRReport, EquipmentInspection } from "./types";
import { VEHICLE_TRAILER_ITEMS, AERIAL_LIFT_ITEMS, SPECIFIC_ITEMS } from "./types";

// =============================================================================
// HELPER FUNCTIONS
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

export function getDVIRStatus(report: DVIRReport) {
  const { allFails } = getFailedDVIRItems(report);
  return allFails.length > 0 ? "failed" : "passed";
}

export function hasMechanicUpdate(report: DVIRReport) {
  return Boolean(report.deficiency_corrected || report.mechanic_remarks || report.mechanic_date);
}

export function inspectionHasFailures(inspection: EquipmentInspection) {
  const general = inspection.general_checklist || {};
  const specific = inspection.specific_checklist || {};
  return Object.values(general).some((v) => v === "F") || Object.values(specific).some((v) => v === "F");
}

export function getSpecificItems(template?: string | null) {
  if (!template) return [];
  return SPECIFIC_ITEMS[template as keyof typeof SPECIFIC_ITEMS] || [];
}

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

export function getDateRangeStart(range: string) {
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
