/**
 * Near-miss submission hook unit tests.
 * Tests online insert, offline queue fallback, unauthenticated guard, and cache invalidation.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const singleMock = vi.fn(() =>
  Promise.resolve({ data: { id: "inc-1" }, error: null })
);
const invalidateQueriesMock = vi.fn();
const addToQueueMock = vi.fn(() => Promise.resolve("q-1"));
const isOnlineMock = vi.fn(() => true);

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

vi.mock("../../src/lib/offlineQueue", () => ({
  isOnline: (...args: unknown[]) => isOnlineMock(...args),
  addToQueue: (...args: unknown[]) => addToQueueMock(...args),
}));

vi.mock("../../src/lib/offlinePhotoStore", () => ({
  storePhotosForQueue: vi.fn(() => Promise.resolve([])),
}));

vi.mock("../../src/contexts/AuthContext", () => ({
  useAuth: vi.fn(() => ({ user: { id: "user-1" } })),
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: vi.fn(() => ({
    invalidateQueries: invalidateQueriesMock,
  })),
}));

vi.mock("../../src/lib/queryKeys", () => ({
  queryKeys: {
    safetyIncidents: { all: ["safetyIncidents"] },
  },
}));

vi.mock("date-fns-tz", () => ({
  formatInTimeZone: vi.fn((_date: Date, _tz: string, fmt: string) =>
    fmt === "yyyy-MM-dd" ? "2026-02-17" : "14:30"
  ),
}));

vi.mock("../../src/lib/logger", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

import { renderHook, act } from "@testing-library/react";
import { useNearMissSubmission } from "../../src/hooks/nearMiss/useNearMissSubmission";
import type { NearMissFormState } from "../../src/hooks/nearMiss/useNearMissValidation";

const validState: NearMissFormState = {
  category: "fall_hazard",
  description: "Loose railing on scaffold level 3",
  location: "Tower Site B",
  latitude: 33.45,
  longitude: -97.13,
  suggested_corrective_action: "Replace railing ASAP",
  photo_paths: [],
  signature: "data:image/png;base64,sig",
};

describe("useNearMissSubmission", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isOnlineMock.mockReturnValue(true);
    invalidateQueriesMock.mockResolvedValue(undefined);
  });

  it("exposes submit function", () => {
    const { result } = renderHook(() => useNearMissSubmission());
    expect(typeof result.current.submit).toBe("function");
  });

  it("returns success when online and insert succeeds", async () => {
    const { result } = renderHook(() => useNearMissSubmission());
    let out: { success?: boolean; queued?: boolean } = {};
    await act(async () => {
      out = await result.current.submit(validState);
    });
    expect(out.success).toBe(true);
    expect(out.queued).toBeUndefined();
    expect(singleMock).toHaveBeenCalledTimes(1);
  });

  it("invalidates safetyIncidents cache after successful insert", async () => {
    const { result } = renderHook(() => useNearMissSubmission());
    await act(async () => {
      await result.current.submit(validState);
    });
    expect(invalidateQueriesMock).toHaveBeenCalledWith({
      queryKey: ["safetyIncidents"],
    });
  });

  it("queues submission when offline", async () => {
    isOnlineMock.mockReturnValue(false);
    const { result } = renderHook(() => useNearMissSubmission());
    let out: { success?: boolean; queued?: boolean } = {};
    await act(async () => {
      out = await result.current.submit(validState);
    });
    expect(out.success).toBe(true);
    expect(out.queued).toBe(true);
    expect(addToQueueMock).toHaveBeenCalledTimes(1);
    expect(singleMock).not.toHaveBeenCalled();
  });

  it("returns error when insert fails", async () => {
    singleMock.mockResolvedValueOnce({
      data: null,
      error: { message: "RLS denied" },
    });
    const { result } = renderHook(() => useNearMissSubmission());
    let out: { success?: boolean; error?: Error } = {};
    await act(async () => {
      out = await result.current.submit(validState);
    });
    expect(out.success).toBe(false);
    expect(out.error?.message).toBe("RLS denied");
  });

  it("returns error when user not authenticated", async () => {
    const { useAuth } = await import("../../src/contexts/AuthContext");
    (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({ user: null });

    const { result } = renderHook(() => useNearMissSubmission());
    let out: { success?: boolean; error?: Error } = {};
    await act(async () => {
      out = await result.current.submit(validState);
    });
    expect(out.success).toBe(false);
    expect(out.error?.message).toMatch(/not authenticated/i);
  });
});
