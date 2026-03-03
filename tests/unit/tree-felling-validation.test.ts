/**
 * Tree Felling JSA validation unit tests (Agent 4).
 * Tests validateTreeFellingCompleted, retreat path angle, crew minimum, equipment checklist, draft vs completed.
 */

import { describe, it, expect } from "vitest";
import { validateTreeFellingCompleted } from "../../src/hooks/jsa/useTreeFellingValidation";
import type { TreeFellingFormState } from "../../src/hooks/jsa/useTreeFellingValidation";
import {
  DEFAULT_TREE_FELLING_DATA,
  type TreeFellingData,
  type CompassDirection,
} from "../../src/types/treeFelling";

function buildState(overrides: Partial<TreeFellingFormState> = {}): TreeFellingFormState {
  const treeData: TreeFellingData = {
    ...DEFAULT_TREE_FELLING_DATA,
    ...(overrides.treeData ?? {}),
  };
  return {
    jobDate: "",
    workLocation: "",
    gfContact: "",
    ocContact: "",
    employeeSignaturePath: "",
    ...overrides,
    treeData: overrides.treeData ?? treeData,
  };
}

describe("Tree Felling validation", () => {
  describe("required fields block blank submission", () => {
    it("returns errors for empty form when submitting as completed", () => {
      const state = buildState();
      const errors = validateTreeFellingCompleted(state);
      expect(Object.keys(errors).length).toBeGreaterThan(0);
      expect(errors.jobDate).toBe("Job date is required.");
      expect(errors.workLocation).toBe("Work location is required.");
      expect(errors.tree_species).toBe("Tree species is required.");
      expect(errors.crew_positions).toBe("At least one crew member is required.");
      expect(errors.retreat_path_cleared).toBe("Retreat path must be cleared of obstacles.");
      expect(errors.drop_zone_cleared).toBe("Drop zone must be cleared of personnel and obstacles.");
    });

    it("requires all 5 equipment checklist items checked", () => {
      const state = buildState({
        jobDate: "2026-02-16",
        workLocation: "Site A",
        gfContact: "555-0001",
        ocContact: "555-0002",
        employeeSignaturePath: "path/sig.png",
        treeData: {
          ...DEFAULT_TREE_FELLING_DATA,
          tree_species: "oak",
          tree_condition: "sound",
          trunk_condition: "solid",
          tree_height_estimate: "60 ft",
          dbh_estimate: "24 in",
          retreat_path_distance: "120 ft",
          retreat_path_cleared: true,
          drop_zone_description: "Cleared area",
          drop_zone_cleared: true,
          hinge_wood_width: "2 in",
          hinge_wood_thickness: "1 in",
          hinge_wood_condition: "sound",
          crew_positions: [{ name: "Jane", role: "sawyer" }],
          equipment_checklist: {
            chainsaw_inspected: true,
            wedges_available: true,
            felling_lever_available: true,
            escape_route_cleared: false,
            ppe_verified_all_crew: true,
          },
        },
      });
      const errors = validateTreeFellingCompleted(state);
      expect(errors.equipment_escape_route).toBe("Escape route cleared is required.");
    });
  });

  describe("retreat path angle check", () => {
    it("allows retreat path ≥90° from fall path", () => {
      const state = buildState({
        jobDate: "2026-02-16",
        workLocation: "Site",
        gfContact: "1",
        ocContact: "2",
        employeeSignaturePath: "x",
        treeData: {
          ...DEFAULT_TREE_FELLING_DATA,
          fall_path: "N" as CompassDirection,
          retreat_path_direction: "E" as CompassDirection, // 90°
          tree_species: "oak",
          tree_condition: "sound",
          trunk_condition: "solid",
          tree_height_estimate: "60",
          dbh_estimate: "24",
          retreat_path_distance: "120",
          retreat_path_cleared: true,
          drop_zone_description: "x",
          drop_zone_cleared: true,
          hinge_wood_width: "2",
          hinge_wood_thickness: "1",
          hinge_wood_condition: "sound",
          crew_positions: [{ name: "J", role: "sawyer" }],
          equipment_checklist: {
            chainsaw_inspected: true,
            wedges_available: true,
            felling_lever_available: true,
            escape_route_cleared: true,
            ppe_verified_all_crew: true,
          },
        },
      });
      const errors = validateTreeFellingCompleted(state);
      expect(errors.retreat_path_direction).toBeUndefined();
    });

    it("rejects retreat path same as fall path", () => {
      const state = buildState({
        jobDate: "2026-02-16",
        workLocation: "Site",
        gfContact: "1",
        ocContact: "2",
        employeeSignaturePath: "x",
        treeData: {
          ...DEFAULT_TREE_FELLING_DATA,
          fall_path: "N" as CompassDirection,
          retreat_path_direction: "N" as CompassDirection,
          tree_species: "oak",
          tree_condition: "sound",
          trunk_condition: "solid",
          tree_height_estimate: "60",
          dbh_estimate: "24",
          retreat_path_distance: "120",
          retreat_path_cleared: true,
          drop_zone_description: "x",
          drop_zone_cleared: true,
          hinge_wood_width: "2",
          hinge_wood_thickness: "1",
          hinge_wood_condition: "sound",
          crew_positions: [{ name: "J", role: "sawyer" }],
          equipment_checklist: {
            chainsaw_inspected: true,
            wedges_available: true,
            felling_lever_available: true,
            escape_route_cleared: true,
            ppe_verified_all_crew: true,
          },
        },
      });
      const errors = validateTreeFellingCompleted(state);
      expect(errors.retreat_path_direction).toBe(
        "Retreat path must be at least 90° from fall path direction."
      );
    });
  });

  describe("crew position minimum", () => {
    it("requires at least one crew member", () => {
      const state = buildState({
        treeData: { ...DEFAULT_TREE_FELLING_DATA, crew_positions: [] },
      });
      const errors = validateTreeFellingCompleted(state);
      expect(errors.crew_positions).toBe("At least one crew member is required.");
    });

    it("requires every crew member to have a name", () => {
      const state = buildState({
        treeData: {
          ...DEFAULT_TREE_FELLING_DATA,
          crew_positions: [{ name: "", role: "sawyer" }],
        },
      });
      const errors = validateTreeFellingCompleted(state);
      expect(errors.crew_positions).toBe("Every crew member must have a name.");
    });
  });

  describe("notch_type other", () => {
    it("requires notch_type_other when notch_type is other", () => {
      const state = buildState({
        treeData: {
          ...DEFAULT_TREE_FELLING_DATA,
          notch_type: "other",
          notch_type_other: "",
        },
      });
      const errors = validateTreeFellingCompleted(state);
      expect(errors.notch_type_other).toBe(
        "Please specify notch type when selecting Other."
      );
    });
  });
});
