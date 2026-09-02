import { memo } from "react";
import { BrandMark } from "@/components/canopy/BrandMark";
import { Z } from "@/lib/zIndex";

/**
 * LoadingScreen — the CANOPY splash.
 *
 * CSS-only (no framer) so it paints before any chunk finishes: a breathing
 * brand tile on ink, the display-serif wordmark, and a single vein of light
 * sweeping a hairline track. Every animation is opacity/transform, and all
 * of it collapses to a static frame under prefers-reduced-motion.
 */
interface LoadingScreenProps {
  /** Mono status line under the vein. Defaults to the generic splash copy. */
  message?: string;
}

function LoadingScreenComponent({ message = "Preparing your canopy" }: LoadingScreenProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={`${message}. All Terrain Tree Service portal.`}
      className="fixed inset-0 flex flex-col items-center justify-center overflow-hidden bg-ink-950 text-bone-100"
      style={{ zIndex: Z.modal }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-[70vmin] w-[70vmin] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(61,220,132,0.14),rgba(61,220,132,0.04)_45%,transparent_70%)] animate-breathe motion-reduce:animate-none"
      />
      <div aria-hidden className="grain pointer-events-none absolute inset-0 opacity-[0.35]" />

      <div className="relative flex flex-col items-center animate-unfurl motion-reduce:animate-none">
        <div className="relative" style={{ animation: "leaf-pulse 3.2s ease-in-out infinite" }}>
          <BrandMark size={84} live />
        </div>

        <p className="type-display mt-8 text-[clamp(1.6rem,4vw,2.4rem)] font-light text-bone-50">
          All Terrain
        </p>
        <p className="type-instrument mt-2 text-verdant-300/80">Tree Service · Employee Portal</p>

        <div className="relative mt-8 h-px w-44 overflow-hidden bg-bone-50/[0.08]">
          <span
            aria-hidden
            className="absolute inset-y-0 left-0 w-1/3 bg-[linear-gradient(90deg,transparent,#B8FF7A,#3DDC84,transparent)] motion-reduce:hidden"
            style={{ animation: "loading-sweep 1.6s cubic-bezier(0.16,1,0.3,1) infinite" }}
          />
          <span aria-hidden className="absolute inset-0 hidden bg-verdant-400/60 motion-reduce:block" />
        </div>

        <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.22em] text-bone-400">
          {message}
        </p>
      </div>
    </div>
  );
}

const LoadingScreen = memo(LoadingScreenComponent);
export default LoadingScreen;
