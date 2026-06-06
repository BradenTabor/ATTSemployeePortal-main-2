/**
 * NearMissReportForm - Lightweight near-miss reporting for all field workers
 *
 * Mobile-first, accessible to ALL authenticated roles. Offline-capable.
 */

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { MapPin, Loader2, ChevronDown, AlertCircle } from 'lucide-react';
import DashboardLayout from '../../layouts/DashboardLayout';
import { glass } from '../../lib/glass';
import { cn } from '../../lib/utils';
import { useAuth } from '../../contexts/AuthContext';
import { useNearMissSubmission } from '../../hooks/nearMiss/useNearMissSubmission';
import { useFormValidation, type ValidationRule } from '../../hooks/useFormValidation';
import { VoiceInputButton } from '../../components/forms/VoiceInputButton';
import { useJSAPhotoUpload } from '../../hooks/jsa/useJSAPhotoUpload';
import { useFormPersistence } from '../../hooks/useFormPersistence';
import { isOnline } from '../../lib/offlineQueue';
import { DraftRecoveryModal } from '../../components/forms/DraftRecoveryModal';
import { FormSuccessCelebration } from '../../components/forms/FormSuccessCelebration';
import type { NearMissCategory } from '../../types/nearMiss';
import type { NearMissFormState } from '../../hooks/nearMiss/useNearMissValidation';
import { formatInTimeZone } from 'date-fns-tz';
import { formToast } from '../../lib/formToast';

const TIMEZONE = 'America/Chicago';
const CATEGORIES: { value: NearMissCategory; label: string }[] = [
  { value: 'fall_hazard', label: 'Fall Hazard' },
  { value: 'struck_by', label: 'Struck By' },
  { value: 'electrical', label: 'Electrical' },
  { value: 'caught_in', label: 'Caught In/Between' },
  { value: 'vehicle', label: 'Vehicle' },
  { value: 'environmental', label: 'Environmental' },
  { value: 'ergonomic', label: 'Ergonomic' },
  { value: 'other', label: 'Other' },
];

interface NearMissDraftState {
  category: NearMissCategory | '';
  description: string;
  location: string;
  latitude: number | null;
  longitude: number | null;
  suggestedCorrectiveAction: string;
  signature: string;
}

const createInitialDraftState = (): NearMissDraftState => ({
  category: '',
  description: '',
  location: '',
  latitude: null,
  longitude: null,
  suggestedCorrectiveAction: '',
  signature: '',
});

const MIN_DESCRIPTION_LENGTH = 10;

interface NearMissValidatedFields {
  category: NearMissCategory | '';
  description: string;
  location: string;
  signature: string;
}

export default function NearMissReportForm() {
  const { user, fullName } = useAuth();
  const reporterEmail = user?.email ?? '';
  const { submit } = useNearMissSubmission();
  const { uploadPhoto, rollbackUploads } = useJSAPhotoUpload();

  const now = new Date();
  const [incidentDate] = useState(formatInTimeZone(now, TIMEZONE, 'yyyy-MM-dd'));
  const [incidentTime] = useState(formatInTimeZone(now, TIMEZONE, 'HH:mm'));
  const [category, setCategory] = useState<NearMissCategory | ''>('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [suggestedCorrectiveAction, setSuggestedCorrectiveAction] = useState('');
  const [pendingPhotos, setPendingPhotos] = useState<(File | null)[]>([null, null, null]);
  const [signature, setSignature] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);

  const validatedFields = useMemo<NearMissValidatedFields>(
    () => ({ category, description, location, signature }),
    [category, description, location, signature]
  );

  const validationRules = useMemo<ValidationRule<NearMissValidatedFields>[]>(() => [
    {
      field: 'category',
      validator: (val: unknown) => (!val ? 'Select a category' : null),
    },
    {
      field: 'description',
      validator: (val: unknown) => {
        const s = String(val ?? '').trim();
        if (!s) return 'Description is required';
        if (s.length < MIN_DESCRIPTION_LENGTH) return `Description must be at least ${MIN_DESCRIPTION_LENGTH} characters`;
        return null;
      },
    },
    {
      field: 'location',
      validator: (val: unknown) => (!String(val ?? '').trim() ? 'Location is required' : null),
    },
    {
      field: 'signature',
      validator: (val: unknown) => (!String(val ?? '').trim() ? 'Signature is required' : null),
    },
  ], []);

  const {
    shouldShowError,
    getFieldError,
    validateAll,
    handleFieldBlur,
    markSubmitAttempted,
    clearErrors,
  } = useFormValidation(
    validatedFields as unknown as Record<string, unknown>,
    validationRules as unknown as import('../../hooks/useFormValidation').ValidationRule<Record<string, unknown>>[],
    {
      validateOnChange: true,
      showErrorsAfterSubmitAttempt: false,
      formType: 'near_miss',
    }
  );

  const {
    hasDraft,
    draftData,
    lastSaved,
    saveDraft,
    clearDraft,
    dismissDraft,
  } = useFormPersistence<NearMissDraftState>({
    formType: 'near_miss',
    userId: user?.id,
    createInitialState: createInitialDraftState,
    isEditMode: false,
  });

  const [showDraftModal, setShowDraftModal] = useState(false);
  const draftCheckedRef = useRef(false);

  useEffect(() => {
    if (hasDraft && draftData && !draftCheckedRef.current) {
      draftCheckedRef.current = true;
      setShowDraftModal(true);
    }
  }, [hasDraft, draftData]);

  const restoreDraft = useCallback(() => {
    if (!draftData?.form) return;
    const d = draftData.form;
    if (d.category) setCategory(d.category);
    if (d.description) setDescription(d.description);
    if (d.location) setLocation(d.location);
    if (d.latitude != null) setLatitude(d.latitude);
    if (d.longitude != null) setLongitude(d.longitude);
    if (d.suggestedCorrectiveAction) setSuggestedCorrectiveAction(d.suggestedCorrectiveAction);
    if (d.signature) setSignature(d.signature);
    setShowDraftModal(false);
  }, [draftData]);

  const discardDraft = useCallback(() => {
    dismissDraft();
    setShowDraftModal(false);
  }, [dismissDraft]);

  useEffect(() => {
    saveDraft(
      { category, description, location, latitude, longitude, suggestedCorrectiveAction, signature },
      1,
      new Set(),
    );
  }, [category, description, location, latitude, longitude, suggestedCorrectiveAction, signature, saveDraft]);

  const handleGps = useCallback(() => {
    setGpsLoading(true);
    if (!navigator.geolocation) {
      formToast.error('GPS Error', 'GPS not supported');
      setGpsLoading(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(pos.coords.latitude);
        setLongitude(pos.coords.longitude);
        setLocation(`${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`);
        setGpsLoading(false);
      },
      () => {
        formToast.error('GPS Error', 'Could not get location');
        setGpsLoading(false);
      }
    );
  }, []);

  const handlePhotoChange = useCallback(
    (index: number, file: File | null) => {
      setPendingPhotos((prev) => {
        const next = [...prev];
        next[index] = file;
        return next;
      });
    },
    []
  );

  const handleSubmit = useCallback(async () => {
    if (submittingRef.current || submitting) return;

    markSubmitAttempted();
    const { isValid } = validateAll();
    if (!isValid) return;

    const photoFiles = pendingPhotos.filter((f): f is File => f !== null);
    const state: NearMissFormState = {
      category,
      description,
      location,
      latitude,
      longitude,
      suggested_corrective_action: suggestedCorrectiveAction,
      photo_paths: [],
      signature,
    };

    submittingRef.current = true;
    setSubmitting(true);
    const uploadedPaths: string[] = [];

    try {
      if (isOnline() && photoFiles.length > 0) {
        for (let i = 0; i < photoFiles.length; i++) {
          const path = await uploadPhoto(photoFiles[i], i + 1);
          uploadedPaths.push(path);
        }
        state.photo_paths = uploadedPaths;
      }

      const res = await submit(
        state,
        !isOnline() ? { pendingPhotoFiles: photoFiles } : undefined
      );

      if (res.success) {
        clearDraft();
        formToast.success('Report Submitted', res.queued ? 'Queued for sync when back online' : 'Near-miss report submitted');
        setShowCelebration(true);
      } else {
        if (uploadedPaths.length > 0) {
          await rollbackUploads(uploadedPaths).catch(() => {});
        }
        if (res.error) {
          formToast.error('Submit Failed', res.error.message);
        }
      }
    } catch (e) {
      if (uploadedPaths.length > 0) {
        await rollbackUploads(uploadedPaths).catch(() => {});
      }
      formToast.error('Submit Failed', e instanceof Error ? e.message : 'Submission failed');
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }, [category, description, location, latitude, longitude, suggestedCorrectiveAction, pendingPhotos, signature, submitting, validateAll, markSubmitAttempted, submit, uploadPhoto, rollbackUploads, clearDraft]);

  const shouldReduceMotion = useReducedMotion();

  if (!user) return null;

  const inputBase =
    'w-full bg-gray-800 border border-white/10 rounded-xl px-4 py-3 text-base text-white placeholder:text-white/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 transition-colors duration-150';
  const inputError = 'border-red-500/50 focus-visible:ring-red-500/50';
  const labelClass = 'block text-sm font-medium text-white/80 mb-2';

  return (
    <DashboardLayout pageHeading>
      <DraftRecoveryModal
        isOpen={showDraftModal}
        draft={draftData}
        formType="near_miss"
        onRestore={restoreDraft}
        onDiscard={discardDraft}
      />
      <div className="relative max-w-lg mx-auto">
        {/* Layer 1 — static atmospheric depth (no animation) */}
        <div
          className="absolute inset-0 pointer-events-none select-none -z-[1] overflow-hidden rounded-2xl"
          aria-hidden="true"
        >
          <div
            className="absolute -top-24 -right-24 w-80 h-80 rounded-full opacity-[0.06]"
            style={{
              background: 'radial-gradient(circle, rgb(16, 185, 129), transparent 70%)',
              filter: 'blur(60px)',
            }}
          />
        </div>

        <motion.div
          initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className={cn(glass.card, 'p-6 sm:p-8 space-y-6 relative z-0')}
        >
          <header className="space-y-1">
            <h1 className="text-2xl font-bold text-white leading-tight">Report Near-Miss</h1>
            <p className="text-sm text-white/60 leading-relaxed">
              Your report helps prevent future incidents.
            </p>
            {lastSaved && (
              <p className="text-xs text-white/40 mt-1">
                Draft saved {lastSaved.toLocaleTimeString()}
              </p>
            )}
          </header>

          <div className="space-y-6">
            <div>
              <label className={labelClass}>Date & Time</label>
              <div className="flex gap-3">
                <input
                  type="date"
                  value={incidentDate}
                  readOnly
                  className={cn(inputBase, 'flex-1 min-h-[48px]')}
                  aria-readonly="true"
                />
                <input
                  type="time"
                  value={incidentTime}
                  readOnly
                  className={cn(inputBase, 'flex-1 min-h-[48px]')}
                  aria-readonly="true"
                />
              </div>
            </div>

            <div>
              <label className={labelClass}>Location <span className="text-red-400">*</span></label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  onBlur={() => handleFieldBlur('location')}
                  placeholder="Describe location or use GPS"
                  className={cn(
                    'flex-1 min-h-[48px]',
                    inputBase,
                    shouldShowError('location') && inputError
                  )}
                  aria-invalid={shouldShowError('location') || undefined}
                />
                <button
                  type="button"
                  onClick={handleGps}
                  disabled={gpsLoading}
                  className="shrink-0 w-12 h-12 rounded-xl border border-white/10 bg-gray-800 text-white hover:bg-white/10 active:bg-white/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                  aria-label="Use GPS for location"
                >
                  {gpsLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <MapPin className="w-5 h-5" />}
                </button>
              </div>
              {shouldShowError('location') && (
                <p className="flex items-center gap-1.5 text-red-400 text-xs mt-1.5" role="alert">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden />
                  {getFieldError('location')}
                </p>
              )}
            </div>

            <div>
              <label className={labelClass}>Category <span className="text-red-400">*</span></label>
              <div className="relative">
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as NearMissCategory)}
                  onBlur={() => handleFieldBlur('category')}
                  className={cn(
                    'w-full appearance-none min-h-[48px] pr-10 cursor-pointer',
                    inputBase,
                    shouldShowError('category') && inputError
                  )}
                  aria-invalid={shouldShowError('category') || undefined}
                >
                  <option value="">— Select —</option>
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value} className="bg-gray-900">
                      {c.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40 pointer-events-none" aria-hidden />
              </div>
              {shouldShowError('category') && (
                <p className="flex items-center gap-1.5 text-red-400 text-xs mt-1.5" role="alert">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden />
                  {getFieldError('category')}
                </p>
              )}
            </div>

            <div>
              <label className={labelClass}>Description <span className="text-red-400">*</span> (min 10 chars)</label>
              <div className="flex gap-2">
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  onBlur={() => handleFieldBlur('description')}
                  placeholder="What happened? What could have been worse?"
                  rows={4}
                  className={cn(
                    'flex-1 min-h-[120px] resize-none',
                    inputBase,
                    shouldShowError('description') && inputError
                  )}
                  aria-invalid={shouldShowError('description') || undefined}
                />
                <VoiceInputButton
                  onTranscript={(t) => setDescription((prev) => prev + (prev ? ' ' : '') + t)}
                  currentValue={description}
                  appendMode
                  disabled={submitting}
                  className="shrink-0 rounded-xl border border-white/10 bg-gray-800 hover:bg-white/10 transition-colors duration-150"
                />
              </div>
              {shouldShowError('description') && (
                <p className="flex items-center gap-1.5 text-red-400 text-xs mt-1.5" role="alert">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden />
                  {getFieldError('description')}
                </p>
              )}
            </div>

            <div>
              <label className={labelClass}>Photos (optional)</label>
              <div className="space-y-3">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        handlePhotoChange(i, f ?? null);
                      }}
                      className="flex-1 text-sm text-white/80 file:mr-3 file:rounded-lg file:border file:border-white/10 file:bg-gray-800 file:px-3 file:py-2 file:text-white/80 file:focus:outline-none file:focus-visible:ring-2 file:focus-visible:ring-emerald-500/50 file:cursor-pointer"
                      aria-label={`Upload photo ${i + 1}`}
                    />
                    {pendingPhotos[i] && (
                      <button
                        type="button"
                        onClick={() => handlePhotoChange(i, null)}
                        className="text-xs text-red-400 hover:text-red-300 shrink-0 transition-colors duration-150"
                        aria-label={`Remove photo ${i + 1}`}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className={labelClass}>Suggested corrective action (optional)</label>
              <textarea
                value={suggestedCorrectiveAction}
                onChange={(e) => setSuggestedCorrectiveAction(e.target.value)}
                placeholder="What could prevent this?"
                rows={2}
                className={cn(inputBase, 'min-h-[80px] resize-none')}
              />
            </div>

            <div>
              <label className={labelClass}>Signature <span className="text-red-400">*</span></label>
              <input
                type="text"
                value={signature}
                onChange={(e) => setSignature(e.target.value)}
                onBlur={() => handleFieldBlur('signature')}
                placeholder="Type your full name"
                className={cn(
                  'min-h-[48px]',
                  inputBase,
                  shouldShowError('signature') && inputError
                )}
                aria-invalid={shouldShowError('signature') || undefined}
                autoComplete="name"
              />
              {shouldShowError('signature') && (
                <p className="flex items-center gap-1.5 text-red-400 text-xs mt-1.5" role="alert">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden />
                  {getFieldError('signature')}
                </p>
              )}
              <p className="text-xs text-white/50 mt-2">
                Email: <span className="text-white/70">{reporterEmail || '—'}</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full py-3 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-semibold text-base min-h-[48px] flex items-center justify-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150"
          >
            {submitting ? <Loader2 className="w-5 h-5 animate-spin" aria-hidden /> : null}
            Submit Report
          </button>
        </motion.div>
      </div>

      <FormSuccessCelebration
        isVisible={showCelebration}
        formType="near_miss"
        onContinue={() => {
          setShowCelebration(false);
          setCategory('');
          setDescription('');
          setLocation('');
          setLatitude(null);
          setLongitude(null);
          setSuggestedCorrectiveAction('');
          setPendingPhotos([null, null, null]);
          setSignature('');
          clearErrors();
        }}
        title="Near-Miss Reported!"
        message="Thank you for reporting — proactive reporting prevents future incidents."
        userName={fullName || undefined}
      />
    </DashboardLayout>
  );
}
