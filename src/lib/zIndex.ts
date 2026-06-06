/**
 * ATTS z-index scale — use via style={{ zIndex: Z.* }}, never hardcoded Tailwind z-[N].
 * @see .cursor/skills/ui-design-guide/SKILL.md §25
 */
export const Z = {
  base: 0,
  card: 10,
  dropdown: 100,
  sticky: 200,
  offlineBanner: 300,
  nav: 400,
  modal: 500,
  /** Nested dialog stacked above an open modal (e.g. OSHA confirm on incident form) */
  modalNested: 510,
  toast: 600,
  tooltip: 700,
  /** Offline queue drawer stack (backdrop → panel → nested confirm) */
  offlineDrawerBackdrop: 60,
  offlineDrawer: 61,
  offlineDrawerModal: 62,
  /** Portaled dropdowns/menus that must escape overflow (backdrop + menu pair) */
  portalBackdrop: 9998,
  portalMenu: 9999,
} as const;

export type ZIndexKey = keyof typeof Z;
