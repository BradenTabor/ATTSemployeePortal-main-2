import { useEffect, useRef, useState } from 'react';
import { loadPhotoDraft, savePhotoDraft, type DraftPhotos } from '../lib/formPhotoDrafts';
import { logger } from '../lib/logger';
import { toast } from 'sonner';

/** Keep original files in IndexedDB, scoped to the signed-in user and form. */
export function usePhotoDraft(
  formType: 'dvir' | 'equipment',
  userId: string | undefined,
  photos: DraftPhotos,
  onRestore: (photos: DraftPhotos) => void,
  restore = true,
) {
  const key = userId ? `${formType}:${userId}` : null;
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const latest = useRef({ photos, onRestore });
  useEffect(() => { latest.current = { photos, onRestore }; }, [photos, onRestore]);
  const writes = useRef(Promise.resolve());

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    const initialPhotos = latest.current.photos;
    (restore ? loadPhotoDraft(key) : Promise.resolve({})).then(saved => {
      if (cancelled) return;
      if (latest.current.photos === initialPhotos && Object.keys(saved).length) latest.current.onRestore(saved);
      setLoadedKey(key);
    }).catch(error => {
      logger.error('Could not restore form photos', error);
      toast.error('Photo recovery unavailable', { description: 'Keep this page open until you submit your photos.' });

    });
    return () => { cancelled = true; };
  }, [key, restore]);

  useEffect(() => {
    if (!key || loadedKey !== key) return;
    writes.current = writes.current.then(() => savePhotoDraft(key, photos)).catch(error => {
      logger.error('Could not save draft photos', error);
      toast.error('Photos could not be saved on this device', { description: 'Keep this page open and submit before leaving.' });
    });
  }, [key, loadedKey, photos]);

  return { restoring: Boolean(key && loadedKey !== key) };
}
