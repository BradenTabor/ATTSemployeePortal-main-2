import { describe, it, expect } from 'vitest';
import {
  lookupMAD,
  MAD_TABLE,
  COMMON_VOLTAGES,
} from '../../src/data/madReferenceTable';

describe('lookupMAD', () => {
  it('returns correct entry for 1.1kV – 15kV', () => {
    const entry = lookupMAD(12.47);
    expect(entry).not.toBeNull();
    expect(entry!.phaseToGround).toBe('2 ft 2 in');
    expect(entry!.phaseToPhase).toBe('2 ft 3 in');
  });

  it('returns null for 0V', () => {
    const entry = lookupMAD(0);
    expect(entry).toBeNull();
  });

  it('returns null for negative voltage', () => {
    const entry = lookupMAD(-1);
    expect(entry).toBeNull();
  });

  it('returns correct entry at lower boundary (1.1kV)', () => {
    const entry = lookupMAD(1.1);
    expect(entry).not.toBeNull();
    expect(entry!.label).toContain('1.1kV');
  });

  it('returns correct entry at upper boundary (15kV)', () => {
    const entry = lookupMAD(15);
    expect(entry).not.toBeNull();
    expect(entry!.label).toContain('15');
  });

  it('returns correct entry for 72.6kV – 121kV range', () => {
    const entry = lookupMAD(115);
    expect(entry).not.toBeNull();
    expect(entry!.phaseToGroundMeters).toBeCloseTo(1.13, 2);
  });

  it('returns null for voltage above max range (800kV)', () => {
    const entry = lookupMAD(900);
    expect(entry).toBeNull();
  });

  it('covers all voltage ranges in MAD_TABLE', () => {
    expect(MAD_TABLE.length).toBeGreaterThan(5);
    MAD_TABLE.forEach((entry) => {
      const mid = (entry.voltageRangeKV.min + entry.voltageRangeKV.max) / 2;
      const result = lookupMAD(mid);
      expect(result).toEqual(entry);
    });
  });
});

describe('COMMON_VOLTAGES', () => {
  it('resolves all non-Unknown voltages to a valid MAD entry', () => {
    const nonUnknown = COMMON_VOLTAGES.filter((v) => v.kv >= 0);
    nonUnknown.forEach(({ label, kv }) => {
      const entry = lookupMAD(kv);
      expect(entry, `${label} (${kv}kV) should resolve`).not.toBeNull();
    });
  });

  it('Unknown voltage returns null', () => {
    const unknown = COMMON_VOLTAGES.find((v) => v.kv === -1);
    expect(unknown).toBeDefined();
    expect(lookupMAD(-1)).toBeNull();
  });

  it('includes typical tree-care voltages', () => {
    const labels = COMMON_VOLTAGES.map((v) => v.label);
    expect(labels).toContain('12.47kV');
    expect(labels).toContain('120V');
    expect(labels).toContain('Unknown — contact utility');
  });
});
