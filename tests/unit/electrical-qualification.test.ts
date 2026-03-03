import { describe, it, expect } from 'vitest';
import {
  QUALIFICATION_LABELS,
  type ElectricalQualificationLevel,
} from '../../src/types/electricalQualification';

describe('Electrical qualification types', () => {
  const levels: ElectricalQualificationLevel[] = [
    'unqualified',
    'line_clearance_tree_trimmer',
    'qualified_269',
  ];

  it('QUALIFICATION_LABELS has an entry for each level', () => {
    levels.forEach((level) => {
      expect(QUALIFICATION_LABELS[level]).toBeDefined();
      expect(typeof QUALIFICATION_LABELS[level]).toBe('string');
      expect(QUALIFICATION_LABELS[level].length).toBeGreaterThan(0);
    });
  });

  it('unqualified label is "Unqualified"', () => {
    expect(QUALIFICATION_LABELS.unqualified).toBe('Unqualified');
  });

  it('line_clearance_tree_trimmer label includes "Line-Clearance"', () => {
    expect(QUALIFICATION_LABELS.line_clearance_tree_trimmer).toContain('Line-Clearance');
  });

  it('qualified_269 label includes "Qualified"', () => {
    expect(QUALIFICATION_LABELS.qualified_269).toContain('Qualified');
  });
});
