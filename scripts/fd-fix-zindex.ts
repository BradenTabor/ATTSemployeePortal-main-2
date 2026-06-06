#!/usr/bin/env tsx
/**
 * fd-fix-zindex.ts — context-aware codemod for the FD `hardZ` category.
 *
 * Layer 3 (Execution) companion to scripts/fd-audit.mjs. Unlike `focusRing`,
 * the `hardZ` category is NOT purely mechanical: the SAME Tailwind value means
 * different layers in different places (`z-50` is a modal here, a dropdown
 * there, a FAB elsewhere). A blind number->constant map would cause stacking
 * bugs. So this codemod:
 *
 *   1. Parses each .tsx with the TypeScript compiler API (real JSX AST).
 *   2. Classifies each hardcoded z-index by the SURROUNDING className context
 *      (modal / drawer / dropdown) — only high-confidence, unambiguous shapes.
 *   3. SKIPS, by design (reported for manual handling in the loop):
 *        - files that mix >1 distinct hardcoded z value (intentional STACKS),
 *        - variant-prefixed tokens (`focus:z-50`, `sm:z-50` — conditional),
 *        - tokens whose className context it can't confidently classify,
 *        - elements whose `style` prop isn't a plain inline object literal.
 *   4. Rewrites safe sites to `style={{ zIndex: Z.* }}` + ensures the
 *      `import { Z } from "@/lib/zIndex"` import.
 *
 * Edits are position-based text splices (AST for *locating*, not re-printing),
 * so untouched code keeps its exact formatting.
 *
 * Usage:
 *   npx tsx scripts/fd-fix-zindex.ts            # dry-run (default): classify + report
 *   npx tsx scripts/fd-fix-zindex.ts --write    # apply the safe subset
 *   npx tsx scripts/fd-fix-zindex.ts --file src/pages/admin/AdminUsers.tsx
 */
import { readdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import ts from "typescript";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SRC = join(ROOT, "src");

const args = process.argv.slice(2);
const WRITE = args.includes("--write");
const ONLY_FILE = (() => {
  const i = args.indexOf("--file");
  return i >= 0 && args[i + 1] ? args[i + 1].replace(/^\.\//, "") : null;
})();

const Z_IMPORT = 'import { Z } from "@/lib/zIndex";';

// A bare z utility token (not variant-prefixed). Matched against a single
// whitespace-split className token, so `focus:z-50` can never match `z-50`.
const isBareZToken = (tok: string) => tok === "z-50" || /^z-\[\d{2,}\]$/.test(tok);

type Layer = "modal" | "dropdown";

/** Classify a z-index site purely from its className static text. Conservative:
 *  returns null (=> skip, manual) unless the shape is unambiguous. */
function classify(cls: string): Layer | null {
  const c = ` ${cls.toLowerCase()} `;
  const has = (s: string) => c.includes(` ${s} `) || c.includes(`${s} `) || c.includes(` ${s}`);
  const fixedInset = /\bfixed\b/.test(c) && /\binset-0\b/.test(c);
  const centered = /\bitems-center\b/.test(c) && /\bjustify-center\b/.test(c);
  const backdrop = /bg-black\//.test(c) || /backdrop-blur/.test(c);
  // Drawer: pinned to an edge, full height.
  const drawer =
    /\bfixed\b/.test(c) && /\bright-0\b/.test(c) && /\btop-0\b/.test(c) && /\bbottom-0\b/.test(c);
  if ((fixedInset && (centered || backdrop)) || drawer) return "modal";
  // Dropdown: anchored menu below a control.
  if (/\babsolute\b/.test(c) && /\btop-full\b/.test(c)) return "dropdown";
  void has;
  return null;
}

const LAYER_CONST: Record<Layer, string> = { modal: "Z.modal", dropdown: "Z.dropdown" };

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (["node_modules", "dist", ".git"].includes(entry)) continue;
      walk(full, acc);
    } else if (entry.endsWith(".tsx")) acc.push(full);
  }
  return acc;
}

interface Edit {
  start: number;
  end: number;
  text: string;
}
interface Skip {
  line: number;
  reason: string;
  snippet: string;
}

/** Remove a bare z token from a className value string, collapsing whitespace. */
function stripZ(value: string): { next: string; removed: boolean } {
  const parts = value.split(/(\s+)/); // keep separators
  let removed = false;
  const kept = parts.filter((p) => {
    if (!removed && isBareZToken(p.trim()) && p.trim() === p) {
      removed = true;
      return false;
    }
    return true;
  });
  let next = kept.join("").replace(/\s{2,}/g, " ").replace(/\s+"/g, '"').trim();
  // Preserve a single leading/trailing space pattern is unnecessary for className.
  next = next.replace(/^\s+|\s+$/g, "");
  return { next, removed };
}

function processFile(full: string): { edits: number; skips: Skip[]; changed: boolean } {
  const rel = relative(ROOT, full).split(sep).join("/");
  const text = readFileSync(full, "utf8");
  const sf = ts.createSourceFile(rel, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

  // First pass: collect all distinct bare z values in this file. >1 distinct
  // value signals an intentional stack -> skip the whole file (manual).
  const distinct = new Set<string>();
  const collectTokens = (s: string) => {
    for (const tok of s.split(/\s+/)) if (isBareZToken(tok)) distinct.add(tok);
  };

  const edits: Edit[] = [];
  const skips: Skip[] = [];
  const lineOf = (pos: number) => sf.getLineAndCharacterOfPosition(pos).line + 1;

  // Helper: read the static className text + the editable string node carrying the token.
  type ClsInfo = { staticText: string; editTarget: ts.StringLiteralLike | null };
  function readClassName(attr: ts.JsxAttribute): ClsInfo | null {
    const init = attr.initializer;
    if (!init) return null;
    if (ts.isStringLiteral(init)) return { staticText: init.text, editTarget: init };
    if (ts.isJsxExpression(init) && init.expression) {
      const e = init.expression;
      if (ts.isStringLiteral(e)) return { staticText: e.text, editTarget: e };
      if (ts.isNoSubstitutionTemplateLiteral(e)) return { staticText: e.text, editTarget: e };
      if (ts.isTemplateExpression(e)) {
        // Classify from static parts, but never splice a TemplateHead: its text
        // ends in `${`, not a quote, so generic string editing corrupts it.
        // editTarget=null => skip (the all-or-nothing rule defers the file).
        const head = e.head.text;
        const tail = e.templateSpans.map((s) => s.literal.text).join(" ");
        return { staticText: `${head} ${tail}`, editTarget: null };
      }
      if (ts.isCallExpression(e) && ts.isIdentifier(e.expression) && e.expression.text === "cn") {
        let target: ts.StringLiteralLike | null = null;
        const statics: string[] = [];
        for (const a of e.arguments) {
          if (ts.isStringLiteral(a) || ts.isNoSubstitutionTemplateLiteral(a)) {
            statics.push(a.text);
            if (!target && a.text.split(/\s+/).some(isBareZToken)) target = a;
          }
        }
        return { staticText: statics.join(" "), editTarget: target };
      }
    }
    return null;
  }

  const opens: (ts.JsxOpeningElement | ts.JsxSelfClosingElement)[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const clsAttr = node.attributes.properties.find(
        (p): p is ts.JsxAttribute =>
          ts.isJsxAttribute(p) && !!p.name && ts.isIdentifier(p.name) && p.name.text === "className"
      );
      if (clsAttr) {
        const info = readClassName(clsAttr);
        if (info) collectTokens(info.staticText);
      }
      opens.push(node);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);

  if (distinct.size === 0) return { edits: 0, skips: [], changed: false };
  if (distinct.size > 1) {
    return {
      edits: 0,
      skips: [
        {
          line: 0,
          reason: `intentional stack — ${distinct.size} distinct z values (${[...distinct].join(", ")})`,
          snippet: rel,
        },
      ],
      changed: false,
    };
  }

  let needImport = false;

  for (const node of opens) {
    const clsAttr = node.attributes.properties.find(
      (p): p is ts.JsxAttribute =>
        ts.isJsxAttribute(p) && !!p.name && ts.isIdentifier(p.name) && p.name.text === "className"
    );
    if (!clsAttr) continue;
    const info = readClassName(clsAttr);
    if (!info) continue;
    if (!info.staticText.split(/\s+/).some(isBareZToken)) continue;

    const ln = lineOf(node.getStart(sf));
    const snippet = info.staticText.slice(0, 70);

    if (!info.editTarget) {
      skips.push({ line: ln, reason: "z token in dynamic expression (not a static string)", snippet });
      continue;
    }
    const layer = classify(info.staticText);
    if (!layer) {
      skips.push({ line: ln, reason: "unclassified context (manual)", snippet });
      continue;
    }

    // style attribute handling.
    const styleAttr = node.attributes.properties.find(
      (p): p is ts.JsxAttribute =>
        ts.isJsxAttribute(p) && !!p.name && ts.isIdentifier(p.name) && p.name.text === "style"
    );
    let styleEdit: Edit | null = null;
    if (!styleAttr) {
      const insertAt = node.tagName.getEnd();
      styleEdit = { start: insertAt, end: insertAt, text: ` style={{ zIndex: ${LAYER_CONST[layer]} }}` };
    } else {
      const init = styleAttr.initializer;
      if (
        init &&
        ts.isJsxExpression(init) &&
        init.expression &&
        ts.isObjectLiteralExpression(init.expression)
      ) {
        const obj = init.expression;
        const hasZ = obj.properties.some(
          (pr) => ts.isPropertyAssignment(pr) && ts.isIdentifier(pr.name) && pr.name.text === "zIndex"
        );
        if (hasZ) {
          skips.push({ line: ln, reason: "style already sets zIndex (manual)", snippet });
          continue;
        }
        const insertAt = obj.getStart(sf) + 1; // just after '{'
        styleEdit = { start: insertAt, end: insertAt, text: ` zIndex: ${LAYER_CONST[layer]},` };
      } else {
        skips.push({ line: ln, reason: "style prop is not an inline object literal (manual)", snippet });
        continue;
      }
    }

    // className token removal.
    const lit = info.editTarget;
    const raw = lit.getText(sf); // includes quotes/backticks
    const quote = raw[0];
    const inner = raw.slice(1, -1);
    const { next, removed } = stripZ(inner);
    if (!removed) {
      skips.push({ line: ln, reason: "could not isolate z token in string (manual)", snippet });
      continue;
    }
    const clsEdit: Edit = {
      start: lit.getStart(sf),
      end: lit.getEnd(),
      text: `${quote}${next}${quote}`,
    };

    edits.push(styleEdit, clsEdit);
    needImport = true;
  }

  if (edits.length === 0) return { edits: 0, skips, changed: false };

  // SAFETY: never partially convert a file. If some bare-z sites here can't be
  // converted, leaving them at their raw Tailwind value while siblings move to
  // the Z scale would invert relative stacking (e.g. a backdrop jumping above
  // its own panel). Abort the whole file and report it for manual handling.
  if (skips.length > 0) {
    return {
      edits: 0,
      skips: [
        ...skips,
        {
          line: 0,
          reason: `partial — ${edits.length / 2} convertible but ${skips.length} unconvertible site(s); skipping file to preserve relative stacking`,
          snippet: rel,
        },
      ],
      changed: false,
    };
  }

  // Ensure import (idempotent). Insert AFTER the last top-level ImportDeclaration
  // via the AST — never a line/regex scan (which mis-fires on multi-line imports
  // and on dynamic `import(...)` calls). Folded into the edit set so it splices
  // with the rest in original coordinates.
  if (needImport && !/from ["']@\/lib\/zIndex["']/.test(text)) {
    const importDecls = sf.statements.filter(ts.isImportDeclaration);
    if (importDecls.length === 0) {
      skips.push({ line: 0, reason: "no import declarations to anchor Z import (manual)", snippet: rel });
      return { edits: 0, skips, changed: false };
    }
    const anchor = importDecls[importDecls.length - 1].getEnd();
    edits.push({ start: anchor, end: anchor, text: `\n${Z_IMPORT}` });
  }

  // Apply edits descending by start so positions stay valid.
  let out = text;
  edits
    .sort((a, b) => b.start - a.start)
    .forEach((e) => {
      out = out.slice(0, e.start) + e.text + out.slice(e.end);
    });

  if (WRITE) writeFileSync(full, out, "utf8");
  return { edits: edits.length / 2, skips, changed: true };
}

function main() {
  const files = walk(SRC).filter((f) => {
    if (!ONLY_FILE) return true;
    return relative(ROOT, f).split(sep).join("/") === ONLY_FILE;
  });

  let totalFixed = 0;
  let filesChanged = 0;
  const allSkips: { file: string; skips: Skip[] }[] = [];

  for (const full of files) {
    const rel = relative(ROOT, full).split(sep).join("/");
    const { edits, skips, changed } = processFile(full);
    if (changed) {
      filesChanged += 1;
      totalFixed += edits;
      console.log(`   ${String(edits).padStart(3)}  ${rel}`);
    }
    if (skips.length) allSkips.push({ file: rel, skips });
  }

  console.log("\n" + "=".repeat(64));
  console.log(
    `${WRITE ? "Converted" : "WOULD convert"} ${totalFixed} site(s) across ${filesChanged} file(s) -> style={{ zIndex: Z.* }}`
  );
  if (!WRITE) console.log("(dry-run — re-run with --write to apply)");

  if (allSkips.length) {
    console.log("\nSKIPPED (left for the manual one-item-per-tick loop):");
    for (const { file, skips } of allSkips) {
      for (const s of skips) {
        const loc = s.line ? `${file}:${s.line}` : file;
        console.log(`   - ${loc} — ${s.reason}`);
      }
    }
  }
  console.log(
    "\nAfter --write: run `npm run fd:audit -- --category hardZ`, then typecheck + lint.\n"
  );
}

main();
