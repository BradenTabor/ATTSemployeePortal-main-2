import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { readBlobBytes } from '../../src/lib/blobBytes';
import { loadPhotoDraft, savePhotoDraft } from '../../src/lib/formPhotoDrafts';

describe('photo draft persistence', () => {
  it('restores required and additional photos with names and types', async () => {
    await savePhotoDraft('equipment:worker', {
      hydraulic: new File(['hydraulic'], 'fluid.jpg', { type: 'image/jpeg' }),
      additional_0: new File(['damage'], 'damage.png', { type: 'image/png' }),
    });
    const files = await loadPhotoDraft('equipment:worker');
    expect(Object.keys(files)).toEqual(['hydraulic', 'additional_0']);
    expect(files.hydraulic.name).toBe('fluid.jpg');
    expect(new TextDecoder().decode(await readBlobBytes(files.hydraulic))).toBe('hydraulic');
    expect(files.additional_0.type).toBe('image/png');
    expect(await loadPhotoDraft('equipment:other-worker')).toEqual({});
  });
  it('replaces a retaken photo and clears completed/discarded drafts', async () => {
    await savePhotoDraft('dvir:worker', { oil: new File(['first'], 'first.jpg') });
    await savePhotoDraft('dvir:worker', { oil: new File(['second'], 'second.jpg') });
    expect((await loadPhotoDraft('dvir:worker')).oil.name).toBe('second.jpg');
    await savePhotoDraft('dvir:worker', {});
    expect(await loadPhotoDraft('dvir:worker')).toEqual({});
  });
});
