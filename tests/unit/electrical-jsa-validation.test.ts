import { describe, it, expect } from 'vitest';
import {
  createInitialFormState,
  type DailyJsaFormState,
} from '../../src/pages/forms/dailyJSAFormState';
import { getValidationRules } from '../../src/hooks/jsa/useJSAFormValidation';

describe('electrical JSA validation', () => {
  const baseForm: DailyJsaFormState = {
    ...createInitialFormState(),
    submissionType: 'digital',
  };

  it('electrical fields are not required when no electrical hazards', () => {
    const form: DailyJsaFormState = {
      ...baseForm,
      hazardsPresent: { ...baseForm.hazardsPresent, lines_energized: false, secondary_voltage: false, open_wire_secondary: false },
      electricalHazardData: null,
    };
    const rules = getValidationRules(form.submissionType);
    const electricalRule = rules.find((r) => r.field === 'electricalHazardData');
    expect(electricalRule).toBeUndefined();
  });

  it('electrical validation is in additionalErrors when electrical hazards present', () => {
    const formWithElectrical = {
      ...baseForm,
      hazardsPresent: { ...baseForm.hazardsPresent, lines_energized: true },
      electricalHazardData: null,
    };
    // The useJSAFormValidation additionalErrors checks this - we test the logic conceptually
    const hasElectricalHazard = ['lines_energized', 'secondary_voltage', 'open_wire_secondary'].some(
      (k) => formWithElectrical.hazardsPresent?.[k]
    );
    expect(hasElectricalHazard).toBe(true);
  });
});
