import { beforeEach, describe, expect, it, vi } from 'vitest';
import { submitOfflineForm, hasOfflineConflict } from '../../../src/lib/offlineSubmission';
import type { QueuedSubmission } from '../../../src/lib/offlineQueue';

const mocks = vi.hoisted(() => {
  const query: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const method of ['insert', 'update', 'select', 'eq', 'limit']) query[method] = vi.fn(() => query);
  query.single = vi.fn(async () => ({ data: { id: 'saved' }, error: null }));
  query.maybeSingle = vi.fn(async () => ({ data: null, error: null }));
  return { query, from: vi.fn(() => query), getSession: vi.fn(), photos: vi.fn(), cleanup: vi.fn() };
});
vi.mock('../../../src/lib/supabaseClient', () => ({ supabase: {
  from: mocks.from, auth: { getSession: mocks.getSession },
} }));
vi.mock('../../../src/lib/offlinePhotoStore', () => ({
  getPhotosForQueue: mocks.photos, deletePhotosForQueue: mocks.cleanup,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSession.mockResolvedValue({ data: { session: { user: { id: 'worker' } } }, error: null });
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
