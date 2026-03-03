# Reference: Offline Integration Code Pattern

## Submission Hook — Offline Branch

This goes in the form's submission hook (e.g., `use<FormName>Submission.ts`), before the existing online Supabase insert:

```typescript
import { isOnline, addToQueue } from '@/lib/offlineQueue';
import { storePhotosForQueue, compressImage } from '@/lib/offlinePhotoStore';

// Inside the submit function, before the online path:

if (!isOnline()) {
  const tempQueueId = `atts-q-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  // ── Store photos (skip this block if form has no photos) ──
  const photoEntries = [];
  for (const file of pendingPhotoFiles) {
    const compressed = await compressImage(file, {
      maxSizeMB: 2,
      maxWidthOrHeight: 2048,
      initialQuality: 0.85,
    });
    photoEntries.push({
      fieldName: file.fieldName,         // e.g., 'site_photo', 'hazard_1'
      blob: compressed as Blob,
      fileName: file.name,
      contentType: compressed.type || 'image/jpeg',
      compressed: true,
    });
  }
  const photoIds = photoEntries.length > 0
    ? await storePhotosForQueue(tempQueueId, '<form_type>', photoEntries)
    : [];

  // ── Build the insert payload (same shape as the online path) ──
  const insertPayload = transformToDBShape(formState);
  (insertPayload as Record<string, unknown>).__offlineQueueId = tempQueueId;

  // Clear or placeholder photo paths
  // Option A: For array-style paths (JSA pattern)
  insertPayload.photo_paths = [];
  // Option B: For individual field paths (DVIR pattern)
  // insertPayload.site_photo_path = `offline://${tempQueueId}/site_photo`;

  // ── Enqueue ──
  await addToQueue('<form_type>', insertPayload, {
    userId,
    dateFor: formState.date ?? undefined,
    photoIds,
  });

  return { success: true, queued: true };
}

// ── Existing online path continues below ──
```

## Submitter Function Template

Add this in `src/contexts/OfflineQueueContext.tsx` (or a dedicated file imported by the context):

```typescript
import { getPhotosForQueue, deletePhotosForQueue } from '../lib/offlinePhotoStore';

async function submit<FormName>(
  payload: Record<string, unknown>,
  photoIds: string[],
  queueId: string,
  userId: string,
): Promise<void> {
  // 1. Retrieve stored photos
  const photos = await getPhotosForQueue(queueId);

  // 2. Upload to Supabase Storage
  const uploadedPaths: Record<string, string> = {};
  for (const photo of photos) {
    const storagePath = `<form_type>/${userId}/${Date.now()}_${photo.fileName}`;
    const { error: uploadError } = await supabase.storage
      .from('<bucket_name>')
      .upload(storagePath, photo.blob, {
        contentType: photo.contentType,
        upsert: false,
      });
    if (uploadError) {
      throw new Error(`Photo upload failed for ${photo.fieldName}: ${uploadError.message}`);
    }
    uploadedPaths[photo.fieldName] = storagePath;
  }

  // 3. Replace placeholder/empty paths in payload
  // Option A: Array-style (JSA pattern)
  payload.photo_paths = Object.values(uploadedPaths);
  // Option B: Individual fields (DVIR pattern)
  // for (const [fieldName, path] of Object.entries(uploadedPaths)) {
  //   payload[`${fieldName}_path`] = path;
  // }

  // 4. Remove queue metadata
  delete payload.__offlineQueueId;

  // 5. Insert to database
  const { error: insertError } = await supabase
    .from('<table_name>')
    .insert(payload);
  if (insertError) throw insertError;

  // 6. Verify insert (optional but recommended for safety forms)
  const { data: verify } = await supabase
    .from('<table_name>')
    .select('id')
    .eq('submitted_by', payload.submitted_by as string)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (!verify) {
    throw new Error('Insert verification failed — record not found after insert');
  }

  // 7. Clean up photo blobs from IndexedDB
  await deletePhotosForQueue(queueId);
}
```

## Conflict Check Template (Optional)

```typescript
// In OfflineQueueContext.tsx conflictCheck callback:

case '<form_type>': {
  const { data: existing } = await supabase
    .from('<table_name>')
    .select('id')
    .eq('submitted_by', userId)
    .eq('date_for', payload.date_for as string)
    .maybeSingle();

  if (existing) {
    return {
      hasConflict: true,
      existingId: existing.id,
      message: `A <form name> already exists for this date`,
    };
  }
  return { hasConflict: false };
}
```

## Notes
- The `compressImage` utility returns a Blob. It reduces file size before IndexedDB storage.
- `storePhotosForQueue` returns an array of photo IDs — pass these to `addToQueue` so the sync engine knows which photos belong to which queue entry.
- The `deletePhotosForQueue` call in the submitter is critical — without it, orphaned photo blobs accumulate in IndexedDB and can exhaust the ~50MB quota.
- The verification step (step 6) is optional but strongly recommended for safety-critical forms where data loss has compliance implications.
