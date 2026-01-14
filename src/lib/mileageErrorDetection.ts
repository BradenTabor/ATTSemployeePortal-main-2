/**
 * Mileage Error Detection Utility
 * 
 * Detects anomalies in odometer readings to identify potential input errors:
 * - decrease: Mileage went down (impossible unless odometer reset/replaced)
 * - large_jump: Unrealistic mileage increase per day
 * - impossible_reading: Negative or impossibly high value
 * - stale_data: No DVIR submission in too long (truck inactive?)
 */

import type { AnomalyType, AnomalySeverity, MileageHistoryEntry } from '../pages/mechanic/types/maintenance.types';

// =============================================================================
// CONSTANTS
// =============================================================================

const ANOMALY_CONFIG = {
  /** Flag as suspicious if mileage jump > this per day */
  MAX_MILES_PER_DAY: 2000,
  
  /** Flag as stale if no DVIR in this many days */
  STALE_DATA_DAYS: 30,
  
  /** Maximum realistic mileage */
  MAX_REALISTIC_MILEAGE: 999999,
  
  /** Minimum valid mileage */
  MIN_VALID_MILEAGE: 0,
  
  /** Threshold for detecting significant drops that might be typos */
  TYPO_THRESHOLD_PERCENT: 10,
} as const;

// =============================================================================
// TYPES
// =============================================================================

export interface DetectedAnomaly {
  type: AnomalyType;
  severity: AnomalySeverity;
  message: string;
  reportedMileage: number;
  previousMileage?: number;
  expectedRangeLow?: number;
  expectedRangeHigh?: number;
  autoResolve: boolean;
}

export interface MileageValidationResult {
  isValid: boolean;
  anomalies: DetectedAnomaly[];
  warnings: string[];
}

// =============================================================================
// DETECTION FUNCTIONS
// =============================================================================

/**
 * Check if mileage value is within valid range
 */
export function isValidMileageValue(mileage: number): boolean {
  return (
    typeof mileage === 'number' &&
    !isNaN(mileage) &&
    mileage >= ANOMALY_CONFIG.MIN_VALID_MILEAGE &&
    mileage <= ANOMALY_CONFIG.MAX_REALISTIC_MILEAGE
  );
}

/**
 * Detect if mileage decreased from previous reading
 */
export function detectDecrease(
  currentMileage: number,
  previousMileage: number
): DetectedAnomaly | null {
  if (currentMileage < previousMileage) {
    const decrease = previousMileage - currentMileage;
    const percentDecrease = (decrease / previousMileage) * 100;
    
    // Large decrease is critical (likely error), small decrease might be typo
    const severity: AnomalySeverity = percentDecrease > 10 ? 'critical' : 'warning';
    
    return {
      type: 'decrease',
      severity,
      message: `Mileage decreased by ${decrease.toLocaleString()} miles (${percentDecrease.toFixed(1)}%)`,
      reportedMileage: currentMileage,
      previousMileage,
      expectedRangeLow: previousMileage,
      expectedRangeHigh: undefined,
      autoResolve: false,
    };
  }
  return null;
}

/**
 * Detect unrealistic large jumps in mileage
 */
export function detectLargeJump(
  currentMileage: number,
  previousMileage: number,
  daysBetween: number
): DetectedAnomaly | null {
  if (daysBetween <= 0) return null;
  
  const mileageIncrease = currentMileage - previousMileage;
  const milesPerDay = mileageIncrease / daysBetween;
  
  if (milesPerDay > ANOMALY_CONFIG.MAX_MILES_PER_DAY) {
    const expectedMax = previousMileage + (ANOMALY_CONFIG.MAX_MILES_PER_DAY * daysBetween);
    
    return {
      type: 'large_jump',
      severity: 'warning',
      message: `Suspicious mileage increase: ${mileageIncrease.toLocaleString()} miles in ${daysBetween} days (${Math.round(milesPerDay)} mi/day)`,
      reportedMileage: currentMileage,
      previousMileage,
      expectedRangeLow: previousMileage,
      expectedRangeHigh: expectedMax,
      autoResolve: false,
    };
  }
  return null;
}

/**
 * Detect impossible mileage readings
 */
export function detectImpossibleReading(mileage: number): DetectedAnomaly | null {
  if (mileage < ANOMALY_CONFIG.MIN_VALID_MILEAGE) {
    return {
      type: 'impossible_reading',
      severity: 'critical',
      message: `Invalid mileage: ${mileage} (negative value)`,
      reportedMileage: mileage,
      expectedRangeLow: ANOMALY_CONFIG.MIN_VALID_MILEAGE,
      expectedRangeHigh: ANOMALY_CONFIG.MAX_REALISTIC_MILEAGE,
      autoResolve: false,
    };
  }
  
  if (mileage > ANOMALY_CONFIG.MAX_REALISTIC_MILEAGE) {
    return {
      type: 'impossible_reading',
      severity: 'critical',
      message: `Invalid mileage: ${mileage.toLocaleString()} exceeds maximum realistic value`,
      reportedMileage: mileage,
      expectedRangeLow: ANOMALY_CONFIG.MIN_VALID_MILEAGE,
      expectedRangeHigh: ANOMALY_CONFIG.MAX_REALISTIC_MILEAGE,
      autoResolve: false,
    };
  }
  
  return null;
}

/**
 * Detect stale data (no recent DVIR)
 */
export function detectStaleData(
  truckNumber: string,
  lastDvirDate: string | null | undefined
): DetectedAnomaly | null {
  if (!lastDvirDate) {
    return {
      type: 'stale_data',
      severity: 'info',
      message: `No DVIR records found for ${truckNumber}`,
      reportedMileage: 0,
      autoResolve: true,
    };
  }
  
  const lastDate = new Date(lastDvirDate);
  const now = new Date();
  const daysSince = Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
  
  if (daysSince > ANOMALY_CONFIG.STALE_DATA_DAYS) {
    return {
      type: 'stale_data',
      severity: 'info',
      message: `No DVIR submitted in ${daysSince} days - truck may be inactive`,
      reportedMileage: 0,
      autoResolve: true,
    };
  }
  
  return null;
}

/**
 * Detect potential typo in mileage entry
 * e.g., 123456 vs 12345 (off by a digit)
 */
export function detectPotentialTypo(
  currentMileage: number,
  previousMileage: number
): string | null {
  const currentStr = currentMileage.toString();
  const previousStr = previousMileage.toString();
  
  // Check if lengths differ by exactly 1 (missing/extra digit)
  if (Math.abs(currentStr.length - previousStr.length) === 1) {
    // Check if one is a substring of the other
    const longer = currentStr.length > previousStr.length ? currentStr : previousStr;
    const shorter = currentStr.length > previousStr.length ? previousStr : currentStr;
    
    // Check each position where a digit could be removed to match
    for (let i = 0; i <= longer.length; i++) {
      const modified = longer.slice(0, i) + longer.slice(i + 1);
      if (modified === shorter) {
        return `Possible typo detected: ${currentMileage.toLocaleString()} may be intended as ${previousMileage.toLocaleString()} (off by one digit)`;
      }
    }
  }
  
  // Check for transposed digits
  if (currentStr.length === previousStr.length) {
    let differences = 0;
    const diffPositions: number[] = [];
    for (let i = 0; i < currentStr.length; i++) {
      if (currentStr[i] !== previousStr[i]) {
        differences++;
        diffPositions.push(i);
      }
    }
    
    // Exactly two adjacent digits swapped
    if (differences === 2 && Math.abs(diffPositions[0] - diffPositions[1]) === 1) {
      return `Possible transposed digits: ${currentMileage.toLocaleString()} vs expected ~${previousMileage.toLocaleString()}`;
    }
  }
  
  return null;
}

// =============================================================================
// MAIN VALIDATION FUNCTION
// =============================================================================

/**
 * Validate a new mileage reading against history
 */
export function validateMileageReading(
  truckNumber: string,
  newMileage: number,
  history: MileageHistoryEntry[]
): MileageValidationResult {
  const anomalies: DetectedAnomaly[] = [];
  const warnings: string[] = [];
  
  // Check for impossible reading first
  const impossibleAnomaly = detectImpossibleReading(newMileage);
  if (impossibleAnomaly) {
    anomalies.push(impossibleAnomaly);
    return { isValid: false, anomalies, warnings };
  }
  
  // If no history, check for stale data
  if (history.length === 0) {
    const staleAnomaly = detectStaleData(truckNumber, null);
    if (staleAnomaly) {
      anomalies.push(staleAnomaly);
    }
    // New truck, no validation possible
    return { isValid: true, anomalies, warnings };
  }
  
  // Get most recent reading for comparison
  const mostRecent = history[0];
  const previousMileage = mostRecent.mileage;
  const previousDate = new Date(mostRecent.created_at);
  const now = new Date();
  const daysBetween = Math.max(1, Math.floor((now.getTime() - previousDate.getTime()) / (1000 * 60 * 60 * 24)));
  
  // Check for decrease
  const decreaseAnomaly = detectDecrease(newMileage, previousMileage);
  if (decreaseAnomaly) {
    anomalies.push(decreaseAnomaly);
    
    // Also check for potential typo
    const typoWarning = detectPotentialTypo(newMileage, previousMileage);
    if (typoWarning) {
      warnings.push(typoWarning);
    }
  }
  
  // Check for large jump (only if no decrease)
  if (!decreaseAnomaly) {
    const jumpAnomaly = detectLargeJump(newMileage, previousMileage, daysBetween);
    if (jumpAnomaly) {
      anomalies.push(jumpAnomaly);
    }
  }
  
  // Check for stale data
  const staleAnomaly = detectStaleData(truckNumber, mostRecent.created_at);
  if (staleAnomaly) {
    anomalies.push(staleAnomaly);
  }
  
  const hasCritical = anomalies.some(a => a.severity === 'critical');
  
  return {
    isValid: !hasCritical,
    anomalies,
    warnings,
  };
}

/**
 * Analyze mileage history for a vehicle and detect all anomalies
 */
export function analyzeMileageHistory(
  truckNumber: string,
  history: MileageHistoryEntry[]
): DetectedAnomaly[] {
  const anomalies: DetectedAnomaly[] = [];
  
  if (history.length === 0) {
    const staleAnomaly = detectStaleData(truckNumber, null);
    if (staleAnomaly) {
      anomalies.push(staleAnomaly);
    }
    return anomalies;
  }
  
  // Check most recent entry for stale data
  const mostRecent = history[0];
  const staleAnomaly = detectStaleData(truckNumber, mostRecent.created_at);
  if (staleAnomaly) {
    anomalies.push(staleAnomaly);
  }
  
  // Compare consecutive readings
  for (let i = 0; i < history.length - 1; i++) {
    const current = history[i];
    const previous = history[i + 1];
    
    const currentDate = new Date(current.created_at);
    const previousDate = new Date(previous.created_at);
    const daysBetween = Math.max(1, Math.floor((currentDate.getTime() - previousDate.getTime()) / (1000 * 60 * 60 * 24)));
    
    // Check for impossible reading
    const impossibleAnomaly = detectImpossibleReading(current.mileage);
    if (impossibleAnomaly) {
      anomalies.push({
        ...impossibleAnomaly,
        // Associate with DVIR ID
      });
    }
    
    // Check for decrease
    const decreaseAnomaly = detectDecrease(current.mileage, previous.mileage);
    if (decreaseAnomaly) {
      anomalies.push(decreaseAnomaly);
    }
    
    // Check for large jump
    if (!decreaseAnomaly) {
      const jumpAnomaly = detectLargeJump(current.mileage, previous.mileage, daysBetween);
      if (jumpAnomaly) {
        anomalies.push(jumpAnomaly);
      }
    }
  }
  
  return anomalies;
}

/**
 * Get a human-readable summary of anomalies for a vehicle
 */
export function getAnomalySummary(anomalies: DetectedAnomaly[]): string {
  if (anomalies.length === 0) {
    return 'No anomalies detected';
  }
  
  const criticalCount = anomalies.filter(a => a.severity === 'critical').length;
  const warningCount = anomalies.filter(a => a.severity === 'warning').length;
  const infoCount = anomalies.filter(a => a.severity === 'info').length;
  
  const parts: string[] = [];
  if (criticalCount > 0) parts.push(`${criticalCount} critical`);
  if (warningCount > 0) parts.push(`${warningCount} warning${warningCount !== 1 ? 's' : ''}`);
  if (infoCount > 0) parts.push(`${infoCount} info`);
  
  return parts.join(', ');
}

export default {
  validateMileageReading,
  analyzeMileageHistory,
  detectDecrease,
  detectLargeJump,
  detectImpossibleReading,
  detectStaleData,
  isValidMileageValue,
  getAnomalySummary,
};
