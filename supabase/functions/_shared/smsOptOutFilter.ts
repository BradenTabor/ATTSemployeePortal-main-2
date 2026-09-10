/**
 * Operational opt-out enforcement for scheduled SMS send paths.
 *
 * ClickSend's opt-out list is only consulted for sends addressed to a contact
 * list. Every portal send is ad-hoc to a raw `to` number, so the carrier never
 * suppresses an opted-out recipient. Enforcement has to happen here.
 *
 * Kill switch: app_settings.sms_send_optout_filter_config -> {"enabled": bool}.
 * An absent row and an unreadable settings table both resolve to enabled, so a
 * settings outage cannot quietly turn consent enforcement off.
 */

import { phoneLast4, toE164 } from "./phoneE164.ts";

// deno-lint-ignore no-explicit-any
type SupabaseLike = { from: (table: string) => any };

export const OPT_OUT_FILTER_SETTING_KEY = "sms_send_optout_filter_config";

export type OptOutFilterSource =
  | "app_settings"
  | "default_missing_row"
  | "default_read_error";

export interface OptOutFilterConfig {
  enabled: boolean;
  source: OptOutFilterSource;
}

/** One suppressed recipient. Every field is safe to persist in an audit row. */
export interface OptOutExclusion {
  kind: "recipient" | "tier1_manager" | "tier2_static";
  user_id: string | null;
  phone_last4: string;
  reason: "sms_operational_opt_out";
  /** tier1_manager only: overdue crew who consequently receive no Tier 1 nudge. */
  affected_user_ids?: string[];
}

export interface AppUserPhoneRow {
  user_id: string;
  phone_number: string | null;
  sms_operational_opt_out?: boolean | null;
}

/** Opt-in to disabling: only an explicit `false` turns the filter off. */
export function parseOptOutFilterValue(value: unknown): boolean {
  if (value === null || typeof value !== "object") return true;
  return (value as Record<string, unknown>).enabled !== false;
}

export async function loadOptOutFilterConfig(
  supabase: SupabaseLike,
): Promise<OptOutFilterConfig> {
  const { data, error } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", OPT_OUT_FILTER_SETTING_KEY)
    .maybeSingle();

  if (error) {
    console.error("[smsOptOutFilter] settings read failed; enforcing filter", {
      key: OPT_OUT_FILTER_SETTING_KEY,
      error: error.message,
    });
    return { enabled: true, source: "default_read_error" };
  }
  if (!data) return { enabled: true, source: "default_missing_row" };
  return { enabled: parseOptOutFilterValue(data.value), source: "app_settings" };
}

export function isOperationallyOptedOut(
  row: { sms_operational_opt_out?: boolean | null } | null | undefined,
): boolean {
  return row?.sms_operational_opt_out === true;
}

export interface StaticOptOutMatch {
  optedOut: Map<string, { userIds: string[] }>;
  unresolved: string[];
}

/**
 * Match `sms_escalation_recipients.phone_e164` against normalized
 * `app_users.phone_number`. A phone can map to more than one app_users row
 * (duplicate accounts); any one of them opted out means the person opted out,
 * because consent belongs to the human, not the row.
 *
 * `unresolved` are statics with no app_users row at all — genuinely external
 * numbers whose consent state is unknowable here.
 */
export function matchStaticRecipientOptOuts(
  rows: AppUserPhoneRow[],
  phonesE164: string[],
): StaticOptOutMatch {
  const optedOut = new Map<string, { userIds: string[] }>();
  const wanted = new Set(phonesE164);
  const matched = new Set<string>();

  for (const row of rows) {
    const e164 = toE164(row.phone_number);
    if (!e164 || !wanted.has(e164)) continue;
    matched.add(e164);
    if (!isOperationallyOptedOut(row)) continue;
    const entry = optedOut.get(e164) ?? { userIds: [] };
    entry.userIds.push(row.user_id);
    optedOut.set(e164, entry);
  }

  return {
    optedOut,
    unresolved: [...wanted].filter((p) => !matched.has(p)),
  };
}

/**
 * Fail-open by design: if the lookup errors we cannot tell who opted out, and
 * dropping every static recipient would empty a safety escalation list. The
 * caller receives `resolutionError` and must surface it loudly.
 */
export async function resolveStaticRecipientOptOuts(
  supabase: SupabaseLike,
  phonesE164: string[],
): Promise<StaticOptOutMatch & { resolutionError: string | null }> {
  if (phonesE164.length === 0) {
    return { optedOut: new Map(), unresolved: [], resolutionError: null };
  }

  const { data, error } = await supabase
    .from("app_users")
    .select("user_id, phone_number, sms_operational_opt_out")
    .not("phone_number", "is", null)
    .not("email", "ilike", "%@atts.test");

  if (error) {
    return { optedOut: new Map(), unresolved: [], resolutionError: error.message };
  }

  return {
    ...matchStaticRecipientOptOuts((data ?? []) as AppUserPhoneRow[], phonesE164),
    resolutionError: null,
  };
}

export function staticRecipientExclusion(
  phoneE164: string,
  userIds: string[],
): OptOutExclusion {
  return {
    kind: "tier2_static",
    user_id: userIds[0] ?? null,
    phone_last4: phoneLast4(phoneE164),
    reason: "sms_operational_opt_out",
    affected_user_ids: userIds.length > 1 ? userIds : undefined,
  };
}

/** Structured per-run line so an exclusion is explainable from logs alone. */
export function logOptOutSummary(
  fnName: string,
  detail: Record<string, unknown>,
): void {
  console.log(`[${fnName}] operational opt-out filter`, detail);
}
