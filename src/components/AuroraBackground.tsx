import { ReactNode, useEffect, useState, memo } from 'react';
import { motion } from 'framer-motion';
import { cn } from '../lib/utils';

interface AuroraBackgroundProps extends React.HTMLProps<HTMLDivElement> {
  children: ReactNode;
  showRadialGradient?: boolean;
}

interface BlobConfig {
  id: number;
  x: number[];
  y: number[];
  scale: number[];
  opacity: number;
  duration: number;
  size: string;
  color: string;
  blur: string;
}

// Desktop blob configurations - full animation
const DESKTOP_BLOBS: BlobConfig[] = [
  {
    id: 1,
    x: [-20, 30, -10, 20, -20],
    y: [-15, 25, -20, 15, -15],
    scale: [1, 1.2, 0.9, 1.1, 1],
    opacity: 0.35,
    duration: 25,
    size: 'w-[500px] h-[500px]',
    color: 'bg-emerald-500/40',
    blur: 'blur-[100px]',
  },
  {
    id: 2,
    x: [30, -25, 15, -30, 30],
    y: [20, -15, 30, -10, 20],
    scale: [1.1, 0.9, 1.15, 0.95, 1.1],
    opacity: 0.3,
    duration: 28,
    size: 'w-[400px] h-[400px]',
    color: 'bg-green-400/35',
    blur: 'blur-[80px]',
  },
  {
    id: 3,
    x: [-15, 20, -25, 10, -15],
    y: [25, -20, 10, -25, 25],
    scale: [0.95, 1.1, 1, 1.05, 0.95],
    opacity: 0.25,
    duration: 32,
    size: 'w-[350px] h-[350px]',
    color: 'bg-teal-400/30',
    blur: 'blur-[90px]',
  },
];

// Mobile blob - single, reduced animation
const MOBILE_BLOB: BlobConfig = {
  id: 1,
  x: [-10, 15, -5, 10, -10], // Halved amplitude
  y: [-8, 12, -10, 8, -8],
  scale: [1, 1.08, 0.95, 1.05, 1], // Reduced scale variation
  opacity: 0.2,
  duration: 30, // Slower for mobile
  size: 'w-[350px] h-[350px]',
  color: 'bg-emerald-500/25',
  blur: 'blur-[80px]',
};

// Static blob for reduced motion
const STATIC_BLOB: Omit<BlobConfig, 'x' | 'y' | 'scale' | 'duration'> = {
  id: 1,
  opacity: 0.15,
  size: 'w-[400px] h-[400px]',
  color: 'bg-emerald-500/20',
  blur: 'blur-[100px]',
};

function AuroraBackgroundComponent({
  className,
  children,
  showRadialGradient = true,
  ...props
}: AuroraBackgroundProps) {
  const [isMobile, setIsMobile] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
    
    // Check for mobile viewport
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    // Check for reduced motion preference
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);
    
    const handleMotionChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };
    
    // Initial check
    checkMobile();
    
    // Listen for resize
    window.addEventListener('resize', checkMobile);
    mediaQuery.addEventListener('change', handleMotionChange);
    
    return () => {
      window.removeEventListener('resize', checkMobile);
      mediaQuery.removeEventListener('change', handleMotionChange);
    };
  }, []);

  // Determine which blobs to render
  const blobs = prefersReducedMotion
    ? [] // No animated blobs for reduced motion
    : isMobile
      ? [MOBILE_BLOB]
      : DESKTOP_BLOBS;

  return (
    <main>
      <div
        className={cn(
          'relative flex flex-col min-h-screen items-center justify-center bg-neutral-900 text-white transition-bg overflow-hidden',
          className
        )}
        {...props}
      >
        {/* Animated Aurora Blobs */}
        <div 
          className="absolute inset-0 overflow-hidden pointer-events-none"
          aria-hidden="true"
        >
          {hasMounted && prefersReducedMotion ? (
            // Static blob for reduced motion users
            <div
              className={cn(
                'absolute top-1/4 left-1/4 rounded-full',
                STATIC_BLOB.size,
                STATIC_BLOB.color,
                STATIC_BLOB.blur
              )}
              style={{ 
                opacity: STATIC_BLOB.opacity,
                willChange: 'auto'
              }}
            />
          ) : (
            // Animated blobs
            blobs.map((blob) => (
              <motion.div
                key={blob.id}
                className={cn(
                  'absolute rounded-full',
                  blob.size,
                  blob.color,
                  blob.blur
                )}
                style={{
                  top: `${20 + blob.id * 15}%`,
                  left: `${15 + blob.id * 20}%`,
                  willChange: 'transform, opacity',
                }}
                initial={{
                  x: 0,
                  y: 0,
                  scale: 1,
                  opacity: 0,
                }}
                animate={{
                  x: blob.x,
                  y: blob.y,
                  scale: blob.scale,
                  opacity: blob.opacity,
                }}
                transition={{
                  duration: blob.duration,
                  repeat: Infinity,
                  repeatType: 'loop',
                  ease: 'easeInOut',
                }}
              />
            ))
          )}

          {/* Radial gradient mask */}
          {showRadialGradient && (
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                maskImage: 'radial-gradient(ellipse at 100% 0%, black 10%, transparent 70%)',
                WebkitMaskImage: 'radial-gradient(ellipse at 100% 0%, black 10%, transparent 70%)',
              }}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/20 via-transparent to-transparent" />
            </div>
          )}
        </div>

        {/* Soft Ambient Glow Overlay */}
        <div 
          className="absolute inset-0 bg-gradient-to-t from-green-500/10 via-transparent to-white/5 pointer-events-none" 
          aria-hidden="true"
        />

        {/* Page content */}
        <div className="relative z-10 w-full">{children}</div>
      </div>
    </main>
  );
}

export const AuroraBackground = memo(AuroraBackgroundComponent);
export default AuroraBackground;
