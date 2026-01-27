/**
 * Risk score calculation logic
 * 
 * Uses configurable multipliers from risk_algorithm_config table
 * for calibration-aware predictions.
 */

import { RiskLevel, RiskScore, WeatherRiskFactors, CrewRiskFactors, AlgorithmConfig, RiskFactorsBreakdown, RiskScoreWithBreakdown } from './types.ts';

// =============================================================================
// DEFAULT CONFIG (fallback if database fetch fails)
// =============================================================================

export const DEFAULT_ALGORITHM_CONFIG: Omit<AlgorithmConfig, 'id' | 'created_at' | 'notes'> = {
  version: 'v1',
  is_active: true,
  wind_threshold_mph: 25,
  wind_multiplier_per_mph: 0.020,
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

// =============================================================================
// RISK LEVEL DETERMINATION (config-aware)
// =============================================================================

export function getRiskLevel(score: number, config?: Partial<AlgorithmConfig>): RiskLevel {
  const thresholds = {
    lowModerate: config?.threshold_low_moderate ?? DEFAULT_ALGORITHM_CONFIG.threshold_low_moderate,
    moderateElevated: config?.threshold_moderate_elevated ?? DEFAULT_ALGORITHM_CONFIG.threshold_moderate_elevated,
    elevatedHigh: config?.threshold_elevated_high ?? DEFAULT_ALGORITHM_CONFIG.threshold_elevated_high,
    highCritical: config?.threshold_high_critical ?? DEFAULT_ALGORITHM_CONFIG.threshold_high_critical,
  };

  if (score < thresholds.lowModerate) return 'LOW';
  if (score < thresholds.moderateElevated) return 'MODERATE';
  if (score < thresholds.elevatedHigh) return 'ELEVATED';
  if (score < thresholds.highCritical) return 'HIGH';
  return 'CRITICAL';
}

// =============================================================================
// RISK SCORE CALCULATION (config-aware)
// =============================================================================

export function calculateRiskScore(
  weather: WeatherRiskFactors,
  crew: CrewRiskFactors,
  criticalDefects: string[],
  isMondayFlag: boolean,
  config?: Partial<AlgorithmConfig>
): RiskScoreWithBreakdown {
  // Merge with defaults
  const cfg = { ...DEFAULT_ALGORITHM_CONFIG, ...config };
  
  let score = 1.0;
  const drivers: Array<{ text: string; weight: number }> = [];
  const recommendations: string[] = [];

  // Track factor breakdowns for history
  const weatherFactors: Record<string, unknown> = {
    windGust: weather.windGust,
    heatIndex: weather.heatIndex,
    precipitation: weather.precipitation,
    alertCount: weather.alerts.length,
    conditions: weather.conditions,
  };
  const crewFactors: Record<string, unknown> = {
    totalCount: crew.totalCount,
    newHireCount: crew.newHireCount,
    hasExpert: crew.hasExpert,
    crewName: crew.crewName,
  };
  const equipmentFactors: Record<string, unknown> = {
    criticalDefectCount: criticalDefects.length,
    defects: criticalDefects.slice(0, 5),
  };
  const temporalFactors: Record<string, unknown> = {
    isMonday: isMondayFlag,
  };

  // Weather multipliers (using config values)
  if (weather.windGust > cfg.wind_threshold_mph + 5) {
    // Dangerous wind - use per-mph multiplier
    const mult = 1.0 + (weather.windGust - cfg.wind_threshold_mph) * cfg.wind_multiplier_per_mph;
    score *= mult;
    drivers.push({ text: `Wind gusts ${weather.windGust}mph (dangerous)`, weight: mult });
    recommendations.push('Enforce 30mph wind cutoff for all aerial work');
    weatherFactors.windMultiplier = mult;
  } else if (weather.windGust > cfg.wind_threshold_mph) {
    const mult = 1.0 + (weather.windGust - cfg.wind_threshold_mph) * cfg.wind_multiplier_per_mph;
    score *= mult;
    drivers.push({ text: `Wind gusts ${weather.windGust}mph`, weight: mult });
    weatherFactors.windMultiplier = mult;
  }

  if (weather.heatIndex > cfg.heat_index_extreme_threshold) {
    score *= cfg.heat_extreme_multiplier;
    drivers.push({ text: `Extreme heat index ${weather.heatIndex}°F`, weight: cfg.heat_extreme_multiplier });
    recommendations.push('Mandatory 15-minute breaks every hour in shade');
    recommendations.push('Ensure 1 gallon water per person on site');
    weatherFactors.heatMultiplier = cfg.heat_extreme_multiplier;
  } else if (weather.heatIndex > cfg.heat_index_moderate_threshold) {
    score *= cfg.heat_moderate_multiplier;
    drivers.push({ text: `High heat index ${weather.heatIndex}°F`, weight: cfg.heat_moderate_multiplier });
    recommendations.push('Provide extra water breaks');
    weatherFactors.heatMultiplier = cfg.heat_moderate_multiplier;
  }

  if (weather.alerts.length > 0) {
    score *= cfg.weather_alert_multiplier;
    drivers.push({ text: `Weather alerts: ${weather.alerts.slice(0, 2).join(', ')}`, weight: cfg.weather_alert_multiplier });
    recommendations.push('Review weather alerts with crew during briefing');
    weatherFactors.alertMultiplier = cfg.weather_alert_multiplier;
  }

  // Crew multipliers (using config values)
  const newHireRatio = crew.newHireCount / Math.max(crew.totalCount, 1);
  crewFactors.newHireRatio = newHireRatio;

  if (newHireRatio > cfg.new_hire_ratio_high_threshold) {
    score *= cfg.new_hire_high_multiplier;
    drivers.push({ text: `${crew.newHireCount}/${crew.totalCount} are new hires (>${cfg.new_hire_ratio_high_threshold * 100}%)`, weight: cfg.new_hire_high_multiplier });
    recommendations.push(`Assign veteran mentor to shadow ${crew.newHireCount} new hire(s)`);
    crewFactors.newHireMultiplier = cfg.new_hire_high_multiplier;
  } else if (newHireRatio > cfg.new_hire_ratio_moderate_threshold) {
    score *= cfg.new_hire_moderate_multiplier;
    drivers.push({ text: `${crew.newHireCount} new hires on crew`, weight: cfg.new_hire_moderate_multiplier });
    crewFactors.newHireMultiplier = cfg.new_hire_moderate_multiplier;
  } else if (newHireRatio > cfg.new_hire_ratio_low_threshold) {
    score *= cfg.new_hire_low_multiplier;
    drivers.push({ text: `${crew.newHireCount} new hire(s) on crew`, weight: cfg.new_hire_low_multiplier });
    crewFactors.newHireMultiplier = cfg.new_hire_low_multiplier;
  }

  if (!crew.hasExpert && crew.totalCount > 2) {
    score *= cfg.no_expert_multiplier;
    drivers.push({ text: 'No expert-level supervision', weight: cfg.no_expert_multiplier });
    recommendations.push('Consider reassigning an expert to this crew');
    crewFactors.noExpertMultiplier = cfg.no_expert_multiplier;
  } else if (!crew.hasExpert && crew.totalCount <= 2 && crew.totalCount > 0) {
    score *= cfg.solo_no_expert_multiplier;
    drivers.push({ text: 'Small crew without expert', weight: cfg.solo_no_expert_multiplier });
    crewFactors.soloNoExpertMultiplier = cfg.solo_no_expert_multiplier;
  }

  // Equipment multipliers (using config values)
  if (criticalDefects.length > 0) {
    const mult = cfg.critical_defect_base_multiplier + (criticalDefects.length * cfg.critical_defect_increment);
    score *= mult;
    drivers.push({ text: `${criticalDefects.length} critical equipment defects`, weight: mult });
    recommendations.push(`Verify defect resolution before dispatch: ${criticalDefects.slice(0, 3).join(', ')}`);
    equipmentFactors.defectMultiplier = mult;
  }

  // Temporal multipliers (using config values)
  if (isMondayFlag) {
    score *= cfg.monday_multiplier;
    drivers.push({ text: 'Monday (elevated baseline risk)', weight: cfg.monday_multiplier });
    temporalFactors.mondayMultiplier = cfg.monday_multiplier;
  }

  // Clamp and sort
  score = Math.min(Math.max(score, 1.0), 5.0);
  const topDrivers = drivers.sort((a, b) => b.weight - a.weight).slice(0, 3).map(d => d.text);
  const level = getRiskLevel(score, cfg);

  if (level === 'CRITICAL') {
    recommendations.push('Consider postponing non-critical work');
  } else if (level === 'HIGH') {
    recommendations.push('Mandatory safety officer presence');
  }

  return {
    total: Math.round(score * 100) / 100,
    level,
    drivers: topDrivers,
    recommendations: [...new Set(recommendations)].slice(0, 6),
    breakdown: {
      weatherFactors,
      crewFactors,
      equipmentFactors,
      temporalFactors,
    },
  };
}
