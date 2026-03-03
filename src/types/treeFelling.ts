/**
 * Types for Tree Felling JSA (ANSI Z133).
 * Used by TreeFellingJSAForm and useTreeFellingValidation.
 */

export type CompassDirection =
  | "N"
  | "NE"
  | "E"
  | "SE"
  | "S"
  | "SW"
  | "W"
  | "NW";

export type LeanMagnitude = "slight" | "moderate" | "heavy";

export type NotchType =
  | "conventional_45"
  | "open_face_70"
  | "humboldt"
  | "other";

export interface CrewPosition {
  name: string;
  role: string; // e.g. "sawyer", "lookout", "swamper", "equipment operator"
}

export interface TreeFellingEquipmentChecklist {
  chainsaw_inspected: boolean;
  wedges_available: boolean;
  felling_lever_available: boolean;
  escape_route_cleared: boolean;
  ppe_verified_all_crew: boolean;
}

export interface TreeFellingData {
  // Tree assessment
  tree_species: string;
  tree_species_other: string; // when tree_species = 'other'
  tree_condition: string;
  trunk_condition: string;
  tree_height_estimate: string;
  dbh_estimate: string; // diameter at breast height

  // Lean & fall plan
  lean_direction: CompassDirection;
  lean_magnitude: LeanMagnitude;
  fall_path: CompassDirection;
  notch_type: NotchType;
  notch_type_other: string; // when notch_type = 'other'

  // ANSI Z133 mandatory fields
  retreat_path_direction: CompassDirection;
  retreat_path_distance: string;
  retreat_path_cleared: boolean;
  drop_zone_description: string;
  drop_zone_cleared: boolean;
  hinge_wood_width: string;
  hinge_wood_thickness: string;
  hinge_wood_condition: string;
  crew_positions: CrewPosition[];
  equipment_checklist: TreeFellingEquipmentChecklist;

  // Existing / overhead hazards
  distance_from_lines: string;
  hazards_present: string;
}

export const CREW_ROLES = [
  "sawyer",
  "lookout",
  "swamper",
  "equipment operator",
  "ground worker",
  "other",
] as const;

export type CrewRole = (typeof CREW_ROLES)[number];

export const TREE_SPECIES_OPTIONS = [
  "oak",
  "pine",
  "maple",
  "elm",
  "ash",
  "hickory",
  "cedar",
  "sweetgum",
  "other",
] as const;

export const HINGE_WOOD_CONDITION_OPTIONS = [
  "sound",
  "partially decayed",
  "hollow",
  "unknown",
] as const;

export const DEFAULT_TREE_FELLING_DATA: TreeFellingData = {
  tree_species: "",
  tree_species_other: "",
  tree_condition: "",
  trunk_condition: "",
  tree_height_estimate: "",
  dbh_estimate: "",
  lean_direction: "N",
  lean_magnitude: "slight",
  fall_path: "N",
  notch_type: "conventional_45",
  notch_type_other: "",
  retreat_path_direction: "N",
  retreat_path_distance: "",
  retreat_path_cleared: false,
  drop_zone_description: "",
  drop_zone_cleared: false,
  hinge_wood_width: "",
  hinge_wood_thickness: "",
  hinge_wood_condition: "unknown",
  crew_positions: [],
  equipment_checklist: {
    chainsaw_inspected: false,
    wedges_available: false,
    felling_lever_available: false,
    escape_route_cleared: false,
    ppe_verified_all_crew: false,
  },
  distance_from_lines: "",
  hazards_present: "",
};

/** Safely parse tree_felling_data from DB into TreeFellingData (handles old and new shapes). */
export function parseTreeFellingData(raw: unknown): TreeFellingData {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_TREE_FELLING_DATA };
  const o = raw as Record<string, unknown>;
  const def = DEFAULT_TREE_FELLING_DATA;

  // New shape: has tree_species or lean_direction
  if (
    typeof o.tree_species === "string" ||
    (o.lean_direction && DIRECTIONS_SET.has(o.lean_direction as CompassDirection))
  ) {
    return {
      tree_species: typeof o.tree_species === "string" ? o.tree_species : def.tree_species,
      tree_species_other: typeof o.tree_species_other === "string" ? o.tree_species_other : def.tree_species_other,
      tree_condition: typeof o.tree_condition === "string" ? o.tree_condition : def.tree_condition,
      trunk_condition: typeof o.trunk_condition === "string" ? o.trunk_condition : def.trunk_condition,
      tree_height_estimate:
        typeof o.tree_height_estimate === "string" ? o.tree_height_estimate : def.tree_height_estimate,
      dbh_estimate: typeof o.dbh_estimate === "string" ? o.dbh_estimate : def.dbh_estimate,
      lean_direction: DIRECTIONS_SET.has(o.lean_direction as CompassDirection)
        ? (o.lean_direction as CompassDirection)
        : def.lean_direction,
      lean_magnitude:
        o.lean_magnitude === "slight" || o.lean_magnitude === "moderate" || o.lean_magnitude === "heavy"
          ? o.lean_magnitude
          : def.lean_magnitude,
      fall_path: DIRECTIONS_SET.has(o.fall_path as CompassDirection)
        ? (o.fall_path as CompassDirection)
        : def.fall_path,
      notch_type:
        o.notch_type === "conventional_45" ||
        o.notch_type === "open_face_70" ||
        o.notch_type === "humboldt" ||
        o.notch_type === "other"
          ? o.notch_type
          : def.notch_type,
      notch_type_other: typeof o.notch_type_other === "string" ? o.notch_type_other : def.notch_type_other,
      retreat_path_direction: DIRECTIONS_SET.has(o.retreat_path_direction as CompassDirection)
        ? (o.retreat_path_direction as CompassDirection)
        : def.retreat_path_direction,
      retreat_path_distance:
        typeof o.retreat_path_distance === "string" ? o.retreat_path_distance : def.retreat_path_distance,
      retreat_path_cleared: Boolean(o.retreat_path_cleared),
      drop_zone_description:
        typeof o.drop_zone_description === "string" ? o.drop_zone_description : def.drop_zone_description,
      drop_zone_cleared: Boolean(o.drop_zone_cleared),
      hinge_wood_width: typeof o.hinge_wood_width === "string" ? o.hinge_wood_width : def.hinge_wood_width,
      hinge_wood_thickness:
        typeof o.hinge_wood_thickness === "string" ? o.hinge_wood_thickness : def.hinge_wood_thickness,
      hinge_wood_condition:
        typeof o.hinge_wood_condition === "string" ? o.hinge_wood_condition : def.hinge_wood_condition,
      crew_positions: Array.isArray(o.crew_positions)
        ? (o.crew_positions as CrewPosition[]).filter(
            (p): p is CrewPosition =>
              p && typeof p === "object" && typeof p.name === "string" && typeof p.role === "string"
          )
        : def.crew_positions,
      equipment_checklist:
        o.equipment_checklist && typeof o.equipment_checklist === "object"
          ? {
              chainsaw_inspected: Boolean((o.equipment_checklist as Record<string, unknown>).chainsaw_inspected),
              wedges_available: Boolean((o.equipment_checklist as Record<string, unknown>).wedges_available),
              felling_lever_available: Boolean(
                (o.equipment_checklist as Record<string, unknown>).felling_lever_available
              ),
              escape_route_cleared: Boolean(
                (o.equipment_checklist as Record<string, unknown>).escape_route_cleared
              ),
              ppe_verified_all_crew: Boolean(
                (o.equipment_checklist as Record<string, unknown>).ppe_verified_all_crew
              ),
            }
          : def.equipment_checklist,
      distance_from_lines:
        typeof o.distance_from_lines === "string" ? o.distance_from_lines : def.distance_from_lines,
      hazards_present: typeof o.hazards_present === "string" ? o.hazards_present : def.hazards_present,
    };
  }

  // Old shape: tree_risk_assessment, environmental_factors, operational_factors
  const env = (o.environmental_factors as Record<string, unknown> | undefined) ?? {};
  const op = (o.operational_factors as Record<string, unknown> | undefined) ?? {};
  return {
    ...def,
    tree_species_other: "",
    tree_condition: typeof env.tree_condition === "string" ? env.tree_condition : "",
    trunk_condition: typeof env.trunk_condition === "string" ? env.trunk_condition : "",
    notch_type_other: typeof op.notch_type === "string" ? op.notch_type : "",
    fall_path: typeof op.fall_path === "string" && DIRECTIONS_SET.has(op.fall_path as CompassDirection)
      ? (op.fall_path as CompassDirection)
      : def.fall_path,
    distance_from_lines: typeof op.distance_from_lines === "string" ? op.distance_from_lines : "",
    hazards_present: typeof o.hazards_present === "string" ? o.hazards_present : "",
  };
}

const DIRECTIONS_SET = new Set<CompassDirection>([
  "N",
  "NE",
  "E",
  "SE",
  "S",
  "SW",
  "W",
  "NW",
]);
