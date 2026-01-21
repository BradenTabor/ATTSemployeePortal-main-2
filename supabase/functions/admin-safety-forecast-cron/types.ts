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

export interface SiteRiskData {
  site: WorkSite;
  weather: WeatherRiskFactors;
  crew: CrewRiskFactors;
  defects: string[];
  riskScore: RiskScore;
}

export interface CrewResult {
  members: CrewMember[];
  hasActiveJobs: boolean;
  crewName: string | null;
}
