import { useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import logo from "../assets/ATTS_Logo-removebg-preview.png";
import { Z } from "@/lib/zIndex";

interface SessionOverlayProps {
  isLoading: boolean;
  playSound?: boolean;
}

// ATTS Brand Emerald Color Palette
const colors = {
  emerald: {
    light: '#6ee7b7',
    base: '#10b981',
    dark: '#059669',
    darker: '#047857',
    glow: '#34d399',
  },
  background: {
    start: '#041b14',
    mid: '#03120c',
    end: '#010604',
  },
};

// Animation variants for staggered entrance
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      duration: 0.4,
      ease: "easeOut" as const,
      when: "beforeChildren" as const,
      staggerChildren: 0.1,
    },
  },
  exit: {
    opacity: 0,
    transition: {
      duration: 0.3,
      ease: "easeIn" as const,
    },
  },
};

const contentVariants = {
  hidden: { opacity: 0, scale: 0.95, y: 10 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      type: "spring" as const,
      stiffness: 300,
      damping: 25,
    },
  },
};

const logoVariants = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      type: "spring" as const,
      stiffness: 200,
      damping: 20,
      duration: 0.6,
    },
  },
};

const textVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: "easeOut" as const,
    },
  },
};

// Orbital dot component for the premium spinner
function OrbitalDot({ index, total }: { index: number; total: number }) {
  const angle = (index / total) * 360;
  const delay = index * 0.15;
  
  return (
    <motion.div
      className="absolute w-2.5 h-2.5 rounded-full"
      style={{
        background: `linear-gradient(135deg, ${colors.emerald.light}, ${colors.emerald.base})`,
        boxShadow: `0 0 8px ${colors.emerald.glow}, 0 0 16px ${colors.emerald.base}40`,
        transformOrigin: "center",
      }}
      initial={{ 
        rotate: angle,
        x: 28,
        opacity: 0,
        scale: 0,
      }}
      animate={{
        rotate: [angle, angle + 360],
        opacity: [0.4, 1, 0.4],
        scale: [0.8, 1.2, 0.8],
      }}
      transition={{
        rotate: {
          duration: 2,
          ease: "linear",
          repeat: Infinity,
          delay,
        },
        opacity: {
          duration: 1.5,
          ease: "easeInOut",
          repeat: Infinity,
          delay,
        },
        scale: {
          duration: 1.5,
          ease: "easeInOut",
          repeat: Infinity,
          delay,
        },
      }}
    />
  );
}

// Shimmer ring component
function ShimmerRing() {
  return (
    <motion.div
      className="absolute inset-0 rounded-full"
      style={{
        background: `conic-gradient(from 0deg, transparent, ${colors.emerald.glow}40, transparent, ${colors.emerald.light}30, transparent)`,
      }}
      animate={{
        rotate: [0, 360],
      }}
      transition={{
        duration: 4,
        ease: "linear",
        repeat: Infinity,
      }}
    />
  );
}

// Breathing glow component
function BreathingGlow() {
  return (
    <>
      {/* Primary glow */}
      <motion.div
        className="absolute rounded-full blur-3xl"
        style={{
          width: '200px',
          height: '200px',
          background: `radial-gradient(circle, ${colors.emerald.base}30, ${colors.emerald.dark}15, transparent)`,
        }}
        animate={{
          scale: [1, 1.3, 1],
          opacity: [0.4, 0.7, 0.4],
        }}
        transition={{
          duration: 3,
          ease: "easeInOut",
          repeat: Infinity,
        }}
      />
      {/* Secondary accent glow */}
      <motion.div
        className="absolute rounded-full blur-2xl"
        style={{
          width: '120px',
          height: '120px',
          background: `radial-gradient(circle, ${colors.emerald.glow}25, transparent)`,
        }}
        animate={{
          scale: [1.1, 0.9, 1.1],
          opacity: [0.3, 0.6, 0.3],
        }}
        transition={{
          duration: 2.5,
          ease: "easeInOut",
          repeat: Infinity,
          delay: 0.5,
        }}
      />
    </>
  );
}

// Pre-generated particle data for deterministic rendering
// Using seeded positions based on index for consistent results
const PARTICLE_DATA = Array.from({ length: 20 }, (_, i) => ({
  id: i,
  x: ((i * 17 + 7) % 100),           // Deterministic spread
  y: ((i * 23 + 13) % 100),          // Deterministic spread
  size: (i % 3) + 1.5,               // 1.5, 2.5, or 3.5
  duration: 2.5 + (i % 3) * 0.8,     // 2.5s, 3.3s, or 4.1s
  delay: (i * 0.15) % 2.5,           // Staggered delays
}));

// Animated background particles
function BackgroundParticles() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {PARTICLE_DATA.map((particle) => (
        <motion.div
          key={particle.id}
          className="absolute rounded-full"
          style={{
            left: `${particle.x}%`,
            top: `${particle.y}%`,
            width: particle.size,
            height: particle.size,
            background: colors.emerald.glow,
          }}
          animate={{
            opacity: [0, 0.6, 0],
            scale: [0, 1, 0],
            y: [0, -30, -60],
          }}
          transition={{
            duration: particle.duration,
            ease: "easeOut",
            repeat: Infinity,
            delay: particle.delay,
          }}
        />
      ))}
    </div>
  );
}

// Progress bar component
function ProgressBar() {
  return (
    <div className="w-48 h-1 bg-white/10 rounded-full overflow-hidden">
      <motion.div
        className="h-full rounded-full"
        style={{
          background: `linear-gradient(90deg, ${colors.emerald.darker}, ${colors.emerald.base}, ${colors.emerald.light})`,
          backgroundSize: '200% 100%',
        }}
        initial={{ width: '0%' }}
        animate={{ 
          width: ['0%', '70%', '85%', '95%'],
          backgroundPosition: ['0% 0%', '100% 0%'],
        }}
        transition={{
          width: {
            duration: 2.5,
            ease: "easeOut",
            repeat: Infinity,
            repeatDelay: 0.5,
          },
          backgroundPosition: {
            duration: 1.5,
            ease: "linear",
            repeat: Infinity,
          },
        }}
      />
    </div>
  );
}

export default function SessionOverlay({ isLoading, playSound = false }: SessionOverlayProps) {
  // Optional ambient sound cue on mount
  useEffect(() => {
    if (isLoading && playSound) {
      const audio = new Audio("/assets/login-chime.mp3");
      audio.volume = 0.2;
      audio.play().catch(() => {
        // Silently fail if audio cannot play (user hasn't interacted yet, autoplay policy, etc.)
      });
    }
  }, [isLoading, playSound]);

  // Check for reduced motion preference
  const prefersReducedMotion = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  return (
    <AnimatePresence mode="wait">
      {isLoading && (
        <motion.div
          key="session-overlay"
          className="fixed inset-0 flex flex-col items-center justify-center"
          style={{ zIndex: Z.modal,
            background: `linear-gradient(180deg, ${colors.background.start} 0%, ${colors.background.mid} 50%, ${colors.background.end} 100%)`,
          }}
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
        >
          {/* Animated background particles */}
          {!prefersReducedMotion && <BackgroundParticles />}

          {/* Radial spotlight effect */}
          <motion.div
            className="absolute pointer-events-none"
            style={{
              width: '600px',
              height: '600px',
              background: `radial-gradient(circle, ${colors.emerald.dark}08 0%, transparent 70%)`,
            }}
            animate={prefersReducedMotion ? {} : {
              scale: [1, 1.1, 1],
              opacity: [0.5, 0.8, 0.5],
            }}
            transition={{
              duration: 4,
              ease: "easeInOut",
              repeat: Infinity,
            }}
          />

          {/* Main content card with glassmorphism */}
          <motion.div
            className="relative flex flex-col items-center px-12 py-10 rounded-3xl"
            style={{
              background: 'rgba(255, 255, 255, 0.03)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: `1px solid ${colors.emerald.base}15`,
              boxShadow: `
                0 25px 50px -12px rgba(0, 0, 0, 0.5),
                0 0 0 1px ${colors.emerald.glow}10,
                inset 0 1px 0 0 rgba(255, 255, 255, 0.05)
              `,
            }}
            variants={contentVariants}
          >
            {/* Logo section with shimmer ring and breathing glow */}
            <motion.div 
              className="relative flex items-center justify-center mb-8"
              style={{ width: '160px', height: '160px' }}
              variants={logoVariants}
            >
              {/* Breathing glow behind logo */}
              {!prefersReducedMotion && <BreathingGlow />}

              {/* Shimmer ring around logo */}
              <div 
                className="absolute rounded-full"
                style={{
                  width: '140px',
                  height: '140px',
                  padding: '3px',
                }}
              >
                {!prefersReducedMotion && <ShimmerRing />}
              </div>

              {/* Logo container with subtle border */}
              <motion.div
                className="relative z-10 flex items-center justify-center rounded-full"
                style={{
                  width: '120px',
                  height: '120px',
                  background: `linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.02))`,
                  border: `1px solid ${colors.emerald.base}30`,
                  boxShadow: `0 8px 32px ${colors.emerald.dark}20`,
                }}
                animate={prefersReducedMotion ? {} : {
                  scale: [1, 1.02, 1],
                }}
                transition={{
                  duration: 2,
                  ease: "easeInOut",
                  repeat: Infinity,
                }}
              >
                <img
                  src={logo}
                  alt="ATTS Logo"
                  className="w-24 h-24 object-contain"
                  style={{
                    filter: 'drop-shadow(0 4px 12px rgba(16, 185, 129, 0.3))',
                  }}
                />
              </motion.div>
            </motion.div>

            {/* Loading text section */}
            <motion.div 
              className="text-center space-y-3 mb-6"
              variants={textVariants}
            >
              <motion.p
                className="text-xl font-semibold tracking-wide"
                style={{
                  background: `linear-gradient(135deg, #ffffff, ${colors.emerald.light})`,
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  textShadow: `0 0 40px ${colors.emerald.glow}40`,
                }}
                animate={prefersReducedMotion ? {} : {
                  opacity: [0.9, 1, 0.9],
                }}
                transition={{
                  duration: 2,
                  ease: "easeInOut",
                  repeat: Infinity,
                }}
              >
                Restoring your session...
              </motion.p>
              <p 
                className="text-sm font-light tracking-widest uppercase"
                style={{ color: `${colors.emerald.light}90` }}
              >
                All Terrain Tree Service
              </p>
            </motion.div>

            {/* Progress bar */}
            <motion.div variants={textVariants} className="mb-6">
              {!prefersReducedMotion ? <ProgressBar /> : (
                <div className="w-48 h-1 bg-white/20 rounded-full overflow-hidden">
                  <div 
                    className="h-full w-1/2 rounded-full"
                    style={{ background: colors.emerald.base }}
                  />
                </div>
              )}
            </motion.div>

            {/* Orbital dots spinner */}
            <motion.div
              className="relative flex items-center justify-center"
              style={{ width: '70px', height: '70px' }}
              variants={textVariants}
            >
              {!prefersReducedMotion ? (
                <>
                  {/* Center glow */}
                  <motion.div
                    className="absolute w-3 h-3 rounded-full"
                    style={{
                      background: colors.emerald.glow,
                      boxShadow: `0 0 12px ${colors.emerald.base}, 0 0 24px ${colors.emerald.glow}60`,
                    }}
                    animate={{
                      scale: [1, 1.3, 1],
                      opacity: [0.6, 1, 0.6],
                    }}
                    transition={{
                      duration: 1.5,
                      ease: "easeInOut",
                      repeat: Infinity,
                    }}
                  />
                  {/* Orbital dots */}
                  {[0, 1, 2, 3, 4].map((index) => (
                    <OrbitalDot key={index} index={index} total={5} />
                  ))}
                </>
              ) : (
                /* Static fallback for reduced motion */
                <div className="flex space-x-2">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="w-2 h-2 rounded-full"
                      style={{ background: colors.emerald.base }}
                    />
                  ))}
                </div>
              )}
            </motion.div>
          </motion.div>

          {/* Bottom brand watermark */}
          <motion.div
            className="absolute bottom-8 text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.4 }}
            transition={{ delay: 0.8, duration: 0.6 }}
          >
            <p 
              className="text-xs tracking-[0.3em] uppercase font-light"
              style={{ color: colors.emerald.light }}
            >
              Employee Portal
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
