import { phoneLast4, toE164 } from "./phoneE164.ts";

export type OptOutKeyword = "STOP" | "START" | "HELP" | "OTHER";

const STOP_VARIANTS = new Set([
  "STOP",
  "STOPALL",
  "UNSUBSCRIBE",
  "CANCEL",
  "END",
  "QUIT",
]);

const START_VARIANTS = new Set(["START", "UNSTOP"]);

export function parseInboundKeyword(body: string | null | undefined): OptOutKeyword {
  const normalized = (body ?? "").trim().toUpperCase();
  if (!normalized) return "OTHER";
  if (STOP_VARIANTS.has(normalized)) return "STOP";
  if (START_VARIANTS.has(normalized)) return "START";
  if (normalized === "HELP") return "HELP";
  return "OTHER";
}

export interface AppUserOptOutRow {
  user_id: string;
  phone_number: string | null;
  sms_operational_opt_out: boolean;
  sms_marketing_opt_out: boolean;
}

export interface OptOutReconcileDiffEntry {
  phone_e164: string;
  phone_last4: string;
  user_id: string | null;
}

export interface OptOutReconcileDiff {
  clicksend_only: OptOutReconcileDiffEntry[];
  app_only: OptOutReconcileDiffEntry[];
  matched: number;
  summary: {
    clicksend_count: number;
    app_opted_out_count: number;
    clicksend_only_count: number;
    app_only_count: number;
  };
}

export function computeOptOutReconcileDiff(
  clicksendOptOutPhones: string[],
  appUsers: AppUserOptOutRow[]
): OptOutReconcileDiff {
  const clicksendSet = new Set<string>();
  for (const phone of clicksendOptOutPhones) {
    const e164 = toE164(phone);
    if (e164) clicksendSet.add(e164);
  }

  const appOptedOutByPhone = new Map<string, AppUserOptOutRow>();
  for (const user of appUsers) {
    const e164 = toE164(user.phone_number);
    if (!e164) continue;
    if (user.sms_operational_opt_out || user.sms_marketing_opt_out) {
      appOptedOutByPhone.set(e164, user);
    }
  }

  const clicksendOnly: OptOutReconcileDiffEntry[] = [];
  for (const phone of clicksendSet) {
    if (!appOptedOutByPhone.has(phone)) {
      const match = appUsers.find((u) => toE164(u.phone_number) === phone);
      clicksendOnly.push({
        phone_e164: phone,
        phone_last4: phoneLast4(phone),
        user_id: match?.user_id ?? null,
      });
    }
  }

  const appOnly: OptOutReconcileDiffEntry[] = [];
  for (const [phone, user] of appOptedOutByPhone) {
    if (!clicksendSet.has(phone)) {
      appOnly.push({
        phone_e164: phone,
        phone_last4: phoneLast4(phone),
        user_id: user.user_id,
      });
    }
  }

  clicksendOnly.sort((a, b) => a.phone_last4.localeCompare(b.phone_last4));
  appOnly.sort((a, b) => a.phone_last4.localeCompare(b.phone_last4));

  const matched =
    clicksendSet.size - clicksendOnly.length;

  return {
    clicksend_only: clicksendOnly,
    app_only: appOnly,
    matched,
    summary: {
      clicksend_count: clicksendSet.size,
      app_opted_out_count: appOptedOutByPhone.size,
      clicksend_only_count: clicksendOnly.length,
      app_only_count: appOnly.length,
    },
  };
}

export interface OptOutFlagUpdate {
  operational: boolean;
  marketing: boolean;
}

export function optOutFlagsForKeyword(keyword: OptOutKeyword): OptOutFlagUpdate | null {
  if (keyword === "STOP") return { operational: true, marketing: true };
  if (keyword === "START") return { operational: false, marketing: false };
  return null;
}
