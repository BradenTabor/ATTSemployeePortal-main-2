#!/usr/bin/env node
/**
 * Convert simple `whileHover={{ scale: N }}` (scale-only) to CSS `hover:scale-*`.
 * Skips composite whileHover (rotate, y, boxShadow, ternaries) — those stay manual.
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "src");

const SIMPLE = /^\s*whileHover=\{\{\s*scale:\s*([\d.]+)\s*\}\},?\s*$/;

function scaleClass(n) {
  const map = {
    1.01: "hover:scale-[1.01]",
    1.02: "hover:scale-[1.02]",
    1.03: "hover:scale-[1.03]",
    1.05: "hover:scale-105",
    1.08: "hover:scale-[1.08]",
    1.1: "hover:scale-110",
    1.15: "hover:scale-110",
  };
  return map[n] || `hover:scale-[${n}]`;
}

function injectHoverClass(line, hoverCls) {
  if (line.includes(hoverCls)) return line;
  // className="..."
  const dq = line.match(/className="([^"]*)"/);
  if (dq) {
    return line.replace(/className="([^"]*)"/, `className="${dq[1]} ${hoverCls}"`);
  }
  // className={'...'}
  const sq = line.match(/className='([^']*)'/);
  if (sq) {
    return line.replace(/className='([^']*)'/, `className='${sq[1]} ${hoverCls}'`);
  }
  // className={cn("...", ...)}
  const cnDq = line.match(/className=\{cn\(\s*"([^"]*)"/);
  if (cnDq) {
    return line.replace(/className=\{cn\(\s*"([^"]*)"/, `className={cn("${cnDq[1]} ${hoverCls}"`);
  }
  const cnSq = line.match(/className=\{cn\(\s*'([^']*)'/);
  if (cnSq) {
    return line.replace(/className=\{cn\(\s*'([^']*)'/, `className={cn('${cnSq[1]} ${hoverCls}'`);
  }
  return null;
}

function walk(dir, acc = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory() && e.name !== "node_modules") walk(p, acc);
    else if (e.name.endsWith(".tsx")) acc.push(p);
  }
  return acc;
}

let filesFixed = 0;
let linesRemoved = 0;

for (const file of walk(SRC)) {
  const lines = readFileSync(file, "utf8").split("\n");
  let changed = false;

  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(SIMPLE);
    if (!m) continue;
    const hoverCls = scaleClass(parseFloat(m[1]));
    let injected = false;
    const tryInject = (j) => {
      const updated = injectHoverClass(lines[j], hoverCls);
      if (updated) {
        lines[j] = updated;
        return true;
      }
      return false;
    };
    for (let j = i - 1; j >= Math.max(0, i - 25); j--) {
      if (tryInject(j)) {
        injected = true;
        break;
      }
      if (/^\s*<(motion\.)?[A-Z]/.test(lines[j]) && !lines[j].includes("className")) break;
    }
    if (!injected) {
      for (let j = i + 1; j < Math.min(lines.length, i + 25); j++) {
        if (tryInject(j)) {
          injected = true;
          break;
        }
        if (/^\s*\/?>/.test(lines[j]) || /^\s*<[A-Za-z]/.test(lines[j])) break;
      }
    }
    if (!injected) continue;
    lines[i] = null;
    linesRemoved++;
    changed = true;
  }

  if (changed) {
    writeFileSync(file, lines.filter((l) => l !== null).join("\n"));
    filesFixed++;
  }
}

console.log(`fd-fix-hover-scale: removed ${linesRemoved} whileHover scale prop(s) in ${filesFixed} file(s)`);
