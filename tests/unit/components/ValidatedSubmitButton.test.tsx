/**
 * ValidatedSubmitButton Component Unit Tests
 *
 * Tests the validated submit button: label, loading state, error count.
 * BL-011: Add unit test for ValidatedSubmitButton component.
 */

import { describe, it, expect } from 'vitest';
import { renderWithProviders, screen } from '../../utils/testHelpers';
import { ValidatedSubmitButton } from '../../../src/components/forms/ValidatedSubmitButton';

describe('ValidatedSubmitButton', () => {
  it('renders with default label', () => {
    renderWithProviders(<ValidatedSubmitButton />);
    expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument();
  });

  it('renders with custom label', () => {
    renderWithProviders(<ValidatedSubmitButton label="Save and continue" />);
    expect(screen.getByRole('button', { name: /save and continue/i })).toBeInTheDocument();
  });

  it('is disabled when loading', () => {
    renderWithProviders(<ValidatedSubmitButton loading label="Submit" />);
    const button = screen.getByRole('button', { name: /submit/i });
    expect(button).toBeDisabled();
  });

  it('is disabled when errorCount > 0', () => {
    renderWithProviders(<ValidatedSubmitButton errorCount={2} label="Submit" />);
    const button = screen.getByRole('button', { name: /fix 2 issues before submitting/i });
    expect(button).toBeDisabled();
    expect(screen.getByLabelText(/2 errors/i)).toBeInTheDocument();
  });

  it('shows error count badge when errorCount > 0 and not loading', () => {
    renderWithProviders(<ValidatedSubmitButton errorCount={3} label="Submit" />);
    expect(screen.getByLabelText(/3 errors/i)).toBeInTheDocument();
  });
});
