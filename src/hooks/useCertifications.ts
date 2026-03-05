import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { queryKeys } from '../lib/queryKeys';
import type {
  CertificationType,
  CertificationQuestion,
  CertificationAttempt,
  CertificationRecord,
  CanStartResult,
  SubmitTestResult,
  CertificationAccessGrant,
} from '../types/certifications';

const CERT_QUERY_KEY = ['certifications'];

export interface CertificationAuditLogEntry {
  id: string;
  actor_id: string | null;
  actor_name: string | null;
  action: string;
  record_id: string | null;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  created_at: string;
}

export function useCertificationTypes() {
  return useQuery({
    queryKey: [...CERT_QUERY_KEY, 'types'],
    queryFn: async (): Promise<CertificationType[]> => {
      const { data, error } = await supabase
        .from('certification_types')
        .select('*')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data ?? [];
    },
  });
}

const CERT_STALE_MS = 10 * 60 * 1000; // 10 min for dashboard/profile cert status

export function useMyCertificationRecords(userId: string | undefined) {
  return useQuery({
    queryKey: [...CERT_QUERY_KEY, 'records', userId],
    queryFn: async (): Promise<CertificationRecord[]> => {
      const { data, error } = await supabase
        .from('certification_records')
        .select('*')
        .eq('user_id', userId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!userId,
    staleTime: CERT_STALE_MS,
  });
}

/** Admin/GF: one worker's internal (platform) cert records with type name, for expandable row. */
export interface WorkerInternalCertRecord {
  id: string;
  certification_type_id: string;
  certification_name: string;
  certification_slug: string;
  status: string;
  expires_at: string | null;
  certified_at: string | null;
  has_practical_eval: boolean;
}

/**
 * Bulk fetch: all active internal cert records across all workers.
 * Used for badge-count maps in the worker qualifications table/cards.
 * Queries certification_records directly (not the materialized view)
 * so counts are always up-to-date.
 */
export function useAllActiveInternalCertRecords() {
  return useQuery({
    queryKey: queryKeys.certifications.allActiveRecords(),
    staleTime: 10 * 60 * 1000,
    queryFn: async (): Promise<{ user_id: string; certification_type_id: string; status: string; expires_at: string | null }[]> => {
      const { data, error } = await supabase
        .from('certification_records')
        .select('user_id, certification_type_id, status, expires_at')
        .eq('status', 'active');
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useWorkerInternalCertRecords(
  userId: string | null | undefined,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: queryKeys.certifications.workerInternalRecords(userId ?? ''),
    enabled: (options?.enabled ?? true) && !!userId,
    queryFn: async (): Promise<WorkerInternalCertRecord[]> => {
      const { data, error } = await supabase
        .from('certification_records')
        .select('id, certification_type_id, status, expires_at, certified_at, cert_type:certification_types(name, slug, has_practical_eval)')
        .eq('user_id', userId!)
        .in('status', ['pending', 'written_passed', 'active', 'expired'])
        .order('certified_at', { ascending: false, nullsFirst: false });
      if (error) throw error;
      const rows = data ?? [];
      return rows.map((r) => {
        const ct = r.cert_type as { name: string; slug: string; has_practical_eval: boolean } | { name: string; slug: string; has_practical_eval: boolean }[] | null;
        const typeRow = Array.isArray(ct) ? ct[0] : ct;
        return {
          id: r.id,
          certification_type_id: r.certification_type_id,
          certification_name: typeRow?.name ?? 'Unknown',
          certification_slug: typeRow?.slug ?? '',
          status: r.status ?? '',
          expires_at: r.expires_at ?? null,
          certified_at: r.certified_at ?? null,
          has_practical_eval: typeRow?.has_practical_eval ?? false,
        };
      });
    },
  });
}

export function useMyAttempts(userId: string | undefined, certificationTypeId: string | undefined) {
  return useQuery({
    queryKey: [...CERT_QUERY_KEY, 'attempts', userId, certificationTypeId],
    queryFn: async (): Promise<CertificationAttempt[]> => {
      const { data, error } = await supabase
        .from('certification_attempts')
        .select('*')
        .eq('user_id', userId!)
        .eq('certification_type_id', certificationTypeId!)
        .order('attempt_number', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!userId && !!certificationTypeId,
  });
}

export function useInProgressAttempt(userId: string | undefined, certTypeId: string | undefined) {
  return useQuery({
    queryKey: [...CERT_QUERY_KEY, 'in-progress', userId, certTypeId],
    queryFn: async (): Promise<CertificationAttempt | null> => {
      const { data, error } = await supabase
        .from('certification_attempts')
        .select('*')
        .eq('user_id', userId!)
        .eq('certification_type_id', certTypeId!)
        .eq('status', 'in_progress')
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!userId && !!certTypeId,
  });
}

export function useCanStartAttempt(certTypeId: string | undefined) {
  return useQuery({
    queryKey: [...CERT_QUERY_KEY, 'can-start', certTypeId],
    queryFn: async (): Promise<CanStartResult> => {
      const { data, error } = await supabase.rpc('can_start_certification_attempt', {
        p_cert_type_id: certTypeId,
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      if (!row) throw new Error('No result from can_start_certification_attempt');
      return {
        can_start: row.can_start,
        reason: row.reason ?? '',
        next_available_at: row.next_available_at ?? null,
      };
    },
    enabled: !!certTypeId,
  });
}

export function useCreateAttempt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (certTypeSlug: string): Promise<string> => {
      const { data, error } = await supabase.rpc('create_certification_attempt', {
        p_cert_type_slug: certTypeSlug,
      });
      if (error) throw error;
      if (!data) throw new Error('No attempt id returned');
      return data as string;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CERT_QUERY_KEY });
    },
  });
}

export function useGetTestQuestions(certTypeSlug: string, attemptId: string | undefined) {
  return useQuery({
    queryKey: [...CERT_QUERY_KEY, 'questions', certTypeSlug, attemptId],
    queryFn: async (): Promise<CertificationQuestion[]> => {
      const { data, error } = await supabase.rpc('get_certification_test_questions', {
        p_cert_type_slug: certTypeSlug,
        p_test_attempt_id: attemptId,
      });
      if (error) throw error;
      return (data ?? []) as CertificationQuestion[];
    },
    enabled: !!certTypeSlug && !!attemptId,
  });
}

export function useSubmitTest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      attemptId,
      userAnswers,
    }: {
      attemptId: string;
      userAnswers: { question_id: string; answer: string }[];
    }): Promise<SubmitTestResult> => {
      const { data, error } = await supabase.rpc('submit_certification_test', {
        p_test_attempt_id: attemptId,
        p_user_answers: userAnswers,
      });
      if (error) {
        // Extract meaningful error message from Supabase/PostgreSQL error
        const msg = error.message || error.details || 'Unknown submission error';
        throw new Error(msg);
      }
      const row = Array.isArray(data) ? data[0] : data;
      if (!row) throw new Error('No result from submit_certification_test');
      return {
        passed: row.passed,
        score_percentage: row.score_percentage,
        correct_answers: row.correct_answers,
        total_questions: row.total_questions,
        pending_review_count: row.pending_review_count ?? 0,
        status: row.result_status ?? row.status ?? 'graded', // Handle both old and new column names
      };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CERT_QUERY_KEY });
    },
  });
}

export function useSaveAttemptAnswers() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      attemptId,
      answers,
    }: {
      attemptId: string;
      answers: { question_id: string; answer: string }[];
    }) => {
      const { error } = await supabase
        .from('certification_attempts')
        .update({ answers })
        .eq('id', attemptId)
        .eq('status', 'in_progress');
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CERT_QUERY_KEY });
    },
  });
}

export function useAbandonAttempt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (attemptId: string) => {
      const { error } = await supabase.rpc('abandon_certification_attempt', {
        p_attempt_id: attemptId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CERT_QUERY_KEY });
    },
  });
}

export interface CertificationCompletionStat {
  certification_type_id: string;
  certification_name: string;
  total_attempts: number;
  passed_users: number;
  avg_passing_score: number | null;
  avg_attempts_to_pass: number | null;
}

export interface UserCertificationMatrixRow {
  user_id: string;
  full_name: string | null;
  role: string | null;
  certification_type_id: string;
  certification_name: string;
  status: string | null;
  expires_at: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  reviewed_by_name: string | null;
  compliance_status: string;
}

export function useCertificationCompletionStats() {
  return useQuery({
    queryKey: [...CERT_QUERY_KEY, 'completion-stats'],
    queryFn: async (): Promise<CertificationCompletionStat[]> => {
      const { data, error } = await supabase.rpc('get_certification_completion_stats');
      if (error) throw error;
      return (data ?? []) as CertificationCompletionStat[];
    },
  });
}

export function useUserCertificationMatrix(
  filters?: {
    certification_type_id?: string;
    compliance_status?: string;
  },
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: [...CERT_QUERY_KEY, 'matrix', filters?.certification_type_id, filters?.compliance_status],
    queryFn: async (): Promise<UserCertificationMatrixRow[]> => {
      const { data, error } = await supabase.rpc('get_user_certification_matrix', {
        p_cert_type_id: filters?.certification_type_id ?? null,
        p_compliance_status: filters?.compliance_status ?? null,
      });
      if (error) throw error;
      return (data ?? []) as UserCertificationMatrixRow[];
    },
    enabled: options?.enabled ?? true,
  });
}

export interface PracticalTemplateRow {
  id: string;
  certification_type_id: string;
  category_name: string;
  category_order: number;
  items: { item_id: string; item_name: string }[];
  items_count: number;
}

export function usePracticalTemplates(certificationTypeId: string | undefined) {
  return useQuery({
    queryKey: [...CERT_QUERY_KEY, 'practical-templates', certificationTypeId],
    queryFn: async (): Promise<PracticalTemplateRow[]> => {
      const { data, error } = await supabase
        .from('practical_evaluation_templates')
        .select('id, certification_type_id, category_name, category_order, items, items_count')
        .eq('certification_type_id', certificationTypeId!)
        .order('category_order');
      if (error) throw error;
      return (data ?? []) as PracticalTemplateRow[];
    },
    enabled: !!certificationTypeId,
  });
}

export function useCanEvaluateUser(
  evaluateeId: string | undefined,
  certTypeId: string | undefined,
  evaluatorId: string | undefined
) {
  return useQuery({
    queryKey: [...CERT_QUERY_KEY, 'can-evaluate', evaluateeId, certTypeId, evaluatorId],
    queryFn: async (): Promise<boolean> => {
      const { data, error } = await supabase.rpc('can_evaluate_user', {
        p_evaluator_id: evaluatorId,
        p_evaluatee_id: evaluateeId,
        p_cert_type_id: certTypeId,
      });
      if (error) throw error;
      return !!data;
    },
    enabled: !!evaluateeId && !!certTypeId && !!evaluatorId,
  });
}

export function useSubmitPracticalEvaluation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      userId: string;
      certificationTypeId: string;
      checklistItems: Record<string, { item_id: string; item_name: string; passed: boolean; notes: string }[]>;
      evaluatorNotes?: string;
      evaluatorSignature?: string;
    }) => {
      const { data, error } = await supabase.rpc('submit_practical_evaluation', {
        p_user_id: params.userId,
        p_certification_type_id: params.certificationTypeId,
        p_checklist_items: params.checklistItems,
        p_evaluator_notes: params.evaluatorNotes ?? null,
        p_evaluator_signature: params.evaluatorSignature ?? null,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CERT_QUERY_KEY });
    },
  });
}

/**
 * Admin quick pass/fail for practical evaluation.
 * Loads the cert's practical template, builds a synthetic all-pass or all-fail
 * checklist, and calls the existing submit_practical_evaluation RPC.
 */
export function useAdminQuickPracticalDecision() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      userId: string;
      certificationTypeId: string;
      passed: boolean;
      evaluatorNotes?: string;
    }) => {
      const { data: templates, error: tplError } = await supabase
        .from('practical_evaluation_templates')
        .select('category_name, items')
        .eq('certification_type_id', params.certificationTypeId)
        .order('category_order');
      if (tplError) throw new Error(tplError.message ?? 'Failed to load template.');

      const checklistItems: Record<string, { item_id: string; item_name: string; passed: boolean; notes: string }[]> = {};
      if (templates && templates.length > 0) {
        for (const t of templates) {
          const items = (t.items as { item_id: string; item_name: string }[]) ?? [];
          checklistItems[t.category_name] = items.map((it) => ({
            item_id: it.item_id,
            item_name: it.item_name,
            passed: params.passed,
            notes: '',
          }));
        }
      } else {
        checklistItems['general'] = [{
          item_id: 'admin_decision',
          item_name: params.passed ? 'Admin approved practical' : 'Admin declined practical',
          passed: params.passed,
          notes: params.evaluatorNotes ?? '',
        }];
      }

      const { data, error } = await supabase.rpc('submit_practical_evaluation', {
        p_user_id: params.userId,
        p_certification_type_id: params.certificationTypeId,
        p_checklist_items: checklistItems,
        p_evaluator_notes: params.evaluatorNotes ?? (params.passed ? 'Admin quick-pass' : 'Admin quick-fail'),
        p_evaluator_signature: null,
      });
      if (error) throw new Error(error.message ?? 'Failed to submit practical decision.');
      return data as string;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CERT_QUERY_KEY });
      qc.invalidateQueries({ queryKey: queryKeys.workerQualifications.all });
    },
  });
}

// -----------------------------------------------------------------------------
// Admin grading hooks for short_answer questions
// -----------------------------------------------------------------------------

export interface PendingReview {
  attempt_id: string;
  user_id: string;
  user_name: string | null;
  certification_type_id: string;
  certification_name: string;
  certification_slug: string;
  submitted_at: string;
  total_questions: number;
  correct_answers: number;
  score_percentage: number;
  pending_count: number;
  grading_started_at: string | null;
  grading_started_by: string | null;
  grading_started_by_name: string | null;
  answers: {
    question_id: string;
    question_text?: string;  // The actual question for admin to see
    user_answer: string;
    correct_answer: string;
    is_correct: boolean | null;
    points: number;
    pending_review: boolean;
    question_type: string;
  }[];
}

export function usePendingCertificationReviews() {
  return useQuery({
    queryKey: [...CERT_QUERY_KEY, 'pending-reviews'],
    queryFn: async (): Promise<PendingReview[]> => {
      const { data, error } = await supabase
        .from('pending_certification_reviews')
        .select('*')
        .order('submitted_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as PendingReview[];
    },
  });
}

export function useSetCertificationGradingStarted() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: [...CERT_QUERY_KEY, 'set-grading-started'],
    mutationFn: async (attemptId: string) => {
      const { error } = await supabase.rpc('set_certification_grading_started', {
        p_attempt_id: attemptId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [...CERT_QUERY_KEY, 'pending-reviews'] });
    },
  });
}

export function useClearCertificationGradingStarted() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: [...CERT_QUERY_KEY, 'clear-grading-started'],
    mutationFn: async (attemptId: string) => {
      const { error } = await supabase.rpc('clear_certification_grading_started', {
        p_attempt_id: attemptId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [...CERT_QUERY_KEY, 'pending-reviews'] });
    },
  });
}

export function useAdminGradeShortAnswers() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      attemptId: string;
      grades: { question_id: string; is_correct: boolean; admin_notes?: string }[];
      userId: string;
      certificationName: string;
    }) => {
      const { data, error } = await supabase.rpc('admin_grade_short_answers', {
        p_attempt_id: params.attemptId,
        p_grades: params.grades,
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return {
        ...(row as { passed: boolean; score_percentage: number; correct_answers: number; total_questions: number }),
        userId: params.userId,
        certificationName: params.certificationName,
        attemptId: params.attemptId,
      };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CERT_QUERY_KEY });
    },
  });
}

// Hook to get user's recently graded tests (for showing result overlay)
export function useRecentlyGradedTests(userId: string | undefined) {
  return useQuery({
    queryKey: [...CERT_QUERY_KEY, 'recently-graded', userId],
    queryFn: async () => {
      // Find attempts that were graded in the last 24 hours and user hasn't seen yet
      const { data, error } = await supabase
        .from('certification_attempts')
        .select(`
          id,
          user_id,
          certification_type_id,
          status,
          passed,
          score_percentage,
          correct_answers,
          total_questions,
          graded_at,
          graded_by,
          certification_types (
            name,
            slug
          )
        `)
        .eq('user_id', userId!)
        .eq('status', 'graded')
        .not('graded_by', 'is', null)
        .gte('graded_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('graded_at', { ascending: false })
        .limit(1);
      
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });
}

// Hook to mark a graded test as seen (dismissed by user)
export function useMarkTestResultSeen() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (attemptId: string) => {
      // We'll store seen results in localStorage to avoid showing again
      const seenKey = 'atts_seen_test_results';
      const seen = JSON.parse(localStorage.getItem(seenKey) || '[]');
      if (!seen.includes(attemptId)) {
        seen.push(attemptId);
        // Keep only last 50 entries
        if (seen.length > 50) seen.shift();
        localStorage.setItem(seenKey, JSON.stringify(seen));
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CERT_QUERY_KEY });
    },
  });
}

// -----------------------------------------------------------------------------
// Admin: certification access grants (per-user, per-certification)
// -----------------------------------------------------------------------------

/** All grants; used by admin to show restricted certs and grantees per cert. */
export function useAllCertificationGrants() {
  return useQuery({
    queryKey: [...CERT_QUERY_KEY, 'access-grants'],
    queryFn: async (): Promise<CertificationAccessGrant[]> => {
      const { data, error } = await supabase
        .from('certification_access_grants')
        .select('id, user_id, certification_type_id, granted_by, granted_at')
        .order('granted_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as CertificationAccessGrant[];
    },
  });
}

export function useGrantCertificationAccess() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      userId,
      certificationTypeId,
    }: {
      userId: string;
      certificationTypeId: string;
    }) => {
      const { error } = await supabase.rpc('grant_certification_access', {
        p_user_id: userId,
        p_certification_type_id: certificationTypeId,
      });
      if (error) {
        const message = error.message ?? error.code ?? 'Failed to grant access';
        throw new Error(message);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CERT_QUERY_KEY });
    },
  });
}

export function useRevokeCertificationAccess() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      userId,
      certificationTypeId,
    }: {
      userId: string;
      certificationTypeId: string;
    }) => {
      const { error } = await supabase
        .from('certification_access_grants')
        .delete()
        .eq('user_id', userId)
        .eq('certification_type_id', certificationTypeId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CERT_QUERY_KEY });
    },
  });
}

/** Admin: set whether all users can access this certification (and its study guide). */
export function useSetCertificationAllowAllUsers() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      certificationTypeId,
      allowAllUsers,
    }: {
      certificationTypeId: string;
      allowAllUsers: boolean;
    }) => {
      const { error } = await supabase
        .from('certification_types')
        .update({ allow_all_users: allowAllUsers })
        .eq('id', certificationTypeId);
      if (error) throw new Error(error.message ?? 'Failed to update access');
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CERT_QUERY_KEY });
    },
  });
}

export function useUpdateCertificationReminderDays() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      certificationTypeId,
      reminderDays,
    }: {
      certificationTypeId: string;
      reminderDays: number[];
    }) => {
      const { error } = await supabase
        .from('certification_types')
        .update({ reminder_days: reminderDays })
        .eq('id', certificationTypeId);
      if (error) throw new Error(error.message ?? 'Failed to update reminder schedule');
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CERT_QUERY_KEY });
    },
  });
}

/** Admin/safety_officer: last 50 certification audit log entries with actor names. */
export function useCertificationAuditLog(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.certifications.auditLog(50),
    enabled: options?.enabled ?? true,
    queryFn: async (): Promise<CertificationAuditLogEntry[]> => {
      const { data: rows, error } = await supabase
        .from('certification_audit_log')
        .select('id, actor_id, action, record_id, old_value, new_value, created_at')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw new Error(error.message ?? 'Failed to load audit log');
      const list = rows ?? [];
      const actorIds = [...new Set(list.map((r) => r.actor_id).filter(Boolean))] as string[];
      const nameMap: Record<string, string> = {};
      if (actorIds.length > 0) {
        const { data: users } = await supabase
          .from('app_users')
          .select('user_id, full_name')
          .in('user_id', actorIds);
        for (const u of users ?? []) {
          if (u.full_name) nameMap[u.user_id] = u.full_name;
        }
      }
      return list.map((r) => ({
        id: r.id,
        actor_id: r.actor_id ?? null,
        actor_name: (r.actor_id && nameMap[r.actor_id]) ?? null,
        action: r.action,
        record_id: r.record_id ?? null,
        old_value: r.old_value as Record<string, unknown> | null,
        new_value: r.new_value as Record<string, unknown> | null,
        created_at: r.created_at,
      }));
    },
  });
}
