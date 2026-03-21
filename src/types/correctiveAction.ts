export type ActionType = 'immediate' | 'short_term' | 'long_term' | 'systemic';
export type ActionStatus = 'open' | 'in_progress' | 'completed' | 'verified' | 'overdue';

export interface CorrectiveAction {
  id: string;
  incident_id: string;
  description: string;
  action_type: ActionType;
  assigned_to: string | null;
  assigned_to_name?: string;
  assigned_by: string | null;
  assigned_by_name?: string;
  due_date: string;
  status: ActionStatus;
  completed_at: string | null;
  completion_notes: string | null;
  verified_by: string | null;
  verified_at: string | null;
  verification_notes: string | null;
  created_at: string;
  updated_at: string;
  is_overdue: boolean;
}
