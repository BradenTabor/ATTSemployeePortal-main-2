/*
  ============================================================================
  Update Migration History After Manual Application
  ============================================================================
  
  After manually applying the RLS fix migrations via SQL Editor, run this
  to update the migration history table so supabase db push works again.
  
  This marks the new migrations as applied in the supabase_migrations.schema_migrations table.
  
  ============================================================================
*/

-- Mark helper functions migration as applied
INSERT INTO supabase_migrations.schema_migrations (version, statements, name)
VALUES (
  '20251212194400',
  ARRAY[]::text[],
  'create_auth_helper_functions'
)
ON CONFLICT (version) DO NOTHING;

-- Mark app_users fix migration as applied  
INSERT INTO supabase_migrations.schema_migrations (version, statements, name)
VALUES (
  '20251212194500',
  ARRAY[]::text[],
  'fix_app_users_rls_recursion'
)
ON CONFLICT (version) DO NOTHING;

-- Verify the migrations are marked as applied
SELECT version, name 
FROM supabase_migrations.schema_migrations 
WHERE version IN ('20251212194400', '20251212194500')
ORDER BY version;

