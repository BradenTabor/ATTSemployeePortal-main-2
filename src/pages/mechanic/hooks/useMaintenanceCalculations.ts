/**
 * Maintenance Calculations Hook
 * 
 * Calculates maintenance status for vehicles based on mileage and service history.
 * Determines urgency levels for oil changes, tire rotations, and tire replacements.
 */

import { useMemo } from 'react';
import type {
  MaintenanceSchedule,
  MaintenanceStatus,
  VehicleMaintenanceInfo,
  UrgencyLevel,
  FleetMaintenanceStats,
} from '../types/maintenance.types';
import {
  MAINTENANCE_INTERVALS,
  getUrgencyLevel,
  URGENCY_CONFIG,
} from '../utils/maintenanceConstants';

// =============================================================================
// CALCULATION FUNCTIONS
// =============================================================================

/**
 * Calculate maintenance status for a single maintenance type
 */
export function calculateMaintenanceStatus(
  type: 'oil_change' | 'tire_rotation' | 'tire_replacement',
  currentMileage: number,
  lastServiceMileage: number,
  lastServiceDate: string | null | undefined,
  intervalMiles: number
): MaintenanceStatus {
  const milesSinceLast = Math.max(0, currentMileage - lastServiceMileage);
  const milesUntilDue = Math.max(0, intervalMiles - milesSinceLast);
  const percentageUsed = intervalMiles > 0 ? (milesSinceLast / intervalMiles) * 100 : 0;
  const urgency = getUrgencyLevel(percentageUsed);
  
  // Generate human-readable message
  let message: string;
  if (percentageUsed >= 100) {
    const overdueMiles = milesSinceLast - intervalMiles;
    message = `Overdue by ${overdueMiles.toLocaleString()} miles`;
  } else if (percentageUsed >= 80) {
    message = `Due in ${milesUntilDue.toLocaleString()} miles`;
  } else if (percentageUsed >= 60) {
    message = `${milesUntilDue.toLocaleString()} miles until due`;
  } else {
    message = `${milesUntilDue.toLocaleString()} miles remaining`;
  }
  
  return {
    type,
    urgency,
    milesSinceLast,
    milesUntilDue,
    percentageUsed,
    lastServiceDate,
    lastServiceMileage,
    intervalMiles,
    message,
  };
}

/**
 * Calculate all maintenance statuses for a vehicle
 */
export function calculateVehicleMaintenanceInfo(
  schedule: MaintenanceSchedule,
  recentDvirFailures: string[] = [],
  unresolvedAnomalyCount: number = 0
): VehicleMaintenanceInfo {
  const currentMileage = schedule.current_mileage ?? 0;
  
  // Calculate individual maintenance statuses
  const oilChangeStatus = calculateMaintenanceStatus(
    'oil_change',
    currentMileage,
    schedule.last_oil_change_mileage ?? 0,
    schedule.last_oil_change_date,
    schedule.oil_change_interval_miles ?? MAINTENANCE_INTERVALS.OIL_CHANGE_DEFAULT
  );
  
  const tireRotationStatus = calculateMaintenanceStatus(
    'tire_rotation',
    currentMileage,
    schedule.last_tire_rotation_mileage ?? 0,
    schedule.last_tire_rotation_date,
    schedule.tire_rotation_interval_miles ?? MAINTENANCE_INTERVALS.TIRE_ROTATION_DEFAULT
  );
  
  const tireReplacementStatus = calculateMaintenanceStatus(
    'tire_replacement',
    currentMileage,
    schedule.last_tire_replacement_mileage ?? 0,
    schedule.last_tire_replacement_date,
    schedule.tire_replacement_interval_miles ?? MAINTENANCE_INTERVALS.TIRE_REPLACEMENT_DEFAULT
  );
  
  // Determine overall urgency (highest priority among all statuses)
  const statuses = [oilChangeStatus, tireRotationStatus, tireReplacementStatus];
  const urgentItems = statuses.filter(s => s.urgency === 'overdue' || s.urgency === 'due_soon');
  
  const overallUrgency: UrgencyLevel = statuses.reduce((highest, status) => {
    if (URGENCY_CONFIG[status.urgency].priority < URGENCY_CONFIG[highest].priority) {
      return status.urgency;
    }
    return highest;
  }, 'ok' as UrgencyLevel);
  
  return {
    truckNumber: schedule.truck_number,
    currentMileage,
    currentMileageDate: schedule.current_mileage_date,
    lastDvirDate: schedule.current_mileage_date,
    oilChangeStatus,
    tireRotationStatus,
    tireReplacementStatus,
    overallUrgency,
    urgentItems,
    recentDvirFailures,
    hasUnresolvedAnomalies: unresolvedAnomalyCount > 0,
    unresolvedAnomalyCount,
    aiSummary: schedule.ai_summary,
    aiSummaryGeneratedAt: schedule.ai_summary_generated_at,
    schedule,
  };
}

/**
 * Calculate fleet-wide maintenance statistics
 */
export function calculateFleetStats(vehicles: VehicleMaintenanceInfo[]): FleetMaintenanceStats {
  const stats: FleetMaintenanceStats = {
    totalVehicles: vehicles.length,
    overdueCount: 0,
    dueSoonCount: 0,
    upcomingCount: 0,
    okCount: 0,
    unresolvedAnomaliesCount: 0,
    maintenanceLogsThisMonth: 0, // This would need to be passed in separately
  };
  
  for (const vehicle of vehicles) {
    switch (vehicle.overallUrgency) {
      case 'overdue':
        stats.overdueCount++;
        break;
      case 'due_soon':
        stats.dueSoonCount++;
        break;
      case 'upcoming':
        stats.upcomingCount++;
        break;
      case 'ok':
        stats.okCount++;
        break;
    }
    stats.unresolvedAnomaliesCount += vehicle.unresolvedAnomalyCount;
  }
  
  return stats;
}

/**
 * Group vehicles by urgency level
 */
export function groupVehiclesByUrgency(vehicles: VehicleMaintenanceInfo[]): Record<UrgencyLevel, VehicleMaintenanceInfo[]> {
  const groups: Record<UrgencyLevel, VehicleMaintenanceInfo[]> = {
    overdue: [],
    due_soon: [],
    upcoming: [],
    ok: [],
  };
  
  for (const vehicle of vehicles) {
    groups[vehicle.overallUrgency].push(vehicle);
  }
  
  return groups;
}

/**
 * Get batched maintenance alerts (e.g., "3 trucks need oil changes")
 */
export function getBatchedAlerts(vehicles: VehicleMaintenanceInfo[]): {
  type: 'oil_change' | 'tire_rotation' | 'tire_replacement';
  urgency: UrgencyLevel;
  count: number;
  trucks: string[];
}[] {
  const alerts: Map<string, {
    type: 'oil_change' | 'tire_rotation' | 'tire_replacement';
    urgency: UrgencyLevel;
    trucks: string[];
  }> = new Map();
  
  for (const vehicle of vehicles) {
    const statuses = [
      vehicle.oilChangeStatus,
      vehicle.tireRotationStatus,
      vehicle.tireReplacementStatus,
    ];
    
    for (const status of statuses) {
      if (status.urgency === 'overdue' || status.urgency === 'due_soon') {
        const key = `${status.type}-${status.urgency}`;
        const existing = alerts.get(key);
        if (existing) {
          existing.trucks.push(vehicle.truckNumber);
        } else {
          alerts.set(key, {
            type: status.type,
            urgency: status.urgency,
            trucks: [vehicle.truckNumber],
          });
        }
      }
    }
  }
  
  return Array.from(alerts.values())
    .map(alert => ({
      ...alert,
      count: alert.trucks.length,
    }))
    .sort((a, b) => {
      // Sort by urgency first, then by count
      const urgencyDiff = URGENCY_CONFIG[a.urgency].priority - URGENCY_CONFIG[b.urgency].priority;
      if (urgencyDiff !== 0) return urgencyDiff;
      return b.count - a.count;
    });
}

// =============================================================================
// REACT HOOK
// =============================================================================

interface UseMaintenanceCalculationsProps {
  schedules: MaintenanceSchedule[];
  anomalyCounts?: Record<string, number>; // truck_number -> unresolved count
  dvirFailures?: Record<string, string[]>; // truck_number -> failure labels
}

interface UseMaintenanceCalculationsResult {
  vehicles: VehicleMaintenanceInfo[];
  stats: FleetMaintenanceStats;
  groupedByUrgency: Record<UrgencyLevel, VehicleMaintenanceInfo[]>;
  batchedAlerts: ReturnType<typeof getBatchedAlerts>;
  overdueVehicles: VehicleMaintenanceInfo[];
  dueSoonVehicles: VehicleMaintenanceInfo[];
}

/**
 * Hook for calculating maintenance status across a fleet
 */
export function useMaintenanceCalculations({
  schedules,
  anomalyCounts = {},
  dvirFailures = {},
}: UseMaintenanceCalculationsProps): UseMaintenanceCalculationsResult {
  return useMemo(() => {
    // Calculate maintenance info for each vehicle
    const vehicles = schedules.map(schedule => 
      calculateVehicleMaintenanceInfo(
        schedule,
        dvirFailures[schedule.truck_number] ?? [],
        anomalyCounts[schedule.truck_number] ?? 0
      )
    );
    
    // Sort by urgency
    vehicles.sort((a, b) => 
      URGENCY_CONFIG[a.overallUrgency].priority - URGENCY_CONFIG[b.overallUrgency].priority
    );
    
    // Calculate stats and groupings
    const stats = calculateFleetStats(vehicles);
    const groupedByUrgency = groupVehiclesByUrgency(vehicles);
    const batchedAlerts = getBatchedAlerts(vehicles);
    
    return {
      vehicles,
      stats,
      groupedByUrgency,
      batchedAlerts,
      overdueVehicles: groupedByUrgency.overdue,
      dueSoonVehicles: groupedByUrgency.due_soon,
    };
  }, [schedules, anomalyCounts, dvirFailures]);
}

export default useMaintenanceCalculations;
