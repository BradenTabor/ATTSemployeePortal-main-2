import { act, renderHook } from '@testing-library/react';
import { expect, it } from 'vitest';
import { useJSAFormValidation } from '../../src/hooks/jsa/useJSAFormValidation';
import { createInitialFormState } from '../../src/pages/forms/dailyJSAFormState';

it('clears failed-submit errors after correcting a checklist or adding a paper photo', () => {
  const form = { ...createInitialFormState(), submissionType: 'paper' as const };
  const { result, rerender } = renderHook(({ state }) => useJSAFormValidation(state), { initialProps: { state: form } });
  act(() => result.current.markSubmitAttempted());
  expect(result.current.allErrors.jsaPhotoPaths).toBeTruthy();
  rerender({ state: { ...form, jsaPhotoPaths: ['local-jsa-photo://test'] } });
  expect(result.current.allErrors.jsaPhotoPaths).toBeUndefined();
});


it('clears a stale select blur error when the selected value reaches validation', async () => {
  const { useFormValidation } = await import('../../src/hooks/useFormValidation');
  const rules = [{ field: 'truck', validator: (value: unknown) => value ? null : 'Required' }];
  const { result, rerender } = renderHook(({ truck }) => useFormValidation({ truck }, rules), { initialProps: { truck: '' } });
  act(() => result.current.handleFieldBlur('truck'));
  expect(result.current.errors.truck).toBe('Required');
  rerender({ truck: 'B132' });
  expect(result.current.errors.truck).toBeUndefined();
  expect(result.current.isValid).toBe(true);
});
