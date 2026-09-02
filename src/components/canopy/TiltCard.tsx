import { forwardRef, useMemo, useRef, type CSSProperties, type PointerEvent, type ReactNode } from "react";
import { motion, useMotionTemplate, useMotionValue, useSpring } from "framer-motion";
import { getDeviceCapabilities } from "@/lib/mobilePerf";
import { cn } from "@/lib/utils";

interface TiltCardProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** Max tilt in degrees */
  max?: number;
  /** Show the moving specular glare */
  glare?: boolean;
  /** Framer variants pass-through for entrance choreography */
  variants?: React.ComponentProps<typeof motion.div>["variants"];
  onClick?: () => void;
}

/**
 * TiltCard — a physical slab that tilts toward the pointer in 3D with a
 * specular glare that tracks the light. Disabled on touch and reduced motion.
 */
export const TiltCard = forwardRef<HTMLDivElement, TiltCardProps>(function TiltCard(
  { children, className, style, max = 8, glare = true, variants, onClick },
  ref
) {
  const caps = useMemo(() => getDeviceCapabilities(), []);
  const enabled = !caps.isMobile && !caps.prefersReducedMotion;
  const localRef = useRef<HTMLDivElement | null>(null);

  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const gx = useMotionValue(50);
  const gy = useMotionValue(50);
  const spring = { stiffness: 220, damping: 22, mass: 0.6 };
  const srx = useSpring(rx, spring);
  const sry = useSpring(ry, spring);
  const sgx = useSpring(gx, { stiffness: 160, damping: 26 });
  const sgy = useSpring(gy, { stiffness: 160, damping: 26 });

  const glareBg = useMotionTemplate`radial-gradient(420px circle at ${sgx}% ${sgy}%, rgba(200,255,212,0.16), rgba(200,255,212,0.04) 35%, transparent 60%)`;

  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!enabled) return;
    const el = localRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    ry.set((px - 0.5) * max * 2);
    rx.set((0.5 - py) * max * 2);
    gx.set(px * 100);
    gy.set(py * 100);
  };
  const onLeave = () => {
    rx.set(0);
    ry.set(0);
    gx.set(50);
    gy.set(50);
  };

  return (
    <motion.div
      ref={(node) => {
        localRef.current = node;
        if (typeof ref === "function") ref(node);
        else if (ref) ref.current = node;
      }}
      variants={variants}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      onClick={onClick}
      className={cn("relative [transform-style:preserve-3d] will-change-transform", className)}
      style={{
        rotateX: enabled ? srx : 0,
        rotateY: enabled ? sry : 0,
        transformPerspective: 1200,
        ...style,
      }}
    >
      {children}
      {glare && enabled && (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[inherit] mix-blend-screen"
          style={{ background: glareBg }}
        />
      )}
    </motion.div>
  );
});

export default TiltCard;
