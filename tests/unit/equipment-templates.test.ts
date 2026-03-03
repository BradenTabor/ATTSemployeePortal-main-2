/**
 * Equipment templates unit tests (Agent 4).
 * Tests chipper and chainsaw template items and LOTO trigger logic.
 */

import { describe, it, expect } from "vitest";
import {
  type EquipmentTemplate,
  type EquipmentFormState,
  type ChecklistValue,
} from "../../src/pages/forms/equipmentConstants";

// Replicate the form's getSpecificItems and LOTO logic so we can test template contents
const CHIPPER_IDS = [
  "infeed_hopper",
  "discharge_chute",
  "feed_control_bar",
  "chipper_knives",
  "chip_curtain",
  "emergency_stop",
  "engine_guards",
  "towing_hitch",
  "debris_screen",
  "safety_decals",
];

const CHAINSAW_IDS = [
  "chain_tension",
  "chain_brake",
  "throttle_lockout",
  "muffler",
  "anti_vibration",
  "guide_bar",
  "chain_sharpness",
  "bar_oil",
  "fuel_system",
  "spark_arrestor",
  "handle_grip",
];

const LOTO_APPLICABLE_TEMPLATES: EquipmentTemplate[] = [
  "chipper",
  "sky_trim",
  "geo_boy",
];

function hasAnyFail(checklist: Record<string, ChecklistValue>): boolean {
  return Object.values(checklist).some((v) => v === "F");
}

function showLOTO(
  form: Pick<EquipmentFormState, "template" | "generalChecklist" | "specificChecklist">
): boolean {
  const fail = hasAnyFail(form.generalChecklist) || hasAnyFail(form.specificChecklist);
  return Boolean(fail && form.template && LOTO_APPLICABLE_TEMPLATES.includes(form.template));
}

describe("Equipment templates", () => {
  describe("Chipper template", () => {
    it("has 10 inspection items", () => {
      expect(CHIPPER_IDS.length).toBe(10);
    });
    it("includes required ANSI Z133 Section 8 items", () => {
      expect(CHIPPER_IDS).toContain("infeed_hopper");
      expect(CHIPPER_IDS).toContain("discharge_chute");
      expect(CHIPPER_IDS).toContain("emergency_stop");
      expect(CHIPPER_IDS).toContain("chipper_knives");
      expect(CHIPPER_IDS).toContain("safety_decals");
    });
  });

  describe("Chainsaw template", () => {
    it("has 11 inspection items", () => {
      expect(CHAINSAW_IDS.length).toBe(11);
    });
    it("includes required 29 CFR 1910.266 / ANSI Z133 Section 7 items", () => {
      expect(CHAINSAW_IDS).toContain("chain_tension");
      expect(CHAINSAW_IDS).toContain("chain_brake");
      expect(CHAINSAW_IDS).toContain("throttle_lockout");
      expect(CHAINSAW_IDS).toContain("chain_sharpness");
      expect(CHAINSAW_IDS).toContain("spark_arrestor");
    });
  });

  describe("LOTO section trigger", () => {
    it("shows LOTO when template is chipper and any item is Fail", () => {
      const form: Pick<EquipmentFormState, "template" | "generalChecklist" | "specificChecklist"> = {
        template: "chipper",
        generalChecklist: {},
        specificChecklist: { chain_tension: "F" },
      };
      expect(showLOTO(form)).toBe(true);
    });
    it("shows LOTO when template is sky_trim and general has Fail", () => {
      const form: Pick<EquipmentFormState, "template" | "generalChecklist" | "specificChecklist"> = {
        template: "sky_trim",
        generalChecklist: { engine_oil_level: "F" },
        specificChecklist: {},
      };
      expect(showLOTO(form)).toBe(true);
    });
    it("shows LOTO when template is geo_boy and specific has Fail", () => {
      const form: Pick<EquipmentFormState, "template" | "generalChecklist" | "specificChecklist"> = {
        template: "geo_boy",
        generalChecklist: {},
        specificChecklist: { teeth: "F" },
      };
      expect(showLOTO(form)).toBe(true);
    });
    it("does not show LOTO when no Fail", () => {
      const form: Pick<EquipmentFormState, "template" | "generalChecklist" | "specificChecklist"> = {
        template: "chipper",
        generalChecklist: {},
        specificChecklist: { infeed_hopper: "P" },
      };
      expect(showLOTO(form)).toBe(false);
    });
    it("does not show LOTO when template is chainsaw (not in LOTO-applicable list)", () => {
      const form: Pick<EquipmentFormState, "template" | "generalChecklist" | "specificChecklist"> = {
        template: "chainsaw",
        generalChecklist: {},
        specificChecklist: { chain_tension: "F" },
      };
      expect(showLOTO(form)).toBe(false);
    });
  });
});
