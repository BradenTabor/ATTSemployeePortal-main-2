import { memo, useRef } from 'react';

interface AdminAvatarProps {
  className?: string;
}

// Admin Theme Color Palette - Black & Gold with premium styling
const colors = {
  // Primary gold theme
  gold: {
    bright: '#f7e4bd',
    base: '#f4c979',
    dark: '#d79a32',
    darker: '#a67c20',
    glow: '#fef3d1',
    shimmer: '#fff8e7',
  },
  // Rich blacks
  black: {
    rich: '#0a0a0a',
    suit: '#1a1a1a',
    accent: '#2a2a2a',
    highlight: '#3a3a3a',
  },
  // Skin tones with SSS undertones
  skin: {
    highlight: '#fcd9bd',
    base: '#e8b896',
    shadow: '#c99a6b',
    deep: '#a67c52',
    sssWarm: '#ffb8a8',
    sssRed: '#e8a090',
    sssPink: '#f0c8c0',
  },
  // Materials
  metal: {
    light: '#e5e7eb',
    base: '#9ca3af',
    dark: '#6b7280',
    darker: '#4b5563',
    highlight: '#ffffff',
    reflection: '#f8fafc',
  },
  fabric: {
    shirtWhite: '#fafafa',
    shirtShadow: '#e5e5e5',
    tie: '#1a1a1a',
  },
};

function AdminAvatarComponent({ className = '' }: AdminAvatarProps) {
  const id = 'admin-avatar';
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={containerRef}
      className={`relative ${className}`}
    >
      {/* Animated gold ambient glow */}
      <div
        className="absolute inset-[-35%] rounded-full blur-3xl pointer-events-none animate-pulse"
        style={{
          opacity: 0.5,
          background: `radial-gradient(circle at 50% 50%, ${colors.gold.glow}60 0%, ${colors.gold.base}35 35%, transparent 70%)`,
          animationDuration: '4s',
        }}
      />
      <div
        className="absolute inset-[-20%] rounded-full blur-xl pointer-events-none"
        style={{
          opacity: 0.4,
          background: `radial-gradient(circle at 50% 50%, ${colors.gold.bright}50 0%, transparent 55%)`,
        }}
      />
      
      {/* Gold rim lighting layer */}
      <div
        className="absolute inset-[-5%] rounded-full pointer-events-none"
        style={{
          opacity: 0.3,
          background: `conic-gradient(from 90deg at 50% 50%, transparent 0deg, ${colors.gold.bright}40 90deg, transparent 180deg, ${colors.gold.glow}30 270deg, transparent 360deg)`,
          filter: 'blur(8px)',
          animation: 'spin 20s linear infinite',
        }}
      />

      <div style={{ animation: 'adminFloat 4s ease-in-out infinite' }}>
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

            {/* Crown gradient - premium gold */}
            <linearGradient id={`${id}-crown`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={colors.gold.shimmer} />
              <stop offset="15%" stopColor={colors.gold.bright} />
              <stop offset="40%" stopColor={colors.gold.base} />
              <stop offset="70%" stopColor={colors.gold.dark} />
              <stop offset="100%" stopColor={colors.gold.darker} />
            </linearGradient>

            <linearGradient id={`${id}-crown-shine`} x1="20%" y1="0%" x2="80%" y2="100%">
              <stop offset="0%" stopColor="white" stopOpacity="0.9" />
              <stop offset="20%" stopColor="white" stopOpacity="0.5" />
              <stop offset="50%" stopColor="white" stopOpacity="0.1" />
              <stop offset="100%" stopColor="white" stopOpacity="0" />
            </linearGradient>

            {/* Suit gradient - rich black with depth */}
            <linearGradient id={`${id}-suit`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={colors.black.highlight} />
              <stop offset="20%" stopColor={colors.black.accent} />
              <stop offset="60%" stopColor={colors.black.suit} />
              <stop offset="100%" stopColor={colors.black.rich} />
            </linearGradient>

            <linearGradient id={`${id}-suit-lapel`} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={colors.black.suit} />
              <stop offset="50%" stopColor={colors.black.accent} />
              <stop offset="100%" stopColor={colors.black.suit} />
            </linearGradient>

            {/* Shirt gradient */}
            <linearGradient id={`${id}-shirt`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={colors.fabric.shirtWhite} />
              <stop offset="50%" stopColor={colors.fabric.shirtShadow} />
              <stop offset="100%" stopColor="#d5d5d5" />
            </linearGradient>

            {/* Tie gradient - gold accent */}
            <linearGradient id={`${id}-tie`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={colors.gold.bright} />
              <stop offset="30%" stopColor={colors.gold.base} />
              <stop offset="70%" stopColor={colors.gold.dark} />
              <stop offset="100%" stopColor={colors.gold.darker} />
            </linearGradient>

            {/* Pants gradient */}
            <linearGradient id={`${id}-pants`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={colors.black.accent} />
              <stop offset="30%" stopColor={colors.black.suit} />
              <stop offset="70%" stopColor={colors.black.rich} />
              <stop offset="100%" stopColor="#050505" />
            </linearGradient>

            {/* Gold metal for accessories */}
            <linearGradient id={`${id}-gold-metal`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={colors.gold.shimmer} />
              <stop offset="15%" stopColor={colors.gold.bright} />
              <stop offset="40%" stopColor={colors.gold.base} />
              <stop offset="70%" stopColor={colors.gold.dark} />
              <stop offset="100%" stopColor={colors.gold.darker} />
            </linearGradient>

            {/* Iris gradient */}
            <radialGradient id={`${id}-iris`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#1c1917" />
              <stop offset="30%" stopColor="#3d2c1e" />
              <stop offset="60%" stopColor="#5c4033" />
              <stop offset="80%" stopColor="#4a3428" />
              <stop offset="100%" stopColor="#3d2c1e" />
            </radialGradient>

            {/* Hair gradient - dark executive style */}
            <linearGradient id={`${id}-hair`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#2a2520" />
              <stop offset="40%" stopColor="#1a1510" />
              <stop offset="100%" stopColor="#0d0a08" />
            </linearGradient>

            {/* Gold fresnel edge */}
            <radialGradient id={`${id}-fresnel-edge`} cx="50%" cy="30%" r="80%">
              <stop offset="50%" stopColor="transparent" />
              <stop offset="85%" stopColor={colors.gold.base} stopOpacity="0.3" />
              <stop offset="95%" stopColor={colors.gold.glow} stopOpacity="0.5" />
              <stop offset="100%" stopColor="white" stopOpacity="0.2" />
            </radialGradient>

            {/* === FILTER DEFINITIONS === */}
            
            {/* SSS for skin */}
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

            {/* Main shadow */}
            <filter id={`${id}-shadow`} x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#000" floodOpacity="0.4" />
              <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#000" floodOpacity="0.2" />
            </filter>

            {/* Soft shadow */}
            <filter id={`${id}-soft-shadow`} x="-25%" y="-25%" width="150%" height="150%">
              <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#000" floodOpacity="0.3" />
            </filter>

            {/* Contact shadow */}
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

            {/* Gold glow */}
            <filter id={`${id}-gold-glow`} x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="3" result="blur1" />
              <feFlood floodColor={colors.gold.base} floodOpacity="0.6" />
              <feComposite in2="blur1" operator="in" result="glow" />
              <feMerge>
                <feMergeNode in="glow" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            {/* Crown specular */}
            <filter id={`${id}-crown-spec`} x="-30%" y="-30%" width="160%" height="160%">
              <feSpecularLighting surfaceScale="4" specularConstant="2" specularExponent="50" lightingColor="white" result="spec">
                <fePointLight x="35" y="0" z="50" />
              </feSpecularLighting>
              <feComposite in="spec" in2="SourceAlpha" operator="in" result="specMask" />
              <feComposite in="SourceGraphic" in2="specMask" operator="arithmetic" k1="0" k2="1" k3="0.4" k4="0" />
            </filter>

            {/* Ambient occlusion */}
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
          </defs>

          {/* === GROUND SHADOW === */}
          <ellipse cx="40" cy="98" rx="22" ry="4" fill="black" opacity="0.2" />
          <ellipse cx="40" cy="97" rx="16" ry="2.5" fill="black" opacity="0.3" />

          {/* === LAYER 1: LEGS === */}
          <g>
            {/* Left leg */}
            <path
              d="M 30 68 L 28 90 Q 28 94 32 94 L 36 94 Q 38 94 38 90 L 36 68"
              fill={`url(#${id}-pants)`}
              filter={`url(#${id}-soft-shadow)`}
            />
            <line x1="32" y1="70" x2="31" y2="88" stroke="#222" strokeWidth="0.3" opacity="0.4" />
            
            {/* Left shoe - polished dress shoe */}
            <path
              d="M 26 87 Q 24 91 26 94 L 39 94 Q 42 91 39 87 L 37 87 Q 35 89 33 89 Q 31 89 29 87 Z"
              fill="#0f0f0f"
              filter={`url(#${id}-contact-shadow)`}
            />
            <path d="M 27 93 L 39 93 L 39 95 L 27 95 Z" fill="#050505" />
            <ellipse cx="33" cy="89" rx="4" ry="1.5" fill="white" opacity="0.08" />

            {/* Right leg */}
            <path
              d="M 44 68 L 42 90 Q 42 94 46 94 L 50 94 Q 52 94 52 90 L 50 68"
              fill={`url(#${id}-pants)`}
              filter={`url(#${id}-soft-shadow)`}
            />
            <line x1="48" y1="70" x2="49" y2="88" stroke="#222" strokeWidth="0.3" opacity="0.4" />
            
            {/* Right shoe */}
            <path
              d="M 41 87 Q 39 91 41 94 L 54 94 Q 57 91 54 87 L 52 87 Q 50 89 48 89 Q 46 89 44 87 Z"
              fill="#0f0f0f"
              filter={`url(#${id}-contact-shadow)`}
            />
            <path d="M 42 93 L 54 93 L 54 95 L 42 95 Z" fill="#050505" />
            <ellipse cx="48" cy="89" rx="4" ry="1.5" fill="white" opacity="0.08" />
          </g>

          {/* === LAYER 2: TORSO === */}
          <g>
            {/* Suit jacket base */}
            <path
              d="M 22 42 Q 18 45 18 52 L 18 70 Q 18 74 24 74 L 56 74 Q 62 74 62 70 L 62 52 Q 62 45 58 42 L 52 38 L 28 38 Z"
              fill={`url(#${id}-suit)`}
              filter={`url(#${id}-shadow)`}
            />
            
            {/* Jacket highlight */}
            <path
              d="M 22 42 Q 18 45 18 52 L 18 55 Q 30 52 40 55 Q 50 52 62 55 L 62 52 Q 62 45 58 42 L 52 38 L 28 38 Z"
              fill="white"
              opacity="0.05"
            />

            {/* Shirt V visible */}
            <path
              d="M 35 42 L 40 60 L 45 42"
              fill={`url(#${id}-shirt)`}
            />
            <path
              d="M 36 42 L 40 56 L 44 42"
              fill="white"
              opacity="0.1"
            />

            {/* Gold tie */}
            <g filter={`url(#${id}-gold-glow)`}>
              <path
                d="M 38.5 43 L 40 44 L 41.5 43 L 43 46 L 40 70 L 37 46 Z"
                fill={`url(#${id}-tie)`}
              />
              <path
                d="M 39 44 L 40 45 L 41 44"
                fill={colors.gold.shimmer}
                opacity="0.5"
              />
              {/* Tie clip */}
              <rect x="38" y="52" width="4" height="2" rx="0.3" fill={`url(#${id}-gold-metal)`} />
              <rect x="38.5" y="52.5" width="3" height="1" rx="0.2" fill={colors.gold.shimmer} opacity="0.5" />
            </g>

            {/* Left lapel */}
            <path
              d="M 35 42 L 28 44 Q 24 46 24 52 L 24 65 Q 24 68 28 68 L 36 68 L 36 46 Z"
              fill={`url(#${id}-suit-lapel)`}
              filter={`url(#${id}-ao)`}
            />
            <path
              d="M 35 42 L 32 44 L 35 52 L 35 42"
              fill="white"
              opacity="0.06"
            />

            {/* Right lapel */}
            <path
              d="M 45 42 L 52 44 Q 56 46 56 52 L 56 65 Q 56 68 52 68 L 44 68 L 44 46 Z"
              fill={`url(#${id}-suit-lapel)`}
              filter={`url(#${id}-ao)`}
            />
            <path
              d="M 45 42 L 48 44 L 45 52 L 45 42"
              fill="white"
              opacity="0.06"
            />

            {/* Collar notch */}
            <path d="M 34 42 L 36 46 L 34 44" fill={colors.black.rich} />
            <path d="M 46 42 L 44 46 L 46 44" fill={colors.black.rich} />

            {/* Suit buttons - gold */}
            <g filter={`url(#${id}-gold-glow)`}>
              <circle cx="40" cy="58" r="1.8" fill={`url(#${id}-gold-metal)`} />
              <circle cx="40" cy="57.5" r="0.8" fill={colors.gold.shimmer} opacity="0.6" />
              <circle cx="40" cy="64" r="1.8" fill={`url(#${id}-gold-metal)`} />
              <circle cx="40" cy="63.5" r="0.8" fill={colors.gold.shimmer} opacity="0.6" />
            </g>

            {/* Pocket square - gold silk */}
            <g filter={`url(#${id}-gold-glow)`}>
              <path
                d="M 48 48 L 53 48 L 53 52 L 50 54 L 48 52 Z"
                fill={colors.gold.base}
              />
              <path
                d="M 49 48 L 52 48 L 52 50 L 50 52 L 49 50 Z"
                fill={colors.gold.bright}
                opacity="0.6"
              />
            </g>

            {/* Belt */}
            <rect x="22" y="68" width="36" height="4" rx="1" fill="#1a1a1a" />
            <rect x="22" y="68" width="36" height="1.5" rx="0.5" fill="#2a2a2a" />
            {/* Gold belt buckle */}
            <rect x="36" y="67" width="8" height="6" rx="1" fill={`url(#${id}-gold-metal)`} filter={`url(#${id}-gold-glow)`} />
            <rect x="38" y="69" width="4" height="2" rx="0.3" fill={colors.gold.darker} />
          </g>

          {/* === ARMS === */}
          <g>
            {/* Left arm - confident pose */}
            <path
              d="M 18 44 Q 12 48 10 56 L 8 68 Q 8 70 10 70 L 14 68 Q 16 66 17 62 L 19 52 Q 20 48 18 44"
              fill={`url(#${id}-suit)`}
              filter={`url(#${id}-soft-shadow)`}
            />
            {/* Sleeve highlight */}
            <path
              d="M 16 50 Q 14 55 12 62"
              stroke="white"
              strokeWidth="0.5"
              opacity="0.1"
              fill="none"
            />
            {/* Shirt cuff */}
            <ellipse cx="11" cy="68" rx="4" ry="2" fill={colors.fabric.shirtShadow} />
            {/* Hand */}
            <ellipse cx="10" cy="70" rx="4.5" ry="3.5" fill={`url(#${id}-skin-face)`} filter={`url(#${id}-sss)`} />
            <ellipse cx="9.5" cy="69" rx="2" ry="1" fill={colors.skin.highlight} opacity="0.4" />
            {/* Gold cufflink */}
            <circle cx="14" cy="67" r="1.2" fill={`url(#${id}-gold-metal)`} filter={`url(#${id}-gold-glow)`} />

            {/* Right arm - commanding gesture */}
            <path
              d="M 62 44 Q 68 46 70 52 L 70 64 Q 70 66 68 66 L 64 64 Q 62 62 62 58 L 62 48"
              fill={`url(#${id}-suit)`}
              filter={`url(#${id}-soft-shadow)`}
            />
            {/* Sleeve highlight */}
            <path
              d="M 64 50 Q 66 55 68 60"
              stroke="white"
              strokeWidth="0.5"
              opacity="0.1"
              fill="none"
            />
            {/* Shirt cuff */}
            <ellipse cx="67" cy="64" rx="4" ry="2" fill={colors.fabric.shirtShadow} />
            {/* Hand */}
            <ellipse cx="68" cy="66" rx="4.5" ry="3.5" fill={`url(#${id}-skin-face)`} filter={`url(#${id}-sss)`} />
            <ellipse cx="67.5" cy="65" rx="2" ry="1" fill={colors.skin.highlight} opacity="0.4" />
            {/* Gold cufflink */}
            <circle cx="64" cy="63" r="1.2" fill={`url(#${id}-gold-metal)`} filter={`url(#${id}-gold-glow)`} />
            
            {/* Gold ring */}
            <ellipse cx="70" cy="67" rx="1.5" ry="1" fill={`url(#${id}-gold-metal)`} filter={`url(#${id}-gold-glow)`} />
          </g>

          {/* === LAYER 3: HEAD === */}
          <g>
            {/* Neck */}
            <ellipse cx="40" cy="40" rx="6" ry="4" fill={`url(#${id}-skin)`} filter={`url(#${id}-sss)`} />
            <ellipse cx="40" cy="39" rx="5" ry="2" fill={colors.skin.deep} opacity="0.3" />
            
            {/* Shirt collar */}
            <path
              d="M 32 40 L 35 42 L 40 44 L 45 42 L 48 40 L 46 38 L 40 40 L 34 38 Z"
              fill={colors.fabric.shirtWhite}
            />
            <path
              d="M 34 39 L 37 41 L 40 42 L 43 41 L 46 39"
              stroke={colors.fabric.shirtShadow}
              strokeWidth="0.5"
              fill="none"
            />

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
            <ellipse cx="31" cy="30" rx="4" ry="2.5" fill={`url(#${id}-cheek-blush)`} opacity="0.4" />
            <ellipse cx="49" cy="30" rx="4" ry="2.5" fill={`url(#${id}-cheek-blush)`} opacity="0.4" />

            {/* Cheek highlights */}
            <ellipse cx="32" cy="29" rx="3" ry="2" fill={colors.skin.highlight} opacity="0.4" />
            <ellipse cx="48" cy="29" rx="3" ry="2" fill={colors.skin.highlight} opacity="0.4" />

            {/* Forehead highlight */}
            <ellipse cx="40" cy="18" rx="6" ry="3" fill={colors.skin.highlight} opacity="0.3" />

            {/* Executive hairstyle */}
            <g>
              <path
                d="M 26 20 Q 26 12 40 10 Q 54 12 54 20 L 52 24 Q 40 22 28 24 Z"
                fill={`url(#${id}-hair)`}
              />
              <path
                d="M 28 18 Q 34 14 45 14 Q 52 14 52 19"
                stroke="#3a3530"
                strokeWidth="0.5"
                fill="none"
                opacity="0.5"
              />
              {/* Side part */}
              <path d="M 32 12 Q 32 16 30 22" stroke="#1a1510" strokeWidth="0.8" fill="none" />
              {/* Hair shine */}
              <path d="M 35 13 Q 42 11 48 14" stroke="white" strokeWidth="0.6" opacity="0.2" fill="none" />
              {/* Temple graying - distinguished look */}
              <path d="M 27 20 Q 26 22 27 25" stroke="#6b6b6b" strokeWidth="1.5" opacity="0.4" fill="none" strokeLinecap="round" />
              <path d="M 53 20 Q 54 22 53 25" stroke="#6b6b6b" strokeWidth="1.5" opacity="0.4" fill="none" strokeLinecap="round" />
            </g>

            {/* Eyebrows - confident, slightly arched */}
            <g>
              <path 
                d="M 31 21 Q 35 19 39 21" 
                stroke="#2a2520" 
                strokeWidth="1.6" 
                strokeLinecap="round" 
                fill="none"
              />
              <path 
                d="M 41 21 Q 45 19 49 21" 
                stroke="#2a2520" 
                strokeWidth="1.6" 
                strokeLinecap="round" 
                fill="none"
              />
            </g>

            {/* Eyes - confident, focused */}
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
              
              <path d="M 30.5 23 Q 35 21 39.5 23" stroke={colors.skin.shadow} strokeWidth="0.8" fill="none" />
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
              
              <path d="M 40.5 23 Q 45 21 49.5 23" stroke={colors.skin.shadow} strokeWidth="0.8" fill="none" />
            </g>

            {/* Nose */}
            <ellipse cx="40" cy="30" rx="2.5" ry="2" fill={colors.skin.shadow} opacity="0.4" />
            <path d="M 39 27 Q 41 29 40 32 Q 39 32 38 31" stroke={colors.skin.deep} strokeWidth="0.6" fill="none" opacity="0.6" />
            <ellipse cx="40" cy="29" rx="1" ry="0.8" fill={colors.skin.highlight} opacity="0.4" />

            {/* Mouth - confident smile */}
            <path
              d="M 35 34 Q 40 37 45 34"
              stroke="#9a6b4a"
              strokeWidth="1.5"
              strokeLinecap="round"
              fill="none"
            />
            <path 
              d="M 36 34.5 Q 40 36 44 34.5"
              fill="white" 
              opacity="0.8"
            />

            {/* Chin shadow */}
            <ellipse cx="40" cy="39" rx="7" ry="2.5" fill={colors.skin.deep} opacity="0.2" />

            {/* Light stubble - executive look */}
            <g opacity="0.1">
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

            {/* CROWN - Executive headpiece */}
            <g filter={`url(#${id}-crown-spec)`}>
              {/* Crown base */}
              <path
                d="M 25 12 Q 25 8 28 7 L 40 4 L 52 7 Q 55 8 55 12 L 53 16 Q 40 18 27 16 Z"
                fill={`url(#${id}-crown)`}
              />
              
              {/* Crown points */}
              <path
                d="M 28 7 L 30 2 L 32 7"
                fill={`url(#${id}-crown)`}
              />
              <path
                d="M 36 5 L 38 0 L 40 4 L 42 0 L 44 5"
                fill={`url(#${id}-crown)`}
              />
              <path
                d="M 48 7 L 50 2 L 52 7"
                fill={`url(#${id}-crown)`}
              />
              
              {/* Crown gems - center */}
              <circle cx="40" cy="8" r="2" fill="#1a0505" />
              <circle cx="40" cy="8" r="1.5" fill="#b91c1c" />
              <circle cx="39.5" cy="7.5" r="0.5" fill="white" opacity="0.7" />
              
              {/* Crown gems - sides */}
              <circle cx="33" cy="9" r="1.2" fill={colors.gold.darker} />
              <circle cx="33" cy="9" r="0.8" fill="#059669" />
              <circle cx="47" cy="9" r="1.2" fill={colors.gold.darker} />
              <circle cx="47" cy="9" r="0.8" fill="#059669" />
              
              {/* Crown shine */}
              <path
                d="M 30 8 Q 40 5 50 8"
                stroke="white"
                strokeWidth="1"
                opacity="0.4"
                fill="none"
              />
              <ellipse cx="35" cy="10" rx="4" ry="2" fill={`url(#${id}-crown-shine)`} />
              
              {/* Crown band */}
              <path
                d="M 26 14 Q 40 16 54 14"
                stroke={colors.gold.darker}
                strokeWidth="1.5"
                fill="none"
              />
              
              {/* Crown cross-hatching detail */}
              <g stroke={colors.gold.dark} strokeWidth="0.3" opacity="0.5">
                <line x1="30" y1="12" x2="32" y2="14" />
                <line x1="35" y1="11" x2="37" y2="14" />
                <line x1="43" y1="11" x2="45" y2="14" />
                <line x1="48" y1="12" x2="50" y2="14" />
              </g>
            </g>

            {/* Rim lighting */}
            <ellipse 
              cx="40" cy="28" rx="15" ry="17" 
              fill={`url(#${id}-fresnel-edge)`}
              opacity="0.25"
            />
            <ellipse 
              cx="40" cy="28" rx="15" ry="17" 
              fill="none" 
              stroke={colors.gold.base} 
              strokeWidth="0.8"
              opacity="0.4"
              style={{
                strokeDasharray: '80 20',
              }}
            />
          </g>
        </svg>
      </div>

      {/* Floating animation keyframes */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes adminFloat {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-6px); }
        }
        @keyframes adminGlow {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 0.7; }
        }
      `}</style>
    </div>
  );
}

export const AdminAvatar = memo(AdminAvatarComponent);
export default AdminAvatar;

