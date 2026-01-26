-- =============================================================================
-- Add 'short_answer' to question_type check constraint
-- =============================================================================

-- Drop existing constraint and recreate with short_answer
ALTER TABLE public.certification_questions 
  DROP CONSTRAINT IF EXISTS certification_questions_question_type_check;

ALTER TABLE public.certification_questions
  ADD CONSTRAINT certification_questions_question_type_check
  CHECK (question_type IN ('multiple_choice', 'true_false', 'short_answer'));
