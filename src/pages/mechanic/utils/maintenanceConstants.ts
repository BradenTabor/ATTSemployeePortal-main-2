/**
 * Vehicle Maintenance Constants & Configuration
 * 
 * Based on fleet industry research:
 * - Oil Change: 5,000-7,500 miles (Ford 6.7L diesel: 5,000-7,500)
 * - Tire Rotation: 5,000-6,000 miles (city: 5,000, highway: 7,000)
 * - Tire Replacement: 40,000-60,000 miles for all-terrain truck tires
 *   (commercial fleet use, mixed terrain, heavy loads)
 */

import type { MaintenanceType, UrgencyLevel, AnomalySeverity } from '../types/maintenance.types';

// =============================================================================
// MAINTENANCE INTERVALS (Miles)
// =============================================================================

export const MAINTENANCE_INTERVALS = {
  /** Default oil change interval in miles (conservative) */
  OIL_CHANGE_DEFAULT: 5000,
  OIL_CHANGE_MIN: 3000,
  OIL_CHANGE_MAX: 7500,
  
  /** Default tire rotation interval in miles */
  TIRE_ROTATION_DEFAULT: 6000,
  TIRE_ROTATION_MIN: 5000,
  TIRE_ROTATION_MAX: 8000,
  
  /** Default tire replacement interval in miles (all-terrain truck tires) */
  TIRE_REPLACEMENT_DEFAULT: 50000,
  TIRE_REPLACEMENT_MIN: 30000,
  TIRE_REPLACEMENT_MAX: 60000,
} as const;

// =============================================================================
// URGENCY THRESHOLDS (Percentage of interval used)
// =============================================================================

export const URGENCY_THRESHOLDS = {
  /** Overdue: > 100% of interval */
  OVERDUE: 100,
  /** Due soon: 80-100% of interval */
  DUE_SOON: 80,
  /** Upcoming: 60-80% of interval */
  UPCOMING: 60,
  /** OK: < 60% of interval */
  OK: 0,
} as const;

// =============================================================================
// MILEAGE ANOMALY DETECTION
// =============================================================================

export const ANOMALY_DETECTION = {
  /** Flag as suspicious if mileage jump > this per day */
  MAX_MILES_PER_DAY: 2000,
  
  /** Flag as stale if no DVIR in this many days */
  STALE_DATA_DAYS: 30,
  
  /** Maximum realistic mileage (odometer rollover detection) */
  MAX_REALISTIC_MILEAGE: 999999,
  
  /** Minimum valid mileage */
  MIN_VALID_MILEAGE: 0,
  
  /** Threshold for typo detection (difference from expected pattern) */
  TYPO_DETECTION_THRESHOLD: 0.1, // 10% difference
} as const;

// =============================================================================
// UI CONFIGURATION
// =============================================================================

export const UI_CONFIG = {
  /** Items per page for pagination */
  PAGE_SIZE: 15,
  
  /** Max items to show in urgent/recommended sections */
  MAX_URGENT_ITEMS: 10,
  MAX_RECOMMENDED_ITEMS: 10,
  
  /** Number of mileage history entries to show */
  MILEAGE_HISTORY_COUNT: 10,
  
  /** Debounce delay for search input (ms) */
  SEARCH_DEBOUNCE_MS: 300,
  
  /** Auto-refresh interval for dashboard (ms) - 5 minutes */
  AUTO_REFRESH_MS: 5 * 60 * 1000,
} as const;

// =============================================================================
// MAINTENANCE TYPE LABELS & ICONS
// =============================================================================

export const MAINTENANCE_TYPE_CONFIG: Record<MaintenanceType, {
  label: string;
  shortLabel: string;
  description: string;
  icon: string; // Lucide icon name
  color: string;
}> = {
  oil_change: {
    label: 'Oil Change',
    shortLabel: 'Oil',
    description: 'Engine oil and filter replacement',
    icon: 'Droplet',
    color: 'amber',
  },
  tire_rotation: {
    label: 'Tire Rotation',
    shortLabel: 'Rotation',
    description: 'Rotate tires for even wear',
    icon: 'RefreshCw',
    color: 'blue',
  },
  tire_replacement: {
    label: 'Tire Replacement',
    shortLabel: 'New Tires',
    description: 'Replace worn tires',
    icon: 'Circle',
    color: 'purple',
  },
  repair: {
    label: 'Repair',
    shortLabel: 'Repair',
    description: 'Fix a deficiency or issue',
    icon: 'Wrench',
    color: 'red',
  },
  upgrade: {
    label: 'Upgrade',
    shortLabel: 'Upgrade',
    description: 'Performance or safety upgrade',
    icon: 'ArrowUp',
    color: 'green',
  },
  part_replacement: {
    label: 'Part Replacement',
    shortLabel: 'Parts',
    description: 'Replace worn or damaged parts',
    icon: 'Package',
    color: 'orange',
  },
  inspection: {
    label: 'Inspection',
    shortLabel: 'Inspect',
    description: 'Routine inspection',
    icon: 'Search',
    color: 'cyan',
  },
  other: {
    label: 'Other',
    shortLabel: 'Other',
    description: 'Other maintenance activity',
    icon: 'MoreHorizontal',
    color: 'gray',
  },
};

// =============================================================================
// URGENCY LEVEL CONFIGURATION
// =============================================================================

export const URGENCY_CONFIG: Record<UrgencyLevel, {
  label: string;
  description: string;
  bgColor: string;
  textColor: string;
  borderColor: string;
  iconColor: string;
  priority: number; // Lower = more urgent
}> = {
  overdue: {
    label: 'Overdue',
    description: 'Maintenance is past due',
    bgColor: 'bg-red-500/15',
    textColor: 'text-red-300',
    borderColor: 'border-red-500/30',
    iconColor: 'text-red-400',
    priority: 1,
  },
  due_soon: {
    label: 'Due Soon',
    description: 'Maintenance needed this week',
    bgColor: 'bg-amber-500/15',
    textColor: 'text-amber-300',
    borderColor: 'border-amber-500/30',
    iconColor: 'text-amber-400',
    priority: 2,
  },
  upcoming: {
    label: 'Upcoming',
    description: 'Maintenance coming up',
    bgColor: 'bg-blue-500/15',
    textColor: 'text-blue-300',
    borderColor: 'border-blue-500/30',
    iconColor: 'text-blue-400',
    priority: 3,
  },
  ok: {
    label: 'OK',
    description: 'No maintenance needed',
    bgColor: 'bg-emerald-500/15',
    textColor: 'text-emerald-300',
    borderColor: 'border-emerald-500/30',
    iconColor: 'text-emerald-400',
    priority: 4,
  },
};

// =============================================================================
// ANOMALY SEVERITY CONFIGURATION
// =============================================================================

export const ANOMALY_SEVERITY_CONFIG: Record<AnomalySeverity, {
  label: string;
  description: string;
  bgColor: string;
  textColor: string;
  borderColor: string;
}> = {
  critical: {
    label: 'Critical',
    description: 'Requires immediate attention',
    bgColor: 'bg-red-500/20',
    textColor: 'text-red-300',
    borderColor: 'border-red-500/40',
  },
  warning: {
    label: 'Warning',
    description: 'Should be reviewed',
    bgColor: 'bg-amber-500/20',
    textColor: 'text-amber-300',
    borderColor: 'border-amber-500/40',
  },
  info: {
    label: 'Info',
    description: 'For your information',
    bgColor: 'bg-blue-500/20',
    textColor: 'text-blue-300',
    borderColor: 'border-blue-500/40',
  },
};

// =============================================================================
// TRUCK NUMBERS (from DVIRForm.tsx)
// =============================================================================

export const TRUCK_NUMBERS = [
  'B132',
  'B103',
  'B114',
  'B122',
  'B124',
  'B137',
  'B151',
  '158',
  '149',
  '147',
  '104',
  '155',
  '156',
  '139',
  '141',
  '125',
] as const;

export type TruckNumber = typeof TRUCK_NUMBERS[number];

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Normalize truck number (uppercase, trim)
 */
export function normalizeTruckNumber(truckNumber: string): string {
  return truckNumber.toUpperCase().trim();
}

/**
 * Get urgency level based on percentage of interval used
 */
export function getUrgencyLevel(percentageUsed: number): UrgencyLevel {
  if (percentageUsed >= URGENCY_THRESHOLDS.OVERDUE) return 'overdue';
  if (percentageUsed >= URGENCY_THRESHOLDS.DUE_SOON) return 'due_soon';
  if (percentageUsed >= URGENCY_THRESHOLDS.UPCOMING) return 'upcoming';
  return 'ok';
}

/**
 * Format mileage for display (with commas)
 */
export function formatMileage(mileage: number | null | undefined): string {
  if (mileage == null) return '—';
  return mileage.toLocaleString('en-US');
}

/**
 * Format date for display
 */
export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return '—';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Format datetime for display
 */
export function formatDateTime(dateString: string | null | undefined): string {
  if (!dateString) return '—';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Format cost for display
 */
export function formatCost(cost: number | null | undefined): string {
  if (cost == null) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cost);
}

/**
 * Get days since a date
 */
export function getDaysSince(dateString: string | null | undefined): number | null {
  if (!dateString) return null;
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return null;
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Get maintenance type config
 */
export function getMaintenanceTypeConfig(type: MaintenanceType) {
  return MAINTENANCE_TYPE_CONFIG[type];
}

/**
 * Get urgency config
 */
export function getUrgencyConfig(urgency: UrgencyLevel) {
  return URGENCY_CONFIG[urgency];
}

/**
 * Sort vehicles by urgency (most urgent first)
 */
export function sortByUrgency<T extends { overallUrgency: UrgencyLevel }>(vehicles: T[]): T[] {
  return [...vehicles].sort((a, b) => {
    return URGENCY_CONFIG[a.overallUrgency].priority - URGENCY_CONFIG[b.overallUrgency].priority;
  });
}
