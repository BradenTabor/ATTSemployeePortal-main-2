import { describe, expect, it } from "vitest";
import { toE164, phoneLast4 } from "../../supabase/functions/_shared/phoneE164";
import {
  computeOptOutReconcileDiff,
  optOutFlagsForKeyword,
  parseInboundKeyword,
} from "../../supabase/functions/_shared/smsOptOut";
describe("toE164", () => {
  it("normalizes US 10-digit and 11-digit numbers", () => {
    expect(toE164("+1 (555) 123-4001")).toBe("+15551234001");
    expect(toE164("5551234001")).toBe("+15551234001");
    expect(toE164("15551234001")).toBe("+15551234001");
  });

  it("returns null for invalid numbers", () => {
    expect(toE164("")).toBeNull();
    expect(toE164("123")).toBeNull();
    expect(toE164("call main office")).toBeNull();
  });

  it("exposes last-4 for safe logging", () => {
    expect(toE164("+15551234001")).toBe("+15551234001");
    expect(phoneLast4("+15551234001")).toBe("4001");
  });
});

describe("parseInboundKeyword", () => {
  const stopVariants = ["STOP", "stop", " STOP ", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT"];
  it.each(stopVariants)("parses %s as STOP", (body) => {
    expect(parseInboundKeyword(body)).toBe("STOP");
  });

  it.each(["START", "start", " UNSTOP "])("parses START variants", (body) => {
    expect(parseInboundKeyword(body)).toBe("START");
  });

  it("parses HELP case-insensitively", () => {
    expect(parseInboundKeyword("help")).toBe("HELP");
    expect(parseInboundKeyword(" Help ")).toBe("HELP");
  });

  it("maps junk to OTHER", () => {
    expect(parseInboundKeyword("hello")).toBe("OTHER");
    expect(parseInboundKeyword("")).toBe("OTHER");
    expect(parseInboundKeyword("   ")).toBe("OTHER");
  });
});

describe("optOutFlagsForKeyword", () => {
  it("STOP sets both flags true; START clears both", () => {
    expect(optOutFlagsForKeyword("STOP")).toEqual({ operational: true, marketing: true });
    expect(optOutFlagsForKeyword("START")).toEqual({ operational: false, marketing: false });
    expect(optOutFlagsForKeyword("HELP")).toBeNull();
    expect(optOutFlagsForKeyword("OTHER")).toBeNull();
  });
});

describe("computeOptOutReconcileDiff", () => {
  const users = [
    {
      user_id: "u1",
      phone_number: "+15551111111",
      sms_operational_opt_out: true,
      sms_marketing_opt_out: true,
    },
    {
      user_id: "u2",
      phone_number: "+15552222222",
      sms_operational_opt_out: false,
      sms_marketing_opt_out: false,
    },
    {
      user_id: "u3",
      phone_number: "+15553333333",
      sms_operational_opt_out: true,
      sms_marketing_opt_out: false,
    },
  ];

  it("finds clicksend-only and app-only diffs", () => {
    const diff = computeOptOutReconcileDiff(
      ["+15551111111", "+15552222222", "+15554444444"],
      users
    );
    expect(diff.summary.clicksend_count).toBe(3);
    expect(diff.summary.app_opted_out_count).toBe(2);
    expect(diff.clicksend_only).toHaveLength(2);
    expect(diff.clicksend_only.map((e) => e.phone_last4).sort()).toEqual(["2222", "4444"]);
    expect(diff.app_only).toHaveLength(1);
    expect(diff.app_only[0]?.phone_last4).toBe("3333");
    expect(diff.matched).toBe(1);
  });
});
