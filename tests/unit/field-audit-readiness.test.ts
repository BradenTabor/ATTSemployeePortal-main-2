/**
 * Field Safety Audit — submit readiness rules.
 *
 * These rules gate the Review & Submit panel and are mirrored (blocker subset)
 * by the `submit_field_audit` RPC. They are pure, so we pin them here.
 */

import { describe, it, expect } from 'vitest';
import {
  computeFieldAuditReadiness,
  listCustomItems,
  readinessCodeFromServerHint,
} from '../../src/pages/safety-officer/fieldAuditReadiness';
import type {
  AuditChecklistItem,
  FieldAuditItem,
  FieldAuditSubject,
} from '../../src/pages/safety-officer/fieldAuditConstants';

const AUDIT = 'audit-1';

function cfg(
  id: string,
  scope: AuditChecklistItem['subject_scope'],
  overrides: Partial<AuditChecklistItem> = {},
): AuditChecklistItem {
  return {
    id,
    section_key: 'ppe',
    item_key: id,
    label: `Item ${id}`,
    standard_ref: null,
    subject_scope: scope,
    equipment_types: null,
    sort_order: 0,
    requires_photo_on_fail: false,
    ...overrides,
  };
}

function person(id: string): FieldAuditSubject {
  return {
    id,
    field_audit_id: AUDIT,
    subject_type: 'person',
    person_id: `au-${id}`,
    equipment_type: null,
    equipment_number: null,
    is_custom_equipment: false,
    created_at: '2026-09-02T00:00:00Z',
  };
}

function saw(id: string): FieldAuditSubject {
  return {
    id,
    field_audit_id: AUDIT,
    subject_type: 'equipment',
    person_id: null,
    equipment_type: 'chainsaw',
    equipment_number: 'SAW-1',
    is_custom_equipment: false,
    created_at: '2026-09-02T00:00:00Z',
  };
}

function item(
  id: string,
  subjectId: string | null,
  checklistItemId: string | null,
  result: FieldAuditItem['result'],
  overrides: Partial<FieldAuditItem> = {},
): FieldAuditItem {
  return {
    id,
    field_audit_id: AUDIT,
    field_audit_subject_id: subjectId,
    checklist_item_id: checklistItemId,
    custom_label: checklistItemId ? null : `Custom ${id}`,
    result,
    note: null,
    photo_path: null,
    corrective_action_id: null,
    ...overrides,
  };
}

const CONFIG: AuditChecklistItem[] = [
  cfg('p1', 'person'),
  cfg('p2', 'person'),
  cfg('e1', 'equipment'), // all equipment
  cfg('e2', 'equipment', { equipment_types: ['chainsaw'], requires_photo_on_fail: true }),
  cfg('e3', 'equipment', { equipment_types: ['chipper'] }), // not applicable to a saw
  cfg('s1', 'site'),
  cfg('s2', 'site'),
];

describe('computeFieldAuditReadiness', () => {
  it('blocks an audit with nothing recorded', () => {
    const r = computeFieldAuditReadiness({ subjects: [person('a')], items: [], configItems: CONFIG });
    expect(r.canSubmit).toBe(false);
    expect(r.grade).toBe('empty');
    expect(r.blockers.map((b) => b.code)).toEqual(['no_checks']);
    // The untouched subject is still surfaced as a warning.
    expect(r.warnings.map((w) => w.code)).toContain('subject_untouched');
    expect(r.passRate).toBeNull();
  });

  it('blocks a Fail without a note and names the subject', () => {
    const names = new Map([['a', 'Chad']]);
    const r = computeFieldAuditReadiness({
      subjects: [person('a')],
      items: [
        item('i1', 'a', 'p1', 'pass'),
        item('i2', 'a', 'p2', 'fail', { note: '   ' }),
      ],
      configItems: CONFIG,
      subjectNames: names,
    });
    expect(r.canSubmit).toBe(false);
    expect(r.blockers).toHaveLength(1);
    expect(r.blockers[0].code).toBe('fail_note_missing');
    expect(r.blockers[0].subjectId).toBe('a');
    expect(r.blockers[0].message).toContain('Chad');
    expect(r.blockers[0].message).toContain('1 Fail needs');
  });

  it('attributes a site-scoped Fail without a note to "Site conditions"', () => {
    const r = computeFieldAuditReadiness({
      subjects: [],
      items: [item('i1', null, 's1', 'fail')],
      configItems: CONFIG,
    });
    expect(r.blockers[0].message).toMatch(/^Site conditions/);
    expect(r.blockers[0].subjectId).toBeNull();
  });

  it('is clean when every applicable check passes', () => {
    const r = computeFieldAuditReadiness({
      subjects: [saw('s')],
      items: [
        item('i1', 's', 'e1', 'pass'),
        item('i2', 's', 'e2', 'na'),
      ],
      configItems: CONFIG,
    });
    // e3 is chipper-only, so the saw is complete with e1 + e2.
    expect(r.canSubmit).toBe(true);
    expect(r.blockers).toEqual([]);
    expect(r.warnings).toEqual([]);
    expect(r.grade).toBe('clean');
    expect(r.counts.equipment).toBe(1);
    expect(r.counts.subjectsStarted).toBe(1);
    expect(r.passRate).toBe(1);
  });

  it('warns (never blocks) on unanswered seeded items', () => {
    const r = computeFieldAuditReadiness({
      subjects: [person('a')],
      items: [item('i1', 'a', 'p1', 'pass')],
      configItems: CONFIG,
    });
    expect(r.canSubmit).toBe(true);
    expect(r.grade).toBe('incomplete');
    const w = r.warnings.find((x) => x.code === 'subject_incomplete');
    expect(w?.count).toBe(1);
    expect(w?.message).toContain('1 check left');
  });

  it('warns on a required photo missing from a Fail', () => {
    const r = computeFieldAuditReadiness({
      subjects: [saw('s')],
      items: [
        item('i1', 's', 'e1', 'pass'),
        item('i2', 's', 'e2', 'fail', { note: 'Chain brake slow' }),
      ],
      configItems: CONFIG,
    });
    expect(r.canSubmit).toBe(true);
    expect(r.warnings.map((w) => w.code)).toContain('fail_photo_missing');
    // ...and clears once the photo lands.
    const fixed = computeFieldAuditReadiness({
      subjects: [saw('s')],
      items: [
        item('i1', 's', 'e1', 'pass'),
        item('i2', 's', 'e2', 'fail', { note: 'Chain brake slow', photo_path: 'a/b.jpg' }),
      ],
      configItems: CONFIG,
    });
    expect(fixed.warnings.map((w) => w.code)).not.toContain('fail_photo_missing');
    expect(fixed.counts.failWithPhoto).toBe(1);
  });

  it('flags unescalated fails as open findings and grades "findings" when otherwise complete', () => {
    const r = computeFieldAuditReadiness({
      subjects: [saw('s')],
      items: [
        item('i1', 's', 'e1', 'fail', { note: 'No chocks', corrective_action_id: null }),
        item('i2', 's', 'e2', 'pass'),
      ],
      configItems: CONFIG,
    });
    expect(r.canSubmit).toBe(true);
    expect(r.grade).toBe('findings');
    expect(r.warnings.map((w) => w.code)).toEqual(['open_findings']);
    expect(r.counts.openFail).toBe(1);
    expect(r.passRate).toBe(0.5);

    const escalated = computeFieldAuditReadiness({
      subjects: [saw('s')],
      items: [
        item('i1', 's', 'e1', 'fail', { note: 'No chocks', corrective_action_id: 'ca-1' }),
        item('i2', 's', 'e2', 'pass'),
      ],
      configItems: CONFIG,
    });
    expect(escalated.warnings).toEqual([]);
    expect(escalated.grade).toBe('findings');
  });

  it('tracks site checks: incomplete only once started, complete when all answered', () => {
    const started = computeFieldAuditReadiness({
      subjects: [],
      items: [item('i1', null, 's1', 'pass')],
      configItems: CONFIG,
    });
    expect(started.warnings.map((w) => w.code)).toEqual(['site_incomplete']);
    expect(started.counts.siteAnswered).toBe(1);
    expect(started.counts.siteTotal).toBe(2);

    const untouched = computeFieldAuditReadiness({
      subjects: [saw('s')],
      items: [item('i1', 's', 'e1', 'pass'), item('i2', 's', 'e2', 'pass')],
      configItems: CONFIG,
    });
    // Site checks never started → no nag (site checks are optional per visit).
    expect(untouched.warnings.map((w) => w.code)).not.toContain('site_incomplete');

    const done = computeFieldAuditReadiness({
      subjects: [],
      items: [item('i1', null, 's1', 'pass'), item('i2', null, 's2', 'na')],
      configItems: CONFIG,
    });
    expect(done.warnings).toEqual([]);
    expect(done.grade).toBe('clean');
  });

  it('counts custom (ad-hoc) items and does not treat them as unanswered seeded items', () => {
    const r = computeFieldAuditReadiness({
      subjects: [saw('s')],
      items: [
        item('i1', 's', 'e1', 'pass'),
        item('i2', 's', 'e2', 'pass'),
        item('i3', 's', null, 'fail', { note: 'Loose guard', custom_label: 'Guard bolt' }),
      ],
      configItems: CONFIG,
    });
    expect(r.counts.custom).toBe(1);
    expect(r.warnings.map((w) => w.code)).toEqual(['open_findings']);
  });
});

describe('listCustomItems', () => {
  it('returns trimmed, alphabetised ad-hoc items only', () => {
    const out = listCustomItems([
      item('i1', 's', 'e1', 'pass'),
      item('i3', 's', null, 'fail', { custom_label: '  Guard bolt ' }),
      item('i4', null, null, 'pass', { custom_label: 'Access road' }),
      item('i5', null, null, 'na', { custom_label: '   ' }),
    ]);
    expect(out).toEqual([
      { id: 'i4', label: 'Access road', result: 'pass', subjectId: null },
      { id: 'i3', label: 'Guard bolt', result: 'fail', subjectId: 's' },
      { id: 'i5', label: 'Untitled item', result: 'na', subjectId: null },
    ]);
  });
});

describe('readinessCodeFromServerHint', () => {
  it('maps the RPC HINT codes back to readiness codes', () => {
    expect(readinessCodeFromServerHint('FIELD_AUDIT_EMPTY')).toBe('no_checks');
    expect(readinessCodeFromServerHint('FIELD_AUDIT_FAIL_NOTE_MISSING')).toBe('fail_note_missing');
    expect(readinessCodeFromServerHint('FIELD_AUDIT_FORBIDDEN')).toBeNull();
    expect(readinessCodeFromServerHint(undefined)).toBeNull();
  });
});
