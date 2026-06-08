-- Normalized schema introspection for migration↔prod reconciliation (Gate 0).
-- Scopes: auth + public. Output: one object per line, sorted for diffing.
-- Run: psql -v ON_ERROR_STOP=1 -q -t -A -f recon/introspect.sql

\pset tuples_only on
\pset format unaligned

SELECT '=== ENUM ===' AS section
UNION ALL SELECT '=== TABLES ==='
UNION ALL SELECT '=== COLUMNS ==='
UNION ALL SELECT '=== CONSTRAINTS ==='
UNION ALL SELECT '=== INDEXES ==='
UNION ALL SELECT '=== FUNCTIONS ==='
UNION ALL SELECT '=== TRIGGERS ==='
UNION ALL SELECT '=== POLICIES ==='
UNION ALL SELECT '=== VIEWS ===';

-- ENUM types
SELECT 'ENUM|' || n.nspname || '.' || t.typname || '|' || e.enumlabel
FROM pg_type t
JOIN pg_namespace n ON n.oid = t.typnamespace
JOIN pg_enum e ON e.enumtypid = t.oid
WHERE n.nspname IN ('auth', 'public')
ORDER BY 1;

SELECT '---';

-- Tables (excluding toast/composite internals)
SELECT 'TABLE|' || n.nspname || '.' || c.relname || '|' || c.relpersistence::text
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind = 'r'
  AND n.nspname IN ('auth', 'public')
  AND c.relname NOT LIKE 'pg_%'
ORDER BY 1;

SELECT '---';

-- Columns
SELECT 'COLUMN|' || n.nspname || '.' || c.relname || '.' || a.attname
  || '|' || pg_catalog.format_type(a.atttypid, a.atttypmod)
  || '|' || CASE WHEN a.attnotnull THEN 'NOT NULL' ELSE 'NULL' END
  || '|' || COALESCE(pg_get_expr(ad.adbin, ad.adrelid), '')
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN pg_attribute a ON a.attrelid = c.oid
LEFT JOIN pg_attrdef ad ON ad.adrelid = c.oid AND ad.adnum = a.attnum
WHERE c.relkind IN ('r', 'v', 'm')
  AND n.nspname IN ('auth', 'public')
  AND a.attnum > 0
  AND NOT a.attisdropped
ORDER BY 1;

SELECT '---';

-- Constraints (PK, FK, UNIQUE, CHECK)
SELECT 'CONSTRAINT|' || n.nspname || '.' || c.relname || '.' || con.conname
  || '|' || con.contype::text::text
  || '|' || pg_get_constraintdef(con.oid, true)
FROM pg_constraint con
JOIN pg_class c ON c.oid = con.conrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname IN ('auth', 'public')
ORDER BY 1;

SELECT '---';

-- Indexes (non-constraint-backed)
SELECT 'INDEX|' || n.nspname || '.' || c.relname || '.' || i.relname
  || '|' || pg_get_indexdef(ix.indexrelid)
FROM pg_index ix
JOIN pg_class c ON c.oid = ix.indrelid
JOIN pg_class i ON i.oid = ix.indexrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname IN ('auth', 'public')
  AND NOT ix.indisprimary
  AND NOT ix.indisunique
ORDER BY 1;

SELECT '---';

-- Functions (name, args, normalized body)
SELECT 'FUNCTION|' || n.nspname || '.' || p.proname
  || '|' || pg_get_function_identity_arguments(p.oid)
  || '|' || regexp_replace(COALESCE(p.prosrc, ''), '\s+', ' ', 'g')
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname IN ('auth', 'public')
  AND p.prokind = 'f'
ORDER BY 1;

SELECT '---';

-- Triggers
SELECT 'TRIGGER|' || n.nspname || '.' || c.relname || '.' || t.tgname
  || '|' || pg_get_triggerdef(t.oid, true)
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname IN ('auth', 'public')
  AND NOT t.tgisinternal
ORDER BY 1;

SELECT '---';

-- RLS policies
SELECT 'POLICY|' || schemaname || '.' || tablename || '.' || policyname
  || '|' || COALESCE(roles::text, '')
  || '|' || cmd
  || '|' || COALESCE(qual, '')
  || '|' || COALESCE(with_check, '')
FROM pg_policies
WHERE schemaname IN ('auth', 'public')
ORDER BY 1;

SELECT '---';

-- Views (normalized definition)
SELECT 'VIEW|' || n.nspname || '.' || c.relname
  || '|' || regexp_replace(pg_get_viewdef(c.oid, true), '\s+', ' ', 'g')
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind IN ('v', 'm')
  AND n.nspname IN ('auth', 'public')
ORDER BY 1;
