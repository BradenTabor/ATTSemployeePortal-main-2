# Photo Compression & Batch Upload (Phase 2)

## Client-side compression

All form photo uploads (DVIR and Daily Equipment Inspection) are compressed **before** upload using `browser-image-compression`:

- **Settings:** max 1 MB, max dimension 1920 px, initial quality 0.85. Non-image files are left unchanged.
- **Where:** `src/lib/imageCompression.ts` – used by `useDVIRPhotoUpload` and by the equipment form’s `uploadPhoto` callback.
- **Failure:** If compression fails, the original file is uploaded.

## Batch upload (Equipment form)

The Daily Equipment Inspection form supports **additional photos** (optional):

- **Schema:** `daily_equipment_inspections.additional_photo_paths` (text array, nullable).
- **UI:** “Additional photos (optional)” with “Add photos” (multi-select); count and “Clear” are shown.
- **Flow:** Each selected file is compressed, then uploaded; paths are stored in `additional_photo_paths`. On submit failure, all uploaded photos (including these) are removed from storage.

## References

- Phase 2 Plan: `docs/Phase2-Plan.md`
- Compression util: `src/lib/imageCompression.ts`
- DVIR upload: `src/hooks/dvir/useDVIRPhotoUpload.ts`
- Equipment form: `src/pages/forms/DailyEquipmentInspectionForm.tsx`
- Migration: `supabase/migrations/20260229200004_equipment_additional_photo_paths.sql`
