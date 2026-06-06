#!/usr/bin/env node
/**
 * fd-gradients.mjs — Gradient palette analyzer + consolidation planner for ATTS.
 *
 * Layer 3 (Execution) tool for the continuous frontend-design loop
 * (directives/frontend_design_loop.md). It is the "color gradients" lens.
 *
 * WHY THIS EXISTS (and why `fd-audit`'s `gradientSurface` rule isn't enough):
 *   `fd-audit --category gradientSurface` flags every `bg-gradient-to-* from-[#hex]`
 *   line. But that lumps four very different things together:
 *     1. TEXT gradients      (`bg-clip-text text-transparent`)  — intentional headings
 *     2. BORDER gradients    (`p-[1px] ... bg-gradient-to-r`)   — intentional bezels
 *     3. DECORATION          (blur orbs, dots, `inset-0 ... to-transparent` glows)
 *     4. SURFACE             (actual card / panel backgrounds)  — the REAL drift target
 *   Only (4) is a surface the design system should own via `glass.*`. Telling the
 *   loop to "flatten the gradient" was unactionable because ~70% of hits are 1–3.
 *
 * WHAT THIS DOES:
 *   - Walks src/ for .tsx.
 *   - Finds every `bg-gradient-to-*` with an arbitrary hex stop.
 *   - CLASSIFIES each by role (text | border | decoration | icon | surface).
 *   - For SURFACE gradients: extracts the hex stops, computes the average color,
 *     detects the role color FAMILY (emerald/rose/purple/amber/blue/neutral), and
 *     maps it to the nearest sanctioned `glass.*` token — or flags that NO token
 *     exists yet (a concrete "add a named token" organization win).
 *   - CLUSTERS identical surface signatures so near-duplicate gradients collapse
 *     into one consolidation target.
 *
 * USAGE:
 *   node scripts/fd-gradients.mjs                 # summary: roles + surface clusters
 *   node scripts/fd-gradients.mjs --plan          # consolidation plan grouped by token
 *   node scripts/fd-gradients.mjs --surfaces      # only surface-classified hits, ranked by file
 *   node scripts/fd-gradients.mjs --file <path>   # per-line classification for one file
 *   node scripts/fd-gradients.mjs --json          # machine-readable
 *   node scripts/fd-gradients.mjs --missing       # only clusters with NO glass.* token (new-token candidates)
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import {
  classifyGradientLine,
  extractStops,
  hexToRgb,
  rgbToHsl,
} from "./fd-gradient-classify.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SRC = join(ROOT, "src");

const args = process.argv.slice(2);
const has = (n) => args.includes(`--${n}`);
const opt = (n, d) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : d;
};
const OPT = {
  plan: has("plan"),
  surfaces: has("surfaces"),
  json: has("json"),
  missing: has("missing"),
  file: opt("file", null),
};

// Source-of-truth files we never analyze (glass.ts DEFINES the tokens).
const IGNORE = new Set([
  join("src", "lib", "glass.ts").split(sep).join("/"),
]);

// ---------------------------------------------------------------------------
// Color helpers (hexToRgb/rgbToHsl/classify/extractStops from fd-gradient-classify.mjs)
// ---------------------------------------------------------------------------

/** Detect the dominant role color family from a set of hex stops. */
function colorFamily(hexes) {
  // Use the most-saturated, non-near-black stop as the family signal —
  // dark gradients are mostly near-black, so the chroma comes from one stop.
  let best = null;
  for (const hex of hexes) {
    const hsl = rgbToHsl(hexToRgb(hex));
    // ignore near-black (the gradient's dark anchor) and near-white
    if (hsl.l < 0.06 || hsl.l > 0.94) continue;
    if (!best || hsl.s > best.s) best = hsl;
  }
  if (!best || best.s < 0.12) return "neutral";
  const h = best.h;
  if (h >= 95 && h < 175) return "emerald";
  if (h >= 175 && h < 200) return "teal";
  if (h >= 200 && h < 255) return "blue";
  if (h >= 255 && h < 320) return "purple";
  if (h >= 320 || h < 18) return "rose";
  if (h >= 30 && h < 70) return "amber";
  return "neutral";
}

function isEmberPalette(hexes) {
  // Mechanic ember stops (#1a0c08, #1f0f09, …) read as neutral/rose in HSL but are
  // red-dominant warm browns — distinct from admin gold and safety rose.
  return hexes.some((h) => {
    const { r, g, b } = hexToRgb(h);
    return r >= 15 && g <= r * 0.65 && b <= g * 0.85 && r > b + 8;
  });
}

/**
 * Map a surface gradient (by family + radius) to the sanctioned glass.* token.
 * Returns { token } when a token exists, or { token: null, suggest } when the
 * design system has NO home for this surface yet (a new-token candidate).
 */
function mapToToken(family, radius) {
  const card = radius === "lg" || radius === "xl"; // smaller radius => inner/subtle
  switch (family) {
    case "emerald":
      return { token: card ? "glass.cardEmerald" : "glass.subtleEmerald" };
    case "rose":
      return { token: card ? "glass.cardRed" : "glass.subtleRed" };
    case "purple":
      return { token: card ? "glass.cardPurple" : "glass.subtlePurple" };
    case "neutral":
      return { token: card ? "glass.card" : "glass.subtle" };
    case "amber":
      return { token: card ? "glass.cardGold" : "glass.subtleGold" };
    case "blue":
      return { token: card ? "glass.cardBlue" : "glass.subtleBlue" };
    case "ember":
      return { token: card ? "glass.cardEmber" : "glass.subtleEmber" };
    case "teal":
      // No teal (manager) surface token exists yet — flag as a new-token candidate.
      return { token: null, suggest: card ? "glass.cardTeal" : "glass.subtleTeal" };
    default:
      return { token: card ? "glass.card" : "glass.subtle" };
  }
}

/** Detect the surface's corner radius bucket (for card-vs-subtle mapping). */
function radiusBucket(line) {
  if (/rounded-3xl/.test(line)) return "2xl";
  if (/rounded-2xl/.test(line)) return "2xl";
  if (/rounded-xl/.test(line)) return "xl";
  if (/rounded-lg/.test(line)) return "lg";
  return "none";
}

// Build a stable signature for clustering identical surface gradients.
function signature(line) {
  const dir = (line.match(/bg-gradient-to-([a-z]+)/) || [])[1] || "?";
  const stops = extractStops(line).map((h) => h.toLowerCase());
  return `${dir}|${stops.join(",")}`;
}

// ---------------------------------------------------------------------------
// Walk + scan
// ---------------------------------------------------------------------------
function walk(dir, acc = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (["node_modules", "dist", ".git"].includes(entry)) continue;
      walk(full, acc);
    } else if (/\.tsx$/.test(entry)) acc.push(full);
  }
  return acc;
}

function scan() {
  const hits = []; // { file, line, role, family, radius, sig, token, suggest, text }
  for (const full of walk(SRC)) {
    const rel = relative(ROOT, full).split(sep).join("/");
    if (IGNORE.has(rel)) continue;
    const lines = readFileSync(full, "utf8").split("\n");
    lines.forEach((raw, idx) => {
      // must contain a gradient utility with at least one arbitrary hex stop
      if (!/bg-gradient-to-[a-z]+/.test(raw)) return;
      const stops = extractStops(raw);
      if (stops.length === 0) return;
      const role = classifyGradientLine(raw, stops);
      const radius = radiusBucket(raw);
      const family = isEmberPalette(stops) ? "ember" : colorFamily(stops);
      const map = role === "surface" ? mapToToken(family, radius) : { token: null };
      hits.push({
        file: rel,
        line: idx + 1,
        role,
        family,
        radius,
        sig: signature(raw),
        token: map.token,
        suggest: map.suggest,
        text: raw.trim().slice(0, 130),
      });
    });
  }
  return hits;
}

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------
function main() {
  const hits = scan();

  if (OPT.file) {
    const target = OPT.file.replace(/^\.\//, "");
    const rows = hits.filter((h) => h.file === target);
    console.log(`\nFD gradients — ${target}\n${"=".repeat(64)}`);
    if (!rows.length) return console.log("  (no arbitrary-hex gradients)\n");
    for (const h of rows) {
      const tag = h.role === "surface"
        ? `surface/${h.family} -> ${h.token || "NEW " + h.suggest}`
        : h.role;
      console.log(`  L${String(h.line).padStart(4)} [${tag}]`);
      console.log(`        ${h.text}`);
    }
    return;
  }

  const surfaces = hits.filter((h) => h.role === "surface");

  if (OPT.json) {
    console.log(JSON.stringify({ total: hits.length, surfaces: surfaces.length, hits }, null, 2));
    return;
  }

  if (OPT.surfaces) {
    const byFile = new Map();
    for (const h of surfaces) byFile.set(h.file, (byFile.get(h.file) || 0) + 1);
    console.log(`\nSurface gradients by file (consolidation targets)\n${"=".repeat(64)}`);
    [...byFile.entries()].sort((a, b) => b[1] - a[1]).forEach(([f, c], i) =>
      console.log(`  ${String(i + 1).padStart(2)}. ${String(c).padStart(3)}  ${f}`)
    );
    console.log("");
    return;
  }

  // Cluster surfaces by suggested token (the consolidation plan).
  const byToken = new Map(); // token/suggest -> { count, files:Set, sigs:Map }
  for (const h of surfaces) {
    const key = h.token || `NEW ${h.suggest}`;
    if (!byToken.has(key)) byToken.set(key, { count: 0, files: new Set(), sigs: new Map() });
    const e = byToken.get(key);
    e.count += 1;
    e.files.add(h.file);
    e.sigs.set(h.sig, (e.sigs.get(h.sig) || 0) + 1);
  }

  if (OPT.plan || OPT.missing) {
    const entries = [...byToken.entries()]
      .filter(([k]) => (OPT.missing ? k.startsWith("NEW ") : true))
      .sort((a, b) => b[1].count - a[1].count);
    console.log(`\nGradient consolidation plan${OPT.missing ? " — MISSING tokens only" : ""}\n${"=".repeat(64)}`);
    for (const [key, e] of entries) {
      const flag = key.startsWith("NEW ") ? "  ⚠ no sanctioned token yet" : "";
      console.log(`\n${key}  —  ${e.count} surface(s) across ${e.files.size} file(s)${flag}`);
      [...e.sigs.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).forEach(([sig, c]) => {
        const stops = sig.split("|")[1];
        console.log(`     ${String(c).padStart(3)}×  ${stops}`);
      });
    }
    console.log("");
    return;
  }

  // Default summary
  console.log(`\nATTS Gradient Audit  —  ${new Date().toISOString().slice(0, 10)}`);
  console.log("=".repeat(64));
  const byRole = new Map();
  for (const h of hits) byRole.set(h.role, (byRole.get(h.role) || 0) + 1);
  console.log("\nBy role (only `surface` is design-system drift):");
  for (const [role, c] of [...byRole.entries()].sort((a, b) => b[1] - a[1])) {
    const note = role === "surface" ? "  <- consolidate into glass.*"
      : role === "text" ? "  (intentional heading gradient — leave)"
      : role === "border" ? "  (intentional bezel — leave)"
      : role === "accent" ? "  (button/badge fill — belongs in a button token, not glass.*)"
      : "  (decorative — leave)";
    console.log(`   ${String(c).padStart(4)}  ${role}${note}`);
  }
  console.log(`\nSurface gradients map to these tokens (run --plan for detail):`);
  for (const [key, e] of [...byToken.entries()].sort((a, b) => b[1].count - a[1].count)) {
    console.log(`   ${String(e.count).padStart(4)}  ${key}   (${e.files.size} file(s))`);
  }
  console.log(`\n${"=".repeat(64)}`);
  console.log(`${hits.length} total gradient hit(s); ${surfaces.length} are surfaces.`);
  console.log("Run --plan (group by token), --missing (new-token candidates), --surfaces (by file), --file <p>.\n");
}

main();
