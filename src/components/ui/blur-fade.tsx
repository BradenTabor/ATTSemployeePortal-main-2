/**
 * BlurFade Component (Magic UI)
 * 
 * Blur fade in/out animation for smooth content transitions.
 * Adapted from Magic UI for the ATTS portal.
 */

import { useRef, memo, ReactNode } from 'react';
import { AnimatePresence, motion, useInView, Variants } from 'framer-motion';
import { cn } from '../../lib/utils';

type MarginType = `${number}${'px' | '%'}` | `${number}${'px' | '%'} ${number}${'px' | '%'}` | `${number}${'px' | '%'} ${number}${'px' | '%'} ${number}${'px' | '%'}` | `${number}${'px' | '%'} ${number}${'px' | '%'} ${number}${'px' | '%'} ${number}${'px' | '%'}`;

interface BlurFadeProps {
  children: ReactNode;
  className?: string;
  variant?: {
    hidden: { y: number };
    visible: { y: number };
  };
  duration?: number;
  delay?: number;
  offset?: number;
  direction?: 'up' | 'down' | 'left' | 'right';
  inView?: boolean;
  inViewMargin?: MarginType;
  blur?: string;
}

export const BlurFade = memo(function BlurFade({
  children,
  className,
  variant,
  duration = 0.4,
  delay = 0,
  offset = 6,
  direction = 'down',
  inView = false,
  inViewMargin = '-50px',
  blur = '6px',
}: BlurFadeProps) {
  const ref = useRef(null);
  const inViewResult = useInView(ref, { once: true, margin: inViewMargin });
  const isInView = !inView || inViewResult;

  const defaultVariants: Variants = {
    hidden: {
      [direction === 'left' || direction === 'right' ? 'x' : 'y']:
        direction === 'right' || direction === 'down' ? -offset : offset,
      opacity: 0,
      filter: `blur(${blur})`,
    },
    visible: {
      [direction === 'left' || direction === 'right' ? 'x' : 'y']: 0,
      opacity: 1,
      filter: 'blur(0px)',
    },
  };

  const combinedVariants = variant || defaultVariants;

  return (
    <AnimatePresence>
      <motion.div
        ref={ref}
        initial="hidden"
        animate={isInView ? 'visible' : 'hidden'}
        exit="hidden"
        variants={combinedVariants}
        transition={{
          delay: 0.04 + delay,
          duration,
          ease: 'easeOut',
        }}
        className={cn(className)}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
});

export default BlurFade;
