import { cn } from "../../lib/utils";

export type Variant = "emerald" | "gold" | "ember" | "purple";

const VARIANT_CLASSES: Record<
  Variant,
  { border: string; background: string; shimmer: string }
> = {
  emerald: {
    border: "border-emerald-500/30",
    background: "bg-[#04150f]/85",
    shimmer: "bg-gradient-to-r from-emerald-500/20 via-transparent to-emerald-400/20",
  },
  gold: {
    border: "border-[#f6dcb2]/30",
    background: "bg-[#120f0c]/85",
    shimmer: "bg-gradient-to-r from-[#f4c979]/20 via-transparent to-[#fcd9a4]/20",
  },
  ember: {
    border: "border-[#ff9350]/30",
    background: "bg-[#140604]/85",
    shimmer: "bg-gradient-to-r from-[#ff9350]/20 via-transparent to-[#ffc19f]/20",
  },
  purple: {
    border: "border-purple-500/30",
    background: "bg-[#0f0a1a]/85",
    shimmer: "bg-gradient-to-r from-purple-500/20 via-transparent to-purple-400/20",
  },
};

interface CardListSkeletonProps {
  rows?: number;
  variant?: Variant;
  className?: string;
}

export default function CardListSkeleton({
  rows = 3,
  variant = "emerald",
  className,
}: CardListSkeletonProps) {
  const styles = VARIANT_CLASSES[variant] ?? VARIANT_CLASSES.emerald;
  const placeholders = Array.from({ length: rows });

  return (
    <div className={cn("space-y-4", className)} aria-hidden="true">
      {placeholders.map((_, idx) => (
        <div
          key={`card-skeleton-${idx}`}
          className={cn(
            "rounded-3xl border p-5 backdrop-blur-md overflow-hidden relative",
            styles.border,
            styles.background
          )}
        >
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="h-4 w-24 rounded-full bg-white/10 animate-pulse" />
              <span className="h-4 w-16 rounded-full bg-white/5 animate-pulse" />
            </div>
            <div className="h-3 w-40 rounded-full bg-white/10 animate-pulse" />
            <div className="space-y-2">
              <div className="h-3 w-full rounded-full bg-white/10 animate-pulse" />
              <div className="h-3 w-3/4 rounded-full bg-white/10 animate-pulse" />
              <div className="h-3 w-2/3 rounded-full bg-white/5 animate-pulse" />
            </div>
          </div>
          <div
            className={cn(
              "absolute inset-0 opacity-40 pointer-events-none blur-xl",
              styles.shimmer
            )}
          />
        </div>
      ))}
    </div>
  );
}

