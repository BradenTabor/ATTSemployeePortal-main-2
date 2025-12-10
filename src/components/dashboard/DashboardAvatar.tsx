import { memo, useRef } from 'react';
import type { IconInteractionProps } from './ExpandableSection';

export type AvatarVariant = 'announcements' | 'jobs' | 'tools';

interface DashboardAvatarProps extends IconInteractionProps {
  variant: AvatarVariant;
  className?: string;
}

// ATTS Brand Color Palette - Enhanced with SSS and material-specific colors
const colors = {
  // Primary emerald theme
  emerald: {
    light: '#6ee7b7',
    base: '#10b981',
    dark: '#059669',
    darker: '#047857',
    glow: '#34d399',
  },
  // Safety colors
  safety: {
    orange: '#f97316',
    orangeLight: '#fb923c',
    orangeDark: '#ea580c',
    orangeDeep: '#c2410c',
    yellow: '#facc15',
    yellowLight: '#fde047',
    yellowBright: '#fef08a',
  },
  // Forest/Nature
  forest: {
    light: '#22c55e',
    base: '#166534',
    dark: '#14532d',
  },
  // Skin tones with SSS undertones
  skin: {
    highlight: '#fcd9bd',
    base: '#e8b896',
    shadow: '#c99a6b',
    deep: '#a67c52',
    // SSS colors - warm blood/translucency undertones
    sssWarm: '#ffb8a8',
    sssRed: '#e8a090',
    sssPink: '#f0c8c0',
  },
  // Materials - Enhanced
  metal: {
    light: '#e5e7eb',
    base: '#9ca3af',
    dark: '#6b7280',
    darker: '#4b5563',
    highlight: '#ffffff',
    reflection: '#f8fafc',
  },
  plastic: {
    highlight: '#fefefe',
    base: '#f3f4f6',
    shine: '#ffffff',
  },
  fabric: {
    vestGreen: '#16a34a',
    vestGreenDark: '#15803d',
    shirtTan: '#d6c4a8',
    shirtTanDark: '#b8a88c',
    shirtTanLight: '#e8dcc8',
  },
  // Leather for boots/gloves
  leather: {
    light: '#92400e',
    base: '#78350f',
    dark: '#451a03',
  },
};

function DashboardAvatarComponent({ 
  variant, 
  className = '',
}: DashboardAvatarProps) {
  const id = `arborist-${variant}`;
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={containerRef}
      className={`relative ${className}`}
    >
      {/* Static ambient glow */}
      <div
        className="absolute inset-[-35%] rounded-full blur-3xl pointer-events-none"
        style={{
          opacity: 0.45,
          background: `radial-gradient(circle at 50% 50%, ${colors.emerald.glow}60 0%, ${colors.emerald.base}35 35%, transparent 70%)`,
        }}
      />
      <div
        className="absolute inset-[-20%] rounded-full blur-xl pointer-events-none"
        style={{
          opacity: 0.35,
          background: `radial-gradient(circle at 50% 50%, ${colors.emerald.light}50 0%, transparent 55%)`,
        }}
      />
      
      {/* Static rim lighting layer */}
      <div
        className="absolute inset-[-5%] rounded-full pointer-events-none"
        style={{
          opacity: 0.25,
          background: `conic-gradient(from 90deg at 50% 50%, transparent 0deg, ${colors.emerald.light}40 90deg, transparent 180deg, ${colors.emerald.glow}30 270deg, transparent 360deg)`,
          filter: 'blur(8px)',
        }}
      />

      <div>
        <svg
          viewBox="0 0 80 100"
          className="w-full h-full relative z-10"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            {/* === GRADIENT DEFINITIONS === */}
            
            {/* Skin gradients with SSS simulation */}
            <linearGradient id={`${id}-skin`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={colors.skin.highlight} />
              <stop offset="25%" stopColor={colors.skin.base} />
              <stop offset="50%" stopColor={colors.skin.shadow} />
              <stop offset="75%" stopColor={colors.skin.deep} />
              <stop offset="100%" stopColor={colors.skin.deep} />
            </linearGradient>

            <radialGradient id={`${id}-skin-face`} cx="50%" cy="35%" r="65%">
              <stop offset="0%" stopColor={colors.skin.highlight} />
              <stop offset="30%" stopColor={colors.skin.base} />
              <stop offset="60%" stopColor={colors.skin.shadow} />
              <stop offset="100%" stopColor={colors.skin.deep} />
            </radialGradient>

            {/* SSS warm undertone gradient */}
            <radialGradient id={`${id}-skin-sss`} cx="50%" cy="40%" r="50%">
              <stop offset="0%" stopColor={colors.skin.sssWarm} stopOpacity="0.4" />
              <stop offset="50%" stopColor={colors.skin.sssRed} stopOpacity="0.2" />
              <stop offset="100%" stopColor={colors.skin.sssPink} stopOpacity="0" />
            </radialGradient>

            {/* Cheek blush gradient */}
            <radialGradient id={`${id}-cheek-blush`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#f0a0a0" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#f0a0a0" stopOpacity="0" />
            </radialGradient>

            {/* Enhanced hardhat gradients with better plastic simulation */}
            <linearGradient id={`${id}-hardhat`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={colors.safety.yellowBright} />
              <stop offset="15%" stopColor={colors.safety.yellowLight} />
              <stop offset="40%" stopColor={colors.safety.yellow} />
              <stop offset="70%" stopColor="#e5b800" />
              <stop offset="90%" stopColor="#c9a000" />
              <stop offset="100%" stopColor="#a68500" />
            </linearGradient>

            <linearGradient id={`${id}-hardhat-shine`} x1="20%" y1="0%" x2="80%" y2="100%">
              <stop offset="0%" stopColor="white" stopOpacity="0.9" />
              <stop offset="20%" stopColor="white" stopOpacity="0.5" />
              <stop offset="50%" stopColor="white" stopOpacity="0.1" />
              <stop offset="100%" stopColor="white" stopOpacity="0" />
            </linearGradient>

            {/* Fresnel rim highlight for hardhat */}
            <radialGradient id={`${id}-hardhat-fresnel`} cx="50%" cy="0%" r="100%">
              <stop offset="70%" stopColor="transparent" />
              <stop offset="95%" stopColor={colors.safety.yellowBright} stopOpacity="0.8" />
              <stop offset="100%" stopColor="white" stopOpacity="0.4" />
            </radialGradient>

            {/* Enhanced safety vest with fabric texture simulation */}
            <linearGradient id={`${id}-vest`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={colors.safety.orangeLight} />
              <stop offset="20%" stopColor={colors.safety.orange} />
              <stop offset="60%" stopColor={colors.safety.orangeDark} />
              <stop offset="100%" stopColor={colors.safety.orangeDeep} />
            </linearGradient>

            <linearGradient id={`${id}-vest-highlight`} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="white" stopOpacity="0.15" />
              <stop offset="50%" stopColor="white" stopOpacity="0.05" />
              <stop offset="100%" stopColor="white" stopOpacity="0" />
            </linearGradient>

            <linearGradient id={`${id}-vest-stripe`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#fffef0" />
              <stop offset="30%" stopColor="#fefce8" />
              <stop offset="70%" stopColor="#fef9c3" />
              <stop offset="100%" stopColor="#fef08a" />
            </linearGradient>

            {/* Enhanced work shirt gradients */}
            <linearGradient id={`${id}-shirt`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={colors.fabric.shirtTanLight} />
              <stop offset="30%" stopColor={colors.fabric.shirtTan} />
              <stop offset="100%" stopColor={colors.fabric.shirtTanDark} />
            </linearGradient>

            {/* Pants gradient with depth */}
            <linearGradient id={`${id}-pants`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#5a5a5a" />
              <stop offset="30%" stopColor="#4a4a4a" />
              <stop offset="70%" stopColor="#3a3a3a" />
              <stop offset="100%" stopColor="#262626" />
            </linearGradient>

            {/* Enhanced metal gradients with anisotropic highlights */}
            <linearGradient id={`${id}-metal`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={colors.metal.highlight} />
              <stop offset="15%" stopColor={colors.metal.light} />
              <stop offset="40%" stopColor={colors.metal.base} />
              <stop offset="70%" stopColor={colors.metal.dark} />
              <stop offset="100%" stopColor={colors.metal.darker} />
            </linearGradient>

            <linearGradient id={`${id}-metal-aniso`} x1="0%" y1="50%" x2="100%" y2="50%">
              <stop offset="0%" stopColor={colors.metal.darker} />
              <stop offset="20%" stopColor={colors.metal.light} />
              <stop offset="40%" stopColor={colors.metal.highlight} />
              <stop offset="60%" stopColor={colors.metal.light} />
              <stop offset="80%" stopColor={colors.metal.dark} />
              <stop offset="100%" stopColor={colors.metal.darker} />
            </linearGradient>

            {/* Metal fresnel edge reflection */}
            <radialGradient id={`${id}-metal-fresnel`} cx="50%" cy="50%" r="50%">
              <stop offset="60%" stopColor="transparent" />
              <stop offset="90%" stopColor={colors.metal.reflection} stopOpacity="0.5" />
              <stop offset="100%" stopColor="white" stopOpacity="0.8" />
            </radialGradient>

            {/* Emerald accent gradient - enhanced */}
            <linearGradient id={`${id}-emerald`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={colors.emerald.light} />
              <stop offset="40%" stopColor={colors.emerald.base} />
              <stop offset="100%" stopColor={colors.emerald.dark} />
            </linearGradient>

            {/* Iris texture gradient */}
            <radialGradient id={`${id}-iris`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#1c1917" />
              <stop offset="30%" stopColor="#3d2c1e" />
              <stop offset="60%" stopColor="#5c4033" />
              <stop offset="80%" stopColor="#4a3428" />
              <stop offset="100%" stopColor="#3d2c1e" />
            </radialGradient>

            {/* Leather gradient for boots/gloves */}
            <linearGradient id={`${id}-leather`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={colors.leather.light} />
              <stop offset="50%" stopColor={colors.leather.base} />
              <stop offset="100%" stopColor={colors.leather.dark} />
            </linearGradient>

            {/* === FILTER DEFINITIONS === */}
            
            {/* Subsurface Scattering filter for skin */}
            <filter id={`${id}-sss`} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur" />
              <feColorMatrix in="blur" type="matrix" result="warmBlur"
                values="1.2 0.1 0 0 0.1
                        0.1 0.8 0 0 0
                        0 0 0.7 0 0
                        0 0 0 0.4 0" />
              <feMerge>
                <feMergeNode in="warmBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            {/* Enhanced fabric texture with displacement */}
            <filter id={`${id}-fabric-texture`} x="-10%" y="-10%" width="120%" height="120%">
              <feTurbulence type="fractalNoise" baseFrequency="0.08 0.04" numOctaves="4" result="weave" seed="42" />
              <feDisplacementMap in="SourceGraphic" in2="weave" scale="0.8" xChannelSelector="R" yChannelSelector="G" result="displaced" />
              <feGaussianBlur in="displaced" stdDeviation="0.2" result="smoothed" />
              <feMerge>
                <feMergeNode in="smoothed" />
              </feMerge>
            </filter>

            {/* Enhanced metal specular with multiple light sources */}
            <filter id={`${id}-metal-specular`} x="-30%" y="-30%" width="160%" height="160%">
              <feSpecularLighting surfaceScale="3" specularConstant="1.5" specularExponent="40" lightingColor="white" result="spec1">
                <fePointLight x="30" y="5" z="40" />
              </feSpecularLighting>
              <feSpecularLighting surfaceScale="2" specularConstant="0.8" specularExponent="25" lightingColor="#e0f2f1" result="spec2">
                <fePointLight x="60" y="20" z="30" />
              </feSpecularLighting>
              <feComposite in="spec1" in2="spec2" operator="arithmetic" k1="0" k2="0.6" k3="0.4" k4="0" result="combinedSpec" />
              <feComposite in="combinedSpec" in2="SourceAlpha" operator="in" result="specMasked" />
              <feComposite in="SourceGraphic" in2="specMasked" operator="arithmetic" k1="0" k2="1" k3="0.8" k4="0" />
            </filter>

            {/* Main drop shadow - enhanced */}
            <filter id={`${id}-shadow`} x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#000" floodOpacity="0.4" />
              <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#000" floodOpacity="0.2" />
              <feDropShadow dx="0" dy="1" stdDeviation="0.5" floodColor="#000" floodOpacity="0.1" />
            </filter>

            {/* Soft shadow for depth */}
            <filter id={`${id}-soft-shadow`} x="-25%" y="-25%" width="150%" height="150%">
              <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#000" floodOpacity="0.3" />
              <feDropShadow dx="0" dy="1" stdDeviation="1" floodColor="#000" floodOpacity="0.15" />
            </filter>

            {/* Contact shadow - very soft, close */}
            <filter id={`${id}-contact-shadow`} x="-15%" y="-15%" width="130%" height="130%">
              <feGaussianBlur in="SourceAlpha" stdDeviation="0.5" result="blur" />
              <feOffset in="blur" dy="0.5" result="offset" />
              <feFlood floodColor="#000" floodOpacity="0.4" />
              <feComposite in2="offset" operator="in" />
              <feMerge>
                <feMergeNode />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            {/* Enhanced glow effect */}
            <filter id={`${id}-glow`} x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="3" result="blur1" />
              <feGaussianBlur stdDeviation="1.5" result="blur2" />
              <feMerge>
                <feMergeNode in="blur1" />
                <feMergeNode in="blur2" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            {/* Emerald rim glow */}
            <filter id={`${id}-rim-glow`} x="-50%" y="-50%" width="200%" height="200%">
              <feMorphology in="SourceAlpha" operator="dilate" radius="0.5" result="dilated" />
              <feGaussianBlur in="dilated" stdDeviation="1.5" result="blurred" />
              <feFlood floodColor={colors.emerald.light} floodOpacity="0.6" />
              <feComposite in2="blurred" operator="in" result="glow" />
              <feMerge>
                <feMergeNode in="glow" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            {/* Enhanced ambient occlusion */}
            <filter id={`${id}-ao`} x="-15%" y="-15%" width="130%" height="130%">
              <feGaussianBlur in="SourceAlpha" stdDeviation="1.5" result="blur" />
              <feOffset in="blur" dy="1.5" result="offsetBlur" />
              <feFlood floodColor="#000" floodOpacity="0.3" />
              <feComposite in2="offsetBlur" operator="in" />
              <feMerge>
                <feMergeNode />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            {/* Plastic specular for hardhat */}
            <filter id={`${id}-plastic-spec`} x="-30%" y="-30%" width="160%" height="160%">
              <feSpecularLighting surfaceScale="4" specularConstant="2" specularExponent="50" lightingColor="white" result="spec">
                <fePointLight x="35" y="0" z="50" />
              </feSpecularLighting>
              <feComposite in="spec" in2="SourceAlpha" operator="in" result="specMask" />
              <feComposite in="SourceGraphic" in2="specMask" operator="arithmetic" k1="0" k2="1" k3="0.4" k4="0" />
            </filter>

            {/* Fresnel edge effect */}
            <radialGradient id={`${id}-fresnel-edge`} cx="50%" cy="30%" r="80%">
              <stop offset="50%" stopColor="transparent" />
              <stop offset="85%" stopColor={colors.emerald.light} stopOpacity="0.3" />
              <stop offset="95%" stopColor={colors.emerald.glow} stopOpacity="0.5" />
              <stop offset="100%" stopColor="white" stopOpacity="0.2" />
            </radialGradient>
            
            {/* Hair strand gradient */}
            <linearGradient id={`${id}-hair`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#4a3728" />
              <stop offset="40%" stopColor="#3d2c1e" />
              <stop offset="100%" stopColor="#2a1f15" />
            </linearGradient>
          </defs>

          {/* === GROUND SHADOW === */}
          <ellipse cx="40" cy="98" rx="24" ry="4" fill="black" opacity="0.15" />
          <ellipse cx="40" cy="97" rx="18" ry="2.5" fill="black" opacity="0.25" />

          {/* === LAYER 1: LEGS === */}
          <g>
            {/* Left leg */}
            <path
              d="M 30 68 L 28 90 Q 28 94 32 94 L 36 94 Q 38 94 38 90 L 36 68"
              fill={`url(#${id}-pants)`}
              filter={`url(#${id}-soft-shadow)`}
            />
            <line x1="32" y1="70" x2="31" y2="88" stroke="#333" strokeWidth="0.3" opacity="0.4" />
            
            {/* Left boot */}
            <path
              d="M 26 87 Q 25 91 27 94 L 39 94 Q 41 91 39 87 L 37 87 Q 35 89 33 89 Q 31 89 29 87 Z"
              fill={`url(#${id}-leather)`}
              filter={`url(#${id}-contact-shadow)`}
            />
            <path d="M 27 93 L 39 93 L 39 95 L 27 95 Z" fill="#0f0f0f" />
            <ellipse cx="33" cy="89" rx="3" ry="1" fill="white" opacity="0.1" />
            <line x1="33" y1="87" x2="33" y2="90" stroke="#1a1a1a" strokeWidth="0.5" />

            {/* Right leg */}
            <path
              d="M 44 68 L 42 90 Q 42 94 46 94 L 50 94 Q 52 94 52 90 L 50 68"
              fill={`url(#${id}-pants)`}
              filter={`url(#${id}-soft-shadow)`}
            />
            <line x1="48" y1="70" x2="49" y2="88" stroke="#333" strokeWidth="0.3" opacity="0.4" />
            
            {/* Right boot */}
            <path
              d="M 41 87 Q 40 91 42 94 L 53 94 Q 55 91 53 87 L 51 87 Q 49 89 47 89 Q 45 89 43 87 Z"
              fill={`url(#${id}-leather)`}
              filter={`url(#${id}-contact-shadow)`}
            />
            <path d="M 42 93 L 53 93 L 53 95 L 42 95 Z" fill="#0f0f0f" />
            <ellipse cx="47" cy="89" rx="3" ry="1" fill="white" opacity="0.1" />
            <line x1="47" y1="87" x2="47" y2="90" stroke="#1a1a1a" strokeWidth="0.5" />
          </g>

          {/* === LAYER 2: TORSO === */}
          <g>
            <g>
              {/* Work shirt base */}
              <path
                d="M 24 42 Q 20 45 20 52 L 20 68 Q 20 72 26 72 L 54 72 Q 60 72 60 68 L 60 52 Q 60 45 56 42 L 50 38 L 30 38 Z"
                fill={`url(#${id}-shirt)`}
                filter={`url(#${id}-shadow)`}
              />
              <path
                d="M 24 42 Q 20 45 20 52 L 20 55 Q 30 52 40 55 Q 50 52 60 55 L 60 52 Q 60 45 56 42 L 50 38 L 30 38 Z"
                fill="white"
                opacity="0.08"
              />
              <path d="M 30 38 Q 35 40 40 38 Q 45 40 50 38" stroke={colors.fabric.shirtTanDark} strokeWidth="1" fill="none" opacity="0.5" />

              {/* Safety vest */}
              <g filter={`url(#${id}-fabric-texture)`}>
                <path
                  d="M 26 42 Q 24 46 24 52 L 24 65 Q 24 68 28 68 L 36 68 L 36 44 L 30 42 Z"
                  fill={`url(#${id}-vest)`}
                  filter={`url(#${id}-ao)`}
                />
                <path
                  d="M 26 42 Q 24 46 24 52 L 24 50 L 30 48 L 36 50 L 36 44 L 30 42 Z"
                  fill={`url(#${id}-vest-highlight)`}
                />
                <path
                  d="M 54 42 Q 56 46 56 52 L 56 65 Q 56 68 52 68 L 44 68 L 44 44 L 50 42 Z"
                  fill={`url(#${id}-vest)`}
                  filter={`url(#${id}-ao)`}
                />
                <path
                  d="M 54 42 Q 56 46 56 52 L 56 50 L 50 48 L 44 50 L 44 44 L 50 42 Z"
                  fill={`url(#${id}-vest-highlight)`}
                />
              </g>

              {/* Stitching details */}
              <g stroke="#b85c1f" strokeWidth="0.2" strokeDasharray="1,1" opacity="0.6">
                <path d="M 26 44 L 26 66" />
                <path d="M 35 44 L 35 66" />
                <path d="M 45 44 L 45 66" />
                <path d="M 54 44 L 54 66" />
              </g>

              {/* Reflective stripes */}
              <g filter={`url(#${id}-glow)`}>
                <rect x="26" y="48" width="8" height="2.5" rx="0.5" fill={`url(#${id}-vest-stripe)`} />
                <rect x="26" y="48" width="8" height="1" rx="0.3" fill="white" opacity="0.5" />
                <rect x="26" y="55" width="8" height="2.5" rx="0.5" fill={`url(#${id}-vest-stripe)`} />
                <rect x="26" y="55" width="8" height="1" rx="0.3" fill="white" opacity="0.5" />
                <rect x="46" y="48" width="8" height="2.5" rx="0.5" fill={`url(#${id}-vest-stripe)`} />
                <rect x="46" y="48" width="8" height="1" rx="0.3" fill="white" opacity="0.5" />
                <rect x="46" y="55" width="8" height="2.5" rx="0.5" fill={`url(#${id}-vest-stripe)`} />
                <rect x="46" y="55" width="8" height="1" rx="0.3" fill="white" opacity="0.5" />
              </g>

              {/* Zipper */}
              <rect x="39" y="44" width="2" height="24" fill={colors.metal.dark} />
              <g>
                {[...Array(8)].map((_, i) => (
                  <rect key={i} x="39.3" y={45 + i * 3} width="1.4" height="2" rx="0.2" fill={colors.metal.base} />
                ))}
              </g>
              <rect x="39" y="62" width="2.5" height="3" rx="0.5" fill={colors.metal.light} />

              {/* ATTS Badge */}
              <g filter={`url(#${id}-glow)`}>
                <ellipse cx="30" cy="46" rx="3.5" ry="3" fill={colors.emerald.base} />
                <ellipse cx="30" cy="45.5" rx="2.5" ry="2" fill={colors.emerald.dark} />
                <text x="30" y="46.5" fontSize="2.5" fill="white" textAnchor="middle" fontWeight="bold">A</text>
                <ellipse cx="29" cy="44.5" rx="1" ry="0.5" fill="white" opacity="0.4" />
              </g>

              {/* Belt */}
              <rect x="24" y="66" width="32" height="4" rx="1" fill="#3d3832" />
              <rect x="24" y="66" width="32" height="1.5" rx="0.5" fill="#524a42" />
              {[...Array(5)].map((_, i) => (
                <circle key={i} cx={28 + i * 6} cy="68" r="0.8" fill="#2a2520" />
              ))}
              <rect x="37" y="65.5" width="6" height="5" rx="0.8" fill={`url(#${id}-metal-aniso)`} filter={`url(#${id}-metal-specular)`} />
              <rect x="38.5" y="67" width="3" height="2" rx="0.3" fill={colors.metal.darker} />
            </g>
          </g>

          {/* === ARMS (Variant-specific) === */}
          <g>
            <g>
              {variant === 'announcements' && (
                <>
                  {/* Left arm */}
                  <g>
                    <path
                      d="M 20 44 Q 14 48 12 56 L 10 68 Q 10 70 12 70 L 16 68 Q 18 66 18 62 L 20 52 Q 22 48 20 44"
                      fill={`url(#${id}-shirt)`}
                      filter={`url(#${id}-soft-shadow)`}
                    />
                    <ellipse cx="14" cy="67" rx="4" ry="2" fill={colors.fabric.shirtTanDark} />
                    <ellipse cx="13" cy="69" rx="4.5" ry="3.5" fill={colors.emerald.dark} filter={`url(#${id}-contact-shadow)`} />
                    <ellipse cx="12.5" cy="68" rx="2" ry="1" fill={colors.emerald.base} opacity="0.4" />
                    <path d="M 10 69 Q 13 71 16 69" stroke={colors.emerald.darker} strokeWidth="0.3" fill="none" />

                    {/* Clipboard */}
                    <g transform="translate(5, 61) rotate(-15)" filter={`url(#${id}-shadow)`}>
                      <rect x="0" y="0" width="11" height="15" rx="1" fill="#6b635b" />
                      <rect x="0.5" y="0.5" width="10" height="14" rx="0.8" fill="#78716c" />
                      <rect x="3" y="-2.5" width="5" height="4" rx="0.5" fill={`url(#${id}-metal-aniso)`} />
                      <rect x="4" y="-1.5" width="3" height="2" rx="0.3" fill={colors.metal.darker} />
                      <rect x="1" y="2" width="9" height="11" rx="0.5" fill="#fafaf9" />
                      <rect x="1" y="2" width="9" height="2" fill="#f5f5f4" />
                      {[...Array(4)].map((_, i) => (
                        <line key={i} x1="2" y1={4 + i * 2} x2={i === 3 ? 6 : 9} y2={4 + i * 2} stroke={colors.emerald.base} strokeWidth="0.5" />
                      ))}
                      <path d="M 7 5 L 8 6 L 9.5 3.5" stroke={colors.emerald.dark} strokeWidth="0.5" fill="none" />
                    </g>
                  </g>

                  {/* Right arm (megaphone) */}
                  <g>
                    <g>
                      <path
                        d="M 60 44 Q 66 42 70 36 L 74 28 Q 76 26 74 24 L 70 26 Q 66 30 62 36 Q 58 42 60 44"
                        fill={`url(#${id}-shirt)`}
                        filter={`url(#${id}-soft-shadow)`}
                      />
                      <ellipse cx="72" cy="26" rx="3" ry="2" fill={colors.fabric.shirtTanDark} />
                      <ellipse cx="73" cy="25" rx="4.5" ry="3.5" fill={colors.emerald.dark} filter={`url(#${id}-contact-shadow)`} />
                      <ellipse cx="72.5" cy="24" rx="2" ry="1" fill={colors.emerald.base} opacity="0.4" />

                      {/* Megaphone */}
                      <g filter={`url(#${id}-glow)`}>
                        <path
                          d="M 70 20 L 63 11 Q 61 9 62 6 L 77 2 Q 81 1 81 5 L 75 22 Q 73 24 70 22 Z"
                          fill={`url(#${id}-emerald)`}
                          stroke={colors.emerald.dark}
                          strokeWidth="0.5"
                        />
                        <path
                          d="M 71 18 L 65 11 Q 64 10 65 8 L 76 5 Q 78 4 78 6 L 73 19 Z"
                          fill={colors.emerald.dark}
                        />
                        <ellipse cx="70" cy="6" rx="7" ry="3.5" fill={colors.emerald.darker} opacity="0.6" />
                        <ellipse cx="70" cy="6" rx="5" ry="2.5" fill="#1a1a1a" opacity="0.3" />
                        <rect x="68" y="18" width="4" height="4" rx="1" fill={colors.emerald.darker} />
                        <path d="M 64 8 Q 68 6 74 4" stroke="white" strokeWidth="0.8" opacity="0.4" strokeLinecap="round" />
                        
                        {/* Static sound waves */}
                        <g opacity="0.6">
                          <path 
                            d="M 80 3 Q 85 7 80 13" 
                            stroke={colors.emerald.light} 
                            strokeWidth={1.5} 
                            fill="none" 
                            strokeLinecap="round" 
                          />
                          <path 
                            d="M 83 1 Q 90 7 83 15" 
                            stroke={colors.emerald.light} 
                            strokeWidth={1.2} 
                            fill="none" 
                            strokeLinecap="round"
                            opacity="0.7"
                          />
                          <path 
                            d="M 86 -1 Q 94 7 86 17" 
                            stroke={colors.emerald.light} 
                            strokeWidth={0.8} 
                            fill="none" 
                            strokeLinecap="round"
                            opacity="0.5"
                          />
                        </g>
                      </g>
                    </g>
                  </g>
                </>
              )}

              {variant === 'jobs' && (
                <>
                  {/* Left arm with rope */}
                  <g>
                    <path
                      d="M 20 44 Q 14 48 14 56 L 14 66 Q 14 68 16 68 L 20 66 Q 22 64 22 60 L 22 50 Q 22 46 20 44"
                      fill={`url(#${id}-shirt)`}
                      filter={`url(#${id}-soft-shadow)`}
                    />
                    <ellipse cx="17" cy="66" rx="4" ry="2" fill={colors.fabric.shirtTanDark} />
                    <ellipse cx="17" cy="68" rx="4.5" ry="3.5" fill={`url(#${id}-leather)`} filter={`url(#${id}-contact-shadow)`} />
                    <ellipse cx="16.5" cy="67" rx="2" ry="1" fill={colors.leather.light} opacity="0.3" />
                    
                    {/* Rope */}
                    <g transform="translate(9, 57)">
                      <ellipse cx="4" cy="5" rx="6" ry="3.5" fill="none" stroke="#8a8a8a" strokeWidth="2.5" />
                      <ellipse cx="4" cy="3" rx="5" ry="3" fill="none" stroke="#a3a3a3" strokeWidth="2.5" />
                      <ellipse cx="4" cy="1" rx="4" ry="2.5" fill="none" stroke="#c4c4c4" strokeWidth="2" />
                      <path d="M 0 3 L 8 3" stroke="#6a6a6a" strokeWidth="0.3" strokeDasharray="0.5,0.5" />
                    </g>
                  </g>

                  {/* Right arm with chainsaw */}
                  <g>
                    <path
                      d="M 60 44 Q 66 46 68 52 L 68 64 Q 68 66 66 66 L 62 64 Q 60 62 60 58 L 60 48 Q 60 46 60 44"
                      fill={`url(#${id}-shirt)`}
                      filter={`url(#${id}-soft-shadow)`}
                    />
                    <ellipse cx="65" cy="64" rx="4" ry="2" fill={colors.fabric.shirtTanDark} />
                    <ellipse cx="65" cy="66" rx="4.5" ry="3.5" fill={`url(#${id}-leather)`} filter={`url(#${id}-contact-shadow)`} />
                    <ellipse cx="64.5" cy="65" rx="2" ry="1" fill={colors.leather.light} opacity="0.3" />

                    {/* Chainsaw */}
                    <g filter={`url(#${id}-shadow)`}>
                      <rect x="61" y="55" width="18" height="12" rx="2" fill={colors.safety.orange} />
                      <rect x="62" y="56" width="16" height="10" rx="1.5" fill={colors.safety.orangeDark} />
                      <rect x="64" y="58" width="2" height="6" rx="0.5" fill={colors.safety.orangeDeep} />
                      <rect x="68" y="58" width="2" height="6" rx="0.5" fill={colors.safety.orangeDeep} />
                      <circle cx="74" cy="61" r="3" fill="#2a2a2a" />
                      <circle cx="74" cy="61" r="2" fill="#1a1a1a" />
                      <path d="M 59 61 Q 57 61 57 63 L 57 69 Q 57 71 59 71 L 63 71 Q 64 71 64 69 L 64 63 Q 64 61 62 61 Z" fill="#1c1917" />
                      <rect x="58" y="63" width="5" height="1" fill="#333" />
                      <rect x="58" y="66" width="5" height="1" fill="#333" />
                      <rect x="79" y="58.5" width="14" height="5" rx="0.5" fill={`url(#${id}-metal-aniso)`} filter={`url(#${id}-metal-specular)`} />
                      <rect x="79" y="57.5" width="14" height="1.5" fill={colors.metal.darker} />
                      <rect x="79" y="63" width="14" height="1.5" fill={colors.metal.darker} />
                      {[...Array(7)].map((_, i) => (
                        <rect key={i} x={80 + i * 2} y="57" width="0.8" height="1" fill={colors.metal.dark} />
                      ))}
                      <ellipse cx="93" cy="61" rx="1" ry="3" fill={colors.metal.base} />
                    </g>
                  </g>

                  {/* Harness straps */}
                  <g>
                    <path d="M 28 68 L 25 73 L 27 82" stroke="#166534" strokeWidth="2.5" fill="none" />
                    <path d="M 28 68 L 25 73 L 27 82" stroke="#22c55e" strokeWidth="1" fill="none" opacity="0.3" />
                    <path d="M 52 68 L 55 73 L 53 82" stroke="#166534" strokeWidth="2.5" fill="none" />
                    <path d="M 52 68 L 55 73 L 53 82" stroke="#22c55e" strokeWidth="1" fill="none" opacity="0.3" />
                    <ellipse cx="40" cy="70" rx="3" ry="2" fill={`url(#${id}-metal-aniso)`} filter={`url(#${id}-metal-specular)`} />
                    <g transform="translate(32, 68)">
                      <path d="M 0 0 Q -2 0 -2 3 L -2 6 Q -2 8 0 8 Q 2 8 2 6 L 2 3 Q 2 0 0 0" fill="none" stroke={colors.metal.base} strokeWidth="2" />
                      <path d="M -1 2 L 1 2" stroke={colors.metal.dark} strokeWidth="1.5" />
                      <circle cx="0" cy="4" r="0.5" fill={colors.metal.light} />
                    </g>
                  </g>
                </>
              )}

              {variant === 'tools' && (
                <>
                  {/* Left arm with toolbox */}
                  <g>
                    <path
                      d="M 20 44 Q 14 48 12 56 L 8 68 Q 8 70 10 70 L 14 68 Q 16 66 18 60 L 20 50 Q 22 46 20 44"
                      fill={`url(#${id}-shirt)`}
                      filter={`url(#${id}-soft-shadow)`}
                    />
                    <ellipse cx="11" cy="68" rx="4" ry="2" fill={colors.fabric.shirtTanDark} />
                    <ellipse cx="10" cy="70" rx="4.5" ry="3.5" fill={colors.emerald.dark} filter={`url(#${id}-contact-shadow)`} />
                    <ellipse cx="9.5" cy="69" rx="2" ry="1" fill={colors.emerald.base} opacity="0.4" />

                    {/* Toolbox */}
                    <g filter={`url(#${id}-shadow)`} transform="translate(-1, 61)">
                      <rect x="2" y="0" width="16" height="12" rx="1.5" fill="#dc2626" />
                      <rect x="2.5" y="0.5" width="15" height="11" rx="1" fill="#b91c1c" />
                      <rect x="2" y="0" width="16" height="4" rx="1" fill="#dc2626" />
                      <rect x="3" y="1" width="14" height="2" rx="0.5" fill="#ef4444" />
                      <path d="M 6 0 Q 6 -3 10 -3 Q 14 -3 14 0" stroke="#1c1917" strokeWidth="2" fill="none" />
                      <path d="M 6 0 Q 6 -3 10 -3 Q 14 -3 14 0" stroke="#333" strokeWidth="1" fill="none" />
                      <rect x="8" y="5" width="4" height="3" rx="0.5" fill={`url(#${id}-metal-aniso)`} />
                      <rect x="9" y="6" width="2" height="1" rx="0.3" fill={colors.metal.darker} />
                      <rect x="2" y="9" width="3" height="3" rx="0.3" fill="#991b1b" />
                      <rect x="15" y="9" width="3" height="3" rx="0.3" fill="#991b1b" />
                      <rect x="4" y="1" width="6" height="1" rx="0.3" fill="white" opacity="0.2" />
                    </g>
                  </g>

                  {/* Right arm with wrench */}
                  <g>
                    <g>
                      <path
                        d="M 60 44 Q 66 42 68 36 L 70 28 Q 70 26 68 26 L 64 28 Q 62 32 62 38 Q 60 44 60 44"
                        fill={`url(#${id}-shirt)`}
                        filter={`url(#${id}-soft-shadow)`}
                      />
                      <ellipse cx="67" cy="28" rx="3" ry="2" fill={colors.fabric.shirtTanDark} />
                      <ellipse cx="68" cy="27" rx="4.5" ry="3.5" fill={colors.emerald.dark} filter={`url(#${id}-contact-shadow)`} />
                      <ellipse cx="67.5" cy="26" rx="2" ry="1" fill={colors.emerald.base} opacity="0.4" />

                      {/* Wrench */}
                      <g filter={`url(#${id}-rim-glow)`} transform="translate(64, 6) rotate(25)">
                        <g>
                          <rect x="-2.5" y="0" width="5" height="24" rx="1.5" fill={`url(#${id}-metal-aniso)`} />
                          <rect x="-2" y="1" width="4" height="22" rx="1" fill={`url(#${id}-metal)`} />
                          {[...Array(8)].map((_, i) => (
                            <rect key={i} x="-1.5" y={5 + i * 2.5} width="3" height="1" rx="0.2" fill={colors.metal.darker} opacity="0.5" />
                          ))}
                          <path
                            d="M -6 -2 Q -7 -6 -4 -8 L 4 -8 Q 7 -6 6 -2 L 4 0 L -4 0 Z"
                            fill={`url(#${id}-metal)`}
                          />
                          <path
                            d="M -4 -3 Q -5 -5 -3 -6 L 3 -6 Q 5 -5 4 -3 L 3 -2 L -3 -2 Z"
                            fill={colors.metal.darker}
                          />
                          <ellipse cx="0" cy="-5" rx="2" ry="1.5" fill="none" stroke={colors.metal.darker} strokeWidth="1.5" />
                          <text x="0" y="18" fontSize="2" fill={colors.metal.darker} textAnchor="middle">24</text>
                          <rect x="-1" y="3" width="2" height="15" rx="0.5" fill="white" opacity="0.15" />
                        </g>
                      </g>
                    </g>
                  </g>

                  {/* Tool belt pouches */}
                  <g filter={`url(#${id}-contact-shadow)`}>
                    <rect x="19" y="68" width="7" height="6" rx="1" fill="#6b635b" />
                    <rect x="19.5" y="68.5" width="6" height="2" rx="0.5" fill="#78716c" />
                    <rect x="20" y="71" width="5" height="0.5" fill="#4a4540" />
                    <rect x="54" y="68" width="7" height="6" rx="1" fill="#6b635b" />
                    <rect x="54.5" y="68.5" width="6" height="2" rx="0.5" fill="#78716c" />
                    <rect x="55" y="71" width="5" height="0.5" fill="#4a4540" />
                    <rect x="28" y="68" width="5" height="5" rx="0.8" fill={colors.metal.dark} />
                    <rect x="29" y="66" width="3" height="4" rx="1" fill="#f97316" />
                    <rect x="29.8" y="64" width="1.4" height="3" fill={colors.metal.base} />
                  </g>
                </>
              )}
            </g>
          </g>

          {/* === LAYER 3: HEAD === */}
          <g>
            {/* Head */}
            <g>
              {/* Head content */}
              <g>
                {/* Neck */}
                <ellipse cx="40" cy="40" rx="6" ry="4" fill={`url(#${id}-skin)`} filter={`url(#${id}-sss)`} />
                <ellipse cx="40" cy="39" rx="5" ry="2" fill={colors.skin.deep} opacity="0.3" />

                {/* SSS underlayer */}
                <ellipse cx="40" cy="28" rx="15" ry="17" fill={`url(#${id}-skin-sss)`} />
                
                {/* Face base */}
                <ellipse cx="40" cy="28" rx="14" ry="16" fill={`url(#${id}-skin-face)`} filter={`url(#${id}-sss)`} />

                {/* Ears */}
                <ellipse cx="26" cy="28" rx="3" ry="4.5" fill={colors.skin.base} filter={`url(#${id}-sss)`} />
                <ellipse cx="26" cy="28" rx="1.8" ry="3" fill={colors.skin.shadow} />
                <ellipse cx="26" cy="28" rx="0.8" ry="1.5" fill={colors.skin.deep} />
                <ellipse cx="54" cy="28" rx="3" ry="4.5" fill={colors.skin.base} filter={`url(#${id}-sss)`} />
                <ellipse cx="54" cy="28" rx="1.8" ry="3" fill={colors.skin.shadow} />
                <ellipse cx="54" cy="28" rx="0.8" ry="1.5" fill={colors.skin.deep} />

                {/* Cheek blush */}
                <ellipse 
                  cx="31" cy="30" 
                  rx="4"
                  ry="2.5"
                  fill={`url(#${id}-cheek-blush)`}
                  opacity="0.5"
                />
                <ellipse 
                  cx="49" cy="30" 
                  rx="4"
                  ry="2.5"
                  fill={`url(#${id}-cheek-blush)`}
                  opacity="0.5"
                />

                {/* Cheek highlights */}
                <ellipse 
                  cx="32" cy="29" 
                  rx="3"
                  ry="2"
                  fill={colors.skin.highlight} 
                  opacity="0.5"
                />
                <ellipse 
                  cx="48" cy="29" 
                  rx="3"
                  ry="2"
                  fill={colors.skin.highlight}
                  opacity="0.5"
                />

                {/* Forehead highlight */}
                <ellipse cx="40" cy="18" rx="6" ry="3" fill={colors.skin.highlight} opacity="0.3" />

                {/* Hair strands peeking from under hardhat */}
                <g opacity="0.8">
                  <path d="M 24 23 Q 23 21 24 18" stroke={`url(#${id}-hair)`} strokeWidth="1.2" fill="none" strokeLinecap="round" />
                  <path d="M 25 24 Q 23.5 22 25 19" stroke={`url(#${id}-hair)`} strokeWidth="0.8" fill="none" strokeLinecap="round" />
                  <path d="M 56 23 Q 57 21 56 18" stroke={`url(#${id}-hair)`} strokeWidth="1.2" fill="none" strokeLinecap="round" />
                  <path d="M 55 24 Q 56.5 22 55 19" stroke={`url(#${id}-hair)`} strokeWidth="0.8" fill="none" strokeLinecap="round" />
                  {/* Sideburn hints */}
                  <path d="M 26 27 Q 24 28 24 31" stroke={`url(#${id}-hair)`} strokeWidth="0.6" fill="none" opacity="0.5" />
                  <path d="M 54 27 Q 56 28 56 31" stroke={`url(#${id}-hair)`} strokeWidth="0.6" fill="none" opacity="0.5" />
                </g>

                {/* Eyebrows */}
                <g>
                  {/* Left eyebrow */}
                  <path 
                    d="M 31 20 Q 35 17.5 39 20" 
                    stroke="#4a3728" 
                    strokeWidth="1.8" 
                    strokeLinecap="round" 
                    fill="none"
                  />
                  <path 
                    d="M 31.5 20 Q 35 18 38.5 20" 
                    stroke="#5c4033" 
                    strokeWidth="0.8" 
                    strokeLinecap="round" 
                    fill="none"
                  />
                  {/* Right eyebrow */}
                  <path 
                    d="M 41 20 Q 45 17.5 49 20" 
                    stroke="#4a3728" 
                    strokeWidth="1.8" 
                    strokeLinecap="round" 
                    fill="none"
                  />
                  <path 
                    d="M 41.5 20 Q 45 18 48.5 20" 
                    stroke="#5c4033" 
                    strokeWidth="0.8" 
                    strokeLinecap="round" 
                    fill="none"
                  />
                </g>

                {/* Eyes */}
                <g>
                  {/* Left eye */}
                  <ellipse cx="35" cy="25.5" rx="4.5" ry="5" fill={colors.skin.shadow} opacity="0.3" />
                  <ellipse cx="35" cy="25" rx="4.5" ry="5" fill="white" />
                  <ellipse cx="35" cy="25" rx="4" ry="4.5" fill="#f8fafc" />
                  
                  <g>
                    <ellipse cx="36" cy="25.5" rx="2.8" ry="3.2" fill={`url(#${id}-iris)`} />
                    {[...Array(8)].map((_, i) => (
                      <line
                        key={i}
                        x1="36"
                        y1="25.5"
                        x2={36 + Math.cos(i * Math.PI / 4) * 2}
                        y2={25.5 + Math.sin(i * Math.PI / 4) * 2.5}
                        stroke="#6b5344"
                        strokeWidth="0.2"
                        opacity="0.5"
                      />
                    ))}
                    <ellipse cx="36" cy="26" rx="1.6" ry="2" fill="#0f0f0f" />
                    <ellipse cx="36" cy="26" rx="1" ry="1.3" fill="#000000" />
                  </g>
                  
                  <circle cx="34.5" cy="24" r="1.2" fill="white" opacity="0.95" />
                  <circle cx="37" cy="27" r="0.6" fill="white" opacity="0.7" />
                  <circle cx="35.5" cy="23" r="0.4" fill="white" opacity="0.5" />
                  
                  <path
                    d="M 30.5 23 Q 35 21 39.5 23"
                    stroke={colors.skin.shadow}
                    strokeWidth="0.8"
                    fill="none"
                  />
                  <path d="M 31 28 Q 35 29 39 28" stroke={colors.skin.shadow} strokeWidth="0.4" fill="none" opacity="0.5" />
                </g>

                <g>
                  {/* Right eye */}
                  <ellipse cx="45" cy="25.5" rx="4.5" ry="5" fill={colors.skin.shadow} opacity="0.3" />
                  <ellipse cx="45" cy="25" rx="4.5" ry="5" fill="white" />
                  <ellipse cx="45" cy="25" rx="4" ry="4.5" fill="#f8fafc" />
                  
                  <g>
                    <ellipse cx="44" cy="25.5" rx="2.8" ry="3.2" fill={`url(#${id}-iris)`} />
                    {[...Array(8)].map((_, i) => (
                      <line
                        key={i}
                        x1="44"
                        y1="25.5"
                        x2={44 + Math.cos(i * Math.PI / 4) * 2}
                        y2={25.5 + Math.sin(i * Math.PI / 4) * 2.5}
                        stroke="#6b5344"
                        strokeWidth="0.2"
                        opacity="0.5"
                      />
                    ))}
                    <ellipse cx="44" cy="26" rx="1.6" ry="2" fill="#0f0f0f" />
                    <ellipse cx="44" cy="26" rx="1" ry="1.3" fill="#000000" />
                  </g>
                  
                  <circle cx="43" cy="24" r="1.2" fill="white" opacity="0.95" />
                  <circle cx="45" cy="27" r="0.6" fill="white" opacity="0.7" />
                  <circle cx="44" cy="23" r="0.4" fill="white" opacity="0.5" />
                  
                  <path
                    d="M 40.5 23 Q 45 21 49.5 23"
                    stroke={colors.skin.shadow}
                    strokeWidth="0.8"
                    fill="none"
                  />
                  <path d="M 41 28 Q 45 29 49 28" stroke={colors.skin.shadow} strokeWidth="0.4" fill="none" opacity="0.5" />
                </g>

                {/* Nose */}
                <ellipse cx="40" cy="30" rx="2.5" ry="2" fill={colors.skin.shadow} opacity="0.4" />
                <path d="M 39 27 Q 41 29 40 32 Q 39 32 38 31" stroke={colors.skin.deep} strokeWidth="0.6" fill="none" opacity="0.6" />
                <ellipse cx="40" cy="29" rx="1" ry="0.8" fill={colors.skin.highlight} opacity="0.4" />
                <ellipse cx="38.5" cy="31.5" rx="0.8" ry="0.5" fill={colors.skin.deep} opacity="0.3" />
                <ellipse cx="41.5" cy="31.5" rx="0.8" ry="0.5" fill={colors.skin.deep} opacity="0.3" />

                {/* Mouth - smile */}
                <path
                  d="M 34 34 Q 40 39 46 34"
                  stroke="#9a6b4a"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  fill="none"
                />
                <path d="M 35 33.5 Q 40 32 45 33.5" stroke={colors.skin.shadow} strokeWidth="0.5" fill="none" opacity="0.4" />
                <path 
                  d="M 36 34.5 Q 40 37 44 34.5"
                  fill="white" 
                  opacity="0.85"
                />
                <path d="M 37 35 L 37 36" stroke="#e8e8e8" strokeWidth="0.3" opacity="0.5" />
                <path d="M 40 35.5 L 40 36.5" stroke="#e8e8e8" strokeWidth="0.3" opacity="0.5" />
                <path d="M 43 35 L 43 36" stroke="#e8e8e8" strokeWidth="0.3" opacity="0.5" />
                <path d="M 36 35.5 Q 40 38 44 35.5" stroke="#c98a6a" strokeWidth="0.8" fill="none" opacity="0.5" />

                {/* Chin shadow */}
                <ellipse cx="40" cy="39" rx="7" ry="2.5" fill={colors.skin.deep} opacity="0.2" />

                {/* Stubble */}
                <g opacity="0.15">
                  {[...Array(12)].map((_, i) => (
                    <circle
                      key={i}
                      cx={35 + (i % 4) * 3}
                      cy={36 + Math.floor(i / 4) * 2}
                      r="0.3"
                      fill={colors.skin.deep}
                    />
                  ))}
                </g>

                {/* Hardhat */}
                <g filter={`url(#${id}-plastic-spec)`}>
                  <path
                    d="M 21 20 Q 21 4 40 4 Q 59 4 59 20 L 57 24 Q 40 27 23 24 Z"
                    fill={`url(#${id}-hardhat)`}
                  />
                  <path
                    d="M 21 20 Q 21 4 40 4 Q 59 4 59 20 L 57 24 Q 40 27 23 24 Z"
                    fill={`url(#${id}-hardhat-fresnel)`}
                    opacity="0.5"
                  />
                  <path
                    d="M 17 24 Q 17 19 23 19 L 57 19 Q 63 19 63 24 Q 63 29 57 26 L 23 26 Q 17 29 17 24"
                    fill={`url(#${id}-hardhat)`}
                  />
                  <path d="M 20 26 Q 40 28 60 26" stroke={colors.skin.shadow} strokeWidth="1" fill="none" opacity="0.3" />
                  <path d="M 28 6 Q 40 2 52 6" stroke={colors.safety.yellowBright} strokeWidth="2.5" fill="none" opacity="0.7" />
                  <path d="M 30 7 Q 40 4 50 7" stroke="white" strokeWidth="1" fill="none" opacity="0.4" />
                  <ellipse cx="34" cy="11" rx="10" ry="5" fill={`url(#${id}-hardhat-shine)`} />
                  <ellipse cx="48" cy="14" rx="4" ry="3" fill="white" opacity="0.2" />
                  <rect x="35" y="19" width="10" height="4" rx="1.5" fill={colors.metal.dark} />
                  <rect x="36" y="20" width="8" height="2" rx="0.8" fill={colors.metal.base} />
                  <rect x="38" y="20.5" width="4" height="1" rx="0.3" fill={colors.metal.light} />
                </g>

                {/* Safety glasses (not jobs) */}
                {variant !== 'jobs' && (
                  <g>
                    <path d="M 27 17 L 53 17" stroke={colors.emerald.darker} strokeWidth="2" />
                    <path d="M 27 17 L 53 17" stroke={colors.emerald.dark} strokeWidth="1" />
                    <ellipse cx="32" cy="17.5" rx="6" ry="2.5" fill={colors.emerald.base} opacity="0.25" stroke={colors.emerald.dark} strokeWidth="0.8" />
                    <ellipse cx="31" cy="17" rx="3" ry="1" fill="white" opacity="0.3" />
                    <ellipse cx="48" cy="17.5" rx="6" ry="2.5" fill={colors.emerald.base} opacity="0.25" stroke={colors.emerald.dark} strokeWidth="0.8" />
                    <ellipse cx="47" cy="17" rx="3" ry="1" fill="white" opacity="0.3" />
                    <rect x="38" y="16.5" width="4" height="2" rx="0.5" fill={colors.emerald.dark} />
                  </g>
                )}

                {/* Jobs variant - helmet visor */}
                {variant === 'jobs' && (
                  <g>
                    <path
                      d="M 25 21 Q 25 14 40 14 Q 55 14 55 21 L 53 26 Q 40 29 27 26 Z"
                      fill={colors.emerald.dark}
                      opacity="0.35"
                    />
                    <path
                      d="M 25 21 Q 25 14 40 14 Q 55 14 55 21 L 53 26 Q 40 29 27 26 Z"
                      fill="none"
                      stroke={colors.emerald.darker}
                      strokeWidth="0.5"
                    />
                    <path d="M 29 17 Q 40 13 51 17" stroke={colors.emerald.light} strokeWidth="0.8" fill="none" opacity="0.5" />
                    <path d="M 32 20 Q 40 18 48 20" stroke="white" strokeWidth="0.5" fill="none" opacity="0.3" />
                    <circle cx="26" cy="18" r="1.5" fill={colors.metal.base} />
                    <circle cx="54" cy="18" r="1.5" fill={colors.metal.base} />
                  </g>
                )}

                {/* ATTS text */}
                <text x="40" y="15" fontSize="4.5" fill={colors.forest.dark} textAnchor="middle" fontWeight="bold" opacity="0.75">ATTS</text>
                <text x="40" y="15" fontSize="4.5" fill={colors.forest.base} textAnchor="middle" fontWeight="bold" opacity="0.25" style={{ transform: 'translateX(0.2px) translateY(0.2px)' }}>ATTS</text>

                {/* Rim lighting */}
                <ellipse 
                  cx="40" cy="28" rx="15" ry="17" 
                  fill={`url(#${id}-fresnel-edge)`}
                  opacity="0.25"
                />
                <ellipse 
                  cx="40" cy="28" rx="15" ry="17" 
                  fill="none" 
                  stroke={colors.emerald.light} 
                  strokeWidth="0.8"
                  opacity="0.45"
                  style={{
                    strokeDasharray: '80 20',
                  }}
                />
                <ellipse 
                  cx="40" cy="28" rx="14.5" ry="16.5" 
                  fill="none" 
                  stroke={colors.emerald.glow} 
                  strokeWidth="0.5" 
                  opacity="0.65"
                />
                
                {/* Glow accent */}
                <ellipse
                  cx="40"
                  cy="20"
                  rx="2.5"
                  ry="1.5"
                  fill={colors.emerald.light}
                  opacity="0.2"
                  style={{ filter: 'blur(3px)' }}
                />
              </g>
            </g>
          </g>
        </svg>
      </div>
    </div>
  );
}

export const DashboardAvatar = memo(DashboardAvatarComponent);
export default DashboardAvatar;
