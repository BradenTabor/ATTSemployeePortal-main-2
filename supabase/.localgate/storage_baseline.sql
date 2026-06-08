-- =============================================================================
-- Storage policies baseline — loaded AFTER prod_schema (requires public.is_admin).
-- Verbatim from prod via 20260309000000_create_safety_rewards_tables.sql lines 172-194.
-- Gate assertion 20260606040413 checks these policy names exist.
-- =============================================================================

DROP POLICY IF EXISTS "Admins can upload reward images" ON storage.objects;
CREATE POLICY "Admins can upload reward images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'safety-rewards'
    AND public.is_admin()
  );

DROP POLICY IF EXISTS "Public read for reward images" ON storage.objects;
CREATE POLICY "Public read for reward images"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'safety-rewards');

DROP POLICY IF EXISTS "Admins can update reward images" ON storage.objects;
CREATE POLICY "Admins can update reward images"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'safety-rewards' AND public.is_admin())
  WITH CHECK (bucket_id = 'safety-rewards' AND public.is_admin());

DROP POLICY IF EXISTS "Admins can delete reward images" ON storage.objects;
CREATE POLICY "Admins can delete reward images"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'safety-rewards' AND public.is_admin());
