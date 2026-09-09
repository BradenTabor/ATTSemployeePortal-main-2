/**
 * US E.164 normalization — must match public.normalize_phone_to_e164() in Postgres
 * and the toE164() helpers in send-path Edge Functions.
 */
export function toE164(phone: string | null | undefined): string | null {
  const raw = (phone ?? "").trim().replace(/\D/g, "");
  if (!raw || raw.length < 10) return null;
  return raw.startsWith("1") && raw.length === 11 ? `+${raw}` : `+1${raw}`;
}

/** Last four digits for admin-safe logging (never log full numbers in reconcile diffs). */
export function phoneLast4(phone: string | null | undefined): string {
  const e164 = toE164(phone);
  if (!e164 || e164.length < 4) return "????";
  return e164.slice(-4);
}
