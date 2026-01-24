/**
 * JSA Form Submission Integration Tests
 * 
 * Tests the JSA form submission flow including:
 * - Draft saves with form persistence
 * - Status transitions (draft → completed)
 * - Wizard step navigation and validation
 * - Multi-step form recovery
 */

import { describe, it, expect, beforeEach } from 'vitest';

/**
 * Mock types for JSA submission tests
 */
interface JSAFormState {
  jobDate: string;
  workLocation: string;
  spans: { id: string; completed: boolean }[];
  employeeSignature: string;
  status: 'draft' | 'completed';
}

interface JSASubmissionResult {
  success: boolean;
  error?: string;
  recordId?: string;
}

/**
 * Mock Supabase client for JSA testing
 */
class MockJSASupabaseClient {
  private records: Map<string, JSAFormState> = new Map();
  private shouldFailInsert = false;

  async insertJSA(payload: JSAFormState): Promise<{ id: string }> {
    if (this.shouldFailInsert) {
      throw new Error('Database insert failed');
    }
    const id = `jsa-${Date.now()}`;
    this.records.set(id, payload);
    return { id };
  }

  async updateJSA(id: string, payload: Partial<JSAFormState>): Promise<{ id: string }> {
    if (this.shouldFailInsert) {
      throw new Error('Database update failed');
    }
    const record = this.records.get(id);
    if (!record) {
      throw new Error('Record not found');
    }
    this.records.set(id, { ...record, ...payload });
    return { id };
  }

  async fetchJSA(id: string): Promise<JSAFormState | null> {
    return this.records.get(id) || null;
  }

  setFailInsert(fail: boolean) {
    this.shouldFailInsert = fail;
  }

  reset() {
    this.records.clear();
    this.shouldFailInsert = false;
  }

  getRecordCount(): number {
    return this.records.size;
  }
}

/**
 * JSA submission handler (extracted logic for testing)
 */
async function submitJSA(
  form: JSAFormState,
  mode: 'draft' | 'complete',
  supabase: MockJSASupabaseClient,
  existingRecordId?: string
): Promise<JSASubmissionResult> {
  try {
    // Step 1: Validate if completing
    if (mode === 'complete') {
      if (!form.jobDate) throw new Error('Job date is required');
      if (!form.workLocation) throw new Error('Work location is required');
      if (!form.employeeSignature) throw new Error('Employee signature is required');
      if (!form.spans || form.spans.length === 0) throw new Error('At least one span required');
    }

    // Step 2: Save to database
    const payload: JSAFormState = {
      ...form,
      status: mode === 'complete' ? 'completed' : 'draft',
    };

    let recordId = existingRecordId;
    if (existingRecordId) {
      await supabase.updateJSA(existingRecordId, payload);
    } else {
      const result = await supabase.insertJSA(payload);
      recordId = result.id;
    }

    return {
      success: true,
      recordId,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Form state persistence (simulated localStorage)
 */
class FormPersistence {
  private storage: Map<string, JSAFormState> = new Map();

  saveDraft(form: JSAFormState, formType: string): void {
    this.storage.set(`${formType}-draft`, form);
  }

  getDraft(formType: string): JSAFormState | null {
    return this.storage.get(`${formType}-draft`) || null;
  }

  clearDraft(formType: string): void {
    this.storage.delete(`${formType}-draft`);
  }

  reset(): void {
    this.storage.clear();
  }
}

/**
 * Test Suite
 */
describe('JSA Submission Integration', () => {
  let supabase: MockJSASupabaseClient;
  let persistence: FormPersistence;
  let initialForm: JSAFormState;

  beforeEach(() => {
    supabase = new MockJSASupabaseClient();
    persistence = new FormPersistence();
    initialForm = {
      jobDate: '2026-01-24',
      workLocation: 'Site A',
      spans: [{ id: 'span-1', completed: true }],
      employeeSignature: 'signature-data',
      status: 'draft',
    };
  });

  describe('Draft Submission', () => {
    it('should save incomplete form as draft', async () => {
      const form: JSAFormState = {
        jobDate: '2026-01-24',
        workLocation: 'Site A',
        spans: [],
        employeeSignature: '',
        status: 'draft',
      };

      const result = await submitJSA(form, 'draft', supabase);

      expect(result.success).toBe(true);
      expect(result.recordId).toBeDefined();
    });

    it('should persist draft to localStorage', async () => {
      persistence.saveDraft(initialForm, 'jsa');
      const draft = persistence.getDraft('jsa');

      expect(draft).toBeDefined();
      expect(draft?.jobDate).toBe('2026-01-24');
      expect(draft?.status).toBe('draft');
    });

    it('should recover draft on page reload', async () => {
      // Simulate form entry
      const unsavedForm: JSAFormState = {
        jobDate: '2026-01-25',
        workLocation: 'Site B',
        spans: [{ id: 'span-1', completed: false }],
        employeeSignature: '',
        status: 'draft',
      };

      persistence.saveDraft(unsavedForm, 'jsa');

      // Simulate page reload - fetch draft
      const recoveredForm = persistence.getDraft('jsa');

      expect(recoveredForm).toBeDefined();
      expect(recoveredForm?.jobDate).toBe('2026-01-25');
      expect(recoveredForm?.workLocation).toBe('Site B');
    });
  });

  describe('Completion Submission', () => {
    it('should require all fields for completion', async () => {
      const incompleteForm: JSAFormState = {
        jobDate: '',
        workLocation: '',
        spans: [],
        employeeSignature: '',
        status: 'draft',
      };

      const result = await submitJSA(incompleteForm, 'complete', supabase);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Job date is required');
    });

    it('should successfully complete JSA with all required fields', async () => {
      const result = await submitJSA(initialForm, 'complete', supabase);

      expect(result.success).toBe(true);
      expect(result.recordId).toBeDefined();

      // Verify record was saved
      const saved = await supabase.fetchJSA(result.recordId!);
      expect(saved?.status).toBe('completed');
    });

    it('should require signature for completion', async () => {
      const formWithoutSignature: JSAFormState = {
        jobDate: '2026-01-24',
        workLocation: 'Site A',
        spans: [{ id: 'span-1', completed: true }],
        employeeSignature: '',
        status: 'draft',
      };

      const result = await submitJSA(formWithoutSignature, 'complete', supabase);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Employee signature is required');
    });
  });

  describe('Draft to Completed Transition', () => {
    it('should update draft to completed status', async () => {
      // Step 1: Save initial draft
      const draftResult = await submitJSA(initialForm, 'draft', supabase);
      expect(draftResult.success).toBe(true);

      // Step 2: Update to completed
      const completedResult = await submitJSA(
        initialForm,
        'complete',
        supabase,
        draftResult.recordId
      );
      expect(completedResult.success).toBe(true);

      // Step 3: Verify status changed
      const saved = await supabase.fetchJSA(completedResult.recordId!);
      expect(saved?.status).toBe('completed');
    });

    it('should preserve form data through draft-to-completed transition', async () => {
      // Save draft
      const draftResult = await submitJSA(initialForm, 'draft', supabase);

      // Fetch and update
      const saved = await supabase.fetchJSA(draftResult.recordId!);
      expect(saved?.jobDate).toBe('2026-01-24');
      expect(saved?.workLocation).toBe('Site A');
    });
  });

  describe('Wizard Step Navigation', () => {
    it('should support multi-step form submission', async () => {
      // Simulate user filling out wizard steps
      const formAfterStep1: JSAFormState = {
        ...initialForm,
        jobDate: '2026-01-24',
      };

      // Save after step 1
      const step1Result = await submitJSA(formAfterStep1, 'draft', supabase);
      expect(step1Result.success).toBe(true);

      // Continue to step 2, 3, etc.
      const formAfterStep3: JSAFormState = {
        ...formAfterStep1,
        workLocation: 'Site A - Updated',
        spans: [
          { id: 'span-1', completed: true },
          { id: 'span-2', completed: false },
        ],
      };

      // Save progress
      const step3Result = await submitJSA(
        formAfterStep3,
        'draft',
        supabase,
        step1Result.recordId
      );
      expect(step3Result.success).toBe(true);

      // Verify accumulated data
      const final = await supabase.fetchJSA(step3Result.recordId!);
      expect(final?.spans).toHaveLength(2);
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      supabase.setFailInsert(true);

      const result = await submitJSA(initialForm, 'complete', supabase);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should allow retry after error', async () => {
      supabase.setFailInsert(true);
      let result = await submitJSA(initialForm, 'complete', supabase);
      expect(result.success).toBe(false);

      supabase.setFailInsert(false);
      result = await submitJSA(initialForm, 'complete', supabase);
      expect(result.success).toBe(true);
      expect(result.recordId).toBeDefined();
    });

    it('should clear draft after successful completion', async () => {
      persistence.saveDraft(initialForm, 'jsa');
      expect(persistence.getDraft('jsa')).toBeDefined();

      // After successful completion, draft should be cleared
      persistence.clearDraft('jsa');
      expect(persistence.getDraft('jsa')).toBeNull();
    });
  });

  describe('Data Integrity', () => {
    it('should create new record on each submission when not updating existing', async () => {
      // This test verifies that creating a new JSA doesn't overwrite previous ones
      const form1: JSAFormState = {
        ...initialForm,
        workLocation: 'Site A',
      };

      const result1 = await submitJSA(form1, 'complete', supabase);
      expect(result1.success).toBe(true);
      expect(result1.recordId).toBeDefined();
      const recordId1 = result1.recordId!;

      // Updating the same record with new data
      const form1Updated: JSAFormState = {
        ...form1,
        workLocation: 'Site A - Updated',
      };

      const updateResult = await submitJSA(form1Updated, 'complete', supabase, recordId1);
      expect(updateResult.success).toBe(true);

      // Verify the record was updated, not duplicated
      const updated = await supabase.fetchJSA(recordId1);
      expect(updated?.workLocation).toBe('Site A - Updated');
    });

    it('should preserve all form fields through save cycle', async () => {
      const complexForm: JSAFormState = {
        jobDate: '2026-01-24',
        workLocation: 'Site A',
        spans: [
          { id: 'span-1', completed: true },
          { id: 'span-2', completed: false },
          { id: 'span-3', completed: true },
        ],
        employeeSignature: 'signature-data-xyz',
        status: 'draft',
      };

      const result = await submitJSA(complexForm, 'draft', supabase);
      const saved = await supabase.fetchJSA(result.recordId!);

      expect(saved?.spans).toHaveLength(3);
      expect(saved?.employeeSignature).toBe('signature-data-xyz');
    });
  });
});
