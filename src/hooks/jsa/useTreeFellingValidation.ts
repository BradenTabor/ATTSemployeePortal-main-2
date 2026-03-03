/**
 * Validation for Tree Felling JSA (ANSI Z133).
 * All structured fields required for "completed" submission; draft allows incomplete.
 *
 * Progressive disclosure: errors show inline on blur (touched fields) or after
 * submit attempt, matching the UX pattern used by JSA/DVIR/Equipment/RTO forms.
 */

import { useCallback, useState, useMemo } from "react";
import type { TreeFellingData, CompassDirection } from "../../types/treeFelling";

const DIRECTION_DEGREES: Record<CompassDirection, number> = {
  N: 0,
  NE: 45,
  E: 90,
  SE: 135,
  S: 180,
  SW: 225,
  W: 270,
  NW: 315,
};

function angleBetween(d1: CompassDirection, d2: CompassDirection): number {
  const diff = Math.abs(DIRECTION_DEGREES[d1] - DIRECTION_DEGREES[d2]);
  return Math.min(diff, 360 - diff);
}

export interface TreeFellingFormState {
  jobDate: string;
  workLocation: string;
  gfContact: string;
  ocContact: string;
  treeData: TreeFellingData;
  employeeSignaturePath: string;
}

export type TreeFellingValidationErrors = Record<string, string>;

/**
 * Validates full form for "completed" status. Returns map of field key -> error message.
 * For draft, no validation required (caller skips this).
 */
export function validateTreeFellingCompleted(
  state: TreeFellingFormState
): TreeFellingValidationErrors {
  const errs: TreeFellingValidationErrors = {};
  const d = state.treeData;

  if (!state.jobDate?.trim()) errs.jobDate = "Job date is required.";
  if (!state.workLocation?.trim()) errs.workLocation = "Work location is required.";
  if (!state.gfContact?.trim()) errs.gfContact = "GF contact is required.";
  if (!state.ocContact?.trim()) errs.ocContact = "OC contact is required.";
  if (!state.employeeSignaturePath?.trim())
    errs.employeeSignaturePath = "Signature is required for completion.";

  if (!d.tree_species?.trim()) errs.tree_species = "Tree species is required.";
  if (d.tree_species === "other" && !d.tree_species_other?.trim())
    errs.tree_species_other = "Please specify species when selecting Other.";
  if (!d.tree_condition?.trim()) errs.tree_condition = "Tree condition is required.";
  if (!d.trunk_condition?.trim()) errs.trunk_condition = "Trunk condition is required.";
  if (!d.tree_height_estimate?.trim())
    errs.tree_height_estimate = "Tree height estimate is required.";
  if (!d.dbh_estimate?.trim()) errs.dbh_estimate = "DBH estimate is required.";

  if (!d.retreat_path_distance?.trim())
    errs.retreat_path_distance = "Retreat path distance is required.";
  if (!d.retreat_path_cleared)
    errs.retreat_path_cleared = "Retreat path must be cleared of obstacles.";
  if (!d.drop_zone_description?.trim())
    errs.drop_zone_description = "Drop zone description is required.";
  if (!d.drop_zone_cleared)
    errs.drop_zone_cleared = "Drop zone must be cleared of personnel and obstacles.";
  if (!d.hinge_wood_width?.trim())
    errs.hinge_wood_width = "Hinge wood width is required.";
  if (!d.hinge_wood_thickness?.trim())
    errs.hinge_wood_thickness = "Hinge wood thickness is required.";
  if (!d.hinge_wood_condition?.trim())
    errs.hinge_wood_condition = "Hinge wood condition is required.";

  const retreatAngle = angleBetween(d.retreat_path_direction, d.fall_path);
  if (retreatAngle < 90) {
    errs.retreat_path_direction =
      "Retreat path must be at least 90° from fall path direction.";
  }

  if (!d.crew_positions?.length) {
    errs.crew_positions = "At least one crew member is required.";
  } else {
    const missingName = d.crew_positions.some((p) => !p.name?.trim());
    if (missingName) errs.crew_positions = "Every crew member must have a name.";
  }

  const eq = d.equipment_checklist;
  if (!eq.chainsaw_inspected) errs.equipment_chainsaw = "Chainsaw inspected is required.";
  if (!eq.wedges_available) errs.equipment_wedges = "Wedges available is required.";
  if (!eq.felling_lever_available)
    errs.equipment_felling_lever = "Felling lever available is required.";
  if (!eq.escape_route_cleared)
    errs.equipment_escape_route = "Escape route cleared is required.";
  if (!eq.ppe_verified_all_crew)
    errs.equipment_ppe = "PPE verified for all crew is required.";

  if (d.notch_type === "other" && !d.notch_type_other?.trim())
    errs.notch_type_other = "Please specify notch type when selecting Other.";

  return errs;
}

export interface ValidateCompletedResult {
  valid: boolean;
  errors: TreeFellingValidationErrors;
}

export interface UseTreeFellingValidationReturn {
  errors: TreeFellingValidationErrors;
  validateForCompleted: () => ValidateCompletedResult;
  validateAll: (asDraft: boolean) => boolean;
  getFieldError: (field: string) => string | undefined;
  shouldShowError: (field: string) => boolean;
  handleFieldBlur: (field: string) => void;
  markSubmitAttempted: () => void;
}

/**
 * Hook for Tree Felling JSA validation with progressive disclosure.
 *
 * - Before submit: errors show inline only for fields the user has blurred (touched).
 * - After submit attempt: all errors are visible, matching JSA/DVIR/Equipment UX.
 */
export function useTreeFellingValidation(
  state: TreeFellingFormState,
  errorsFromSubmit: TreeFellingValidationErrors
): UseTreeFellingValidationReturn {
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const liveErrors = useMemo(
    () => validateTreeFellingCompleted(state),
    [state]
  );

  const activeErrors = useMemo(
    () => (submitAttempted ? { ...liveErrors, ...errorsFromSubmit } : liveErrors),
    [submitAttempted, liveErrors, errorsFromSubmit]
  );

  const validateForCompleted = useCallback((): ValidateCompletedResult => {
    const e = validateTreeFellingCompleted(state);
    return { valid: Object.keys(e).length === 0, errors: e };
  }, [state]);

  const validateAll = useCallback(
    (asDraft: boolean): boolean => {
      if (asDraft) return true;
      const { valid } = validateForCompleted();
      return valid;
    },
    [validateForCompleted]
  );

  const getFieldError = useCallback(
    (field: string): string | undefined => activeErrors[field],
    [activeErrors]
  );

  const shouldShowError = useCallback(
    (field: string): boolean => {
      if (!activeErrors[field]) return false;
      return submitAttempted || touched.has(field);
    },
    [activeErrors, submitAttempted, touched]
  );

  const handleFieldBlur = useCallback((field: string) => {
    setTouched((prev) => {
      if (prev.has(field)) return prev;
      const next = new Set(prev);
      next.add(field);
      return next;
    });
  }, []);

  const markSubmitAttempted = useCallback(() => {
    setSubmitAttempted(true);
  }, []);

  return {
    errors: errorsFromSubmit,
    validateForCompleted,
    validateAll,
    getFieldError,
    shouldShowError,
    handleFieldBlur,
    markSubmitAttempted,
  };
}
