/** @type {import('tailwindcss').Config} */

/**
 * CANOPY design tokens — green · white · black.
 *
 * ink      dark scale with a green undertone (page + surfaces)
 * bone     warm off-white scale (text)
 * verdant  the brand green scale (accent, success)
 * lime     acid highlight — used sparingly for "alive" edges
 *
 * The legacy Tailwind neutral scales (gray/slate/zinc/neutral/stone) are
 * re-pointed at `ink`/`bone`, and green/emerald at `verdant`, so every
 * existing class in the codebase lands on the new palette automatically.
 */
const ink = {
  50: '#F4F7F2',
  100: '#E4EAE1',
  200: '#D3DCD1',
  300: '#B8C4B6',
  400: '#8A9A8E',
  500: '#5A6B60',
  600: '#2F3F36',
  700: '#1E2A23',
  800: '#121A15',
  900: '#0B100D',
  950: '#040605',
};

const verdant = {
  50: '#EFFFF3',
  100: '#D9FFE3',
  200: '#C8FFD4',
  300: '#8DF5A8',
  400: '#5EE898',
  500: '#3DDC84',
  600: '#2FA45A',
  700: '#1F7A44',
  800: '#12482A',
  900: '#0A2A19',
  950: '#05170E',
};

const bone = {
  50: '#F4F7F2',
  100: '#E4EAE1',
  200: '#D3DCD1',
  300: '#B8C4B6',
  400: '#8A9A8E',
  500: '#5A6B60',
};

const lime = {
  50: '#F6FFE6',
  100: '#EEFFD4',
  200: '#E4FFC2',
  300: '#D2FFA3',
  400: '#B8FF7A',
  500: '#9BEB5B',
  600: '#7CC43F',
  700: '#5E9A2C',
  800: '#3F6B1C',
  900: '#25400F',
  950: '#132308',
};

/** Role tints — every role stays inside green · white · black. */
const moss = {
  50: '#ECFBF3',
  100: '#D6F7E5',
  200: '#B5F0D0',
  300: '#7FE0B0',
  400: '#4CCB8F',
  500: '#2FB47A',
  600: '#22895C',
  700: '#176544',
  800: '#0F4530',
  900: '#092B1E',
  950: '#04160F',
};

const glacier = {
  50: '#F4FBF7',
  100: '#E6F6EC',
  200: '#CFEEDB',
  300: '#B4E6C9',
  400: '#9ADDB7',
  500: '#7DCDA2',
  600: '#5FAF86',
  700: '#468A68',
  800: '#2F5F48',
  900: '#1C3B2C',
  950: '#0E2118',
};

const sap = {
  50: '#FBFFE8',
  100: '#F5FFD1',
  200: '#ECFFAE',
  300: '#DDFF85',
  400: '#C8F55E',
  500: '#AEDB3F',
  600: '#8DB52A',
  700: '#6B8A1F',
  800: '#4A6116',
  900: '#2E3D0E',
  950: '#182107',
};

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Bricolage Grotesque"', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Fraunces', 'Georgia', 'serif'],
        mono: ['"Martian Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      screens: {
        xs: '375px',
      },
      colors: {
        ink,
        bone,
        verdant,
        lime,
        // The legacy "gold" admin brand + amber warnings both re-point at the
        // acid-lime scale: yellow-green is the closest brand-legal hue that
        // still reads as "attention".
        amber: lime,
        yellow: lime,
        moss,
        glacier,
        sap,
        // Role brands: general_foreman (purple) → moss/jade, foreman (blue) →
        // glacier/ice-mint, mechanic (orange) → sap/chartreuse. Red/rose are
        // left alone — they are semantic (errors, safety officer).
        purple: moss,
        violet: moss,
        fuchsia: moss,
        indigo: moss,
        blue: glacier,
        sky: glacier,
        cyan: glacier,
        teal: verdant,
        orange: sap,
        gray: ink,
        slate: ink,
        zinc: ink,
        neutral: ink,
        stone: ink,
        green: verdant,
        emerald: verdant,
        accessibleMuted: '#B8C4B6',
      },
      borderRadius: {
        leaf: '28px 8px 28px 8px',
        'leaf-sm': '18px 6px 18px 6px',
        'leaf-xs': '12px 4px 12px 4px',
        'leaf-lg': '40px 12px 40px 12px',
        'leaf-r': '8px 28px 8px 28px',
        'leaf-r-sm': '6px 18px 6px 18px',
      },
      boxShadow: {
        slab: '0 1px 0 rgba(244,247,242,0.06) inset, 0 24px 48px -24px rgba(0,0,0,0.9), 0 2px 6px rgba(0,0,0,0.5)',
        'slab-lg': '0 1px 0 rgba(244,247,242,0.08) inset, 0 40px 80px -32px rgba(0,0,0,0.95), 0 4px 12px rgba(0,0,0,0.6)',
        glow: '0 0 0 1px rgba(61,220,132,0.25), 0 0 40px -8px rgba(61,220,132,0.45)',
        'glow-lime': '0 0 0 1px rgba(184,255,122,0.3), 0 0 48px -8px rgba(184,255,122,0.5)',
      },
      transitionTimingFunction: {
        canopy: 'cubic-bezier(0.16, 1, 0.3, 1)',
        'canopy-in': 'cubic-bezier(0.7, 0, 0.84, 0)',
      },
      keyframes: {
        unfurl: {
          '0%': { opacity: '0', transform: 'translateY(14px) rotateX(8deg)', clipPath: 'inset(0 0 100% 0 round 28px 8px)' },
          '100%': { opacity: '1', transform: 'translateY(0) rotateX(0)', clipPath: 'inset(0 0 0 0 round 28px 8px)' },
        },
        drift: {
          '0%, 100%': { transform: 'translate3d(0,0,0) rotate(0deg)' },
          '50%': { transform: 'translate3d(0,-10px,0) rotate(1.5deg)' },
        },
        breathe: {
          '0%, 100%': { opacity: '0.55', transform: 'scale(1)' },
          '50%': { opacity: '1', transform: 'scale(1.04)' },
        },
        sheen: {
          '0%': { transform: 'translateX(-140%) skewX(-18deg)' },
          '100%': { transform: 'translateX(260%) skewX(-18deg)' },
        },
        grain: {
          '0%, 100%': { transform: 'translate(0,0)' },
          '20%': { transform: 'translate(-2%,1%)' },
          '40%': { transform: 'translate(1%,-2%)' },
          '60%': { transform: 'translate(2%,2%)' },
          '80%': { transform: 'translate(-1%,-1%)' },
        },
        'pulse-ring': {
          '0%': { transform: 'scale(0.9)', opacity: '0.8' },
          '100%': { transform: 'scale(1.6)', opacity: '0' },
        },
        marquee: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
      },
      animation: {
        unfurl: 'unfurl 0.9s cubic-bezier(0.16, 1, 0.3, 1) both',
        drift: 'drift 9s ease-in-out infinite',
        breathe: 'breathe 5s ease-in-out infinite',
        sheen: 'sheen 1.4s cubic-bezier(0.16, 1, 0.3, 1) 1',
        grain: 'grain 1.2s steps(6) infinite',
        'pulse-ring': 'pulse-ring 1.8s cubic-bezier(0.16, 1, 0.3, 1) infinite',
        marquee: 'marquee 40s linear infinite',
      },
    },
  },
  plugins: [],
};
