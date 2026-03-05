interface WorkerExternalCertsBadgeProps {
  activeCount: number;
  expiringCount: number;
  expiredCount: number;
  onClick: () => void;
}

export function WorkerExternalCertsBadge({
  activeCount,
  expiringCount,
  expiredCount,
  onClick,
}: WorkerExternalCertsBadgeProps) {
  const total = activeCount + expiringCount + expiredCount;

  if (total === 0) {
    return (
      <span
        className="text-xs text-gray-500 italic"
        data-testid="worker-ext-certs-badge"
      >
        None
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      data-testid="worker-ext-certs-badge"
      className="inline-flex items-center gap-1.5 min-h-[32px] rounded-full px-2.5 py-1 text-xs font-medium transition hover:bg-white/10 focus-visible:outline focus-visible:ring-2 focus-visible:ring-emerald-400/50"
    >
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 text-emerald-400 px-2 py-0.5">
        {total} cert{total !== 1 && "s"}
      </span>

      {expiringCount > 0 && (
        <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-amber-500/20 text-[10px] font-bold text-amber-400">
          {expiringCount}
        </span>
      )}

      {expiredCount > 0 && (
        <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-red-500/20 text-[10px] font-bold text-red-400">
          {expiredCount}
        </span>
      )}
    </button>
  );
}
