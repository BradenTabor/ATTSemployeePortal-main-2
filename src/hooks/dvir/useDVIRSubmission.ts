import { useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { CONFIG } from '../../lib/config';
import { logger } from '../../lib/logger';
import { formToast } from '../../lib/formToast';
import { trackFormSubmitted, trackFormSubmitError } from '../../lib/telemetry';
import { parseFormError } from '../../lib/errorHandling';
import { isOnline, addToQueue } from '../../lib/offlineQueue';
import { storePhotosForQueue } from '../../lib/offlinePhotoStore';
import { compressImage } from '../../lib/imageCompression';
import type { DVIRFormState, ExtraPhotos } from '../../pages/forms/dvir';

interface SubmissionOptions {
  form: DVIRFormState;
  oilDipstickPhoto: File | null;
  extraPhotos: ExtraPhotos;
  uploadPhoto: (file: File, type: string) => Promise<string>;
  formStartTime: number;
  onSuccess: () => void;
  onError: (error: Error) => void;
}

interface SubmissionResult {
  success: boolean;
  error?: Error;
}

/**
 * Custom hook for DVIR form submission
 * Handles photo uploads, database operations, and webhook calls
 * Extracted to reduce DVIRForm component size (ARCH-002)
 */
export function useDVIRSubmission() {
  const submitDVIR = useCallback(async (
    options: SubmissionOptions
  ): Promise<SubmissionResult> => {
    const {
      form,
      oilDipstickPhoto,
      extraPhotos,
      uploadPhoto,
      formStartTime,
      onSuccess,
      onError,
    } = options;

    // Track uploaded photo paths for cleanup on failure
    const uploadedPhotoPaths: string[] = [];

    try {
      // 1) Ensure we have an authenticated user
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        logger.error("Auth error in DVIR submit (getUser):", userError);
        formToast.error("Authentication Error", `Unable to load user: ${userError.message}`);
        throw new Error(`Authentication error: ${userError.message}`);
      }

      if (!user) {
        logger.error("No authenticated user in DVIR submit");
        formToast.error("Authentication Error", "You must be logged in to submit a DVIR.");
        throw new Error("No authenticated user");
      }

      // 2) Ensure Supabase session/JWT is loaded so RLS auth.uid() is not null
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        logger.error("Auth session error in DVIR submit (getSession):", sessionError);
        formToast.error("Session Error", "Unable to verify your session. Please refresh the page and try again.");
        throw new Error(`Session error: ${sessionError.message}`);
      }

      if (!session) {
        logger.warn("No active session in DVIR submit – auth still hydrating?");
        formToast.error("Session Error", "Your session is still loading. Please wait a moment and try again.");
        throw new Error("No active session");
      }

      const userId = user.id;
      const userEmail = user.email ?? null;

      // 2.5) Offline: compress photos, store blobs in IndexedDB, queue for sync
      if (!isOnline()) {
        logger.info('[DVIR] Offline: compressing and queuing with photos');

        try {
          const tempQueueId = `atts-q-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
          const photoEntries: Array<{
            fieldName: string;
            blob: Blob;
            fileName: string;
            contentType: string;
            compressed: boolean;
          }> = [];

          // Compress and collect all photos
          if (oilDipstickPhoto) {
            const compressed = await compressImage(oilDipstickPhoto);
            photoEntries.push({
              fieldName: 'oil_dipstick',
              blob: compressed as Blob,
              fileName: oilDipstickPhoto.name,
              contentType: compressed.type || 'image/jpeg',
              compressed: true,
            });
          }
          if (extraPhotos.tire) {
            const compressed = await compressImage(extraPhotos.tire);
            photoEntries.push({
              fieldName: 'tire',
              blob: compressed as Blob,
              fileName: extraPhotos.tire.name,
              contentType: compressed.type || 'image/jpeg',
              compressed: true,
            });
          }
          if (extraPhotos.coolant) {
            const compressed = await compressImage(extraPhotos.coolant);
            photoEntries.push({
              fieldName: 'coolant',
              blob: compressed as Blob,
              fileName: extraPhotos.coolant.name,
              contentType: compressed.type || 'image/jpeg',
              compressed: true,
            });
          }
          if (extraPhotos.damage) {
            const compressed = await compressImage(extraPhotos.damage);
            photoEntries.push({
              fieldName: 'damage',
              blob: compressed as Blob,
              fileName: extraPhotos.damage.name,
              contentType: compressed.type || 'image/jpeg',
              compressed: true,
            });
          }
          if (extraPhotos.mileage) {
            const compressed = await compressImage(extraPhotos.mileage);
            photoEntries.push({
              fieldName: 'detail-clean_truck',
              blob: compressed as Blob,
              fileName: extraPhotos.mileage.name,
              contentType: compressed.type || 'image/jpeg',
              compressed: true,
            });
          }

          // Store all photos in offline photo store
          const photoIds = await storePhotosForQueue(tempQueueId, 'dvir', photoEntries);

          // Build payload with placeholder photo paths
          const offlinePayload: Record<string, unknown> = {
            __offlineQueueId: tempQueueId,
            user_id: userId,
            user_email: userEmail,
            created_at: new Date().toISOString(),
            truck_number: form.truckNumber,
            mileage: Number(form.mileage),
            chipper_number: form.chipperNumber || null,
            trailer_number: form.trailerNumber || null,
            truck_gvwr: form.truckGvwr || null,
            trailer_chipper_gvwr: form.trailerChipperGvwr || null,
            medical_card_required: form.medicalCardRequired || null,
            drivers_name: form.driversName,
            drivers_license_number: form.driversLicenseNumber || null,
            drivers_license_class: form.driversLicenseClass || null,
            drivers_license_exp: form.driversLicenseExp || null,
            drivers_license_required: form.driversLicenseRequired || null,
            has_medical_card: form.hasMedicalCard || null,
            medical_card_exp: form.medicalCardExp || null,
            copy_of_registration: form.copyOfRegistration || null,
            copy_of_insurance: form.copyOfInsurance || null,
            vehicle_trailer_checklist: form.vehicleTrailerChecklist,
            notes: form.notes || null,
            aerial_checklist: form.aerialChecklist,
            aerial_notes: form.aerialNotes || null,
            final_driver_signature: form.finalDriverSignature?.trim() || null,
            general_foreman_signature: form.generalForemanSignature?.trim() || null,
            mechanic_truck_number: form.mechTruckNumber || null,
            mechanic_date: form.mechanicDate || null,
            deficiency_corrected: form.deficiencyCorrected || null,
            mechanic_remarks: form.mechanicRemarks || null,
            mechanic_signature: form.mechanicSignature?.trim() || null,
            driver_approval_signature: form.driverApprovalSignature?.trim() || null,
            // Photo paths are placeholders — replaced during sync
            oil_dipstick_path: `offline://${tempQueueId}/oil_dipstick`,
            tire_photo_path: extraPhotos.tire ? `offline://${tempQueueId}/tire` : null,
            coolant_photo_path: extraPhotos.coolant ? `offline://${tempQueueId}/coolant` : null,
            damage_photo_path: extraPhotos.damage ? `offline://${tempQueueId}/damage` : null,
            detail_clean_truck_photo_path: extraPhotos.mileage ? `offline://${tempQueueId}/detail-clean_truck` : null,
          };

          await addToQueue('dvir', offlinePayload, {
            userId,
            dateFor: new Date().toISOString().split('T')[0],
            photoIds,
          });

          logger.info('[DVIR] Offline: queued with photos', {
            photoCount: photoIds.length,
            totalSizeKB: Math.round(photoEntries.reduce((sum, p) => sum + p.blob.size, 0) / 1024),
          });

          formToast.success(
            "DVIR Saved Offline",
            "Your DVIR will sync automatically when you're back online."
          );
          onSuccess();
          return { success: true };
        } catch (offlineErr) {
          logger.error('[DVIR] Offline queue failed:', offlineErr);
          formToast.error(
            "Offline Save Failed",
            "Could not save DVIR offline. Please try again."
          );
          return { success: false };
        }
      }

      // 3) Upload required oil dipstick photo
      logger.debug("Uploading oil dipstick photo...");
      if (!oilDipstickPhoto) {
        throw new Error("Oil dipstick photo is required");
      }
      const oilDipstickPath = await uploadPhoto(oilDipstickPhoto, "oil_dipstick");
      uploadedPhotoPaths.push(oilDipstickPath);
      logger.debug("Oil dipstick uploaded:", oilDipstickPath);

      // 4) Upload optional photos
      let tirePhotoPath: string | null = null;
      let coolantPhotoPath: string | null = null;
      let damagePhotoPath: string | null = null;
      let detailCleanTruckPhotoPath: string | null = null;

      if (extraPhotos.tire) {
        logger.debug("Uploading tire photo...");
        tirePhotoPath = await uploadPhoto(extraPhotos.tire, "tire");
        uploadedPhotoPaths.push(tirePhotoPath);
      }
      if (extraPhotos.coolant) {
        logger.debug("Uploading coolant photo...");
        coolantPhotoPath = await uploadPhoto(extraPhotos.coolant, "coolant");
        uploadedPhotoPaths.push(coolantPhotoPath);
      }
      if (extraPhotos.damage) {
        logger.debug("Uploading damage photo...");
        damagePhotoPath = await uploadPhoto(extraPhotos.damage, "damage");
        uploadedPhotoPaths.push(damagePhotoPath);
      }
      if (extraPhotos.mileage) {
        logger.debug("Uploading detail-clean truck photo...");
        detailCleanTruckPhotoPath = await uploadPhoto(
          extraPhotos.mileage,
          "detail-clean_truck"
        );
        uploadedPhotoPaths.push(detailCleanTruckPhotoPath);
      }

      // 5) Signature values (typed; stored as text)
      const finalDriverSig = form.finalDriverSignature?.trim() || null;
      const generalForemanSig = form.generalForemanSignature?.trim() || null;
      const mechanicSig = form.mechanicSignature?.trim() || null;
      const driverApprovalSig = form.driverApprovalSignature?.trim() || null;

      // 6) Build common payload object once
      const commonPayload = {
        user_id: userId,
        user_email: userEmail,
        created_at: new Date().toISOString(),

        // Section A
        truck_number: form.truckNumber,
        mileage: form.mileage,
        chipper_number: form.chipperNumber || null,
        trailer_number: form.trailerNumber || null,
        truck_gvwr: form.truckGvwr || null,
        trailer_chipper_gvwr: form.trailerChipperGvwr || null,
        medical_card_required: form.medicalCardRequired || null,
        drivers_name: form.driversName,
        drivers_license_number: form.driversLicenseNumber || null,
        drivers_license_class: form.driversLicenseClass || null,
        drivers_license_exp: form.driversLicenseExp || null,
        drivers_license_required: form.driversLicenseRequired || null,
        has_medical_card: form.hasMedicalCard || null,
        medical_card_exp: form.medicalCardExp || null,
        copy_of_registration: form.copyOfRegistration || null,
        copy_of_insurance: form.copyOfInsurance || null,

        // Checklists & notes
        vehicle_trailer_checklist: form.vehicleTrailerChecklist,
        notes: form.notes || null,
        aerial_checklist: form.aerialChecklist,
        aerial_notes: form.aerialNotes || null,

        // Signatures (typed text)
        final_driver_signature: finalDriverSig,
        general_foreman_signature: generalForemanSig,
        mechanic_truck_number: form.mechTruckNumber || null,
        mechanic_date: form.mechanicDate || null,
        deficiency_corrected: form.deficiencyCorrected || null,
        mechanic_remarks: form.mechanicRemarks || null,
        mechanic_signature: mechanicSig,
        driver_approval_signature: driverApprovalSig,

        // Photos
        oil_dipstick_path: oilDipstickPath,
        tire_photo_path: tirePhotoPath,
        coolant_photo_path: coolantPhotoPath,
        damage_photo_path: damagePhotoPath,
        detail_clean_truck_photo_path: detailCleanTruckPhotoPath,
      };

      // 7) FIRST save to Supabase (DB is the source of truth)
      logger.debug("Inserting DVIR into dvir_reports...");
      const { error: insertError } = await supabase
        .from("dvir_reports")
        .insert({
          // ✅ Do NOT send user_id – DB will default it to auth.uid()

          // Section A
          truck_number: form.truckNumber,
          mileage: Number(form.mileage),
          chipper_number: form.chipperNumber || null,
          trailer_number: form.trailerNumber || null,
          truck_gvwr: form.truckGvwr || null,
          trailer_chipper_gvwr: form.trailerChipperGvwr || null,
          medical_card_required: form.medicalCardRequired || null,
          drivers_name: form.driversName,
          drivers_license_number: form.driversLicenseNumber || null,
          drivers_license_class: form.driversLicenseClass || null,
          drivers_license_exp: form.driversLicenseExp || null,
          drivers_license_required: form.driversLicenseRequired || null,
          has_medical_card: form.hasMedicalCard || null,
          medical_card_exp: form.medicalCardExp || null,
          copy_of_registration: form.copyOfRegistration || null,
          copy_of_insurance: form.copyOfInsurance || null,

          // Vehicle / Trailer checklist
          vehicle_trailer_checklist: form.vehicleTrailerChecklist,

          // Notes
          notes: form.notes || null,

          // Aerial lift
          aerial_checklist: form.aerialChecklist,
          aerial_notes: form.aerialNotes || null,

          // Final sign-off (typed signatures)
          final_driver_signature: finalDriverSig,
          general_foreman_signature: generalForemanSig,

          // Mechanic section
          mechanic_truck_number: form.mechTruckNumber || null,
          mechanic_date: form.mechanicDate || null,
          deficiency_corrected: form.deficiencyCorrected || null,
          mechanic_remarks: form.mechanicRemarks || null,
          mechanic_signature: mechanicSig,
          driver_approval_signature: driverApprovalSig,

          // Photo paths
          oil_dipstick_path: oilDipstickPath,
          tire_photo_path: tirePhotoPath,
          coolant_photo_path: coolantPhotoPath,
          damage_photo_path: damagePhotoPath,
          detail_clean_truck_photo_path: detailCleanTruckPhotoPath,
        });

      if (insertError) {
        logger.error("Supabase insert error (dvir_reports):", insertError);
        formToast.error("Database Error", `Failed to save DVIR to the database: ${insertError.message}`);
        throw new Error(`Database error: ${insertError.message}`);
      }

      // Log form_submitted for baseline metrics (Smart Defaults ROI)
      // IMPORTANT: Log immediately after successful DB insert, before webhook
      logger.info('form_submitted', {
        form_type: 'dvir',
        duration_seconds: Math.round((Date.now() - formStartTime) / 1000),
        timestamp: new Date().toISOString(),
      });

      logger.info("DVIR row inserted successfully. Sending to Make webhook...");

      // 8) THEN send to Make.com webhook (non-blocking for DB save)
      // NOTE: Webhook is optional - if not configured or fails, we still show success since data was saved
      let webhookSuccess = false;
      if (CONFIG.make.dvirWebhook) {
        try {
          const webhookRes = await fetch(
            CONFIG.make.dvirWebhook,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(commonPayload),
            }
          );

          if (!webhookRes.ok) {
            const text = await webhookRes.text();
            logger.error("Make webhook error:", text);
          } else {
            webhookSuccess = true;
            logger.info("Make webhook call succeeded.");
          }
        } catch (webhookErr) {
          logger.error("Make webhook fetch error:", webhookErr);
        }
      } else {
        logger.warn("DVIR webhook URL is not configured - skipping webhook (data was saved to database)");
      }

      // Log if webhook had issues but don't fail the submission
      if (!webhookSuccess && CONFIG.make.dvirWebhook) {
        logger.warn("DVIR saved but webhook call failed - data is safe in database");
        // Show non-blocking info to user that webhook failed but data was saved
        // Use setTimeout to show after success toast/celebration is displayed
        setTimeout(() => {
          formToast.info(
            "Notification Issue",
            "Your DVIR was saved successfully, but there was an issue sending it to the notification system. Your data is safe.",
            { autoDismiss: 8000, lockBackground: false }
          );
        }, 3000);
      }

      // ✅ Telemetry: track successful submission with duration
      trackFormSubmitted({
        form_type: 'dvir',
        duration_seconds: Math.round((Date.now() - formStartTime) / 1000),
      });

      onSuccess();
      return { success: true };
    } catch (err: unknown) {
      logger.error("Unexpected error in DVIR submit:", err);
      
      // Clean up uploaded photos on failure to prevent orphaned files
      if (uploadedPhotoPaths.length > 0) {
        try {
          await supabase.storage
            .from("dvir-photos")
            .remove(uploadedPhotoPaths);
          logger.info(`Cleaned up ${uploadedPhotoPaths.length} orphaned photo(s) after failed submission`);
        } catch (cleanupErr) {
          logger.error("Failed to cleanup orphaned photos:", cleanupErr);
        }
      }
      
      // Parse error using standardized utility for consistent error handling
      const parsedError = parseFormError(err, 'dvir');
      const error = err instanceof Error ? err : new Error(parsedError.userMessage);
      onError(error);
      
      // Telemetry: track server/network error with proper error code
      trackFormSubmitError({
        form_type: 'dvir',
        error_code: parsedError.code,
      });
      
      return { success: false, error };
    }
  }, []);

  return { submitDVIR };
}
