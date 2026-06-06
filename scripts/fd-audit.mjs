#!/usr/bin/env node
/**
 * fd-audit.mjs — Deterministic Frontend-Design (FD) debt auditor for the ATTS portal.
 *
 * Layer 3 (Execution) tool for the continuous frontend-design loop
 * (directives/frontend_design_loop.md). Replaces the fuzzy `rg` scan commands in
 * that directive with a single deterministic pass that:
 *   1. Walks src/ for .tsx files.
 *   2. Detects violations of the LOCKED ATTS design system
 *      (.cursor/skills/ui-design-guide/SKILL.md), categorized by type.
 *   3. EXCLUDES legitimate patterns the raw scans over-count
 *      (modal backdrops, skeleton loaders, the glass.ts source of truth itself).
 *   4. Ranks files by violation count so the loop can pick a concrete target.
 *
 * Why: a raw `rg backdrop-blur` returns ~120 files, but most are allowed modal
 * backdrops (Section 18) or skeleton loaders (Section 13). The loop needs an
 * accurate, deduplicated, prioritized queue — not a noisy grep.
 *
 * Usage:
 *   node scripts/fd-audit.mjs                 # human summary + ranked targets
 *   node scripts/fd-audit.mjs --category surface   # only one category
 *   node scripts/fd-audit.mjs --top 10        # limit ranked files per category
 *   node scripts/fd-audit.mjs --json          # machine-readable output
 *   node scripts/fd-audit.mjs --backlog       # print ready-to-paste backlog rows
 *   node scripts/fd-audit.mjs --file <path>   # detail (line numbers) for one file
 *   node scripts/fd-audit.mjs --fix           # auto-fix MECHANICAL categories repo-wide
 *   node scripts/fd-audit.mjs --fix --category focusRing   # one category
 *   node scripts/fd-audit.mjs --fix --file <path>          # one file
 *   node scripts/fd-audit.mjs --fix --dry-run # preview counts without writing
 *
 * AUTOFIX SCOPE (--fix): only categories in SAFE_FIXERS below — i.e. transforms
 * that are 100% deterministic and carry NO design judgment (focusRing). Surface,
 * hoverScale, hardZ, and longMotion stay MANUAL because the correct replacement
 * (which glass.* variant, which Z.* constant, whether motion is intentional)
 * requires a human/agent decision and belongs in the one-item-per-tick loop.
 */

import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { isAllowedGradientLine } from "./fd-gradient-classify.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SRC = join(ROOT, "src");

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
const getFlag = (name) => args.includes(`--${name}`);
const getOpt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const OPT = {
  json: getFlag("json"),
  backlog: getFlag("backlog"),
  fix: getFlag("fix"),
  dryRun: getFlag("dry-run"),
  category: getOpt("category", null),
  top: Number(getOpt("top", "15")),
  file: getOpt("file", null),
};

// ---------------------------------------------------------------------------
// Rule definitions
// Each rule: id, label, severity, test(line) -> boolean, and an `allow(line)`
// guard that suppresses legitimate, design-system-sanctioned usages.
// ---------------------------------------------------------------------------
const RULES = [
  {
    id: "surface",
    label: "Off-system surface (inline backdrop-blur / bg-white/[0.0N])",
    sev: "MED",
    fix: "Replace inline glassmorphism with glass.* from @/lib/glass (solid premium surface)",
    test: (line) =>
      /backdrop-blur/.test(line) || /bg-white\/\[0\.0\d\]/.test(line),
    allow: (line) => {
      // Modal/drawer backdrop — Section 18 sanctions bg-black/* + backdrop-blur-sm
      if (/bg-black\/\d/.test(line) && /backdrop-blur/.test(line)) return true;
      // Skeleton loaders — Section 13 sanctions bg-white/5 animate-pulse
      if (/animate-pulse/.test(line)) return true;
      // Sticky header frost (e.g. bg-gray-800/95) — keep flagged only if bg-white
      return false;
    },
  },
  {
    id: "gradientSurface",
    label: "Inline arbitrary-hex gradient surface (bg-gradient-to-* from-[#hex])",
    sev: "MED",
    fix: "Replace freestyle bg-gradient-to-* from-[#hex] panels with glass.* surfaces (or a role-themed variant added to @/lib/glass)",
    // The `surface` rule catches bg-white/[0.0N] + backdrop-blur, but the
    // compliance forms hide their worst drift in multi-stop arbitrary-hex
    // gradients (e.g. from-[#0a2218] via-[#031510] to-[#010407]) that read as
    // bespoke card backgrounds — off-system surfaces glass.* should own.
    test: (line) => /bg-gradient-to-[a-z]+\s+from-\[#[0-9a-fA-F]/.test(line),
    // Align with fd-gradients role classifier — only true card/panel SURFACES are drift.
    // Text headings, bezels, blur orbs, progress fills, and CTA button gradients are allowed.
    allow: (line) => isAllowedGradientLine(line),
  },
  {
    id: "focusRing",
    label: "focus: ring instead of focus-visible: (or ring-offset-black)",
    sev: "HIGH",
    fix: "Use focus-visible:ring-* and ring-offset-gray-900 (LOCKED a11y requirement)",
    test: (line) =>
      /(?:^|[^-])focus:ring/.test(line) || /ring-offset-black/.test(line),
    allow: () => false,
  },
  {
    id: "hoverScale",
    label: "Framer whileHover scale (GPU-churn micro-interaction)",
    sev: "LOW",
    fix: "Replace whileHover/whileTap scale with CSS hover:scale-* / active:scale-*",
    test: (line) => /whileHover=\{\{\s*scale/.test(line),
    // Multi-axis / conditional Framer hover — cannot map to a single CSS scale utility.
    allow: (line) =>
      /whileHover=\{\{[^}]*(rotate|,\s*y:|,\s*x:|boxShadow:|loading \?|isUpdating \?|isProcessing \?)/.test(
        line
      ),
  },
  {
    id: "hardZ",
    label: "Hardcoded z-index (z-[NNN] or z-50) instead of Z.* constant",
    sev: "LOW",
    fix: "Use style={{ zIndex: Z.* }} from @/lib/zIndex",
    test: (line) => /\bz-\[\d{2,}\]/.test(line) || /\bz-50\b/.test(line),
    // Variant-prefixed z (focus:z-50 skip-links, sm:z-50) — intentional, not base stacking.
    allow: (line) =>
      /\b(?:focus|hover|sm|md|lg|xl|xs|group-hover|peer-focus):z-(?:50|\[\d+\])/.test(line),
  },
  {
    id: "layoutRhythm",
    label: "Arbitrary spacing/radius (gap/p/m/space-[Npx], rounded-[Npx]) off the 4px scale",
    sev: "MED",
    fix: "Use the Tailwind spacing scale (guide §8) and radius system (guide §4: rounded-lg/xl/2xl/full) — arbitrary px values break the layout rhythm",
    // ORGANIZATION/LAYOUT lens: the spacing scale (gap-1..8) and radius system
    // (rounded-lg/xl/2xl/full) create a consistent visual rhythm. Arbitrary px
    // values (gap-[7px], p-[13px], rounded-[10px]) drift off that grid and make
    // sibling surfaces subtly misaligned. We flag the spacing/radius UTILITIES
    // that take an arbitrary length; we do NOT flag arbitrary positions
    // (top-/left-/-translate-) or sizes (w-/h-), which are legitimately bespoke.
    test: (line) =>
      /\b(?:gap|gap-x|gap-y|p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|space-x|space-y)-\[[\d.]+(?:px|rem)\]/.test(
        line
      ) || /\brounded(?:-[trbl]|-[a-z]{1,2})?-\[[\d.]+(?:px|rem)\]/.test(line),
    allow: (line) => {
      // Negative margins are often intentional overlap/bleed — skip the -m* forms.
      if (/-m[xytrbl]?-\[/.test(line)) return true;
      // calc()/env() safe-area paddings are intentional PWA insets, not drift.
      if (/\[calc\(|\[env\(/.test(line)) return true;
      // Gradient border bezels (1px / 1.5px wrappers) — not layout spacing.
      if (/\bp-\[1(\.5)?px\]/.test(line)) return true;
      // Incident double-bezel radius matches glass.incidentOuter token.
      if (/rounded-\[1\.25rem\]/.test(line)) return true;
      // BrandedNavCard icon-as-image horizontal inset (image bleeds left of text).
      if (/iconAsImage.*pl-\[/.test(line)) return true;
      return false;
    },
  },
  {
    id: "longMotion",
    label: "Animation/transition over the 200ms Android budget",
    sev: "MED",
    fix: "Cap Framer transition duration at 0.2s and use duration-150/200 utilities",
    test: (line) =>
      /duration:\s*0\.[3-9]\d*/.test(line) ||
      /duration:\s*[1-9]\d*\b/.test(line) ||
      /duration-(?:30|40|50|60|70|75|100[0-9]|[3-9]\d\d)\b/.test(line),
    allow: (line) =>
      /animate-(?:spin|pulse|ping|bounce)/.test(line) ||
      // Ambient/decorative loops (hero glows, orbs) — not interaction feedback.
      /repeat:\s*Infinity/.test(line) ||
      // Precomputed particle/orb drift durations (data, not UI transition).
      /duration:\s*\d+(?:\.\d+)?\s*\+/.test(line),
  },
];

// ---------------------------------------------------------------------------
// Auto-fixers — ONLY for mechanical, judgment-free categories.
// Each fixer maps a single source line -> a corrected line and MUST be
// idempotent (running twice changes nothing). A fixer may also normalize a
// tightly-coupled sibling token when doing so strictly aligns the line with the
// design guide (e.g. focusRing also makes `focus:border` keyboard-only per §11).
// ---------------------------------------------------------------------------
const SAFE_FIXERS = {
  // focusRing (HIGH, LOCKED a11y): make the ring keyboard-only and recolor the
  // offset to the system token. Deterministic 1:1 transforms.
  //  - `focus:ring*`        -> `focus-visible:ring*`  (not `*-focus:ring`, e.g. group-focus)
  //  - `focus:border*`      -> `focus-visible:border*` (keep focus styling keyboard-only)
  //  - `ring-offset-black`  -> `ring-offset-gray-900`
  focusRing: (line) =>
    line
      .replace(/(^|[^-])focus:ring/g, "$1focus-visible:ring")
      .replace(/(^|[^-])focus:border/g, "$1focus-visible:border")
      .replace(/ring-offset-black\b/g, "ring-offset-gray-900"),

  // surface (MED): swap inline `bg-white/[0.0N]` field/panel fills to system grays
  // per guide §3/§11 (Equipment form pass pattern). Does NOT strip backdrop-blur
  // (manual: remove blur + use glass.*). Skips animate-pulse skeletons (§13).
  surface: (line) => {
    if (/animate-pulse/.test(line)) return line;
    let next = line;
    const pairs = [
      [/hover:bg-white\/\[0\.1\]/g, "hover:bg-gray-700"],
      [/focus:bg-white\/\[0\.06\]/g, "focus:bg-gray-700"],
      [/focus:bg-white\/\[0\.04\]/g, "focus:bg-gray-800"],
      [/hover:bg-white\/\[0\.08\]/g, "hover:bg-gray-800"],
      [/hover:bg-white\/\[0\.07\]/g, "hover:bg-gray-800"],
      [/hover:bg-white\/\[0\.06\]/g, "hover:bg-gray-800"],
      [/hover:bg-white\/\[0\.05\]/g, "hover:bg-gray-800/60"],
      [/hover:bg-white\/\[0\.04\]/g, "hover:bg-gray-800"],
      [/hover:bg-white\/\[0\.03\]/g, "hover:bg-gray-900"],
      [/hover:bg-white\/\[0\.02\]/g, "hover:bg-gray-900/50"],
      [/active:bg-white\/\[0\.05\]/g, "active:bg-gray-800/60"],
      [/bg-white\/\[0\.08\]/g, "bg-gray-800"],
      [/bg-white\/\[0\.07\]/g, "bg-gray-800"],
      [/bg-white\/\[0\.06\]/g, "bg-gray-800"],
      [/bg-white\/\[0\.05\]/g, "bg-gray-800/60"],
      [/bg-white\/\[0\.04\]/g, "bg-gray-800"],
      [/bg-white\/\[0\.03\]/g, "bg-gray-900"],
      [/bg-white\/\[0\.02\]/g, "bg-gray-900/50"],
      [/bg-white\/5\b/g, "bg-gray-900"],
      [/bg-white\/10\b/g, "bg-gray-800"],
      [/hover:bg-white\/10\b/g, "hover:bg-gray-800"],
      [/group-hover:bg-white\/10\b/g, "group-hover:bg-gray-800"],
    ];
    for (const [re, rep] of pairs) next = next.replace(re, rep);
    return next;
  },
};

// Files that are the source of truth for the system — never flag them.
const IGNORE_FILES = new Set([
  join("src", "lib", "glass.ts"),
  join("src", "lib", "animations.ts"),
  join("src", "lib", "zIndex.ts"),
  join("src", "lib", "shadows.ts"),
  join("src", "lib", "typography.ts"),
]);

// ---------------------------------------------------------------------------
// Walk
// ---------------------------------------------------------------------------
function walk(dir, acc = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (entry === "node_modules" || entry === "dist" || entry === ".git") continue;
      walk(full, acc);
    } else if (/\.(tsx|ts)$/.test(entry)) {
      acc.push(full);
    }
  }
  return acc;
}

// ---------------------------------------------------------------------------
// Scan
// ---------------------------------------------------------------------------
function scan() {
  const files = walk(SRC);
  // results: Map<ruleId, Map<relPath, {count, lines:[]}>>
  const results = new Map(RULES.map((r) => [r.id, new Map()]));

  for (const full of files) {
    const rel = relative(ROOT, full).split(sep).join("/");
    const relNative = relative(ROOT, full);
    if ([...IGNORE_FILES].some((ig) => relNative === ig)) continue;

    const text = readFileSync(full, "utf8");
    const lines = text.split("\n");

    for (const rule of RULES) {
      if (OPT.category && rule.id !== OPT.category) continue;
      // .ts files only meaningfully carry focusRing/longMotion via template strings;
      // surface/hoverScale/hardZ live in .tsx markup.
      if (!rel.endsWith(".tsx") && rule.id !== "longMotion" && rule.id !== "focusRing")
        continue;

      lines.forEach((line, idx) => {
        const t = line.trim();
        // Skip comment-only lines (JSDoc / // / {/* */) — avoids false positives when
        // docs mention "backdrop-blur" as something we intentionally removed.
        if (
          t.startsWith("//") ||
          t.startsWith("*") ||
          t.startsWith("/*") ||
          /^\{\/\*/.test(t)
        )
          return;
        if (rule.test(line) && !rule.allow(line)) {
          const bucket = results.get(rule.id);
          if (!bucket.has(rel)) bucket.set(rel, { count: 0, lines: [] });
          const e = bucket.get(rel);
          e.count += 1;
          e.lines.push({ n: idx + 1, text: line.trim().slice(0, 120) });
        }
      });
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------
function rankedFiles(bucket) {
  return [...bucket.entries()]
    .map(([file, e]) => ({ file, count: e.count }))
    .sort((a, b) => b.count - a.count);
}

function runFix() {
  const requested = OPT.category ? [OPT.category] : Object.keys(SAFE_FIXERS);
  const unsafe = requested.filter((c) => !SAFE_FIXERS[c]);
  if (unsafe.length) {
    console.error(
      `\n✗ --fix refuses category "${unsafe.join(", ")}": no deterministic fixer.\n` +
        `  Auto-fixable categories: ${Object.keys(SAFE_FIXERS).join(", ")}.\n` +
        `  Others require design judgment — fix them via the one-item-per-tick loop.\n`
    );
    process.exit(1);
  }

  const targetFile = OPT.file ? OPT.file.replace(/^\.\//, "") : null;
  const files = walk(SRC).filter((full) => {
    const relNative = relative(ROOT, full);
    if ([...IGNORE_FILES].some((ig) => relNative === ig)) return false;
    if (targetFile) return relNative.split(sep).join("/") === targetFile;
    return true;
  });

  let filesChanged = 0;
  let linesChanged = 0;
  const touched = [];

  for (const full of files) {
    const rel = relative(ROOT, full).split(sep).join("/");
    const text = readFileSync(full, "utf8");
    const lines = text.split("\n");
    let fileLineHits = 0;

    const newLines = lines.map((line) => {
      let next = line;
      for (const cat of requested) {
        // Honor the same scoping the scanner uses (focusRing applies to .ts/.tsx).
        next = SAFE_FIXERS[cat](next);
      }
      if (next !== line) fileLineHits += 1;
      return next;
    });

    if (fileLineHits > 0) {
      filesChanged += 1;
      linesChanged += fileLineHits;
      touched.push({ file: rel, hits: fileLineHits });
      if (!OPT.dryRun) writeFileSync(full, newLines.join("\n"), "utf8");
    }
  }

  const verb = OPT.dryRun ? "Would fix" : "Fixed";
  console.log(
    `\nFD autofix [${requested.join(", ")}]${OPT.dryRun ? " (dry-run)" : ""}`
  );
  console.log("=".repeat(60));
  touched
    .sort((a, b) => b.hits - a.hits)
    .forEach((t) => console.log(`   ${String(t.hits).padStart(3)}  ${t.file}`));
  console.log("=".repeat(60));
  console.log(
    `${verb} ${linesChanged} line(s) across ${filesChanged} file(s). ` +
      `Re-run "npm run fd:audit" to confirm 0, then typecheck + eslint the changed files.\n`
  );
}

function main() {
  if (OPT.fix) {
    runFix();
    return;
  }

  const results = scan();

  if (OPT.file) {
    const target = OPT.file.replace(/^\.\//, "");
    console.log(`\nFD detail — ${target}\n${"=".repeat(60)}`);
    for (const rule of RULES) {
      const bucket = results.get(rule.id);
      const e = bucket.get(target);
      if (!e) continue;
      console.log(`\n[${rule.sev}] ${rule.label} (${e.count})`);
      for (const ln of e.lines) console.log(`  L${ln.n}: ${ln.text}`);
    }
    return;
  }

  if (OPT.json) {
    const out = {};
    for (const rule of RULES) {
      out[rule.id] = {
        sev: rule.sev,
        label: rule.label,
        fix: rule.fix,
        files: rankedFiles(results.get(rule.id)),
        total: rankedFiles(results.get(rule.id)).reduce((s, f) => s + f.count, 0),
      };
    }
    console.log(JSON.stringify(out, null, 2));
    return;
  }

  if (OPT.backlog) {
    console.log("Suggested PENDING rows (paste into directives/frontend-design-backlog.md):\n");
    let n = 100;
    for (const rule of RULES) {
      const ranked = rankedFiles(results.get(rule.id)).slice(0, OPT.top);
      for (const f of ranked) {
        n += 1;
        const short = f.file.replace(/^src\//, "");
        console.log(
          `| FD-${n} | ${rule.sev} | ${rule.label} (${f.count}) | ${f.file} | 1 | PENDING |`
        );
        void short;
      }
    }
    return;
  }

  // Human summary
  console.log(`\nATTS Frontend-Design Audit  —  ${new Date().toISOString().slice(0, 10)}`);
  console.log("=".repeat(64));
  let grand = 0;
  for (const rule of RULES) {
    if (OPT.category && rule.id !== OPT.category) continue;
    const bucket = results.get(rule.id);
    const ranked = rankedFiles(bucket);
    const total = ranked.reduce((s, f) => s + f.count, 0);
    grand += total;
    console.log(
      `\n[${rule.sev}] ${rule.label}\n      ${total} hit(s) across ${ranked.length} file(s)\n      fix: ${rule.fix}`
    );
    ranked.slice(0, OPT.top).forEach((f, i) => {
      console.log(`   ${String(i + 1).padStart(2)}. ${f.count.toString().padStart(3)}  ${f.file}`);
    });
    if (ranked.length > OPT.top) console.log(`      … +${ranked.length - OPT.top} more file(s)`);
  }
  console.log("\n" + "=".repeat(64));
  console.log(`TOTAL: ${grand} violation(s). Process the highest-count file in the highest Sev category next.`);
  console.log("Run with --backlog for paste-ready rows, --json for tooling, --file <path> for line detail.\n");
}

main();
