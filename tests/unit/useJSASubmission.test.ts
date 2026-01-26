/**
 * useJSASubmission hook unit tests (QA-001)
 *
 * Tests the real JSA submission hook: payload building, insert/update paths,
 * and error handling. Complements jsa-submission.test.ts (mock flow) and
 * jsa-form.spec.ts (E2E).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useJSASubmission } from '../../src/hooks/jsa';
import {
  createInitialFormState,
  createBlankSpan,
  type DailyJsaFormState,
} from '../../src/pages/forms/dailyJSAFormState';

const { mockInsert, mockUpdate, mockFrom } = vi.hoisted(() => {
  const mockInsert = vi.fn();
  const mockUpdate = vi.fn();
  const mockFrom = vi.fn((table: string) => {
    if (table === 'daily_jsa') {
      return {
        insert: (payload: unknown[]) => ({
          select: () => ({
            single: () => Promise.resolve(mockInsert(payload)),
          }),
        }),
        update: (payload: unknown) => ({
          eq: (_col: string, id: string) =>
            Promise.resolve(mockUpdate(payload, id)),
        }),
      };
    }
    if (table === 'jsa_sharing_audit') {
      return {
        insert: () => ({
          select: () =>
            Promise.resolve({ data: null, error: null }).catch(() => {}),
        }),
      };
    }
    return {};
  });
  return { mockInsert, mockUpdate, mockFrom };
});

vi.mock('../../src/lib/supabaseClient', () => ({
  supabase: {
    from: mockFrom,
  },
}));

vi.mock('../../src/lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

const FIXED_TEST_DATE = '2026-01-24';

function buildMinimalFormState(overrides: Partial<DailyJsaFormState> = {}): DailyJsaFormState {
  const base = createInitialFormState();
  return {
    ...base,
    jobDate: FIXED_TEST_DATE,
    workLocation: 'Test Site',
    employeeSignature: 'data:image/png;base64,sig',
    spans: [createBlankSpan(1)],
    ...overrides,
  };
}

describe('useJSASubmission', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInsert.mockResolvedValue({ data: { id: 'new-jsa-id-123' }, error: null });
    mockUpdate.mockResolvedValue({ error: null });
  });

  describe('insert (new record)', () => {
    it('returns success and recordId when insert succeeds', async () => {
      const { result } = renderHook(() => useJSASubmission());
      const form = buildMinimalFormState();
      let out: { success: boolean; recordId?: string } = { success: false };

      await act(async () => {
        out = await result.current.submitJSA('complete', {
          form,
          isEditMode: false,
          recordId: undefined,
          persistedStatus: 'draft',
          userId: 'user-1',
          previousSharedUsers: [],
        });
      });

      expect(out.success).toBe(true);
      expect(out.recordId).toBe('new-jsa-id-123');
      expect(mockFrom).toHaveBeenCalledWith('daily_jsa');
      expect(mockInsert).toHaveBeenCalled();
      const [insertPayload] = mockInsert.mock.calls[0];
      expect(Array.isArray(insertPayload)).toBe(true);
      expect(insertPayload[0]).toMatchObject({
        user_id: 'user-1',
        work_location: 'Test Site',
        job_date: FIXED_TEST_DATE,
        status: 'completed',
        employee_signature: 'data:image/png;base64,sig',
      });
    });

    it('returns success for draft insert without signature', async () => {
      const { result } = renderHook(() => useJSASubmission());
      const form = buildMinimalFormState({ employeeSignature: '', status: 'draft' });
      let out: { success: boolean; recordId?: string } = { success: false };

      await act(async () => {
        out = await result.current.submitJSA('draft', {
          form,
          isEditMode: false,
          recordId: undefined,
          persistedStatus: 'draft',
          userId: 'user-2',
          previousSharedUsers: [],
        });
      });

      expect(out.success).toBe(true);
      expect(out.recordId).toBe('new-jsa-id-123');
      const [insertPayload] = mockInsert.mock.calls[0];
      expect(insertPayload[0].status).toBe('draft');
    });

    it('returns success: false and error when insert fails', async () => {
      const dbError = new Error('duplicate key value');
      mockInsert.mockResolvedValueOnce({ data: null, error: dbError });

      const { result } = renderHook(() => useJSASubmission());
      const form = buildMinimalFormState();
      let out: { success: boolean; error?: Error } = { success: true };

      await act(async () => {
        out = await result.current.submitJSA('complete', {
          form,
          isEditMode: false,
          recordId: undefined,
          persistedStatus: 'draft',
          userId: 'user-1',
          previousSharedUsers: [],
        });
      });

      expect(out.success).toBe(false);
      expect(out.error).toBeDefined();
      expect((out.error as Error).message).toContain('duplicate');
    });
  });

  describe('update (existing record)', () => {
    it('returns success when update succeeds', async () => {
      const { result } = renderHook(() => useJSASubmission());
      const form = buildMinimalFormState({
        createdAt: '2026-01-24T10:00:00Z',
        status: 'draft',
      });
      let out: { success: boolean; recordId?: string } = { success: false };

      await act(async () => {
        out = await result.current.submitJSA('complete', {
          form,
          isEditMode: true,
          recordId: 'existing-jsa-456',
          persistedStatus: 'draft',
          userId: 'user-1',
          previousSharedUsers: [],
        });
      });

      expect(out.success).toBe(true);
      expect(mockUpdate).toHaveBeenCalled();
      const [updatePayload, id] = mockUpdate.mock.calls[0];
      expect(id).toBe('existing-jsa-456');
      expect(updatePayload).toMatchObject({
        status: 'completed',
        work_location: 'Test Site',
      });
      expect((updatePayload as Record<string, unknown>).user_id).toBeUndefined();
      expect((updatePayload as Record<string, unknown>).created_at).toBeUndefined();
    });

    it('returns success: false when update fails', async () => {
      const dbError = new Error('row not found');
      mockUpdate.mockResolvedValueOnce({ error: dbError });

      const { result } = renderHook(() => useJSASubmission());
      const form = buildMinimalFormState({
        createdAt: '2026-01-24T10:00:00Z',
      });
      let out: { success: boolean; error?: Error } = { success: true };

      await act(async () => {
        out = await result.current.submitJSA('draft', {
          form,
          isEditMode: true,
          recordId: 'missing-id',
          persistedStatus: 'draft',
          userId: 'user-1',
          previousSharedUsers: [],
        });
      });

      expect(out.success).toBe(false);
      expect(out.error).toBeDefined();
    });
  });

  describe('payload building', () => {
    it('includes jobs_performed from form and maps custom job', async () => {
      const { result } = renderHook(() => useJSASubmission());
      const form = buildMinimalFormState({
        jobsPerformed: ['bucket_truck', 'chipper'],
        jobsOther: 'Custom task',
      });
      let out: { success: boolean } = { success: false };

      await act(async () => {
        out = await result.current.submitJSA('draft', {
          form,
          isEditMode: false,
          recordId: undefined,
          persistedStatus: 'draft',
          userId: 'user-1',
          previousSharedUsers: [],
        });
      });

      expect(out.success).toBe(true);
      const [insertPayload] = mockInsert.mock.calls[0];
      const row = insertPayload[0];
      expect(Array.isArray(row.jobs_performed)).toBe(true);
      expect(row.jobs_performed.length).toBe(3);
      const labels = row.jobs_performed.map((j: { label: string }) => j.label);
      expect(labels).toContain('Bucket Truck');
      expect(labels).toContain('Chipper');
      expect(labels).toContain('Custom task');
    });

    it('strips Unicode surrogates from span text to avoid JSON errors', async () => {
      const { result } = renderHook(() => useJSASubmission());
      const form = buildMinimalFormState({
        spans: [
          {
            ...createBlankSpan(1),
            location: 'Site \uD800', // unpaired high surrogate
            hazards: 'normal',
            mitigation: 'normal',
            initials: 'AB',
          },
        ],
      });
      let out: { success: boolean } = { success: false };

      await act(async () => {
        out = await result.current.submitJSA('draft', {
          form,
          isEditMode: false,
          recordId: undefined,
          persistedStatus: 'draft',
          userId: 'user-1',
          previousSharedUsers: [],
        });
      });

      expect(out.success).toBe(true);
      const [insertPayload] = mockInsert.mock.calls[0];
      const spans = insertPayload[0].spans;
      expect(spans[0].location).toBe('Site ');
      expect(spans[0].hazards).toBe('normal');
    });
  });
});
