-- =============================================================================
-- Fix: Add answers column to pending_certification_reviews view
-- The frontend needs to display the answers for admin grading
-- =============================================================================

DROP VIEW IF EXISTS public.pending_certification_reviews;

CREATE VIEW public.pending_certification_reviews AS
SELECT 
  ca.id AS attempt_id,
  ca.user_id,
  au.full_name AS user_name,
  ct.id AS certification_type_id,
  ct.name AS certification_name,
  ct.slug AS certification_slug,
  ca.submitted_at,
  ca.total_questions,
  ca.correct_answers,
  ca.score_percentage,
  ca.answers,  -- Include the full answers JSONB for admin grading
  (
    SELECT COUNT(*)::int 
    FROM jsonb_array_elements(ca.answers) a 
    WHERE (a->>'pending_review')::boolean = true
  ) AS pending_count
FROM public.certification_attempts ca
JOIN public.certification_types ct ON ct.id = ca.certification_type_id
LEFT JOIN public.app_users au ON au.user_id = ca.user_id
WHERE ca.status = 'submitted';

COMMENT ON VIEW public.pending_certification_reviews IS
  'View of certification attempts pending admin review of short_answer questions. Includes full answers for grading UI.';
