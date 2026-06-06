#!/usr/bin/env node
/**
 * Recover from fd-audit --fix surface accidentally stripping opening quotes
 * on ternary branches and hover:/active: variant prefixes.
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from "fs";
import { join } from "path";

const SRC = join(process.cwd(), "src");
const WRITE = process.argv.includes("--write");

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(tsx?|jsx?)$/.test(name)) out.push(p);
  }
  return out;
}

function fix(content) {
  let s = content;

  // Split variant prefix quotes: hover:"bg- → hover:bg-
  s = s.replace(/hover:"/g, "hover:");
  s = s.replace(/hover:'/g, "hover:");
  s = s.replace(/active:"/g, "active:");
  s = s.replace(/active:'/g, "active:");

  // Object literal keys missing opening quote
  s = s.replace(/\binactive: bg-/g, 'inactive: "bg-');
  s = s.replace(/\bcls: bg-/g, "cls: 'bg-");
  s = s.replace(/\bbadge: bg-/g, "badge: 'bg-");

  // hoverBg: 'hover:'bg- → hoverBg: 'hover:bg-
  s = s.replace(/'hover:'/g, "'hover:");

  // Ternary false branch — double-quoted tail
  s = s.replace(/(\? "[^"]+" : )bg-([^"]+)"/g, '$1"bg-$2"');
  // Ternary false branch — single-quoted tail
  s = s.replace(/(\? '[^']+' : )bg-([^']+)'/g, "$1'bg-$2'");

  // Standalone `: bg-...` before closing double quote (cn / className ternaries)
  s = s.replace(/(: )bg-(gray-[0-9]+(?:\/[0-9]+)?[^"]*)"/g, '$1"bg-$2"');

  // Standalone `: bg-...` before closing single quote
  s = s.replace(/(: )bg-(gray-[0-9]+(?:\/[0-9]+)?[^']*)'/g, "$1'bg-$2'");

  // Template literal ternary: ${cond ? "a" : bg-gray-800"}
  s = s.replace(/(: )bg-(gray-[0-9]+(?:\/[0-9]+)?)"/g, '$1"bg-$2"');

  return s;
}

let changed = 0;
for (const file of walk(SRC)) {
  const before = readFileSync(file, "utf8");
  const after = fix(before);
  if (after !== before) {
    changed++;
    if (WRITE) writeFileSync(file, after);
    else console.log(file.replace(process.cwd() + "/", ""));
  }
}

console.log(WRITE ? `Fixed ${changed} files.` : `Would fix ${changed} files (dry-run). Pass --write to apply.`);
