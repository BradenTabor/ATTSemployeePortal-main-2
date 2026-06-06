/**
 * WhatsNewOnboarding Component (Premium Edition)
 * 
 * Full-page onboarding overlay showcasing new app features.
 * Only displays ONCE when user first logs into an updated app version.
 * 
 * Features:
 * - iPhone device mockups showing feature previews
 * - Detailed sub-feature breakdowns with icons
 * - Magic UI animations (blur-fade, shimmer-button, confetti)
 * - Swipeable carousel with progress indicators
 * - "Get Started" celebration on final slide
 * - Remembers completion via localStorage
 * - Respects prefers-reduced-motion
 */

import { memo, useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence, PanInfo, Variants } from 'framer-motion';
import { 
  ChevronLeft, 
  ChevronRight, 
  X, 
  Sparkles,
  Check,
  ArrowRight,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { 
  APP_VERSION, 
  WHATS_NEW_FEATURES, 
  shouldShowOnboarding, 
  setOnboardingCompleted,
  type WhatsNewFeature,
} from '../../lib/appVersion';
import { getDeviceCapabilities } from '../../lib/mobilePerf';

// Magic UI Components
import { BlurFade } from '../ui/blur-fade';
import { ShimmerButton } from '../ui/shimmer-button';
import { Confetti, ConfettiRef } from '../ui/confetti';
import { IPhoneMockup } from '../ui/iphone-mockup';

// Feature Previews
import { FeaturePreview, FeaturePreviewType } from './FeaturePreviews';

// ============================================================================
// ACCENT COLOR CONFIGURATION
// ============================================================================

const accentColors = {
  emerald: {
    glow: 'bg-emerald-500/20',
    glowSecondary: 'bg-emerald-600/15',
    badge: 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300',
    cardBorder: 'border-emerald-500/30',
    cardBg: 'bg-emerald-500/10',
    dot: 'bg-emerald-400',
    particle: '#10b981',
  },
  amber: {
    glow: 'bg-amber-500/20',
    glowSecondary: 'bg-amber-600/15',
    badge: 'bg-amber-500/20 border-amber-500/30 text-amber-300',
    cardBorder: 'border-amber-500/30',
    cardBg: 'bg-amber-500/10',
    dot: 'bg-amber-400',
    particle: '#f59e0b',
  },
  purple: {
    glow: 'bg-purple-500/20',
    glowSecondary: 'bg-purple-600/15',
    badge: 'bg-purple-500/20 border-purple-500/30 text-purple-300',
    cardBorder: 'border-purple-500/30',
    cardBg: 'bg-purple-500/10',
    dot: 'bg-purple-400',
    particle: '#a855f7',
  },
  blue: {
    glow: 'bg-blue-500/20',
    glowSecondary: 'bg-blue-600/15',
    badge: 'bg-blue-500/20 border-blue-500/30 text-blue-300',
    cardBorder: 'border-blue-500/30',
    cardBg: 'bg-blue-500/10',
    dot: 'bg-blue-400',
    particle: '#3b82f6',
  },
  pink: {
    glow: 'bg-pink-500/20',
    glowSecondary: 'bg-pink-600/15',
    badge: 'bg-pink-500/20 border-pink-500/30 text-pink-300',
    cardBorder: 'border-pink-500/30',
    cardBg: 'bg-pink-500/10',
    dot: 'bg-pink-400',
    particle: '#ec4899',
  },
};

type AccentColor = keyof typeof accentColors;

// ============================================================================
// FLOATING PARTICLES COMPONENT
// ============================================================================

interface FloatingParticlesProps {
  color: string;
}

const FloatingParticles = memo(function FloatingParticles({ color }: FloatingParticlesProps) {
  // Reduce particle count on mobile for performance
  const particleCount = typeof window !== 'undefined' && window.innerWidth < 640 ? 10 : 20;
  
  // Generate random values once on mount using useState with lazy initialization
  // This avoids calling Math.random() during render (React purity rule)
  const [particles] = useState(() => 
    Array.from({ length: particleCount }).map((_, i) => ({
      id: i,
      size: Math.random() * 3 + 1.5,
      initialX: Math.random() * 100,
      initialY: Math.random() * 100,
      duration: 15 + Math.random() * 10,
      delay: Math.random() * 5,
      // Pre-compute the random drift for animation to avoid calling Math.random during render
      driftX: Math.random() * 10 - 5,
    }))
  );

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          initial={{ 
            x: `${p.initialX}vw`, 
            y: `${p.initialY}vh`,
            opacity: 0,
          }}
          animate={{
            y: [`${p.initialY}vh`, `${p.initialY - 30}vh`, `${p.initialY}vh`],
            x: [`${p.initialX}vw`, `${p.initialX + p.driftX}vw`, `${p.initialX}vw`],
            opacity: [0, 0.6, 0],
          }}
          transition={{
            duration: p.duration,
            repeat: Infinity,
            delay: p.delay,
            ease: 'easeInOut',
          }}
          className="absolute rounded-full blur-sm"
          style={{
            width: p.size,
            height: p.size,
            backgroundColor: color,
          }}
        />
      ))}
    </div>
  );
});

// ============================================================================
// ANIMATION VARIANTS
// ============================================================================

const backdropVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.5, ease: 'easeOut' } },
  exit: { opacity: 0, transition: { duration: 0.3 } },
};

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      when: 'beforeChildren',
      staggerChildren: 0.1,
      delayChildren: 0.2,
    },
  },
};

const slideVariants: Variants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 300 : -300,
    opacity: 0,
    scale: 0.9,
  }),
  center: {
    x: 0,
    opacity: 1,
    scale: 1,
    transition: { type: 'spring', stiffness: 300, damping: 30 },
  },
  exit: (direction: number) => ({
    x: direction > 0 ? -300 : 300,
    opacity: 0,
    scale: 0.9,
    transition: { duration: 0.2 },
  }),
};

const phoneVariants: Variants = {
  hidden: { 
    opacity: 0, 
    y: 60, 
    scale: 0.8,
    rotateY: -15,
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    rotateY: 0,
    transition: {
      type: 'spring',
      stiffness: 100,
      damping: 20,
      delay: 0.3,
    },
  },
};

const subFeatureVariants: Variants = {
  hidden: { opacity: 0, x: -20 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: { delay: 0.5 + i * 0.1, duration: 0.3 },
  }),
};

// ============================================================================
// SUB-FEATURE CARD COMPONENT
// ============================================================================

interface SubFeatureCardProps {
  icon: string;
  title: string;
  description: string;
  index: number;
  enableAnimations: boolean;
  accentColor?: AccentColor;
}

const SubFeatureCard = memo(function SubFeatureCard({
  icon,
  title,
  description,
  index,
  enableAnimations,
  accentColor = 'emerald',
}: SubFeatureCardProps) {
  const colors = accentColors[accentColor];
  
  const content = (
    <motion.div 
      whileHover={enableAnimations ? { scale: 1.02, y: -2 } : undefined}
      whileTap={enableAnimations ? { scale: 0.98 } : undefined}
      className={`
        flex items-start gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg sm:rounded-xl border ${colors.cardBorder} ${colors.cardBg}
        hover:bg-white/10 transition-all duration-200 cursor-default group relative overflow-hidden
      `}
    >
      {/* Shimmer effect on hover - hidden on mobile for perf */}
      <motion.div
        initial={{ x: '-100%' }}
        whileHover={{ x: '200%' }}
        transition={{ duration: 0.6 }}
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent pointer-events-none hidden sm:block"
      />
      
      <motion.div 
        whileHover={enableAnimations ? { rotate: [0, -5, 5, 0], scale: 1.15 } : undefined}
        transition={{ duration: 0.4 }}
        className={`w-6 h-6 sm:w-8 sm:h-8 rounded-md sm:rounded-lg ${colors.cardBg} border ${colors.cardBorder} flex items-center justify-center flex-shrink-0 text-sm sm:text-lg relative`}
      >
        {/* Icon glow - hidden on mobile for perf */}
        <div className={`absolute inset-0 ${colors.glow} rounded-lg blur-md opacity-0 group-hover:opacity-100 transition-opacity hidden sm:block`} />
        <span className="relative z-10">{icon}</span>
      </motion.div>
      <div className="min-w-0 flex-1">
        <p className="text-xs sm:text-sm font-semibold text-white mb-0 sm:mb-0.5 leading-tight">{title}</p>
        <p className="text-[10px] sm:text-xs text-white/60 leading-snug sm:leading-relaxed line-clamp-2">{description}</p>
      </div>
    </motion.div>
  );

  if (!enableAnimations) return content;

  return (
    <motion.div
      custom={index}
      variants={subFeatureVariants}
      initial="hidden"
      animate="visible"
    >
      {content}
    </motion.div>
  );
});

// ============================================================================
// FEATURE SLIDE COMPONENT
// ============================================================================

interface FeatureSlideProps {
  feature: WhatsNewFeature;
  direction: number;
  enableAnimations: boolean;
}

const FeatureSlide = memo(function FeatureSlide({
  feature,
  direction,
  enableAnimations,
}: FeatureSlideProps) {
  const accent = (feature.accentColor || 'emerald') as AccentColor;
  const colors = accentColors[accent];
  
  const phoneContent = (
    <div className="relative flex-shrink-0">
      {/* Multi-layer glow effect behind phone - simplified on mobile */}
      <motion.div
        animate={enableAnimations ? {
          scale: [1.4, 1.6, 1.4],
          opacity: [0.1, 0.18, 0.1],
        } : undefined}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        className={`absolute inset-0 scale-125 sm:scale-150 rounded-full ${colors.glow} blur-2xl sm:blur-3xl pointer-events-none`}
      />
      <motion.div
        animate={enableAnimations ? {
          scale: [1.2, 1.4, 1.2],
          opacity: [0.06, 0.12, 0.06],
        } : undefined}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
        className={`absolute inset-0 scale-110 sm:scale-125 rounded-full ${colors.glowSecondary} blur-xl sm:blur-2xl pointer-events-none hidden xs:block`}
      />
      
      {/* iPhone mockup container - smaller on mobile */}
      <motion.div 
        className="relative w-[140px] xs:w-[160px] sm:w-[200px] md:w-[220px]"
        whileHover={enableAnimations ? { 
          y: -5, 
          rotateY: 5,
          scale: 1.02,
        } : undefined}
        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        style={{ 
          perspective: '1000px',
          transformStyle: 'preserve-3d',
        }}
      >
        {/* Device shadow - smaller on mobile */}
        <div 
          className="absolute -bottom-2 sm:-bottom-4 left-1/2 -translate-x-1/2 w-[80%] h-4 sm:h-8 rounded-[50%] bg-black/30 blur-lg sm:blur-xl pointer-events-none"
          style={{ transform: 'translateX(-50%) scaleY(0.3)' }}
        />
        
        {/* Main iPhone frame */}
        <IPhoneMockup
          width={220}
          height={449}
          className="w-full h-auto relative z-10"
          frameColor="titanium"
        />
        
        {/* Feature preview content inside phone screen - matches SVG screen bounds */}
        <div 
          className="absolute overflow-hidden z-20"
          style={{
            top: '2.5%',
            left: '4.9%',
            width: '90.2%',
            height: '94%',
            borderRadius: '6% / 3%',
          }}
        >
          <FeaturePreview type={(feature.screenshotPlaceholder || 'profile') as FeaturePreviewType} />
        </div>
        
        {/* Glass screen reflection - hidden on very small screens */}
        <div 
          className="absolute z-30 pointer-events-none hidden xs:block"
          style={{
            top: '2.5%',
            left: '8%',
            width: '60%',
            height: '25%',
            background: 'linear-gradient(180deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.02) 40%, transparent 100%)',
            borderRadius: '30px 80px 100px 30px',
            transform: 'rotate(-5deg)',
          }}
        />
        
        {/* Animated shine effect - desktop only for performance */}
        {enableAnimations && (
          <motion.div
            initial={{ x: '-100%', opacity: 0 }}
            animate={{ 
              x: ['150%', '150%'],
              opacity: [0, 0.3, 0],
            }}
            transition={{ 
              duration: 3,
              repeat: Infinity,
              repeatDelay: 5,
              ease: 'easeInOut',
            }}
            className="absolute z-30 pointer-events-none hidden sm:block"
            style={{
              top: '0',
              left: '0',
              width: '30%',
              height: '100%',
              background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.12) 50%, transparent 100%)',
              transform: 'skewX(-20deg)',
            }}
          />
        )}
        
        {/* Frame edge highlight - left - hidden on mobile */}
        <div 
          className="absolute z-30 pointer-events-none hidden sm:block"
          style={{
            top: '5%',
            left: '0.5%',
            width: '2%',
            height: '90%',
            background: 'linear-gradient(180deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.04) 50%, rgba(255,255,255,0.08) 100%)',
            borderRadius: '10px',
          }}
        />
      </motion.div>
    </div>
  );

  const phoneWrapper = enableAnimations ? (
    <motion.div variants={phoneVariants} initial="hidden" animate="visible">
      {phoneContent}
    </motion.div>
  ) : phoneContent;

  return (
    <motion.div
      key={feature.id}
      custom={direction}
      variants={enableAnimations ? slideVariants : undefined}
      initial={enableAnimations ? 'enter' : undefined}
      animate={enableAnimations ? 'center' : undefined}
      exit={enableAnimations ? 'exit' : undefined}
      className="w-full flex flex-col lg:flex-row items-center gap-3 xs:gap-4 sm:gap-6 lg:gap-10 px-2 xs:px-3 sm:px-4"
    >
      {/* Left side: Phone mockup */}
      <div className="flex justify-center lg:justify-end lg:w-1/3 flex-shrink-0">
        {phoneWrapper}
      </div>

      {/* Right side: Feature info */}
      <div className="flex-1 max-w-lg text-center lg:text-left w-full">
        {/* Badge with dynamic color */}
        {feature.highlight && (
          <BlurFade delay={0.1} direction="up" inView={false}>
            <motion.span 
              whileHover={{ scale: 1.05 }}
              className={`inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-0.5 sm:py-1 rounded-full border text-[10px] sm:text-xs font-bold mb-2 sm:mb-3 ${colors.badge}`}
            >
              <motion.div
                animate={{ rotate: [0, 10, -10, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <Sparkles className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
              </motion.div>
              {feature.highlight}
            </motion.span>
          </BlurFade>
        )}

        {/* Title with gradient effect */}
        <BlurFade delay={0.2} direction="up" inView={false}>
          <h2 className="text-lg xs:text-xl sm:text-2xl md:text-3xl font-bold text-white mb-1 sm:mb-2 flex items-center gap-2 sm:gap-3 justify-center lg:justify-start">
            <motion.span 
              className="text-xl xs:text-2xl sm:text-3xl md:text-4xl"
              animate={enableAnimations ? { 
                scale: [1, 1.1, 1],
                rotate: [0, 5, -5, 0],
              } : undefined}
              transition={{ duration: 3, repeat: Infinity, delay: 0.5 }}
            >
              {feature.icon}
            </motion.span>
            <span className="leading-tight">{feature.title}</span>
          </h2>
        </BlurFade>

        {/* Description - hidden on very small screens, shown as truncated on small */}
        <BlurFade delay={0.3} direction="up" inView={false}>
          <p className="text-xs sm:text-sm md:text-base text-white/70 mb-3 sm:mb-4 md:mb-6 leading-snug sm:leading-relaxed line-clamp-2 sm:line-clamp-none">
            {feature.description}
          </p>
        </BlurFade>

        {/* Sub-features grid with dynamic accent - 2x2 grid, fully visible with scroll */}
        {feature.subFeatures && feature.subFeatures.length > 0 && (
          <div className="grid grid-cols-2 gap-1.5 xs:gap-2 sm:gap-2">
            {feature.subFeatures.map((sub, i) => (
              <SubFeatureCard
                key={sub.title}
                icon={sub.icon}
                title={sub.title}
                description={sub.description}
                index={i}
                enableAnimations={enableAnimations}
                accentColor={accent}
              />
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
});

// ============================================================================
// PROGRESS DOTS COMPONENT
// ============================================================================

interface ProgressDotsProps {
  total: number;
  current: number;
  onSelect: (index: number) => void;
  features: WhatsNewFeature[];
  enableAnimations: boolean;
}

const ProgressDots = memo(function ProgressDots({ 
  total, 
  current, 
  onSelect, 
  features,
  enableAnimations,
}: ProgressDotsProps) {
  return (
    <div className="flex items-center justify-center gap-1.5 xs:gap-2 sm:gap-2.5 hover:scale-110">
      {Array.from({ length: total }).map((_, index) => {
        const isActive = index === current;
        const featureAccent = (features[index]?.accentColor || 'emerald') as AccentColor;
        const dotColor = accentColors[featureAccent];
        
        return (
          <motion.button
            key={index}
            onClick={() => onSelect(index)}
            whileTap={{ scale: 0.9 }}
            animate={isActive && enableAnimations ? {
              scale: [1, 1.08, 1],
            } : undefined}
            transition={isActive ? { duration: 1.5, repeat: Infinity } : undefined}
            className={`relative transition-all duration-300 rounded-full ${
              isActive
                ? `w-6 xs:w-8 sm:w-10 h-2 xs:h-2.5 ${dotColor.dot}`
                : 'w-2 h-2 xs:w-2.5 xs:h-2.5 bg-white/20 hover:bg-white/40'
            }`}
            aria-label={`Go to feature ${index + 1}: ${features[index]?.title}`}
          >
            {/* Active dot glow - simplified on mobile */}
            {isActive && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: [0.2, 0.5, 0.2] }}
                transition={{ duration: 2, repeat: Infinity }}
                className={`absolute inset-0 ${dotColor.dot} rounded-full blur-sm sm:blur-md hidden xs:block`}
              />
            )}
          </motion.button>
        );
      })}
    </div>
  );
});

// ============================================================================
// MAIN COMPONENT
// ============================================================================

function WhatsNewOnboardingComponent() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isVisible, setIsVisible] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(0);
  const confettiRef = useRef<ConfettiRef>(null);

  const features = WHATS_NEW_FEATURES;
  const isLastSlide = currentIndex === features.length - 1;

  // Check device capabilities for animation decisions
  const caps = useMemo(() => getDeviceCapabilities(), []);
  const enableAnimations = !caps.prefersReducedMotion && !caps.isLowEnd;

  // Check if onboarding should be shown (only after user is logged in)
  useEffect(() => {
    if (user && shouldShowOnboarding()) {
      // Small delay to let the dashboard render first
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [user]);

  const handleNext = useCallback(() => {
    if (currentIndex < features.length - 1) {
      setDirection(1);
      setCurrentIndex((prev) => prev + 1);
    }
  }, [currentIndex, features.length]);

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      setDirection(-1);
      setCurrentIndex((prev) => prev - 1);
    }
  }, [currentIndex]);

  const handleSelect = useCallback((index: number) => {
    setDirection(index > currentIndex ? 1 : -1);
    setCurrentIndex(index);
  }, [currentIndex]);

  const handleComplete = useCallback(() => {
    // Fire confetti celebration
    if (confettiRef.current && enableAnimations) {
      confettiRef.current.fire({
        particleCount: 100,
        spread: 70,
        origin: { x: 0.5, y: 0.6 },
        colors: ['#10b981', '#34d399', '#6ee7b7', '#a7f3d0', '#059669'],
      });
    }

    // Mark onboarding as completed
    setOnboardingCompleted(APP_VERSION);
    
    // Delay hiding to show confetti
    setTimeout(() => {
      setIsVisible(false);
      
      // Navigate to the first feature's link if available
      const firstFeatureWithLink = features.find(f => f.linkTo);
      if (firstFeatureWithLink?.linkTo) {
        setTimeout(() => {
          navigate(firstFeatureWithLink.linkTo!);
        }, 300);
      }
    }, enableAnimations ? 1000 : 100);
  }, [features, navigate, enableAnimations]);

  const handleSkip = useCallback(() => {
    setOnboardingCompleted(APP_VERSION);
    setIsVisible(false);
  }, []);

  const handleDragEnd = useCallback((_: unknown, info: PanInfo) => {
    const threshold = 50;
    if (info.offset.x < -threshold && currentIndex < features.length - 1) {
      handleNext();
    } else if (info.offset.x > threshold && currentIndex > 0) {
      handlePrev();
    }
  }, [currentIndex, features.length, handleNext, handlePrev]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight') handleNext();
    if (e.key === 'ArrowLeft') handlePrev();
    if (e.key === 'Escape') handleSkip();
    if (e.key === 'Enter' && isLastSlide) handleComplete();
  }, [handleNext, handlePrev, handleSkip, handleComplete, isLastSlide]);

  if (!isVisible) {
    return null;
  }

  return (
    <>
      {/* Confetti canvas */}
      {enableAnimations && <Confetti ref={confettiRef} />}

      <AnimatePresence mode="wait">
        <motion.div
          variants={enableAnimations ? backdropVariants : undefined}
          initial={enableAnimations ? 'hidden' : undefined}
          animate={enableAnimations ? 'visible' : undefined}
          exit={enableAnimations ? 'exit' : undefined}
          className="fixed inset-0 z-[90] flex flex-col overflow-hidden"
          onKeyDown={handleKeyDown}
          tabIndex={0}
          role="dialog"
          aria-modal="true"
          aria-label="What's New in ATTS Portal"
        >
          {/* Background */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#020805] via-[#041a10] to-[#010503]" />
          
          {/* Animated background orbs - dynamic based on current feature, simplified on mobile */}
          {enableAnimations && (() => {
            const currentAccent = (features[currentIndex]?.accentColor || 'emerald') as AccentColor;
            const colors = accentColors[currentAccent];
            return (
              <div className="absolute inset-0 overflow-hidden pointer-events-none">
                {/* Primary orb - smaller on mobile */}
                <motion.div
                  key={`orb1-${currentAccent}`}
                  animate={{
                    scale: [1, 1.2, 1],
                    opacity: [0.06, 0.14, 0.06],
                    x: [0, 30, 0],
                    y: [0, 15, 0],
                  }}
                  transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
                  className={`absolute top-1/4 left-1/4 w-[300px] sm:w-[450px] md:w-[600px] h-[300px] sm:h-[450px] md:h-[600px] ${colors.glow} rounded-full blur-2xl sm:blur-3xl transition-colors duration-1000`}
                />
                {/* Secondary orb - hidden on mobile for performance */}
                <motion.div
                  key={`orb2-${currentAccent}`}
                  animate={{
                    scale: [1.2, 1, 1.2],
                    opacity: [0.04, 0.12, 0.04],
                    x: [0, -30, 0],
                    y: [0, -20, 0],
                  }}
                  transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
                  className={`absolute bottom-1/4 right-1/4 w-[250px] sm:w-[400px] md:w-[500px] h-[250px] sm:h-[400px] md:h-[500px] ${colors.glowSecondary} rounded-full blur-2xl sm:blur-3xl transition-colors duration-1000 hidden xs:block`}
                />
                {/* Tertiary accent orb - hidden on small screens */}
                <motion.div
                  key={`orb3-${currentAccent}`}
                  animate={{
                    scale: [0.8, 1.1, 0.8],
                    opacity: [0.03, 0.08, 0.03],
                    x: [0, 20, 0],
                  }}
                  transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
                  className={`absolute top-1/2 right-1/3 w-[300px] md:w-[400px] h-[300px] md:h-[400px] ${colors.glow} rounded-full blur-2xl sm:blur-3xl transition-colors duration-1000 hidden sm:block`}
                />
                {/* Floating particles */}
                <FloatingParticles color={colors.particle} />
              </div>
            );
          })()}

          {/* Skip button - smaller on mobile */}
          <motion.button
            initial={enableAnimations ? { opacity: 0, y: -20 } : undefined}
            animate={enableAnimations ? { opacity: 1, y: 0 } : undefined}
            transition={{ delay: 0.5 }}
            onClick={handleSkip}
            className="absolute top-2 right-2 xs:top-3 xs:right-3 sm:top-4 sm:right-4 z-20 flex items-center gap-1 sm:gap-2 px-2.5 py-1.5 sm:px-4 sm:py-2 rounded-full bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 text-xs sm:text-sm font-medium transition-all"
          >
            Skip
            <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </motion.button>

          {/* Header - more compact on mobile */}
          <motion.div
            variants={enableAnimations ? containerVariants : undefined}
            initial={enableAnimations ? 'hidden' : undefined}
            animate={enableAnimations ? 'visible' : undefined}
            className="relative z-10 pt-8 xs:pt-10 sm:pt-14 md:pt-16 pb-2 xs:pb-3 sm:pb-4 text-center flex-shrink-0 px-4"
          >
            <BlurFade delay={0} direction="down" inView={false}>
              <div className="inline-flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-1 sm:py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-2 sm:mb-3">
                <Sparkles className="w-3 h-3 sm:w-4 sm:h-4 text-emerald-400" />
                <span className="text-xs sm:text-sm font-medium text-emerald-400">
                  What's New in v{APP_VERSION}
                </span>
              </div>
            </BlurFade>
            <BlurFade delay={0.1} direction="down" inView={false}>
              <h1 className="text-xl xs:text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-1 sm:mb-2">
                Explore New Features
              </h1>
            </BlurFade>
            <BlurFade delay={0.2} direction="down" inView={false}>
              <p className="text-white/60 text-xs sm:text-sm">
                Swipe or use arrows to explore • {currentIndex + 1} of {features.length}
              </p>
            </BlurFade>
          </motion.div>

          {/* Feature carousel - scrollable on mobile */}
          <div className="flex-1 relative z-10 overflow-y-auto overflow-x-hidden sm:overflow-hidden sm:flex sm:items-center sm:justify-center scrollbar-hide">
            <motion.div
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.2}
              onDragEnd={handleDragEnd}
              className="w-full max-w-5xl cursor-grab active:cursor-grabbing py-2 sm:py-0"
            >
              <AnimatePresence mode="wait" custom={direction}>
                <FeatureSlide
                  key={currentIndex}
                  feature={features[currentIndex]}
                  direction={direction}
                  enableAnimations={enableAnimations}
                />
              </AnimatePresence>
            </motion.div>

            {/* Navigation arrows - smaller on mobile, hidden when scrolling content */}
            <AnimatePresence>
              {currentIndex > 0 && (
                <motion.button
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={handlePrev}
                  className="absolute left-1 xs:left-2 sm:left-6 top-1/2 -translate-y-1/2 p-2 sm:p-3 rounded-full bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 transition-all z-20 hidden sm:flex hover:scale-110"
                  aria-label="Previous feature"
                >
                  <ChevronLeft className="w-4 h-4 sm:w-6 sm:h-6" />
                </motion.button>
              )}
            </AnimatePresence>
            
            <AnimatePresence>
              {currentIndex < features.length - 1 && (
                <motion.button
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={handleNext}
                  className="absolute right-1 xs:right-2 sm:right-6 top-1/2 -translate-y-1/2 p-2 sm:p-3 rounded-full bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 transition-all z-20 hidden sm:flex hover:scale-110"
                  aria-label="Next feature"
                >
                  <ChevronRight className="w-4 h-4 sm:w-6 sm:h-6" />
                </motion.button>
              )}
            </AnimatePresence>
          </div>

          {/* Bottom section - more compact on mobile */}
          <motion.div
            initial={enableAnimations ? { opacity: 0, y: 30 } : undefined}
            animate={enableAnimations ? { opacity: 1, y: 0 } : undefined}
            transition={{ delay: 0.4 }}
            className="relative z-10 pb-4 xs:pb-6 sm:pb-8 px-3 xs:px-4 sm:px-6 space-y-3 xs:space-y-4 sm:space-y-5 flex-shrink-0"
          >
            {/* Progress dots */}
            <ProgressDots
              total={features.length}
              current={currentIndex}
              onSelect={handleSelect}
              features={features}
              enableAnimations={enableAnimations}
            />

            {/* Action button - smaller on mobile */}
            <div className="flex justify-center">
              {isLastSlide ? (
                <ShimmerButton
                  onClick={handleComplete}
                  shimmerColor="#34d399"
                  shimmerDuration="2s"
                  background="rgba(16, 185, 129, 0.9)"
                  className="min-w-[160px] sm:min-w-[200px] text-sm sm:text-base py-2.5 sm:py-3"
                >
                  <Check className="w-4 h-4 sm:w-5 sm:h-5 mr-1.5 sm:mr-2 hover:scale-[1.02]" />
                  Get Started
                </ShimmerButton>
              ) : (
                <motion.button
                  onClick={handleNext}
                  whileTap={{ scale: 0.98 }}
                  className="flex items-center justify-center gap-1.5 sm:gap-2 px-5 sm:px-8 py-2.5 sm:py-4 rounded-lg sm:rounded-xl bg-white/10 border border-white/20 hover:bg-white/15 text-white font-medium text-sm sm:text-base transition-all"
                >
                  Next Feature
                  <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
                </motion.button>
              )}
            </div>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    </>
  );
}

export const WhatsNewOnboarding = memo(WhatsNewOnboardingComponent);
export default WhatsNewOnboarding;
