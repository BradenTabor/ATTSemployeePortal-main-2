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

  it("missing column → unavailable (environment is behind on migrations), but not a missing relation", () => {
    const missingColumn = {
      code: "42703",
      message: 'column "delivery_status" does not exist',
    };
    expect(classifySmsExportQueryResult({ data: null, error: missingColumn })).toBe("unavailable");
    expect(isSmsLogRelationMissing(missingColumn)).toBe(false);
  });

  it('error whose message contains "does not exist" but carries no schema code → error', () => {
    const vague = { code: "XX000", message: 'something "does not exist"' };
    expect(classifySmsExportQueryResult({ data: null, error: vague })).toBe("error");
    expect(isSmsLogRelationMissing(vague)).toBe(false);
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
