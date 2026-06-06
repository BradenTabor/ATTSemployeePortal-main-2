/** Six categories enforced server-side in award_points — must stay in sync. */
export const MANUAL_AWARD_CATEGORIES = [
  'maintenance',
  'good_performance',
  'safety_catch',
  'attendance',
  'peer_recognition',
  'other',
] as const;

export type ManualAwardCategory = (typeof MANUAL_AWARD_CATEGORIES)[number];

export const MANUAL_AWARD_CATEGORY_LABELS: Record<ManualAwardCategory, string> = {
  maintenance: 'Maintenance',
  good_performance: 'Good Performance',
  safety_catch: 'Safety Catch',
  attendance: 'Attendance',
  peer_recognition: 'Peer Recognition',
  other: 'Other',
};

export interface PointAwarderGrant {
  id: string;
  user_id: string;
  granted_by: string | null;
  granted_at: string;
  revoked_at: string | null;
  revoked_by: string | null;
  per_award_cap: number;
  monthly_budget: number;
  note: string | null;
}

export interface PointAwarderGrantWithNames extends PointAwarderGrant {
  awarder_name: string | null;
  awarder_email: string | null;
  granted_by_name: string | null;
  revoked_by_name: string | null;
}

export interface ManualAwardAuditRow {
  id: string;
  amount: number;
  category: string | null;
  reason: string | null;
  created_at: string;
  awarded_by: string | null;
  user_id: string;
  awarded_by_name: string | null;
  awarded_by_email: string | null;
  recipient_name: string | null;
  recipient_email: string | null;
}

export interface ManualAwardsAuditFilters {
  dateFrom?: string;
  dateTo?: string;
  category?: ManualAwardCategory | '';
  awarderId?: string;
  recipientId?: string;
  page?: number;
  pageSize?: number;
}

export interface AwarderBudgetHint {
  perAwardCap: number;
  monthlyBudget: number;
  monthSpent: number;
  remaining: number;
  isAdmin: boolean;
}
