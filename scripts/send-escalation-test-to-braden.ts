/**
 * One-off: restrict Tier 2 to Braden only, clear today's send log, then trigger
 * safety-briefing-escalation-sms so one test SMS goes to Braden Tabor.
 * Restore other recipients afterward in Supabase SQL: UPDATE sms_escalation_recipients SET is_active = true WHERE tier = 2;
 *
 * Usage: npx tsx scripts/send-escalation-test-to-braden.ts
 * Requires: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in env (or .env)
 */

import { createClient } from "@supabase/supabase-js";

const PROJECT_REF = process.env.SUPABASE_PROJECT_REF ?? "emqqxfzahmwnehxcpxzp";
const SUPABASE_URL = process.env.SUPABASE_URL ?? `https://${PROJECT_REF}.supabase.co`;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function todayChicago(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
}

function sentAtChicagoDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
}

async function main() {
  if (!KEY) {
    console.error("Set SUPABASE_SERVICE_ROLE_KEY in .env or environment.");
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, KEY, { auth: { persistSession: false } });

  // 1) List Tier 2 recipients to find Braden
  const { data: recipients, error: listErr } = await supabase
    .from("sms_escalation_recipients")
    .select("id, phone_e164, label, is_active")
    .eq("tier", 2)
    .order("sort_order");

  if (listErr) {
    console.error("List recipients:", listErr.message);
    process.exit(1);
  }
  if (!recipients?.length) {
    console.error("No Tier 2 recipients in sms_escalation_recipients.");
    process.exit(1);
  }

  const braden = recipients.find((r) => r.label && /braden|tabor/i.test(r.label)) ?? recipients[0];
  const bradenId = braden.id;
  const bradenLabel = braden.label ?? braden.phone_e164 ?? bradenId;

  // 2) Deactivate all Tier 2
  const { error: deactivateErr } = await supabase
    .from("sms_escalation_recipients")
    .update({ is_active: false })
    .eq("tier", 2);

  if (deactivateErr) {
    console.error("Deactivate all Tier 2:", deactivateErr.message);
    process.exit(1);
  }

  // 3) Activate only Braden (or first recipient)
  const { error: activateErr } = await supabase
    .from("sms_escalation_recipients")
    .update({ is_active: true })
    .eq("id", bradenId);

  if (activateErr) {
    console.error("Activate Braden:", activateErr.message);
    process.exit(1);
  }
  console.log("Tier 2 restricted to:", bradenLabel);

  // 4) Delete today's Tier 2 send log so idempotency doesn't block
  const { data: logRows, error: logErr } = await supabase
    .from("sms_escalation_send_log")
    .select("id, sent_at")
    .eq("tier", 2);

  if (logErr) {
    console.error("Fetch send log:", logErr.message);
    process.exit(1);
  }

  const today = todayChicago();
  const toDelete = (logRows ?? []).filter((r) => r.sent_at && sentAtChicagoDate(r.sent_at) === today);
  if (toDelete.length > 0) {
    const { error: delErr } = await supabase
      .from("sms_escalation_send_log")
      .delete()
      .in("id", toDelete.map((r) => r.id));
    if (delErr) {
      console.error("Delete send log:", delErr.message);
      process.exit(1);
    }
    console.log("Removed", toDelete.length, "Tier 2 send log row(s) for today.");
  }

  // 5) Invoke escalation (live send)
  const url = `${SUPABASE_URL.replace(/\/$/, "")}/functions/v1/safety-briefing-escalation-sms`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
    },
    body: "{}",
  });
  const body = await res.json();
  console.log(JSON.stringify(body, null, 2));
  if (!res.ok) {
    process.exit(1);
  }
  if (body.tier2?.sent) {
    console.log("\nTier 2 SMS sent. Restore other recipients when done: UPDATE sms_escalation_recipients SET is_active = true WHERE tier = 2;");
  } else {
    console.log("\nTier 2 skipped:", body.tier2?.skippedReason ?? "unknown");
  }
}

main();
