/**
 * Classify SMS compliance export query outcomes.
 * Unavailable must never look like an empty date range.
 */

export type SmsExportLoadState = "unavailable" | "error" | "empty" | "ok";

export const SMS_LOG_UNAVAILABLE_MESSAGE =
  "SMS log not available — migration 20260902200000 has not been applied to this environment.";

export const SMS_LOG_COLUMN_MISSING_MESSAGE =
  "SMS log is missing the delivery-receipt columns — migration 20260909190000 has not been applied to this environment.";

/**
 * The opt-out event log is a separate table from the send log and shipped in a separate
 * migration, so it can be missing while the send log is present. Naming its own migration
 * keeps the remedy actionable instead of pointing at the wrong one.
 */
export const SMS_OPT_OUT_EVENTS_UNAVAILABLE_MESSAGE =
  "SMS opt-out event log not available — migration 20260909110000 has not been applied to this environment.";

/** PostgREST missing-relation / Postgres undefined-table only — no free-text regex. */
export function isSmsLogRelationMissing(error: {
  code?: string | null;
  message?: string | null;
} | null): boolean {
  if (!error) return false;
  return error.code === "PGRST205" || error.code === "42P01";
}

/**
 * A column the export selects does not exist yet. Same user-facing outcome as a missing
 * relation — the environment is behind on migrations — and must not read as an empty range.
 */
export function isSmsLogColumnMissing(error: {
  code?: string | null;
  message?: string | null;
} | null): boolean {
  if (!error) return false;
  return error.code === "PGRST204" || error.code === "42703";
}

export function classifySmsExportQueryResult(input: {
  data: unknown[] | null;
  error: { code?: string | null; message?: string | null } | null;
}): SmsExportLoadState {
  if (input.error) {
    if (isSmsLogRelationMissing(input.error) || isSmsLogColumnMissing(input.error)) return "unavailable";
    return "error";
  }
  const rows = input.data ?? [];
  if (rows.length === 0) return "empty";
  return "ok";
}

export class SmsLogUnavailableError extends Error {
  readonly kind = "SMS_LOG_UNAVAILABLE" as const;

  constructor(message = SMS_LOG_UNAVAILABLE_MESSAGE) {
    super(message);
    this.name = "SmsLogUnavailableError";
  }
}

export function isSmsLogUnavailableError(error: unknown): error is SmsLogUnavailableError {
  return (
    error instanceof SmsLogUnavailableError ||
    (typeof error === "object" &&
      error !== null &&
      "kind" in error &&
      (error as { kind: unknown }).kind === "SMS_LOG_UNAVAILABLE")
  );
}
