/**
 * Safety Resources Index
 * 
 * Config-driven list of safety entries for the Resources page.
 * Use Vite ?raw imports to bundle markdown content.
 */

// Import markdown files as raw strings
import quickReference from './safety/quick-reference.md?raw';
import ppeGuidelines from './safety/ppe-guidelines.md?raw';

export interface SafetyEntry {
  id: string;
  title: string;
  slug: string;
  description?: string;
  source: 'markdown';
  fileKey: string;
}

export const SAFETY_ENTRIES: SafetyEntry[] = [
  {
    id: 'quick-reference',
    title: 'Safety Quick Reference',
    slug: 'quick-reference',
    description: 'Essential safety checklist and emergency contacts.',
    source: 'markdown',
    fileKey: 'quick-reference',
  },
  {
    id: 'ppe-guidelines',
    title: 'PPE Guidelines',
    slug: 'ppe-guidelines',
    description: 'Personal protective equipment requirements and care.',
    source: 'markdown',
    fileKey: 'ppe-guidelines',
  },
];

// Map fileKey to raw markdown content
const SAFETY_MARKDOWN: Record<string, string> = {
  'quick-reference': quickReference,
  'ppe-guidelines': ppeGuidelines,
};

/**
 * Get markdown content for a safety entry by slug
 */
export function getSafetyMarkdown(slug: string): string | null {
  const entry = SAFETY_ENTRIES.find((e) => e.slug === slug);
  if (!entry) return null;
  return SAFETY_MARKDOWN[entry.fileKey] ?? null;
}

/**
 * Get safety entry by slug
 */
export function getSafetyEntry(slug: string): SafetyEntry | null {
  return SAFETY_ENTRIES.find((e) => e.slug === slug) ?? null;
}
