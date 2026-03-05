import { useState } from "react";
import { ChevronDown, ChevronRight, History } from "lucide-react";
import { useCertificationAuditLog, type CertificationAuditLogEntry } from "../../../hooks/useCertifications";

function formatActionLabel(action: string): string {
  switch (action) {
    case "grade_submission":
      return "graded submission";
    case "qualification_level_change":
      return "changed qualification level";
    case "cert_access_grant":
      return "granted cert access";
    case "cert_access_revoke":
      return "revoked cert access";
    case "external_cert_type_created":
      return "created external cert type";
    case "external_cert_type_updated":
      return "updated external cert type";
    case "external_cert_assigned":
      return "assigned external cert";
    case "external_cert_updated":
      return "updated external cert";
    case "external_cert_revoked":
      return "revoked external cert";
    case "external_cert_verified":
      return "verified external cert";
    default:
      return action.replace(/_/g, " ");
  }
}

function formatRecordLabel(entry: CertificationAuditLogEntry): string {
  switch (entry.action) {
    case "grade_submission":
      return "attempt";
    case "qualification_level_change":
      return "worker qualification";
    case "cert_access_grant":
    case "cert_access_revoke":
      return "cert access";
    case "external_cert_type_created":
    case "external_cert_type_updated":
      return "certification type";
    case "external_cert_assigned":
    case "external_cert_updated":
    case "external_cert_revoked":
    case "external_cert_verified":
      return "worker certification";
    default:
      return "record";
  }
}

function formatAuditLine(entry: CertificationAuditLogEntry): string {
  const actor = entry.actor_name ?? "Unknown";
  const action = formatActionLabel(entry.action);
  const record = formatRecordLabel(entry);
  const time = new Date(entry.created_at).toLocaleString(undefined, {
    dateStyle: "short",
    timeStyle: "short",
  });
  return `${actor} ${action} on ${record} at ${time}`;
}

export function CertificationAuditLogPanel() {
  const [open, setOpen] = useState(false);
  const { data: entries, isLoading, error } = useCertificationAuditLog({ enabled: open });

  return (
    <section
      className="rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden"
      data-testid="certification-audit-log-panel"
    >
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-medium text-white hover:bg-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-400/50"
        aria-expanded={open}
        aria-controls="certification-audit-log-content"
      >
        {open ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-white/70" aria-hidden />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-white/70" aria-hidden />
        )}
        <History className="h-4 w-4 shrink-0 text-white/60" aria-hidden />
        <span>Audit log</span>
      </button>
      <div
        id="certification-audit-log-content"
        role="region"
        aria-label="Certification audit log"
        hidden={!open}
        className="border-t border-white/10"
      >
        {open && (
          <div className="max-h-[320px] overflow-y-auto px-4 py-3">
            {isLoading && (
              <p className="text-sm text-white/50">Loading audit log…</p>
            )}
            {error && (
              <p className="text-sm text-red-400" role="alert">
                {(error as Error)?.message ?? "Failed to load audit log."}
              </p>
            )}
            {!isLoading && !error && (!entries || entries.length === 0) && (
              <p className="text-sm text-white/50">No audit events yet.</p>
            )}
            {!isLoading && !error && entries && entries.length > 0 && (
              <ul className="space-y-1.5 text-sm text-white/80">
                {entries.map((entry) => (
                  <li
                    key={entry.id}
                    className="rounded border border-white/5 bg-black/20 px-2 py-1.5 font-mono text-xs"
                  >
                    {formatAuditLine(entry)}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
