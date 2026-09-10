/**
 * Safety analytics domain types.
 * Field workers owe three forms each weekday: DVIR, equipment, JSA.
 */

export type Period = 'week' | 'month' | 'quarter' | 'all';

export type RequiredForm = 'dvir' | 'equipment' | 'jsa';

export const REQUIRED_FORMS: readonly RequiredForm[] = ['dvir', 'equipment', 'jsa'];

/** Roles expected to file the daily three-form packet. */
export const FIELD_ROLES = ['employee', 'foreman', 'general_foreman', 'mechanic'] as const;
export type FieldRole = (typeof FIELD_ROLES)[number];

export const ANALYTICS_ROLES = [
  'employee',
  'foreman',
  'general_foreman',
  'mechanic',
  'admin',
  'safety_officer',
  'manager',
] as const;

export interface DateWindow {
  start: string;
  end: string;
  weekdayCount: number;
  label: string;
}

export interface PeriodWindows {
  current: DateWindow;
  previous: DateWindow;
}

export interface ComplianceRecord {
  user_id: string;
  date_for: string;
  forms_completed: string[];
  points_awarded: number;
}

export interface AnnouncementRecord {
  user_id: string;
  announcement_id: string;
  points_awarded: number;
  claimed_at: string;
}

export interface UserRecord {
  user_id: string;
  full_name: string | null;
  email: string | null;
  role: string;
}

export interface FormBreakdown {
  form_type: RequiredForm;
  submissions: number;
  expected: number;
  percentage: number;
}

export interface SafetyTrendData {
  date: string;
  compliance_submissions: number;
  announcement_claims: number;
  total_points: number;
  forms_completed: number;
  full_packets: number;
  expected_forms: number;
  form_fill_rate: number;
  compliance_rate: number;
}

export interface UnifiedLeaderboardEntry {
  user_id: string;
  full_name: string;
  email: string | null;
  role: string;
  rank: number;
  compliance_points: number;
  compliance_days: number;
  full_compliance_days: number;
  /** Form-fill rate 0–100. Alias kept so existing widgets stay honest. */
  compliance_rate: number;
  form_fill_rate: number;
  full_packet_rate: number;
  forms_completed: number;
  expected_forms: number;
  dvir_count: number;
  equipment_count: number;
  jsa_count: number;
  announcement_points: number;
  announcements_claimed: number;
  total_points: number;
  safety_score: number;
  current_streak: number;
  longest_streak: number;
  is_field: boolean;
  is_at_risk: boolean;
}

export interface SafetyAnalyticsStats {
  total_users: number;
  field_users: number;
  active_users: number;
  total_compliance_points: number;
  total_announcement_points: number;
  other_points: number;
  total_combined_points: number;
  /** Headline: completed form slots / expected weekday slots. */
  avg_compliance_rate: number;
  form_fill_rate: number;
  full_packet_rate: number;
  any_form_rate: number;
  /** Old metric — full packets / recorded attendance rows. Shown as a footnote. */
  full_packet_among_recorded: number;
  full_compliance_users: number;
  /** Person-days that actually have ≥1 form (empty attendance rows excluded). */
  total_compliance_days: number;
  days_with_any_form: number;
  days_with_full_packet: number;
  empty_attendance_rows: number;
  expected_form_slots: number;
  completed_form_slots: number;
  expected_person_days: number;
  weekday_count: number;
  announcement_count: number;
  total_announcements_claimed: number;
  announcement_engagement_rate: number;
  announcement_reach: number;
  announcement_coverage: number;
  points_trend: number;
  compliance_trend: number;
  packet_trend: number;
  period_label: string;
}

export interface SafetyAnalyticsResult {
  stats: SafetyAnalyticsStats;
  previousStats: Pick<
    SafetyAnalyticsStats,
    'form_fill_rate' | 'full_packet_rate' | 'announcement_reach' | 'total_combined_points'
  >;
  leaderboard: UnifiedLeaderboardEntry[];
  atRisk: UnifiedLeaderboardEntry[];
  trends: SafetyTrendData[];
  formBreakdown: FormBreakdown[];
}

export interface UserSafetyDetail {
  user_id: string;
  full_name: string;
  email: string | null;
  role: string;
  compliance_points: number;
  announcement_points: number;
  total_points: number;
  safety_score: number;
  compliance_days: number;
  full_compliance_days: number;
  compliance_rate: number;
  form_fill_rate: number;
  full_packet_rate: number;
  expected_forms: number;
  forms_breakdown: FormBreakdown[];
  announcements_claimed: number;
  recent_claims: Array<{
    id: string;
    announcement_id: string;
    title: string | null;
    points: number;
    claimed_at: string;
  }>;
  current_streak: number;
  longest_streak: number;
  activity_timeline: Array<{
    date: string;
    type: 'compliance' | 'announcement';
    points: number;
    details: string;
  }>;
}
