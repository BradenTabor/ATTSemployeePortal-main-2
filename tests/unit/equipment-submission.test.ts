/**
 * Equipment form submission helpers and state management unit tests.
 * Tests form state creation, draft normalization, checklist retrieval, and percentage calc.
 */

import { describe, it, expect } from "vitest";
import {
  createInitialEquipmentFormState,
  normalizeFormStateFromDraft,
  getSpecificItems,
  calcPercentage,
  PHOTO_DEFINITIONS,
  REQUIRED_PHOTO_KEYS,
  PHOTO_KEYS_ORDER,
  EQUIPMENT_PHOTO_BUCKET,
  SKY_TRIM_ITEMS,
  GEO_BOY_ITEMS,
  SKID_STEER_ITEMS,
  CHIPPER_ITEMS,
  CHAINSAW_ITEMS,
  GENERAL_ITEMS,
  EQUIPMENT_TYPE_OPTIONS,
  EQUIPMENT_NUMBERS_BY_TYPE,
} from "../../src/pages/forms/equipmentConstants";

describe("equipmentConstants", () => {
  describe("createInitialEquipmentFormState", () => {
    it("returns a valid initial state with empty fields", () => {
      const state = createInitialEquipmentFormState();
      expect(state.submittedBy).toBe("");
      expect(state.equipmentType).toBe("");
      expect(state.equipmentNumber).toBe("");
      expect(state.template).toBe("");
      expect(state.notes).toBe("");
      expect(state.generalChecklist).toEqual({});
      expect(state.specificChecklist).toEqual({});
      expect(state.lotoData).toBeNull();
    });

    it("sets inspectionDate to today in YYYY-MM-DD format", () => {
      const state = createInitialEquipmentFormState();
      expect(state.inspectionDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it("returns a new object each call (no shared references)", () => {
      const a = createInitialEquipmentFormState();
      const b = createInitialEquipmentFormState();
      expect(a).not.toBe(b);
      expect(a.generalChecklist).not.toBe(b.generalChecklist);
    });
  });

  describe("normalizeFormStateFromDraft", () => {
    it("passes through state with null lotoData unchanged", () => {
      const state = createInitialEquipmentFormState();
      const result = normalizeFormStateFromDraft(state);
      expect(result).toEqual(state);
    });

    it("passes through state with valid LOTOData shape", () => {
      const state = {
        ...createInitialEquipmentFormState(),
        lotoData: {
          procedure_followed: true,
          lockout_device_applied: true,
          tagout_attached: true,
          zero_energy_verified: false,
          authorized_employee: "John",
          lockout_datetime: "2026-02-17T08:00",
        },
      };
      const result = normalizeFormStateFromDraft(state);
      expect(result.lotoData?.procedure_followed).toBe(true);
      expect(result.lotoData?.authorized_employee).toBe("John");
    });

    it("normalizes legacy EquipmentLOTOData shape (applied_by/applied_at)", () => {
      const legacyState = {
        ...createInitialEquipmentFormState(),
        lotoData: {
          applied_by: "Jane",
          applied_at: "2026-01-15T09:30",
        } as unknown as typeof createInitialEquipmentFormState extends () => infer R ? NonNullable<R["lotoData"]> : never,
      };
      const result = normalizeFormStateFromDraft(legacyState);
      expect(result.lotoData).toBeDefined();
      expect(result.lotoData!.authorized_employee).toBe("Jane");
      expect(result.lotoData!.lockout_datetime).toBe("2026-01-15T09:30");
      expect(result.lotoData!.procedure_followed).toBe(false);
    });
  });

  describe("getSpecificItems", () => {
    it("returns SKY_TRIM_ITEMS for sky_trim", () => {
      expect(getSpecificItems("sky_trim")).toBe(SKY_TRIM_ITEMS);
      expect(getSpecificItems("sky_trim").length).toBeGreaterThan(0);
    });

    it("returns GEO_BOY_ITEMS for geo_boy", () => {
      expect(getSpecificItems("geo_boy")).toBe(GEO_BOY_ITEMS);
    });

    it("returns SKID_STEER_ITEMS for skid_steer", () => {
      expect(getSpecificItems("skid_steer")).toBe(SKID_STEER_ITEMS);
    });

    it("returns CHIPPER_ITEMS for chipper", () => {
      expect(getSpecificItems("chipper")).toBe(CHIPPER_ITEMS);
    });

    it("returns CHAINSAW_ITEMS for chainsaw", () => {
      expect(getSpecificItems("chainsaw")).toBe(CHAINSAW_ITEMS);
    });

    it("returns empty array for empty string template", () => {
      expect(getSpecificItems("")).toEqual([]);
    });

    it("each checklist group has unique IDs", () => {
      const groups = [SKY_TRIM_ITEMS, GEO_BOY_ITEMS, SKID_STEER_ITEMS, CHIPPER_ITEMS, CHAINSAW_ITEMS, GENERAL_ITEMS];
      for (const group of groups) {
        const ids = group.map((item) => item.id);
        expect(new Set(ids).size).toBe(ids.length);
      }
    });
  });

  describe("calcPercentage", () => {
    it("returns 0 for 0/0", () => {
      expect(calcPercentage(0, 0)).toBe(0);
    });

    it("returns 50 for 1/2", () => {
      expect(calcPercentage(1, 2)).toBe(50);
    });

    it("returns 100 for equal values", () => {
      expect(calcPercentage(5, 5)).toBe(100);
    });

    it("rounds to nearest integer", () => {
      expect(calcPercentage(1, 3)).toBe(33);
      expect(calcPercentage(2, 3)).toBe(67);
    });
  });

  describe("photo constants", () => {
    it("PHOTO_DEFINITIONS has all 4 photo types", () => {
      expect(PHOTO_DEFINITIONS).toHaveLength(4);
      const keys = PHOTO_DEFINITIONS.map((p) => p.key);
      expect(keys).toContain("overview");
      expect(keys).toContain("damage");
      expect(keys).toContain("attachments");
      expect(keys).toContain("hydraulic");
    });

    it("REQUIRED_PHOTO_KEYS includes only required photos", () => {
      expect(REQUIRED_PHOTO_KEYS).toContain("hydraulic");
      expect(REQUIRED_PHOTO_KEYS).not.toContain("overview");
    });

    it("PHOTO_KEYS_ORDER matches PHOTO_DEFINITIONS order", () => {
      expect(PHOTO_KEYS_ORDER).toEqual(PHOTO_DEFINITIONS.map((p) => p.key));
    });

    it("EQUIPMENT_PHOTO_BUCKET is a non-empty string", () => {
      expect(EQUIPMENT_PHOTO_BUCKET).toBeTruthy();
      expect(typeof EQUIPMENT_PHOTO_BUCKET).toBe("string");
    });
  });

  describe("equipment type constants", () => {
    it("EQUIPMENT_TYPE_OPTIONS has all types", () => {
      expect(EQUIPMENT_TYPE_OPTIONS.length).toBeGreaterThanOrEqual(5);
    });

    it("every equipment type has numbered equipment", () => {
      for (const type of EQUIPMENT_TYPE_OPTIONS) {
        const numbers = EQUIPMENT_NUMBERS_BY_TYPE[type];
        expect(numbers).toBeDefined();
        expect(numbers.length).toBeGreaterThan(0);
      }
    });
  });
});
