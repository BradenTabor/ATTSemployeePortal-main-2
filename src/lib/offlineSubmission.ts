import { supabase } from './supabaseClient';
import { getPhotosForQueue, deletePhotosForQueue, type OfflinePhoto } from './offlinePhotoStore';
import { mapWithConcurrency, UPLOAD_CONCURRENCY } from './asyncPool';
import { logger } from './logger';
import type { OfflineSubmitter, QueuedSubmission } from './offlineQueue';
import { formatInTimeZone } from 'date-fns-tz';

/** Upload a single offline photo blob to Supabase Storage with upsert: true. */
async function uploadOfflinePhoto(
  photo: OfflinePhoto,
  bucket: string,
  userId: string,
): Promise<string> {
  const ext = photo.fileName.split('.').pop() || 'jpg';
  const filePath = `${userId}/${photo.id}-${photo.fieldName}.${ext}`;

  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(filePath, photo.blob, {
      cacheControl: '3600',
      upsert: true, // Idempotent: re-upload on interrupted retry won't 409
      contentType: photo.contentType || 'image/jpeg',
    });

  if (error) {
    logger.error(`[OfflineQueue] Photo upload failed: ${photo.fieldName}`, error);
    throw new Error(`Photo upload failed (${photo.fieldName}): ${error.message}`);
  }

  return data.path;
}

/** Upload all photos for a queue entry, returning a map of fieldName → storagePath. */
async function uploadQueuePhotos(
  queueId: string,
  bucket: string,
  userId: string,
): Promise<Map<string, string>> {
  const photos = await getPhotosForQueue(queueId);
  const pathMap = new Map<string, string>();

  // Bounded parallelism — a queued DVIR can hold five photos, and the sync
  // usually happens the moment the truck gets one bar of LTE back.
  const paths = await mapWithConcurrency(photos, UPLOAD_CONCURRENCY, (photo) =>
    uploadOfflinePhoto(photo, bucket, userId),
  );
  photos.forEach((photo, i) => pathMap.set(photo.fieldName, paths[i]));

  return pathMap;
}

// ---------------------------------------------------------------------------
// Form-specific submitters
// ---------------------------------------------------------------------------

async function submitJSA(
  payload: Record<string, unknown>,
  photoIds: string[],
  queueId: string,
  userId: string,
  recordId?: string,
): Promise<void> {
  // If there are offline photos, upload them first
  if (photoIds.length > 0) {
    const pathMap = await uploadQueuePhotos(queueId, 'jsa-photos', userId);
    if (pathMap.size > 0) {
      // Merge photo paths into the payload
      const existingPaths = (payload.jsa_photo_paths as string[] | undefined) ?? [];
      const newPaths = Array.from(pathMap.values());
      payload.jsa_photo_paths = [...existingPaths, ...newPaths];
    }
  }

  if (!recordId) payload.user_id = userId; // Also repair legacy queues missing ownership.
  const query = recordId
    ? supabase.from("daily_jsa").update(payload).eq('id', recordId)
    : supabase.from("daily_jsa").insert([payload]);
  const { error } = await query.select("id").single();

  if (error) throw new Error(error.message);

  // Integrity check: read back the record
  // (we trust the insert returned OK + the uploads returned paths)

  // Clean up photos from offline store
  if (photoIds.length > 0) {
    await deletePhotosForQueue(queueId);
  }
}

async function submitDVIR(
  payload: Record<string, unknown>,
  _photoIds: string[],
  queueId: string,
  userId: string,
): Promise<void> {
  // Upload all photos from offline store
  const pathMap = await uploadQueuePhotos(queueId, 'dvir-photos', userId);

  // Replace placeholder paths with real storage paths
  if (pathMap.has('oil_dipstick')) payload.oil_dipstick_path = pathMap.get('oil_dipstick');
  if (pathMap.has('tire')) payload.tire_photo_path = pathMap.get('tire');
  if (pathMap.has('coolant')) payload.coolant_photo_path = pathMap.get('coolant');
  if (pathMap.has('damage')) payload.damage_photo_path = pathMap.get('damage');
  if (pathMap.has('detail-clean_truck')) payload.detail_clean_truck_photo_path = pathMap.get('detail-clean_truck');

  // Remove user_id from payload — DB defaults it via auth.uid() (RLS)
  const { user_id: _uid, user_email: _email, ...insertPayload } = payload;
  void _uid;
  void _email;

  const { data, error } = await supabase
    .from("dvir_reports")
    .insert([insertPayload])
    .select("id, oil_dipstick_path, tire_photo_path, coolant_photo_path, damage_photo_path, detail_clean_truck_photo_path")
    .single();

  if (error) throw new Error(error.message);

  const dvirPhotoFields: Array<{ key: string; col: keyof NonNullable<typeof data> }> = [
    { key: 'oil_dipstick', col: 'oil_dipstick_path' },
    { key: 'tire', col: 'tire_photo_path' },
    { key: 'coolant', col: 'coolant_photo_path' },
    { key: 'damage', col: 'damage_photo_path' },
    { key: 'detail-clean_truck', col: 'detail_clean_truck_photo_path' },
  ];
  if (data) {
    for (const { key, col } of dvirPhotoFields) {
      if (pathMap.has(key)) {
        const expected = pathMap.get(key);
        const actual = data[col];
        if (actual !== expected) {
          logger.warn('[OfflineQueue] DVIR integrity mismatch', { field: col, expected, actual });
        }
      }
    }
  }

  // Clean up photos from offline store
  await deletePhotosForQueue(queueId);
}

async function submitEquipment(
  payload: Record<string, unknown>,
  _photoIds: string[],
  queueId: string,
  userId: string,
): Promise<void> {
  // Upload all photos from offline store
  const pathMap = await uploadQueuePhotos(queueId, 'equipment-inspection-photos', userId);

  // Replace placeholder paths with real storage paths
  if (pathMap.has('overview')) payload.overview_photo_path = pathMap.get('overview');
  if (pathMap.has('damage')) payload.damage_photo_path = pathMap.get('damage');
  if (pathMap.has('attachments')) payload.attachments_photo_path = pathMap.get('attachments');
  if (pathMap.has('hydraulic')) payload.hydraulic_photo_path = pathMap.get('hydraulic');

  // Handle additional photos
  const additionalPaths: string[] = [];
  for (const [key, path] of pathMap) {
    if (key.startsWith('additional_')) {
      additionalPaths.push(path);
    }
  }
  if (additionalPaths.length > 0) {
    payload.additional_photo_paths = additionalPaths;
  }

  const { data, error } = await supabase
    .from("daily_equipment_inspections")
    .insert([payload])
    .select("id, overview_photo_path, damage_photo_path, attachments_photo_path, hydraulic_photo_path, additional_photo_paths")
    .single();

  if (error) throw new Error(error.message);

  const equipmentPhotoFields: Array<{ key: string; col: keyof NonNullable<typeof data> }> = [
    { key: 'overview', col: 'overview_photo_path' },
    { key: 'damage', col: 'damage_photo_path' },
    { key: 'attachments', col: 'attachments_photo_path' },
    { key: 'hydraulic', col: 'hydraulic_photo_path' },
  ];
  if (data) {
    for (const { key, col } of equipmentPhotoFields) {
      if (pathMap.has(key)) {
        const expected = pathMap.get(key);
        const actual = data[col];
        if (actual !== expected) {
          logger.warn('[OfflineQueue] Equipment integrity mismatch', { field: col, expected, actual });
        }
      }
    }
    if (additionalPaths.length > 0 && Array.isArray(data.additional_photo_paths)) {
      const expectedSet = new Set(additionalPaths);
      const actualSet = new Set(data.additional_photo_paths);
      if (expectedSet.size !== actualSet.size || additionalPaths.some((p) => !actualSet.has(p))) {
        logger.warn('[OfflineQueue] Equipment integrity mismatch: additional_photo_paths differs', {
          expected: additionalPaths.length,
          actual: data.additional_photo_paths.length,
        });
      }
    }
  }

  // Clean up photos from offline store
  await deletePhotosForQueue(queueId);
}

async function submitNearMiss(
  payload: Record<string, unknown>,
  photoIds: string[],
  queueId: string,
  userId: string,
): Promise<void> {
  const bucket = 'jsa-photos'; // Reuse safety photos bucket for near-miss
  if (photoIds.length > 0) {
    const pathMap = await uploadQueuePhotos(queueId, bucket, userId);
    const paths = Array.from(pathMap.values());
    const nearMissData = (payload.near_miss_data as Record<string, unknown>) ?? {};
    payload.near_miss_data = { ...nearMissData, photo_paths: paths };
  }

  const { error } = await supabase
    .from('safety_incidents')
    .insert([payload])
    .select('id')
    .single();

  if (error) throw new Error(error.message);

  if (photoIds.length > 0) {
    await deletePhotosForQueue(queueId);
  }
}

/** Keep queue metadata on the device; only database fields cross this boundary. */
export const submitOfflineForm: OfflineSubmitter = async (formType, queuedPayload, photoIds) => {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session) throw new Error(error?.message || 'Sign in to sync pending submissions');
  const userId = session.user.id;
  if (queuedPayload.user_id && queuedPayload.user_id !== userId) {
    throw new Error('Sign in with the account that saved this submission');
  }
  const queueId = String(queuedPayload.__offlineQueueId || '');
  const recordId = typeof queuedPayload.__recordId === 'string' ? queuedPayload.__recordId : undefined;
  const payload = Object.fromEntries(Object.entries(queuedPayload).filter(([key]) => !key.startsWith('__')));
  const tables = { jsa: 'daily_jsa', dvir: 'dvir_reports', equipment: 'daily_equipment_inspections', near_miss: 'safety_incidents' } as const;
  if (!recordId && payload.id && formType in tables) {
    const table = tables[formType as keyof typeof tables];
    const { data, error: lookupError } = await supabase.from(table).select('id').eq('id', payload.id).maybeSingle();
    if (lookupError) throw new Error(lookupError.message);
    if (data) { await deletePhotosForQueue(queueId); return; }
  }
  if (recordId && formType === 'jsa') {
    delete payload.user_id;
    delete payload.created_at;
    delete payload.id;
  }
  if (photoIds.length) {
    const photos = await getPhotosForQueue(queueId);
    const storedIds = new Set(photos.map(photo => photo.id));
    if (photoIds.some(id => !storedIds.has(id))) throw new Error('A queued photo is missing. Keep this submission for recovery; do not discard it.');
  }
  switch (formType) {
    case 'jsa': return submitJSA(payload, photoIds, queueId, userId, recordId);
    case 'dvir': return submitDVIR(payload, photoIds, queueId, userId);
    case 'equipment': return submitEquipment(payload, photoIds, queueId, userId);
    case 'near_miss': return submitNearMiss(payload, photoIds, queueId, userId);
    default: throw new Error(`Unknown form type: ${formType}`);
  }
};

/** A second truck or post-trip inspection is not a duplicate of a pre-trip. */
export async function hasOfflineConflict(item: QueuedSubmission, userId: string): Promise<boolean> {
  if (item.userId && item.userId !== userId) return false;
  if (item.formType === 'dvir') {
    const truck = item.payload.truck_number;
    const created = item.payload.created_at;
    const date = typeof item.payload.report_date === 'string' ? item.payload.report_date
      : typeof created === 'string' && Number.isFinite(Date.parse(created))
        ? formatInTimeZone(new Date(created), 'America/Chicago', 'yyyy-MM-dd') : item.dateFor;
    if (!truck || !date) return false;
    const { data, error } = await supabase.from('dvir_reports').select('id')
      .eq('user_id', userId).eq('report_date', date).eq('truck_number', truck)
      .eq('inspection_type', item.payload.inspection_type || 'pre_trip').limit(1).maybeSingle();
    if (error) throw new Error(error.message);
    return Boolean(data && data.id !== item.payload.id);
  }
  if (item.formType === 'equipment' && item.dateFor && item.payload.equipment_number) {
    const { data, error } = await supabase.from('daily_equipment_inspections').select('id')
      .eq('user_id', userId).eq('inspection_date', item.dateFor)
      .eq('equipment_number', item.payload.equipment_number).limit(1).maybeSingle();
    if (error) throw new Error(error.message);
    return Boolean(data && data.id !== item.payload.id);
  }
  return false;
}
