-- =============================================================================
-- Field Safety Audit — schema hardening (follow-up to migration 2/4)
-- =============================================================================
-- Closes three gaps against the ratified directive. All four field-audit tables
-- are already live with 0 rows, so every ALTER / CHECK / policy swap below
-- validates instantly and is safe to apply to the remote DB.
--
--   (1) Immutability after submit (field_audit_subjects, field_audit_items).
--       field_audits enforces "edit only while draft" via field_audits_auditor_update
--       (status = 'draft'). The two child activity tables did NOT: fa_subjects_auditor_rw
--       and fa_items_auditor_rw were FOR ALL gated only on auditor ownership, so the
--       owning auditor could INSERT/UPDATE/DELETE subjects and items on an already
--       SUBMITTED audit. Each FOR ALL policy is split — mirroring the parent table —
--       into a status-agnostic SELECT (auditors must still review their submitted
--       work) plus INSERT/UPDATE/DELETE policies gated on the parent audit being
--       'draft'. The supervisor (is_admin_or_safety_or_gf) FOR ALL override is left
--       intact, exactly as field_audits_supervisor_all is on the parent.
--
--   (2) field_notes.note_kind + item_tag.
--       note_kind is a bounded set stored as text + CHECK (codebase norm — see the
--       migration 2/4 header; NOT a native enum). It drives the filterable note-type
--       chip selector and the PPE / equipment issuance tracking flow. item_tag is the
--       free-text per-item key (e.g. "hard hat", "chaps") for issuance queries and the
--       monthly summary's repeat-issuance flagging.
--
--   (3) Append-only field_notes.
--       field_notes_supervisor_all and field_notes_author_rw were FOR ALL, which
--       grants UPDATE and DELETE. The log is append-only — admins soft-retract with a
--       follow-up note, never an edit/delete — so both are split into FOR SELECT +
--       FOR INSERT. With no UPDATE/DELETE policy for authenticated users, historical
--       notes are immutable via RLS. field_notes_service stays FOR ALL (trusted
--       backend / data retention), matching every other table in this schema.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- (1a) field_audit_subjects — draft-only writes, status-agnostic reads
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS fa_subjects_auditor_rw ON public.field_audit_subjects;

DROP POLICY IF EXISTS fa_subjects_auditor_select ON public.field_audit_subjects;
CREATE POLICY fa_subjects_auditor_select ON public.field_audit_subjects
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.field_audits fa
                 WHERE fa.id = field_audit_id AND fa.auditor_id = auth.uid()));

DROP POLICY IF EXISTS fa_subjects_auditor_insert ON public.field_audit_subjects;
CREATE POLICY fa_subjects_auditor_insert ON public.field_audit_subjects
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.field_audits fa
                      WHERE fa.id = field_audit_id
                        AND fa.auditor_id = auth.uid()
                        AND fa.status = 'draft'));

DROP POLICY IF EXISTS fa_subjects_auditor_update ON public.field_audit_subjects;
CREATE POLICY fa_subjects_auditor_update ON public.field_audit_subjects
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.field_audits fa
                 WHERE fa.id = field_audit_id
                   AND fa.auditor_id = auth.uid()
                   AND fa.status = 'draft'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.field_audits fa
                      WHERE fa.id = field_audit_id
                        AND fa.auditor_id = auth.uid()
                        AND fa.status = 'draft'));

DROP POLICY IF EXISTS fa_subjects_auditor_delete ON public.field_audit_subjects;
CREATE POLICY fa_subjects_auditor_delete ON public.field_audit_subjects
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.field_audits fa
                 WHERE fa.id = field_audit_id
                   AND fa.auditor_id = auth.uid()
                   AND fa.status = 'draft'));

-- -----------------------------------------------------------------------------
-- (1b) field_audit_items — draft-only writes, status-agnostic reads
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS fa_items_auditor_rw ON public.field_audit_items;

DROP POLICY IF EXISTS fa_items_auditor_select ON public.field_audit_items;
CREATE POLICY fa_items_auditor_select ON public.field_audit_items
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.field_audits fa
                 WHERE fa.id = field_audit_id AND fa.auditor_id = auth.uid()));

DROP POLICY IF EXISTS fa_items_auditor_insert ON public.field_audit_items;
CREATE POLICY fa_items_auditor_insert ON public.field_audit_items
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.field_audits fa
                      WHERE fa.id = field_audit_id
                        AND fa.auditor_id = auth.uid()
                        AND fa.status = 'draft'));

DROP POLICY IF EXISTS fa_items_auditor_update ON public.field_audit_items;
CREATE POLICY fa_items_auditor_update ON public.field_audit_items
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.field_audits fa
                 WHERE fa.id = field_audit_id
                   AND fa.auditor_id = auth.uid()
                   AND fa.status = 'draft'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.field_audits fa
                      WHERE fa.id = field_audit_id
                        AND fa.auditor_id = auth.uid()
                        AND fa.status = 'draft'));

DROP POLICY IF EXISTS fa_items_auditor_delete ON public.field_audit_items;
CREATE POLICY fa_items_auditor_delete ON public.field_audit_items
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.field_audits fa
                 WHERE fa.id = field_audit_id
                   AND fa.auditor_id = auth.uid()
                   AND fa.status = 'draft'));

-- -----------------------------------------------------------------------------
-- (2) field_notes.note_kind + item_tag
-- -----------------------------------------------------------------------------
ALTER TABLE public.field_notes
  ADD COLUMN IF NOT EXISTS note_kind text NOT NULL DEFAULT 'general';

ALTER TABLE public.field_notes
  DROP CONSTRAINT IF EXISTS field_notes_note_kind_check;
ALTER TABLE public.field_notes
  ADD CONSTRAINT field_notes_note_kind_check
  CHECK (note_kind IN ('general','ppe_issued','equipment_issued','verbal_warning','repair_noted'));

ALTER TABLE public.field_notes
  ADD COLUMN IF NOT EXISTS item_tag text;

ALTER TABLE public.field_notes
  DROP CONSTRAINT IF EXISTS field_notes_item_tag_nonblank;
ALTER TABLE public.field_notes
  ADD CONSTRAINT field_notes_item_tag_nonblank
  CHECK (item_tag IS NULL OR length(btrim(item_tag)) > 0);

COMMENT ON COLUMN public.field_notes.note_kind IS
  'Bounded note type (text + CHECK, codebase norm): general | ppe_issued | '
  'equipment_issued | verbal_warning | repair_noted. Drives the note-type chip '
  'filter and PPE / equipment issuance tracking.';
COMMENT ON COLUMN public.field_notes.item_tag IS
  'Free-text item named by an issuance note (e.g. "hard hat", "chaps"). Powers '
  'per-item issuance queries and repeat-issuance flagging in the monthly summary.';

-- Issuance lookups per person (PPE / equipment summary + repeat-issuance flagging).
CREATE INDEX IF NOT EXISTS idx_field_notes_person_issuance
  ON public.field_notes (person_id, note_kind, item_tag, created_at DESC)
  WHERE person_id IS NOT NULL AND note_kind IN ('ppe_issued','equipment_issued');

-- -----------------------------------------------------------------------------
-- (3) field_notes append-only: split FOR ALL -> FOR SELECT + FOR INSERT.
--     No UPDATE/DELETE policy for authenticated => historical notes are immutable
--     via RLS. The "no SELECT for the audited person" property (migration 2/4) is
--     preserved: reads stay gated to supervisors and the note's own author.
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS field_notes_supervisor_all ON public.field_notes;
DROP POLICY IF EXISTS field_notes_author_rw ON public.field_notes;

DROP POLICY IF EXISTS field_notes_supervisor_select ON public.field_notes;
CREATE POLICY field_notes_supervisor_select ON public.field_notes
  FOR SELECT TO authenticated
  USING (public.is_admin_or_safety_or_gf());

DROP POLICY IF EXISTS field_notes_supervisor_insert ON public.field_notes;
CREATE POLICY field_notes_supervisor_insert ON public.field_notes
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_or_safety_or_gf());

DROP POLICY IF EXISTS field_notes_author_select ON public.field_notes;
CREATE POLICY field_notes_author_select ON public.field_notes
  FOR SELECT TO authenticated
  USING (author_id = auth.uid());

DROP POLICY IF EXISTS field_notes_author_insert ON public.field_notes;
CREATE POLICY field_notes_author_insert ON public.field_notes
  FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid() AND public.is_admin_or_safety_or_gf());
