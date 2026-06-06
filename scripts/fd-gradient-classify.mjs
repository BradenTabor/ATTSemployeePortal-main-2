/**
 * Shared gradient role classifier for fd-audit + fd-gradients.
 * Only `surface` role is design-system drift (→ glass.*). All other roles are intentional.
 */

export function hexToRgb(hex) {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h.slice(0, 6), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function rgbToHsl({ r, g, b }) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  let h = 0;
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s, l };
}

/** Extract arbitrary hex stops from a gradient utility line. */
export function extractStops(line) {
  const hexes = [];
  const re = /(?:from|via|to)-\[#([0-9a-fA-F]{3,8})\]/g;
  let m;
  while ((m = re.exec(line))) hexes.push("#" + m[1].slice(0, 6));
  return hexes;
}

/**
 * Classify gradient role: text | border | decoration | icon | accent | surface
 * @param {string} line
 * @param {string[]} [stops] — optional pre-extracted stops
 */
export function classifyGradientLine(line, stops = extractStops(line)) {
  if (/bg-clip-text/.test(line) || /text-transparent/.test(line)) return "text";
  if (/\bp-\[1px\]|\bp-px\b/.test(line)) return "border";
  if (/\bblur(-|\b)/.test(line)) return "decoration";
  if (/to-transparent|via-transparent|from-transparent/.test(line)) return "decoration";
  if (/\babsolute\b/.test(line) && /\binset-0\b/.test(line)) return "decoration";
  if (/\bw-\d|\bh-\d/.test(line) && /rounded-full/.test(line)) return "decoration";
  if (/\bh-(0\.5|1|1\.5|2|2\.5|3|full)\b/.test(line) && /rounded-full/.test(line))
    return "decoration";
  // Interactive gradient buttons (hover:from-[#...]) — CTA fills, not card panels
  if (/hover:from-\[#/.test(line)) return "accent";
  const lightnesses = stops.map((h) => rgbToHsl(hexToRgb(h)).l);
  const hasDarkAnchor = lightnesses.some((l) => l < 0.18);
  if (!hasDarkAnchor) return "accent";
  if (/rounded-(lg|md)\b/.test(line) && /\bw-(\d|1[0-4])\b/.test(line)) return "icon";
  return "surface";
}

/** True when fd-audit should NOT flag this line as gradientSurface drift. */
export function isAllowedGradientLine(line) {
  if (!/bg-gradient-to-[a-z]+\s+from-\[#[0-9a-fA-F]/.test(line)) return true;
  const stops = extractStops(line);
  if (stops.length === 0) return true;
  return classifyGradientLine(line, stops) !== "surface";
}
