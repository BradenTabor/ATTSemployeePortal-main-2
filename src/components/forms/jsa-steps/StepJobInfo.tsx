import { type ComponentType, useState, useRef, useCallback, useEffect } from "react";
import { MapPin, Loader2, CheckCircle2, AlertTriangle, Camera, X, ChevronDown, ChevronUp, ImageIcon, WifiOff } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "../../../lib/utils";
import { DateField, TimeField } from "../GlassyPickers";
import { LocationInputField } from "../LocationInputField";
import { ContactTemplatePicker } from "../ContactTemplatePicker";
import { SavedLocationPicker } from "../SavedLocationPicker";
import { useJSAPhotoUpload, MAX_JSA_PHOTOS } from "../../../hooks/jsa/useJSAPhotoUpload";
import { formToast } from "../../../lib/formToast";
import { isOnline } from "../../../lib/offlineQueue";

type JobInfoFields = {
  jobDate: string;
  callInTime: string;
  callOutTime: string;
  workLocation: string;
  circuitNumber: string;
  nearestHospital: string;
  nearestClinic: string;
  ocContact: string;
  docContact: string;
  gfContact: string;
  safetyContact: string;
  status: "draft" | "completed";
};

interface StepJobInfoProps {
  form: JobInfoFields;
  onInputChange: (key: keyof JobInfoFields, value: string) => void;
  isLoading?: boolean;
  errors?: Partial<Record<keyof JobInfoFields, string | undefined>>;
  onFieldBlur?: (field: keyof JobInfoFields) => void;
  /** Current JSA photo storage paths. */
  jsaPhotoPaths?: string[];
  /** Callback when photo paths change (add or remove). */
  onJsaPhotoPathsChange?: (paths: string[]) => void;
}

// Animated checkmark for completed fields
function FieldCheckmark({ visible }: { visible: boolean }) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          transition={{ type: "spring", stiffness: 400, damping: 20 }}
          className="absolute right-3 top-1/2 -translate-y-1/2"
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

interface InputFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  icon?: ComponentType<{ className?: string }>;
  required?: boolean;
  className?: string;
  showCheckmark?: boolean;
  error?: string;
  onBlur?: () => void;
  fieldId?: string;
}

function InputField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  icon: Icon,
  required,
  className,
  showCheckmark = true,
  error,
  onBlur,
  fieldId,
}: InputFieldProps) {
  const isFilled = value?.trim().length > 0;
  const hasError = !!error;
  
  return (
    <div className={className}>
      <label htmlFor={fieldId} className="flex items-center gap-1 text-xs sm:text-sm font-medium text-white/70 mb-0.5 sm:mb-1 uppercase tracking-wide">
        <span>
          {label}
          {required && <span className="text-emerald-400 ml-0.5">*</span>}
        </span>
        {/* Mini checkmark next to label when filled */}
        {isFilled && showCheckmark && !hasError && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="text-emerald-400"
          >
            <CheckCircle2 className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
          </motion.span>
        )}
      </label>
      <div className="relative">
        {Icon && (
          <Icon className={cn(
            "absolute left-2.5 sm:left-3 top-1/2 h-3.5 w-3.5 sm:h-4 sm:w-4 -translate-y-1/2 transition-colors z-10",
            hasError ? "text-rose-400" : isFilled ? "text-emerald-500" : "text-emerald-500/50"
          )} />
        )}
        <input
          id={fieldId}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          placeholder={placeholder}
          required={required}
          className={cn(
            "w-full rounded-lg border bg-black/50 px-2.5 py-2 sm:px-3 sm:py-2.5 text-base sm:text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-1 transition-all",
            Icon ? "pl-8 sm:pl-9" : "",
            hasError
              ? "border-rose-500/50 focus:ring-rose-500/50 focus:border-rose-500/50"
              : isFilled && showCheckmark
              ? "pr-8 sm:pr-9 border-emerald-500/30 focus:ring-emerald-500/50 focus:border-emerald-500/30"
              : "border-white/10 focus:ring-emerald-500/50 focus:border-emerald-500/30"
          )}
          aria-invalid={hasError}
          aria-describedby={hasError && fieldId ? `${fieldId}-error` : undefined}
        />
        {/* Checkmark inside input when filled */}
        {showCheckmark && !hasError && <FieldCheckmark visible={isFilled} />}
        {/* Error icon */}
        {hasError && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <AlertTriangle className="w-4 h-4 text-rose-400" />
          </div>
        )}
      </div>
      {/* Error message */}
      <AnimatePresence>
        {hasError && (
          <motion.p
            id={fieldId ? `${fieldId}-error` : undefined}
            role="alert"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="text-xs text-rose-400 mt-1 flex items-center gap-1"
          >
            <AlertTriangle className="w-3 h-3" />
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Paper JSA Photo Upload Section
// ---------------------------------------------------------------------------

interface PhotoThumbnailProps {
  path: string;
  onRemove: () => void;
  isRemoving: boolean;
  /** Resolves storage path to a display URL (signed). Used so we can share hook and handle errors. */
  getSignedUrl: (path: string) => Promise<string | null>;
}

function PhotoThumbnail({ path, onRemove, isRemoving, getSignedUrl }: PhotoThumbnailProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getSignedUrl(path)
      .then((signedUrl) => {
        if (!cancelled) {
          setLoadError(false);
          if (signedUrl) setUrl(signedUrl);
        }
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => { cancelled = true; };
  }, [path, getSignedUrl]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      className="relative group rounded-lg overflow-hidden border border-white/10 bg-black/40 w-20 h-20 sm:w-24 sm:h-24 flex-shrink-0"
    >
      {url && !loadError ? (
        <img
          src={url}
          alt="Paper JSA page"
          className="w-full h-full object-cover"
          onError={() => setLoadError(true)}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          {loadError ? (
            <ImageIcon className="w-6 h-6 text-white/40" aria-hidden />
          ) : (
            <Loader2 className="w-4 h-4 text-white/30 animate-spin" />
          )}
        </div>
      )}
      <button
        type="button"
        onClick={onRemove}
        disabled={isRemoving}
        className="absolute top-1 right-1 p-0.5 rounded-full bg-black/70 text-white/80 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity hover:bg-rose-600 hover:text-white"
        aria-label="Remove photo"
      >
        {isRemoving ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <X className="w-3.5 h-3.5" />
        )}
      </button>
    </motion.div>
  );
}

export interface PaperJsaUploadProps {
  photoPaths: string[];
  onPathsChange: (paths: string[]) => void;
  /** When true, show "Required" and keep section expanded by default when empty */
  required?: boolean;
}

export function PaperJsaUpload({ photoPaths, onPathsChange, required }: PaperJsaUploadProps) {
  const [isOpen, setIsOpen] = useState(photoPaths.length > 0 || required === true);
  const [uploading, setUploading] = useState(false);
  const [removingPath, setRemovingPath] = useState<string | null>(null);
  const [failedFiles, setFailedFiles] = useState<Array<{ name: string; error: string }>>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { uploadMultiple, deletePhoto, getSignedUrl } = useJSAPhotoUpload();

  const online = isOnline();
  const remainingSlots = MAX_JSA_PHOTOS - photoPaths.length;

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Reset the input so the same file can be selected again if needed
    if (fileInputRef.current) fileInputRef.current.value = "";

    setUploading(true);
    setFailedFiles([]);

    try {
      const result = await uploadMultiple(files, photoPaths);

      if (result.successful.length > 0) {
        const newPaths = [...photoPaths, ...result.successful];
        onPathsChange(newPaths);
        formToast.success(
          "Photo Uploaded",
          result.successful.length === 1
            ? "Paper JSA photo saved. It will be included when this JSA is exported."
            : `${result.successful.length} paper JSA photos saved. They will be included when this JSA is exported.`
        );
      }

      if (result.failed.length > 0) {
        setFailedFiles(
          result.failed.map((f) => ({
            name: f.file.name,
            error: f.error.message,
          }))
        );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Photo upload failed. Please try again.";
      formToast.error("Upload Failed", message);
    } finally {
      setUploading(false);
    }
  }, [photoPaths, onPathsChange, uploadMultiple]);

  const handleRemove = useCallback(async (path: string) => {
    setRemovingPath(path);
    try {
      await deletePhoto(path);
      onPathsChange(photoPaths.filter((p) => p !== path));
    } catch {
      formToast.error("Remove Failed", "Failed to remove photo. Please try again.");
    } finally {
      setRemovingPath(null);
    }
  }, [photoPaths, onPathsChange, deletePhoto]);

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden">
      {/* Header / toggle */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2.5 sm:px-4 sm:py-3 text-left hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-2">
          <Camera className="w-4 h-4 text-emerald-400" />
          <span className="text-xs sm:text-sm font-medium text-white/80">
            Attach Paper JSA Form
          </span>
          <span className={cn(
            "text-[10px] sm:text-xs italic",
            required ? "text-amber-300" : "text-white/40"
          )}>
            {required ? "Required" : "Optional"}
          </span>
          {photoPaths.length > 0 && (
            <span className="text-[10px] sm:text-xs px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-medium">
              {photoPaths.length}/{MAX_JSA_PHOTOS}
            </span>
          )}
        </div>
        {isOpen ? (
          <ChevronUp className="w-4 h-4 text-white/40" />
        ) : (
          <ChevronDown className="w-4 h-4 text-white/40" />
        )}
      </button>

      {/* Collapsible content */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 sm:px-4 sm:pb-4 space-y-3">
              {/* Offline guard */}
              {!online && (
                <div className="flex items-center gap-2 text-amber-200 text-[10px] sm:text-xs p-2 rounded-lg border border-amber-500/30 bg-amber-500/10">
                  <WifiOff className="w-3.5 h-3.5 flex-shrink-0" />
                  Photo upload requires an internet connection. You can add photos after reconnecting.
                </div>
              )}

              {/* Upload button */}
              {online && remainingSlots > 0 && (
                <div className="space-y-1.5">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className={cn(
                      "w-full flex items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-4 sm:py-5 transition-all text-sm",
                      uploading
                        ? "border-white/10 text-white/30 cursor-wait"
                        : "border-white/15 text-white/60 hover:border-emerald-500/40 hover:text-emerald-300 hover:bg-emerald-500/5 cursor-pointer"
                    )}
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <ImageIcon className="w-4 h-4" />
                        Take Photo or Choose File
                      </>
                    )}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    multiple
                    onChange={handleFileSelect}
                    className="hidden"
                    disabled={uploading || !online}
                    aria-label="Add photos for JSA (take photo or choose file)"
                  />
                  <p className="text-[10px] text-white/30 text-center">
                    Photos are compressed for upload. Retain originals if uncompressed copies are needed.
                  </p>
                </div>
              )}

              {/* Max reached message */}
              {remainingSlots <= 0 && (
                <p className="text-[10px] sm:text-xs text-white/40 text-center py-2">
                  Maximum {MAX_JSA_PHOTOS} photos reached.
                </p>
              )}

              {/* Failed uploads */}
              <AnimatePresence>
                {failedFiles.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="space-y-1"
                  >
                    {failedFiles.map((f, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-2 text-[10px] sm:text-xs text-rose-300 p-2 rounded-lg border border-rose-500/20 bg-rose-500/5"
                      >
                        <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">{f.name}: {f.error}</span>
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Photo thumbnails */}
              {photoPaths.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  <AnimatePresence mode="popLayout">
                    {photoPaths.map((path) => (
                      <PhotoThumbnail
                        key={path}
                        path={path}
                        onRemove={() => handleRemove(path)}
                        isRemoving={removingPath === path}
                        getSignedUrl={getSignedUrl}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main StepJobInfo component
// ---------------------------------------------------------------------------

export function StepJobInfo({ form, onInputChange, isLoading, errors, onFieldBlur, jsaPhotoPaths, onJsaPhotoPathsChange }: StepJobInfoProps) {
  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Paper JSA Photo Upload */}
      {onJsaPhotoPathsChange && (
        <PaperJsaUpload
          photoPaths={jsaPhotoPaths || []}
          onPathsChange={onJsaPhotoPathsChange}
        />
      )}

      {isLoading && (
        <div className="flex items-center gap-2 text-amber-200 text-[10px] sm:text-xs p-2 sm:p-3 rounded-lg border border-amber-500/30 bg-amber-500/10">
          <Loader2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 animate-spin" />
          Loading existing data...
        </div>
      )}

      {/* Schedule */}
      <div className="space-y-2 sm:space-y-3">
        <p className="text-xs sm:text-sm font-medium text-white/50 uppercase tracking-wider">
          Schedule
        </p>
        <div className="grid gap-3 sm:gap-4 sm:grid-cols-3">
          <DateField
            label="Job Date"
            value={form.jobDate || ""}
            onValueChange={(value) => onInputChange("jobDate", value)}
            helperText="Crew on site"
            required
          />
          <TimeField
            label="Call-in"
            value={form.callInTime || ""}
            onValueChange={(value) => onInputChange("callInTime", value)}
            helperText="AM briefing"
          />
          <TimeField
            label="Call-out"
            value={form.callOutTime || ""}
            onValueChange={(value) => onInputChange("callOutTime", value)}
            helperText="Est. completion"
          />
        </div>
      </div>

      {/* Location */}
      <div className="space-y-3 sm:space-y-4">
        <p className="text-xs sm:text-sm font-medium text-white/50 uppercase tracking-wider">
          Location
        </p>
        
        {/* Saved Locations Quick-Pick */}
        <SavedLocationPicker
          currentValues={{
            workLocation: form.workLocation,
            nearestHospital: form.nearestHospital,
            nearestClinic: form.nearestClinic,
            circuitNumber: form.circuitNumber,
          }}
          onApply={(values) => {
            onInputChange("workLocation", values.workLocation);
            onInputChange("nearestHospital", values.nearestHospital);
            onInputChange("nearestClinic", values.nearestClinic);
            onInputChange("circuitNumber", values.circuitNumber);
          }}
        />

        <div className="grid gap-3 sm:gap-4 sm:grid-cols-2">
          <InputField
            label="Work Location"
            icon={MapPin}
            value={form.workLocation}
            onChange={(value) => onInputChange("workLocation", value)}
            onBlur={() => onFieldBlur?.("workLocation")}
            placeholder="Street, city, project"
            required
            error={errors?.workLocation}
            fieldId="workLocation"
          />
          <InputField
            label="Circuit #"
            value={form.circuitNumber}
            onChange={(value) => onInputChange("circuitNumber", value)}
            placeholder="Circuit number"
          />
        </div>
        <div className="grid gap-3 sm:gap-4 sm:grid-cols-2">
          <LocationInputField
            label="Nearest Hospital"
            value={form.nearestHospital}
            onChange={(value) => onInputChange("nearestHospital", value)}
            locationType="hospital"
            placeholder="Hospital name"
          />
          <LocationInputField
            label="Nearest Clinic"
            value={form.nearestClinic}
            onChange={(value) => onInputChange("nearestClinic", value)}
            locationType="clinic"
            placeholder="Clinic name"
          />
        </div>
      </div>

      {/* Emergency Contacts */}
      <div className="space-y-3 sm:space-y-4">
        <p className="text-xs sm:text-sm font-medium text-white/50 uppercase tracking-wider">
          Emergency Contacts
        </p>
        
        {/* Contact Template Quick-Fill */}
        <ContactTemplatePicker
          currentContacts={{
            oc: form.ocContact,
            doc: form.docContact,
            gf: form.gfContact,
            safety: form.safetyContact,
          }}
          onApply={(contacts) => {
            onInputChange("ocContact", contacts.oc);
            onInputChange("docContact", contacts.doc);
            onInputChange("gfContact", contacts.gf);
            onInputChange("safetyContact", contacts.safety);
          }}
        />

        <div className="grid gap-3 sm:gap-4 sm:grid-cols-2">
          <InputField
            label="OC Contact"
            type="tel"
            required
            value={form.ocContact}
            onChange={(value) => onInputChange("ocContact", value)}
            onBlur={() => onFieldBlur?.("ocContact")}
            placeholder="Name · 870-555-1234"
            error={errors?.ocContact}
            fieldId="ocContact"
          />
          <InputField
            label="DOC Tel"
            type="tel"
            required
            value={form.docContact}
            onChange={(value) => onInputChange("docContact", value)}
            onBlur={() => onFieldBlur?.("docContact")}
            placeholder="870-555-5678"
            error={errors?.docContact}
            fieldId="docContact"
          />
          <InputField
            label="GF Contact"
            type="tel"
            required
            value={form.gfContact}
            onChange={(value) => onInputChange("gfContact", value)}
            onBlur={() => onFieldBlur?.("gfContact")}
            placeholder="Name · 870-555-2468"
            error={errors?.gfContact}
            fieldId="gfContact"
          />
          <InputField
            label="Safety Tel"
            type="tel"
            required
            value={form.safetyContact}
            onChange={(value) => onInputChange("safetyContact", value)}
            onBlur={() => onFieldBlur?.("safetyContact")}
            placeholder="870-555-1357"
            error={errors?.safetyContact}
            fieldId="safetyContact"
          />
        </div>
      </div>
    </div>
  );
}
