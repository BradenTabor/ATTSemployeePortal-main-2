/**
 * Training Materials Index
 * 
 * Config-driven list of training entries for the Resources page.
 * Use Vite ?raw imports to bundle markdown content.
 */

// Import markdown files as raw strings
import bucketTrimmerGuide from './certifications/bucket-trimmer-study-guide.md?raw';
import geoBoyGuide from './certifications/geo-boy-study-guide.md?raw';
import groundsmanGuide from './certifications/groundsman-study-guide.md?raw';
import jaraffTrimmerGuide from './certifications/jarraff-trimmer-study-guide.md?raw';
import skidSteerGuide from './certifications/skid-steer-study-guide.md?raw';

export interface TrainingEntry {
  id: string;
  title: string;
  slug: string;
  description?: string;
  source: 'markdown';
  fileKey: string;
  /** When set, access to this study guide is gated by certification access. Must match certification_types.slug. */
  certificationSlug?: string;
}

/** Certification slugs that exist in DB (for validation and filtering). */
export const CERTIFICATION_SLUGS = [
  'bucket-trimmer',
  'geo-boy',
  'groundsman',
  'jarraff-trimmer',
  'skid-steer',
] as const;

export const TRAINING_ENTRIES: TrainingEntry[] = [
  {
    id: 'bucket-trimmer-guide',
    title: 'Bucket Trimmer Study Guide',
    slug: 'bucket-trimmer-guide',
    description: 'Key topics for the Bucket Trimmer certification test.',
    source: 'markdown',
    fileKey: 'bucket-trimmer-study-guide',
    certificationSlug: 'bucket-trimmer',
  },
  {
    id: 'geo-boy-guide',
    title: 'Geo-Boy Study Guide',
    slug: 'geo-boy-guide',
    description: 'Key topics for the Geo-Boy brush mulching certification test.',
    source: 'markdown',
    fileKey: 'geo-boy-study-guide',
    certificationSlug: 'geo-boy',
  },
  {
    id: 'groundsman-guide',
    title: 'Groundsman Study Guide',
    slug: 'groundsman-guide',
    description: 'Key topics for the Groundsman certification test.',
    source: 'markdown',
    fileKey: 'groundsman-study-guide',
    certificationSlug: 'groundsman',
  },
  {
    id: 'jarraff-trimmer-guide',
    title: 'Jarraff Trimmer Study Guide',
    slug: 'jarraff-trimmer-guide',
    description: 'Key topics for the Jarraff tree trimmer certification test.',
    source: 'markdown',
    fileKey: 'jarraff-trimmer-study-guide',
    certificationSlug: 'jarraff-trimmer',
  },
  {
    id: 'skid-steer-guide',
    title: 'Skid Steer Study Guide',
    slug: 'skid-steer-guide',
    description: 'Key topics for the Skid Steer certification test.',
    source: 'markdown',
    fileKey: 'skid-steer-study-guide',
    certificationSlug: 'skid-steer',
  },
];

// Map fileKey to raw markdown content
const TRAINING_MARKDOWN: Record<string, string> = {
  'bucket-trimmer-study-guide': bucketTrimmerGuide,
  'geo-boy-study-guide': geoBoyGuide,
  'groundsman-study-guide': groundsmanGuide,
  'jarraff-trimmer-study-guide': jaraffTrimmerGuide,
  'skid-steer-study-guide': skidSteerGuide,
};

/**
 * Get markdown content for a training entry by slug
 */
export function getTrainingMarkdown(slug: string): string | null {
  const entry = TRAINING_ENTRIES.find((e) => e.slug === slug);
  if (!entry) return null;
  return TRAINING_MARKDOWN[entry.fileKey] ?? null;
}

/**
 * Get training entry by slug
 */
export function getTrainingEntry(slug: string): TrainingEntry | null {
  return TRAINING_ENTRIES.find((e) => e.slug === slug) ?? null;
}
