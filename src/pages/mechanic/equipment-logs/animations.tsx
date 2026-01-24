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

export function ScrollRevealSection({ 
  children, 
  delay = 0, 
  className = "" 
}: ScrollRevealSectionProps) {
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

// =============================================================================
// CSS STYLES
// =============================================================================

export const animationStyles = `
  @keyframes shimmer {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  }
  @keyframes pulse-glow {
    0%, 100% { box-shadow: 0 0 20px rgba(251, 146, 60, 0.3), 0 0 40px rgba(251, 146, 60, 0.1); }
    50% { box-shadow: 0 0 30px rgba(251, 146, 60, 0.5), 0 0 60px rgba(251, 146, 60, 0.2); }
  }
  @keyframes gradient-shift {
    0% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  }
  .animate-shimmer {
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent);
    background-size: 200% 100%;
    animation: shimmer 3s infinite;
  }
  .animate-gradient {
    background-size: 200% 200%;
    animation: gradient-shift 8s ease infinite;
  }
  .animate-pulse-glow {
    animation: pulse-glow 3s ease-in-out infinite;
  }
`;
