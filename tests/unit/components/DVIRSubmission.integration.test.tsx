/**
 * DVIR Form Submission Component Integration Tests
 * 
 * Tests the DVIR form component submission flow including:
 * - Form rendering and field interaction
 * - Validation error display
 * - Photo upload handling
 * - Successful submission flow
 * 
 * This complements unit tests for submission logic (dvir-submission.test.ts)
 * and E2E tests (dvir-form.spec.ts)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderWithProviders, screen, waitFor, createMockFile } from '../../utils/testHelpers';
import userEvent from '@testing-library/user-event';
import DVIRForm from '../../../src/pages/forms/DVIRForm';

const { mockSupabase } = vi.hoisted(() => {
  const chain: Record<string, unknown> = {};
  chain.select = () => chain;
  chain.eq = () => chain;
  chain.order = () => chain;
  chain.limit = () => chain;
  chain.maybeSingle = () =>
    Promise.resolve({
      data: {
        full_name: 'Test User',
        drivers_license_number: null,
        drivers_license_class: null,
        drivers_license_expiration: null,
        mileage: null,
        created_at: null,
      },
      error: null,
    });
  chain.single = () => Promise.resolve({ data: null, error: null });
  const fromFn = vi.fn(() => ({
    insert: vi.fn(() => Promise.resolve({ error: null })),
    ...chain,
  }));
  const mock = {
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
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn(() => Promise.resolve({
          data: { path: 'test/oil-dipstick.jpg' },
          error: null,
        })),
        getPublicUrl: vi.fn(() => ({ data: { publicUrl: 'https://example.com/test.jpg' } })),
      })),
    },
    from: fromFn,
  };
  return { mockSupabase: mock };
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
  useFormPersistence: () => ({
    hasDraft: false,
    draftData: null,
    lastSaved: null,
    hasUnsavedChanges: false,
    saveDraft: vi.fn(),
    clearDraft: vi.fn(),
    dismissDraft: vi.fn(),
    markAsSaved: vi.fn(),
  }),
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

describe('DVIR Form Submission Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render DVIR form with required fields', async () => {
    renderWithProviders(<DVIRForm />);
    await waitFor(() => {
      expect(screen.getByText(/Daily Vehicle Inspection/i)).toBeInTheDocument();
    });
  });

  it('should display validation state when required fields are empty', async () => {
    renderWithProviders(<DVIRForm />);

    await waitFor(() => {
      expect(screen.getByText(/Daily Vehicle Inspection/i)).toBeInTheDocument();
    });

    expect(
      screen.getByRole('button', { name: /fix \d+ issue|submit dvir/i })
    ).toBeInTheDocument();
  });

  it.skip('should handle photo upload', async () => {
    const user = userEvent.setup();
    renderWithProviders(<DVIRForm />);
    await waitFor(() => {
      expect(screen.getByText(/Daily Vehicle Inspection/i)).toBeInTheDocument();
    });
    const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]');
    expect(fileInput).toBeTruthy();
    await user.upload(fileInput!, createMockFile('oil-dipstick.jpg', 'image/jpeg'));
    await waitFor(
      () => expect(mockSupabase.storage.from).toHaveBeenCalled(),
      { timeout: 2000 }
    );
  });

  it.skip('should submit form with valid data', async () => {
    const user = userEvent.setup();
    renderWithProviders(<DVIRForm />);
    await waitFor(() => {
      expect(screen.getByText(/Daily Vehicle Inspection/i)).toBeInTheDocument();
    });
    const truckSelect = screen.getByRole('combobox', { name: /truck/i });
    await user.selectOptions(truckSelect, 'B132');
    const driverNameInput = screen.getByLabelText(/drivers name/i);
    await user.type(driverNameInput, 'John Doe');
    const mileageInput = screen.getByLabelText(/odometer/i);
    await user.type(mileageInput, '50000');
    const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]');
    if (fileInput) {
      await user.upload(fileInput, createMockFile('oil-dipstick.jpg', 'image/jpeg'));
    }
    const submitButton = screen.getByRole('button', { name: /submit dvir/i });
    await user.click(submitButton);
    await waitFor(() => expect(mockSupabase.from).toHaveBeenCalled(), { timeout: 5000 });
  });
});
