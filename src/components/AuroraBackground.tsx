import React, { ReactNode } from "react";
import { cn } from "../lib/utils";

interface AuroraBackgroundProps extends React.HTMLProps<HTMLDivElement> {
  children: ReactNode;
  showRadialGradient?: boolean;
}

export const AuroraBackground = ({
  className,
  children,
  showRadialGradient = true,
  ...props
}: AuroraBackgroundProps) => {
  return (
    <main>
      <div
        className={cn(
          "relative flex flex-col min-h-screen items-center justify-center bg-neutral-900 text-white transition-bg overflow-hidden",
          className
        )}
        {...props}
      >
        {/* Animated Aurora Gradient */}
        <div className="absolute inset-0 overflow-hidden">
          <div
            className={cn(
              `
              [--white-gradient:repeating-linear-gradient(100deg,#ffffff_0%,#ffffff_7%,transparent_10%,transparent_12%,#ffffff_16%)]
              [--dark-gradient:repeating-linear-gradient(100deg,#000000_0%,#000000_7%,transparent_10%,transparent_12%,#000000_16%)]
              [--aurora:repeating-linear-gradient(100deg,#22c55e_5%,#4ade80_15%,#a7f3d0_25%,#16a34a_35%,#15803d_45%)]
              [background-image:var(--white-gradient),var(--aurora)]
              dark:[background-image:var(--dark-gradient),var(--aurora)]
              [background-size:300%,_200%]
              [background-position:50%_50%,50%_50%]
              filter blur-[10px] opacity-80
              after:content-[""] after:absolute after:inset-0
              after:[background-image:var(--white-gradient),var(--aurora)]
              after:dark:[background-image:var(--dark-gradient),var(--aurora)]
              after:[background-size:250%,_150%]
              after:animate-aurora
              after:[background-attachment:fixed]
              after:mix-blend-difference
              pointer-events-none absolute -inset-[10px]
              will-change-transform
              `,
              showRadialGradient &&
                "[mask-image:radial-gradient(ellipse_at_100%_0%,black_10%,transparent_70%)]"
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
