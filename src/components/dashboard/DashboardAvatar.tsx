import { memo, useRef, useEffect, useState } from 'react';
import type { IconInteractionProps } from './ExpandableSection';
import {
  getDeviceCapabilities,
  getQualitySettings,
  observeIntersection,
} from '../../lib/mobilePerf';

export type AvatarVariant = 'announcements' | 'jobs' | 'tools';

interface DashboardAvatarProps extends IconInteractionProps {
  variant: AvatarVariant;
  className?: string;
}

// ATTS Brand Color Palette - Simplified for mobile-lite version
const colors = {
  emerald: {
    light: '#6ee7b7',
    base: '#10b981',
    dark: '#059669',
    glow: '#34d399',
  },
  safety: {
    orange: '#f97316',
    yellow: '#facc15',
  },
  skin: {
    base: '#e8b896',
    shadow: '#c99a6b',
  },
};

// Variant-specific colors for simplified avatar
const VARIANT_COLORS: Record<AvatarVariant, { primary: string; secondary: string; icon: string }> = {
  announcements: { primary: colors.emerald.base, secondary: colors.emerald.dark, icon: '#ffffff' },
  jobs: { primary: colors.safety.orange, secondary: '#ea580c', icon: '#ffffff' },
  tools: { primary: colors.emerald.base, secondary: colors.emerald.dark, icon: '#ffffff' },
};

/**
 * DashboardAvatar - Adaptive quality avatar component
 * 
 * Performance optimizations:
 * - Renders simplified version on mobile/low-end devices (no filters, fewer paths)
 * - Uses IntersectionObserver for lazy mounting
 * - Removes GPU-heavy SVG filters on constrained devices
 * - Provides placeholder during loading
 */
function DashboardAvatarComponent({ 
  variant, 
  className = '',
}: DashboardAvatarProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [hasRendered, setHasRendered] = useState(false);

  const caps = getDeviceCapabilities();
  const quality = getQualitySettings();

  // Lazy mount using IntersectionObserver
  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      // Schedule state update asynchronously to avoid synchronous setState in effect
      queueMicrotask(() => setIsVisible(true));
      return;
    }

    // If already rendered once, keep it rendered (avoid re-mounting)
    if (hasRendered) {
      queueMicrotask(() => setIsVisible(true));
      return;
    }

    const cleanup = observeIntersection(
      container,
      (intersecting) => {
        if (intersecting) {
          setIsVisible(true);
          setHasRendered(true);
        }
      },
      { rootMargin: '50px' }
    );

    return cleanup;
  }, [hasRendered]);

  // Determine which avatar to render based on device capabilities
  const useSimplifiedAvatar = !quality.enableComplexSVG || caps.isLowEnd || caps.prefersReducedMotion;

  return (
    <div
      ref={containerRef}
      className={`relative ${className}`}
      style={{
        // content-visibility for off-screen optimization (with Safari fallback via intersection observer)
        contentVisibility: 'auto',
        containIntrinsicSize: '64px 80px',
      }}
    >
      {/* Static ambient glow - simplified on mobile */}
      {quality.enableEffects && (
        <>
          <div
            className="absolute inset-[-35%] rounded-full pointer-events-none"
            style={{
              opacity: 0.35,
              background: `radial-gradient(circle at 50% 50%, ${colors.emerald.glow}50 0%, ${colors.emerald.base}25 35%, transparent 70%)`,
              filter: caps.isMobile ? undefined : 'blur(24px)',
            }}
          />
          {!caps.isMobile && (
            <div
              className="absolute inset-[-20%] rounded-full blur-xl pointer-events-none"
              style={{
                opacity: 0.3,
                background: `radial-gradient(circle at 50% 50%, ${colors.emerald.light}40 0%, transparent 55%)`,
              }}
            />
          )}
        </>
      )}

      {/* Render appropriate avatar based on visibility and device capability */}
      {isVisible ? (
        useSimplifiedAvatar ? (
          <SimplifiedAvatar variant={variant} />
        ) : (
          <FullAvatar variant={variant} />
        )
      ) : (
        <AvatarPlaceholder variant={variant} />
      )}
    </div>
  );
}

/**
 * Placeholder shown while avatar is lazy-loading
 */
function AvatarPlaceholder({ variant }: { variant: AvatarVariant }) {
  const variantColors = VARIANT_COLORS[variant];
  
  return (
    <div className="w-full h-full flex items-center justify-center">
      <svg viewBox="0 0 80 100" className="w-full h-full opacity-30">
        <ellipse cx="40" cy="50" rx="25" ry="35" fill={variantColors.primary} />
      </svg>
    </div>
  );
}

/**
 * Simplified avatar for mobile/low-end devices
 * Removes filters, complex gradients, and fine details
 * Maintains visual identity with fraction of the rendering cost
 */
function SimplifiedAvatar({ variant }: { variant: AvatarVariant }) {
  const id = `arborist-simple-${variant}`;
  const variantColors = VARIANT_COLORS[variant];

  return (
    <svg
      viewBox="0 0 80 100"
      className="w-full h-full relative z-10"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        {/* Minimal gradients for simplified version */}
        <linearGradient id={`${id}-skin`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#fcd9bd" />
          <stop offset="100%" stopColor={colors.skin.shadow} />
        </linearGradient>
        <linearGradient id={`${id}-hardhat`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#fde047" />
          <stop offset="100%" stopColor="#ca8a04" />
        </linearGradient>
        <linearGradient id={`${id}-vest`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={colors.safety.orange} />
          <stop offset="100%" stopColor="#c2410c" />
        </linearGradient>
        <linearGradient id={`${id}-accent`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={variantColors.primary} />
          <stop offset="100%" stopColor={variantColors.secondary} />
        </linearGradient>
      </defs>

      {/* Ground shadow - simple ellipse */}
      <ellipse cx="40" cy="97" rx="20" ry="3" fill="black" opacity="0.15" />

      {/* Legs - simplified */}
      <rect x="29" y="68" width="8" height="26" rx="3" fill="#4a4a4a" />
      <rect x="43" y="68" width="8" height="26" rx="3" fill="#4a4a4a" />

      {/* Body - simplified vest shape */}
      <path
        d="M 24 42 Q 20 48 22 68 L 58 68 Q 60 48 56 42 L 50 38 L 30 38 Z"
        fill={`url(#${id}-vest)`}
      />
      
      {/* Reflective stripes */}
      <rect x="26" y="50" width="8" height="2" rx="0.5" fill="#fefce8" />
      <rect x="26" y="56" width="8" height="2" rx="0.5" fill="#fefce8" />
      <rect x="46" y="50" width="8" height="2" rx="0.5" fill="#fefce8" />
      <rect x="46" y="56" width="8" height="2" rx="0.5" fill="#fefce8" />

      {/* Head - simplified */}
      <ellipse cx="40" cy="28" rx="13" ry="14" fill={`url(#${id}-skin)`} />

      {/* Eyes - simple */}
      <ellipse cx="35" cy="26" rx="3" ry="3.5" fill="white" />
      <ellipse cx="45" cy="26" rx="3" ry="3.5" fill="white" />
      <circle cx="35.5" cy="26.5" r="2" fill="#1a1a1a" />
      <circle cx="44.5" cy="26.5" r="2" fill="#1a1a1a" />
      <circle cx="35" cy="25.5" r="0.8" fill="white" />
      <circle cx="44" cy="25.5" r="0.8" fill="white" />

      {/* Smile */}
      <path d="M 35 33 Q 40 37 45 33" stroke="#9a6b4a" strokeWidth="1.5" fill="none" strokeLinecap="round" />

      {/* Hardhat - simplified */}
      <path
        d="M 22 20 Q 22 6 40 6 Q 58 6 58 20 L 56 24 Q 40 27 24 24 Z"
        fill={`url(#${id}-hardhat)`}
      />
      <path d="M 18 24 Q 18 20 24 20 L 56 20 Q 62 20 62 24 L 56 26 L 24 26 Z" fill={`url(#${id}-hardhat)`} />
      
      {/* ATTS text */}
      <text x="40" y="15" fontSize="4" fill="#166534" textAnchor="middle" fontWeight="bold">ATTS</text>

      {/* Variant-specific item - simplified */}
      {variant === 'announcements' && (
        <g transform="translate(56, 18) rotate(25)">
          <path d="M 0 0 L -5 8 Q -6 10 -4 11 L 8 14 Q 10 13 9 10 L 4 0 Z" fill={`url(#${id}-accent)`} />
        </g>
      )}
      {variant === 'jobs' && (
        <g transform="translate(58, 55)">
          <rect x="0" y="0" width="12" height="8" rx="1" fill={colors.safety.orange} />
          <rect x="12" y="2" width="8" height="4" fill="#9ca3af" />
        </g>
      )}
      {variant === 'tools' && (
        <g transform="translate(60, 15) rotate(25)">
          <rect x="-2" y="0" width="4" height="18" rx="1" fill="#9ca3af" />
          <path d="M -4 -2 Q -5 -5 -2 -6 L 2 -6 Q 5 -5 4 -2 L 2 0 L -2 0 Z" fill="#6b7280" />
        </g>
      )}

      {/* Gloves - simplified */}
      <ellipse cx="14" cy="66" rx="4" ry="3" fill={`url(#${id}-accent)`} />
      <ellipse cx="66" cy="30" rx="4" ry="3" fill={`url(#${id}-accent)`} />
    </svg>
  );
}

/**
 * Full-detail avatar for desktop/high-end devices
 * Contains all filters, gradients, and fine details
 */
function FullAvatar({ variant }: { variant: AvatarVariant }) {
  const id = `arborist-${variant}`;

  return (
    <svg
      viewBox="0 0 80 100"
      className="w-full h-full relative z-10"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        {/* === GRADIENT DEFINITIONS === */}
        
        {/* Skin gradients */}
        <linearGradient id={`${id}-skin`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#fcd9bd" />
          <stop offset="25%" stopColor="#e8b896" />
          <stop offset="50%" stopColor="#c99a6b" />
          <stop offset="75%" stopColor="#a67c52" />
          <stop offset="100%" stopColor="#a67c52" />
        </linearGradient>

        <radialGradient id={`${id}-skin-face`} cx="50%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#fcd9bd" />
          <stop offset="30%" stopColor="#e8b896" />
          <stop offset="60%" stopColor="#c99a6b" />
          <stop offset="100%" stopColor="#a67c52" />
        </radialGradient>

        {/* Hardhat gradients */}
        <linearGradient id={`${id}-hardhat`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#fef08a" />
          <stop offset="15%" stopColor="#fde047" />
          <stop offset="40%" stopColor="#facc15" />
          <stop offset="70%" stopColor="#e5b800" />
          <stop offset="100%" stopColor="#a68500" />
        </linearGradient>

        {/* Safety vest */}
        <linearGradient id={`${id}-vest`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#fb923c" />
          <stop offset="20%" stopColor="#f97316" />
          <stop offset="60%" stopColor="#ea580c" />
          <stop offset="100%" stopColor="#c2410c" />
        </linearGradient>

        <linearGradient id={`${id}-vest-stripe`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#fffef0" />
          <stop offset="50%" stopColor="#fefce8" />
          <stop offset="100%" stopColor="#fef08a" />
        </linearGradient>

        {/* Work shirt */}
        <linearGradient id={`${id}-shirt`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#e8dcc8" />
          <stop offset="30%" stopColor="#d6c4a8" />
          <stop offset="100%" stopColor="#b8a88c" />
        </linearGradient>

        {/* Pants */}
        <linearGradient id={`${id}-pants`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#5a5a5a" />
          <stop offset="100%" stopColor="#262626" />
        </linearGradient>

        {/* Metal */}
        <linearGradient id={`${id}-metal`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="40%" stopColor="#9ca3af" />
          <stop offset="100%" stopColor="#4b5563" />
        </linearGradient>

        {/* Emerald accent */}
        <linearGradient id={`${id}-emerald`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#6ee7b7" />
          <stop offset="40%" stopColor="#10b981" />
          <stop offset="100%" stopColor="#059669" />
        </linearGradient>

        {/* Leather */}
        <linearGradient id={`${id}-leather`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#92400e" />
          <stop offset="50%" stopColor="#78350f" />
          <stop offset="100%" stopColor="#451a03" />
        </linearGradient>

        {/* Iris */}
        <radialGradient id={`${id}-iris`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#1c1917" />
          <stop offset="60%" stopColor="#5c4033" />
          <stop offset="100%" stopColor="#3d2c1e" />
        </radialGradient>

        {/* Hair */}
        <linearGradient id={`${id}-hair`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#4a3728" />
          <stop offset="100%" stopColor="#2a1f15" />
        </linearGradient>

        {/* Simplified filters for better performance */}
        <filter id={`${id}-shadow`} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#000" floodOpacity="0.3" />
        </filter>
      </defs>

      {/* Ground shadow */}
      <ellipse cx="40" cy="97" rx="20" ry="3" fill="black" opacity="0.2" />

      {/* Legs */}
      <g>
        <path d="M 30 68 L 28 90 Q 28 94 32 94 L 36 94 Q 38 94 38 90 L 36 68" fill={`url(#${id}-pants)`} />
        <path d="M 26 87 Q 25 91 27 94 L 39 94 Q 41 91 39 87 Z" fill={`url(#${id}-leather)`} />
        <path d="M 44 68 L 42 90 Q 42 94 46 94 L 50 94 Q 52 94 52 90 L 50 68" fill={`url(#${id}-pants)`} />
        <path d="M 41 87 Q 40 91 42 94 L 53 94 Q 55 91 53 87 Z" fill={`url(#${id}-leather)`} />
      </g>

      {/* Torso */}
      <g>
        <path d="M 24 42 Q 20 45 20 52 L 20 68 Q 20 72 26 72 L 54 72 Q 60 72 60 68 L 60 52 Q 60 45 56 42 L 50 38 L 30 38 Z" fill={`url(#${id}-shirt)`} filter={`url(#${id}-shadow)`} />
        
        {/* Safety vest */}
        <path d="M 26 42 Q 24 46 24 52 L 24 65 Q 24 68 28 68 L 36 68 L 36 44 L 30 42 Z" fill={`url(#${id}-vest)`} />
        <path d="M 54 42 Q 56 46 56 52 L 56 65 Q 56 68 52 68 L 44 68 L 44 44 L 50 42 Z" fill={`url(#${id}-vest)`} />

        {/* Reflective stripes */}
        <rect x="26" y="48" width="8" height="2.5" rx="0.5" fill={`url(#${id}-vest-stripe)`} />
        <rect x="26" y="55" width="8" height="2.5" rx="0.5" fill={`url(#${id}-vest-stripe)`} />
        <rect x="46" y="48" width="8" height="2.5" rx="0.5" fill={`url(#${id}-vest-stripe)`} />
        <rect x="46" y="55" width="8" height="2.5" rx="0.5" fill={`url(#${id}-vest-stripe)`} />

        {/* Zipper */}
        <rect x="39" y="44" width="2" height="24" fill="#6b7280" />
        
        {/* Belt */}
        <rect x="24" y="66" width="32" height="4" rx="1" fill="#3d3832" />
        <rect x="37" y="65.5" width="6" height="5" rx="0.8" fill={`url(#${id}-metal)`} />
      </g>

      {/* Arms based on variant */}
      <g>
        {variant === 'announcements' && (
          <>
            {/* Left arm with clipboard */}
            <path d="M 20 44 Q 14 48 12 56 L 10 68 Q 10 70 12 70 L 16 68 Q 18 66 18 62 L 20 52 Q 22 48 20 44" fill={`url(#${id}-shirt)`} />
            <ellipse cx="13" cy="69" rx="4.5" ry="3.5" fill={`url(#${id}-emerald)`} />
            <g transform="translate(5, 61) rotate(-15)">
              <rect x="0" y="0" width="11" height="15" rx="1" fill="#6b635b" />
              <rect x="1" y="2" width="9" height="11" rx="0.5" fill="#fafaf9" />
            </g>
            
            {/* Right arm with megaphone */}
            <path d="M 60 44 Q 66 42 70 36 L 74 28 Q 76 26 74 24 L 70 26 Q 66 30 62 36 Q 58 42 60 44" fill={`url(#${id}-shirt)`} />
            <ellipse cx="73" cy="25" rx="4.5" ry="3.5" fill={`url(#${id}-emerald)`} />
            <path d="M 70 20 L 63 11 Q 61 9 62 6 L 77 2 Q 81 1 81 5 L 75 22 Q 73 24 70 22 Z" fill={`url(#${id}-emerald)`} />
          </>
        )}

        {variant === 'jobs' && (
          <>
            {/* Left arm with rope */}
            <path d="M 20 44 Q 14 48 14 56 L 14 66 Q 14 68 16 68 L 20 66 Q 22 64 22 60 L 22 50 Q 22 46 20 44" fill={`url(#${id}-shirt)`} />
            <ellipse cx="17" cy="68" rx="4.5" ry="3.5" fill={`url(#${id}-leather)`} />
            <g transform="translate(9, 57)">
              <ellipse cx="4" cy="3" rx="5" ry="3" fill="none" stroke="#a3a3a3" strokeWidth="2" />
            </g>
            
            {/* Right arm with chainsaw */}
            <path d="M 60 44 Q 66 46 68 52 L 68 64 Q 68 66 66 66 L 62 64 Q 60 62 60 58 L 60 48 Q 60 46 60 44" fill={`url(#${id}-shirt)`} />
            <ellipse cx="65" cy="66" rx="4.5" ry="3.5" fill={`url(#${id}-leather)`} />
            <g>
              <rect x="61" y="55" width="18" height="12" rx="2" fill="#f97316" />
              <rect x="79" y="58.5" width="14" height="5" rx="0.5" fill={`url(#${id}-metal)`} />
            </g>
          </>
        )}

        {variant === 'tools' && (
          <>
            {/* Left arm with toolbox */}
            <path d="M 20 44 Q 14 48 12 56 L 8 68 Q 8 70 10 70 L 14 68 Q 16 66 18 60 L 20 50 Q 22 46 20 44" fill={`url(#${id}-shirt)`} />
            <ellipse cx="10" cy="70" rx="4.5" ry="3.5" fill={`url(#${id}-emerald)`} />
            <g transform="translate(-1, 61)">
              <rect x="2" y="0" width="16" height="12" rx="1.5" fill="#dc2626" />
              <path d="M 6 0 Q 6 -3 10 -3 Q 14 -3 14 0" stroke="#1c1917" strokeWidth="2" fill="none" />
            </g>
            
            {/* Right arm with wrench */}
            <path d="M 60 44 Q 66 42 68 36 L 70 28 Q 70 26 68 26 L 64 28 Q 62 32 62 38 Q 60 44 60 44" fill={`url(#${id}-shirt)`} />
            <ellipse cx="68" cy="27" rx="4.5" ry="3.5" fill={`url(#${id}-emerald)`} />
            <g transform="translate(64, 6) rotate(25)">
              <rect x="-2" y="0" width="4" height="20" rx="1" fill={`url(#${id}-metal)`} />
              <path d="M -5 -2 Q -6 -5 -3 -7 L 3 -7 Q 6 -5 5 -2 L 3 0 L -3 0 Z" fill="#6b7280" />
            </g>
          </>
        )}
      </g>

      {/* Head */}
      <g>
        <ellipse cx="40" cy="40" rx="6" ry="4" fill={`url(#${id}-skin)`} />
        <ellipse cx="40" cy="28" rx="14" ry="16" fill={`url(#${id}-skin-face)`} />
        
        {/* Ears */}
        <ellipse cx="26" cy="28" rx="3" ry="4.5" fill="#e8b896" />
        <ellipse cx="54" cy="28" rx="3" ry="4.5" fill="#e8b896" />

        {/* Hair hints */}
        <path d="M 24 23 Q 23 21 24 18" stroke={`url(#${id}-hair)`} strokeWidth="1" fill="none" />
        <path d="M 56 23 Q 57 21 56 18" stroke={`url(#${id}-hair)`} strokeWidth="1" fill="none" />

        {/* Eyebrows */}
        <path d="M 31 20 Q 35 17.5 39 20" stroke="#4a3728" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        <path d="M 41 20 Q 45 17.5 49 20" stroke="#4a3728" strokeWidth="1.5" fill="none" strokeLinecap="round" />

        {/* Eyes */}
        <ellipse cx="35" cy="25" rx="4.5" ry="5" fill="white" />
        <ellipse cx="36" cy="25.5" rx="2.8" ry="3.2" fill={`url(#${id}-iris)`} />
        <ellipse cx="36" cy="26" rx="1.5" ry="2" fill="#0f0f0f" />
        <circle cx="34.5" cy="24" r="1.2" fill="white" />
        
        <ellipse cx="45" cy="25" rx="4.5" ry="5" fill="white" />
        <ellipse cx="44" cy="25.5" rx="2.8" ry="3.2" fill={`url(#${id}-iris)`} />
        <ellipse cx="44" cy="26" rx="1.5" ry="2" fill="#0f0f0f" />
        <circle cx="43" cy="24" r="1.2" fill="white" />

        {/* Nose */}
        <ellipse cx="40" cy="30" rx="2.5" ry="2" fill="#c99a6b" opacity="0.4" />

        {/* Mouth */}
        <path d="M 34 34 Q 40 39 46 34" stroke="#9a6b4a" strokeWidth="1.8" strokeLinecap="round" fill="none" />
        <path d="M 36 34.5 Q 40 37 44 34.5" fill="white" opacity="0.85" />

        {/* Hardhat */}
        <path d="M 21 20 Q 21 4 40 4 Q 59 4 59 20 L 57 24 Q 40 27 23 24 Z" fill={`url(#${id}-hardhat)`} />
        <path d="M 17 24 Q 17 19 23 19 L 57 19 Q 63 19 63 24 Q 63 29 57 26 L 23 26 Q 17 29 17 24" fill={`url(#${id}-hardhat)`} />
        <rect x="35" y="19" width="10" height="4" rx="1.5" fill="#6b7280" />
        
        {/* ATTS text */}
        <text x="40" y="15" fontSize="4.5" fill="#166534" textAnchor="middle" fontWeight="bold">ATTS</text>

        {/* Safety glasses (not jobs variant) */}
        {variant !== 'jobs' && (
          <g>
            <path d="M 27 17 L 53 17" stroke="#059669" strokeWidth="1.5" />
            <ellipse cx="32" cy="17.5" rx="6" ry="2.5" fill="#10b981" opacity="0.25" stroke="#059669" strokeWidth="0.8" />
            <ellipse cx="48" cy="17.5" rx="6" ry="2.5" fill="#10b981" opacity="0.25" stroke="#059669" strokeWidth="0.8" />
          </g>
        )}

        {/* Visor for jobs variant */}
        {variant === 'jobs' && (
          <path d="M 25 21 Q 25 14 40 14 Q 55 14 55 21 L 53 26 Q 40 29 27 26 Z" fill="#059669" opacity="0.35" />
        )}
      </g>
    </svg>
  );
}

export const DashboardAvatar = memo(DashboardAvatarComponent);
export default DashboardAvatar;
