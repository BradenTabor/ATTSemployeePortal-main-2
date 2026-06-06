/**
 * ATTS surface system — solid premium surfaces with layered shadows and top-highlight.
 * No glassmorphism (no backdrop-blur or bg-white/[N] on major surfaces).
 * Use these constants for all cards, panels, modals, and inputs.
 */
export const glass = {
  /** Standard card — dashboards, stat cards, form panels */
  card:
    "bg-gray-900 border border-white/[0.06] rounded-2xl " +
    "shadow-[0_1px_3px_rgba(0,0,0,0.5),0_4px_16px_rgba(0,0,0,0.25),inset_0_1px_0_rgba(255,255,255,0.04)]",

  /** Elevated — modals, drawers, floating panels */
  elevated:
    "bg-gray-800 border border-white/[0.08] rounded-2xl " +
    "shadow-[0_2px_8px_rgba(0,0,0,0.6),0_16px_40px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.06)]",

  /** Subtle — nested inner panels, search bar, pagination strip */
  subtle:
    "bg-[#0d1117] border border-white/[0.04] rounded-xl " +
    "shadow-[0_1px_2px_rgba(0,0,0,0.3)]",

  /** Employee dashboard card — emerald-tinted solid surface */
  cardEmerald:
    "rounded-2xl border border-emerald-500/[0.12] " +
    "bg-gradient-to-br from-[#061f16] via-[#04180f] to-[#020e09] " +
    "shadow-[0_1px_3px_rgba(0,0,0,0.5),0_4px_16px_rgba(6,50,30,0.25),inset_0_1px_0_rgba(167,243,208,0.04)]",

  /** Employee dashboard inner panels — nested emerald surface */
  subtleEmerald:
    "rounded-xl border border-emerald-500/[0.08] " +
    "bg-gradient-to-br from-[#041810]/60 to-[#020e09]/40 " +
    "shadow-[0_1px_2px_rgba(0,0,0,0.3)]",

  /** Danger — confirmation dialogs, error surfaces */
  danger:
    "bg-red-950 border border-red-500/[0.18] rounded-2xl " +
    "shadow-[0_4px_16px_rgba(127,29,29,0.3),inset_0_1px_0_rgba(255,255,255,0.04)]",

  /** Success — completed/approved surfaces */
  success:
    "bg-green-950 border border-green-500/[0.18] rounded-2xl " +
    "shadow-[0_4px_16px_rgba(20,83,45,0.3),inset_0_1px_0_rgba(255,255,255,0.04)]",

  /** Safety Officer dashboard — evolved rose palette, warm and sophisticated */
  cardRed:
    "rounded-2xl border border-rose-500/20 " +
    "bg-gradient-to-br from-rose-950/80 via-rose-950/40 to-gray-900 " +
    "shadow-[0_1px_3px_rgba(0,0,0,0.5),0_4px_16px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(251,207,210,0.06)]",

  /** Safety Officer dashboard — inner panels and quick links */
  subtleRed:
    "rounded-xl border border-rose-500/20 " +
    "bg-gradient-to-br from-rose-950/30 to-[#0f1216] " +
    "shadow-[0_1px_2px_rgba(0,0,0,0.3)]",

  /** Safety Officer cockpit — ultra-dense metric cells, no gradient, warm stone base */
  cockpit:
    "bg-[#0c0a09] border border-rose-500/[0.10] rounded-xl " +
    "shadow-[0_1px_2px_rgba(0,0,0,0.4)]",

  /** Safety Officer command bar — spotlight surface for quick-access navigation */
  commandBar:
    "bg-[#0d0b0a] border border-rose-500/[0.12] rounded-2xl " +
    "shadow-[0_2px_8px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(251,207,210,0.04)]",

  /** Incident card — Double-Bezel outer shell with danger tint (used for SafetyIncidentsList) */
  incidentOuter:
    "rounded-[1.25rem] p-[5px] " +
    "bg-gradient-to-br from-rose-950/40 via-[#0c0404]/60 to-[#080202]/80 " +
    "ring-1 ring-rose-500/[0.12] " +
    "shadow-[0_2px_8px_rgba(159,18,57,0.15),0_8px_32px_rgba(0,0,0,0.4)]",

  /** Incident card — Double-Bezel inner core */
  incidentInner:
    "rounded-[calc(1.25rem-5px)] " +
    "bg-gradient-to-br from-[#0d0505] via-[#0a0303] to-[#060101] " +
    "shadow-[inset_0_1px_1px_rgba(251,207,210,0.06),inset_0_-1px_1px_rgba(0,0,0,0.3)] " +
    "border border-rose-500/[0.08]",

  /** Incident detail modal — elevated danger surface */
  incidentModal:
    "rounded-[1.25rem] " +
    "bg-gradient-to-br from-[#120606] via-[#0a0303] to-[#040101] " +
    "border border-rose-500/[0.15] " +
    "shadow-[0_4px_24px_rgba(159,18,57,0.2),0_16px_48px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(251,207,210,0.06)]",

  /** General Foreman dashboard — purple-tinted card with role accent border */
  cardPurple:
    "rounded-2xl border border-purple-500/25 " +
    "bg-gradient-to-br from-purple-950/90 via-purple-950/40 to-gray-900 " +
    "shadow-[0_1px_3px_rgba(0,0,0,0.5),0_4px_16px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(233,213,255,0.08)]",

  /** General Foreman — inner panels and stat blocks */
  subtlePurple:
    "rounded-xl border border-purple-500/20 " +
    "bg-gradient-to-br from-purple-950/35 to-[#0d0a17] " +
    "shadow-[0_1px_2px_rgba(0,0,0,0.3)]",

  /** Admin / rewards — gold-tinted card with warm accent border */
  cardGold:
    "rounded-2xl border border-[#f6dcb2]/20 " +
    "bg-gradient-to-br from-[#14110d] via-[#0b0906] to-[#050403] " +
    "shadow-[0_1px_3px_rgba(0,0,0,0.5),0_4px_16px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(246,220,178,0.06)]",

  /** Admin — inner panels, stat blocks, table sections (lighter warm gold base) */
  subtleGold:
    "rounded-xl border border-[#f6dcb2]/15 " +
    "bg-gradient-to-br from-[#1b1914] via-[#120f0c] to-[#080705] " +
    "shadow-[0_1px_2px_rgba(0,0,0,0.3)]",

  /** Foreman dashboard — blue-tinted card with role accent border.
   *  Consolidates the freestyle `from-[#0a1628] ... to-[#020408]` foreman panels. */
  cardBlue:
    "rounded-2xl border border-[#bfdbfe]/20 " +
    "bg-gradient-to-br from-[#0a1628] via-[#0a1020] to-[#020408] " +
    "shadow-[0_1px_3px_rgba(0,0,0,0.5),0_4px_16px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(191,219,254,0.06)]",

  /** Foreman — inner panels and stat blocks (deeper blue base) */
  subtleBlue:
    "rounded-xl border border-[#bfdbfe]/15 " +
    "bg-gradient-to-br from-[#0a1628] via-[#060d18] to-[#020408] " +
    "shadow-[0_1px_2px_rgba(0,0,0,0.3)]",

  /** Mechanic dashboard — ember-tinted card (orange accent border).
   *  Consolidates freestyle `from-[#1f0f09] via-[#150906] to-[#0a0504]` mechanic panels. */
  cardEmber:
    "rounded-2xl border border-orange-500/20 " +
    "bg-gradient-to-br from-[#1f0f09] via-[#150906] to-[#0a0504] " +
    "shadow-[0_1px_3px_rgba(0,0,0,0.5),0_4px_16px_rgba(127,53,11,0.2),inset_0_1px_0_rgba(251,146,60,0.06)]",

  /** Mechanic — nav cards, compact panels, inner surfaces */
  subtleEmber:
    "rounded-xl border border-orange-500/20 " +
    "bg-gradient-to-br from-[#1a0c08] via-[#120504] to-[#0f0705] " +
    "shadow-[0_1px_2px_rgba(0,0,0,0.3)]",
} as const;
