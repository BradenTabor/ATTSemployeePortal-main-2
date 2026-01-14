/**
 * Vehicle Maintenance Tracking System - Type Definitions
 * 
 * These types map to the database tables created in:
 * supabase/migrations/20260113300000_create_maintenance_tables.sql
 */

// =============================================================================
// ENUMS & CONSTANTS
// =============================================================================

export type MaintenanceType = 
  | 'oil_change'
  | 'tire_rotation'
  | 'tire_replacement'
  | 'repair'
  | 'upgrade'
  | 'part_replacement'
  | 'inspection'
  | 'other';

export type AnomalyType = 
  | 'decrease'
  | 'large_jump'
  | 'impossible_reading'
  | 'stale_data';

export type AnomalySeverity = 'critical' | 'warning' | 'info';

export type UrgencyLevel = 'overdue' | 'due_soon' | 'upcoming' | 'ok';

// =============================================================================
// DATABASE TABLE TYPES
// =============================================================================

/**
 * Part used in a maintenance service
 */
export interface PartUsed {
  part_name: string;
  quantity: number;
  part_number?: string;
  cost?: number;
}

/**
 * Attachment (receipt, photo, document)
 */
export interface MaintenanceAttachment {
  url: string;
  name: string;
  type: 'receipt' | 'photo' | 'document' | 'other';
  uploaded_at?: string;
}

/**
 * Warranty information for a part or service
 */
export interface WarrantyInfo {
  provider?: string;
  expires_at?: string;
  coverage_miles?: number;
  notes?: string;
}

/**
 * Vehicle Maintenance Log entry
 * Maps to: public.vehicle_maintenance_log
 */
export interface MaintenanceLogEntry {
  id: string;
  truck_number: string;
  maintenance_type: MaintenanceType;
  description: string;
  parts_used: PartUsed[];
  mileage_at_service: number;
  next_service_due_mileage?: number | null;
  cost?: number | null;
  performed_by_user_id?: string | null;
  performed_by_name: string;
  approved_by?: string | null;
  service_date: string; // ISO date string (YYYY-MM-DD)
  notes?: string | null;
  attachments: MaintenanceAttachment[];
  warranty_info?: WarrantyInfo | null;
  created_at: string;
  updated_at: string;
}

/**
 * Maintenance Schedule for a vehicle
 * Maps to: public.maintenance_schedules
 */
export interface MaintenanceSchedule {
  id: string;
  truck_number: string;
  
  // Last service tracking
  last_oil_change_mileage: number;
  last_oil_change_date?: string | null;
  last_tire_rotation_mileage: number;
  last_tire_rotation_date?: string | null;
  last_tire_replacement_mileage: number;
  last_tire_replacement_date?: string | null;
  
  // Configurable intervals
  oil_change_interval_miles: number;
  tire_rotation_interval_miles: number;
  tire_replacement_interval_miles: number;
  
  // Cached values
  current_mileage?: number | null;
  current_mileage_date?: string | null;
  
  // AI summary (Phase 2)
  ai_summary?: string | null;
  ai_summary_generated_at?: string | null;
  
  custom_notes?: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Mileage Anomaly record
 * Maps to: public.mileage_anomalies
 */
export interface MileageAnomaly {
  id: string;
  truck_number: string;
  dvir_id?: string | null;
  reported_mileage: number;
  previous_mileage?: number | null;
  expected_range_low?: number | null;
  expected_range_high?: number | null;
  anomaly_type: AnomalyType;
  severity: AnomalySeverity;
  resolved: boolean;
  resolved_by_user_id?: string | null;
  resolution_notes?: string | null;
  resolved_at?: string | null;
  created_at: string;
}

// =============================================================================
// COMPUTED / DERIVED TYPES
// =============================================================================

/**
 * Maintenance status calculation result
 */
export interface MaintenanceStatus {
  type: 'oil_change' | 'tire_rotation' | 'tire_replacement';
  urgency: UrgencyLevel;
  milesSinceLast: number;
  milesUntilDue: number;
  percentageUsed: number;
  lastServiceDate?: string | null;
  lastServiceMileage: number;
  intervalMiles: number;
  message: string;
}

/**
 * Vehicle with calculated maintenance status
 */
export interface VehicleMaintenanceInfo {
  truckNumber: string;
  currentMileage: number;
  currentMileageDate?: string | null;
  lastDvirDate?: string | null;
  
  // Maintenance statuses
  oilChangeStatus: MaintenanceStatus;
  tireRotationStatus: MaintenanceStatus;
  tireReplacementStatus: MaintenanceStatus;
  
  // Overall urgency (highest of all statuses)
  overallUrgency: UrgencyLevel;
  urgentItems: MaintenanceStatus[];
  
  // Recent DVIR failures (for context)
  recentDvirFailures: string[];
  
  // Anomaly info
  hasUnresolvedAnomalies: boolean;
  unresolvedAnomalyCount: number;
  
  // AI summary (Phase 2)
  aiSummary?: string | null;
  aiSummaryGeneratedAt?: string | null;

  // Schedule reference
  schedule: MaintenanceSchedule;
}

/**
 * Mileage history entry from DVIR
 */
export interface MileageHistoryEntry {
  dvir_id: string;
  mileage: number;
  created_at: string;
  drivers_name?: string | null;
  truck_number: string;
}

/**
 * Batched maintenance alert for UI
 */
export interface MaintenanceAlert {
  type: 'oil_change' | 'tire_rotation' | 'tire_replacement';
  urgency: UrgencyLevel;
  trucks: VehicleMaintenanceInfo[];
  count: number;
  message: string;
}

// =============================================================================
// FORM INPUT TYPES
// =============================================================================

/**
 * Input for creating a new maintenance log entry
 */
export interface CreateMaintenanceLogInput {
  truck_number: string;
  maintenance_type: MaintenanceType;
  description: string;
  parts_used?: PartUsed[];
  mileage_at_service: number;
  next_service_due_mileage?: number;
  cost?: number;
  performed_by_name: string;
  approved_by?: string;
  service_date: string;
  notes?: string;
  attachments?: MaintenanceAttachment[];
  warranty_info?: WarrantyInfo;
}

/**
 * Input for resolving a mileage anomaly
 */
export interface ResolveAnomalyInput {
  anomaly_id: string;
  resolution_notes: string;
}

/**
 * Filters for maintenance log list
 */
export interface MaintenanceLogFilters {
  truck_number?: string;
  maintenance_type?: MaintenanceType;
  date_from?: string;
  date_to?: string;
  search?: string;
}

/**
 * Filters for vehicle list with maintenance status
 */
export interface VehicleListFilters {
  search?: string;
  urgency?: UrgencyLevel | 'all';
  maintenance_type?: 'oil_change' | 'tire_rotation' | 'tire_replacement' | 'all';
  has_anomalies?: boolean;
}

// =============================================================================
// UNIFIED FIX TRACKING TYPES (Parts View)
// =============================================================================

/**
 * Source of a fix record
 */
export type FixSource = 'repairs_log' | 'dvir' | 'equipment';

/**
 * Equipment/asset type for categorization
 */
export type AssetType = 'truck' | 'chipper' | 'trailer' | 'equipment';

/**
 * Unified fix record - normalizes data from all 3 sources
 * - vehicle_maintenance_log (repairs log)
 * - dvir_reports (deficiency_corrected)
 * - daily_equipment_inspections (mechanic_fixes)
 */
export interface UnifiedFix {
  id: string;
  source: FixSource;
  source_id: string; // Original record ID from source table
  
  // Asset identification
  asset_type: AssetType;
  asset_number: string; // truck_number, equipment_number, etc.
  
  // Fix details
  description: string;
  deficiencies_corrected?: string[]; // List of specific issues fixed
  parts_used?: PartUsed[];
  
  // Cost tracking
  cost?: number | null;
  estimated_cost?: number | null; // For fixes without explicit cost
  
  // Metadata
  fix_date: string; // ISO date string
  performed_by?: string | null;
  mileage_at_fix?: number | null;
  notes?: string | null;
  
  // Timestamps
  created_at: string;
  updated_at?: string;
}

/**
 * Aggregated stats per vehicle/equipment
 */
export interface AssetFixStats {
  asset_type: AssetType;
  asset_number: string;
  total_fixes: number;
  total_cost: number;
  estimated_cost: number;
  last_fix_date: string | null;
  most_common_issues: string[];
  parts_count: number;
  current_mileage?: number | null;
}

/**
 * Filters for unified fix list
 */
export interface UnifiedFixFilters {
  search?: string;
  asset_type?: AssetType | 'all';
  source?: FixSource | 'all';
  date_from?: string;
  date_to?: string;
  cost_min?: number;
  cost_max?: number;
  asset_number?: string;
}

/**
 * AI summary for fixes
 */
export interface FixesAiSummary {
  summary: string;
  recent_fixes_count: number;
  total_cost_30_days: number;
  total_cost_all_time: number;
  top_fixed_assets: {
    asset_number: string;
    asset_type: AssetType;
    fix_count: number;
    total_cost: number;
  }[];
  common_deficiencies: {
    issue: string;
    count: number;
  }[];
  parts_breakdown: {
    part_name: string;
    total_quantity: number;
    total_cost: number;
  }[];
  generated_at: string;
  cached: boolean;
}

// =============================================================================
// API RESPONSE TYPES
// =============================================================================

/**
 * Paginated response wrapper
 */
export interface PaginatedResponse<T> {
  data: T[];
  count: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * Fleet summary stats
 */
export interface FleetMaintenanceStats {
  totalVehicles: number;
  overdueCount: number;
  dueSoonCount: number;
  upcomingCount: number;
  okCount: number;
  unresolvedAnomaliesCount: number;
  maintenanceLogsThisMonth: number;
}
