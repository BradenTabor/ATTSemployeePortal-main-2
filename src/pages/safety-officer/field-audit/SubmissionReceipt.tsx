/**
 * SubmissionReceipt — what the auditor sees the moment an audit is submitted.
 *
 * Renders the server-returned rollup (never a client guess), who was notified,
 * and the two sensible next moves: open the record in history or start the
 * next audit. Replaces the draft card in-place so the page never flashes back
 * to the empty start form on success.
 */

import { motion, useReducedMotion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowRight, BellRing, CheckCircle2, History, ShieldAlert } from "lucide-react";
import { glass } from "../../../lib/glass";
import type { FieldAuditSubmitSummary } from "../../../hooks/fieldAudit";

interface SubmissionReceiptProps {
  summary: FieldAuditSubmitSummary;
  onStartAnother: () => void;
}

function formatSubmittedAt(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      timeZone: "America/Chicago",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function SubmissionReceipt({ summary, onStartAnother }: SubmissionReceiptProps) {
  const shouldReduceMotion = useReducedMotion();
  const { checks, subjects } = summary;
  const decisive = checks.pass + checks.fail;
  const passRate = decisive > 0 ? Math.round((checks.pass / decisive) * 100) : null;
  const hasFindings = checks.fail > 0;

  const motionProps = shouldReduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 10, scale: 0.99 },
        animate: { opacity: 1, y: 0, scale: 1 },
        transition: { duration: 0.3, ease: [0.25, 0.1, 0.25, 1] as const },
      };

  return (
    <motion.section
      {...motionProps}
      className={`${hasFindings ? glass.cardRed : glass.success} p-5 sm:p-6 space-y-5`}
      data-testid="field-audit-receipt"
      aria-label="Audit submitted"
    >
      <div className="flex items-start gap-4">
        <div
          className={`w-12 h-12 rounded-leaf-sm border flex items-center justify-center shrink-0 ${
            hasFindings
              ? "bg-rose-500/15 border-rose-500/25"
              : "bg-emerald-500/15 border-emerald-500/25"
          }`}
        >
          {hasFindings ? (
            <ShieldAlert className="w-6 h-6 text-rose-300" aria-hidden />
          ) : (
            <CheckCircle2 className="w-6 h-6 text-emerald-300" aria-hidden />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] uppercase text-white/45 font-mono font-medium tracking-[0.14em]">
            {summary.already_submitted ? "Already on record" : "Submitted"} ·{" "}
            {formatSubmittedAt(summary.submitted_at)} CT
          </p>
          <h2 className="type-display font-light text-bone-50 text-[clamp(1.4rem,3.2vw,2rem)] mt-0.5">
            {hasFindings
              ? `${checks.fail} ${checks.fail === 1 ? "finding" : "findings"} recorded`
              : "Clean audit"}
          </h2>
          <p className="text-xs text-white/40 font-mono mt-1">#{summary.audit_id.slice(0, 8)}</p>
        </div>
      </div>

      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Stat label="Checks" value={checks.total} />
        <Stat label="Pass" value={checks.pass} tone="emerald" />
        <Stat
          label="Fail"
          value={checks.fail}
          tone={checks.fail > 0 ? "rose" : undefined}
          hint={checks.open_fail > 0 ? `${checks.open_fail} record-only` : undefined}
        />
        <Stat label="Pass rate" value={passRate === null ? "—" : `${passRate}%`} />
      </dl>

      <p className="text-[11px] text-white/45 font-mono tracking-wide">
        {subjects.people} {subjects.people === 1 ? "person" : "people"} · {subjects.equipment}{" "}
        {subjects.equipment === 1 ? "unit" : "units"} · {checks.site} site{" "}
        {checks.site === 1 ? "check" : "checks"}
        {checks.custom > 0 && ` · ${checks.custom} custom`}
      </p>

      <div
        className="flex items-start gap-2.5 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-3"
        data-testid="field-audit-receipt-notify"
      >
        <BellRing className="w-4 h-4 text-white/60 shrink-0 mt-0.5" aria-hidden />
        <p className="text-xs text-white/70">
          {summary.notified_foreman
            ? "The crew foreman has been sent a summary of this audit."
            : "No crew foreman was linked to this audit, so no summary alert was sent. Escalated findings still reached their assignees."}
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 pt-1">
        <button
          type="button"
          onClick={onStartAnother}
          data-testid="field-audit-start-another"
          className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl bg-rose-600 hover:bg-rose-500 border border-rose-500/30 px-5 py-2.5 text-sm font-semibold text-white transition-all duration-150 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/50"
        >
          <ArrowRight className="w-4 h-4" aria-hidden />
          Start another audit
        </button>
        <Link
          to={`/safety-officer/field-audit/history?audit=${summary.audit_id}`}
          data-testid="field-audit-receipt-history"
          className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-5 py-2.5 text-sm font-medium text-white/80 hover:text-white hover:bg-white/[0.06] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/50"
        >
          <History className="w-4 h-4" aria-hidden />
          View in history
        </Link>
      </div>
    </motion.section>
  );
}

function Stat({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: number | string;
  tone?: "emerald" | "rose";
  hint?: string;
}) {
  const valueClass =
    tone === "emerald" ? "text-emerald-300" : tone === "rose" ? "text-rose-300" : "text-white";
  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-2.5">
      <dd className={`text-xl font-semibold tabular-nums leading-none ${valueClass}`}>{value}</dd>
      <dt className="mt-1 text-[10px] uppercase font-mono tracking-[0.14em] text-white/40">
        {label}
      </dt>
      {hint && <p className="text-[10px] text-rose-300/80 mt-0.5">{hint}</p>}
    </div>
  );
}
