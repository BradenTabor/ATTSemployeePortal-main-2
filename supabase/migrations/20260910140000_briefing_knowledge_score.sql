-- Track whether each briefing answer was correct and store a knowledge score
-- so the daily briefing can teach, not just collect a tap.

ALTER TABLE public.safety_briefing_answer_items
  ADD COLUMN IF NOT EXISTS is_correct boolean;

COMMENT ON COLUMN public.safety_briefing_answer_items.is_correct IS
  'True/false for knowledge questions; null for check-in questions.';

ALTER TABLE public.safety_briefing_answers
  ADD COLUMN IF NOT EXISTS knowledge_score smallint,
  ADD COLUMN IF NOT EXISTS knowledge_total smallint;

COMMENT ON COLUMN public.safety_briefing_answers.knowledge_score IS
  'Count of knowledge questions answered correctly on this briefing.';
COMMENT ON COLUMN public.safety_briefing_answers.knowledge_total IS
  'Count of knowledge questions presented on this briefing.';
