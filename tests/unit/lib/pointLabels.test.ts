import { describe, it, expect } from 'vitest';
import {
  POINT_SOURCES,
  assertAllSourceLabelsCovered,
  formatActivityLine,
  getActivityBaseLabel,
  groupPointsByBreakdown,
  sumPointsBySource,
  type PointsBySourceRow,
  type PointTransactionRow,
} from '@/lib/pointLabels';

describe('pointLabels', () => {
  it('covers all source/category combos without raw enum leaks', () => {
    expect(() => assertAllSourceLabelsCovered()).not.toThrow();
  });

  it('sumPointsBySource reconciles grouped breakdown to wallet total', () => {
    const rows: PointsBySourceRow[] = [
      { source: 'announcement_claim', category: null, total: 12 },
      { source: 'compliance_form', category: null, total: 25 },
      { source: 'near_miss_report', category: 'base', total: 20 },
      { source: 'near_miss_report', category: 'corrective_bonus', total: 15 },
      { source: 'redemption', category: null, total: -75 },
      { source: 'adjustment', category: null, total: 75 },
    ];
    const wallet = 72;
    expect(sumPointsBySource(rows)).toBe(wallet);

    const buckets = groupPointsByBreakdown(rows);
    const bucketSum = buckets.reduce((s, b) => s + b.total, 0);
    expect(bucketSum).toBe(wallet);
  });

  it('groups near-miss base and corrective into separate buckets', () => {
    const rows: PointsBySourceRow[] = [
      { source: 'near_miss_report', category: 'base', total: 10 },
      { source: 'near_miss_report', category: 'corrective_bonus', total: 15 },
    ];
    const buckets = groupPointsByBreakdown(rows);
    expect(buckets.map((b) => b.key)).toEqual(['near_miss_reports', 'corrective_actions']);
    expect(buckets[0].label).toBe('Near-miss reports');
    expect(buckets[1].label).toBe('Corrective actions');
  });

  it('formats activity lines in plain language for each source type', () => {
    const cases: Array<{ tx: PointTransactionRow; itemName?: string; expected: RegExp }> = [
      {
        tx: { id: '1', amount: 1, source: 'announcement_claim', category: null, reference_id: null, reference_table: null, reason: null, created_at: '' },
        expected: /Safety briefing \+1/,
      },
      {
        tx: { id: '2', amount: 5, source: 'compliance_form', category: null, reference_id: null, reference_table: null, reason: null, created_at: '' },
        expected: /Full daily compliance \+5/,
      },
      {
        tx: { id: '3', amount: 10, source: 'near_miss_report', category: 'base', reference_id: null, reference_table: null, reason: null, created_at: '' },
        expected: /Near-miss filed \+10/,
      },
      {
        tx: { id: '4', amount: 15, source: 'near_miss_report', category: 'corrective_bonus', reference_id: null, reference_table: null, reason: null, created_at: '' },
        expected: /Corrective action verified \+15/,
      },
      {
        tx: { id: '5', amount: 20, source: 'certification', category: 'pass', reference_id: null, reference_table: null, reason: null, created_at: '' },
        expected: /Certification passed \+20/,
      },
      {
        tx: { id: '6', amount: 10, source: 'certification', category: 'early_renewal', reference_id: null, reference_table: null, reason: null, created_at: '' },
        expected: /Certification early renewal \+10/,
      },
      {
        tx: { id: '7', amount: 25, source: 'manual_award', category: null, reference_id: null, reference_table: null, reason: 'Great teamwork', created_at: '' },
        expected: /Points awarded: Great teamwork \+25/,
      },
      {
        tx: { id: '8', amount: -75, source: 'redemption', category: null, reference_id: 'r1', reference_table: 'redemptions', reason: null, created_at: '' },
        itemName: 'ATTS Cap',
        expected: /Redeemed ATTS Cap −75/,
      },
      {
        tx: { id: '9', amount: 75, source: 'adjustment', category: null, reference_id: 'r1', reference_table: 'redemptions', reason: 'denied', created_at: '' },
        itemName: 'ATTS Cap',
        expected: /Refund: ATTS Cap \+75/,
      },
      {
        tx: { id: '10', amount: 10, source: 'streak_bonus', category: null, reference_id: null, reference_table: null, reason: null, created_at: '' },
        expected: /Streak bonus \+10/,
      },
    ];

    for (const { tx, itemName, expected } of cases) {
      const line = formatActivityLine(tx, { itemName });
      expect(line).toMatch(expected);
      for (const source of POINT_SOURCES) {
        expect(line).not.toContain(source);
      }
    }
  });

  it('never exposes raw category strings in activity base labels', () => {
    const label = getActivityBaseLabel({
      source: 'near_miss_report',
      category: 'corrective_bonus',
      amount: 15,
      reason: null,
    });
    expect(label).not.toContain('corrective_bonus');
    expect(label).toContain('Corrective action');
  });
});
