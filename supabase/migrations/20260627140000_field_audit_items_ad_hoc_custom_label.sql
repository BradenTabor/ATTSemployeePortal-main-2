-- Field Safety Audit — Chunk 3: ad-hoc (auditor-added) checklist items
-- ---------------------------------------------------------------------------
-- A field_audit_items row may now be identified by EITHER a seeded checklist
-- item (checklist_item_id) XOR a free-text custom_label entered on the fly by
-- the auditor ("+ Add item"). Seeded items keep checklist_item_id; ad-hoc items
-- carry a custom_label and a NULL checklist_item_id.
--
-- Safe/additive: field_audit_items currently has 0 rows, so the new CHECK
-- constraints validate instantly. The existing partial UNIQUE indexes keyed on
-- checklist_item_id naturally permit many ad-hoc rows per subject (NULLs are
-- distinct in a unique index), while still enforcing one response per seeded
-- item per subject/audit.
-- ---------------------------------------------------------------------------

ALTER TABLE public.field_audit_items
  ADD COLUMN IF NOT EXISTS custom_label text;

ALTER TABLE public.field_audit_items
  ALTER COLUMN checklist_item_id DROP NOT NULL;

-- exactly one identity source: seeded checklist item XOR ad-hoc custom label
ALTER TABLE public.field_audit_items
  DROP CONSTRAINT IF EXISTS chk_fa_items_identity;
ALTER TABLE public.field_audit_items
  ADD CONSTRAINT chk_fa_items_identity
  CHECK ((checklist_item_id IS NOT NULL) <> (custom_label IS NOT NULL));

-- a present custom_label must be non-blank
ALTER TABLE public.field_audit_items
  DROP CONSTRAINT IF EXISTS chk_fa_items_custom_label_nonblank;
ALTER TABLE public.field_audit_items
  ADD CONSTRAINT chk_fa_items_custom_label_nonblank
  CHECK (custom_label IS NULL OR length(btrim(custom_label)) > 0);

COMMENT ON COLUMN public.field_audit_items.custom_label IS
  'Auditor-entered label for an ad-hoc item with no audit_checklist_items config row. Mutually exclusive with checklist_item_id.';
