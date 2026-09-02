/**
 * Copies the self-hosted CANOPY webfonts from the @fontsource-variable packages
 * into public/fonts so they ship on the same origin (no third-party connection,
 * precached by the service worker for offline use, and preloadable from
 * index.html with a stable URL).
 *
 * Run after bumping a @fontsource-variable/* package:  npm run fonts:sync
 */
import { copyFileSync, mkdirSync, statSync } from "fs";
import path from "path";

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, "public", "fonts");

// [package, source file, destination name]
//
// We ship the `wght`-only builds rather than `opsz` (optical size + weight).
// Dropping the opsz axis cuts ~100 KB from the first-load font payload
// (249 KB -> 152 KB) while keeping the weights the design system uses. Both
// families are instanced at their default optical size, which happens to match
// how CANOPY uses them: Fraunces defaults to opsz 144 (the display cut, and it
// only ever sets display copy) and Bricolage defaults to opsz 14 (the text cut,
// and it is the UI body face).
const FONTS = [
  // Fraunces — display serif (upright + italic for hero words).
  ["fraunces", "fraunces-latin-wght-normal.woff2", "fraunces-latin-wght-normal.woff2"],
  ["fraunces", "fraunces-latin-wght-italic.woff2", "fraunces-latin-wght-italic.woff2"],
  // Bricolage Grotesque — UI sans.
  ["bricolage-grotesque", "bricolage-grotesque-latin-wght-normal.woff2", "bricolage-grotesque-latin-wght-normal.woff2"],
  // Martian Mono — instrument labels (no optical axis in the family).
  ["martian-mono", "martian-mono-latin-wght-normal.woff2", "martian-mono-latin-wght-normal.woff2"],
];

mkdirSync(OUT_DIR, { recursive: true });

let total = 0;
for (const [pkg, src, dest] of FONTS) {
  const from = path.join(ROOT, "node_modules", "@fontsource-variable", pkg, "files", src);
  const to = path.join(OUT_DIR, dest);
  copyFileSync(from, to);
  const bytes = statSync(to).size;
  total += bytes;
  console.log(`  ${dest}  ${(bytes / 1024).toFixed(1)} KB`);
}
console.log(`fonts:sync  ${FONTS.length} files, ${(total / 1024).toFixed(1)} KB -> public/fonts`);
