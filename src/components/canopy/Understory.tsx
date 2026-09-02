import { lazy, memo, Suspense, useCallback, useMemo, useState } from "react";
import { getDeviceCapabilities } from "@/lib/mobilePerf";

/**
 * Understory — the CANOPY atmosphere.
 *
 * Paints layered CSS gradients immediately, then (on capable devices) lazy-
 * loads the WebGL2 shader chunk and fades it in on top. Low-end devices,
 * reduced-motion users, and browsers without WebGL2 keep the CSS layer.
 */

const UnderstoryGL = lazy(() => import("./UnderstoryGL"));

interface UnderstoryProps {
  /** 0–1 overall glow intensity */
  intensity?: number;
  /** Pin to the viewport instead of the nearest positioned ancestor */
  fixed?: boolean;
  className?: string;
}

function CssUnderstory() {
  return (
    <div className="absolute inset-0">
      <div className="absolute inset-0 bg-[radial-gradient(90%_70%_at_0%_0%,rgba(18,72,42,0.75),transparent_60%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(60%_50%_at_85%_20%,rgba(61,220,132,0.12),transparent_60%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_40%,#040605_100%)]" />
    </div>
  );
}

function UnderstoryComponent({ intensity = 1, fixed = false, className = "" }: UnderstoryProps) {
  const caps = useMemo(() => getDeviceCapabilities(), []);
  const [glFailed, setGlFailed] = useState(false);
  const useGL = !caps.isLowEnd && !caps.prefersReducedMotion && !glFailed;
  const onUnsupported = useCallback(() => setGlFailed(true), []);

  return (
    <div className={`pointer-events-none ${fixed ? "fixed" : "absolute"} inset-0 overflow-hidden bg-ink-950 ${className}`} aria-hidden>
      <CssUnderstory />
      {useGL && (
        <div className="absolute inset-0">
          <Suspense fallback={null}>
            <UnderstoryGL intensity={intensity} onUnsupported={onUnsupported} />
          </Suspense>
        </div>
      )}
      {/* film grain sits above the shader for the whole page */}
      <div className="grain absolute inset-0" />
    </div>
  );
}

export const Understory = memo(UnderstoryComponent);
export default Understory;
