#!/usr/bin/env node
/**
 * fd-page.mjs — Page-bundle auditor for the frontend-design loop.
 *
 * Runs fd:audit, fd:gradients, and fd:fix:input-zoom across a page file plus
 * its statically-imported local components (one hop). Use when improving a
 * named route instead of grinding repo-wide category totals.
 *
 * Usage:
 *   npm run fd:page -- src/pages/Announcements.tsx
 *   npm run fd:page -- Announcements          # resolves src/pages/Announcements.tsx
 *   npm run fd:page -- src/pages/Announcements.tsx --depth 2
 */

import { readFileSync, existsSync, statSync } from "node:fs";
import { join, dirname, relative, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SRC = join(ROOT, "src");

const args = process.argv.slice(2);
const getOpt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const depthLimit = Number(getOpt("depth", "1"));
const positional = args.filter((a) => !a.startsWith("--") && !/^\d+$/.test(a) && a !== getOpt("depth", ""));

function resolvePage(input) {
  if (!input) {
    console.error("Usage: npm run fd:page -- <page-path-or-name>");
    process.exit(1);
  }
  const candidates = [
    input,
    join(SRC, input),
    join(SRC, "pages", input),
    join(SRC, "pages", `${input}.tsx`),
    join(SRC, "pages", input, `${input.split("/").pop()}.tsx`),
  ];
  if (!input.endsWith(".tsx")) {
    candidates.push(join(SRC, "pages", `${input}.tsx`));
  }
  for (const c of candidates) {
    if (existsSync(c) && statSync(c).isFile()) return c;
  }
  console.error(`Could not resolve page: ${input}`);
  process.exit(1);
}

function resolveImport(fromFile, spec) {
  let base;
  if (spec.startsWith("@/")) {
    base = join(SRC, spec.slice(2));
  } else if (spec.startsWith(".")) {
    base = join(dirname(fromFile), spec);
  } else {
    return null; // node_modules / bare
  }
  const tries = [
    base,
    `${base}.tsx`,
    `${base}.ts`,
    join(base, "index.tsx"),
    join(base, "index.ts"),
  ];
  for (const t of tries) {
    if (existsSync(t) && statSync(t).isFile() && extname(t) !== ".css") return t;
  }
  return null;
}

function collectBundle(pageFile, depth = 0, seen = new Set()) {
  if (seen.has(pageFile) || depth > depthLimit) return seen;
  seen.add(pageFile);
  if (depth >= depthLimit) return seen;

  let content;
  try {
    content = readFileSync(pageFile, "utf8");
  } catch {
    return seen;
  }

  const re = /import\s+(?:type\s+)?(?:[\w*{}\s,]+)\s+from\s+['"]([^'"]+)['"]/g;
  let m;
  while ((m = re.exec(content))) {
    const resolved = resolveImport(pageFile, m[1]);
    if (resolved) collectBundle(resolved, depth + 1, seen);
  }
  return seen;
}

function run(cmd) {
  try {
    return execSync(cmd, { cwd: ROOT, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
  } catch (e) {
    return e.stdout || e.stderr || String(e.message);
  }
}

function scanComposition(pageFile) {
  const content = readFileSync(pageFile, "utf8");
  const hints = [];

  if (/ExpandableSection[\s\S]{0,2000}Search/i.test(content) || /SearchBar[\s\S]{0,800}ExpandableSection/i.test(content)) {
    hints.push(
      "ORG: Search/filter controls appear inside ExpandableSection — move to page-level toolbar so they stay visible when the section is collapsed or when only a featured item exists."
    );
  }
  if (/style=\{\{\s*background:\s*['"]linear-gradient/.test(content)) {
    hints.push(
      "GRADIENT: Inline style={{ background: linear-gradient(...) }} on surfaces — prefer glass.* tokens (run fd:gradients --file)."
    );
  }
  if (/transition:\s*\{\s*duration:\s*(?:[1-9]\d*|[2-9]\.\d+),\s*repeat:\s*Infinity/.test(content)) {
    hints.push(
      "MOTION: Infinite animation with duration >200ms — gate behind getDeviceCapabilities() or replace with static decoration (Android perf budget §9)."
    );
  }
  if (/whileHover=\{\{[^}]*scale/.test(content)) {
    hints.push("MOTION: Framer whileHover scale — replace with CSS hover:scale-* / active:scale-* (hoverScale category).");
  }
  if (/text-sm[^"]*placeholder|placeholder[^"]*text-sm/.test(content) && /<input/.test(content)) {
    hints.push("FORMS: Search/input may use text-sm — run fd:fix:input-zoom --file (iOS zoom gate).");
  }

  return hints;
}

const pageFile = resolvePage(positional[0]);
const relPage = relative(ROOT, pageFile);
const bundle = [...collectBundle(pageFile)].sort();

console.log(`\nFD page bundle — ${relPage}`);
console.log("=".repeat(60));
console.log(`Files (${bundle.length}, depth≤${depthLimit}):`);
for (const f of bundle) {
  console.log(`  · ${relative(ROOT, f)}`);
}

console.log("\n--- Per-file audit (violations only) ---\n");
let totalHits = 0;
for (const f of bundle) {
  const out = run(`node scripts/fd-audit.mjs --file "${relative(ROOT, f)}"`);
  const hasHits = out.includes("L") && !out.includes("(0)\n") && /\[/.test(out);
  const lines = out.split("\n").filter((l) => /^  L\d+:/.test(l));
  if (lines.length) {
    console.log(out.trim());
    totalHits += lines.length;
    console.log("");
  }
}

console.log("--- Gradient surfaces ---\n");
for (const f of bundle) {
  const out = run(`node scripts/fd-gradients.mjs --file "${relative(ROOT, f)}"`);
  if (!out.includes("(no arbitrary-hex gradients)") && out.includes("surface")) {
    console.log(out.trim());
    console.log("");
  }
}

console.log("--- Input zoom (dry-run) ---\n");
const inputFiles = bundle.filter((f) => {
  try {
    return /<(input|select|textarea)\b/.test(readFileSync(f, "utf8"));
  } catch {
    return false;
  }
});
let inputZoomHits = 0;
for (const f of inputFiles) {
  const out = run(`npx tsx scripts/fd-fix-input-zoom.ts --file "${relative(ROOT, f)}"`);
  if (out.includes("WOULD bump") && !out.includes("WOULD bump 0")) {
    console.log(out.trim());
    console.log("");
    inputZoomHits++;
  }
}
if (!inputFiles.length) console.log("  (no form fields in bundle)\n");
else if (!inputZoomHits) console.log("  (all field inputs ≥16px)\n");

console.log("--- Page composition hints ---\n");
const hints = scanComposition(pageFile);
if (hints.length) {
  for (const h of hints) console.log(`  ⚠ ${h}`);
} else {
  console.log("  (no composition flags — run visual pass for hierarchy/spacing)");
}

console.log(`\nBundle violation lines: ${totalHits}`);
console.log("Fix order: inputZoom → gradientSurface → surface → layoutRhythm → hoverScale → longMotion (hero)\n");
