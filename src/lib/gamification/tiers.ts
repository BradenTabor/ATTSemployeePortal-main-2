/** Visual + copy theming for the lifetime-earned tier ladder (Seedling → Redwood). */

export interface TierTheme {
  tierKey: string;
  label: string;
  accentClass: string;
  barClass: string;
  ringClass: string;
  glow: string;
  textureOpacity: number;
}

const TIER_THEMES: Record<string, TierTheme> = {
  seedling: {
    tierKey: 'seedling',
    label: 'Seedling',
    accentClass: 'text-lime-300',
    barClass: 'from-lime-600 via-lime-400 to-emerald-300',
    ringClass: 'ring-lime-400/40',
    glow: 'rgba(132, 204, 22, 0.25)',
    textureOpacity: 0.08,
  },
  sapling: {
    tierKey: 'sapling',
    label: 'Sapling',
    accentClass: 'text-emerald-300',
    barClass: 'from-emerald-700 via-emerald-500 to-teal-300',
    ringClass: 'ring-emerald-400/45',
    glow: 'rgba(16, 185, 129, 0.28)',
    textureOpacity: 0.1,
  },
  rooted: {
    tierKey: 'rooted',
    label: 'Rooted',
    accentClass: 'text-teal-300',
    barClass: 'from-teal-800 via-teal-600 to-cyan-300',
    ringClass: 'ring-teal-400/45',
    glow: 'rgba(20, 184, 166, 0.3)',
    textureOpacity: 0.12,
  },
  mature: {
    tierKey: 'mature',
    label: 'Mature',
    accentClass: 'text-amber-200',
    barClass: 'from-amber-800 via-amber-600 to-yellow-300',
    ringClass: 'ring-amber-400/50',
    glow: 'rgba(245, 158, 11, 0.32)',
    textureOpacity: 0.14,
  },
  towering: {
    tierKey: 'towering',
    label: 'Towering',
    accentClass: 'text-orange-200',
    barClass: 'from-orange-900 via-orange-700 to-amber-300',
    ringClass: 'ring-orange-400/50',
    glow: 'rgba(249, 115, 22, 0.35)',
    textureOpacity: 0.15,
  },
  canopy: {
    tierKey: 'canopy',
    label: 'Canopy',
    accentClass: 'text-sky-200',
    barClass: 'from-sky-900 via-sky-700 to-blue-300',
    ringClass: 'ring-sky-400/50',
    glow: 'rgba(56, 189, 248, 0.35)',
    textureOpacity: 0.16,
  },
  old_growth: {
    tierKey: 'old_growth',
    label: 'Old Growth',
    accentClass: 'text-violet-200',
    barClass: 'from-violet-900 via-violet-700 to-fuchsia-300',
    ringClass: 'ring-violet-400/55',
    glow: 'rgba(167, 139, 250, 0.38)',
    textureOpacity: 0.18,
  },
  redwood: {
    tierKey: 'redwood',
    label: 'Redwood',
    accentClass: 'text-rose-200',
    barClass: 'from-rose-950 via-red-800 to-amber-200',
    ringClass: 'ring-rose-400/60',
    glow: 'rgba(244, 63, 94, 0.4)',
    textureOpacity: 0.2,
  },
};

const FALLBACK_THEME = TIER_THEMES.sapling;

export function getTierTheme(tierKey: string): TierTheme {
  return TIER_THEMES[tierKey] ?? FALLBACK_THEME;
}

export function formatTierLabel(tierName: string, subLevelLabel: string): string {
  return `${tierName} ${subLevelLabel}`;
}

export const PRESTIGE_LABELS = ['Bronze', 'Silver', 'Gold'] as const;

export function getPrestigeLabel(tier: number): string {
  return PRESTIGE_LABELS[Math.min(Math.max(tier - 1, 0), 2)] ?? 'Bronze';
}

/** Wood-grain / growth-ring background for gamification surfaces. */
export const GROWTH_TEXTURE_STYLE: Record<string, string> = {
  backgroundImage: `
    radial-gradient(circle at 20% 30%, rgba(120, 83, 45, 0.12) 0%, transparent 45%),
    radial-gradient(circle at 80% 70%, rgba(74, 55, 40, 0.1) 0%, transparent 40%),
    repeating-radial-gradient(circle at 50% 50%, transparent 0, transparent 8px, rgba(255,255,255,0.015) 8px, rgba(255,255,255,0.015) 9px)
  `,
};
