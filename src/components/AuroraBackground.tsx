import React, { ReactNode, useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "../lib/utils";

interface AuroraBackgroundProps extends React.HTMLProps<HTMLDivElement> {
  children: ReactNode;
  showRadialGradient?: boolean;
}

interface BlobConfig {
  x: string[];
  y: string[];
  scale: number[];
  opacity: number;
  gradient: string;
  blur: string;
  size: string;
  duration: number;
}

/**
 * Aurora background with animated blobs.
 * - Desktop: 3 blobs, moderate opacity
 * - Mobile (<768px): 1 blob, reduced amplitude and opacity
 * - Respects prefers-reduced-motion: static low-opacity blobs
 */
export const AuroraBackground = ({
  className,
  children,
  showRadialGradient = true,
  ...props
}: AuroraBackgroundProps) => {
  const prefersReducedMotion = useReducedMotion();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();

    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Desktop blob configurations - 3 blobs with full movement
  const desktopBlobs: BlobConfig[] = [
    {
      x: ["0%", "30%", "-20%", "0%"],
      y: ["0%", "-30%", "20%", "0%"],
      scale: [1, 1.2, 0.9, 1],
      opacity: 0.4,
      gradient: "radial-gradient(circle, rgba(34,197,94,0.6) 0%, rgba(16,163,74,0.3) 50%, transparent 70%)",
      blur: "blur-[80px]",
      size: "w-[600px] h-[600px]",
      duration: 25,
    },
    {
      x: ["10%", "-25%", "15%", "10%"],
      y: ["-10%", "25%", "-15%", "-10%"],
      scale: [1.1, 0.85, 1.15, 1.1],
      opacity: 0.35,
      gradient: "radial-gradient(circle, rgba(74,222,128,0.5) 0%, rgba(34,197,94,0.25) 50%, transparent 70%)",
      blur: "blur-[100px]",
      size: "w-[500px] h-[500px]",
      duration: 30,
    },
    {
      x: ["-15%", "20%", "-10%", "-15%"],
      y: ["15%", "-20%", "10%", "15%"],
      scale: [0.95, 1.1, 1, 0.95],
      opacity: 0.3,
      gradient: "radial-gradient(circle, rgba(167,243,208,0.4) 0%, rgba(74,222,128,0.2) 50%, transparent 70%)",
      blur: "blur-[120px]",
      size: "w-[450px] h-[450px]",
      duration: 35,
    },
  ];

  // Mobile blob config - 1 blob with reduced amplitude (~50% movement)
  const mobileBlob: BlobConfig = {
    x: ["0%", "15%", "-10%", "0%"],
    y: ["0%", "-15%", "10%", "0%"],
    scale: [1, 1.05, 0.98, 1],
    opacity: 0.25,
    gradient: "radial-gradient(circle, rgba(34,197,94,0.5) 0%, rgba(16,163,74,0.2) 50%, transparent 70%)",
    blur: "blur-[60px]",
    size: "w-[300px] h-[300px]",
    duration: 25,
  };

  const blobs = isMobile ? [mobileBlob] : desktopBlobs;

  const renderBlob = (config: BlobConfig, index: number) => {
    const basePosition =
      index === 0
        ? "top-0 right-0"
        : index === 1
        ? "top-1/3 left-0"
        : "bottom-0 right-1/4";

    // Static rendering for reduced motion
    if (prefersReducedMotion) {
      return (
        <div
          key={index}
          className={cn(
            "absolute rounded-full pointer-events-none",
            config.size,
            config.blur,
            basePosition
          )}
          style={{
            background: config.gradient,
            opacity: config.opacity * 0.5, // Even lower opacity for static
          }}
        />
      );
    }

    return (
      <motion.div
        key={index}
        className={cn(
          "absolute rounded-full pointer-events-none",
          config.size,
          config.blur,
          basePosition
        )}
        style={{
          background: config.gradient,
        }}
        initial={{ opacity: 0 }}
        animate={{
          x: config.x,
          y: config.y,
          scale: config.scale,
          opacity: config.opacity,
        }}
        transition={{
          duration: config.duration,
          repeat: Infinity,
          repeatType: "reverse",
          ease: "easeInOut",
        }}
      />
    );
  };

  return (
    <main>
      <div
        className={cn(
          "relative flex flex-col min-h-screen items-center justify-center bg-neutral-900 text-white transition-bg overflow-hidden",
          className
        )}
        {...props}
      >
        {/* Animated Aurora Blobs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {blobs.map((blob, idx) => renderBlob(blob, idx))}

          {/* Legacy aurora gradient overlay for extra depth */}
          <div
            className={cn(
              `
              [--aurora:repeating-linear-gradient(100deg,#22c55e_5%,#4ade80_15%,#a7f3d0_25%,#16a34a_35%,#15803d_45%)]
              [background-image:var(--aurora)]
              [background-size:200%,_200%]
              filter blur-[10px] opacity-30
              pointer-events-none absolute -inset-[10px]
              will-change-transform
              `,
              showRadialGradient &&
                "[mask-image:radial-gradient(ellipse_at_100%_0%,black_10%,transparent_70%)]",
              !prefersReducedMotion && "animate-aurora"
            )}
          />
        </div>

        {/* Soft Ambient Glow Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-green-500/10 via-transparent to-white/5 pointer-events-none" />

        {/* Page content */}
        <div className="relative z-10 w-full">{children}</div>
      </div>
    </main>
  );
};

export default AuroraBackground;
