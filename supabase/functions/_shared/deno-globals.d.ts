/**
 * Minimal ambient globals for the narrow `tsc` gate over the shared SMS helpers.
 * See supabase/functions/tsconfig.shared.json and
 * docs/sms-upgrade/15-TYPECHECK-REMEDIATION-PLAN.md.
 *
 * Deliberately not `"lib": ["dom"]`. The DOM lib would also resolve `window`,
 * `document` and `fetch`, none of which mean what they mean in a browser under
 * the Supabase Edge Runtime — so it would let a genuine mistake through in
 * exchange for the one global these files actually need.
 *
 * Declare only what the checked files use. If a helper starts using another
 * runtime global, add it here on purpose rather than widening the lib.
 */

declare const console: {
  log(...data: unknown[]): void;
  error(...data: unknown[]): void;
};
