import { memo, ReactNode } from 'react';
import { motion } from 'framer-motion';
import { useMotionConfig } from './hooks';

interface PageWrapperProps {
  children: ReactNode;
  className?: string;
}

/**
 * PageWrapper - Wraps page content with route transition animations.
 * 
 * Respects prefers-reduced-motion:
 * - Full motion: Smooth fade in/out transitions
 * - Reduced motion: Instant transitions (no animation)
 * 
 * Usage:
 * ```tsx
 * <Route
 *   path="/dashboard"
 *   element={
 *     <PageWrapper>
 *       <Dashboard />
 *     </PageWrapper>
 *   }
 * />
 * ```
 */
function PageWrapperComponent({ children, className }: PageWrapperProps) {
  const { variants } = useMotionConfig();

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      exit="exit"
      variants={variants.pageTransition}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export const PageWrapper = memo(PageWrapperComponent);
export default PageWrapper;

