import { describe, expect, it } from "vitest";
import {
  classifySmsExportQueryResult,
  isSmsLogRelationMissing,
} from "../../src/lib/smsExportLoadState";

describe("classifySmsExportQueryResult", () => {
  it("42P01 → unavailable", () => {
    expect(
      classifySmsExportQueryResult({
        data: null,
        error: { code: "42P01", message: 'relation "sms_message_log_compat" does not exist' },
      })
    ).toBe("unavailable");
  });

  it("PGRST205 → unavailable", () => {
    expect(
      classifySmsExportQueryResult({
        data: null,
        error: { code: "PGRST205", message: "Could not find the table 'public.sms_message_log_compat' in the schema cache" },
      })
    ).toBe("unavailable");
  });

  it("permission error → error (NOT unavailable)", () => {
    expect(
      classifySmsExportQueryResult({
        data: null,
        error: { code: "42501", message: "permission denied for view sms_message_log_compat" },
      })
    ).toBe("error");
  });

  it('arbitrary error whose message contains "does not exist" → error (NOT unavailable)', () => {
    expect(
      classifySmsExportQueryResult({
        data: null,
        error: {
          code: "42703",
          message: 'column "phone_e164" does not exist',
        },
      })
    ).toBe("error");
    expect(
      isSmsLogRelationMissing({
        code: "42703",
        message: 'column "phone_e164" does not exist',
      })
    ).toBe(false);
  });

  it("success with [] → empty", () => {
    expect(
      classifySmsExportQueryResult({
        data: [],
        error: null,
      })
    ).toBe("empty");
  });

  it("success with rows → ok", () => {
    expect(
      classifySmsExportQueryResult({
        data: [{ id: "1" }],
        error: null,
      })
    ).toBe("ok");
  });
});
