#!/usr/bin/env tsx
/**
 * fd-fix-input-zoom.ts — compliance-forms codemod for the FD `inputZoom` category.
 *
 * Layer 3 (Execution) companion to scripts/fd-audit.mjs, purpose-built for the
 * continuous frontend-design loop's COMPLIANCE-FORMS lens
 * (directives/frontend_design_loop.md). It targets the single highest-impact,
 * field-worker-facing bug the line-based auditor cannot see:
 *
 *   iOS auto-zoom on form fields. The LOCKED design guide (§6, §11) requires
 *   `text-base` (16px) minimum on every <input>/<select>/<textarea>. Mobile
 *   Safari zooms the viewport whenever a focused field's font-size is < 16px —
 *   so a worker tapping a `text-sm` field on an iPhone 13 (the P0 device) gets a
 *   jarring zoom + horizontal scroll mid-job. The safety forms are riddled with
 *   `text-sm`/`text-xs` inputs, making this the most concrete forms win available.
 *
 * Why a dedicated codemod (not the line-based fd-audit RULES):
 *   An input's className is frequently multi-line and wrapped in `cn(...)`, so a
 *   per-line regex cannot tell "this `text-sm` is on an <input>" from "this
 *   `text-sm` is on a <label>". Only `text-sm` on a *field* causes the zoom.
 *   This tool parses the real JSX AST (TypeScript compiler API, same approach as
 *   fd-fix-zindex.ts — no new deps, uses the installed `tsx`), so it edits ONLY
 *   field elements and never touches surrounding label/helper text.
 *
 * Detection (deterministic, high-confidence):
 *   - Element is an intrinsic <input>, <select>, or <textarea> (lowercase tag).
 *   - Its className carries a BARE (un-variant-prefixed) sub-16px size token:
 *       `text-xs` (12px), `text-sm` (14px), or `text-[Npx]` / `text-[Nrem]` <16px.
 *     Variant-prefixed tokens (`md:text-sm`) are IGNORED — desktop never zooms;
 *     only the mobile base matters. Color tokens (`text-white`) are never size.
 *
 * Fix (mechanical, idempotent):
 *   - Rewrite the offending size token to `text-base` in the exact string
 *     literal that carries it (string attr, `cn()` string arg, or
 *     no-substitution template). `text-base` re-run is a no-op.
 *
 * SKIPS (reported for the manual one-item-per-tick loop):
 *   - template-expression classNames (`{`...${x}...`}`) — splicing a TemplateHead
 *     corrupts it (same hazard fd-fix-zindex.ts documents).
 *   - className built by a non-`cn` call / spread it can't statically read.
 *   Fields with NO explicit size token are NOT flagged (can't be fixed safely by
 *   token swap; inserting a class is more invasive and left to manual review).
 *
 * Usage:
 *   npx tsx scripts/fd-fix-input-zoom.ts                 # dry-run report (all src)
 *   npx tsx scripts/fd-fix-input-zoom.ts --forms         # dry-run, compliance forms only
 *   npx tsx scripts/fd-fix-input-zoom.ts --forms --write # apply to compliance forms
 *   npx tsx scripts/fd-fix-input-zoom.ts --file <path>   # scope to one file
 *   npx tsx scripts/fd-fix-input-zoom.ts --write         # apply repo-wide
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
const FORMS_ONLY = args.includes("--forms");
const ONLY_FILE = (() => {
  const i = args.indexOf("--file");
  return i >= 0 && args[i + 1] ? args[i + 1].replace(/^\.\//, "") : null;
})();

// Compliance/safety form surfaces — the loop's forms lens scope. These are the
// directories that actually render field inputs the user fills out.
const FORMS_PREFIXES = ["src/pages/forms/", "src/components/forms/"];

const FIELD_TAGS = new Set(["input", "select", "textarea"]);

// Well-factored forms hoist the shared field styling into a const
// (`baseInputClass`, `inputBase`, `inputClass`, `textareaClass`, …) that every
// field's className derives from. The `text-sm` lives there, so the per-element
// pass below never sees it (the className is just an identifier / helper call).
// Bumping the constant fixes every field that uses it in ONE edit — the highest
// leverage available. Trigger ONLY on names that unambiguously denote a field
// style (contains input/textarea — never `label`, never a surface), to keep
// precision at 100% and avoid clobbering a shared non-field constant.
const FIELD_CONST_RE = /input|textarea/i;

/** Bare (un-variant-prefixed) sub-16px Tailwind text-size token? */
function isSub16SizeToken(tok: string): boolean {
  if (tok.includes(":")) return false; // md:text-sm etc — desktop, no zoom
  if (tok === "text-xs" || tok === "text-sm") return true;
  const m = tok.match(/^text-\[(\d+(?:\.\d+)?)(px|rem)\]$/);
  if (m) {
    const n = parseFloat(m[1]);
    const px = m[2] === "rem" ? n * 16 : n;
    return px < 16;
  }
  return false;
}

/** Replace every bare sub-16px size token in a className value with text-base. */
function bumpTokens(value: string): { next: string; changed: number } {
  let changed = 0;
  const next = value
    .split(/(\s+)/) // keep separators to preserve formatting
    .map((part) => {
      if (part.trim() !== part || part === "") return part; // whitespace chunk
      if (isSub16SizeToken(part)) {
        changed += 1;
        return "text-base";
      }
      return part;
    })
    .join("");
  return { next, changed };
}

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
interface Hit {
  line: number;
  tag: string;
  token: string;
}
interface Skip {
  line: number;
  tag: string;
  reason: string;
}

/** All editable string-literal nodes that make up a className value. */
function editableStrings(
  attr: ts.JsxAttribute
): { nodes: ts.StringLiteralLike[]; dynamic: boolean } {
  const init = attr.initializer;
  if (!init) return { nodes: [], dynamic: false };
  if (ts.isStringLiteral(init)) return { nodes: [init], dynamic: false };
  if (ts.isJsxExpression(init) && init.expression) {
    const e = init.expression;
    if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e))
      return { nodes: [e], dynamic: false };
    if (ts.isTemplateExpression(e)) return { nodes: [], dynamic: true };
    if (ts.isCallExpression(e) && ts.isIdentifier(e.expression) && e.expression.text === "cn") {
      const nodes: ts.StringLiteralLike[] = [];
      let dynamic = false;
      for (const a of e.arguments) {
        if (ts.isStringLiteral(a) || ts.isNoSubstitutionTemplateLiteral(a)) nodes.push(a);
        else if (ts.isConditionalExpression(a)) {
          // grade common `cond ? "x" : "y"` — both branches editable if strings
          for (const branch of [a.whenTrue, a.whenFalse]) {
            if (ts.isStringLiteral(branch) || ts.isNoSubstitutionTemplateLiteral(branch))
              nodes.push(branch);
            else dynamic = true;
          }
        } else dynamic = true;
      }
      return { nodes, dynamic };
    }
    return { nodes: [], dynamic: true };
  }
  return { nodes: [], dynamic: false };
}

function processFile(full: string): { fixed: number; hits: Hit[]; skips: Skip[]; changed: boolean } {
  const rel = relative(ROOT, full).split(sep).join("/");
  const text = readFileSync(full, "utf8");
  const sf = ts.createSourceFile(rel, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const lineOf = (pos: number) => sf.getLineAndCharacterOfPosition(pos).line + 1;

  const edits: Edit[] = [];
  const hits: Hit[] = [];
  const skips: Skip[] = [];

  // Does a className string look like a real field base (vs. a label/helper)?
  // Fields are always full-width with a border or background; labels are not.
  const looksLikeFieldBase = (s: string) =>
    /\bw-full\b/.test(s) && (/\bborder\b/.test(s) || /\bbg-/.test(s));

  const visit = (node: ts.Node) => {
    // Pass B: field-style constants (`const baseInputClass = "... text-sm ..."`).
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      FIELD_CONST_RE.test(node.name.text) &&
      node.initializer
    ) {
      const strNodes: ts.StringLiteralLike[] = [];
      const collect = (n: ts.Node) => {
        if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) strNodes.push(n);
        ts.forEachChild(n, collect);
      };
      collect(node.initializer);
      const combined = strNodes.map((n) => n.text).join(" ");
      if (looksLikeFieldBase(combined)) {
        for (const lit of strNodes) {
          const raw = lit.getText(sf);
          const quote = raw[0];
          const inner = raw.slice(1, -1);
          const ln = lineOf(lit.getStart(sf));
          for (const tok of inner.split(/\s+/)) {
            if (isSub16SizeToken(tok)) hits.push({ line: ln, tag: `const ${node.name.text}`, token: tok });
          }
          const { next, changed } = bumpTokens(inner);
          if (changed > 0)
            edits.push({ start: lit.getStart(sf), end: lit.getEnd(), text: `${quote}${next}${quote}` });
        }
      }
    }

    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName.getText(sf);
      if (FIELD_TAGS.has(tag)) {
        const clsAttr = node.attributes.properties.find(
          (p): p is ts.JsxAttribute =>
            ts.isJsxAttribute(p) &&
            !!p.name &&
            ts.isIdentifier(p.name) &&
            p.name.text === "className"
        );
        if (clsAttr) {
          const { nodes, dynamic } = editableStrings(clsAttr);
          const ln = lineOf(node.getStart(sf));
          let foundEditable = false;
          for (const lit of nodes) {
            const raw = lit.getText(sf);
            const quote = raw[0];
            const inner = raw.slice(1, -1);
            // collect tokens for reporting
            for (const tok of inner.split(/\s+/)) {
              if (isSub16SizeToken(tok)) hits.push({ line: ln, tag, token: tok });
            }
            const { next, changed } = bumpTokens(inner);
            if (changed > 0) {
              foundEditable = true;
              edits.push({ start: lit.getStart(sf), end: lit.getEnd(), text: `${quote}${next}${quote}` });
            }
          }
          // Only flag the genuinely un-spliceable shape: a template-expression
          // className (`{`...${x}...`}`) where bumping would corrupt a
          // TemplateHead. Plain identifier / helper-call classNames
          // (`{inputBase}`, `{inputErrorClass("x")}`) are deliberately silent —
          // they're fixed at the source via the field-const pass above, so
          // listing each field would be noise, not signal.
          const init = clsAttr.initializer;
          const isTemplate =
            !!init &&
            ts.isJsxExpression(init) &&
            !!init.expression &&
            ts.isTemplateExpression(init.expression);
          if (dynamic && !foundEditable && isTemplate) {
            skips.push({ line: ln, tag, reason: "template-literal className — manual (TemplateHead splice hazard)" });
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);

  if (edits.length === 0) return { fixed: 0, hits, skips, changed: false };

  let out = text;
  edits
    .sort((a, b) => b.start - a.start)
    .forEach((e) => {
      out = out.slice(0, e.start) + e.text + out.slice(e.end);
    });

  if (WRITE) writeFileSync(full, out, "utf8");
  return { fixed: edits.length, hits, skips, changed: true };
}

function inScope(rel: string): boolean {
  if (ONLY_FILE) return rel === ONLY_FILE;
  if (FORMS_ONLY) return FORMS_PREFIXES.some((p) => rel.startsWith(p));
  return true;
}

function main() {
  const files = walk(SRC).filter((f) => inScope(relative(ROOT, f).split(sep).join("/")));

  let totalFixed = 0;
  let filesChanged = 0;
  const allSkips: { file: string; skips: Skip[] }[] = [];
  let totalHits = 0;

  console.log(
    `\nFD input-zoom codemod${FORMS_ONLY ? " [compliance forms]" : ""}${WRITE ? "" : " (dry-run)"}`
  );
  console.log("=".repeat(64));

  for (const full of files) {
    const rel = relative(ROOT, full).split(sep).join("/");
    const { fixed, hits, skips, changed } = processFile(full);
    totalHits += hits.length;
    if (changed) {
      filesChanged += 1;
      totalFixed += fixed;
      const tokens = [...new Set(hits.map((h) => h.token))].join(", ");
      console.log(`   ${String(fixed).padStart(3)}  ${rel}  (${tokens})`);
    }
    if (skips.length) allSkips.push({ file: rel, skips });
  }

  console.log("=".repeat(64));
  console.log(
    `${WRITE ? "Bumped" : "WOULD bump"} ${totalFixed} field token(s) -> text-base across ${filesChanged} file(s). ` +
      `(${totalHits} sub-16px field token(s) detected.)`
  );
  if (!WRITE && totalFixed > 0) console.log("(dry-run — re-run with --write to apply)");

  if (allSkips.length) {
    console.log("\nSKIPPED (manual one-item-per-tick loop):");
    for (const { file, skips } of allSkips) {
      for (const s of skips) console.log(`   - ${file}:${s.line} <${s.tag}> — ${s.reason}`);
    }
  }
  console.log(
    "\nAfter --write: run `npm run typecheck && npx eslint <changed files>` (LOCKED a11y/UX gate).\n"
  );
}

main();
