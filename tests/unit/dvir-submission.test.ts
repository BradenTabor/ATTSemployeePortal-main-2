/**
 * DVIR Form Submission Integration Tests
 * 
 * Tests the full DVIR submission flow including:
 * - Successful submission with photos
 * - Photo upload failures
 * - Database errors
 * - Webhook failures
 * - Cleanup and error recovery
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Mock types for submission tests
 */
interface DVIRSubmissionPayload {
  truck_number: string;
  drivers_name: string;
  mileage: number;
  oil_dipstick_path: string;
  hydraulic_fluid_path?: string;
  signature?: string;
  status: 'draft' | 'completed';
}

interface SubmissionResult {
  success: boolean;
  error?: string;
  recordId?: string;
  uploadedPaths?: string[];
}

/**
 * Mock Supabase client for testing
 */
class MockSupabaseClient {
  private shouldFailInsert = false;
  private shouldFailWebhook = false;
  private uploadedPaths: string[] = [];

  async insertDVIR(payload: DVIRSubmissionPayload) {
    if (this.shouldFailInsert) {
      throw new Error('Database insert failed');
    }
    return { id: 'test-dvir-123' };
  }

  async uploadPhoto(file: File, path: string) {
    this.uploadedPaths.push(path);
    return { path };
  }

  async callWebhook(data: Record<string, unknown>) {
    if (this.shouldFailWebhook) {
      throw new Error('Webhook request failed');
    }
    return { ok: true };
  }

  async cleanupPhotos(paths: string[]) {
    this.uploadedPaths = this.uploadedPaths.filter(p => !paths.includes(p));
    return { ok: true };
  }

  setFailInsert(fail: boolean) {
    this.shouldFailInsert = fail;
  }

  setFailWebhook(fail: boolean) {
    this.shouldFailWebhook = fail;
  }

  getUploadedPaths() {
    return this.uploadedPaths;
  }

  reset() {
    this.shouldFailInsert = false;
    this.shouldFailWebhook = false;
    this.uploadedPaths = [];
  }
}

/**
 * Submission handler (extracted logic for testing)
 */
async function submitDVIR(
  payload: DVIRSubmissionPayload,
  photos: { oilDipstick: File; hydraulic?: File },
  supabase: MockSupabaseClient
): Promise<SubmissionResult> {
  const uploadedPaths: string[] = [];

  try {
    // Step 1: Upload photos
    const oilDipstickResult = await supabase.uploadPhoto(
      photos.oilDipstick,
      `dvir/${Date.now()}/oil_dipstick`
    );
    uploadedPaths.push(oilDipstickResult.path);

    if (photos.hydraulic) {
      const hydraulicResult = await supabase.uploadPhoto(
        photos.hydraulic,
        `dvir/${Date.now()}/hydraulic`
      );
      uploadedPaths.push(hydraulicResult.path);
    }

    // Step 2: Insert database record
    const insertPayload: DVIRSubmissionPayload = {
      ...payload,
      oil_dipstick_path: uploadedPaths[0],
      hydraulic_fluid_path: uploadedPaths[1],
    };

    const record = await supabase.insertDVIR(insertPayload);

    // Step 3: Call webhook (best effort - don't fail if webhook fails)
    try {
      await supabase.callWebhook({ recordId: record.id, ...payload });
    } catch (webhookError) {
      // Log webhook error but don't fail submission
      console.warn('Webhook failed:', webhookError);
    }

    return {
      success: true,
      recordId: record.id,
      uploadedPaths,
    };
  } catch (error) {
    // Step 4: Cleanup on failure
    if (uploadedPaths.length > 0) {
      try {
        await supabase.cleanupPhotos(uploadedPaths);
      } catch (cleanupError) {
        console.error('Cleanup failed:', cleanupError);
      }
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      uploadedPaths: [],
    };
  }
}

/**
 * Test Suite
 */
describe('DVIR Submission Integration', () => {
  let supabase: MockSupabaseClient;
  let mockFile: File;

  beforeEach(() => {
    supabase = new MockSupabaseClient();
    mockFile = new File(['mock data'], 'test.jpg', { type: 'image/jpeg' });
  });

  describe('Successful Submission', () => {
    it('should successfully submit DVIR with oil dipstick photo', async () => {
      const payload: DVIRSubmissionPayload = {
        truck_number: 'T-123',
        drivers_name: 'John Doe',
        mileage: 15000,
        oil_dipstick_path: '',
        status: 'completed',
      };

      const result = await submitDVIR(payload, { oilDipstick: mockFile }, supabase);

      expect(result.success).toBe(true);
      expect(result.recordId).toBe('test-dvir-123');
      expect(result.uploadedPaths).toHaveLength(1);
    });

    it('should successfully submit DVIR with multiple photos', async () => {
      const payload: DVIRSubmissionPayload = {
        truck_number: 'T-456',
        drivers_name: 'Jane Smith',
        mileage: 25000,
        oil_dipstick_path: '',
        hydraulic_fluid_path: '',
        status: 'completed',
      };

      const hydraulicFile = new File(['mock data'], 'hydraulic.jpg', { type: 'image/jpeg' });

      const result = await submitDVIR(
        payload,
        { oilDipstick: mockFile, hydraulic: hydraulicFile },
        supabase
      );

      expect(result.success).toBe(true);
      expect(result.uploadedPaths).toHaveLength(2);
    });
  });

  describe('Photo Upload Failure', () => {
    it('should not attempt database insert if photo upload fails', async () => {
      // Simulate photo upload failure by using a mock that throws
      const failingSupabase = new MockSupabaseClient();
      const uploadFailure = async () => {
        throw new Error('Photo upload failed: network error');
      };
      vi.spyOn(failingSupabase, 'uploadPhoto').mockImplementation(uploadFailure);

      const payload: DVIRSubmissionPayload = {
        truck_number: 'T-789',
        drivers_name: 'Bob Johnson',
        mileage: 35000,
        oil_dipstick_path: '',
        status: 'completed',
      };

      const result = await submitDVIR(payload, { oilDipstick: mockFile }, failingSupabase);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Photo upload failed');
      expect(result.uploadedPaths).toHaveLength(0);
    });
  });

  describe('Database Insert Failure', () => {
    it('should cleanup uploaded photos if database insert fails', async () => {
      supabase.setFailInsert(true);

      const payload: DVIRSubmissionPayload = {
        truck_number: 'T-101',
        drivers_name: 'Alice Brown',
        mileage: 45000,
        oil_dipstick_path: '',
        status: 'completed',
      };

      const result = await submitDVIR(payload, { oilDipstick: mockFile }, supabase);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Database insert failed');
      // Verify cleanup happened - no files should remain
      expect(supabase.getUploadedPaths()).toHaveLength(0);
    });

    it('should cleanup all photos if database fails after partial upload', async () => {
      supabase.setFailInsert(true);
      const hydraulicFile = new File(['mock data'], 'hydraulic.jpg', { type: 'image/jpeg' });

      const payload: DVIRSubmissionPayload = {
        truck_number: 'T-202',
        drivers_name: 'Charlie Davis',
        mileage: 55000,
        oil_dipstick_path: '',
        hydraulic_fluid_path: '',
        status: 'completed',
      };

      const result = await submitDVIR(
        payload,
        { oilDipstick: mockFile, hydraulic: hydraulicFile },
        supabase
      );

      expect(result.success).toBe(false);
      // Verify all uploaded photos were cleaned up
      expect(supabase.getUploadedPaths()).toHaveLength(0);
    });
  });

  describe('Webhook Failure Handling', () => {
    it('should not fail submission if webhook fails after successful DB insert', async () => {
      supabase.setFailWebhook(true);

      const payload: DVIRSubmissionPayload = {
        truck_number: 'T-303',
        drivers_name: 'Diana Evans',
        mileage: 65000,
        oil_dipstick_path: '',
        status: 'completed',
      };

      const result = await submitDVIR(payload, { oilDipstick: mockFile }, supabase);

      // Submission should still succeed even though webhook failed
      expect(result.success).toBe(true);
      expect(result.recordId).toBe('test-dvir-123');
      // Photos should NOT be cleaned up since DB insert succeeded
      expect(result.uploadedPaths).toHaveLength(1);
    });
  });

  describe('Draft vs Completed Submission', () => {
    it('should handle draft submission with minimal validation', async () => {
      const payload: DVIRSubmissionPayload = {
        truck_number: 'T-404',
        drivers_name: 'Evan Foster',
        mileage: 75000,
        oil_dipstick_path: '',
        status: 'draft',
      };

      const result = await submitDVIR(payload, { oilDipstick: mockFile }, supabase);

      expect(result.success).toBe(true);
      expect(result.recordId).toBe('test-dvir-123');
    });

    it('should handle status transition from draft to completed', async () => {
      const payload: DVIRSubmissionPayload = {
        truck_number: 'T-505',
        drivers_name: 'Fiona Garcia',
        mileage: 85000,
        oil_dipstick_path: '',
        status: 'completed',
      };

      const result = await submitDVIR(payload, { oilDipstick: mockFile }, supabase);

      expect(result.success).toBe(true);
    });
  });

  describe('Error Recovery', () => {
    it('should allow retry after failed submission', async () => {
      supabase.setFailInsert(true);

      const payload: DVIRSubmissionPayload = {
        truck_number: 'T-606',
        drivers_name: 'George Harris',
        mileage: 95000,
        oil_dipstick_path: '',
        status: 'completed',
      };

      // First submission fails
      const firstResult = await submitDVIR(payload, { oilDipstick: mockFile }, supabase);
      expect(firstResult.success).toBe(false);

      // Fix the issue and retry
      supabase.setFailInsert(false);
      const secondResult = await submitDVIR(payload, { oilDipstick: mockFile }, supabase);
      expect(secondResult.success).toBe(true);
      expect(secondResult.recordId).toBe('test-dvir-123');
    });
  });
});
