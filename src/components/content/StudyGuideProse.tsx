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
          <span key={`def-${i}`} className="text-emerald-200/70 font-normal">
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
        initial={{ opacity: 0, y: 8, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
      >
        {h1El}
      </motion.div>
    );
  },
  h2: ({ children, ...props }) => (
    <h2
      className={`${BASE} mt-10 border-t border-emerald-500/20 pt-6 text-lg font-semibold text-white [&:first-of-type]:mt-0 [&:first-of-type]:border-t-0 [&:first-of-type]:pt-0`}
      {...props}
    >
      {children}
    </h2>
  ),
  h3: ({ children, ...props }) => (
    <h3
      className={`${BASE} mb-2 mt-6 text-base font-semibold text-emerald-100`}
      {...props}
    >
      {children}
    </h3>
  ),
  p: ({ children, ...props }) => (
    <p
      className={`${BASE} mb-4 leading-relaxed text-emerald-50/95`}
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
        className={`${BASE} border-b border-emerald-500/10 py-3 pl-1 font-medium leading-relaxed text-emerald-50/95 last:border-b-0 [&>strong]:font-semibold [&>strong]:text-white`}
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
      className="rounded bg-emerald-950/50 px-1.5 py-0.5 font-medium text-emerald-200"
      {...props}
    >
      {children}
    </code>
  ),
  table: ({ children, ...props }) => (
    <div className="my-6 overflow-hidden rounded-lg border border-emerald-500/20">
      <table className="w-full text-sm" {...props}>
        {children}
      </table>
    </div>
  ),
  thead: ({ children, ...props }) => (
    <thead className="bg-emerald-950/50" {...props}>
      {children}
    </thead>
  ),
  tbody: ({ children, ...props }) => (
    <tbody className="divide-y divide-emerald-500/15" {...props}>
      {children}
    </tbody>
  ),
  tr: ({ children, ...props }) => (
    <tr className="transition-colors hover:bg-emerald-950/30" {...props}>
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
    <td className="px-4 py-3 font-medium text-emerald-50/95" {...props}>
      {children}
    </td>
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
