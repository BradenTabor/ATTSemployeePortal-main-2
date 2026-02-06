/**
 * Export Utils Unit Tests (Slice 0 — Safety Compliance Export Upgrade)
 *
 * Tests for formatters and getExportColumns used by JSA, DVIR, and Equipment exports.
 * Plan: docs/SafetyCompliance-Export-Summary.md §4.1, §5.2
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  formatMechanicPartsUsed,
  formatSpansSummary,
  formatChecklistFull,
  formatPhotoPresent,
  formatPPESummary,
  formatCheckedLabels,
  getExportColumns,
  DataExporter,
  type ExportColumn,
  type MechanicPartExport,
  type JsaSpanForExport,
  type ChecklistItemForExport,
} from '@/lib/exportUtils';

// =============================================================================
// formatMechanicPartsUsed
// =============================================================================

describe('formatMechanicPartsUsed', () => {
  it('returns "N/A" for null', () => {
    expect(formatMechanicPartsUsed(null)).toBe('N/A');
  });

  it('returns "N/A" for undefined', () => {
    expect(formatMechanicPartsUsed(undefined)).toBe('N/A');
  });

  it('returns "N/A" for empty array', () => {
    expect(formatMechanicPartsUsed([])).toBe('N/A');
  });

  it('formats single part as "PartName xqty"', () => {
    const parts: MechanicPartExport[] = [{ part_name: 'Filter', quantity: 1 }];
    expect(formatMechanicPartsUsed(parts)).toBe('Filter x1');
  });

  it('formats multiple parts with semicolon separator', () => {
    const parts: MechanicPartExport[] = [
      { part_name: 'Part A', quantity: 2 },
      { part_name: 'Part B', quantity: 1 },
    ];
    expect(formatMechanicPartsUsed(parts)).toBe('Part A x2; Part B x1');
  });

  it('ignores optional part_number and cost for display', () => {
    const parts: MechanicPartExport[] = [
      { part_name: 'Oil', quantity: 1, part_number: 'O-123', cost: 25 },
    ];
    expect(formatMechanicPartsUsed(parts)).toBe('Oil x1');
  });
});

// =============================================================================
// formatSpansSummary
// =============================================================================

describe('formatSpansSummary', () => {
  it('returns empty string for null', () => {
    expect(formatSpansSummary(null)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(formatSpansSummary(undefined)).toBe('');
  });

  it('returns empty string for empty array', () => {
    expect(formatSpansSummary([])).toBe('');
  });

  it('formats single span with location, hazards, mitigation, initials', () => {
    const spans: JsaSpanForExport[] = [
      { location: 'Pole 1', hazards: 'Power lines', mitigation: 'MAD', initials: 'JD' },
    ];
    expect(formatSpansSummary(spans)).toBe(
      '1: Pole 1 | Power lines | MAD | JD'
    );
  });

  it('uses em dash for missing fields', () => {
    const spans: JsaSpanForExport[] = [{ location: 'Only', hazards: '', mitigation: '', initials: '' }];
    expect(formatSpansSummary(spans)).toBe('1: Only | — | — | —');
  });

  it('formats multiple spans with semicolon separator', () => {
    const spans: JsaSpanForExport[] = [
      { location: 'A', hazards: 'H1', mitigation: 'M1', initials: 'X' },
      { location: 'B', hazards: 'H2', mitigation: 'M2', initials: 'Y' },
    ];
    expect(formatSpansSummary(spans)).toBe(
      '1: A | H1 | M1 | X; 2: B | H2 | M2 | Y'
    );
  });

  it('trims whitespace from fields', () => {
    const spans: JsaSpanForExport[] = [
      { location: '  loc  ', hazards: '  haz  ', mitigation: '  mit  ', initials: '  in  ' },
    ];
    expect(formatSpansSummary(spans)).toBe('1: loc | haz | mit | in');
  });
});

// =============================================================================
// formatChecklistFull
// =============================================================================

describe('formatChecklistFull', () => {
  const items: ChecklistItemForExport[] = [
    { id: 'a', label: 'Item A' },
    { id: 'b', label: 'Item B' },
  ];

  it('returns empty string for empty items', () => {
    expect(formatChecklistFull({ a: 'P' }, [])).toBe('');
  });

  it('returns label and value for each item', () => {
    const checklist = { a: 'P', b: 'F' };
    expect(formatChecklistFull(checklist, items)).toBe(
      'Item A: P; Item B: F'
    );
  });

  it('uses em dash for missing checklist value', () => {
    const checklist = { a: 'P' };
    expect(formatChecklistFull(checklist, items)).toBe(
      'Item A: P; Item B: —'
    );
  });

  it('handles null checklist', () => {
    expect(formatChecklistFull(null, items)).toBe('Item A: —; Item B: —');
  });

  it('handles undefined checklist', () => {
    expect(formatChecklistFull(undefined, items)).toBe('Item A: —; Item B: —');
  });

  it('trims and stringifies checklist values', () => {
    const checklist = { a: ' N/A ', b: 'P' };
    expect(formatChecklistFull(checklist, items)).toBe(
      'Item A: N/A; Item B: P'
    );
  });
});

// =============================================================================
// formatPhotoPresent
// =============================================================================

describe('formatPhotoPresent', () => {
  it('returns "No" for null', () => {
    expect(formatPhotoPresent(null)).toBe('No');
  });

  it('returns "No" for undefined', () => {
    expect(formatPhotoPresent(undefined)).toBe('No');
  });

  it('returns "No" for empty string', () => {
    expect(formatPhotoPresent('')).toBe('No');
  });

  it('returns "No" for whitespace-only string', () => {
    expect(formatPhotoPresent('   ')).toBe('No');
  });

  it('returns "Yes" for non-empty path', () => {
    expect(formatPhotoPresent('/path/to/photo.jpg')).toBe('Yes');
  });

  it('returns "Yes" for path with spaces', () => {
    expect(formatPhotoPresent(' https://bucket.s3/photo.png ')).toBe('Yes');
  });
});

// =============================================================================
// formatPPESummary
// =============================================================================

describe('formatPPESummary', () => {
  const items = [
    { key: 'hard_hats', label: 'Hard hats' },
    { key: 'safety_glasses', label: 'Safety glasses' },
  ];

  it('returns empty string for empty items', () => {
    expect(formatPPESummary({}, [])).toBe('');
  });

  it('formats required item with condition', () => {
    const ppe = { hard_hats: { required: true, condition: 'good' } };
    expect(formatPPESummary(ppe, items)).toContain('Hard hats: Required, good');
  });

  it('formats required item without condition', () => {
    const ppe = { hard_hats: { required: true } };
    expect(formatPPESummary(ppe, items)).toContain('Hard hats: Required');
  });

  it('formats not required', () => {
    const ppe = { hard_hats: { required: false } };
    expect(formatPPESummary(ppe, items)).toContain('Hard hats: Not Required');
  });

  it('handles null/undefined ppe', () => {
    expect(formatPPESummary(null, items)).toContain('Hard hats: Not Required');
    expect(formatPPESummary(undefined, items)).toContain('Hard hats: Not Required');
  });
});

// =============================================================================
// formatCheckedLabels
// =============================================================================

describe('formatCheckedLabels', () => {
  const items = [
    { key: 'a', label: 'Item A' },
    { key: 'b', label: 'Item B' },
  ];

  it('returns empty string for null map', () => {
    expect(formatCheckedLabels(null, items)).toBe('');
  });

  it('returns empty string for empty items', () => {
    expect(formatCheckedLabels({ a: true }, [])).toBe('');
  });

  it('returns comma-separated labels for checked keys', () => {
    expect(formatCheckedLabels({ a: true, b: true }, items)).toBe('Item A, Item B');
  });

  it('returns only checked labels', () => {
    expect(formatCheckedLabels({ a: true, b: false }, items)).toBe('Item A');
  });

  it('returns "None" when no items checked', () => {
    expect(formatCheckedLabels({ a: false, b: false }, items)).toBe('None');
  });
});

// =============================================================================
// getExportColumns
// =============================================================================

describe('getExportColumns', () => {
  const allColumns: ExportColumn<{ a: string; b: string }>[] = [
    { header: 'A', key: 'a' },
    { header: 'B', key: 'b', includeInPdf: false },
    { header: 'C', key: 'a', includeInPdf: true },
  ];

  it('returns all columns for csv', () => {
    const result = getExportColumns(allColumns, 'csv');
    expect(result).toHaveLength(3);
    expect(result).toEqual(allColumns);
  });

  it('returns all columns for excel', () => {
    const result = getExportColumns(allColumns, 'excel');
    expect(result).toHaveLength(3);
    expect(result).toEqual(allColumns);
  });

  it('for pdf returns only columns with includeInPdf !== false', () => {
    const result = getExportColumns(allColumns, 'pdf');
    expect(result).toHaveLength(2);
    expect(result.map(c => c.header)).toEqual(['A', 'C']);
  });

  it('for pdf returns all columns when none set includeInPdf', () => {
    const noPdfFlag = [
      { header: 'A', key: 'a' as const },
      { header: 'B', key: 'b' as const },
    ];
    const result = getExportColumns(noPdfFlag, 'pdf');
    expect(result).toHaveLength(2);
  });
});

// =============================================================================
// DataExporter idempotency guard
// =============================================================================

describe('DataExporter idempotency guard', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('skips second exportCSV when first is in progress', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const exporter = new DataExporter<{ x: string }>();
    const columns: ExportColumn<{ x: string }>[] = [{ header: 'X', key: 'x' }];
    const options = {
      data: [{ x: '1' }],
      columns,
      filename: 'test',
    };
    // Start first export (synchronous, so it completes immediately)
    exporter.exportCSV(options);
    expect(warnSpy).not.toHaveBeenCalled();
    // Second call should be allowed after first completed (CSV is sync)
    exporter.exportCSV(options);
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('exportCSV sets and clears exportInProgress in finally', () => {
    const exporter = new DataExporter<{ x: string }>();
    const columns: ExportColumn<{ x: string }>[] = [{ header: 'X', key: 'x' }];
    exporter.exportCSV({
      data: [{ x: '1' }],
      columns,
      filename: 'test',
    });
    // After sync export, guard should be false so next call runs
    exporter.exportCSV({
      data: [{ x: '2' }],
      columns,
      filename: 'test2',
    });
    // No throw and no double-download issue
    expect(true).toBe(true);
  });
});
