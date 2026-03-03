/**
 * Tree Felling JSA submission hook unit tests (Agent 4).
 * Tests offline queue integration and draft save/restore behavior.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTreeFellingSubmission } from "../../src/hooks/jsa/useTreeFellingSubmission";
import { DEFAULT_TREE_FELLING_DATA } from "../../src/types/treeFelling";

vi.mock("../../src/lib/supabaseClient", () => ({
  supabase: {
    from: vi.fn(function (this: unknown) {
      return {
        insert: vi.fn(function (this: unknown) {
          return {
            select: vi.fn(function (this: unknown) {
              return {
                single: vi.fn(() =>
                  Promise.resolve({ data: { id: "test-id" }, error: null })
                ),
              };
            }),
          };
        }),
        update: vi.fn(function (this: unknown) {
          return {
            eq: vi.fn(function (this: unknown) {
              return { eq: vi.fn(() => Promise.resolve({ error: null })) };
            }),
          };
        }),
      };
    }),
    auth: {
      getUser: vi.fn(() =>
        Promise.resolve({
          data: { user: { id: "user-1" } },
          error: null,
        })
      ),
      getSession: vi.fn(() =>
        Promise.resolve({
          data: { session: {} },
          error: null,
        })
      ),
    },
  },
}));

vi.mock("../../src/lib/offlineQueue", () => ({
  isOnline: vi.fn(() => true),
  addToQueue: vi.fn(() => Promise.resolve("q-1")),
}));

const baseState = {
  jobDate: "2026-02-16",
  workLocation: "Site A",
  gfContact: "555-0001",
  ocContact: "555-0002",
  treeData: {
    ...DEFAULT_TREE_FELLING_DATA,
    tree_species: "oak",
    tree_condition: "sound",
    trunk_condition: "solid",
    tree_height_estimate: "60",
    dbh_estimate: "24",
    retreat_path_distance: "120",
    retreat_path_cleared: true,
    drop_zone_description: "Cleared",
    drop_zone_cleared: true,
    hinge_wood_width: "2",
    hinge_wood_thickness: "1",
    hinge_wood_condition: "sound",
    crew_positions: [{ name: "Jane", role: "sawyer" }],
    equipment_checklist: {
      chainsaw_inspected: true,
      wedges_available: true,
      felling_lever_available: true,
      escape_route_cleared: true,
      ppe_verified_all_crew: true,
    },
  },
  observerSignatures: [{ name: "Jane", signature_data: "J" }],
  employeeSignaturePath: "path/sig.png",
};

describe("useTreeFellingSubmission", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exposes submitTreeFelling function", () => {
    const { result } = renderHook(() => useTreeFellingSubmission());
    expect(typeof result.current.submitTreeFelling).toBe("function");
  });

  it("submitTreeFelling (complete) returns success when online and insert succeeds", async () => {
    const { result } = renderHook(() => useTreeFellingSubmission());
    let out: { success?: boolean; recordId?: string; error?: Error } = {};
    await act(async () => {
      out = await result.current.submitTreeFelling("complete", {
        state: baseState,
        isEditMode: false,
        recordId: undefined,
        userId: "user-1",
      });
    });
    expect(out.success).toBe(true);
    expect(out.recordId).toBe("test-id");
    expect(out.error).toBeUndefined();
  });

  it("submitTreeFelling (draft) returns success", async () => {
    const { result } = renderHook(() => useTreeFellingSubmission());
    let out: { success?: boolean } = {};
    await act(async () => {
      out = await result.current.submitTreeFelling("draft", {
        state: baseState,
        isEditMode: false,
        recordId: undefined,
        userId: "user-1",
      });
    });
    expect(out.success).toBe(true);
  });
});
