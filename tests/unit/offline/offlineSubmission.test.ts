import { beforeEach, describe, expect, it, vi } from 'vitest';
import { submitOfflineForm, hasOfflineConflict } from '../../../src/lib/offlineSubmission';
import type { QueuedSubmission } from '../../../src/lib/offlineQueue';

const mocks = vi.hoisted(() => {
  const query: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const method of ['insert', 'update', 'select', 'eq', 'limit', 'setHeader']) query[method] = vi.fn(() => query);
  query.single = vi.fn(async () => ({ data: { id: 'saved' }, error: null }));
  query.maybeSingle = vi.fn(async () => ({ data: null, error: null }));
  return { query, from: vi.fn(() => query), getSession: vi.fn(), photos: vi.fn(), cleanup: vi.fn(), upload: vi.fn() };
});
vi.mock('../../../src/lib/supabaseClient', () => ({ supabase: {
  from: mocks.from, auth: { getSession: mocks.getSession },
  storage: { from: () => ({ upload: mocks.upload }) },
} }));
vi.mock('../../../src/lib/offlinePhotoStore', () => ({
  getPhotosForQueue: mocks.photos, deletePhotosForQueue: mocks.cleanup,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSession.mockResolvedValue({ data: { session: { user: { id: 'worker' }, access_token: 'worker-token' } }, error: null });
  mocks.photos.mockResolvedValue([]);
  mocks.query.single.mockResolvedValue({ data: { id: 'saved' }, error: null });
  mocks.query.maybeSingle.mockResolvedValue({ data: null, error: null });
});

describe('actual offline replay boundary', () => {
  it.each(['jsa', 'dvir', 'equipment'] as const)('strips internal metadata for %s without mutating the queued copy', async type => {
    const payload = { user_id: 'worker', notes: 'test', __offlineQueueId: 'queue', __other: 'device-only' };
    await submitOfflineForm(type, payload, []);
    const sent = mocks.query.insert.mock.calls[0][0][0];
    expect(Object.keys(sent).some(key => key.startsWith('__'))).toBe(false);
    expect(sent.notes).toBe('test');
    expect(payload.__offlineQueueId).toBe('queue');
  });
  it('updates a queued existing JSA and requires confirmation of the affected row', async () => {
    await submitOfflineForm('jsa', { __recordId: 'record', __offlineQueueId: 'q', created_at: 'immutable', user_id: 'worker', notes: 'edited' }, []);
    expect(mocks.query.insert).not.toHaveBeenCalled();
    expect(mocks.query.update).toHaveBeenCalledWith({ notes: 'edited' });
    expect(mocks.query.eq).toHaveBeenCalledWith('id', 'record');
    expect(mocks.query.single).toHaveBeenCalled();
  });
  it('does not report success when an edit is denied or the record is missing', async () => {
    mocks.query.single.mockResolvedValue({ data: null, error: { message: 'No accessible row' } });
    await expect(submitOfflineForm('jsa', { __recordId: 'missing', notes: 'edited' }, [])).rejects.toThrow('No accessible row');
    expect(mocks.cleanup).not.toHaveBeenCalled();
  });
  it('removes legacy DVIR webhook-only fields before insertion', async () => {
    await submitOfflineForm('dvir', { user_id: 'worker', user_email: 'worker@example.test' }, []);
    expect(mocks.query.insert.mock.calls[0][0][0]).not.toHaveProperty('user_email');
  });
  it('sets ownership for legacy JSA entries before insertion', async () => {
    await submitOfflineForm('jsa', { notes: 'legacy' }, []);
    expect(mocks.query.insert.mock.calls[0][0][0].user_id).toBe('worker');
  });
  it('retains a submission when a queued photo is missing', async () => {
    await expect(submitOfflineForm('jsa', { __offlineQueueId: 'q' }, ['missing'])).rejects.toThrow('photo is missing');
    expect(mocks.query.insert).not.toHaveBeenCalled();
    expect(mocks.cleanup).not.toHaveBeenCalled();
  });
  it('never submits another account’s saved inspection', async () => {
    await expect(submitOfflineForm('dvir', { user_id: 'another-worker' }, [])).rejects.toThrow('account');
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it('rejects expired credentials without uploading or deleting photos', async () => {
    mocks.getSession.mockResolvedValue({ data: { session: { user: { id: 'worker' }, access_token: 'expired', expires_at: 1 } }, error: null });
    await expect(submitOfflineForm('jsa', { user_id: 'worker' }, ['photo'])).rejects.toThrow('Sign in');
    expect(mocks.upload).not.toHaveBeenCalled();
    expect(mocks.cleanup).not.toHaveBeenCalled();
  });
  it('preserves the queue when the token expires during an upload', async () => {
    mocks.photos.mockResolvedValue([{ id: 'photo', fieldName: 'hydraulic', fileName: 'photo.jpg', blob: new Blob(['image']) }]);
    mocks.upload.mockResolvedValueOnce({ data: null, error: { message: 'JWT expired', statusCode: '401' } });
    await expect(submitOfflineForm('equipment', { user_id: 'worker', __offlineQueueId: 'q' }, ['photo'])).rejects.toThrow('Sign in');
    expect(mocks.cleanup).not.toHaveBeenCalled();
    expect(mocks.query.insert).not.toHaveBeenCalled();
  });
  it('preserves photos after an interrupted upload and retries the same object path', async () => {
    mocks.photos.mockResolvedValue([{ id: 'photo', fieldName: 'hydraulic', fileName: 'photo.jpg', blob: new Blob(['image']), contentType: 'image/jpeg' }]);
    mocks.upload.mockResolvedValueOnce({ data: null, error: { message: 'Network interrupted' } })
      .mockResolvedValueOnce({ data: { path: 'worker/photo-hydraulic.jpg' }, error: null });
    const payload = { user_id: 'worker', __offlineQueueId: 'q', id: 'stable-record' };
    await expect(submitOfflineForm('equipment', payload, ['photo'])).rejects.toThrow('Network interrupted');
    expect(mocks.query.insert).not.toHaveBeenCalled();
    expect(mocks.cleanup).not.toHaveBeenCalled();
    await submitOfflineForm('equipment', payload, ['photo']);
    expect(mocks.upload.mock.calls[0][0]).toBe(mocks.upload.mock.calls[1][0]);
    expect(mocks.cleanup).toHaveBeenCalledWith('q');
  });
  it('pins upload and insert authorization to the original account during a switch', async () => {
    mocks.photos.mockResolvedValue([{ id: 'photo', fieldName: 'oil_dipstick', fileName: 'photo.jpg', blob: new Blob(['image']) }]);
    mocks.upload.mockImplementationOnce(async () => {
      mocks.getSession.mockResolvedValue({ data: { session: { user: { id: 'other' }, access_token: 'other-token' } }, error: null });
      return { data: { path: 'worker/photo-oil_dipstick.jpg' }, error: null };
    });
    await submitOfflineForm('dvir', { user_id: 'worker', __offlineQueueId: 'q' }, ['photo']);
    expect(mocks.upload.mock.calls[0][2].headers.Authorization).toBe('Bearer worker-token');
    expect(mocks.query.setHeader).toHaveBeenCalledWith('Authorization', 'Bearer worker-token');
    expect(mocks.query.setHeader).not.toHaveBeenCalledWith('Authorization', 'Bearer other-token');
  });
  it('recognizes a committed submission after its original response was lost', async () => {
    mocks.query.maybeSingle.mockResolvedValue({ data: { id: 'stable-id' }, error: null });
    await submitOfflineForm('jsa', { id: 'stable-id', user_id: 'worker', __offlineQueueId: 'q' }, []);
    expect(mocks.query.insert).not.toHaveBeenCalled();
    expect(mocks.cleanup).toHaveBeenCalledWith('q');
  });
});

describe('DVIR conflict scope', () => {
  const item = { formType: 'dvir', userId: 'worker', dateFor: '2026-09-23', payload: {
    truck_number: 'B132', inspection_type: 'post_trip', created_at: '2026-09-23T02:30:00Z',
  } } as QueuedSubmission;
  it('uses truck, pre/post-trip, and Chicago date, including legacy UTC queue dates', async () => {
    await hasOfflineConflict(item, 'worker');
    expect(mocks.query.eq).toHaveBeenCalledWith('truck_number', 'B132');
    expect(mocks.query.eq).toHaveBeenCalledWith('inspection_type', 'post_trip');
    expect(mocks.query.eq).toHaveBeenCalledWith('report_date', '2026-09-22');
    expect(mocks.query.limit).toHaveBeenCalledWith(1);
  });
  it('preserves the queue when the conflict lookup fails', async () => {
    mocks.query.maybeSingle.mockResolvedValue({ data: null, error: { message: 'Network failed' } });
    await expect(hasOfflineConflict(item, 'worker')).rejects.toThrow('Network failed');
  });
});
