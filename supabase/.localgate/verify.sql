-- =============================================================================
-- Local validation gate — entry point.
-- Sources committed assertion logic from assertions.sql in this directory.
-- Any failed check RAISEs an exception so psql (ON_ERROR_STOP) fails the gate.
-- =============================================================================
\set ON_ERROR_STOP on

\ir config_lock_assertions.sql
\ir assertions.sql

SELECT 'GATE VERIFY PASSED' AS result;
