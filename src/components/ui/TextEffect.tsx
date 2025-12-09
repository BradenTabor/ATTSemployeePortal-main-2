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

  const segments = useMemo(() => {
    if (per === 'line') {
      return children.split('\n');
    }
    if (per === 'word') {
      return children.split(/(\s+)/);
    }
    // per === 'char'
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

