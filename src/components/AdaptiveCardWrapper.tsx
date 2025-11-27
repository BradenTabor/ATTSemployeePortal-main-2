import React from "react";
import { motion, useMotionValue, useTransform, useAnimationFrame } from "framer-motion";

interface AdaptiveCardWrapperProps {
  children: React.ReactNode;
  className?: string;
}

export default function AdaptiveCardWrapper({ children, className }: AdaptiveCardWrapperProps) {
  const time = useMotionValue(0);
  const brightness = useTransform(time, [0, 2000], [1, 1.15]);

  useAnimationFrame((t) => {
    time.set(t % 2000);
  });

  return (
    <motion.div
      style={{
        filter: `brightness(${brightness.get()}) contrast(1.05) saturate(1.05)`,
      }}
      className={`transition-all duration-500 ${className || ""}`}
    >
      {children}
    </motion.div>
  );
}
