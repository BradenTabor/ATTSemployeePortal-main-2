/**
 * ReviewSubmitPanel — the close-out step that was never built.
 *
 * Sits under the subjects tray on a draft and answers "can this audit leave my
 * hands?" from the pure readiness module: a verdict band, a pass/fail scorecard,
 * the blocker + warning list (each a fix-it instruction), the ad-hoc items the
 * auditor added, closing notes (autosaved on blur), an explicit sign-off, and
 * the Submit action. Submit is disabled by blockers or a missing sign-off;
 * warnings route through a confirm so nothing ships by accident.
 *
 * The RPC re-checks the blocker subset server-side; if it refuses (stale tab,
 * concurrent edit) the returned HINT is mapped back to a readiness code and
 * highlighted here instead of a generic toast.
 */

import { useMemo, useState } from "react";
import {
  AlertOctagon,
  AlertTriangle,
  Check,
  CheckCircle2,
  ClipboardList,
  Loader2,
  PenLine,
  Send,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import FieldAuditConfirmDialog from "./FieldAuditConfirmDialog";
import { buildSubjectNameMap } from "./subjectDisplay";
import { glass } from "../../../lib/glass";
import { formToast } from "../../../lib/formToast";
import { isOnline } from "../../../lib/offlineQueue";
import { useAuth } from "../../../contexts/AuthContext";
import { useCrewMembers } from "../../../hooks/jobs/useCrewMembers";
import {
  isFieldAuditSubmitError,
  useAuditChecklistItems,
  useFieldAuditItems,
  useFieldAuditSubjects,
  useSubmitFieldAudit,
  useUpdateFieldAuditNotes,
  type FieldAuditSubmitSummary,
} from "../../../hooks/fieldAudit";
import {
  computeFieldAuditReadiness,
  listCustomItems,
  type ReadinessCode,
  type ReadinessGrade,
  type ReadinessIssue,
} from "../fieldAuditReadiness";
import type { FieldAuditResult } from "../fieldAuditConstants";

interface ReviewSubmitPanelProps {
  auditId: string;
  /** Notes already on the draft (resume). */
  initialNotes: string | null;
  onSubmitted: (summary: FieldAuditSubmitSummary) => void;
}

const GRADE_META: Record<
  ReadinessGrade,
  { label: string; blurb: string; band: string; icon: typeof CheckCircle2 }
> = {
  empty: {
    label: "Nothing recorded yet",
    blurb: "Run at least one check before this audit can be submitted.",
    band: "border-white/10 bg-white/[0.02] text-white/70",
    icon: ClipboardList,
  },
  incomplete: {
    label: "Not ready",
    blurb: "Fix the blockers below, then submit.",
    band: "border-rose-500/30 bg-rose-500/[0.08] text-rose-200",
    icon: AlertOctagon,
  },
  findings: {
    label: "Ready — with findings",
    blurb: "Every Fail has a note. Escalate what needs a corrective action, then submit.",
    band: "border-rose-500/30 bg-rose-500/[0.08] text-rose-200",
    icon: ShieldAlert,
  },
  clean: {
    label: "Ready to submit",
    blurb: "All checks recorded, no findings. Nice work.",
    band: "border-emerald-500/30 bg-emerald-500/[0.08] text-emerald-200",
    icon: Sparkles,
  },
};

// "incomplete" with no blockers: submittable, but checks were left blank.
const GAPS_META: (typeof GRADE_META)[ReadinessGrade] = {
  label: "Ready — with gaps",
  blurb: "You can submit now. Unanswered checks will be recorded as not assessed.",
  band: "border-amber-500/30 bg-amber-500/[0.07] text-amber-200",
  icon: AlertTriangle,
};

const RESULT_CHIP: Record<FieldAuditResult, string> = {
  pass: "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
  fail: "bg-rose-500/15 text-rose-300 border-rose-500/25",
  na: "bg-white/[0.06] text-white/60 border-white/10",
};
const RESULT_LABEL: Record<FieldAuditResult, string> = {
  pass: "Pass",
  fail: "Fail",
  na: "N/A",
};

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

export default function ReviewSubmitPanel({
  auditId,
  initialNotes,
  onSubmitted,
}: ReviewSubmitPanelProps) {
  const { fullName, user } = useAuth();
  const { data: configItems = [] } = useAuditChecklistItems();
  const { subjects } = useFieldAuditSubjects(auditId);
  const { items, isLoading: itemsLoading } = useFieldAuditItems(auditId);
  const { crewMembers } = useCrewMembers();
  const { submit, isSubmitting } = useSubmitFieldAudit();
  const { saveNotes, isSavingNotes } = useUpdateFieldAuditNotes();

  const [notes, setNotes] = useState(initialNotes ?? "");
  const [lastSavedNotes, setLastSavedNotes] = useState((initialNotes ?? "").trim());
  const [notesSaved, setNotesSaved] = useState(false);
  const [signedOff, setSignedOff] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  // A server refusal is pinned to the items snapshot it was raised against, so
  // it clears itself the moment the auditor changes anything.
  const [serverRefusal, setServerRefusal] = useState<{
    code: ReadinessCode;
    items: unknown;
  } | null>(null);
  const [customOpen, setCustomOpen] = useState(false);

  const profileById = useMemo(
    () => new Map(crewMembers.map((p) => [p.id, p])),
    [crewMembers],
  );
  const subjectNames = useMemo(
    () => buildSubjectNameMap(subjects, profileById),
    [subjects, profileById],
  );

  const readiness = useMemo(
    () => computeFieldAuditReadiness({ subjects, items, configItems, subjectNames }),
    [subjects, items, configItems, subjectNames],
  );
  const customItems = useMemo(() => listCustomItems(items), [items]);
  const serverCode = serverRefusal && serverRefusal.items === items ? serverRefusal.code : null;

  const meta =
    readiness.grade === "incomplete" && readiness.canSubmit
      ? GAPS_META
      : GRADE_META[readiness.grade];
  const GradeIcon = meta.icon;
  const { counts } = readiness;
  const canSubmit = readiness.canSubmit && signedOff && !isSubmitting && !itemsLoading;

  const submitDisabledReason = !readiness.canSubmit
    ? "Fix the blockers above to submit."
    : !signedOff
      ? "Confirm the sign-off to submit."
      : null;

  const handleNotesBlur = async () => {
    const trimmed = notes.trim();
    if (trimmed === lastSavedNotes) return;
    try {
      await saveNotes({ auditId, notes: trimmed || null });
      setLastSavedNotes(trimmed);
      setNotesSaved(true);
    } catch (e) {
      formToast.error(
        "Notes not saved",
        e instanceof Error ? e.message : "Your notes will still be sent with the submit.",
      );
    }
  };

  const doSubmit = async () => {
    setConfirmOpen(false);
    formToast.submitting("Submitting audit…");
    try {
      const summary = await submit({ auditId, notes });
      formToast.success(
        summary.already_submitted ? "Audit already submitted" : "Audit submitted",
        summary.notified_foreman
          ? "The crew foreman has been notified."
          : "Your audit is on record.",
      );
      onSubmitted(summary);
    } catch (e) {
      if (isFieldAuditSubmitError(e) && e.readinessCode) {
        setServerRefusal({ code: e.readinessCode, items });
        formToast.error("Not ready to submit", e.message);
        return;
      }
      formToast.error(
        "Could not submit audit",
        e instanceof Error ? e.message : "Please try again.",
        { onRetry: () => void doSubmit() },
      );
    }
  };

  const handleSubmitClick = () => {
    if (!canSubmit) return;
    // Online-first by design: checks are already on the server, so nothing is
    // lost — the auditor just needs signal for the final flip.
    if (!isOnline()) {
      formToast.error(
        "No connection",
        "Your checks are saved. Reconnect to submit the audit.",
      );
      return;
    }
    if (readiness.warnings.length > 0) {
      setConfirmOpen(true);
      return;
    }
    void doSubmit();
  };

  const signoffName = fullName || user?.email || "Auditor";

  return (
    <section
      className={`${glass.subtleRed} p-4 sm:p-5 space-y-4`}
      aria-labelledby="fa-review-heading"
      data-testid="field-audit-review"
    >
      <div className="flex items-center gap-2">
        <ClipboardList className="w-4 h-4 text-rose-300/80" aria-hidden />
        <h3 id="fa-review-heading" className="text-sm font-semibold text-white">
          Review &amp; submit
        </h3>
      </div>

      {/* Verdict band */}
      <div
        className={`flex items-start gap-3 rounded-xl border px-3.5 py-3 ${meta.band}`}
        data-testid="field-audit-verdict"
        data-grade={readiness.grade}
        role="status"
      >
        <GradeIcon className="w-5 h-5 shrink-0 mt-0.5" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{meta.label}</p>
          <p className="text-xs opacity-80 mt-0.5">{meta.blurb}</p>
        </div>
        {readiness.passRate !== null && (
          <div className="text-right shrink-0">
            <p className="text-lg font-semibold tabular-nums leading-none">
              {pct(readiness.passRate)}
            </p>
            <p className="text-[10px] uppercase font-mono tracking-[0.14em] opacity-70 mt-1">
              pass rate
            </p>
          </div>
        )}
      </div>

      {/* Scorecard */}
      <dl className="grid grid-cols-4 gap-2" data-testid="field-audit-scorecard">
        <ScoreCell label="Checks" value={counts.total} />
        <ScoreCell label="Pass" value={counts.pass} tone="emerald" />
        <ScoreCell
          label="Fail"
          value={counts.fail}
          tone={counts.fail > 0 ? "rose" : undefined}
          hint={counts.openFail > 0 ? `${counts.openFail} open` : undefined}
        />
        <ScoreCell label="N/A" value={counts.na} />
      </dl>
      <p className="text-[11px] text-white/45 font-mono tracking-wide -mt-1">
        {counts.people} {counts.people === 1 ? "person" : "people"} · {counts.equipment}{" "}
        {counts.equipment === 1 ? "unit" : "units"} · site {counts.siteAnswered}/
        {counts.siteTotal}
        {counts.custom > 0 && ` · ${counts.custom} custom`}
        {counts.fail > 0 && ` · ${counts.failWithPhoto}/${counts.fail} fails with photo`}
      </p>

      {/* Readiness list */}
      {(readiness.blockers.length > 0 || readiness.warnings.length > 0) && (
        <ul className="space-y-1.5" data-testid="field-audit-readiness-list">
          {readiness.blockers.map((issue, i) => (
            <IssueRow
              key={`b-${issue.code}-${issue.subjectId ?? "site"}-${i}`}
              issue={issue}
              highlighted={serverCode === issue.code}
            />
          ))}
          {readiness.warnings.map((issue, i) => (
            <IssueRow
              key={`w-${issue.code}-${issue.subjectId ?? "site"}-${i}`}
              issue={issue}
            />
          ))}
        </ul>
      )}

      {/* Custom items */}
      {customItems.length > 0 && (
        <div className="rounded-xl border border-white/[0.07] bg-white/[0.015]">
          <button
            type="button"
            onClick={() => setCustomOpen((v) => !v)}
            aria-expanded={customOpen}
            className="flex w-full items-center justify-between px-3.5 py-2.5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/50 rounded-xl"
          >
            <span className="text-xs font-medium text-white/80">
              Custom items you added
            </span>
            <span className="text-[11px] font-mono tabular-nums text-white/40">
              {customItems.length}
            </span>
          </button>
          {customOpen && (
            <ul className="px-3.5 pb-3 space-y-1.5">
              {customItems.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between gap-3 text-xs"
                >
                  <span className="min-w-0 truncate text-white/75">
                    {c.label}
                    <span className="text-white/35">
                      {" "}
                      · {c.subjectId ? subjectNames.get(c.subjectId) ?? "Subject" : "Site"}
                    </span>
                  </span>
                  <span
                    className={`shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-mono uppercase ${RESULT_CHIP[c.result]}`}
                  >
                    {RESULT_LABEL[c.result]}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Closing notes */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label
            htmlFor="fa-closing-notes"
            className="text-[11px] uppercase text-white/45 font-mono font-medium tracking-[0.14em]"
          >
            Closing notes
          </label>
          <span className="text-[10px] text-white/35 font-mono" aria-live="polite">
            {isSavingNotes ? "Saving…" : notesSaved ? "Saved" : "Optional"}
          </span>
        </div>
        <textarea
          id="fa-closing-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => void handleNotesBlur()}
          rows={3}
          maxLength={2000}
          placeholder="Overall impression, conditions, anything the foreman should know…"
          data-testid="field-audit-closing-notes"
          className="w-full rounded-xl bg-white/[0.03] border border-white/10 px-3.5 py-2.5 text-sm text-white placeholder-white/30 resize-y focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/50 focus:border-rose-400/40 transition-colors"
        />
      </div>

      {/* Sign-off */}
      <label
        className={`flex items-start gap-3 rounded-xl border px-3.5 py-3 cursor-pointer select-none transition-colors ${
          signedOff
            ? "border-emerald-500/30 bg-emerald-500/[0.06]"
            : "border-white/10 bg-white/[0.02] hover:bg-white/[0.04]"
        }`}
      >
        <span className="relative mt-0.5 shrink-0">
          <input
            type="checkbox"
            checked={signedOff}
            onChange={(e) => setSignedOff(e.target.checked)}
            data-testid="field-audit-signoff"
            className="peer absolute inset-0 z-10 h-5 w-5 cursor-pointer opacity-0"
          />
          <span
            className="flex h-5 w-5 items-center justify-center rounded-md border border-white/25 bg-white/[0.04] peer-checked:border-emerald-400 peer-checked:bg-emerald-500 peer-focus-visible:ring-2 peer-focus-visible:ring-rose-400/50 transition-colors"
            aria-hidden
          >
            {signedOff && <Check className="w-3.5 h-3.5 text-ink-950" strokeWidth={3} />}
          </span>
        </span>
        <span className="min-w-0">
          <span className="flex items-center gap-1.5 text-sm text-white/90">
            <PenLine className="w-3.5 h-3.5 text-white/50" aria-hidden />
            I confirm these findings reflect what I observed on site.
          </span>
          <span className="block text-[11px] text-white/45 mt-0.5">
            Signed as {signoffName}. Submitted audits are locked; only an admin can
            reopen one.
          </span>
        </span>
      </label>

      {/* Submit */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2 pt-1">
        {submitDisabledReason && (
          <p className="text-[11px] text-white/45 sm:mr-auto" data-testid="field-audit-submit-reason">
            {submitDisabledReason}
          </p>
        )}
        <button
          type="button"
          onClick={handleSubmitClick}
          disabled={!canSubmit}
          data-testid="field-audit-submit-btn"
          className="inline-flex min-h-[44px] w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-rose-600 hover:bg-rose-500 border border-rose-500/30 px-5 py-2.5 text-sm font-semibold text-white transition-all duration-150 active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/50"
        >
          {isSubmitting ? (
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
          ) : (
            <Send className="w-4 h-4" aria-hidden />
          )}
          Submit audit
        </button>
      </div>

      <FieldAuditConfirmDialog
        isOpen={confirmOpen}
        tone="warning"
        title={`Submit with ${readiness.warnings.length} ${
          readiness.warnings.length === 1 ? "warning" : "warnings"
        }?`}
        description={
          <ul className="list-disc pl-4 space-y-1">
            {readiness.warnings.slice(0, 5).map((w, i) => (
              <li key={`${w.code}-${i}`}>{w.message}</li>
            ))}
            {readiness.warnings.length > 5 && (
              <li>…and {readiness.warnings.length - 5} more.</li>
            )}
          </ul>
        }
        confirmLabel="Submit anyway"
        cancelLabel="Keep editing"
        confirmLoading={isSubmitting}
        testId="field-audit-submit-confirm"
        onConfirm={() => void doSubmit()}
        onCancel={() => setConfirmOpen(false)}
      />
    </section>
  );
}

function ScoreCell({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: number;
  tone?: "emerald" | "rose";
  hint?: string;
}) {
  const valueClass =
    tone === "emerald"
      ? "text-emerald-300"
      : tone === "rose"
        ? "text-rose-300"
        : "text-white";
  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.015] px-2.5 py-2 text-center">
      <dd className={`text-lg font-semibold tabular-nums leading-none ${valueClass}`}>
        {value}
      </dd>
      <dt className="mt-1 text-[10px] uppercase font-mono tracking-[0.14em] text-white/40">
        {label}
      </dt>
      {hint && <p className="text-[10px] text-rose-300/80 mt-0.5">{hint}</p>}
    </div>
  );
}

function IssueRow({
  issue,
  highlighted = false,
}: {
  issue: ReadinessIssue;
  highlighted?: boolean;
}) {
  const isBlocker = issue.severity === "blocker";
  const Icon = isBlocker ? AlertOctagon : AlertTriangle;
  return (
    <li
      className={[
        "flex items-start gap-2.5 rounded-lg border px-3 py-2 text-xs",
        isBlocker
          ? "border-rose-500/30 bg-rose-500/[0.07] text-rose-100"
          : "border-amber-500/20 bg-amber-500/[0.05] text-amber-100/90",
        highlighted ? "ring-2 ring-rose-400/60" : "",
      ].join(" ")}
      data-testid={`field-audit-issue-${issue.code}`}
      data-severity={issue.severity}
    >
      <Icon
        className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${isBlocker ? "text-rose-300" : "text-amber-300"}`}
        aria-hidden
      />
      <span className="min-w-0 flex-1 leading-snug">
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] opacity-70 mr-1.5">
          {isBlocker ? "Blocker" : "Warning"}
        </span>
        {issue.message}
      </span>
    </li>
  );
}
