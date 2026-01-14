/**
 * Mechanic Hooks Index
 * 
 * Re-exports all maintenance-related hooks for cleaner imports.
 */

export { useMaintenanceCalculations, calculateVehicleMaintenanceInfo, calculateFleetStats } from './useMaintenanceCalculations';
export { useMaintenanceData, fetchMaintenanceSchedules, fetchMaintenanceLogs, fetchMileageHistory, createMaintenanceLog } from './useMaintenanceData';
export { useUnifiedFixes, generateFixesAiSummary } from './useUnifiedFixes';
