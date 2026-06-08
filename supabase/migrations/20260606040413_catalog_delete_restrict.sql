-- =============================================================================
-- Catalog management — explicit ON DELETE RESTRICT for redemption history integrity
-- Default FK behavior already blocked deletes; this documents intent in schema.
-- Storage: reuses existing safety-rewards bucket (admin-only INSERT via storage RLS).
-- =============================================================================

ALTER TABLE public.redemptions
  DROP CONSTRAINT IF EXISTS redemptions_item_id_fkey;

ALTER TABLE public.redemptions
  ADD CONSTRAINT redemptions_item_id_fkey
  FOREIGN KEY (item_id) REFERENCES public.reward_catalog(id) ON DELETE RESTRICT;

COMMENT ON CONSTRAINT redemptions_item_id_fkey ON public.redemptions IS
  'Prevents hard-deleting catalog items referenced by redemption history. '
  'Admins should deactivate (is_active=false) instead.';
