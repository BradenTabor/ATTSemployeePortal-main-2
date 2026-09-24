import { openDB } from 'idb';
import { readBlobBytes } from './blobBytes';

export type DraftPhotos = Record<string, File>;
interface StoredPhoto { name: string; type: string; lastModified: number; blob: Blob | ArrayBuffer }

const database = () => openDB('atts-form-photo-drafts', 1, {
  upgrade(db) { db.createObjectStore('drafts'); },
});

export async function loadPhotoDraft(key: string): Promise<DraftPhotos> {
  const db = await database();
  try {
    const stored = await db.get('drafts', key) as Record<string, StoredPhoto> | undefined;
    return Object.fromEntries(Object.entries(stored ?? {}).map(([slot, photo]) => [slot,
      new File([photo.blob], photo.name, { type: photo.type, lastModified: photo.lastModified }),
    ]));
  } finally { db.close(); }
}

/** One transaction replaces the snapshot, including removals and retaken photos. */
export async function savePhotoDraft(key: string, photos: DraftPhotos): Promise<void> {
  const db = await database();
  try {
    if (!Object.keys(photos).length) { await db.delete('drafts', key); return; }
    const stored = Object.fromEntries(await Promise.all(Object.entries(photos).map(async ([slot, file]) => [slot, {
      name: file.name, type: file.type, lastModified: file.lastModified, blob: await readBlobBytes(file),
    }])));
    await db.put('drafts', stored, key);
  } finally { db.close(); }
}
