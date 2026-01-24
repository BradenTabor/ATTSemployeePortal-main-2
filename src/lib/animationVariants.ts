/**
 * Animation Variants and Styles
 * 
 * Exported from a separate file to avoid fast refresh warnings.
 * These are constant values, not React components.
 */

export const listItemVariants = {
  hidden: { opacity: 0, x: -6 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: { delay: Math.min(i * 0.015, 0.1), duration: 0.2, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] },
  }),
};

export const listItemVariantsReduced = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.1 } },
};

export const detailTransition = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -6 },
  transition: { duration: 0.2, ease: [0.4, 0, 0.2, 1] },
};

export const detailTransitionReduced = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.1 },
};
