/**
 * Certification system types.
 * Matches DB: certification_types, certification_questions, certification_attempts,
 * certification_records, practical_evaluations.
 */

export type CertificationStatus =
  | 'pending'
  | 'written_passed'
  | 'active'
  | 'expired'
  | 'revoked'
  | 'renewed';

export type AttemptStatus = 'in_progress' | 'submitted' | 'graded' | 'abandoned';

export type QuestionType = 'multiple_choice' | 'true_false' | 'short_answer';

export interface CertificationType {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category: 'equipment' | 'safety' | 'skill' | null;
  passing_score: number;
  validity_months: number;
  has_written_test: boolean;
  has_practical_eval: boolean;
  question_count: number | null;
  question_categories: Record<string, number> | null;
  is_active: boolean;
  /** When true, all authenticated users can access this cert and study guide; when false, only admins and individually granted users. */
  allow_all_users?: boolean;
  created_at: string;
  updated_at: string;
}

export interface CertificationQuestion {
  question_id: string;
  question_number: number;
  question_text: string;
  question_type: QuestionType;
  options: Record<string, string> | null;
  points: number;
  category: string | null;
}

export interface CertificationAttempt {
  id: string;
  user_id: string;
  certification_type_id: string;
  attempt_number: number;
  started_at: string;
  completed_at: string | null;
  submitted_at: string | null;
  status: AttemptStatus;
  answers: GradedAnswer[] | UnsavedAnswer[];
  total_questions: number | null;
  correct_answers: number | null;
  total_points: number | null;
  earned_points: number | null;
  score_percentage: number | null;
  passed: boolean | null;
  time_spent_seconds: number | null;
  graded_by: string | null;
  graded_at: string | null;
}

export interface GradedAnswer {
  question_id: string;
  user_answer: string;
  correct_answer: string;
  is_correct: boolean | null;
  points: number;
  pending_review?: boolean;
  question_type?: QuestionType;
}

export interface UnsavedAnswer {
  question_id: string;
  answer: string;
}

export interface CertificationRecord {
  id: string;
  user_id: string;
  certification_type_id: string;
  written_attempt_id: string | null;
  written_passed_at: string | null;
  written_score: number | null;
  practical_evaluation_id: string | null;
  practical_passed_at: string | null;
  certified_at: string | null;
  certified_by: string | null;
  expires_at: string;
  status: CertificationStatus;
  renewal_of: string | null;
  revoked_at: string | null;
  revoked_by: string | null;
  revoked_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface CanStartResult {
  can_start: boolean;
  reason: string;
  next_available_at: string | null;
}

export interface SubmitTestResult {
  passed: boolean;
  score_percentage: number;
  correct_answers: number;
  total_questions: number;
  pending_review_count: number;
  status: 'graded' | 'submitted';
}

export interface PracticalChecklistCategory {
  item_id: string;
  item_name: string;
  passed: boolean;
  notes: string;
}

export type PracticalChecklistItems = Record<string, PracticalChecklistCategory[]>;

export interface CertificationAccessGrant {
  id: string;
  user_id: string;
  certification_type_id: string;
  granted_by: string | null;
  granted_at: string;
}
