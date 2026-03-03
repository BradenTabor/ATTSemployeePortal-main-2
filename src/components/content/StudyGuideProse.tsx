/**
 * StudyGuideProse
 *
 * Renders markdown study guide / safety doc content with clear visual hierarchy,
 * term–definition list styling, section separation, and improved scannability.
 * Supports animated gradient + motion on document h1 when prefersReducedMotion is false.
 */

import React, { Children, isValidElement, useMemo } from "react";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";

const BASE = "max-w-none";

const DOC_H1_GRADIENT = {
  backgroundImage:
    "linear-gradient(105deg, rgba(167, 243, 208, 1) 0%, rgba(110, 231, 183, 1) 25%, rgba(52, 211, 153, 1) 50%, rgba(16, 185, 129, 1) 75%, rgba(110, 231, 183, 1) 100%)",
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  textShadow: "0 0 10px rgba(52, 211, 153, 0.35)",
} as const;

function parseTermDefinition(children: React.ReactNode): React.ReactNode {
  const arr = Children.toArray(children);
  const out: React.ReactNode[] = [];
  let i = 0;
  while (i < arr.length) {
    const el = arr[i];
    if (isValidElement(el) && el.type === "strong") {
      const next = arr[i + 1];
      if (typeof next === "string" && next.startsWith(" — ")) {
        out.push(
          el,
          " — ",
          <span key={`def-${i}`} className="text-white/60 font-normal">
            {next.slice(3)}
          </span>
        );
        i += 2;
        continue;
      }
    }
    out.push(el);
    i += 1;
  }
  return out.length ? out : children;
}

function buildProseComponents(prefersReducedMotion: boolean): Components {
  return {
  h1: ({ children, ...props }) => {
    const h1El = (
      <h1
        className={`${BASE} mb-5 text-2xl font-bold tracking-tight text-transparent bg-clip-text`}
        style={DOC_H1_GRADIENT}
        {...props}
      >
        {children}
      </h1>
    );
    if (prefersReducedMotion) return h1El;
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
      >
        {h1El}
      </motion.div>
    );
  },
  h2: ({ children, ...props }) => (
    <h2
      className={`${BASE} mt-10 border-t border-white/10 pt-6 text-lg font-semibold text-white [&:first-of-type]:mt-0 [&:first-of-type]:border-t-0 [&:first-of-type]:pt-0`}
      {...props}
    >
      {children}
    </h2>
  ),
  h3: ({ children, ...props }) => (
    <h3
      className={`${BASE} mb-2 mt-6 text-base font-semibold text-white`}
      {...props}
    >
      {children}
    </h3>
  ),
  p: ({ children, ...props }) => (
    <p
      className={`${BASE} mb-4 leading-relaxed text-white/70`}
      {...props}
    >
      {children}
    </p>
  ),
  ul: ({ children, ...props }) => (
    <ul
      className={`${BASE} my-5 list-disc space-y-0 pl-6 marker:text-emerald-400/80`}
      {...props}
    >
      {children}
    </ul>
  ),
  ol: ({ children, ...props }) => (
    <ol
      className={`${BASE} my-5 list-decimal space-y-0 pl-6 marker:font-semibold marker:text-emerald-400/80`}
      {...props}
    >
      {children}
    </ol>
  ),
  li: ({ children, ...props }) => {
    const content = parseTermDefinition(children);
    return (
      <li
        className={`${BASE} border-b border-white/10 py-3 pl-1 font-medium leading-relaxed text-white/70 last:border-b-0 [&>strong]:font-semibold [&>strong]:text-white`}
        {...props}
      >
        {content}
      </li>
    );
  },
  strong: ({ children, ...props }) => (
    <strong className="font-semibold text-white" {...props}>
      {children}
    </strong>
  ),
  a: ({ href, children, ...props }) => (
    <a
      href={href}
      className="font-medium text-emerald-300 no-underline hover:text-emerald-200 hover:underline"
      {...props}
    >
      {children}
    </a>
  ),
  code: ({ children, ...props }) => (
    <code
      className="rounded bg-gray-950 border border-white/10 px-1.5 py-0.5 font-mono text-sm text-emerald-300"
      {...props}
    >
      {children}
    </code>
  ),
  pre: ({ children, ...props }) => (
    <pre
      className="my-4 rounded-lg bg-gray-950 border border-white/10 px-4 py-3 overflow-x-auto font-mono text-sm text-emerald-300"
      {...props}
    >
      {children}
    </pre>
  ),
  blockquote: ({ children, ...props }) => (
    <blockquote
      className="my-4 rounded-r-lg border-l-[3px] border-l-emerald-500/50 bg-emerald-500/5 px-4 py-3 text-sm text-white/80 [&>p]:mb-0"
      {...props}
    >
      {children}
    </blockquote>
  ),
  table: ({ children, ...props }) => (
    <div className="my-6 overflow-hidden rounded-lg border border-white/10">
      <table className="w-full text-sm" {...props}>
        {children}
      </table>
    </div>
  ),
  thead: ({ children, ...props }) => (
    <thead className="bg-gray-800" {...props}>
      {children}
    </thead>
  ),
  tbody: ({ children, ...props }) => (
    <tbody className="divide-y divide-white/10" {...props}>
      {children}
    </tbody>
  ),
  tr: ({ children, ...props }) => (
    <tr className="transition-colors hover:bg-gray-800/50" {...props}>
      {children}
    </tr>
  ),
  th: ({ children, ...props }) => (
    <th
      className="px-4 py-3 text-left font-semibold text-white"
      {...props}
    >
      {children}
    </th>
  ),
  td: ({ children, ...props }) => (
    <td className="px-4 py-3 font-medium text-white/70" {...props}>
      {children}
    </td>
  ),
  img: ({ src, alt, ...props }) => (
    <img
      src={src}
      alt={alt ?? ""}
      className="my-4 rounded-xl border border-white/10 shadow-lg shadow-black/30"
      {...props}
    />
  ),
};
}

interface StudyGuideProseProps {
  markdown: string;
  prefersReducedMotion?: boolean;
}

export function StudyGuideProse({ markdown, prefersReducedMotion = true }: StudyGuideProseProps) {
  const components = useMemo(
    () => buildProseComponents(prefersReducedMotion),
    [prefersReducedMotion]
  );
  return (
    <article className={`prose prose-invert ${BASE}`}>
      <ReactMarkdown components={components}>{markdown}</ReactMarkdown>
    </article>
  );
}
