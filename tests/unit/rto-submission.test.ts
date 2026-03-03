/**
 * Request Time Off (RTO) schema validation and submission hook tests.
 * Covers Zod schema edge cases and useRTOSubmission online/error paths.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { rtoRequestSchema, rtoStatusSchema, rtoAdminActionSchema } from "../../src/schemas/rto";

// ── Schema validation ──

describe("rtoRequestSchema", () => {
  const validData = {
    start_date: "2026-03-01",
    end_date: "2026-03-05",
    reason: "Family vacation",
  };

  it("accepts valid data", () => {
    const result = rtoRequestSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it("rejects empty start_date", () => {
    const result = rtoRequestSchema.safeParse({ ...validData, start_date: "" });
    expect(result.success).toBe(false);
  });

  it("rejects empty end_date", () => {
    const result = rtoRequestSchema.safeParse({ ...validData, end_date: "" });
    expect(result.success).toBe(false);
  });

  it("rejects empty reason", () => {
    const result = rtoRequestSchema.safeParse({ ...validData, reason: "" });
    expect(result.success).toBe(false);
  });

  it("rejects reason exceeding 500 characters", () => {
    const result = rtoRequestSchema.safeParse({
      ...validData,
      reason: "x".repeat(501),
    });
    expect(result.success).toBe(false);
  });

  it("rejects end_date before start_date", () => {
    const result = rtoRequestSchema.safeParse({
      ...validData,
      start_date: "2026-03-05",
      end_date: "2026-03-01",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const endDateError = result.error.issues.find((i) => i.path.includes("end_date"));
      expect(endDateError).toBeDefined();
    }
  });

  it("accepts same start and end date", () => {
    const result = rtoRequestSchema.safeParse({
      ...validData,
      start_date: "2026-03-01",
      end_date: "2026-03-01",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid date string", () => {
    const result = rtoRequestSchema.safeParse({
      ...validData,
      start_date: "not-a-date",
    });
    expect(result.success).toBe(false);
  });
});

describe("rtoStatusSchema", () => {
  it("accepts valid statuses", () => {
    expect(rtoStatusSchema.safeParse("pending").success).toBe(true);
    expect(rtoStatusSchema.safeParse("approved").success).toBe(true);
    expect(rtoStatusSchema.safeParse("denied").success).toBe(true);
  });

  it("rejects invalid status", () => {
    expect(rtoStatusSchema.safeParse("cancelled").success).toBe(false);
    expect(rtoStatusSchema.safeParse("").success).toBe(false);
  });
});

describe("rtoAdminActionSchema", () => {
  it("accepts valid admin action", () => {
    const result = rtoAdminActionSchema.safeParse({
      requestId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      action: "approved",
    });
    expect(result.success).toBe(true);
  });

  it("rejects non-UUID requestId", () => {
    const result = rtoAdminActionSchema.safeParse({
      requestId: "not-a-uuid",
      action: "approved",
    });
    expect(result.success).toBe(false);
  });

  it("accepts optional adminNote", () => {
    const result = rtoAdminActionSchema.safeParse({
      requestId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      action: "denied",
      adminNote: "Scheduling conflict with project deadline",
    });
    expect(result.success).toBe(true);
  });

  it("rejects adminNote exceeding 500 characters", () => {
    const result = rtoAdminActionSchema.safeParse({
      requestId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      action: "denied",
      adminNote: "x".repeat(501),
    });
    expect(result.success).toBe(false);
  });
});

// ── Submission hook ──

const singleMock = vi.fn(() =>
  Promise.resolve({ data: { id: "rto-1" }, error: null })
);
const fetchMock = vi.fn(() =>
  Promise.resolve({ ok: true } as Response)
);

vi.mock("../../src/lib/supabaseClient", () => ({
  supabase: {
    from: vi.fn(() => ({
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: (...args: unknown[]) => singleMock(...args),
        })),
      })),
    })),
  },
}));

vi.mock("../../src/lib/config", () => ({
  CONFIG: {
    make: { rtoWebhook: "https://hook.example.com/rto" },
  },
}));

vi.mock("../../src/lib/logger", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

vi.mock("../../src/lib/formToast", () => ({
  formToast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock("../../src/lib/telemetry", () => ({
  trackFormSubmitted: vi.fn(),
  trackFormSubmitError: vi.fn(),
}));

import { renderHook, act } from "@testing-library/react";
import { useRTOSubmission, type RTOFormData } from "../../src/hooks/rto/useRTOSubmission";

const mockFormData: RTOFormData = {
  fullName: "John Doe",
  email: "john@atts.com",
  phoneNumber: "555-0123",
  startDate: "2026-03-01",
  endDate: "2026-03-05",
  startTime: "08:00",
  endTime: "17:00",
  totalDuration: "5 days",
  reason: "Family vacation",
  notes: "",
};

const mockTimer = { getDuration: () => 45 };

describe("useRTOSubmission", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    singleMock.mockResolvedValue({ data: { id: "rto-1" }, error: null });
    fetchMock.mockResolvedValue({ ok: true } as Response);
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  it("exposes submitRTO function", () => {
    const { result } = renderHook(() => useRTOSubmission());
    expect(typeof result.current.submitRTO).toBe("function");
  });

  it("returns success with recordId on successful submission", async () => {
    const { result } = renderHook(() => useRTOSubmission());
    let out = { success: false, recordId: "" };
    await act(async () => {
      out = await result.current.submitRTO(mockFormData, "user-1", mockTimer) as typeof out;
    });
    expect(out.success).toBe(true);
    expect(out.recordId).toBe("rto-1");
  });

  it("calls webhook after successful insert", async () => {
    const { result } = renderHook(() => useRTOSubmission());
    await act(async () => {
      await result.current.submitRTO(mockFormData, "user-1", mockTimer);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://hook.example.com/rto",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("returns error when database insert fails", async () => {
    singleMock.mockResolvedValueOnce({
      data: null,
      error: { message: "RLS policy violation" },
    });
    const { result } = renderHook(() => useRTOSubmission());
    let out = { success: true, error: "" };
    await act(async () => {
      out = await result.current.submitRTO(mockFormData, "user-1", mockTimer) as typeof out;
    });
    expect(out.success).toBe(false);
    expect(out.error).toBeTruthy();
  });

  it("succeeds even when webhook fails (non-blocking)", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false } as Response);
    const { result } = renderHook(() => useRTOSubmission());
    let out = { success: false };
    await act(async () => {
      out = await result.current.submitRTO(mockFormData, "user-1", mockTimer) as typeof out;
    });
    expect(out.success).toBe(true);
  });
});
