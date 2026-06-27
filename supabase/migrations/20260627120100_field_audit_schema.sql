-- =============================================================================
-- Field Safety Audit — Migration 2/4: schema, config table, seed, settings
-- =============================================================================
-- Tables:
--   field_audits           — one row per site-visit audit (activity)
--   field_audit_subjects   — each person/equipment audited in that visit
--   field_audit_items      — Pass/Fail/NA response per checklist item per subject
--                            (subject NULL = site-scoped item, attached to audit)
--   field_notes            — persistent per-person/per-equipment memory log
--   audit_checklist_items  — CONFIG table (added to config_tables.txt this commit)
--
-- Bounded sets are text + CHECK (codebase norm). Auditor write-gate reuses the
-- existing public.is_admin_or_safety_or_gf() helper (admin, safety_officer,
-- general_foreman) — no new is_field_auditor() helper.
--
-- Citations are PROVISIONAL this gate. Line-clearance PPE/electrical items are
-- framed to 29 CFR 1910.269 (line clearance), NOT 1910.266 (logging). 1910.266(e)
-- is used only for chainsaw condition/fueling. EVERY ANSI Z133 reference below is
-- by section NAME only and is UNVERIFIED — no Z133 § numbers are asserted. An
-- authoritative citation pass lands as a follow-up config migration before Gate 3.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- field_audits
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.field_audits (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auditor_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  audit_date    date NOT NULL DEFAULT (now() AT TIME ZONE 'America/Chicago')::date,
  work_site_id  uuid REFERENCES public.work_sites(id) ON DELETE SET NULL,
  location_text text,
  foreman_id    uuid REFERENCES public.app_users(id) ON DELETE SET NULL,
  crew_id       uuid REFERENCES public.crews(id) ON DELETE SET NULL,
  crew_name     text,
  status        text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted')),
  submitted_at  timestamptz,
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT field_audits_submitted_requires_ts
    CHECK (status <> 'submitted' OR submitted_at IS NOT NULL),
  CONSTRAINT field_audits_location_present
    CHECK (work_site_id IS NOT NULL OR location_text IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_field_audits_auditor   ON public.field_audits (auditor_id, audit_date DESC);
CREATE INDEX IF NOT EXISTS idx_field_audits_status    ON public.field_audits (status);
CREATE INDEX IF NOT EXISTS idx_field_audits_date      ON public.field_audits (audit_date DESC);
CREATE INDEX IF NOT EXISTS idx_field_audits_work_site ON public.field_audits (work_site_id) WHERE work_site_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_field_audits_crew      ON public.field_audits (crew_id) WHERE crew_id IS NOT NULL;

ALTER TABLE public.field_audits ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_field_audits_updated_at ON public.field_audits;
CREATE TRIGGER trg_field_audits_updated_at
  BEFORE UPDATE ON public.field_audits
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP POLICY IF EXISTS field_audits_supervisor_all ON public.field_audits;
CREATE POLICY field_audits_supervisor_all ON public.field_audits
  FOR ALL TO authenticated
  USING (public.is_admin_or_safety_or_gf()) WITH CHECK (public.is_admin_or_safety_or_gf());

DROP POLICY IF EXISTS field_audits_auditor_select ON public.field_audits;
CREATE POLICY field_audits_auditor_select ON public.field_audits
  FOR SELECT TO authenticated USING (auditor_id = auth.uid());

-- INSERT gate = is_admin_or_safety_or_gf() (no is_field_auditor helper)
DROP POLICY IF EXISTS field_audits_auditor_insert ON public.field_audits;
CREATE POLICY field_audits_auditor_insert ON public.field_audits
  FOR INSERT TO authenticated
  WITH CHECK (auditor_id = auth.uid() AND public.is_admin_or_safety_or_gf());

DROP POLICY IF EXISTS field_audits_auditor_update ON public.field_audits;
CREATE POLICY field_audits_auditor_update ON public.field_audits
  FOR UPDATE TO authenticated
  USING (auditor_id = auth.uid() AND status = 'draft')
  WITH CHECK (auditor_id = auth.uid());

DROP POLICY IF EXISTS field_audits_service ON public.field_audits;
CREATE POLICY field_audits_service ON public.field_audits
  FOR ALL TO service_role USING (true) WITH CHECK (true);

COMMENT ON TABLE public.field_audits IS
  'Field safety audit sessions (one per site visit). Auditor write-gate = is_admin_or_safety_or_gf().';

-- -----------------------------------------------------------------------------
-- field_audit_subjects (one person OR one equipment unit per row)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.field_audit_subjects (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  field_audit_id      uuid NOT NULL REFERENCES public.field_audits(id) ON DELETE CASCADE,
  subject_type        text NOT NULL CHECK (subject_type IN ('person','equipment')),
  person_id           uuid REFERENCES public.app_users(id) ON DELETE SET NULL,
  equipment_type      text,
  equipment_number    text,
  is_custom_equipment boolean NOT NULL DEFAULT false,
  created_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT field_audit_subjects_person_xor_equipment CHECK (
    (subject_type = 'person'
      AND person_id IS NOT NULL
      AND equipment_type IS NULL AND equipment_number IS NULL AND is_custom_equipment = false)
    OR
    (subject_type = 'equipment'
      AND person_id IS NULL
      AND equipment_type IS NOT NULL AND equipment_number IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_fa_subjects_audit     ON public.field_audit_subjects (field_audit_id);
CREATE INDEX IF NOT EXISTS idx_fa_subjects_person    ON public.field_audit_subjects (person_id) WHERE person_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_fa_subjects_equipment ON public.field_audit_subjects (equipment_type, equipment_number) WHERE equipment_number IS NOT NULL;
-- dedup: one person / one equipment unit per audit
CREATE UNIQUE INDEX IF NOT EXISTS uq_fa_subjects_person
  ON public.field_audit_subjects (field_audit_id, person_id) WHERE person_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_fa_subjects_equipment
  ON public.field_audit_subjects (field_audit_id, equipment_type, equipment_number) WHERE equipment_number IS NOT NULL;

ALTER TABLE public.field_audit_subjects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS fa_subjects_supervisor_all ON public.field_audit_subjects;
CREATE POLICY fa_subjects_supervisor_all ON public.field_audit_subjects
  FOR ALL TO authenticated
  USING (public.is_admin_or_safety_or_gf()) WITH CHECK (public.is_admin_or_safety_or_gf());

DROP POLICY IF EXISTS fa_subjects_auditor_rw ON public.field_audit_subjects;
CREATE POLICY fa_subjects_auditor_rw ON public.field_audit_subjects
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.field_audits fa
                 WHERE fa.id = field_audit_id AND fa.auditor_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.field_audits fa
                 WHERE fa.id = field_audit_id AND fa.auditor_id = auth.uid()));

DROP POLICY IF EXISTS fa_subjects_service ON public.field_audit_subjects;
CREATE POLICY fa_subjects_service ON public.field_audit_subjects
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- audit_checklist_items (CONFIG — also added to config_tables.txt this commit)
-- subject_scope + equipment_types drive per-subject checklist rendering:
--   person card     → subject_scope = 'person'
--   equipment card  → subject_scope = 'equipment'
--                     AND (equipment_types IS NULL OR <unit type> = ANY(equipment_types))
--   site/audit card → subject_scope = 'site'  (rendered against the audit, no subject)
-- equipment_types NULL = applies to ALL equipment.
-- section_key is the (richer) hazard-domain grouping for reports.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_checklist_items (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_key            text NOT NULL,
  item_key               text NOT NULL UNIQUE,
  label                  text NOT NULL,
  standard_ref           text,
  subject_scope          text NOT NULL CHECK (subject_scope IN ('person','equipment','site')),
  equipment_types        text[],
  sort_order             integer NOT NULL DEFAULT 0,
  requires_photo_on_fail boolean NOT NULL DEFAULT false,
  is_active              boolean NOT NULL DEFAULT true,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT audit_checklist_items_equipment_scope_only
    CHECK (equipment_types IS NULL OR subject_scope = 'equipment')
);

CREATE INDEX IF NOT EXISTS idx_audit_checklist_items_section ON public.audit_checklist_items (section_key, sort_order);
CREATE INDEX IF NOT EXISTS idx_audit_checklist_items_scope   ON public.audit_checklist_items (subject_scope) WHERE is_active;

ALTER TABLE public.audit_checklist_items ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_audit_checklist_items_updated_at ON public.audit_checklist_items;
CREATE TRIGGER trg_audit_checklist_items_updated_at
  BEFORE UPDATE ON public.audit_checklist_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP POLICY IF EXISTS audit_checklist_items_read ON public.audit_checklist_items;
CREATE POLICY audit_checklist_items_read ON public.audit_checklist_items
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS audit_checklist_items_admin_write ON public.audit_checklist_items;
CREATE POLICY audit_checklist_items_admin_write ON public.audit_checklist_items
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS audit_checklist_items_service ON public.audit_checklist_items;
CREATE POLICY audit_checklist_items_service ON public.audit_checklist_items
  FOR ALL TO service_role USING (true) WITH CHECK (true);

COMMENT ON COLUMN public.audit_checklist_items.equipment_types IS
  'NULL = applies to all equipment. Otherwise array of equipment_type tokens '
  '(e.g. {chipper}, {chainsaw}, {Jarraff,bucket_truck}) matched with = ANY().';
COMMENT ON COLUMN public.audit_checklist_items.standard_ref IS
  'PROVISIONAL. OSHA refs framed to 1910.269 for line clearance; 1910.266(e) for '
  'chainsaw only. ALL ANSI Z133 references are by section name and UNVERIFIED '
  '(no § numbers asserted) pending an authoritative citation pass.';

-- -----------------------------------------------------------------------------
-- field_audit_items (Pass/Fail/NA per checklist item per subject)
-- field_audit_subject_id NULL => site-scoped item bound to the audit only.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.field_audit_items (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  field_audit_id         uuid NOT NULL REFERENCES public.field_audits(id) ON DELETE CASCADE,
  field_audit_subject_id uuid REFERENCES public.field_audit_subjects(id) ON DELETE CASCADE,
  checklist_item_id      uuid NOT NULL REFERENCES public.audit_checklist_items(id) ON DELETE RESTRICT,
  result                 text NOT NULL CHECK (result IN ('pass','fail','na')),
  note                   text,
  photo_path             text,
  corrective_action_id   uuid REFERENCES public.corrective_actions(id) ON DELETE SET NULL,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

-- escalation idempotency: a CAPA links to exactly one item; combined with the
-- RPC's "WHERE corrective_action_id IS NULL" claim-update this makes re-escalation a no-op.
CREATE UNIQUE INDEX IF NOT EXISTS uq_field_audit_items_corrective_action
  ON public.field_audit_items (corrective_action_id)
  WHERE corrective_action_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_fa_items_audit     ON public.field_audit_items (field_audit_id);
CREATE INDEX IF NOT EXISTS idx_fa_items_subject   ON public.field_audit_items (field_audit_subject_id) WHERE field_audit_subject_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_fa_items_checklist ON public.field_audit_items (checklist_item_id);
CREATE INDEX IF NOT EXISTS idx_fa_items_fail      ON public.field_audit_items (field_audit_id) WHERE result = 'fail';
-- one response per checklist item per subject (subject-present) / per audit (subject-null)
CREATE UNIQUE INDEX IF NOT EXISTS uq_fa_items_subject_item
  ON public.field_audit_items (field_audit_id, field_audit_subject_id, checklist_item_id) WHERE field_audit_subject_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_fa_items_audit_item
  ON public.field_audit_items (field_audit_id, checklist_item_id) WHERE field_audit_subject_id IS NULL;

ALTER TABLE public.field_audit_items ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_fa_items_updated_at ON public.field_audit_items;
CREATE TRIGGER trg_fa_items_updated_at
  BEFORE UPDATE ON public.field_audit_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP POLICY IF EXISTS fa_items_supervisor_all ON public.field_audit_items;
CREATE POLICY fa_items_supervisor_all ON public.field_audit_items
  FOR ALL TO authenticated
  USING (public.is_admin_or_safety_or_gf()) WITH CHECK (public.is_admin_or_safety_or_gf());

DROP POLICY IF EXISTS fa_items_auditor_rw ON public.field_audit_items;
CREATE POLICY fa_items_auditor_rw ON public.field_audit_items
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.field_audits fa
                 WHERE fa.id = field_audit_id AND fa.auditor_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.field_audits fa
                 WHERE fa.id = field_audit_id AND fa.auditor_id = auth.uid()));

DROP POLICY IF EXISTS fa_items_service ON public.field_audit_items;
CREATE POLICY fa_items_service ON public.field_audit_items
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- field_notes (persistent per-subject memory; outlives any single audit)
-- No SELECT policy for the audited person themselves (intentional, Gate 0).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.field_notes (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  field_audit_id      uuid REFERENCES public.field_audits(id) ON DELETE CASCADE,
  author_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_type        text NOT NULL CHECK (subject_type IN ('person','equipment')),
  person_id           uuid REFERENCES public.app_users(id) ON DELETE SET NULL,
  equipment_type      text,
  equipment_number    text,
  is_custom_equipment boolean NOT NULL DEFAULT false,
  note                text NOT NULL CHECK (length(btrim(note)) > 0),
  created_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT field_notes_person_xor_equipment CHECK (
    (subject_type = 'person'
      AND person_id IS NOT NULL
      AND equipment_type IS NULL AND equipment_number IS NULL AND is_custom_equipment = false)
    OR
    (subject_type = 'equipment'
      AND person_id IS NULL
      AND equipment_type IS NOT NULL AND equipment_number IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_field_notes_person
  ON public.field_notes (person_id, created_at DESC) WHERE person_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_field_notes_equipment
  ON public.field_notes (equipment_type, equipment_number, created_at DESC) WHERE equipment_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_field_notes_audit
  ON public.field_notes (field_audit_id) WHERE field_audit_id IS NOT NULL;

ALTER TABLE public.field_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS field_notes_supervisor_all ON public.field_notes;
CREATE POLICY field_notes_supervisor_all ON public.field_notes
  FOR ALL TO authenticated
  USING (public.is_admin_or_safety_or_gf()) WITH CHECK (public.is_admin_or_safety_or_gf());

-- author write-gate = is_admin_or_safety_or_gf() (no is_field_auditor helper)
DROP POLICY IF EXISTS field_notes_author_rw ON public.field_notes;
CREATE POLICY field_notes_author_rw ON public.field_notes
  FOR ALL TO authenticated
  USING (author_id = auth.uid())
  WITH CHECK (author_id = auth.uid() AND public.is_admin_or_safety_or_gf());

DROP POLICY IF EXISTS field_notes_service ON public.field_notes;
CREATE POLICY field_notes_service ON public.field_notes
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- Seed audit_checklist_items (v1, PROVISIONAL citations — see column comments)
-- -----------------------------------------------------------------------------
INSERT INTO public.audit_checklist_items
  (section_key, item_key, label, standard_ref, subject_scope, equipment_types, sort_order, requires_photo_on_fail)
VALUES
  -- PPE (person)
  ('ppe','ppe_head_eye_face','Head, eye, and face protection worn','OSHA 1910.269(g); ANSI Z89.1/Z87.1; ANSI Z133 (PPE)','person',NULL,10,false),
  ('ppe','ppe_hearing','Hearing protection during high-noise tasks','OSHA 1910.95; ANSI Z133 (PPE)','person',NULL,20,false),
  ('ppe','ppe_leg_chainsaw','Leg protection (chaps) worn by saw operators','OSHA 1910.269(g); ASTM F1897; ANSI Z133 (PPE)','person',NULL,30,false),
  ('ppe','ppe_hi_vis','High-visibility apparel in roadside/traffic work','MUTCD; ANSI/ISEA 107; ANSI Z133 (PPE)','person',NULL,40,false),
  ('ppe','ppe_foot_hand','Foot and hand protection appropriate to task','OSHA 1910.269(g); 1910.136/.138; ANSI Z133 (PPE)','person',NULL,50,false),
  -- Electrical hazards (person practices)
  ('electrical','elec_mad_maintained','Minimum approach distance to energized conductors maintained','OSHA 1910.269(r); 1910.333; ANSI Z133 (Electrical Hazards)','person',NULL,10,false),
  ('electrical','elec_qualified_only','Only qualified line-clearance personnel inside MAD','OSHA 1910.269(a)(2); 1910.269(r); ANSI Z133 (Electrical Hazards)','person',NULL,20,false),
  ('electrical','elec_conductor_id','Conductors identified/assumed energized before work','OSHA 1910.269(r); ANSI Z133 (Electrical Hazards)','person',NULL,30,false),
  ('electrical','elec_cover_up','Cover-up / insulating measures in place where required','OSHA 1910.269(r); ANSI Z133 (Electrical Hazards)','person',NULL,40,false),
  -- Work zone / traffic (site)
  ('work_zone','wz_tcp','Traffic control plan in place and followed','MUTCD; OSHA 1926 Subpart G; ANSI Z133 (Work Zone)','site',NULL,10,false),
  ('work_zone','wz_devices','Signs, cones, and devices set per plan','MUTCD; ANSI Z133 (Work Zone)','site',NULL,20,false),
  ('work_zone','wz_drop_zone','Drop zone established and controlled','ANSI Z133 (Work Zone / Felling)','site',NULL,30,false),
  ('work_zone','wz_public_clear','Public/pedestrians kept clear of work area','ANSI Z133 (Work Zone)','site',NULL,40,false),
  -- Vehicles & mobile equipment (all equipment)
  ('vehicles_equipment','veh_pre_use','Pre-use inspection completed (DVIR/equipment)','OSHA 1910.269(p); ANSI Z133 (Vehicles & Mobile Equipment)','equipment',NULL,10,false),
  ('vehicles_equipment','veh_secured','Wheel chocks/brakes set; outriggers deployed','OSHA 1910.269(p); ANSI Z133 (Vehicles & Mobile Equipment)','equipment',NULL,20,false),
  ('vehicles_equipment','veh_spotter','Spotter used when backing / limited visibility','OSHA 1910.269(p); ANSI Z133 (Vehicles & Mobile Equipment)','equipment',NULL,30,false),
  -- Chain saws (equipment: chainsaw)
  ('chainsaw','saw_start','Saw started safely (chain brake set; supported)','OSHA 1910.266(e); ANSI Z133 (Chain Saws)','equipment',ARRAY['chainsaw'],10,false),
  ('chainsaw','saw_grip_footing','Two-hand grip; secure footing','OSHA 1910.269(r); ANSI Z133 (Chain Saws)','equipment',ARRAY['chainsaw'],20,false),
  ('chainsaw','saw_kickback','Kickback-zone awareness; controlled bar-tip use','ANSI Z133 (Chain Saws)','equipment',ARRAY['chainsaw'],30,false),
  ('chainsaw','saw_refuel','Refuel engine-off, away from ignition','OSHA 1910.266(e)(1)(ix); ANSI Z133 (Chain Saws)','equipment',ARRAY['chainsaw'],40,false),
  -- Chippers (equipment: chipper)
  ('chipper','chip_feed','Safe feeding; no reaching into infeed','OSHA 1910.269(r)(5); ANSI Z133 (Chippers)','equipment',ARRAY['chipper'],10,false),
  ('chipper','chip_guards','Guards/curtains in place; controls functional','OSHA 1910 Subpart O; ANSI Z133 (Chippers)','equipment',ARRAY['chipper'],20,false),
  ('chipper','chip_estop','Emergency-stop / last-chance device tested','OSHA 1910.269(r)(5); ANSI Z133 (Chippers)','equipment',ARRAY['chipper'],30,false),
  -- Aerial devices (equipment: Jarraff, bucket_truck)
  ('aerial','aerial_pre_use','Aerial device pre-use inspection/tests done','OSHA 1910.67; 1926.453; ANSI A92.2; ANSI Z133 (Aerial Devices)','equipment',ARRAY['Jarraff','bucket_truck'],10,false),
  ('aerial','aerial_fall','Fall protection attached to boom/bucket anchor','OSHA 1910.67(c)(2)(v); 1910.269(g); ANSI Z133 (Aerial Devices)','equipment',ARRAY['Jarraff','bucket_truck'],20,false),
  ('aerial','aerial_setup','Stable setup; outriggers/cribbing as required','OSHA 1910.67(c)(2)(xii); ANSI A92.2; ANSI Z133 (Aerial Devices)','equipment',ARRAY['Jarraff','bucket_truck'],30,false),
  -- Climbing & rigging (person)
  ('climbing_rigging','climb_tie_in','Climber tied in with appropriate system','OSHA 1910.269(g); 1910.269(r)(7); ANSI Z133 (Climbing & Work Positioning)','person',NULL,10,false),
  ('climbing_rigging','climb_gear','Climbing/life-support gear inspected before use','OSHA 1910.269(r)(7); ANSI Z133 (Climbing & Work Positioning)','person',NULL,20,false),
  ('climbing_rigging','rig_capacity','Rigging within capacity; loads controlled','ANSI Z133 (Rigging)','person',NULL,30,false),
  ('climbing_rigging','rig_comm','Clear signals between climber and ground','ANSI Z133 (Rigging)','person',NULL,40,false),
  -- Felling / tree removal (site + feller technique)
  ('felling','fell_plan_escape','Felling plan and escape routes established','OSHA 1910.269(r); ANSI Z133 (Tree Removal)','site',NULL,10,false),
  ('felling','fell_notch_hinge','Proper notch and hinge; controlled release','OSHA 1910.269(r); ANSI Z133 (Tree Removal)','person',NULL,20,false),
  ('felling','fell_zone_clear','No personnel in felling/drop zone during cut','ANSI Z133 (Tree Removal / Drop Zone)','site',NULL,30,false),
  -- Emergency preparedness (site)
  ('emergency','emrg_rescue','Aerial-rescue plan; trained personnel on site','OSHA 1910.269(b); ANSI Z133 (Emergency / Rescue)','site',NULL,10,false),
  ('emergency','emrg_first_aid','First-aid kit and eyewash accessible','OSHA 1910.151; 1910.269(b); ANSI Z133 (First Aid)','site',NULL,20,false),
  ('emergency','emrg_comm','Means of emergency communication available','ANSI Z133 (Emergency)','site',NULL,30,false),
  ('emergency','emrg_ems_address','Job-site address known for EMS dispatch','OSHA 1910.269(b); ANSI Z133 (Emergency)','site',NULL,40,false),
  -- Housekeeping (site)
  ('housekeeping','house_debris','Work area kept clear of trip/fall debris','ANSI Z133 (Work Area)','site',NULL,10,false),
  ('housekeeping','house_fuel','Fuel and oil stored/handled safely','OSHA 1910.269; ANSI Z133 (Work Area)','site',NULL,20,false)
ON CONFLICT (item_key) DO NOTHING;

-- -----------------------------------------------------------------------------
-- app_settings: deduction config (object-shaped; admin-editable runtime value).
-- Intentionally NOT in config_tables.txt. RPC reads (value->>'violation_deduction')::int.
-- -----------------------------------------------------------------------------
INSERT INTO public.app_settings (key, value)
VALUES ('field_audit_config', '{"violation_deduction": 0}'::jsonb)
ON CONFLICT (key) DO NOTHING;
