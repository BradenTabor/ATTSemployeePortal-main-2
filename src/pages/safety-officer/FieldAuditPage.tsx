/**
 * Field Safety Audit (Safety Officer) — Gate 2 / Chunk 2 scaffold.
 *
 * Online-first, server-incremental draft model (D1, ratified 2026-06-27):
 *  - "Start audit" creates the `field_audits` row server-side immediately
 *    (status `draft`). Network is required to start — field sites have signal.
 *  - The server is the source of truth. localStorage holds ONLY the active
 *    `auditId` pointer (crash / reload recovery) so reopening RESUMES the same
 *    server draft and never creates a duplicate. On resume we re-fetch the draft
 *    by id; localStorage is the pointer, not the data store.
 *  - No offline queue, no sync engine. A failed server write surfaces a retry
 *    via `parseFormError`; a failed local pointer write flips the D6
 *    "draft not saved" indicator (wired off the persistence save's `false`
 *    return).
 *
 * The subjects tray, per-subject checklist, escalation flow, field notes, and
 * review/submit land in later chunks. This page delivers the gated route, the
 * red-theme header, the Start-audit form (satisfying the
 * `work_site_id IS NOT NULL OR location_text IS NOT NULL` CHECK), and the
 * create / resume / discard draft lifecycle.
 */

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, useReducedMotion } from "framer-motion";
import { toZonedTime } from "date-fns-tz";
import {
  ClipboardCheck,
  CalendarDays,
  MapPin,
  Users,
  Loader2,
  Trash2,
  AlertTriangle,
  WifiOff,
  ArrowRight,
} from "lucide-react";
import DashboardLayout from "../../layouts/DashboardLayout";
import { supabase } from "../../lib/supabaseClient";
import { glass } from "../../lib/glass";
import { queryKeys } from "../../lib/queryKeys";
import { parseFormError } from "../../lib/errorHandling";
import { formToast } from "../../lib/formToast";
import { logger } from "../../lib/logger";
import { isOnline } from "../../lib/offlineQueue";
import { useAuth } from "../../contexts/AuthContext";
import { useFormPersistence } from "../../hooks/useFormPersistence";
import { useWorkSitesQuery } from "../../hooks/queries/useWorkSites";
import { useCrews } from "../../hooks/useCrews";
import { SubjectsTray, StandaloneFieldNotes } from "./field-audit";

const TZ = "America/Chicago";

/** localStorage payload — pointer only, NOT a data store (D1). */
interface FieldAuditDraftPointer {
  auditId: string | null;
}

interface FieldAuditRow {
  id: string;
  audit_date: string;
  work_site_id: string | null;
  location_text: string | null;
  crew_id: string | null;
  crew_name: string | null;
  status: "draft" | "submitted";
  created_at: string;
}

/** Persistence primitive expects step/completed args; the pointer model uses neither. */
const EMPTY_COMPLETED_STEPS: Set<number> = new Set();

const INPUT_CLASS =
  "w-full rounded-xl bg-white/[0.03] border border-white/10 px-3.5 py-2.5 text-sm text-white placeholder-white/30 " +
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/50 focus:border-rose-400/40 transition-colors";
const LABEL_CLASS =
  "block text-xs font-semibold uppercase tracking-wide text-white/50 mb-1.5";

function getTodayChicago(): string {
  return toZonedTime(new Date(), TZ).toISOString().slice(0, 10);
}

function formatAuditDate(d: string): string {
  try {
    return new Date(`${d}T00:00:00`).toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return d;
  }
}

export default function FieldAuditPage() {
  const { user } = useAuth();
  const userId = user?.id;
  const queryClient = useQueryClient();
  const shouldReduceMotion = useReducedMotion();

  // --- localStorage pointer (crash/reload recovery only) -------------------
  const {
    draftData: pointerDraft,
    flushPendingSave: savePointer,
    clearDraft: clearPointer,
  } = useFormPersistence<FieldAuditDraftPointer>({
    formType: "field_audit",
    userId,
    createInitialState: () => ({ auditId: null }),
    isEditMode: false,
  });

  const [activeAuditId, setActiveAuditId] = useState<string | null>(
    () => pointerDraft?.form?.auditId ?? null,
  );
  // Adopt a stored pointer once (covers the case where userId resolves after mount).
  const pointerAdoptedRef = useRef(activeAuditId !== null);
  useEffect(() => {
    if (pointerAdoptedRef.current) return;
    const stored = pointerDraft?.form?.auditId ?? null;
    if (stored) {
      pointerAdoptedRef.current = true;
      setActiveAuditId(stored);
    }
  }, [pointerDraft]);

  // --- resume: re-fetch the server draft by id -----------------------------
  const auditQuery = useQuery({
    queryKey: queryKeys.fieldAudit.detail(activeAuditId ?? "none"),
    enabled: Boolean(activeAuditId && userId),
    staleTime: 0,
    queryFn: async (): Promise<FieldAuditRow | null> => {
      const { data, error } = await supabase
        .from("field_audits")
        .select(
          "id, audit_date, work_site_id, location_text, crew_id, crew_name, status, created_at",
        )
        .eq("id", activeAuditId as string)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return (data as FieldAuditRow | null) ?? null;
    },
  });

  // Drop a stale pointer when the server draft is gone or already submitted.
  useEffect(() => {
    if (!activeAuditId) return;
    if (auditQuery.isLoading || auditQuery.isFetching) return;
    const row = auditQuery.data;
    if (auditQuery.isError || !row || row.status !== "draft") {
      clearPointer();
      setActiveAuditId(null);
      if (row?.status === "submitted") {
        formToast.info(
          "Audit already submitted",
          "Your previous field audit was already submitted. Start a new one below.",
        );
      } else if (auditQuery.isError) {
        logger.warn("field_audit_resume_failed", { hasAudit: Boolean(activeAuditId) });
      }
    }
  }, [
    activeAuditId,
    auditQuery.isLoading,
    auditQuery.isFetching,
    auditQuery.isError,
    auditQuery.data,
    clearPointer,
  ]);

  const resumedAudit =
    activeAuditId && auditQuery.data?.status === "draft" ? auditQuery.data : null;

  // --- pickers -------------------------------------------------------------
  const { data: workSites } = useWorkSitesQuery();
  const { crews } = useCrews();
  const activeWorkSites = useMemo(
    () => (workSites ?? []).filter((s) => s.is_active),
    [workSites],
  );
  const activeCrews = useMemo(() => crews.filter((c) => c.is_active), [crews]);
  const siteNameById = useMemo(
    () => new Map((workSites ?? []).map((s) => [s.id, s.name])),
    [workSites],
  );
  const crewNameById = useMemo(
    () => new Map(crews.map((c) => [c.id, c.name])),
    [crews],
  );

  // --- start form state ----------------------------------------------------
  const [auditDate, setAuditDate] = useState<string>(() => getTodayChicago());
  const [workSiteId, setWorkSiteId] = useState<string>("");
  const [crewId, setCrewId] = useState<string>("");
  const [locationText, setLocationText] = useState<string>("");
  const [showValidation, setShowValidation] = useState(false);
  const [starting, setStarting] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [draftNotSaved, setDraftNotSaved] = useState(false);
  const [online, setOnline] = useState<boolean>(() => isOnline());

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  const hasLocationOrSite = Boolean(workSiteId) || locationText.trim().length > 0;

  const handleStart = useCallback(async () => {
    if (!userId) return;
    if (!isOnline()) {
      setOnline(false);
      formToast.error(
        "No connection",
        "You need a network connection to start a field audit.",
      );
      return;
    }
    if (!hasLocationOrSite) {
      setShowValidation(true);
      return;
    }

    setStarting(true);
    formToast.submitting("Starting audit…");
    try {
      const { data, error } = await supabase
        .from("field_audits")
        .insert({
          auditor_id: userId,
          audit_date: auditDate,
          work_site_id: workSiteId || null,
          location_text: locationText.trim() || null,
          crew_id: crewId || null,
          status: "draft",
        })
        .select(
          "id, audit_date, work_site_id, location_text, crew_id, crew_name, status, created_at",
        )
        .single();
      if (error) throw error;

      const row = data as FieldAuditRow;
      // Seed the resume cache so the in-progress view renders without a refetch.
      queryClient.setQueryData(queryKeys.fieldAudit.detail(row.id), row);
      queryClient.invalidateQueries({ queryKey: queryKeys.fieldAudit.all });

      // Persist the pointer (crash/reload recovery). false => localStorage write
      // failed: surface the D6 "draft not saved" indicator.
      const pointerSaved = savePointer({ auditId: row.id }, 1, EMPTY_COMPLETED_STEPS);
      setDraftNotSaved(!pointerSaved);
      setActiveAuditId(row.id);
      pointerAdoptedRef.current = true;

      formToast.success(
        "Audit started",
        "Your field audit draft has been created. Add equipment and crew next.",
      );
    } catch (err) {
      const parsed = parseFormError(err, "field_audit");
      formToast.error("Could not start audit", parsed.userMessage, {
        onRetry: () => handleStart(),
      });
    } finally {
      setStarting(false);
    }
  }, [
    userId,
    hasLocationOrSite,
    auditDate,
    workSiteId,
    locationText,
    crewId,
    queryClient,
    savePointer,
  ]);

  const handleDiscard = useCallback(async () => {
    if (!activeAuditId) return;
    setDiscarding(true);
    formToast.submitting("Discarding draft…");
    try {
      const { error } = await supabase
        .from("field_audits")
        .delete()
        .eq("id", activeAuditId);
      if (error) throw error;

      queryClient.removeQueries({ queryKey: queryKeys.fieldAudit.detail(activeAuditId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.fieldAudit.all });
      clearPointer();
      setActiveAuditId(null);
      setDraftNotSaved(false);
      formToast.success("Draft discarded", "The audit draft was removed.");
    } catch (err) {
      const parsed = parseFormError(err, "field_audit");
      formToast.error("Could not discard draft", parsed.userMessage, {
        onRetry: () => handleDiscard(),
      });
    } finally {
      setDiscarding(false);
    }
  }, [activeAuditId, queryClient, clearPointer]);

  const showResuming =
    Boolean(activeAuditId) &&
    !resumedAudit &&
    (auditQuery.isLoading || auditQuery.isFetching);

  const motionProps = shouldReduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 10 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.25, ease: [0.25, 0.1, 0.25, 1] as const },
      };

  return (
    <DashboardLayout title="Field Safety Audit">
      <div className="relative w-full max-w-3xl mx-auto px-3 sm:px-4 md:px-6 pb-12 pt-2 sm:pt-4">
        {/* Atmospheric rose glow (safety officer role) */}
        <div
          className="absolute inset-0 pointer-events-none select-none overflow-hidden rounded-2xl"
          style={{ zIndex: -1 }}
          aria-hidden
        >
          <div
            className="absolute top-0 right-0 w-[min(100%,22rem)] h-64 rounded-full opacity-[0.07]"
            style={{
              background:
                "radial-gradient(circle, #fda4af 0%, #be123c 40%, transparent 70%)",
              filter: "blur(60px)",
              transform: "translate(20%, -20%)",
            }}
          />
        </div>

        <div className="relative z-10 space-y-5">
          {/* Header */}
          <header className={`${glass.cardRed} p-5 sm:p-6`}>
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/25 flex items-center justify-center shrink-0">
                <ClipboardCheck className="w-6 h-6 text-rose-300" aria-hidden />
              </div>
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl font-bold text-white">
                  Field Safety Audit
                </h1>
                <p className="text-sm text-white/60 mt-1">
                  Audit one site visit — equipment and crew Pass / Fail checks
                  with OSHA-referenced findings.
                </p>
              </div>
            </div>
          </header>

          {showResuming ? (
            <div
              className={`${glass.cardRed} p-8 flex items-center justify-center gap-3`}
              data-testid="field-audit-resuming"
            >
              <Loader2 className="w-5 h-5 text-rose-300 animate-spin" aria-hidden />
              <span className="text-sm text-white/70">Resuming your audit…</span>
            </div>
          ) : resumedAudit ? (
            <motion.section
              {...motionProps}
              className={`${glass.cardRed} p-5 sm:p-6 space-y-5`}
              data-testid="field-audit-resume"
              aria-label="Audit in progress"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 border border-amber-500/25 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" aria-hidden />
                    Draft in progress
                  </span>
                  <p className="mt-2 text-xs text-white/40 font-mono">
                    #{resumedAudit.id.slice(0, 8)}
                  </p>
                </div>
              </div>

              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className={`${glass.subtleRed} p-3.5`}>
                  <dt className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-white/45">
                    <CalendarDays className="w-3.5 h-3.5 text-rose-400/80" aria-hidden />
                    Audit date
                  </dt>
                  <dd className="mt-1 text-sm text-white">
                    {formatAuditDate(resumedAudit.audit_date)}
                  </dd>
                </div>
                <div className={`${glass.subtleRed} p-3.5`}>
                  <dt className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-white/45">
                    <MapPin className="w-3.5 h-3.5 text-rose-400/80" aria-hidden />
                    Location
                  </dt>
                  <dd className="mt-1 text-sm text-white truncate">
                    {resumedAudit.work_site_id
                      ? siteNameById.get(resumedAudit.work_site_id) ?? "Work site"
                      : resumedAudit.location_text || "—"}
                  </dd>
                </div>
                <div className={`${glass.subtleRed} p-3.5`}>
                  <dt className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-white/45">
                    <Users className="w-3.5 h-3.5 text-rose-400/80" aria-hidden />
                    Crew
                  </dt>
                  <dd className="mt-1 text-sm text-white truncate">
                    {resumedAudit.crew_id
                      ? crewNameById.get(resumedAudit.crew_id) ?? "Crew"
                      : resumedAudit.crew_name || "—"}
                  </dd>
                </div>
              </dl>

              {draftNotSaved && (
                <div
                  className="flex items-start gap-2.5 rounded-xl border border-amber-500/25 bg-amber-500/[0.06] px-3.5 py-3"
                  role="alert"
                  data-testid="field-audit-draft-not-saved"
                >
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" aria-hidden />
                  <p className="text-xs text-amber-200/90">
                    Draft pointer not saved on this device. The audit is safe on
                    the server, but if you reload you may need to reopen it from
                    history.
                  </p>
                </div>
              )}

              {/* Subjects tray + per-subject checklist (Chunk 3). */}
              <SubjectsTray
                auditId={resumedAudit.id}
                crewId={resumedAudit.crew_id}
              />

              <div className="flex items-center justify-between gap-3 pt-1">
                <button
                  type="button"
                  onClick={handleDiscard}
                  disabled={discarding}
                  data-testid="field-audit-discard-btn"
                  className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-medium text-white/70 hover:text-white hover:bg-white/[0.06] transition-colors disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/50"
                >
                  {discarding ? (
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
                  ) : (
                    <Trash2 className="w-4 h-4" aria-hidden />
                  )}
                  Discard draft
                </button>
              </div>
            </motion.section>
          ) : (
            <motion.section
              {...motionProps}
              className={`${glass.cardRed} p-5 sm:p-6 space-y-4`}
              data-testid="field-audit-start-form"
              aria-label="Start a field audit"
            >
              <div>
                <h2 className="text-base font-semibold text-white">Start an audit</h2>
                <p className="text-xs text-white/50 mt-1">
                  Pick the date and the site or crew you&apos;re auditing. The
                  draft is created on the server immediately so it survives a
                  reload.
                </p>
              </div>

              {!online && (
                <div
                  className="flex items-start gap-2.5 rounded-xl border border-amber-500/25 bg-amber-500/[0.06] px-3.5 py-3"
                  role="alert"
                  data-testid="field-audit-offline-notice"
                >
                  <WifiOff className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" aria-hidden />
                  <p className="text-xs text-amber-200/90">
                    You&apos;re offline. A connection is required to start a field
                    audit.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className={LABEL_CLASS} htmlFor="fa-date">
                    Audit date
                  </label>
                  <input
                    id="fa-date"
                    type="date"
                    value={auditDate}
                    onChange={(e) => setAuditDate(e.target.value)}
                    data-testid="field-audit-date"
                    className={`${INPUT_CLASS} [color-scheme:dark]`}
                  />
                </div>

                <div>
                  <label className={LABEL_CLASS} htmlFor="fa-site">
                    Work site
                  </label>
                  <select
                    id="fa-site"
                    value={workSiteId}
                    onChange={(e) => {
                      setWorkSiteId(e.target.value);
                      if (showValidation) setShowValidation(false);
                    }}
                    data-testid="field-audit-work-site"
                    className={INPUT_CLASS}
                  >
                    <option value="">— None —</option>
                    {activeWorkSites.map((site) => (
                      <option key={site.id} value={site.id}>
                        {site.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={LABEL_CLASS} htmlFor="fa-crew">
                    Crew
                  </label>
                  <select
                    id="fa-crew"
                    value={crewId}
                    onChange={(e) => setCrewId(e.target.value)}
                    data-testid="field-audit-crew"
                    className={INPUT_CLASS}
                  >
                    <option value="">— None —</option>
                    {activeCrews.map((crew) => (
                      <option key={crew.id} value={crew.id}>
                        {crew.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className={LABEL_CLASS} htmlFor="fa-location">
                    Location (if no work site)
                  </label>
                  <input
                    id="fa-location"
                    type="text"
                    value={locationText}
                    onChange={(e) => {
                      setLocationText(e.target.value);
                      if (showValidation) setShowValidation(false);
                    }}
                    placeholder="e.g. Hwy 50 &amp; Oak, north ROW"
                    data-testid="field-audit-location"
                    className={INPUT_CLASS}
                  />
                </div>
              </div>

              {showValidation && !hasLocationOrSite && (
                <p className="text-xs text-rose-300" role="alert">
                  Choose a work site or enter a location to start the audit.
                </p>
              )}

              <div className="pt-1">
                <button
                  type="button"
                  onClick={handleStart}
                  disabled={starting || !online}
                  data-testid="field-audit-start-btn"
                  className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-rose-600 hover:bg-rose-500 border border-rose-500/30 px-5 py-2.5 text-sm font-semibold text-white transition-all duration-150 active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/50"
                >
                  {starting ? (
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
                  ) : (
                    <ArrowRight className="w-4 h-4" aria-hidden />
                  )}
                  Start audit
                </button>
              </div>
            </motion.section>
          )}

          {/* Standalone quick notes — no audit session required (Chunk 5). */}
          {!resumedAudit && !showResuming && <StandaloneFieldNotes />}
        </div>
      </div>
    </DashboardLayout>
  );
}
