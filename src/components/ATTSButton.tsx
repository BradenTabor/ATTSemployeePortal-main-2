import { cn } from "../lib/utils";
import { ElementType, ComponentPropsWithoutRef } from "react";

interface ATTSButtonProps<T extends ElementType> {
  as?: T;
  className?: string;
  children: React.ReactNode;
  color?: string;
  speed?: string;
}

export function ATTSButton<T extends ElementType = "button">({
  as,
  className,
  color = "rgb(34,197,94)",
  speed = "8s",
  children,
  ...props
}: ATTSButtonProps<T> & Omit<ComponentPropsWithoutRef<T>, keyof ATTSButtonProps<T>>) {
  const Component = as || "button";
  return (
    <Component
      {...props}
      className={cn(
        "relative overflow-hidden rounded-[20px] border border-green-500/50",
        "bg-gradient-to-b from-neutral-900 via-neutral-950 to-black",
        "text-green-400 font-semibold text-lg px-8 py-3 transition-all duration-300 hover:text-white hover:shadow-[0_0_25px_rgba(34,197,94,0.6)]",
        "active:scale-[0.98] focus:outline-none",
        className
      )}
    >
      <div
        className="absolute inset-0 opacity-40 animate-pulse pointer-events-none"
        style={{
          background: `radial-gradient(circle at 20% 30%, ${color}, transparent 60%)`,
          animationDuration: speed,
        }}
      />
      <span className="relative z-10">{children}</span>
    </Component>
  );
}
