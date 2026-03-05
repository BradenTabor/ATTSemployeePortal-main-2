import {
  Plus,
  Pencil,
  FileText,
  AlertTriangle,
  Shield,
  ShieldCheck,
  ShieldX,
} from "lucide-react";
import { useWorkerExternalCertifications } from "../../../hooks/queries/useExternalCertifications";
import type { WorkerExternalCertification } from "../../../types/externalCertification";
import { EXTERNAL_CERT_STATUS_LABELS } from "../../../types/externalCertification";
import { calculateDaysUntilExpiration, formatCertDate } from "../../../lib/certStatus";
import { glass } from "../../../lib/glass";

interface WorkerCertificationsCardProps {
  userId: string;
  workerName: string;
  onAssign: () => void;
  onEdit: (cert: WorkerExternalCertification) => void;
}

const STATUS_STYLES: Record<
  string,
  { bg: string; text: string; icon: typeof Shield }
> = {
  active: { bg: "bg-emerald-500/20", text: "text-emerald-400", icon: ShieldCheck },
  expiring_soon: { bg: "bg-amber-500/20", text: "text-amber-400", icon: AlertTriangle },
  expired: { bg: "bg-red-500/20", text: "text-red-400", icon: ShieldX },
  revoked: { bg: "bg-gray-500/20", text: "text-gray-400", icon: ShieldX },
  pending_verification: { bg: "bg-blue-500/20", text: "text-blue-400", icon: Shield },
};

function isExpiringSoon(expirationDate: string | null): boolean {
  const days = calculateDaysUntilExpiration(expirationDate);
  return days !== null && days >= 0 && days <= 30;
}

function resolveStatus(cert: WorkerExternalCertification): string {
  if (
    cert.effective_status === "active" &&
    isExpiringSoon(cert.expiration_date)
  ) {
    return "expiring_soon";
  }
  return cert.effective_status;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return formatCertDate(iso);
}

export function WorkerCertificationsCard({
  userId,
  workerName,
  onAssign,
  onEdit,
}: WorkerCertificationsCardProps) {
  const { data: certs, isLoading } = useWorkerExternalCertifications(userId);

  return (
    <div data-testid="worker-certs-card" className={`${glass.card} p-4`}>
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-white">
          External Certifications
          <span className="ml-1.5 text-xs font-normal text-gray-400">
            — {workerName}
          </span>
        </h4>
        <button
          type="button"
          onClick={onAssign}
          className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/20 px-2.5 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-500/30 transition focus-visible:outline focus-visible:ring-2 focus-visible:ring-emerald-400/50"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden />
          Assign New
        </button>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-6">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-white/60" />
        </div>
      )}

      {!isLoading && (!certs || certs.length === 0) && (
        <p className="text-sm text-gray-500 py-4 text-center">
          No external certifications assigned yet.
        </p>
      )}

      {!isLoading && certs && certs.length > 0 && (
        <div className="space-y-2">
          {certs.map((cert) => {
            const status = resolveStatus(cert);
            const style = STATUS_STYLES[status] ?? STATUS_STYLES.active;
            const StatusIcon = style.icon;
            const label =
              status === "expiring_soon"
                ? "Expiring Soon"
                : EXTERNAL_CERT_STATUS_LABELS[
                    cert.effective_status
                  ] ?? cert.effective_status;

            return (
              <div
                key={cert.id}
                className={`${glass.subtle} p-3 flex flex-col gap-2`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-white truncate">
                      {cert.cert_type_name ?? "Unknown Type"}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full ${style.bg} px-2 py-0.5 text-[11px] font-medium ${style.text}`}
                      >
                        <StatusIcon className="h-3 w-3" aria-hidden />
                        {label}
                      </span>
                      {cert.issuing_authority && (
                        <span className="text-xs text-gray-400 truncate">
                          {cert.issuing_authority}
                        </span>
                      )}
                      {cert.credential_number && (
                        <span className="text-xs text-gray-500">
                          #{cert.credential_number}
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onEdit(cert)}
                    className="shrink-0 rounded-lg p-1.5 text-gray-400 hover:bg-white/10 hover:text-white transition focus-visible:outline focus-visible:ring-2 focus-visible:ring-emerald-400/50"
                    aria-label={`Edit ${cert.cert_type_name ?? "certification"}`}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-400">
                  <span>Issued: {formatDate(cert.issued_date)}</span>
                  <span>Expires: {formatDate(cert.expiration_date)}</span>
                  {cert.document_url && (
                    <a
                      href={cert.document_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300 transition"
                    >
                      <FileText className="h-3 w-3" aria-hidden />
                      View Document
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
