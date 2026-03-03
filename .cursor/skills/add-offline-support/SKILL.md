---
name: add-offline-support
description: Add offline queue integration to an existing ATTS form — covers isOnline() gating, addToQueue() call, photo compression and storage via offlinePhotoStore, submitter registration in OfflineQueueContext, FormType union update, and sync status UI verification.
triggers:
  - "add offline support"
  - "make form work offline"
  - "offline queue"
  - "offline submission"
  - "add to queue"
version: 1.0
reviewed: 2026-02-17
---

# Add Offline Support

## Purpose
Wires an existing form into the ATTS offline-first architecture. The offline system uses IndexedDB for both queue entries and photo blobs, with a centralized sync engine in `OfflineQueueContext`. Missing any step (photo storage, submitter registration, FormType update) will cause silent data loss.

## Pre-Flight Checklist
- [ ] Form already works online (has a working submission hook)
- [ ] Form type name — lowercase, snake_case (e.g., `hazard_assessment`)
- [ ] Does the form have photo uploads? (determines if offlinePhotoStore is needed)
- [ ] Conflict detection needed? (e.g., one DVIR per vehicle per day — or allow multiples like JSA?)

---

## Architecture Overview

```
Form Submission Hook
  │
  ├─ isOnline() === true  → Supabase insert (existing path)
  │
  └─ isOnline() === false → offlinePhotoStore.storePhotosForQueue()
                            → offlineQueue.addToQueue()
                            → return { success: true, queued: true }

Later, when online:
  OfflineQueueContext.processQueue()
    → submitter(formType, payload, photoIds)
      → getPhotosForQueue() → upload blobs → insert DB → deletePhotosForQueue()
```

Key files:
- `src/lib/offlineQueue.ts` — `isOnline()`, `addToQueue()`, `FormType`
- `src/lib/offlinePhotoStore.ts` — `storePhotosForQueue()`, `getPhotosForQueue()`, `deletePhotosForQueue()`, `compressImage()`
- `src/contexts/OfflineQueueContext.tsx` — `submitter` switch, `conflictCheck`, sync engine

---

## Step-by-Step

### 1. Add to `FormType` Union

In `src/lib/offlineQueue.ts`, add the new form type:

```typescript
export type FormType = 'jsa' | 'dvir' | 'equipment' | 'near_miss' | '<new_form>';
```

### 2. Update the Submission Hook

In the form's existing submission hook (e.g., `use<FormName>Submission.ts`):

```typescript
import { isOnline, addToQueue } from '@/lib/offlineQueue';
import { storePhotosForQueue, compressImage } from '@/lib/offlinePhotoStore';
```

Add the offline branch before the online Supabase insert. See `references/offline-integration-checklist.md` for the full code pattern.

Key rules:
- Generate `tempQueueId` using exact format: `` `atts-q-${Date.now()}-${Math.random().toString(36).slice(2, 9)}` ``
- Embed `__offlineQueueId` in the payload
- Compress photos before storing (max 2MB, 2048px, 85% quality)
- Pass `photoIds` array to `addToQueue()`
- Return `{ success: true, queued: true }` so the form can show a "saved for sync" toast

### 3. Register the Submitter

In `src/contexts/OfflineQueueContext.tsx`, add a case to the `submitter` switch:

```typescript
case '<new_form>':
  return submit<NewForm>(payload, photoIds, queueId, userId);
```

Then create the submitter function (in the same file or a dedicated module):

```typescript
async function submit<NewForm>(
  payload: Record<string, unknown>,
  photoIds: string[],
  queueId: string,
  userId: string,
): Promise<void> {
  // 1. Fetch stored photos
  const photos = await getPhotosForQueue(queueId);

  // 2. Upload each photo to Supabase Storage
  const pathMap: Record<string, string> = {};
  for (const photo of photos) {
    const storagePath = `<new_form>/${userId}/${Date.now()}_${photo.fileName}`;
    const { error } = await supabase.storage
      .from('<bucket-name>')
      .upload(storagePath, photo.blob, { contentType: photo.contentType });
    if (error) throw new Error(`Photo upload failed: ${error.message}`);
    pathMap[photo.fieldName] = storagePath;
  }

  // 3. Replace placeholder paths in payload
  for (const [fieldName, path] of Object.entries(pathMap)) {
    (payload as Record<string, unknown>)[`${fieldName}_path`] = path;
  }

  // 4. Remove internal queue metadata
  delete (payload as Record<string, unknown>).__offlineQueueId;

  // 5. Insert into database
  const { error: insertError } = await supabase
    .from('<table_name>')
    .insert(payload);
  if (insertError) throw insertError;

  // 6. Clean up stored photos
  await deletePhotosForQueue(queueId);
}
```

### 4. Add Conflict Check (If Needed)

For forms that should prevent duplicates (e.g., one per day per entity):

```typescript
// In OfflineQueueContext.tsx, update conflictCheck:
case '<new_form>': {
  const existing = await supabase
    .from('<table_name>')
    .select('id')
    .eq('submitted_by', userId)
    .eq('date_for', payload.date_for)
    .maybeSingle();
  return existing.data ? { hasConflict: true, existingId: existing.data.id } : { hasConflict: false };
}
```

For forms that allow multiples (like JSA), skip this — the default is no conflict check.

### 5. Update Form UI for Offline Feedback

In the form page component, show the queued state:

```typescript
const handleSubmitResult = (result) => {
  if (result.queued) {
    formToast.success('Form saved offline — will sync when connection returns');
  } else {
    formToast.success('Form submitted successfully');
  }
};
```

Verify that `<OfflineFormIndicator />` is present in the form layout (it should already be if the form uses `DashboardLayout`).

---

## Photo Upload Patterns

### Forms WITH photos:
```typescript
const tempQueueId = `atts-q-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const photoEntries = [];
for (const file of pendingPhotoFiles) {
  const compressed = await compressImage(file, {
    maxSizeMB: 2,
    maxWidthOrHeight: 2048,
    initialQuality: 0.85,
  });
  photoEntries.push({
    fieldName: 'field_name',
    blob: compressed as Blob,
    fileName: file.name,
    contentType: compressed.type || 'image/jpeg',
    compressed: true,
  });
}

const photoIds = await storePhotosForQueue(tempQueueId, '<new_form>', photoEntries);
```

### Forms WITHOUT photos:
Skip `storePhotosForQueue`. Pass empty `photoIds`:
```typescript
await addToQueue('<new_form>', insertPayload, {
  userId,
  dateFor: payload.date ?? undefined,
  photoIds: [],
});
```

---

## After Integration Checklist

- [ ] `FormType` union updated in `src/lib/offlineQueue.ts`
- [ ] Submission hook has `isOnline()` check with offline branch
- [ ] `tempQueueId` generated with correct format
- [ ] `__offlineQueueId` embedded in payload
- [ ] Photos compressed and stored via `storePhotosForQueue()` (if applicable)
- [ ] `addToQueue()` called with correct `formType`, `payload`, and `options`
- [ ] Submitter registered in `OfflineQueueContext.tsx` switch statement
- [ ] Submitter uploads photos, replaces paths, inserts to DB, cleans up photos
- [ ] Conflict check added (if needed for the form type)
- [ ] Form UI shows "saved offline" toast when `result.queued === true`
- [ ] Test: disable network in DevTools, submit form, re-enable, verify sync

## Anti-Patterns

- **Never** store uncompressed photos — they can be 10MB+ and exhaust IndexedDB quota
- **Never** skip `deletePhotosForQueue()` in the submitter — orphaned blobs fill up storage
- **Never** use `useOnlineStatus()` hook — use `isOnline()` function from `@/lib/offlineQueue`
- **Never** call `offlineQueue.enqueue()` — this API doesn't exist; use `addToQueue()`
- **Never** forget `__offlineQueueId` in the payload — the submitter needs it to find stored photos
