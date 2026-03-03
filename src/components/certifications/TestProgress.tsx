interface TestProgressProps {
  current: number;
  total: number;
  answeredCount: number;
}

export function TestProgress({ current, total, answeredCount }: TestProgressProps) {
  const pct = total > 0 ? Math.round((answeredCount / total) * 100) : 0;

  return (
    <div className="flex-1 min-w-0 space-y-1.5">
      <div className="flex items-center justify-between gap-4 text-xs font-medium text-white/60">
        <span className="whitespace-nowrap shrink-0">
          Question {current} of {total}
        </span>
        <span className="whitespace-nowrap shrink-0 text-emerald-400/80">
          {pct}% answered
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-gray-800">
        <div
          className="h-full rounded-full bg-emerald-500 transition-all duration-300 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
