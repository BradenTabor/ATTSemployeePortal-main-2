/**
 * Mobile-safe input/textarea font-size classes.
 * iOS Safari auto-zooms on focus when font-size < 16px.
 * These classes ensure mobile devices get 16px (text-base) while
 * allowing smaller text on larger screens where desired.
 */
export const MOBILE_SAFE_INPUT = 'text-base sm:text-sm';
export const MOBILE_SAFE_TEXTAREA = 'text-base';
