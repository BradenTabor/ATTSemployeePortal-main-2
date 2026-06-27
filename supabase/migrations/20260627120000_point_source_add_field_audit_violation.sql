-- =============================================================================
-- Field Safety Audit — Migration 1/4: point_source enum extension (STANDALONE)
-- =============================================================================
-- Adds the 'field_audit_violation' source label to the point_transactions
-- ledger enum. This MUST be its own migration/transaction: PostgreSQL forbids
-- using a newly added enum value in the same transaction that adds it. The
-- partial unique index (migration 2), the CHECK constraint, and the
-- escalate_field_audit_item RPC (migration 3) all reference this label, so it
-- has to be committed first.
-- =============================================================================

ALTER TYPE public.point_source ADD VALUE IF NOT EXISTS 'field_audit_violation';
