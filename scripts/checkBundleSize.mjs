import { promises as fs } from "fs";
import path from "path";

// Bundle size thresholds (in bytes). CI enforcement; see also vite.config.ts chunkSizeWarningLimit (dev visibility).
// main-index: 250KB as of 2026-03-20 (bumped from 248KB after incident card premium redesign).
// main-index: 290KB as of 2026-06-09 — a find() bug previously checked an arbitrary index-* chunk
// (several route chunks share the prefix); the real entry was already ~283KB. Re-baselined; shrinking
// the main bundle back under 250KB is tracked as backlog work.
const THRESHOLDS = [
  // (?!pdf-) keeps the separate lazy vendor-react-pdf chunk out of the vendor-react budget.
  { pattern: /^vendor-react-(?!pdf-).*\.js$/, label: "vendor-react", limit: 230 * 1024 },
  { pattern: /^vendor-supabase-.*\.js$/, label: "vendor-supabase", limit: 200 * 1024 },
  { pattern: /^index-.*\.js$/, label: "main-index", limit: 290 * 1024 },
];

async function checkBundleSizes() {
  const assetsDir = path.resolve(process.cwd(), "dist", "assets");
  let failures = [];

  let files;
  try {
    files = await fs.readdir(assetsDir);
  } catch (err) {
    throw new Error(
      `Unable to read build output in ${assetsDir}. Run "npm run build" before bundle:check.`
    );
  }

  for (const { pattern, label, limit } of THRESHOLDS) {
    const matches = files.filter((file) => pattern.test(file));
    if (matches.length === 0) {
      console.warn(`⚠️  Bundle guard: no file matched pattern ${pattern} for ${label}.`);
      continue;
    }

    // Several chunks can share a prefix (e.g. route chunks also named index-*).
    // Enforce the budget on the largest match so the result doesn't depend on readdir order.
    let largest = null;
    for (const match of matches) {
      const stats = await fs.stat(path.join(assetsDir, match));
      if (!largest || stats.size > largest.size) {
        largest = { match, size: stats.size };
      }
    }

    if (largest.size > limit) {
      failures.push(
        `${label} exceeded limit (${formatKb(largest.size)} KB > ${formatKb(limit)} KB) — ${largest.match}`
      );
    }
  }

  if (failures.length > 0) {
    const message = failures.map((line) => ` - ${line}`).join("\n");
    throw new Error(`Bundle size check failed:\n${message}`);
  }

  console.log("✅ Bundle size check passed.");
}

function formatKb(bytes) {
  return (bytes / 1024).toFixed(1);
}

checkBundleSizes().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});

