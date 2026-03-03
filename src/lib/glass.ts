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

  /** Danger — confirmation dialogs, error surfaces */
  danger:
    "bg-red-950 border border-red-500/[0.18] rounded-2xl " +
    "shadow-[0_4px_16px_rgba(127,29,29,0.3),inset_0_1px_0_rgba(255,255,255,0.04)]",

  /** Success — completed/approved surfaces */
  success:
    "bg-green-950 border border-green-500/[0.18] rounded-2xl " +
    "shadow-[0_4px_16px_rgba(20,83,45,0.3),inset_0_1px_0_rgba(255,255,255,0.04)]",

  /** Safety Officer dashboard — red/white gradient tint, consistent with role theme */
  cardRed:
    "rounded-2xl border border-red-500/25 " +
    "bg-gradient-to-br from-red-950/90 via-red-950/40 to-gray-900 " +
    "shadow-[0_1px_3px_rgba(0,0,0,0.5),0_4px_16px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(254,202,202,0.08)]",

  /** Safety Officer dashboard — inner panels and quick links (same red family as cardRed) */
  subtleRed:
    "rounded-xl border border-red-500/25 " +
    "bg-gradient-to-br from-red-950/35 to-[#0f1216] " +
    "shadow-[0_1px_2px_rgba(0,0,0,0.3)]",
} as const;
