/**
 * Type definitions for the Admin Safety Forecast Edge Function
 */

export type RiskLevel = 'LOW' | 'MODERATE' | 'ELEVATED' | 'HIGH' | 'CRITICAL';

export interface WorkSite {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  region: string | null;
  crew_id: string | null;
}

/**
 * Risk algorithm configuration from database
 * Matches risk_algorithm_config table structure
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
  // Metadata
  created_at: string;
  notes: string | null;
}

export interface WeatherRiskFactors {
  windGust: number;
  heatIndex: number;
  precipitation: number;
  alerts: string[];
  conditions: string;
}

export interface CrewMember {
  user_id: string;
  full_name: string | null;
  hire_date: string | null;
  experience_level: string | null;
}

export interface CrewRiskFactors {
  totalCount: number;
  newHireCount: number;
  hasExpert: boolean;
  crewName: string | null;
  hasActiveJobs: boolean;
}

export interface RiskScore {
  total: number;
  level: RiskLevel;
  drivers: string[];
  recommendations: string[];
}

export interface RiskFactorsBreakdown {
  weatherFactors: Record<string, unknown>;
  crewFactors: Record<string, unknown>;
  equipmentFactors: Record<string, unknown>;
  temporalFactors: Record<string, unknown>;
}

export interface RiskScoreWithBreakdown extends RiskScore {
  breakdown: RiskFactorsBreakdown;
}

export interface SiteRiskData {
  site: WorkSite;
  weather: WeatherRiskFactors;
  crew: CrewRiskFactors;
  defects: string[];
  riskScore: RiskScoreWithBreakdown;
}

export interface CrewResult {
  members: CrewMember[];
  hasActiveJobs: boolean;
  crewName: string | null;
}
