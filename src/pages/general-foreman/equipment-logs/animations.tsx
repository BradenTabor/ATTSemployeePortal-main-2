import { useRef } from "react";
import { motion, useReducedMotion, useInView } from "framer-motion";

// =============================================================================
// SCROLL REVEAL COMPONENT
// =============================================================================

interface ScrollRevealSectionProps {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}

export function ScrollRevealSection({ children, delay = 0, className = "" }: ScrollRevealSectionProps) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });
  const prefersReducedMotion = useReducedMotion();
  return (
    <motion.div
      ref={ref}
      initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 20 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.4, delay, ease: [0.4, 0, 0.2, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
