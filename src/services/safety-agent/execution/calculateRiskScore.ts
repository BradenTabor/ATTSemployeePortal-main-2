/**
 * Risk Score Calculation Engine
 * 
 * Calculates a multiplicative risk score based on weather, crew composition,
 * equipment status, and temporal factors.
 * 
 * This module provides two calculation functions:
 * 1. calculateRiskScore() - Pure function with hardcoded multipliers (backward compatible)
 * 2. calculateRiskScoreWithHistory() - Async function that fetches config from DB and saves history
 * 
 * @see directives/admin_safety_forecast_6_30am.md
 */

import type { WeatherRiskFactors } from './getWeatherForecast';
import type { SupabaseClient } from '@supabase/supabase-js';

// ============================================================================
// Type Definitions
// ============================================================================

export interface RiskFactors {
  weather: WeatherRiskFactors;
  crew: CrewRiskFactors;
  equipment: EquipmentRiskFactors;
  temporal: TemporalRiskFactors;
}

export interface CrewRiskFactors {
  totalCount: number;      // Total crew members assigned
  newHireCount: number;    // Crew members with < 12 months tenure
  hasExpert: boolean;      // At least one experience_level = 'expert'
  averageTenureMonths?: number; // Optional: average tenure in months
}

export interface EquipmentRiskFactors {
  openDefectCount: number;      // Total open defects
  criticalDefects: string[];    // List of critical defect descriptions
  warningDefects?: string[];    // List of warning-level defects
}

export interface TemporalRiskFactors {
  isMonday: boolean;
  isAfterHoliday: boolean;
  dayOfWeek?: number;  // 0-6, Sunday = 0
}

export interface RiskScore {
  total: number;           // 1.0-5.0 scale
  level: RiskLevel;        // Categorical level
  drivers: string[];       // Top 3 risk contributors (for display)
  recommendations: string[]; // Actionable mitigations
  breakdown: RiskBreakdown; // Detailed factor breakdown
}

export type RiskLevel = 'LOW' | 'MODERATE' | 'ELEVATED' | 'HIGH' | 'CRITICAL';

export interface RiskBreakdown {
  baseScore: number;
  weatherMultiplier: number;
  crewMultiplier: number;
  equipmentMultiplier: number;
  temporalMultiplier: number;
  factors: WeightedDriver[];
}

interface WeightedDriver {
  text: string;
  weight: number;
  category: 'weather' | 'crew' | 'equipment' | 'temporal';
}

// ============================================================================
// Risk Level Thresholds
// ============================================================================

const RISK_LEVELS: Array<{ max: number; level: RiskLevel }> = [
  { max: 1.5, level: 'LOW' },
  { max: 2.0, level: 'MODERATE' },
  { max: 2.5, level: 'ELEVATED' },
  { max: 3.5, level: 'HIGH' },
  { max: Infinity, level: 'CRITICAL' },
];

/**
 * Convert numeric risk score to categorical level
 */
export function getRiskLevel(score: number): RiskLevel {
  for (const { max, level } of RISK_LEVELS) {
    if (score < max) return level;
  }
  return 'CRITICAL';
}

// ============================================================================
// Main Calculation Function
// ============================================================================

/**
 * Calculate composite risk score from multiple factors.
 * Uses multiplicative formula where each factor multiplies the base score.
 * 
 * @param factors Input risk factors
 * @returns Risk score with level, drivers, and recommendations
 */
export function calculateRiskScore(factors: RiskFactors): RiskScore {
  const baseScore = 1.0;
  const drivers: WeightedDriver[] = [];

  // =========================================
  // Weather Multipliers
  // =========================================
  let weatherMultiplier = 1.0;

  // Wind risk (graduated scaling above 25mph)
  if (factors.weather.windGust > 30) {
    const multiplier = 1.0 + (factors.weather.windGust - 25) * 0.03;
    weatherMultiplier *= multiplier;
    drivers.push({
      text: `Wind gusts ${factors.weather.windGust}mph (dangerous)`,
      weight: multiplier,
      category: 'weather',
    });
  } else if (factors.weather.windGust > 25) {
    weatherMultiplier *= 1.2;
    drivers.push({
      text: `Wind gusts ${factors.weather.windGust}mph`,
      weight: 1.2,
      category: 'weather',
    });
  }

  // Heat risk (heat index based)
  if (factors.weather.heatIndex > 95) {
    weatherMultiplier *= 1.3;
    drivers.push({
      text: `Extreme heat index ${factors.weather.heatIndex}°F`,
      weight: 1.3,
      category: 'weather',
    });
  } else if (factors.weather.heatIndex > 90) {
    weatherMultiplier *= 1.15;
    drivers.push({
      text: `High heat index ${factors.weather.heatIndex}°F`,
      weight: 1.15,
      category: 'weather',
    });
  }

  // Precipitation risk
  if (factors.weather.precipitation > 0.7) {
    weatherMultiplier *= 1.15;
    drivers.push({
      text: `High precipitation chance (${Math.round(factors.weather.precipitation * 100)}%)`,
      weight: 1.15,
      category: 'weather',
    });
  } else if (factors.weather.precipitation > 0.5) {
    weatherMultiplier *= 1.1;
    drivers.push({
      text: `Moderate precipitation chance (${Math.round(factors.weather.precipitation * 100)}%)`,
      weight: 1.1,
      category: 'weather',
    });
  }

  // Active weather alerts (severe weather)
  if (factors.weather.alerts.length > 0) {
    weatherMultiplier *= 1.5;
    drivers.push({
      text: `Active weather alerts: ${factors.weather.alerts.slice(0, 2).join(', ')}`,
      weight: 1.5,
      category: 'weather',
    });
  }

  // =========================================
  // Crew Composition Multipliers (NIOSH data)
  // =========================================
  let crewMultiplier = 1.0;

  // New hire ratio risk - most significant factor
  const totalCount = Math.max(factors.crew.totalCount, 1); // Avoid division by zero
  const newHireRatio = factors.crew.newHireCount / totalCount;

  if (newHireRatio > 0.5) {
    crewMultiplier *= 2.5;
    drivers.push({
      text: `${factors.crew.newHireCount}/${factors.crew.totalCount} crew members are new hires (>50%)`,
      weight: 2.5,
      category: 'crew',
    });
  } else if (newHireRatio > 0.3) {
    crewMultiplier *= 1.8;
    drivers.push({
      text: `${factors.crew.newHireCount} new hires on crew (${Math.round(newHireRatio * 100)}%)`,
      weight: 1.8,
      category: 'crew',
    });
  } else if (newHireRatio > 0.15) {
    crewMultiplier *= 1.3;
    drivers.push({
      text: `${factors.crew.newHireCount} new hire(s) on crew`,
      weight: 1.3,
      category: 'crew',
    });
  }

  // Expert supervision risk
  if (!factors.crew.hasExpert && factors.crew.totalCount > 2) {
    crewMultiplier *= 1.3;
    drivers.push({
      text: 'No expert-level supervision on crew',
      weight: 1.3,
      category: 'crew',
    });
  }

  // Small crew with no experience diversity
  if (factors.crew.totalCount === 1 && !factors.crew.hasExpert) {
    crewMultiplier *= 1.2;
    drivers.push({
      text: 'Solo worker without expert experience',
      weight: 1.2,
      category: 'crew',
    });
  }

  // =========================================
  // Equipment Multipliers
  // =========================================
  let equipmentMultiplier = 1.0;

  // Critical defects (significant risk)
  if (factors.equipment.criticalDefects.length > 0) {
    const multiplier = 1.0 + (factors.equipment.criticalDefects.length * 0.2);
    equipmentMultiplier *= multiplier;
    drivers.push({
      text: `${factors.equipment.criticalDefects.length} critical equipment defect(s)`,
      weight: multiplier,
      category: 'equipment',
    });
  }

  // Warning-level defects (minor risk)
  const warningCount = factors.equipment.warningDefects?.length || 0;
  if (warningCount > 0 && factors.equipment.criticalDefects.length === 0) {
    const multiplier = 1.0 + (warningCount * 0.05);
    equipmentMultiplier *= multiplier;
    drivers.push({
      text: `${warningCount} equipment warning(s)`,
      weight: multiplier,
      category: 'equipment',
    });
  }

  // =========================================
  // Temporal Multipliers
  // =========================================
  let temporalMultiplier = 1.0;

  // Monday effect (re-entry after weekend)
  if (factors.temporal.isMonday) {
    temporalMultiplier *= 1.1;
    drivers.push({
      text: 'Monday (elevated baseline risk)',
      weight: 1.1,
      category: 'temporal',
    });
  }

  // Post-holiday effect
  if (factors.temporal.isAfterHoliday) {
    temporalMultiplier *= 1.15;
    drivers.push({
      text: 'Day after holiday (re-entry risk)',
      weight: 1.15,
      category: 'temporal',
    });
  }

  // =========================================
  // Calculate Final Score
  // =========================================
  const totalMultiplier = weatherMultiplier * crewMultiplier * equipmentMultiplier * temporalMultiplier;
  const rawScore = baseScore * totalMultiplier;
  const clampedScore = Math.min(Math.max(rawScore, 1.0), 5.0);

  // Sort drivers by weight and take top 3
  const topDrivers = drivers
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 3)
    .map((d) => d.text);

  const level = getRiskLevel(clampedScore);
  const recommendations = generateRecommendations(factors, level, drivers);

  return {
    total: Math.round(clampedScore * 100) / 100, // Round to 2 decimal places
    level,
    drivers: topDrivers,
    recommendations,
    breakdown: {
      baseScore,
      weatherMultiplier: Math.round(weatherMultiplier * 100) / 100,
      crewMultiplier: Math.round(crewMultiplier * 100) / 100,
      equipmentMultiplier: Math.round(equipmentMultiplier * 100) / 100,
      temporalMultiplier: Math.round(temporalMultiplier * 100) / 100,
      factors: drivers,
    },
  };
}

// ============================================================================
// Recommendation Generation
// ============================================================================

/**
 * Generate actionable recommendations based on risk factors and level
 * 
 * @param factors - The input risk factors
 * @param level - The calculated risk level
 * @param _drivers - Weighted drivers (available for future use in recommendation prioritization)
 */
function generateRecommendations(
  factors: RiskFactors,
  level: RiskLevel,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _drivers: WeightedDriver[]
): string[] {
  const recs: string[] = [];

  // Weather-based recommendations
  if (factors.weather.windGust > 30) {
    recs.push('Enforce 30mph wind cutoff for all aerial work');
    recs.push('Secure loose materials and equipment before work begins');
  } else if (factors.weather.windGust > 25) {
    recs.push('Monitor wind conditions; be prepared to halt aerial work if gusts increase');
  }

  if (factors.weather.heatIndex > 95) {
    recs.push('Mandatory 15-minute shade breaks every hour');
    recs.push('Ensure 1 gallon water per person on site');
    recs.push('Watch for heat illness symptoms; buddy system required');
  } else if (factors.weather.heatIndex > 90) {
    recs.push('Provide extra water breaks; watch for heat stress signs');
  }

  if (factors.weather.alerts.length > 0) {
    recs.push('Review weather alerts with crew during morning briefing');
    recs.push('Have emergency shelter plan ready');
  }

  // Crew-based recommendations
  if (factors.crew.newHireCount > 0 && !factors.crew.hasExpert) {
    recs.push(`Assign veteran mentor to shadow ${factors.crew.newHireCount} new hire(s)`);
  }

  if (factors.crew.newHireCount > 0) {
    recs.push('New hires must not operate equipment independently');
    recs.push('Extra toolbox talk focus on site-specific hazards');
  }

  if (!factors.crew.hasExpert && factors.crew.totalCount > 2) {
    recs.push('Consider reassigning an expert-level employee to this crew');
  }

  // Equipment-based recommendations
  if (factors.equipment.criticalDefects.length > 0) {
    const defects = factors.equipment.criticalDefects.slice(0, 3).join(', ');
    recs.push(`Verify defect resolution before dispatch: ${defects}`);
    recs.push('Do not dispatch vehicles/equipment with unresolved critical defects');
  }

  // Level-based recommendations
  if (level === 'CRITICAL') {
    recs.push('⚠️ Consider postponing non-critical work until conditions improve');
    recs.push('Safety officer must approve work start');
  } else if (level === 'HIGH') {
    recs.push('Mandatory safety officer check-in before noon');
    recs.push('Reduce crew workload and extend task timelines');
  } else if (level === 'ELEVATED') {
    recs.push('Extra supervision recommended; foreman should check in every 2 hours');
  }

  // Temporal recommendations
  if (factors.temporal.isMonday || factors.temporal.isAfterHoliday) {
    recs.push('Extended toolbox talk to refresh safety awareness');
  }

  // Deduplicate and limit recommendations
  const uniqueRecs = [...new Set(recs)];
  return uniqueRecs.slice(0, 6); // Max 6 recommendations
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Calculate risk score for a single site with all factors
 */
export function calculateSiteRiskScore(
  weather: WeatherRiskFactors,
  crew: CrewRiskFactors,
  criticalDefects: string[],
  warningDefects: string[],
  isMonday: boolean,
  isAfterHoliday: boolean = false
): RiskScore {
  return calculateRiskScore({
    weather,
    crew,
    equipment: {
      openDefectCount: criticalDefects.length + warningDefects.length,
      criticalDefects,
      warningDefects,
    },
    temporal: {
      isMonday,
      isAfterHoliday,
    },
  });
}

/**
 * Get emoji for risk level display
 */
export function getRiskLevelEmoji(level: RiskLevel): string {
  const emojis: Record<RiskLevel, string> = {
    LOW: '✅',
    MODERATE: '📊',
    ELEVATED: '⚠️',
    HIGH: '🔴',
    CRITICAL: '🚨',
  };
  return emojis[level];
}

/**
 * Get color class for risk level display
 */
export function getRiskLevelColor(level: RiskLevel): string {
  const colors: Record<RiskLevel, string> = {
    LOW: 'text-green-400',
    MODERATE: 'text-blue-400',
    ELEVATED: 'text-amber-400',
    HIGH: 'text-orange-500',
    CRITICAL: 'text-red-500',
  };
  return colors[level];
}

// ============================================================================
// Database-Integrated Risk Calculation (for Edge Functions)
// ============================================================================

/**
 * Algorithm configuration from database
 */
export interface AlgorithmConfig {
  id: string;
  version: string;
  is_active: boolean;
  // Weather multipliers
  wind_threshold_mph: number;
  wind_multiplier_per_mph: number;
  heat_index_moderate_threshold: number;
  heat_index_extreme_threshold: number;
  heat_moderate_multiplier: number;
  heat_extreme_multiplier: number;
  precipitation_moderate_multiplier: number;
  precipitation_high_multiplier: number;
  weather_alert_multiplier: number;
  // Crew multipliers
  new_hire_ratio_high_threshold: number;
  new_hire_ratio_moderate_threshold: number;
  new_hire_ratio_low_threshold: number;
  new_hire_high_multiplier: number;
  new_hire_moderate_multiplier: number;
  new_hire_low_multiplier: number;
  no_expert_multiplier: number;
  solo_no_expert_multiplier: number;
  // Equipment multipliers
  critical_defect_base_multiplier: number;
  critical_defect_increment: number;
  warning_defect_increment: number;
  // Temporal multipliers
  monday_multiplier: number;
  post_holiday_multiplier: number;
  // Risk level thresholds
  threshold_low_moderate: number;
  threshold_moderate_elevated: number;
  threshold_elevated_high: number;
  threshold_high_critical: number;
}

/**
 * Default configuration (matches hardcoded values in calculateRiskScore)
 */
export const DEFAULT_ALGORITHM_CONFIG: Omit<AlgorithmConfig, 'id' | 'version' | 'is_active'> = {
  wind_threshold_mph: 25,
  wind_multiplier_per_mph: 0.03,
  heat_index_moderate_threshold: 90,
  heat_index_extreme_threshold: 95,
  heat_moderate_multiplier: 1.15,
  heat_extreme_multiplier: 1.30,
  precipitation_moderate_multiplier: 1.10,
  precipitation_high_multiplier: 1.15,
  weather_alert_multiplier: 1.50,
  new_hire_ratio_high_threshold: 0.50,
  new_hire_ratio_moderate_threshold: 0.30,
  new_hire_ratio_low_threshold: 0.15,
  new_hire_high_multiplier: 2.50,
  new_hire_moderate_multiplier: 1.80,
  new_hire_low_multiplier: 1.30,
  no_expert_multiplier: 1.30,
  solo_no_expert_multiplier: 1.20,
  critical_defect_base_multiplier: 1.00,
  critical_defect_increment: 0.20,
  warning_defect_increment: 0.05,
  monday_multiplier: 1.10,
  post_holiday_multiplier: 1.15,
  threshold_low_moderate: 1.50,
  threshold_moderate_elevated: 2.00,
  threshold_elevated_high: 2.50,
  threshold_high_critical: 3.50,
};

/**
 * Context for risk score calculation with history
 */
export interface RiskScoreContext {
  dateFor: string;           // ISO date string (YYYY-MM-DD)
  workSiteId?: string;       // UUID of work_sites row
  workSiteName?: string;     // Human-readable site name
  forecastRunId?: string;    // UUID of compliance_runs row (if part of a batch)
}

/**
 * Extended risk score with history tracking
 */
export interface RiskScoreWithHistory extends RiskScore {
  historyId: string | null;  // UUID of risk_score_history row
  algorithmVersion: string;  // Version of config used
}

/**
 * Get risk level from score using configurable thresholds
 */
function getRiskLevelWithConfig(
  score: number,
  config: Pick<AlgorithmConfig, 'threshold_low_moderate' | 'threshold_moderate_elevated' | 'threshold_elevated_high' | 'threshold_high_critical'>
): RiskLevel {
  if (score < config.threshold_low_moderate) return 'LOW';
  if (score < config.threshold_moderate_elevated) return 'MODERATE';
  if (score < config.threshold_elevated_high) return 'ELEVATED';
  if (score < config.threshold_high_critical) return 'HIGH';
  return 'CRITICAL';
}

/**
 * Calculate risk score using database configuration
 */
function calculateRiskScoreWithConfig(
  factors: RiskFactors,
  config: Omit<AlgorithmConfig, 'id' | 'version' | 'is_active'>
): RiskScore {
  const baseScore = 1.0;
  const drivers: WeightedDriver[] = [];

  // =========================================
  // Weather Multipliers (using config)
  // =========================================
  let weatherMultiplier = 1.0;

  // Wind risk (graduated scaling above threshold)
  if (factors.weather.windGust > 30) {
    const multiplier = 1.0 + (factors.weather.windGust - config.wind_threshold_mph) * config.wind_multiplier_per_mph;
    weatherMultiplier *= multiplier;
    drivers.push({
      text: `Wind gusts ${factors.weather.windGust}mph (dangerous)`,
      weight: multiplier,
      category: 'weather',
    });
  } else if (factors.weather.windGust > config.wind_threshold_mph) {
    weatherMultiplier *= 1.2;
    drivers.push({
      text: `Wind gusts ${factors.weather.windGust}mph`,
      weight: 1.2,
      category: 'weather',
    });
  }

  // Heat risk (heat index based)
  if (factors.weather.heatIndex > config.heat_index_extreme_threshold) {
    weatherMultiplier *= config.heat_extreme_multiplier;
    drivers.push({
      text: `Extreme heat index ${factors.weather.heatIndex}°F`,
      weight: config.heat_extreme_multiplier,
      category: 'weather',
    });
  } else if (factors.weather.heatIndex > config.heat_index_moderate_threshold) {
    weatherMultiplier *= config.heat_moderate_multiplier;
    drivers.push({
      text: `High heat index ${factors.weather.heatIndex}°F`,
      weight: config.heat_moderate_multiplier,
      category: 'weather',
    });
  }

  // Precipitation risk
  if (factors.weather.precipitation > 0.7) {
    weatherMultiplier *= config.precipitation_high_multiplier;
    drivers.push({
      text: `High precipitation chance (${Math.round(factors.weather.precipitation * 100)}%)`,
      weight: config.precipitation_high_multiplier,
      category: 'weather',
    });
  } else if (factors.weather.precipitation > 0.5) {
    weatherMultiplier *= config.precipitation_moderate_multiplier;
    drivers.push({
      text: `Moderate precipitation chance (${Math.round(factors.weather.precipitation * 100)}%)`,
      weight: config.precipitation_moderate_multiplier,
      category: 'weather',
    });
  }

  // Active weather alerts
  if (factors.weather.alerts.length > 0) {
    weatherMultiplier *= config.weather_alert_multiplier;
    drivers.push({
      text: `Active weather alerts: ${factors.weather.alerts.slice(0, 2).join(', ')}`,
      weight: config.weather_alert_multiplier,
      category: 'weather',
    });
  }

  // =========================================
  // Crew Composition Multipliers
  // =========================================
  let crewMultiplier = 1.0;
  const totalCount = Math.max(factors.crew.totalCount, 1);
  const newHireRatio = factors.crew.newHireCount / totalCount;

  if (newHireRatio > config.new_hire_ratio_high_threshold) {
    crewMultiplier *= config.new_hire_high_multiplier;
    drivers.push({
      text: `${factors.crew.newHireCount}/${factors.crew.totalCount} crew members are new hires (>50%)`,
      weight: config.new_hire_high_multiplier,
      category: 'crew',
    });
  } else if (newHireRatio > config.new_hire_ratio_moderate_threshold) {
    crewMultiplier *= config.new_hire_moderate_multiplier;
    drivers.push({
      text: `${factors.crew.newHireCount} new hires on crew (${Math.round(newHireRatio * 100)}%)`,
      weight: config.new_hire_moderate_multiplier,
      category: 'crew',
    });
  } else if (newHireRatio > config.new_hire_ratio_low_threshold) {
    crewMultiplier *= config.new_hire_low_multiplier;
    drivers.push({
      text: `${factors.crew.newHireCount} new hire(s) on crew`,
      weight: config.new_hire_low_multiplier,
      category: 'crew',
    });
  }

  // Expert supervision risk
  if (!factors.crew.hasExpert && factors.crew.totalCount > 2) {
    crewMultiplier *= config.no_expert_multiplier;
    drivers.push({
      text: 'No expert-level supervision on crew',
      weight: config.no_expert_multiplier,
      category: 'crew',
    });
  }

  // Solo worker without expert experience
  if (factors.crew.totalCount === 1 && !factors.crew.hasExpert) {
    crewMultiplier *= config.solo_no_expert_multiplier;
    drivers.push({
      text: 'Solo worker without expert experience',
      weight: config.solo_no_expert_multiplier,
      category: 'crew',
    });
  }

  // =========================================
  // Equipment Multipliers
  // =========================================
  let equipmentMultiplier = 1.0;

  if (factors.equipment.criticalDefects.length > 0) {
    const multiplier = config.critical_defect_base_multiplier + 
      (factors.equipment.criticalDefects.length * config.critical_defect_increment);
    equipmentMultiplier *= multiplier;
    drivers.push({
      text: `${factors.equipment.criticalDefects.length} critical equipment defect(s)`,
      weight: multiplier,
      category: 'equipment',
    });
  }

  const warningCount = factors.equipment.warningDefects?.length || 0;
  if (warningCount > 0 && factors.equipment.criticalDefects.length === 0) {
    const multiplier = 1.0 + (warningCount * config.warning_defect_increment);
    equipmentMultiplier *= multiplier;
    drivers.push({
      text: `${warningCount} equipment warning(s)`,
      weight: multiplier,
      category: 'equipment',
    });
  }

  // =========================================
  // Temporal Multipliers
  // =========================================
  let temporalMultiplier = 1.0;

  if (factors.temporal.isMonday) {
    temporalMultiplier *= config.monday_multiplier;
    drivers.push({
      text: 'Monday (elevated baseline risk)',
      weight: config.monday_multiplier,
      category: 'temporal',
    });
  }

  if (factors.temporal.isAfterHoliday) {
    temporalMultiplier *= config.post_holiday_multiplier;
    drivers.push({
      text: 'Day after holiday (re-entry risk)',
      weight: config.post_holiday_multiplier,
      category: 'temporal',
    });
  }

  // =========================================
  // Calculate Final Score
  // =========================================
  const totalMultiplier = weatherMultiplier * crewMultiplier * equipmentMultiplier * temporalMultiplier;
  const rawScore = baseScore * totalMultiplier;
  const clampedScore = Math.min(Math.max(rawScore, 1.0), 5.0);

  const topDrivers = drivers
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 3)
    .map((d) => d.text);

  const level = getRiskLevelWithConfig(clampedScore, config);
  const recommendations = generateRecommendations(factors, level, drivers);

  return {
    total: Math.round(clampedScore * 100) / 100,
    level,
    drivers: topDrivers,
    recommendations,
    breakdown: {
      baseScore,
      weatherMultiplier: Math.round(weatherMultiplier * 100) / 100,
      crewMultiplier: Math.round(crewMultiplier * 100) / 100,
      equipmentMultiplier: Math.round(equipmentMultiplier * 100) / 100,
      temporalMultiplier: Math.round(temporalMultiplier * 100) / 100,
      factors: drivers,
    },
  };
}

/**
 * Calculate risk score with database config and save to history.
 * 
 * This is the primary function for production use in Edge Functions.
 * It fetches the active algorithm config from the database, calculates
 * the risk score, and saves the result to risk_score_history.
 * 
 * @param factors Input risk factors
 * @param context Context including date, site, and run info
 * @param supabase Supabase client (service role for Edge Functions)
 * @returns Risk score with history ID and algorithm version
 */
export async function calculateRiskScoreWithHistory(
  factors: RiskFactors,
  context: RiskScoreContext,
  supabase: SupabaseClient
): Promise<RiskScoreWithHistory> {
  let config: AlgorithmConfig | null = null;
  let algorithmVersion = 'v1';

  // 1. Fetch active config from database
  try {
    const { data, error } = await supabase
      .from('risk_algorithm_config')
      .select('*')
      .eq('is_active', true)
      .single();

    if (error) {
      console.error('[calculateRiskScore] Failed to fetch active config, using defaults:', error.message);
    } else if (data) {
      config = data as AlgorithmConfig;
      algorithmVersion = config.version;
    }
  } catch (err) {
    console.error('[calculateRiskScore] Exception fetching config:', err);
  }

  // 2. Calculate risk score using config or defaults
  const effectiveConfig = config || { ...DEFAULT_ALGORITHM_CONFIG, id: '', version: 'v1', is_active: true };
  const riskScore = calculateRiskScoreWithConfig(factors, effectiveConfig);

  // 3. Save to history (non-blocking - don't fail if this fails)
  let historyId: string | null = null;
  try {
    const historyRecord = {
      date_for: context.dateFor,
      work_site_id: context.workSiteId || null,
      work_site_name: context.workSiteName || null,
      total_score: riskScore.total,
      risk_level: riskScore.level,
      weather_factors: factors.weather,
      crew_factors: factors.crew,
      equipment_factors: factors.equipment,
      temporal_factors: factors.temporal,
      top_drivers: riskScore.drivers,
      recommendations: riskScore.recommendations,
      forecast_run_id: context.forecastRunId || null,
      algorithm_version: algorithmVersion,
    };

    const { data: inserted, error: historyError } = await supabase
      .from('risk_score_history')
      .upsert(historyRecord, { 
        onConflict: 'date_for,work_site_id',
        ignoreDuplicates: false 
      })
      .select('id')
      .single();

    if (historyError) {
      console.error('[calculateRiskScore] Failed to save history:', historyError.message);
    } else if (inserted) {
      historyId = inserted.id;
    }
  } catch (err) {
    console.error('[calculateRiskScore] Exception saving history:', err);
  }

  return {
    ...riskScore,
    historyId,
    algorithmVersion,
  };
}
