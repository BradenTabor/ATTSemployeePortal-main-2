/**
 * useNearMissValidation - Validation for near-miss report form
 */

import type { NearMissCategory } from '../../types/nearMiss';

export interface NearMissFormState {
  category: NearMissCategory | '';
  description: string;
  location: string;
  latitude: number | null;
  longitude: number | null;
  suggested_corrective_action: string;
  photo_paths: string[];
  signature: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: Partial<Record<keyof NearMissFormState, string>>;
}

const MIN_DESCRIPTION_LENGTH = 10;

export function useNearMissValidation() {
  const validate = (state: NearMissFormState): ValidationResult => {
    const errors: Partial<Record<keyof NearMissFormState, string>> = {};

    if (!state.category) {
      errors.category = 'Select a category';
    }

    if (!state.description.trim()) {
      errors.description = 'Description is required';
    } else if (state.description.trim().length < MIN_DESCRIPTION_LENGTH) {
      errors.description = `Description must be at least ${MIN_DESCRIPTION_LENGTH} characters`;
    }

    if (!state.location.trim()) {
      errors.location = 'Location is required';
    }

    if (!state.signature.trim()) {
      errors.signature = 'Signature is required';
    }

    return {
      valid: Object.keys(errors).length === 0,
      errors,
    };
  };

  return { validate };
}
