import { useRef } from "react";
import { motion, useReducedMotion, useInView } from "framer-motion";

// =============================================================================
// ANIMATION VARIANTS
// =============================================================================

export const listItemVariants = {
  hidden: { opacity: 0, x: -8 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: { delay: Math.min(i * 0.02, 0.12), duration: 0.2, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] },
  }),
};

export const listItemVariantsReduced = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.1 } },
};

export const detailTransition = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.2 },
};

export const detailTransitionReduced = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.1 },
};

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
