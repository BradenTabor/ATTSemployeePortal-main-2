import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildSmsMessageLogRows,
  dryRunResultsFor,
} from "../../supabase/functions/_shared/smsMessageLog";

describe("buildSmsMessageLogRows", () => {
  it("matches ClickSend results to messages by index", () => {
    const rows = buildSmsMessageLogRows({
      messages: [
        {
          to: "+15551111111",
          body: "hello a",
          userId: "user-a",
          optOutState: { operational: false, marketing: true },
        },
        { to: "+15552222222", body: "hello b", userId: "user-b" },
      ],
      results: [
        { to: "+15551111111", status: "SUCCESS", messageId: "m1", price: "0.0048" },
        { to: "+15552222222", status: "THROTTLED", messageId: "m2", price: "0.00" },
      ],
      messageType: "payroll_reminder",
      category: "operational",
      fromNumber: "+18443781444",
      runId: "run-1",
      sourceTable: "payroll_reminder_sms_log",
      isDryRun: false,
    });

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      user_id: "user-a",
      phone_e164: "+15551111111",
      message_type: "payroll_reminder",
      category: "operational",
      from_number: "+18443781444",
      body: "hello a",
      provider_message_id: "m1",
      provider_status: "SUCCESS",
      price: 0.0048,
      opt_out_state_at_send: { operational: false, marketing: true },
      run_id: "run-1",
      source_table: "payroll_reminder_sms_log",
      is_dry_run: false,
    });
    expect(rows[1]?.provider_status).toBe("THROTTLED");
    expect(rows[1]?.price).toBe(0);
  });

  it("marks dry-run rows DRY_RUN and does not require provider ids", () => {
    const messages = [{ to: "+15553333333", body: "preview", userId: "user-c" }];
    const rows = buildSmsMessageLogRows({
      messages,
      results: dryRunResultsFor(messages),
      messageType: "safety_briefing_reminder",
      category: "operational",
      fromNumber: "+18443781444",
      isDryRun: true,
    });
    expect(rows[0]?.is_dry_run).toBe(true);
    expect(rows[0]?.provider_status).toBe("DRY_RUN");
    expect(rows[0]?.provider_message_id).toBeNull();
    expect(rows[0]?.run_id).toBeNull();
  });

  it("uses UNKNOWN when a live result is missing for an index", () => {
    const rows = buildSmsMessageLogRows({
      messages: [{ to: "+15554444444", body: "x" }],
      results: [],
      messageType: "mass_sms",
      category: "marketing",
      isDryRun: false,
    });
    expect(rows[0]?.provider_status).toBe("UNKNOWN");
  });
});

describe("sms_message_log_compat migration", () => {
  it("unions the three legacy log tables", () => {
    const sql = readFileSync(
      resolve(process.cwd(), "supabase/migrations/20260902200000_sms_message_log.sql"),
      "utf8"
    );
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.sms_message_log");
    expect(sql).toContain("sms_message_log_compat");
    expect(sql).toContain("sms_escalation_send_log");
    expect(sql).toContain("payroll_reminder_sms_log");
    expect(sql).toContain("mass_sms_log");
    expect(sql).toContain("UNION ALL");
    expect(sql).toContain("public.is_admin()");
  });
});
