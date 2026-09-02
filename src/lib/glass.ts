/**
 * CANOPY surface system.
 *
 * Every surface is a "slab": an ink body with a one-pixel bone highlight along
 * the top edge and a deep, soft drop so it reads as a physical object resting in
 * the understory. The asymmetric "leaf" radius (rounded-leaf / rounded-leaf-sm)
 * is the signature silhouette.
 *
 * Role tints (all within green · white · black, except safety = red which is a
 * justified safety-critical exception):
 *   emerald  → verdant (employee default)
 *   gold     → platinum (admin: bone-white forward, lime hairline)
 *   purple   → moss (general foreman: deep saturated green)
 *   blue     → glacier (foreman: cool bone/mint)
 *   ember    → sap (mechanic: yellow-green)
 *   red      → safety (safety officer)
 *
 * Key names are preserved from the previous system so 57 call-sites re-theme
 * without edits.
 */

const SLAB_SHADOW =
  "shadow-[inset_0_1px_0_rgba(244,247,242,0.07),0_2px_6px_rgba(0,0,0,0.5),0_24px_48px_-24px_rgba(0,0,0,0.9)]";
const SLAB_SHADOW_LG =
  "shadow-[inset_0_1px_0_rgba(244,247,242,0.09),0_4px_12px_rgba(0,0,0,0.6),0_40px_80px_-32px_rgba(0,0,0,0.95)]";
const SLAB_SHADOW_SM = "shadow-[inset_0_1px_0_rgba(244,247,242,0.05),0_1px_2px_rgba(0,0,0,0.4)]";

export const glass = {
  /** Standard card — dashboards, stat cards, form panels */
  card: `bg-ink-900 border border-bone-50/[0.07] rounded-leaf ${SLAB_SHADOW}`,

  /** Elevated — modals, drawers, floating panels */
  elevated: `bg-ink-800 border border-bone-50/[0.1] rounded-leaf ${SLAB_SHADOW_LG}`,

  /** Subtle — nested inner panels, search bar, pagination strip */
  subtle: `bg-ink-950/80 border border-bone-50/[0.05] rounded-leaf-sm ${SLAB_SHADOW_SM}`,

  /** Employee dashboard card — verdant-tinted slab */
  cardEmerald:
    "rounded-leaf border border-verdant-500/[0.16] " +
    "bg-[linear-gradient(160deg,#0a2a19_0%,#0b100d_45%,#040605_100%)] " +
    "shadow-[inset_0_1px_0_rgba(200,255,212,0.08),0_2px_6px_rgba(0,0,0,0.5),0_24px_48px_-24px_rgba(5,23,14,0.9)]",

  /** Employee dashboard inner panels — nested verdant surface */
  subtleEmerald:
    "rounded-leaf-sm border border-verdant-500/[0.1] " +
    "bg-[linear-gradient(160deg,rgba(10,42,25,0.6),rgba(4,6,5,0.4))] " +
    SLAB_SHADOW_SM,

  /** Danger — confirmation dialogs, error surfaces */
  danger:
    "bg-[#132308] border border-red-500/[0.22] rounded-leaf " +
    "shadow-[inset_0_1px_0_rgba(254,202,202,0.06),0_4px_16px_rgba(127,29,29,0.3)]",

  /** Success — completed/approved surfaces */
  success:
    "bg-verdant-950 border border-verdant-500/[0.22] rounded-leaf " +
    "shadow-[inset_0_1px_0_rgba(200,255,212,0.06),0_4px_16px_rgba(10,42,25,0.4)]",

  /** Safety Officer — red slab (safety-critical exception to the green brand) */
  cardRed:
    "rounded-leaf border border-rose-500/25 " +
    "bg-[linear-gradient(160deg,#2a0a0e_0%,#12080a_45%,#040605_100%)] " +
    "shadow-[inset_0_1px_0_rgba(251,207,210,0.08),0_2px_6px_rgba(0,0,0,0.5),0_24px_48px_-24px_rgba(0,0,0,0.9)]",

  /** Safety Officer — inner panels and quick links */
  subtleRed:
    "rounded-leaf-sm border border-rose-500/20 " +
    "bg-[linear-gradient(160deg,rgba(42,10,14,0.5),rgba(4,6,5,0.6))] " +
    SLAB_SHADOW_SM,

  /** Safety Officer cockpit — dense metric cells */
  cockpit: `bg-ink-950 border border-rose-500/[0.12] rounded-leaf-xs ${SLAB_SHADOW_SM}`,

  /** Safety Officer command bar */
  commandBar:
    "bg-ink-950 border border-rose-500/[0.14] rounded-leaf " +
    "shadow-[inset_0_1px_0_rgba(251,207,210,0.05),0_2px_8px_rgba(0,0,0,0.4)]",

  /** Incident card — outer shell with danger tint */
  incidentOuter:
    "rounded-leaf p-[5px] " +
    "bg-[linear-gradient(160deg,rgba(42,10,14,0.5),rgba(12,4,4,0.7),rgba(4,6,5,0.9))] " +
    "ring-1 ring-rose-500/[0.14] " +
    "shadow-[0_2px_8px_rgba(159,18,57,0.15),0_8px_32px_rgba(0,0,0,0.4)]",

  /** Incident card — inner core */
  incidentInner:
    "rounded-[23px_3px_23px_3px] " +
    "bg-[linear-gradient(160deg,#120606,#0a0303,#040605)] " +
    "shadow-[inset_0_1px_1px_rgba(251,207,210,0.06),inset_0_-1px_1px_rgba(0,0,0,0.3)] " +
    "border border-rose-500/[0.1]",

  /** Incident detail modal */
  incidentModal:
    "rounded-leaf " +
    "bg-[linear-gradient(160deg,#160606,#0a0303,#040605)] " +
    "border border-rose-500/[0.18] " +
    "shadow-[inset_0_1px_0_rgba(251,207,210,0.06),0_4px_24px_rgba(159,18,57,0.2),0_16px_48px_rgba(0,0,0,0.6)]",

  /** General Foreman — moss slab (deep saturated green) */
  cardPurple:
    "rounded-leaf border border-verdant-400/25 " +
    "bg-[linear-gradient(160deg,#12482a_0%,#0a2a19_40%,#040605_100%)] " +
    "shadow-[inset_0_1px_0_rgba(200,255,212,0.1),0_2px_6px_rgba(0,0,0,0.5),0_24px_48px_-24px_rgba(5,23,14,0.95)]",

  /** General Foreman — inner panels and stat blocks */
  subtlePurple:
    "rounded-leaf-sm border border-verdant-400/20 " +
    "bg-[linear-gradient(160deg,rgba(18,72,42,0.45),rgba(4,6,5,0.6))] " +
    SLAB_SHADOW_SM,

  /** Admin — platinum slab: bone-white forward with a lime hairline */
  cardGold:
    "rounded-leaf border border-bone-50/[0.16] " +
    "bg-[linear-gradient(160deg,#1e2a23_0%,#0b100d_40%,#040605_100%)] " +
    "shadow-[inset_0_1px_0_rgba(244,247,242,0.14),0_2px_6px_rgba(0,0,0,0.5),0_24px_48px_-24px_rgba(0,0,0,0.95)]",

  /** Admin — inner panels, stat blocks, table sections */
  subtleGold:
    "rounded-leaf-sm border border-bone-50/[0.1] " +
    "bg-[linear-gradient(160deg,rgba(30,42,35,0.7),rgba(11,16,13,0.9))] " +
    "shadow-[inset_0_1px_0_rgba(244,247,242,0.06),0_1px_2px_rgba(0,0,0,0.4)]",

  /** Foreman — glacier slab (cool bone/mint) */
  cardBlue:
    "rounded-leaf border border-verdant-200/20 " +
    "bg-[linear-gradient(160deg,#1e2a23_0%,#0b100d_45%,#040605_100%)] " +
    "shadow-[inset_0_1px_0_rgba(200,255,212,0.12),0_2px_6px_rgba(0,0,0,0.5),0_24px_48px_-24px_rgba(0,0,0,0.95)]",

  /** Foreman — inner panels and stat blocks */
  subtleBlue:
    "rounded-leaf-sm border border-verdant-200/15 " +
    "bg-[linear-gradient(160deg,rgba(30,42,35,0.6),rgba(4,6,5,0.7))] " +
    SLAB_SHADOW_SM,

  /** Mechanic — sap slab (yellow-green) */
  cardEmber:
    "rounded-leaf border border-lime-400/25 " +
    "bg-[linear-gradient(160deg,#1c2a12_0%,#0f150a_45%,#040605_100%)] " +
    "shadow-[inset_0_1px_0_rgba(184,255,122,0.1),0_2px_6px_rgba(0,0,0,0.5),0_24px_48px_-24px_rgba(0,0,0,0.95)]",

  /** Mechanic — nav cards, compact panels, inner surfaces */
  subtleEmber:
    "rounded-leaf-sm border border-lime-400/20 " +
    "bg-[linear-gradient(160deg,rgba(28,42,18,0.55),rgba(4,6,5,0.7))] " +
    SLAB_SHADOW_SM,

  /** Admin command bar — platinum spotlight */
  commandBarGold:
    "bg-ink-950 border border-bone-50/[0.12] rounded-leaf " +
    "shadow-[inset_0_1px_0_rgba(244,247,242,0.08),0_2px_8px_rgba(0,0,0,0.4)]",
} as const;

/**
 * Canopy-native surfaces for new components.
 */
export const canopy = {
  /** Instrument panel: a slab with a mono label rail on top */
  instrument: `relative overflow-hidden bg-ink-900 border border-bone-50/[0.08] rounded-leaf ${SLAB_SHADOW}`,
  /** Hero slab: large, deep, with grain */
  hero: `relative overflow-hidden grain bg-[radial-gradient(120%_120%_at_0%_0%,#12482a_0%,#0b100d_45%,#040605_100%)] border border-verdant-400/20 rounded-leaf-lg ${SLAB_SHADOW_LG}`,
  /** Interactive pill / chip */
  pill: "inline-flex items-center gap-2 rounded-full border border-bone-50/[0.12] bg-ink-900/80 px-3 py-1.5 text-xs text-bone-200",
  /** Verdant pill */
  pillLive: "inline-flex items-center gap-2 rounded-full border border-verdant-400/40 bg-verdant-500/10 px-3 py-1.5 text-xs text-verdant-200",
  /** Instrument input */
  input:
    "w-full rounded-leaf-xs border border-bone-50/[0.12] bg-ink-950/80 px-4 py-3 text-base text-bone-50 placeholder:text-ink-400 " +
    "outline-none transition-[border-color,box-shadow] duration-300 ease-canopy " +
    "focus:border-verdant-400/70 focus:shadow-glow",
  /** Primary action */
  buttonPrimary:
    "relative inline-flex items-center justify-center gap-2 rounded-leaf-xs bg-verdant-400 px-5 py-3 font-semibold text-ink-950 " +
    "transition-[transform,box-shadow,background-color] duration-300 ease-canopy " +
    "hover:bg-lime-400 hover:shadow-glow-lime active:scale-[0.98] " +
    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-verdant-400 " +
    "disabled:opacity-60 disabled:cursor-not-allowed",
  /** Secondary action */
  buttonGhost:
    "inline-flex items-center justify-center gap-2 rounded-leaf-xs border border-bone-50/[0.14] bg-ink-900/60 px-5 py-3 font-medium text-bone-100 " +
    "transition-[border-color,background-color,transform] duration-300 ease-canopy " +
    "hover:border-verdant-400/50 hover:bg-ink-800 active:scale-[0.98] " +
    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-verdant-400",
} as const;
