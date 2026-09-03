import { describe, it, expect, vi } from 'vitest';
import { fetchRemoteVersion, isDifferentBuild, isRemoteVersion } from '@/lib/appUpdate/versionCheck';

const jsonResponse = (body: unknown, ok = true) =>
  ({ ok, json: async () => body }) as unknown as Response;

describe('versionCheck', () => {
  it('validates the version.json shape', () => {
    expect(isRemoteVersion({ version: '1.1.0', buildTime: '2026-09-02T00:00:00Z' })).toBe(true);
    expect(isRemoteVersion({ version: '1.1.0' })).toBe(false);
    expect(isRemoteVersion({ version: '1.1.0', buildTime: '' })).toBe(false);
    expect(isRemoteVersion(null)).toBe(false);
    expect(isRemoteVersion('1.1.0')).toBe(false);
  });

  it('fetches with cache-busting and no-store', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ version: '1.2.0', buildTime: 'T2' }));
    const result = await fetchRemoteVersion(fetchImpl as unknown as typeof fetch, 12345);
    expect(result).toEqual({ version: '1.2.0', buildTime: 'T2' });
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/version.json?t=12345');
    expect(init.cache).toBe('no-store');
  });

  it('returns null (never "new version") on network error, non-2xx, or malformed body', async () => {
    const failing = vi.fn().mockRejectedValue(new TypeError('offline'));
    expect(await fetchRemoteVersion(failing as unknown as typeof fetch)).toBeNull();

    const notFound = vi.fn().mockResolvedValue(jsonResponse({ version: 'x', buildTime: 'y' }, false));
    expect(await fetchRemoteVersion(notFound as unknown as typeof fetch)).toBeNull();

    const html = vi.fn().mockResolvedValue({ ok: true, json: async () => { throw new SyntaxError('<!doctype'); } });
    expect(await fetchRemoteVersion(html as unknown as typeof fetch)).toBeNull();
  });

  it('compares builds by buildTime only', () => {
    expect(isDifferentBuild({ version: '1.1.0', buildTime: 'T1' }, 'T1')).toBe(false);
    expect(isDifferentBuild({ version: '1.1.0', buildTime: 'T2' }, 'T1')).toBe(true);
    expect(isDifferentBuild({ version: '9.9.9', buildTime: 'T1' }, 'T1')).toBe(false);
    expect(isDifferentBuild(null, 'T1')).toBe(false);
  });
});
