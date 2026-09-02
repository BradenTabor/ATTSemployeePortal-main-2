import { cn } from "../../lib/utils";

export type TableSkeletonVariant = "emerald" | "gold" | "ember" | "purple";

const VARIANT_STYLES: Record<
  TableSkeletonVariant,
  { border: string; background: string; cell: string }
> = {
  emerald: {
    border: "border-emerald-500/30",
    background: "bg-[#0B100D]/70",
    cell: "bg-emerald-500/30",
  },
  gold: {
    border: "border-[#F4F7F2]/30",
    background: "bg-[#0B100D]/80",
    cell: "bg-[#E4EAE1]/30",
  },
  ember: {
    border: "border-[#B8FF7A]/30",
    background: "bg-[#0B100D]/80",
    cell: "bg-[#B8FF7A]/30",
  },
  purple: {
    border: "border-purple-500/30",
    background: "bg-[#121A15]/80",
    cell: "bg-purple-500/30",
  },
};

interface TableSkeletonProps {
  rows?: number;
  columns?: number;
  variant?: TableSkeletonVariant;
  className?: string;
}

export default function TableSkeleton({
  rows = 5,
  columns = 4,
  variant = "emerald",
  className,
}: TableSkeletonProps) {
  const variantStyles = VARIANT_STYLES[variant] ?? VARIANT_STYLES.emerald;
  const safeColumns = Math.max(1, Math.min(columns, 6));
  const rowArray = Array.from({ length: rows });
  const colArray = Array.from({ length: safeColumns });

  return (
    <div
      className={cn(
        "overflow-hidden rounded-leaf-sm border backdrop-blur-md p-6",
        variantStyles.border,
        variantStyles.background,
        className
      )}
      aria-hidden="true"
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-3">
          <span className="h-4 w-24 rounded-full bg-white/10 animate-pulse" />
          <span className="h-4 w-16 rounded-full bg-white/10 animate-pulse" />
        </div>
        {rowArray.map((_, rowIdx) => (
          <div
            key={`skeleton-row-${rowIdx}`}
            className="grid gap-3"
            style={{
              gridTemplateColumns: `repeat(${safeColumns}, minmax(120px, 1fr))`,
            }}
          >
            {colArray.map((__, colIdx) => (
              <div
                key={`skeleton-cell-${rowIdx}-${colIdx}`}
                className={cn(
                  "h-4 rounded-full animate-pulse",
                  variantStyles.cell
                )}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

