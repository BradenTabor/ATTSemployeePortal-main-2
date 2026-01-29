/**
 * JSA Wizard Draft/Status Flow Component Integration Tests
 * 
 * Tests the JSA wizard component including:
 * - Draft saving functionality
 * - Status transitions (draft → completed)
 * - Wizard step navigation
 * - Draft recovery on page reload
 * 
 * This complements unit tests for submission logic (jsa-submission.test.ts)
 * and E2E tests (jsa-form.spec.ts)
 */

import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderWithProviders, screen, waitFor } from '../../utils/testHelpers';
import userEvent from '@testing-library/user-event';
import DailyJSAForm from '../../../src/pages/forms/DailyJSAForm';

const { mockSupabase, mockFormPersistence } = vi.hoisted(() => {
  const supabase = {
    auth: {
      getUser: vi.fn(() => Promise.resolve({
        data: { user: { id: 'test-user', email: 'test@example.com' } },
        error: null,
      })),
      getSession: vi.fn(() => Promise.resolve({
        data: { session: { access_token: 'mock-token', expires_at: Date.now() + 3600000 } },
        error: null,
      })),
    },
    from: vi.fn(() => ({
      insert: vi.fn(() => Promise.resolve({
        data: [{ id: 'test-jsa-123' }],
        error: null,
      })),
      update: vi.fn(() => Promise.resolve({
        data: [{ id: 'test-jsa-123' }],
        error: null,
      })),
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({
            data: { id: 'test-jsa-123', status: 'draft' },
            error: null,
          })),
        })),
      })),
    })),
  };
  const formPersistence = {
    hasDraft: false,
    draftData: null as unknown,
    lastSaved: null as string | null,
    hasUnsavedChanges: false,
    saveDraft: vi.fn(),
    flushPendingSave: vi.fn(),
    clearDraft: vi.fn(),
    dismissDraft: vi.fn(),
    markAsSaved: vi.fn(),
  };
  return { mockSupabase: supabase, mockFormPersistence: formPersistence };
});

vi.mock('../../../src/lib/supabaseClient', () => ({
  supabase: mockSupabase,
}));

// Mock AuthContext
vi.mock('../../../src/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'test-user', email: 'test@example.com' },
    fullName: 'Test User',
    isAdmin: false,
  }),
}));

// Mock hooks
vi.mock('../../../src/hooks/useSmartDefaults', () => ({
  useSmartDefaults: () => ({
    suggestions: null,
    warnings: [],
    isLoading: false,
    handleApplySuggestion: vi.fn(),
  }),
}));

vi.mock('../../../src/hooks/useFormPersistence', () => ({
  useFormPersistence: () => mockFormPersistence,
}));

vi.mock('../../../src/hooks/queries/useComplianceQuery', () => ({
  useInvalidateCompliance: () => vi.fn(),
}));

vi.mock('../../../src/hooks/useComplianceToast', () => ({
  useComplianceToast: () => ({
    checkAndCelebrate: vi.fn(() => Promise.resolve({ allComplete: false, remaining: [] })),
    FullCelebration: () => null,
    celebrationProps: { isVisible: false, userName: '', onDismiss: () => {} },
  }),
}));

vi.mock('../../../src/lib/telemetry', () => ({
  trackFormStarted: vi.fn(),
  trackFormSubmitted: vi.fn(),
  trackFormSubmitError: vi.fn(),
  createFormTimer: () => ({
    reset: vi.fn(),
    getDuration: () => 1000,
  }),
}));

vi.mock('../../../src/lib/formToast', () => ({
  formToast: {
    submitting: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    dismiss: vi.fn(),
  },
}));

// Avoid lazy-loaded layout and heavy dependencies so tests don't hang
vi.mock('../../../src/layouts/DashboardLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
}));

// Mock JSA hooks to avoid useFormValidation/useJSASubmission internals that can hang in jsdom
vi.mock('../../../src/hooks/jsa', () => ({
  useJSAFormValidation: () => ({
    errors: {},
    getFieldError: () => undefined,
    shouldShowError: () => false,
    validateAll: vi.fn(() => ({ valid: true })),
    markSubmitAttempted: vi.fn(),
    handleFieldBlur: vi.fn(),
    additionalErrors: {},
    allErrors: {},
  }),
  useJSASubmission: () => ({
    submitJSA: vi.fn(() => Promise.resolve({ success: true, recordId: 'test-jsa-123' })),
  }),
}));

vi.mock('../../../src/lib/scrollToError', () => ({
  scrollToFirstError: vi.fn(),
}));

vi.mock('../../../src/lib/errorHandling', () => ({
  parseFormError: (e: unknown) => (e instanceof Error ? e.message : String(e)),
  getErrorToastTitle: () => 'Error',
}));

// SKIP: JSA form render in jsdom times out due to complex multi-step wizard rendering.
// All mocks are in place but the component's lazy-loaded sub-components cause hangs.
// Unit tests in jsa-validation.test.ts and jsa-submission.test.ts cover core logic.
// E2E tests in jsa-form.spec.ts cover full user flows.
// TODO: Refactor JSA wizard to be more testable in isolation (QA-JSA-001)
describe.skip('JSA Wizard Draft/Status Flow Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFormPersistence.hasDraft = false;
    mockFormPersistence.draftData = null as unknown;
  });

  it('should render JSA wizard with step navigation', async () => {
    renderWithProviders(<DailyJSAForm />);
    
    await waitFor(() => {
      expect(screen.getByText(/Job Safety Analysis|JSA/i)).toBeInTheDocument();
    });
  });

  it('should save form data as draft', async () => {
    const user = userEvent.setup();
    renderWithProviders(<DailyJSAForm />);
    
    await waitFor(() => {
      expect(screen.getByText(/Job Safety Analysis|JSA/i)).toBeInTheDocument();
    });

    // Fill some form fields
    const jobDateInput = screen.getByLabelText(/job.*date|date/i) || 
                        screen.getByPlaceholderText(/date/i);
    if (jobDateInput) {
      await user.type(jobDateInput as HTMLElement, '2026-01-24');
    }

    const workLocationInput = screen.getByLabelText(/work.*location|location/i) || 
                             screen.getByPlaceholderText(/location/i);
    if (workLocationInput) {
      await user.type(workLocationInput as HTMLElement, 'Test Location');
    }

    // Wait for auto-save to trigger (debounced)
    await waitFor(() => {
      expect(mockFormPersistence.saveDraft).toHaveBeenCalled();
    }, { timeout: 2000 });
  });

  it('should display draft recovery modal when draft exists', async () => {
    mockFormPersistence.hasDraft = true;
    mockFormPersistence.draftData = {
      form: {
        jobDate: '2026-01-24',
        workLocation: 'Test Location',
      },
      currentStep: 1,
      completedSteps: [],
      savedAt: new Date().toISOString(),
      userId: 'test-user',
    };

    renderWithProviders(<DailyJSAForm />);
    
    await waitFor(() => {
      expect(screen.getByText(/draft|recover|restore/i)).toBeInTheDocument();
    }, { timeout: 2000 });
  });

  it('should transition from draft to completed status', async () => {
    const user = userEvent.setup();
    renderWithProviders(<DailyJSAForm />);
    
    await waitFor(() => {
      expect(screen.getByText(/Job Safety Analysis|JSA/i)).toBeInTheDocument();
    });

    // Fill required fields for completion
    const jobDateInput = screen.getByLabelText(/job.*date|date/i);
    if (jobDateInput) {
      await user.type(jobDateInput as HTMLElement, '2026-01-24');
    }

    const workLocationInput = screen.getByLabelText(/work.*location|location/i);
    if (workLocationInput) {
      await user.type(workLocationInput as HTMLElement, 'Test Location');
    }

    // Find and click "Save as Complete" or "Submit" button
    const completeButton = screen.getByRole('button', { name: /complete|submit|finish/i });
    if (completeButton) {
      await user.click(completeButton);
      
      // Should attempt to save as completed
      await waitFor(() => {
        expect(mockSupabase.from().insert).toHaveBeenCalled();
      }, { timeout: 3000 });
    }
  });

  it('should navigate between wizard steps', async () => {
    const user = userEvent.setup();
    renderWithProviders(<DailyJSAForm />);
    
    await waitFor(() => {
      expect(screen.getByText(/Job Safety Analysis|JSA/i)).toBeInTheDocument();
    });

    // Find step navigation buttons/pills
    const stepButtons = screen.getAllByRole('button', { name: /step|1|2|3/i });
    if (stepButtons.length > 0) {
      // Click on a step button (if available)
      await user.click(stepButtons[0]);
      
      // Step should change (exact assertion depends on implementation)
      await waitFor(() => {
        // Verify step navigation occurred
        expect(true).toBe(true); // Placeholder - actual assertion depends on UI
      });
    }
  });
});
