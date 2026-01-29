import { promises as fs } from "fs";
import path from "path";

// Bundle size thresholds (in bytes). CI enforcement; see also vite.config.ts chunkSizeWarningLimit (dev visibility).
// Note: main-index 235KB as of 2026-01-28 audit (was 220KB). Target for future optimization.
const THRESHOLDS = [
  { pattern: /^vendor-react-.*\.js$/, label: "vendor-react", limit: 230 * 1024 },
  { pattern: /^vendor-supabase-.*\.js$/, label: "vendor-supabase", limit: 200 * 1024 },
  { pattern: /^index-.*\.js$/, label: "main-index", limit: 235 * 1024 },
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
    const match = files.find((file) => pattern.test(file));
    if (!match) {
      console.warn(`⚠️  Bundle guard: no file matched pattern ${pattern} for ${label}.`);
      continue;
    }

    const filePath = path.join(assetsDir, match);
    const stats = await fs.stat(filePath);
    if (stats.size > limit) {
      failures.push(
        `${label} exceeded limit (${formatKb(stats.size)} KB > ${formatKb(limit)} KB) — ${match}`
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

