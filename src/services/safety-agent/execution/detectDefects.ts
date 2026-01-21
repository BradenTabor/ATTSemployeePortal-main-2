/**
 * Defect Detection Execution Script
 * 
 * Scans DVIR and Equipment Inspection checklists for failed items (false values)
 * and classifies them by severity for mechanic notification (Jidoka).
 * 
 * @see directives/admin_safety_forecast_6_30am.md
 */

import type { SupabaseClient } from '@supabase/supabase-js';

// ============================================================================
// Type Definitions
// ============================================================================

export interface DefectAlert {
  id: string;                    // Unique identifier for this defect
  truck_number?: string;         // For vehicle defects
  equipment_number?: string;     // For equipment defects
  equipment_type: 'vehicle' | 'equipment' | 'trailer' | 'aerial';
  defect_items: string[];        // List of failed checklist items
  severity: 'critical' | 'warning';
  reported_by: string;           // User ID who reported
  reported_by_name?: string;     // Full name (optional, for display)
  reported_at: Date;
  source_table: 'dvir_reports' | 'daily_equipment_inspections';
  source_id: string;             // ID in source table
}

// Critical defect keywords that elevate severity
const CRITICAL_KEYWORDS = [
  'brake',
  'steering',
  'hydraulic',
  'electrical',
  'lights',
  'tire',
  'horn',
  'mirror',
  'seatbelt',
  'pto',
  'outrigger',
  'boom',
  'winch',
  'emergency',
  'fire extinguisher',
];

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if a defect item is critical based on keywords
 */
export function isCriticalDefect(item: string): boolean {
  const lowerItem = item.toLowerCase();
  return CRITICAL_KEYWORDS.some((kw) => lowerItem.includes(kw));
}

/**
 * Format a checklist key for display (snake_case to Title Case)
 */
export function formatChecklistKey(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Extract failed items from a checklist object
 */
function extractFailedItems(
  checklist: Record<string, boolean | unknown> | null,
  excludeKeys: string[] = ['na_items', 'not_applicable']
): string[] {
  if (!checklist || typeof checklist !== 'object') return [];

  return Object.entries(checklist)
    .filter(([key, value]) => {
      // Only include items that are explicitly false
      if (typeof value !== 'boolean') return false;
      if (value !== false) return false;
      if (excludeKeys.includes(key)) return false;
      return true;
    })
    .map(([key]) => formatChecklistKey(key));
}

/**
 * Determine severity based on failed items
 */
function determineSeverity(items: string[]): 'critical' | 'warning' {
  return items.some(isCriticalDefect) ? 'critical' : 'warning';
}

// ============================================================================
// DVIR Defect Detection
// ============================================================================

interface DVIRReport {
  id: string;
  truck_number: string;
  vehicle_trailer_checklist: Record<string, boolean> | null;
  aerial_checklist: Record<string, boolean> | null;
  user_id: string;
  created_at: string;
}

/**
 * Detect defects from DVIR (Daily Vehicle Inspection Reports)
 * 
 * @param supabase Supabase client
 * @param since Only check reports created after this date
 * @returns Array of defect alerts
 */
export async function detectDefectsFromDVIR(
  supabase: SupabaseClient,
  since: Date
): Promise<DefectAlert[]> {
  const { data: reports, error } = await supabase
    .from('dvir_reports')
    .select('id, truck_number, vehicle_trailer_checklist, aerial_checklist, user_id, created_at')
    .gte('created_at', since.toISOString())
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching DVIR reports:', error);
    throw error;
  }

  const defects: DefectAlert[] = [];

  for (const report of (reports as DVIRReport[]) || []) {
    // Check vehicle/trailer checklist
    const vehicleFailedItems = extractFailedItems(report.vehicle_trailer_checklist);
    if (vehicleFailedItems.length > 0) {
      defects.push({
        id: `dvir-vehicle-${report.id}`,
        truck_number: report.truck_number,
        equipment_type: 'vehicle',
        defect_items: vehicleFailedItems,
        severity: determineSeverity(vehicleFailedItems),
        reported_by: report.user_id,
        reported_at: new Date(report.created_at),
        source_table: 'dvir_reports',
        source_id: report.id,
      });
    }

    // Check aerial checklist
    const aerialFailedItems = extractFailedItems(report.aerial_checklist);
    if (aerialFailedItems.length > 0) {
      defects.push({
        id: `dvir-aerial-${report.id}`,
        truck_number: report.truck_number,
        equipment_type: 'aerial',
        defect_items: aerialFailedItems,
        severity: determineSeverity(aerialFailedItems),
        reported_by: report.user_id,
        reported_at: new Date(report.created_at),
        source_table: 'dvir_reports',
        source_id: report.id,
      });
    }
  }

  return defects;
}

// ============================================================================
// Equipment Inspection Defect Detection
// ============================================================================

interface EquipmentInspection {
  id: string;
  equipment_type: string;
  equipment_number: string;
  general_checklist: Record<string, boolean> | null;
  specific_checklist: Record<string, boolean> | null;
  user_id: string;
  created_at: string;
}

/**
 * Detect defects from Daily Equipment Inspections
 * 
 * @param supabase Supabase client
 * @param since Only check inspections created after this date
 * @returns Array of defect alerts
 */
export async function detectDefectsFromEquipment(
  supabase: SupabaseClient,
  since: Date
): Promise<DefectAlert[]> {
  const { data: inspections, error } = await supabase
    .from('daily_equipment_inspections')
    .select('id, equipment_type, equipment_number, general_checklist, specific_checklist, user_id, created_at')
    .gte('created_at', since.toISOString())
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching equipment inspections:', error);
    throw error;
  }

  const defects: DefectAlert[] = [];

  for (const inspection of (inspections as EquipmentInspection[]) || []) {
    // Combine general and specific checklists
    const generalFailedItems = extractFailedItems(inspection.general_checklist);
    const specificFailedItems = extractFailedItems(inspection.specific_checklist);
    const allFailedItems = [...generalFailedItems, ...specificFailedItems];

    if (allFailedItems.length > 0) {
      defects.push({
        id: `equipment-${inspection.id}`,
        equipment_number: inspection.equipment_number,
        equipment_type: 'equipment',
        defect_items: allFailedItems,
        severity: determineSeverity(allFailedItems),
        reported_by: inspection.user_id,
        reported_at: new Date(inspection.created_at),
        source_table: 'daily_equipment_inspections',
        source_id: inspection.id,
      });
    }
  }

  return defects;
}

// ============================================================================
// Combined Detection
// ============================================================================

/**
 * Detect all defects from both DVIR and Equipment Inspections
 * 
 * @param supabase Supabase client
 * @param since Only check reports/inspections created after this date
 * @returns Combined array of defect alerts, sorted by severity then date
 */
export async function detectAllDefects(
  supabase: SupabaseClient,
  since: Date
): Promise<DefectAlert[]> {
  const [dvirDefects, equipmentDefects] = await Promise.all([
    detectDefectsFromDVIR(supabase, since),
    detectDefectsFromEquipment(supabase, since),
  ]);

  const allDefects = [...dvirDefects, ...equipmentDefects];

  // Sort by severity (critical first), then by date (newest first)
  allDefects.sort((a, b) => {
    if (a.severity === 'critical' && b.severity !== 'critical') return -1;
    if (a.severity !== 'critical' && b.severity === 'critical') return 1;
    return b.reported_at.getTime() - a.reported_at.getTime();
  });

  return allDefects;
}

/**
 * Get defect statistics for a time period
 */
export async function getDefectStats(
  supabase: SupabaseClient,
  since: Date
): Promise<{
  total: number;
  critical: number;
  warning: number;
  byEquipmentType: Record<string, number>;
}> {
  const defects = await detectAllDefects(supabase, since);

  const stats = {
    total: defects.length,
    critical: defects.filter((d) => d.severity === 'critical').length,
    warning: defects.filter((d) => d.severity === 'warning').length,
    byEquipmentType: {} as Record<string, number>,
  };

  for (const defect of defects) {
    const type = defect.equipment_type;
    stats.byEquipmentType[type] = (stats.byEquipmentType[type] || 0) + 1;
  }

  return stats;
}

/**
 * Enrich defects with reporter names
 */
export async function enrichDefectsWithNames(
  supabase: SupabaseClient,
  defects: DefectAlert[]
): Promise<DefectAlert[]> {
  // Get unique user IDs
  const userIds = [...new Set(defects.map((d) => d.reported_by))];

  if (userIds.length === 0) return defects;

  // Fetch user names
  const { data: users } = await supabase
    .from('app_users')
    .select('user_id, full_name')
    .in('user_id', userIds);

  const nameMap = new Map(
    (users || []).map((u) => [u.user_id, u.full_name || 'Unknown'])
  );

  // Enrich defects
  return defects.map((defect) => ({
    ...defect,
    reported_by_name: nameMap.get(defect.reported_by) || 'Unknown',
  }));
}

/**
 * Filter defects by truck numbers (for crew-specific risk calculation)
 */
export function filterDefectsByTrucks(
  defects: DefectAlert[],
  truckNumbers: string[]
): DefectAlert[] {
  if (truckNumbers.length === 0) return [];

  const truckSet = new Set(truckNumbers.map((t) => t.toLowerCase()));

  return defects.filter((defect) => {
    if (!defect.truck_number) return false;
    return truckSet.has(defect.truck_number.toLowerCase());
  });
}

/**
 * Get critical defect descriptions for risk score calculation
 */
export function getCriticalDefectDescriptions(defects: DefectAlert[]): string[] {
  return defects
    .filter((d) => d.severity === 'critical')
    .flatMap((d) => {
      const prefix = d.truck_number ? `Truck ${d.truck_number}` : d.equipment_number || 'Equipment';
      return d.defect_items.filter(isCriticalDefect).map((item) => `${prefix}: ${item}`);
    });
}

/**
 * Get warning defect descriptions for risk score calculation
 */
export function getWarningDefectDescriptions(defects: DefectAlert[]): string[] {
  return defects
    .filter((d) => d.severity === 'warning')
    .flatMap((d) => {
      const prefix = d.truck_number ? `Truck ${d.truck_number}` : d.equipment_number || 'Equipment';
      return d.defect_items.filter((item) => !isCriticalDefect(item)).map((item) => `${prefix}: ${item}`);
    });
}
