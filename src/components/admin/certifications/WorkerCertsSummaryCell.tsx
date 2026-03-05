import { WorkerExternalCertsBadge } from "./WorkerExternalCertsBadge";

interface WorkerCertsSummaryCellProps {
  /** Number of internal (platform) certs with status active (or compliant). */
  internalActiveCount: number;
  /** Total internal cert types (for "2/5" display). Omit to show only "N active". */
  internalTotal?: number;
  externalActiveCount: number;
  externalExpiringCount: number;
  externalExpiredCount: number;
  onExpandClick: () => void;
}

export function WorkerCertsSummaryCell({
  internalActiveCount,
  internalTotal,
  externalActiveCount,
  externalExpiringCount,
  externalExpiredCount,
  onExpandClick,
}: WorkerCertsSummaryCellProps) {
  const hasInternal = internalTotal !== undefined ? internalTotal > 0 : internalActiveCount > 0;
  const internalLabel =
    internalTotal !== undefined
      ? `${internalActiveCount}/${internalTotal}`
      : `${internalActiveCount} active`;

  return (
    <div
      className="flex flex-col gap-1 min-h-[32px] justify-center"
      data-testid="worker-certs-summary-cell"
    >
      {hasInternal && (
        <button
          type="button"
          onClick={onExpandClick}
          className="text-left text-xs text-white/80 hover:text-white focus-visible:outline focus-visible:ring-2 focus-visible:ring-emerald-400/50 rounded px-0.5 -mx-0.5"
        >
          <span className="text-emerald-400/90">{internalLabel}</span>
          <span className="text-white/50 ml-1">internal</span>
        </button>
      )}
      {!hasInternal && (
        <span className="text-xs text-gray-500 italic">No internal certs</span>
      )}
      <WorkerExternalCertsBadge
        activeCount={externalActiveCount}
        expiringCount={externalExpiringCount}
        expiredCount={externalExpiredCount}
        onClick={onExpandClick}
      />
    </div>
  );
}
