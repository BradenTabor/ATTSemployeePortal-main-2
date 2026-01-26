/**
 * Training / Certification slug consistency
 *
 * Ensures every certificationSlug in TRAINING_ENTRIES matches a known
 * certification slug so study guide access filtering doesn't break silently.
 */

import { describe, it, expect } from 'vitest';
import { TRAINING_ENTRIES, CERTIFICATION_SLUGS } from '@/content/trainingIndex';

const ALLOWED_SLUGS = new Set(CERTIFICATION_SLUGS);

describe('trainingIndex certificationSlug validation', () => {
  it('every TRAINING_ENTRIES entry with certificationSlug has a value in CERTIFICATION_SLUGS', () => {
    const entriesWithCert = TRAINING_ENTRIES.filter((e) => e.certificationSlug != null);
    for (const entry of entriesWithCert) {
      expect(
        ALLOWED_SLUGS.has(entry.certificationSlug!),
        `${entry.slug} has certificationSlug "${entry.certificationSlug}" which is not in CERTIFICATION_SLUGS`
      ).toBe(true);
    }
  });

  it('CERTIFICATION_SLUGS is non-empty', () => {
    expect(CERTIFICATION_SLUGS.length).toBeGreaterThan(0);
  });

  it('training entries with certificationSlug have unique slugs', () => {
    const slugs = TRAINING_ENTRIES.map((e) => e.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});
