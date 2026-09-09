import { describe, expect, it } from "vitest";
import {
  matchStaticRecipientOptOuts,
  parseOptOutFilterValue,
  staticRecipientExclusion,
  type AppUserPhoneRow,
} from "../../supabase/functions/_shared/smsOptOutFilter";

describe("parseOptOutFilterValue", () => {
  it("is enabled by default so a missing or malformed setting still enforces consent", () => {
    expect(parseOptOutFilterValue(null)).toBe(true);
    expect(parseOptOutFilterValue(undefined)).toBe(true);
    expect(parseOptOutFilterValue({})).toBe(true);
    expect(parseOptOutFilterValue("nonsense")).toBe(true);
    expect(parseOptOutFilterValue({ enabled: "false" })).toBe(true);
  });

  it("is disabled only by an explicit boolean false", () => {
    expect(parseOptOutFilterValue({ enabled: false })).toBe(false);
    expect(parseOptOutFilterValue({ enabled: true })).toBe(true);
  });
});

describe("matchStaticRecipientOptOuts", () => {
  const rows: AppUserPhoneRow[] = [
    { user_id: "u-optout", phone_number: "+15551110001", sms_operational_opt_out: true },
    { user_id: "u-active", phone_number: "(555) 111-0002", sms_operational_opt_out: false },
    { user_id: "u-null", phone_number: "5551110003", sms_operational_opt_out: null },
  ];

  it("flags a static recipient whose matching app_users row opted out", () => {
    const { optedOut } = matchStaticRecipientOptOuts(rows, ["+15551110001"]);
    expect(optedOut.get("+15551110001")?.userIds).toEqual(["u-optout"]);
  });

  it("leaves recipients alone when the matching row has not opted out", () => {
    const { optedOut } = matchStaticRecipientOptOuts(rows, [
      "+15551110002",
      "+15551110003",
    ]);
    expect(optedOut.size).toBe(0);
  });

  it("normalizes stored phone formats before matching", () => {
    const { optedOut, unresolved } = matchStaticRecipientOptOuts(
      [{ user_id: "u", phone_number: "555 111 0002", sms_operational_opt_out: true }],
      ["+15551110002"],
    );
    expect(optedOut.has("+15551110002")).toBe(true);
    expect(unresolved).toEqual([]);
  });

  it("treats any one opted-out duplicate account as opted out", () => {
    const dupes: AppUserPhoneRow[] = [
      { user_id: "u-employee", phone_number: "+15551110009", sms_operational_opt_out: false },
      { user_id: "u-admin", phone_number: "+15551110009", sms_operational_opt_out: true },
    ];
    const { optedOut } = matchStaticRecipientOptOuts(dupes, ["+15551110009"]);
    expect(optedOut.get("+15551110009")?.userIds).toEqual(["u-admin"]);
  });

  it("reports statics with no app_users row as unresolved rather than opted out", () => {
    const { optedOut, unresolved } = matchStaticRecipientOptOuts(rows, ["+15559998888"]);
    expect(optedOut.size).toBe(0);
    expect(unresolved).toEqual(["+15559998888"]);
  });

  it("ignores app_users rows with unusable phone numbers", () => {
    const { unresolved } = matchStaticRecipientOptOuts(
      [{ user_id: "u", phone_number: "call main office", sms_operational_opt_out: true }],
      ["+15551110001"],
    );
    expect(unresolved).toEqual(["+15551110001"]);
  });
});

describe("staticRecipientExclusion", () => {
  it("records only the last four digits, never the full number", () => {
    const exclusion = staticRecipientExclusion("+15551110001", ["u-1"]);
    expect(exclusion).toEqual({
      kind: "tier2_static",
      user_id: "u-1",
      phone_last4: "0001",
      reason: "sms_operational_opt_out",
      affected_user_ids: undefined,
    });
  });

  it("lists every duplicate account when a phone maps to more than one", () => {
    expect(staticRecipientExclusion("+15551110009", ["u-1", "u-2"]).affected_user_ids).toEqual([
      "u-1",
      "u-2",
    ]);
  });
});
