-- ==========================================================================
-- Daily Safety Briefing: answers and answer items
-- One row per user per day (Chicago); items store each question response.
-- ==========================================================================

-- safety_briefing_answers: one row per user per day
CREATE TABLE IF NOT EXISTS public.safety_briefing_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  announcement_id uuid NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
  briefing_date date NOT NULL DEFAULT (CURRENT_DATE AT TIME ZONE 'America/Chicago')::date,
  completed_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT unique_user_briefing_per_day UNIQUE (user_id, briefing_date)
);

COMMENT ON TABLE public.safety_briefing_answers IS
  'Tracks daily safety briefing completions. One row per user per day (Chicago TZ).';

CREATE INDEX IF NOT EXISTS idx_briefing_answers_user_date
  ON public.safety_briefing_answers(user_id, briefing_date DESC);

CREATE INDEX IF NOT EXISTS idx_briefing_answers_announcement
  ON public.safety_briefing_answers(announcement_id);

ALTER TABLE public.safety_briefing_answers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own briefing answers" ON public.safety_briefing_answers;
CREATE POLICY "Users can read own briefing answers"
  ON public.safety_briefing_answers FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own briefing answers" ON public.safety_briefing_answers;
CREATE POLICY "Users can insert own briefing answers"
  ON public.safety_briefing_answers FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- is_admin() checks app_users.role = 'admin'; admins are not field-role users.
DROP POLICY IF EXISTS "Admins can read all briefing answers" ON public.safety_briefing_answers;
CREATE POLICY "Admins can read all briefing answers"
  ON public.safety_briefing_answers FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "Service role full access briefing answers" ON public.safety_briefing_answers;
CREATE POLICY "Service role full access briefing answers"
  ON public.safety_briefing_answers FOR ALL TO service_role
  USING (true) WITH CHECK (true);


-- safety_briefing_answer_items: one row per question per briefing
CREATE TABLE IF NOT EXISTS public.safety_briefing_answer_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  briefing_answer_id uuid NOT NULL
    REFERENCES public.safety_briefing_answers(id) ON DELETE CASCADE,
  question_id text NOT NULL,
  selected_option_id text NOT NULL,
  -- Coupled to BriefingQuestion['category'] in src/config/safetyBriefing.ts.
  -- If a new category is added to the config, this CHECK must be updated via a new migration.
  category text NOT NULL CHECK (category IN ('tree_safety', 'personal_health', 'announcement'))
);

COMMENT ON TABLE public.safety_briefing_answer_items IS
  'Individual question responses for a daily safety briefing completion.';

CREATE INDEX IF NOT EXISTS idx_briefing_items_parent
  ON public.safety_briefing_answer_items(briefing_answer_id);

CREATE INDEX IF NOT EXISTS idx_briefing_items_question
  ON public.safety_briefing_answer_items(question_id, selected_option_id);

ALTER TABLE public.safety_briefing_answer_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own briefing items" ON public.safety_briefing_answer_items;
CREATE POLICY "Users can read own briefing items"
  ON public.safety_briefing_answer_items FOR SELECT TO authenticated
  USING (
    briefing_answer_id IN (
      SELECT id FROM public.safety_briefing_answers WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert own briefing items" ON public.safety_briefing_answer_items;
CREATE POLICY "Users can insert own briefing items"
  ON public.safety_briefing_answer_items FOR INSERT TO authenticated
  WITH CHECK (
    briefing_answer_id IN (
      SELECT id FROM public.safety_briefing_answers WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins can read all briefing items" ON public.safety_briefing_answer_items;
CREATE POLICY "Admins can read all briefing items"
  ON public.safety_briefing_answer_items FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "Service role full access briefing items" ON public.safety_briefing_answer_items;
CREATE POLICY "Service role full access briefing items"
  ON public.safety_briefing_answer_items FOR ALL TO service_role
  USING (true) WITH CHECK (true);
