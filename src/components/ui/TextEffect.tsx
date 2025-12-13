import { motion, Variants, Transition } from 'framer-motion';
import { useMemo } from 'react';
import { cn } from '../../lib/utils';

type PresetVariant = 'blur' | 'fade' | 'slide' | 'scale' | 'blurSlide';
type PerOption = 'word' | 'char' | 'line';

interface TextEffectProps {
  children: string;
  per?: PerOption;
  as?: keyof JSX.IntrinsicElements;
  variants?: {
    container?: Variants;
    item?: Variants;
  };
  className?: string;
  preset?: PresetVariant;
  delay?: number;
  trigger?: boolean;
  onAnimationComplete?: () => void;
  segmentWrapperClassName?: string;
}

const defaultContainerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.03 },
  },
  exit: {
    transition: { staggerChildren: 0.02, staggerDirection: 1 },
  },
};

const defaultItemVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

const presetVariants: Record<PresetVariant, { container: Variants; item: Variants }> = {
  blur: {
    container: defaultContainerVariants,
    item: {
      hidden: { opacity: 0, filter: 'blur(12px)' },
      visible: { opacity: 1, filter: 'blur(0px)', transition: { duration: 0.4 } },
      exit: { opacity: 0, filter: 'blur(12px)', transition: { duration: 0.4 } },
    },
  },
  fade: {
    container: defaultContainerVariants,
    item: {
      hidden: { opacity: 0 },
      visible: { opacity: 1, transition: { duration: 0.3 } },
      exit: { opacity: 0, transition: { duration: 0.3 } },
    },
  },
  slide: {
    container: defaultContainerVariants,
    item: {
      hidden: { opacity: 0, y: 20 },
      visible: { opacity: 1, y: 0, transition: { duration: 0.35 } },
      exit: { opacity: 0, y: -20, transition: { duration: 0.35 } },
    },
  },
  scale: {
    container: defaultContainerVariants,
    item: {
      hidden: { opacity: 0, scale: 0.8 },
      visible: { opacity: 1, scale: 1, transition: { duration: 0.3 } },
      exit: { opacity: 0, scale: 0.8, transition: { duration: 0.3 } },
    },
  },
  blurSlide: {
    container: {
      hidden: { opacity: 0 },
      visible: {
        opacity: 1,
        transition: { staggerChildren: 0.02 },
      },
      exit: {
        transition: { staggerChildren: 0.02, staggerDirection: 1 },
      },
    },
    item: {
      hidden: {
        opacity: 0,
        filter: 'blur(10px) brightness(0%)',
        y: 5,
      },
      visible: {
        opacity: 1,
        y: 0,
        filter: 'blur(0px) brightness(100%)',
        transition: {
          duration: 0.4,
        },
      },
      exit: {
        opacity: 0,
        y: -30,
        filter: 'blur(10px) brightness(0%)',
        transition: {
          duration: 0.4,
        },
      },
    },
  },
};

export function TextEffect({
  children,
  per = 'word',
  as: Component = 'p',
  variants,
  className,
  preset = 'blurSlide',
  delay = 0,
  trigger = true,
  onAnimationComplete,
  segmentWrapperClassName,
}: TextEffectProps) {
  const selectedVariants = preset ? presetVariants[preset] : undefined;
  const containerVariants = variants?.container ?? selectedVariants?.container ?? defaultContainerVariants;
  const itemVariants = variants?.item ?? selectedVariants?.item ?? defaultItemVariants;

  // For 'char' mode, we need to split by words first, then by characters
  // This prevents words from being split across lines
  const wordSegments = useMemo(() => {
    if (per === 'char') {
      // Split into words and spaces, keeping spaces as separate elements
      return children.split(/(\s+)/);
    }
    return null;
  }, [children, per]);

  const segments = useMemo(() => {
    if (per === 'line') {
      return children.split('\n');
    }
    if (per === 'word') {
      return children.split(/(\s+)/);
    }
    // per === 'char' - handled separately via wordSegments
    return children.split('');
  }, [children, per]);

  const MotionComponent = motion[Component as keyof typeof motion] as typeof motion.div;

  const containerWithDelay = useMemo(() => {
    if (delay === 0) return containerVariants;
    return {
      ...containerVariants,
      visible: {
        ...(typeof containerVariants.visible === 'object' ? containerVariants.visible : {}),
        transition: {
          ...(typeof containerVariants.visible === 'object' && 
              containerVariants.visible && 
              'transition' in containerVariants.visible 
                ? (containerVariants.visible as { transition?: Transition }).transition 
                : {}),
          delayChildren: delay,
        },
      },
    };
  }, [containerVariants, delay]);

  // For 'char' mode, render words as non-breaking units
  if (per === 'char' && wordSegments) {
    let charIndex = 0;
    return (
      <MotionComponent
        initial="hidden"
        animate={trigger ? 'visible' : 'hidden'}
        exit="exit"
        variants={containerWithDelay}
        onAnimationComplete={onAnimationComplete}
        className={cn('inline-flex flex-wrap', className)}
      >
        {wordSegments.map((word, wordIndex) => {
          // If it's whitespace, render a space
          if (/^\s+$/.test(word)) {
            const spaceKey = `space-${wordIndex}-${charIndex++}`;
            return (
              <motion.span
                key={spaceKey}
                variants={itemVariants}
                className={cn('inline-block w-[0.3em]', segmentWrapperClassName)}
              >
                {'\u00A0'}
              </motion.span>
            );
          }
          // Otherwise, wrap the word in a non-breaking container
          const chars = word.split('');
          return (
            <span key={`word-${wordIndex}`} className="inline-flex whitespace-nowrap">
              {chars.map((char) => {
                const key = `char-${charIndex++}`;
                return (
                  <motion.span
                    key={key}
                    variants={itemVariants}
                    className={cn('inline-block', segmentWrapperClassName)}
                  >
                    {char}
                  </motion.span>
                );
              })}
            </span>
          );
        })}
      </MotionComponent>
    );
  }

  return (
    <MotionComponent
      initial="hidden"
      animate={trigger ? 'visible' : 'hidden'}
      exit="exit"
      variants={containerWithDelay}
      onAnimationComplete={onAnimationComplete}
      className={cn('inline-flex flex-wrap', className)}
    >
      {segments.map((segment, index) => (
        <motion.span
          key={`${segment}-${index}`}
          variants={itemVariants}
          className={cn(
            'inline-block',
            per === 'char' && segment === ' ' && 'w-[0.25em]',
            segmentWrapperClassName
          )}
        >
          {segment === ' ' ? '\u00A0' : segment}
        </motion.span>
      ))}
    </MotionComponent>
  );
}

export default TextEffect;

