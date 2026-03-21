import { memo, useRef } from 'react';

interface MechanicAvatarProps {
  className?: string;
}

// Mechanic Theme Color Palette - Ember/Orange with premium styling
const colors = {
  // Primary ember theme
  ember: {
    bright: '#ffb48a',
    base: '#ff9350',
    dark: '#ea580c',
    darker: '#c2410c',
    glow: '#ffa366',
    shimmer: '#ffe4c9',
  },
  // Rich blacks for uniform
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
  // Mechanic-specific
  grease: {
    stain: '#2d2d2d',
    smudge: '#1a1a1a',
  },
  fabric: {
    overalls: '#3b82f6',
    overallsDark: '#2563eb',
    patch: '#1e40af',
  },
};

function MechanicAvatarComponent({ className = '' }: MechanicAvatarProps) {
  const id = 'mechanic-avatar';
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={containerRef}
      className={`relative ${className}`}
    >
      {/* Animated ember ambient glow */}
      <div
        className="absolute inset-[-35%] rounded-full blur-3xl pointer-events-none animate-pulse"
        style={{
          opacity: 0.5,
          background: `radial-gradient(circle at 50% 50%, ${colors.ember.glow}60 0%, ${colors.ember.base}35 35%, transparent 70%)`,
          animationDuration: '4s',
        }}
      />
      <div
        className="absolute inset-[-20%] rounded-full blur-xl pointer-events-none"
        style={{
          opacity: 0.4,
          background: `radial-gradient(circle at 50% 50%, ${colors.ember.bright}50 0%, transparent 55%)`,
        }}
      />
      
      {/* Ember rim lighting layer */}
      <div
        className="absolute inset-[-5%] rounded-full pointer-events-none"
        style={{
          opacity: 0.3,
          background: `conic-gradient(from 90deg at 50% 50%, transparent 0deg, ${colors.ember.bright}40 90deg, transparent 180deg, ${colors.ember.glow}30 270deg, transparent 360deg)`,
          filter: 'blur(8px)',
          animation: 'spin 20s linear infinite',
        }}
      />

      <div style={{ animation: 'mechanicFloat 4s ease-in-out infinite' }}>
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

            {/* Mechanic cap gradient - ember colored */}
            <linearGradient id={`${id}-cap`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={colors.ember.shimmer} />
              <stop offset="15%" stopColor={colors.ember.bright} />
              <stop offset="40%" stopColor={colors.ember.base} />
              <stop offset="70%" stopColor={colors.ember.dark} />
              <stop offset="100%" stopColor={colors.ember.darker} />
            </linearGradient>

            <linearGradient id={`${id}-cap-shine`} x1="20%" y1="0%" x2="80%" y2="100%">
              <stop offset="0%" stopColor="white" stopOpacity="0.7" />
              <stop offset="20%" stopColor="white" stopOpacity="0.3" />
              <stop offset="50%" stopColor="white" stopOpacity="0.1" />
              <stop offset="100%" stopColor="white" stopOpacity="0" />
            </linearGradient>

            {/* Overalls gradient - blue mechanic style */}
            <linearGradient id={`${id}-overalls`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#60a5fa" />
              <stop offset="20%" stopColor={colors.fabric.overalls} />
              <stop offset="60%" stopColor={colors.fabric.overallsDark} />
              <stop offset="100%" stopColor={colors.fabric.patch} />
            </linearGradient>

            {/* Undershirt - dark gray */}
            <linearGradient id={`${id}-shirt`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#4a4a4a" />
              <stop offset="50%" stopColor="#3a3a3a" />
              <stop offset="100%" stopColor="#2a2a2a" />
            </linearGradient>

            {/* Pants gradient */}
            <linearGradient id={`${id}-pants`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={colors.fabric.overalls} />
              <stop offset="30%" stopColor={colors.fabric.overallsDark} />
              <stop offset="100%" stopColor={colors.fabric.patch} />
            </linearGradient>

            {/* Metal for tools and accessories */}
            <linearGradient id={`${id}-metal`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={colors.metal.highlight} />
              <stop offset="15%" stopColor={colors.metal.light} />
              <stop offset="40%" stopColor={colors.metal.base} />
              <stop offset="70%" stopColor={colors.metal.dark} />
              <stop offset="100%" stopColor={colors.metal.darker} />
            </linearGradient>

            {/* Iris gradient */}
            <radialGradient id={`${id}-iris`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#1c1917" />
              <stop offset="30%" stopColor="#3d2c1e" />
              <stop offset="60%" stopColor="#5c4033" />
              <stop offset="80%" stopColor="#4a3428" />
              <stop offset="100%" stopColor="#3d2c1e" />
            </radialGradient>

            {/* Hair gradient */}
            <linearGradient id={`${id}-hair`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#3a3530" />
              <stop offset="40%" stopColor="#2a2520" />
              <stop offset="100%" stopColor="#1a1510" />
            </linearGradient>

            {/* Ember fresnel edge */}
            <radialGradient id={`${id}-fresnel-edge`} cx="50%" cy="30%" r="80%">
              <stop offset="50%" stopColor="transparent" />
              <stop offset="85%" stopColor={colors.ember.base} stopOpacity="0.3" />
              <stop offset="95%" stopColor={colors.ember.glow} stopOpacity="0.5" />
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

            {/* Ember glow */}
            <filter id={`${id}-ember-glow`} x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="3" result="blur1" />
              <feFlood floodColor={colors.ember.base} floodOpacity="0.6" />
              <feComposite in2="blur1" operator="in" result="glow" />
              <feMerge>
                <feMergeNode in="glow" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
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
            <line x1="32" y1="70" x2="31" y2="88" stroke="#1e3a8a" strokeWidth="0.3" opacity="0.4" />
            
            {/* Left boot - work boots */}
            <path
              d="M 26 87 Q 24 91 26 94 L 39 94 Q 42 91 39 87 L 37 87 Q 35 89 33 89 Q 31 89 29 87 Z"
              fill="#292524"
              filter={`url(#${id}-contact-shadow)`}
            />
            <path d="M 27 93 L 39 93 L 39 95 L 27 95 Z" fill="#1c1917" />
            <ellipse cx="33" cy="89" rx="4" ry="1.5" fill="white" opacity="0.06" />
            {/* Steel toe cap */}
            <path d="M 27 91 Q 30 93 33 91" stroke={colors.metal.base} strokeWidth="1" fill="none" opacity="0.4" />

            {/* Right leg */}
            <path
              d="M 44 68 L 42 90 Q 42 94 46 94 L 50 94 Q 52 94 52 90 L 50 68"
              fill={`url(#${id}-pants)`}
              filter={`url(#${id}-soft-shadow)`}
            />
            <line x1="48" y1="70" x2="49" y2="88" stroke="#1e3a8a" strokeWidth="0.3" opacity="0.4" />
            
            {/* Right boot */}
            <path
              d="M 41 87 Q 39 91 41 94 L 54 94 Q 57 91 54 87 L 52 87 Q 50 89 48 89 Q 46 89 44 87 Z"
              fill="#292524"
              filter={`url(#${id}-contact-shadow)`}
            />
            <path d="M 42 93 L 54 93 L 54 95 L 42 95 Z" fill="#1c1917" />
            <ellipse cx="48" cy="89" rx="4" ry="1.5" fill="white" opacity="0.06" />
            {/* Steel toe cap */}
            <path d="M 42 91 Q 45 93 48 91" stroke={colors.metal.base} strokeWidth="1" fill="none" opacity="0.4" />
          </g>

          {/* === LAYER 2: TORSO === */}
          <g>
            {/* Undershirt visible at neck */}
            <path
              d="M 32 42 Q 40 46 48 42 L 48 48 Q 40 52 32 48 Z"
              fill={`url(#${id}-shirt)`}
            />

            {/* Overalls bib */}
            <path
              d="M 22 42 Q 18 45 18 52 L 18 70 Q 18 74 24 74 L 56 74 Q 62 74 62 70 L 62 52 Q 62 45 58 42 L 52 38 L 28 38 Z"
              fill={`url(#${id}-overalls)`}
              filter={`url(#${id}-shadow)`}
            />
            
            {/* Overalls highlight */}
            <path
              d="M 22 42 Q 18 45 18 52 L 18 55 Q 30 52 40 55 Q 50 52 62 55 L 62 52 Q 62 45 58 42 L 52 38 L 28 38 Z"
              fill="white"
              opacity="0.08"
            />

            {/* Overall straps */}
            <path d="M 30 42 L 28 72" stroke="#1e40af" strokeWidth="3" strokeLinecap="round" />
            <path d="M 50 42 L 52 72" stroke="#1e40af" strokeWidth="3" strokeLinecap="round" />
            
            {/* Strap buckles - metal */}
            <rect x="27" y="44" width="4" height="3" rx="0.5" fill={`url(#${id}-metal)`} />
            <rect x="49" y="44" width="4" height="3" rx="0.5" fill={`url(#${id}-metal)`} />

            {/* Chest pocket */}
            <rect x="44" y="50" width="10" height="8" rx="1" fill="#1e40af" stroke="#1e3a8a" strokeWidth="0.5" />
            <rect x="45" y="51" width="8" height="1" rx="0.3" fill="#60a5fa" opacity="0.3" />
            
            {/* Wrench sticking out of pocket */}
            <g filter={`url(#${id}-ember-glow)`}>
              <rect x="46" y="48" width="2" height="8" rx="0.5" fill={`url(#${id}-metal)`} />
              <circle cx="47" cy="47" r="2" fill={`url(#${id}-metal)`} />
              <circle cx="47" cy="47" r="1" fill={colors.metal.darker} />
            </g>

            {/* Name patch - ember accent */}
            <g filter={`url(#${id}-ember-glow)`}>
              <rect x="26" y="52" width="12" height="6" rx="1" fill={colors.ember.base} />
              <rect x="27" y="53" width="10" height="4" rx="0.5" fill={colors.ember.dark} />
              <text x="32" y="56.5" fontSize="3" fill="white" textAnchor="middle" fontWeight="bold">MECH</text>
            </g>

            {/* Tool belt */}
            <rect x="22" y="66" width="36" height="5" rx="1" fill="#44403c" />
            <rect x="22" y="66" width="36" height="2" rx="0.5" fill="#57534e" />
            
            {/* Belt buckle - ember */}
            <rect x="36" y="65" width="8" height="7" rx="1" fill={`url(#${id}-cap)`} filter={`url(#${id}-ember-glow)`} />
            <rect x="38" y="67" width="4" height="3" rx="0.3" fill={colors.ember.darker} />
            
            {/* Tools on belt */}
            <rect x="24" y="68" width="3" height="6" rx="0.5" fill={colors.metal.base} /> {/* Screwdriver */}
            <rect x="54" y="68" width="4" height="5" rx="0.5" fill={colors.metal.dark} /> {/* Pliers handle */}
          </g>

          {/* === ARMS === */}
          <g>
            {/* Left arm holding wrench */}
            <path
              d="M 18 44 Q 12 48 10 56 L 8 68 Q 8 70 10 70 L 14 68 Q 16 66 17 62 L 19 52 Q 20 48 18 44"
              fill={`url(#${id}-overalls)`}
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
            {/* Hand */}
            <ellipse cx="10" cy="70" rx="4.5" ry="3.5" fill={`url(#${id}-skin-face)`} filter={`url(#${id}-sss)`} />
            {/* Grease smudge on hand */}
            <ellipse cx="9" cy="71" rx="2" ry="1" fill={colors.grease.stain} opacity="0.3" />
            
            {/* Big wrench in hand */}
            <g filter={`url(#${id}-ember-glow)`} transform="translate(2, 62) rotate(-30)">
              <rect x="0" y="0" width="4" height="18" rx="1" fill={`url(#${id}-metal)`} />
              <path d="M -2 -2 Q -3 -4 -1 -5 L 5 -5 Q 7 -4 6 -2 L 4 0 L 0 0 Z" fill={`url(#${id}-metal)`} />
              <ellipse cx="2" cy="-3.5" rx="1.5" ry="1" fill="none" stroke={colors.metal.darker} strokeWidth="1" />
            </g>

            {/* Right arm - relaxed */}
            <path
              d="M 62 44 Q 68 46 70 52 L 70 64 Q 70 66 68 66 L 64 64 Q 62 62 62 58 L 62 48"
              fill={`url(#${id}-overalls)`}
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
            {/* Hand */}
            <ellipse cx="68" cy="66" rx="4.5" ry="3.5" fill={`url(#${id}-skin-face)`} filter={`url(#${id}-sss)`} />
            {/* Grease smudge */}
            <ellipse cx="69" cy="65" rx="1.5" ry="1" fill={colors.grease.stain} opacity="0.4" />
          </g>

          {/* === LAYER 3: HEAD === */}
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
            <ellipse cx="31" cy="30" rx="4" ry="2.5" fill={`url(#${id}-cheek-blush)`} opacity="0.4" />
            <ellipse cx="49" cy="30" rx="4" ry="2.5" fill={`url(#${id}-cheek-blush)`} opacity="0.4" />

            {/* Cheek highlights */}
            <ellipse cx="32" cy="29" rx="3" ry="2" fill={colors.skin.highlight} opacity="0.4" />
            <ellipse cx="48" cy="29" rx="3" ry="2" fill={colors.skin.highlight} opacity="0.4" />

            {/* Forehead highlight */}
            <ellipse cx="40" cy="18" rx="6" ry="3" fill={colors.skin.highlight} opacity="0.3" />

            {/* Grease smudge on forehead */}
            <ellipse cx="44" cy="19" rx="3" ry="1" fill={colors.grease.stain} opacity="0.25" transform="rotate(-15 44 19)" />

            {/* Hair peeking from cap */}
            <g opacity="0.8">
              <path d="M 25 24 Q 24 22 25 19" stroke={`url(#${id}-hair)`} strokeWidth="1.2" fill="none" strokeLinecap="round" />
              <path d="M 26 25 Q 24.5 23 26 20" stroke={`url(#${id}-hair)`} strokeWidth="0.8" fill="none" strokeLinecap="round" />
              <path d="M 55 24 Q 56 22 55 19" stroke={`url(#${id}-hair)`} strokeWidth="1.2" fill="none" strokeLinecap="round" />
              <path d="M 54 25 Q 55.5 23 54 20" stroke={`url(#${id}-hair)`} strokeWidth="0.8" fill="none" strokeLinecap="round" />
            </g>

            {/* Eyebrows - focused, slightly furrowed */}
            <g>
              <path 
                d="M 31 21 Q 35 19.5 39 21.5" 
                stroke="#3a3530" 
                strokeWidth="1.6" 
                strokeLinecap="round" 
                fill="none"
              />
              <path 
                d="M 41 21.5 Q 45 19.5 49 21" 
                stroke="#3a3530" 
                strokeWidth="1.6" 
                strokeLinecap="round" 
                fill="none"
              />
            </g>

            {/* Eyes - focused, determined */}
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

            {/* Mouth - slight determined grin */}
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

            {/* 5 o'clock shadow / stubble */}
            <g opacity="0.2">
              {[...Array(16)].map((_, i) => (
                <circle
                  key={i}
                  cx={34 + (i % 4) * 3}
                  cy={35 + Math.floor(i / 4) * 2}
                  r="0.4"
                  fill={colors.skin.deep}
                />
              ))}
            </g>

            {/* MECHANIC CAP - ember colored */}
            <g filter={`url(#${id}-ember-glow)`}>
              {/* Cap main body */}
              <path
                d="M 22 18 Q 22 8 40 6 Q 58 8 58 18 L 56 22 Q 40 24 24 22 Z"
                fill={`url(#${id}-cap)`}
              />
              
              {/* Cap brim */}
              <path
                d="M 20 22 Q 20 18 28 18 L 52 18 Q 60 18 60 22 Q 58 26 40 26 Q 22 26 20 22"
                fill={`url(#${id}-cap)`}
              />
              <path
                d="M 22 22 Q 22 20 30 20 L 50 20 Q 58 20 58 22"
                fill={colors.ember.darker}
                opacity="0.5"
              />
              
              {/* Cap shine */}
              <path d="M 28 9 Q 40 6 52 9" stroke="white" strokeWidth="1.5" fill="none" opacity="0.3" />
              <ellipse cx="35" cy="12" rx="8" ry="4" fill={`url(#${id}-cap-shine)`} />
              
              {/* Cap stitching */}
              <path d="M 40 6 L 40 20" stroke={colors.ember.darker} strokeWidth="0.5" strokeDasharray="2,1" opacity="0.4" />
              
              {/* ATTS logo on cap */}
              <g>
                <circle cx="40" cy="14" r="4" fill={colors.ember.darker} />
                <circle cx="40" cy="14" r="3" fill={colors.ember.dark} />
                <text x="40" y="15.5" fontSize="3.5" fill="white" textAnchor="middle" fontWeight="bold">A</text>
              </g>
              
              {/* Brim edge highlight */}
              <path d="M 22 25 Q 40 27 58 25" stroke={colors.ember.bright} strokeWidth="0.5" fill="none" opacity="0.4" />
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
              stroke={colors.ember.base} 
              strokeWidth="0.8"
              opacity="0.4"
              style={{
                strokeDasharray: '80 20',
              }}
            />
          </g>
        </svg>
      </div>
    </div>
  );
}

export const MechanicAvatar = memo(MechanicAvatarComponent);
export default MechanicAvatar;

