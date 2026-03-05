import { useState } from "react";
import { ShieldCheck, AlertTriangle, ShieldX, Clock, Check, X } from "lucide-react";
import {
  useWorkerInternalCertRecords,
  useAdminQuickPracticalDecision,
} from "../../../hooks/useCertifications";
import type { WorkerInternalCertRecord } from "../../../hooks/useCertifications";
import { calculateDaysUntilExpiration, formatCertDate } from "../../../lib/certStatus";
import { toast } from "../../../lib/toast";
import { glass } from "../../../lib/glass";

interface WorkerInternalCertsListProps {
  userId: string;
  workerName: string;
  rightAction?: React.ReactNode;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return formatCertDate(iso);
}

function isExpiringSoon(expiresAt: string | null): boolean {
  const days = calculateDaysUntilExpiration(expiresAt);
  return days !== null && days >= 0 && days <= 30;
}

function certStatusStyle(record: WorkerInternalCertRecord): {
  bg: string;
  text: string;
  icon: typeof ShieldCheck;
  label: string;
} {
  if (record.status === "active") {
    if (isExpiringSoon(record.expires_at)) {
      return {
        bg: "bg-amber-500/20",
        text: "text-amber-400",
        icon: AlertTriangle,
        label: "Expiring soon",
      };
    }
    return {
      bg: "bg-emerald-500/20",
      text: "text-emerald-400",
      icon: ShieldCheck,
      label: "Active",
    };
  }
  if (record.status === "expired") {
    return {
      bg: "bg-red-500/20",
      text: "text-red-400",
      icon: ShieldX,
      label: "Expired",
    };
  }
  if (record.status === "pending" || record.status === "written_passed") {
    return {
      bg: "bg-blue-500/20",
      text: "text-blue-400",
      icon: Clock,
      label: record.status === "written_passed" ? "Pending practical" : "Pending",
    };
  }
  return {
    bg: "bg-gray-500/20",
    text: "text-gray-400",
    icon: ShieldX,
    label: record.status,
  };
}

function PracticalActions({
  userId,
  certificationTypeId,
  workerName,
  certName,
}: {
  userId: string;
  certificationTypeId: string;
  workerName: string;
  certName: string;
}) {
  const quickDecision = useAdminQuickPracticalDecision();
  const [confirming, setConfirming] = useState<"pass" | "fail" | null>(null);

  const handleDecision = (passed: boolean) => {
    quickDecision.mutate(
      {
        userId,
        certificationTypeId,
        passed,
        evaluatorNotes: passed
          ? `Admin approved practical for ${workerName}`
          : `Admin declined practical for ${workerName}`,
      },
      {
        onSuccess: () => {
          toast.success(
            passed
              ? `${certName} practical passed — certification is now active.`
              : `${certName} practical failed.`
          );
          setConfirming(null);
        },
        onError: (e) => {
          toast.error((e as Error)?.message ?? "Failed to submit practical decision.");
          setConfirming(null);
        },
      }
    );
  };

  if (confirming) {
    return (
      <div className="flex items-center gap-2 mt-1.5">
        <span className="text-xs text-white/70">
          {confirming === "pass" ? "Confirm pass?" : "Confirm fail?"}
        </span>
        <button
          type="button"
          onClick={() => handleDecision(confirming === "pass")}
          disabled={quickDecision.isPending}
          className={`rounded-lg px-2.5 py-1 text-xs font-medium min-h-[32px] focus-visible:outline focus-visible:ring-2 focus-visible:ring-emerald-400/50 ${
            confirming === "pass"
              ? "bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30"
              : "bg-red-500/20 text-red-300 hover:bg-red-500/30"
          }`}
        >
          {quickDecision.isPending ? "Submitting…" : "Yes"}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(null)}
          disabled={quickDecision.isPending}
          className="rounded-lg border border-white/20 px-2.5 py-1 text-xs font-medium text-white/70 hover:bg-white/10 min-h-[32px] focus-visible:outline focus-visible:ring-2 focus-visible:ring-emerald-400/50"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 mt-1.5">
      <button
        type="button"
        onClick={() => setConfirming("pass")}
        className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/20 px-2.5 py-1 text-xs font-medium text-emerald-300 hover:bg-emerald-500/30 min-h-[32px] focus-visible:outline focus-visible:ring-2 focus-visible:ring-emerald-400/50"
        data-testid="practical-pass-btn"
      >
        <Check className="h-3 w-3" aria-hidden />
        Pass
      </button>
      <button
        type="button"
        onClick={() => setConfirming("fail")}
        className="inline-flex items-center gap-1 rounded-lg bg-red-500/20 px-2.5 py-1 text-xs font-medium text-red-300 hover:bg-red-500/30 min-h-[32px] focus-visible:outline focus-visible:ring-2 focus-visible:ring-emerald-400/50"
        data-testid="practical-fail-btn"
      >
        <X className="h-3 w-3" aria-hidden />
        Fail
      </button>
    </div>
  );
}

export function WorkerInternalCertsList({ userId, workerName, rightAction }: WorkerInternalCertsListProps) {
  const { data: records, isLoading, error } = useWorkerInternalCertRecords(userId);

  return (
    <div data-testid="worker-internal-certs-list" className={`${glass.card} p-4`}>
      <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
        <h4 className="text-sm font-semibold text-white">
          Internal certifications
          <span className="ml-1.5 text-xs font-normal text-gray-400">— {workerName}</span>
        </h4>
        {rightAction}
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-6">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-white/60" />
        </div>
      )}

      {error && (
        <p className="text-sm text-red-400 py-2">
          {(error as Error)?.message ?? "Failed to load internal certifications."}
        </p>
      )}

      {!isLoading && !error && (!records || records.length === 0) && (
        <p className="text-sm text-gray-500 py-4 text-center">
          No internal certifications yet. Grant access so the worker can take a test.
        </p>
      )}

      {!isLoading && !error && records && records.length > 0 && (
        <div className="space-y-2">
          {records.map((rec) => {
            const style = certStatusStyle(rec);
            const Icon = style.icon;
            const showPracticalActions =
              rec.status === "written_passed" && rec.has_practical_eval;
            return (
              <div
                key={rec.id}
                className={`${glass.subtle} p-3 flex flex-col gap-1.5`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-white truncate">
                    {rec.certification_name}
                  </p>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full ${style.bg} px-2 py-0.5 text-[11px] font-medium ${style.text}`}
                  >
                    <Icon className="h-3 w-3 shrink-0" aria-hidden />
                    {style.label}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-400">
                  <span>Certified: {formatDate(rec.certified_at)}</span>
                  <span>Expires: {formatDate(rec.expires_at)}</span>
                </div>
                {showPracticalActions && (
                  <PracticalActions
                    userId={userId}
                    certificationTypeId={rec.certification_type_id}
                    workerName={workerName}
                    certName={rec.certification_name}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
