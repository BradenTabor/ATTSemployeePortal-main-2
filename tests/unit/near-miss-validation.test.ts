/**
 * Unit tests: Near-miss form validation
 */

import { describe, it, expect } from 'vitest';

const MIN_DESCRIPTION_LENGTH = 10;

interface NearMissFormState {
  category: string;
  description: string;
  location: string;
  signature: string;
}

function validate(state: NearMissFormState): { valid: boolean; errors: Partial<Record<keyof NearMissFormState, string>> } {
  const errors: Partial<Record<keyof NearMissFormState, string>> = {};
  if (!state.category) errors.category = 'Select a category';
  if (!state.description.trim()) errors.description = 'Description is required';
  else if (state.description.trim().length < MIN_DESCRIPTION_LENGTH) {
    errors.description = `Description must be at least ${MIN_DESCRIPTION_LENGTH} characters`;
  }
  if (!state.location.trim()) errors.location = 'Location is required';
  if (!state.signature.trim()) errors.signature = 'Signature is required';
  return { valid: Object.keys(errors).length === 0, errors };
}

describe('near-miss-validation', () => {
  it('required: category, description, location, signature', () => {
    const r = validate({
      category: '',
      description: '',
      location: '',
      signature: '',
    });
    expect(r.valid).toBe(false);
    expect(r.errors?.category).toBeTruthy();
    expect(r.errors?.description).toBeTruthy();
    expect(r.errors?.location).toBeTruthy();
    expect(r.errors?.signature).toBeTruthy();
  });

  it('description minimum 10 chars', () => {
    const r = validate({
      category: 'fall_hazard',
      description: 'short',
      location: 'Site A',
      signature: 'path/to/sig.png',
    });
    expect(r.valid).toBe(false);
    expect(r.errors?.description).toContain('10');
  });

  it('valid when all required fields present and description long enough', () => {
    const r = validate({
      category: 'fall_hazard',
      description: 'Worker nearly fell from bucket. Harness caught.',
      location: 'Site A',
      signature: 'path/to/sig.png',
    });
    expect(r.valid).toBe(true);
    expect(r.errors).toEqual({});
  });

  it('category validation', () => {
    const r = validate({
      category: 'struck_by',
      description: 'A longer description here.',
      location: 'Site B',
      signature: 'sig',
    });
    expect(r.valid).toBe(true);
  });
});
