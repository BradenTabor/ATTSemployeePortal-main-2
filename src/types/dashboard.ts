/**
 * Shared types for Safety Officer Dashboard and dashboard widgets.
 */

export interface ComplianceSummaryRow {
  date: string;
  dvir_count: number;
  dvir_users: number;
  equipment_count: number;
  equipment_users: number;
  jsa_count: number;
  jsa_users: number;
}

export interface RiskScoreHistoryRow {
  id: string;
  date_for: string;
  work_site_id: string | null;
  work_site_name: string | null;
  total_score: number;
  risk_level: "LOW" | "MODERATE" | "ELEVATED" | "HIGH" | "CRITICAL";
  top_drivers?: string[];
  recommendations?: string[];
}
