import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { formToast } from "../../lib/formToast";
import DashboardLayout from "../../layouts/DashboardLayout";
import { useAuth } from "../../contexts/AuthContext";
import { supabase } from "../../lib/supabaseClient";
import { useTreeFellingSubmission } from "../../hooks/jsa/useTreeFellingSubmission";
import { useFormPersistence } from "../../hooks/useFormPersistence";
import { DraftRecoveryModal } from "../../components/forms/DraftRecoveryModal";
import { OfflineFormIndicator } from "../../components/OfflineFormIndicator";
import {
  type TreeFellingData,
  type CrewPosition,
  DEFAULT_TREE_FELLING_DATA,
  parseTreeFellingData,
  TREE_SPECIES_OPTIONS,
  HINGE_WOOD_CONDITION_OPTIONS,
  CREW_ROLES,
} from "../../types/treeFelling";
import { CompassSelector } from "../../components/forms/CompassSelector";
import { SignaturePad } from "../../components/forms/SignaturePad";
import { ValidationSummary } from "../../components/forms/ValidationSummary";
import { useTreeFellingValidation } from "../../hooks/jsa/useTreeFellingValidation";
import { scrollToFirstError } from "../../lib/scrollToError";
import {
  trackFormStarted,
  trackFormSubmitted,
  trackFormSubmitError,
  createFormTimer,
} from "../../lib/telemetry";

/** Map observer_signatures from DB to form shape */
function parseObserverSignatures(raw: unknown): { name: string; signature_data: string }[] {
  if (!Array.isArray(raw) || raw.length === 0) return [{ name: "", signature_data: "" }];
  return raw.map((item) => {
    const o = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
    return {
      name: typeof o.name === "string" ? o.name : "",
      signature_data: typeof o.signature_data === "string" ? o.signature_data : "",
    };
  });
}

interface TreeFellingDraftState {
  jobDate: string;
  workLocation: string;
  gfContact: string;
  ocContact: string;
  treeData: TreeFellingData;
  observerSignatures: { name: string; signature_data: string }[];
}

const createInitialDraftState = (): TreeFellingDraftState => ({
  jobDate: new Date().toISOString().slice(0, 10),
  workLocation: "",
  gfContact: "",
  ocContact: "",
  treeData: { ...DEFAULT_TREE_FELLING_DATA },
  observerSignatures: [{ name: "", signature_data: "" }],
});

const NOTCH_LABELS: Record<TreeFellingData["notch_type"], string> = {
  conventional_45: "Conventional (45°)",
  open_face_70: "Open-face (70°+)",
  humboldt: "Humboldt",
  other: "Other",
};

export default function TreeFellingJSAForm() {
  const { id } = useParams<{ id?: string }>();
  const isEditMode = Boolean(id);
  const navigate = useNavigate();
  const { user } = useAuth();
  const [jobDate, setJobDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [workLocation, setWorkLocation] = useState("");
  const [gfContact, setGfContact] = useState("");
  const [ocContact, setOcContact] = useState("");
  const [treeData, setTreeData] = useState<TreeFellingData>(() => ({
    ...DEFAULT_TREE_FELLING_DATA,
  }));
  const [observerSignatures, setObserverSignatures] = useState<
    { name: string; signature_data: string }[]
  >([{ name: "", signature_data: "" }]);
  const [employeeSignaturePath, setEmployeeSignaturePath] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [loadingRecord, setLoadingRecord] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [showDraftModal, setShowDraftModal] = useState(false);
  const formTimer = useRef(createFormTimer());

  useEffect(() => {
    trackFormStarted({ form_type: 'tree_felling_jsa' });
    formTimer.current.reset();
  }, []);

  const {
    hasDraft,
    draftData,
    lastSaved,
    saveDraft,
    clearDraft,
    dismissDraft,
  } = useFormPersistence<TreeFellingDraftState>({
    formType: 'tree_felling_jsa',
    userId: user?.id,
    createInitialState: createInitialDraftState,
    isEditMode,
  });

  const formState = {
    jobDate,
    workLocation,
    gfContact,
    ocContact,
    treeData,
    employeeSignaturePath,
  };
  const {
    validateForCompleted,
    shouldShowError,
    getFieldError,
    handleFieldBlur,
    markSubmitAttempted,
  } = useTreeFellingValidation(formState, validationErrors);
  const { submitTreeFelling } = useTreeFellingSubmission();

  const updateTree = useCallback(<K extends keyof TreeFellingData>(
    key: K,
    value: TreeFellingData[K]
  ) => {
    setTreeData((prev) => ({ ...prev, [key]: value }));
  }, []);

  const setEquipmentChecklist = useCallback(
    (key: keyof TreeFellingData["equipment_checklist"], value: boolean) => {
      setTreeData((prev) => ({
        ...prev,
        equipment_checklist: { ...prev.equipment_checklist, [key]: value },
      }));
    },
    []
  );

  const addCrewMember = useCallback(() => {
    setTreeData((prev) => ({
      ...prev,
      crew_positions: [...prev.crew_positions, { name: "", role: "ground worker" }],
    }));
  }, []);

  const updateCrewMember = useCallback((index: number, updates: Partial<CrewPosition>) => {
    setTreeData((prev) => {
      const next = [...prev.crew_positions];
      if (index < 0 || index >= next.length) return prev;
      next[index] = { ...next[index], ...updates };
      return { ...prev, crew_positions: next };
    });
  }, []);

  const removeCrewMember = useCallback((index: number) => {
    setTreeData((prev) => ({
      ...prev,
      crew_positions: prev.crew_positions.filter((_, i) => i !== index),
    }));
  }, []);

  const addObserverSignature = useCallback(() => {
    if (observerSignatures.length >= 6) return;
    setObserverSignatures((p) => [...p, { name: "", signature_data: "" }]);
  }, [observerSignatures.length]);

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
    if (d.jobDate) setJobDate(d.jobDate);
    if (d.workLocation) setWorkLocation(d.workLocation);
    if (d.gfContact) setGfContact(d.gfContact);
    if (d.ocContact) setOcContact(d.ocContact);
    if (d.treeData) setTreeData(parseTreeFellingData(d.treeData));
    if (Array.isArray(d.observerSignatures) && d.observerSignatures.length > 0) {
      setObserverSignatures(d.observerSignatures);
    }
    setShowDraftModal(false);
  }, [draftData]);

  const discardDraft = useCallback(() => {
    dismissDraft();
    setShowDraftModal(false);
  }, [dismissDraft]);

  useEffect(() => {
    if (isEditMode) return;
    saveDraft(
      { jobDate, workLocation, gfContact, ocContact, treeData, observerSignatures },
      1,
      new Set(),
    );
  }, [isEditMode, jobDate, workLocation, gfContact, ocContact, treeData, observerSignatures, saveDraft]);

  // Load existing record when editing
  useEffect(() => {
    if (!id || !user?.id) return;
    const fetchRecord = async () => {
      setLoadingRecord(true);
      const { data, error } = await supabase
        .from("daily_jsa")
        .select(
          "id, user_id, job_date, work_location, gf_contact, oc_contact, tree_felling_data, observer_signatures, status, employee_signature"
        )
        .eq("id", id)
        .eq("jsa_type", "tree_felling")
        .maybeSingle();

      if (error) {
        formToast.error("Load Failed", "Unable to load JSA. Please try again.");
        setLoadingRecord(false);
        return;
      }
      if (!data) {
        formToast.error("Not Found", "JSA not found or you don't have permission to edit it.");
        setLoadingRecord(false);
        return;
      }
      setJobDate(
        (data.job_date ?? "").toString().slice(0, 10) || new Date().toISOString().slice(0, 10)
      );
      setWorkLocation((data.work_location ?? "") as string);
      setGfContact((data.gf_contact ?? "") as string);
      setOcContact((data.oc_contact ?? "") as string);
      setTreeData(parseTreeFellingData(data.tree_felling_data));
      setObserverSignatures(parseObserverSignatures(data.observer_signatures));
      setEmployeeSignaturePath((data.employee_signature as string) ?? "");
      setLoadingRecord(false);
    };
    fetchRecord();
  }, [id, user?.id]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (jobDate || workLocation || treeData.tree_species) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
        return e.returnValue;
      }
    };
    if (!isEditMode) {
      window.addEventListener('beforeunload', handleBeforeUnload);
      return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }
  }, [isEditMode, jobDate, workLocation, treeData.tree_species]);

  const handleSubmit = async (asDraft: boolean) => {
    if (!user?.id) return;
    if (submittingRef.current || submitting) return;
    if (!asDraft) {
      markSubmitAttempted();
      const result = validateForCompleted();
      if (!result.valid) {
        setValidationErrors(result.errors);
        scrollToFirstError(result.errors, { offset: 120 });
        trackFormSubmitError({ form_type: 'tree_felling_jsa', error_code: 'VALIDATION_FAILED' });
        return;
      }
      setValidationErrors({});
    }
    submittingRef.current = true;
    setSubmitting(true);
    try {
      const result = await submitTreeFelling(asDraft ? "draft" : "complete", {
        state: {
          jobDate,
          workLocation,
          gfContact,
          ocContact,
          treeData,
          observerSignatures,
          employeeSignaturePath,
        },
        isEditMode,
        recordId: id,
        userId: user.id,
      });

      if (!result.success) {
        formToast.error("Submit Failed", result.error?.message ?? "Submit failed.");
        trackFormSubmitError({ form_type: 'tree_felling_jsa', error_code: 'SERVER_ERROR' });
        return;
      }
      if (result.queued) {
        formToast.success("Saved Offline", "Saved for sync when you're back online.");
      } else {
        formToast.success(
          asDraft ? "Draft Saved" : "JSA Submitted",
          asDraft ? (isEditMode ? "Draft updated." : "Draft saved.") : "Tree Felling JSA submitted."
        );
      }
      trackFormSubmitted({
        form_type: 'tree_felling_jsa',
        duration_seconds: formTimer.current.getDuration(),
      });
      clearDraft();
      navigate("/forms-history/jsa");
    } catch (e) {
      formToast.error("Submit Failed", e instanceof Error ? e.message : "Submit failed.");
      trackFormSubmitError({ form_type: 'tree_felling_jsa', error_code: 'UNKNOWN' });
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const isLoading = isEditMode && loadingRecord;
  const baseInputClass =
    "w-full rounded-lg border bg-black/20 px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0f0d] disabled:opacity-60";
  const inputClass = baseInputClass + " border-white/10";
  const inputErrorClass = (field: string) =>
    baseInputClass + (shouldShowError(field) ? " border-red-500/50" : " border-white/10");
  const labelClass = "mb-1 block text-xs text-gray-400";
  const fieldError = (field: string) =>
    shouldShowError(field) ? (
      <p role="alert" className="text-xs text-red-400 mt-0.5">{getFieldError(field)}</p>
    ) : null;

  return (
    <DashboardLayout title={isEditMode ? "Edit Tree Felling JSA" : "Tree Felling JSA"}>
      <DraftRecoveryModal
        isOpen={showDraftModal}
        draft={draftData}
        formType="tree_felling_jsa"
        onRestore={restoreDraft}
        onDiscard={discardDraft}
      />
      <div className="mx-auto max-w-2xl space-y-6 px-4 pb-8">
        {isLoading && (
          <p className="text-sm text-amber-300" role="status">
            Loading JSA…
          </p>
        )}
        <p className="text-sm text-gray-400">
          ANSI Z133 Tree Felling JSA. Complete tree assessment, fall plan, safety plan, crew, and equipment checklist.
        </p>
        {lastSaved && !isEditMode && (
          <p className="text-xs text-white/40">
            Draft saved {lastSaved.toLocaleTimeString()}
          </p>
        )}

        <OfflineFormIndicator className="mb-2" />

        {Object.keys(validationErrors).length > 0 && (
          <ValidationSummary errors={validationErrors} formType="tree-felling-jsa" />
        )}

        <fieldset className="space-y-6" disabled={isLoading} aria-busy={isLoading}>
          {/* Date & location */}
          <section className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
            <h3 className="text-sm font-semibold text-white">Date & location</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={labelClass}>Date</label>
                <input
                  id="jobDate"
                  type="date"
                  value={jobDate}
                  onChange={(e) => setJobDate(e.target.value)}
                  onBlur={() => handleFieldBlur("jobDate")}
                  disabled={isLoading}
                  className={inputErrorClass("jobDate")}
                  aria-label="Job date"
                  aria-invalid={shouldShowError("jobDate") || undefined}
                />
                {fieldError("jobDate")}
              </div>
              <div>
                <label className={labelClass}>Location</label>
                <input
                  id="workLocation"
                  type="text"
                  value={workLocation}
                  onChange={(e) => setWorkLocation(e.target.value)}
                  onBlur={() => handleFieldBlur("workLocation")}
                  placeholder="Work site"
                  className={inputErrorClass("workLocation")}
                  aria-label="Work location"
                  aria-invalid={shouldShowError("workLocation") || undefined}
                />
                {fieldError("workLocation")}
              </div>
              <div>
                <label className={labelClass}>GF phone</label>
                <input
                  id="gfContact"
                  type="text"
                  value={gfContact}
                  onChange={(e) => setGfContact(e.target.value)}
                  onBlur={() => handleFieldBlur("gfContact")}
                  placeholder="General foreman"
                  className={inputErrorClass("gfContact")}
                  aria-label="General foreman contact"
                  aria-invalid={shouldShowError("gfContact") || undefined}
                />
                {fieldError("gfContact")}
              </div>
              <div>
                <label className={labelClass}>OC phone</label>
                <input
                  id="ocContact"
                  type="text"
                  value={ocContact}
                  onChange={(e) => setOcContact(e.target.value)}
                  onBlur={() => handleFieldBlur("ocContact")}
                  placeholder="Operations contact"
                  className={inputErrorClass("ocContact")}
                  aria-label="Operations contact"
                  aria-invalid={shouldShowError("ocContact") || undefined}
                />
                {fieldError("ocContact")}
              </div>
            </div>
          </section>

          {/* Tree Assessment */}
          <section className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
            <h3 className="text-sm font-semibold text-white">Tree assessment</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={labelClass} htmlFor="tree_species">Tree species</label>
                <select
                  id="tree_species"
                  value={treeData.tree_species}
                  onChange={(e) => updateTree("tree_species", e.target.value)}
                  onBlur={() => handleFieldBlur("tree_species")}
                  className={inputErrorClass("tree_species")}
                  aria-label="Tree species"
                  aria-invalid={shouldShowError("tree_species") || undefined}
                >
                  <option value="">Select species</option>
                  {TREE_SPECIES_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </option>
                  ))}
                </select>
                {fieldError("tree_species")}
              </div>
              {treeData.tree_species === "other" && (
                <div className="sm:col-span-2">
                  <label className={labelClass}>Species (other)</label>
                  <input
                    type="text"
                    value={treeData.tree_species_other}
                    onChange={(e) => updateTree("tree_species_other", e.target.value)}
                    onBlur={() => handleFieldBlur("tree_species_other")}
                    placeholder="Describe species"
                    className={inputErrorClass("tree_species_other")}
                    aria-label="Tree species other"
                    aria-invalid={shouldShowError("tree_species_other") || undefined}
                  />
                  {fieldError("tree_species_other")}
                </div>
              )}
              <div>
                <label className={labelClass}>Tree condition</label>
                <input
                  type="text"
                  value={treeData.tree_condition}
                  onChange={(e) => updateTree("tree_condition", e.target.value)}
                  onBlur={() => handleFieldBlur("tree_condition")}
                  placeholder="e.g. sound, decay, dead"
                  className={inputErrorClass("tree_condition")}
                  aria-label="Tree condition"
                  aria-invalid={shouldShowError("tree_condition") || undefined}
                />
                {fieldError("tree_condition")}
              </div>
              <div>
                <label className={labelClass}>Trunk condition</label>
                <input
                  type="text"
                  value={treeData.trunk_condition}
                  onChange={(e) => updateTree("trunk_condition", e.target.value)}
                  onBlur={() => handleFieldBlur("trunk_condition")}
                  placeholder="e.g. solid, hollow"
                  className={inputErrorClass("trunk_condition")}
                  aria-label="Trunk condition"
                  aria-invalid={shouldShowError("trunk_condition") || undefined}
                />
                {fieldError("trunk_condition")}
              </div>
              <div>
                <label className={labelClass}>Tree height estimate</label>
                <input
                  type="text"
                  value={treeData.tree_height_estimate}
                  onChange={(e) => updateTree("tree_height_estimate", e.target.value)}
                  onBlur={() => handleFieldBlur("tree_height_estimate")}
                  placeholder="e.g. 60 ft"
                  className={inputErrorClass("tree_height_estimate")}
                  aria-label="Tree height estimate"
                  aria-invalid={shouldShowError("tree_height_estimate") || undefined}
                />
                {fieldError("tree_height_estimate")}
              </div>
              <div>
                <label className={labelClass}>DBH estimate</label>
                <input
                  type="text"
                  value={treeData.dbh_estimate}
                  onChange={(e) => updateTree("dbh_estimate", e.target.value)}
                  onBlur={() => handleFieldBlur("dbh_estimate")}
                  placeholder="Diameter at breast height"
                  className={inputErrorClass("dbh_estimate")}
                  aria-label="DBH estimate"
                  aria-invalid={shouldShowError("dbh_estimate") || undefined}
                />
                {fieldError("dbh_estimate")}
              </div>
            </div>
          </section>

          {/* Lean & Fall Plan */}
          <section className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-4">
            <h3 className="text-sm font-semibold text-white">Lean & fall plan</h3>
            <div className="flex flex-wrap gap-6">
              <CompassSelector
                label="Lean direction"
                value={treeData.lean_direction}
                onChange={(dir) => updateTree("lean_direction", dir)}
              />
              <CompassSelector
                label="Fall path"
                value={treeData.fall_path}
                onChange={(dir) => updateTree("fall_path", dir)}
              />
            </div>
            <div>
              <span className={labelClass}>Lean magnitude</span>
              <div className="flex gap-4 mt-2" role="group" aria-label="Lean magnitude">
                {(["slight", "moderate", "heavy"] as const).map((m) => (
                  <label key={m} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="lean_magnitude"
                      checked={treeData.lean_magnitude === m}
                      onChange={() => updateTree("lean_magnitude", m)}
                      className="rounded border-white/20 text-emerald-500 focus:ring-emerald-500"
                    />
                    <span className="text-sm text-white capitalize">{m}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className={labelClass} htmlFor="notch_type">Notch type</label>
              <select
                id="notch_type"
                value={treeData.notch_type}
                onChange={(e) =>
                  updateTree("notch_type", e.target.value as TreeFellingData["notch_type"])
                }
                className={inputClass}
                aria-label="Notch type"
              >
                {(Object.keys(NOTCH_LABELS) as TreeFellingData["notch_type"][]).map((n) => (
                  <option key={n} value={n}>
                    {NOTCH_LABELS[n]}
                  </option>
                ))}
              </select>
              {treeData.notch_type === "other" && (
                <div className="mt-2">
                  <input
                    type="text"
                    value={treeData.notch_type_other}
                    onChange={(e) => updateTree("notch_type_other", e.target.value)}
                    onBlur={() => handleFieldBlur("notch_type_other")}
                    placeholder="Describe notch type"
                    className={inputErrorClass("notch_type_other")}
                    aria-label="Notch type other"
                    aria-invalid={shouldShowError("notch_type_other") || undefined}
                  />
                  {fieldError("notch_type_other")}
                </div>
              )}
            </div>
          </section>

          {/* Safety Plan — retreat, drop zone, hinge */}
          <section className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-4">
            <h3 className="text-sm font-semibold text-white">Safety plan (ANSI Z133)</h3>
            <p className="text-xs text-gray-400">
              Planned retreat path — minimum 2 tree lengths at 45° from fall direction.
            </p>
            <div className="flex flex-wrap gap-6">
              <CompassSelector
                label="Retreat path direction"
                value={treeData.retreat_path_direction}
                onChange={(dir) => updateTree("retreat_path_direction", dir)}
                aria-describedby="retreat-desc"
              />
            </div>
            <div id="retreat-desc" className="sr-only">
              Minimum 2 tree lengths at 45° from fall direction.
            </div>
            {fieldError("retreat_path_direction")}
            <div>
              <label className={labelClass}>Estimated retreat distance</label>
              <input
                type="text"
                value={treeData.retreat_path_distance}
                onChange={(e) => updateTree("retreat_path_distance", e.target.value)}
                onBlur={() => handleFieldBlur("retreat_path_distance")}
                placeholder="e.g. 120 ft"
                className={inputErrorClass("retreat_path_distance")}
                aria-label="Retreat path distance"
                aria-invalid={shouldShowError("retreat_path_distance") || undefined}
              />
              {fieldError("retreat_path_distance")}
            </div>
            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={treeData.retreat_path_cleared}
                  onChange={(e) => {
                    updateTree("retreat_path_cleared", e.target.checked);
                    handleFieldBlur("retreat_path_cleared");
                  }}
                  className="rounded border-white/20 text-emerald-500 focus:ring-emerald-500"
                  aria-label="Retreat path cleared"
                />
                <span className="text-sm text-white">Retreat path has been cleared of obstacles.</span>
              </label>
              {fieldError("retreat_path_cleared")}
            </div>
            <div>
              <label className={labelClass}>Describe the planned drop zone</label>
              <textarea
                value={treeData.drop_zone_description}
                onChange={(e) => updateTree("drop_zone_description", e.target.value)}
                onBlur={() => handleFieldBlur("drop_zone_description")}
                rows={2}
                placeholder="Drop zone description"
                className={inputErrorClass("drop_zone_description") + " min-h-[44px]"}
                aria-label="Drop zone description"
                aria-invalid={shouldShowError("drop_zone_description") || undefined}
              />
              {fieldError("drop_zone_description")}
            </div>
            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={treeData.drop_zone_cleared}
                  onChange={(e) => {
                    updateTree("drop_zone_cleared", e.target.checked);
                    handleFieldBlur("drop_zone_cleared");
                  }}
                  className="rounded border-white/20 text-emerald-500 focus:ring-emerald-500"
                  aria-label="Drop zone cleared"
                />
                <span className="text-sm text-white">Drop zone has been cleared of personnel and obstacles.</span>
              </label>
              {fieldError("drop_zone_cleared")}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={labelClass}>Hinge wood width</label>
                <input
                  type="text"
                  value={treeData.hinge_wood_width}
                  onChange={(e) => updateTree("hinge_wood_width", e.target.value)}
                  onBlur={() => handleFieldBlur("hinge_wood_width")}
                  placeholder="Measurement"
                  className={inputErrorClass("hinge_wood_width")}
                  aria-label="Hinge wood width"
                  aria-invalid={shouldShowError("hinge_wood_width") || undefined}
                />
                {fieldError("hinge_wood_width")}
              </div>
              <div>
                <label className={labelClass}>Hinge wood thickness</label>
                <input
                  type="text"
                  value={treeData.hinge_wood_thickness}
                  onChange={(e) => updateTree("hinge_wood_thickness", e.target.value)}
                  onBlur={() => handleFieldBlur("hinge_wood_thickness")}
                  placeholder="Measurement"
                  className={inputErrorClass("hinge_wood_thickness")}
                  aria-label="Hinge wood thickness"
                  aria-invalid={shouldShowError("hinge_wood_thickness") || undefined}
                />
                {fieldError("hinge_wood_thickness")}
              </div>
            </div>
            <div>
              <label className={labelClass} htmlFor="hinge_wood_condition">Hinge wood condition</label>
              <select
                id="hinge_wood_condition"
                value={treeData.hinge_wood_condition}
                onChange={(e) => updateTree("hinge_wood_condition", e.target.value)}
                onBlur={() => handleFieldBlur("hinge_wood_condition")}
                className={inputErrorClass("hinge_wood_condition")}
                aria-label="Hinge wood condition"
                aria-invalid={shouldShowError("hinge_wood_condition") || undefined}
              >
                {HINGE_WOOD_CONDITION_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    {c.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
              {fieldError("hinge_wood_condition")}
            </div>
          </section>

          {/* Crew positions */}
          <section className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Crew positions</h3>
              <button
                type="button"
                onClick={addCrewMember}
                className="text-xs text-amber-400 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50 rounded"
                aria-label="Add crew member"
              >
                + Add crew member
              </button>
            </div>
            {fieldError("crew_positions")}
            {treeData.crew_positions.length === 0 ? (
              <p className="text-xs text-gray-400">No crew members added yet.</p>
            ) : (
              treeData.crew_positions.map((crew, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2 p-2 rounded-lg bg-black/20">
                  <input
                    type="text"
                    value={crew.name}
                    onChange={(e) => updateCrewMember(i, { name: e.target.value })}
                    placeholder="Name"
                    className={inputClass + " flex-1 min-w-[100px]"}
                    aria-label={`Crew member ${i + 1} name`}
                  />
                  <select
                    value={crew.role}
                    onChange={(e) => updateCrewMember(i, { role: e.target.value })}
                    className={inputClass + " w-[180px]"}
                    aria-label={`Crew member ${i + 1} role`}
                  >
                    {CREW_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r.replace(/_/g, " ")}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => removeCrewMember(i)}
                    className="rounded p-2 text-red-400 hover:bg-red-500/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50"
                    aria-label={`Remove crew member ${i + 1}`}
                  >
                    Remove
                  </button>
                </div>
              ))
            )}
          </section>

          {/* Equipment checklist */}
          <section className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
            <h3 className="text-sm font-semibold text-white">Equipment checklist</h3>
            <div className="space-y-2">
              {(
                [
                  ["chainsaw_inspected", "Chainsaw inspected", "equipment_chainsaw"],
                  ["wedges_available", "Wedges available", "equipment_wedges"],
                  ["felling_lever_available", "Felling lever available", "equipment_felling_lever"],
                  ["escape_route_cleared", "Escape route cleared", "equipment_escape_route"],
                  ["ppe_verified_all_crew", "PPE verified for all crew", "equipment_ppe"],
                ] as const
              ).map(([key, label, errKey]) => (
                <div key={key}>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={treeData.equipment_checklist[key]}
                      onChange={(e) => {
                        setEquipmentChecklist(key, e.target.checked);
                        handleFieldBlur(errKey);
                      }}
                      className="rounded border-white/20 text-emerald-500 focus:ring-emerald-500"
                      aria-label={label}
                    />
                    <span className="text-sm text-white">{label}</span>
                  </label>
                  {fieldError(errKey)}
                </div>
              ))}
            </div>
          </section>

          {/* Overhead hazards */}
          <section className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
            <h3 className="text-sm font-semibold text-white">Overhead hazards</h3>
            <div>
              <label className={labelClass}>Distance from lines</label>
              <input
                type="text"
                value={treeData.distance_from_lines}
                onChange={(e) => updateTree("distance_from_lines", e.target.value)}
                placeholder="e.g. 10 ft from primary"
                className={inputClass}
                aria-label="Distance from lines"
              />
            </div>
            <div>
              <label className={labelClass}>Hazards present</label>
              <textarea
                value={treeData.hazards_present}
                onChange={(e) => updateTree("hazards_present", e.target.value)}
                rows={2}
                className={inputClass + " min-h-[44px]"}
                aria-label="Hazards present"
              />
            </div>
          </section>

          {/* Review / Signature */}
          <section className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-4">
            <h3 className="text-sm font-semibold text-white">Review & signature</h3>
            <SignaturePad
              value={employeeSignaturePath}
              onChange={setEmployeeSignaturePath}
              formType="jsa"
              required={false}
              error={shouldShowError("employeeSignaturePath") ? getFieldError("employeeSignaturePath") : undefined}
              className="max-w-xs"
            />
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-medium text-white/80">Observer signatures (up to 6)</h4>
              {observerSignatures.length < 6 && (
                <button
                  type="button"
                  onClick={addObserverSignature}
                  className="text-xs text-amber-400 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50 rounded"
                  aria-label="Add observer signature"
                >
                  + Add
                </button>
              )}
            </div>
            {observerSignatures.map((sig, i) => (
              <div key={i} className="flex gap-2">
                <input
                  type="text"
                  value={sig.name}
                  onChange={(e) =>
                    setObserverSignatures((p) =>
                      p.map((s, j) => (j === i ? { ...s, name: e.target.value } : s))
                    )
                  }
                  placeholder="Name"
                  className={inputClass + " flex-1"}
                  aria-label={`Observer ${i + 1} name`}
                />
                <input
                  type="text"
                  value={sig.signature_data}
                  onChange={(e) =>
                    setObserverSignatures((p) =>
                      p.map((s, j) => (j === i ? { ...s, signature_data: e.target.value } : s))
                    )
                  }
                  placeholder="Initials"
                  className={inputClass + " w-28"}
                  aria-label={`Observer ${i + 1} initials`}
                />
              </div>
            ))}
          </section>
        </fieldset>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => handleSubmit(true)}
            disabled={submitting || isLoading}
            className="rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/20 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
            aria-label="Save draft"
          >
            Save draft
          </button>
          <button
            type="button"
            onClick={() => handleSubmit(false)}
            disabled={submitting || isLoading}
            className="rounded-lg bg-amber-500/20 px-4 py-2 text-sm font-medium text-amber-400 hover:bg-amber-500/30 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
            aria-label={isEditMode ? "Update Tree Felling JSA" : "Submit Tree Felling JSA"}
          >
            {isEditMode ? "Update" : "Submit"}
          </button>
          <Link
            to="/forms"
            className="rounded-lg border border-white/20 px-4 py-2 text-sm text-gray-300 hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
            aria-label="Back to Forms"
          >
            Back to Forms
          </Link>
        </div>
      </div>
    </DashboardLayout>
  );
}
