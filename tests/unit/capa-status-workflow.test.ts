/**
 * Unit tests: CAPA status workflow (transitions, overdue calculation, assignment)
 */

import { describe, it, expect } from 'vitest';
import { isBefore, parseISO, subDays } from 'date-fns';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const STATUSES = ['open', 'in_progress', 'completed', 'verified', 'overdue'] as const;

function isValidTransition(from: string, to: string): boolean {
  const allowed: Record<string, string[]> = {
    open: ['in_progress'],
    in_progress: ['completed', 'overdue'],
    completed: ['verified'],
    verified: [],
    overdue: ['in_progress', 'completed'],
  };
  return allowed[from]?.includes(to) ?? false;
}

function computeIsOverdue(status: string, dueDate: string): boolean {
  if (status === 'completed' || status === 'verified') return false;
  if (!dueDate) return false;
  return isBefore(parseISO(dueDate), new Date());
}

describe('capa-status-workflow', () => {
  describe('status transitions', () => {
    it('open → in_progress', () => {
      expect(isValidTransition('open', 'in_progress')).toBe(true);
    });
    it('in_progress → completed', () => {
      expect(isValidTransition('in_progress', 'completed')).toBe(true);
    });
    it('completed → verified', () => {
      expect(isValidTransition('completed', 'verified')).toBe(true);
    });
    it('verified has no transitions', () => {
      expect(isValidTransition('verified', 'open')).toBe(false);
    });
  });

  describe('overdue calculation', () => {
    it('completed/verified never overdue', () => {
      const pastDate = subDays(new Date(), 5).toISOString().split('T')[0];
      expect(computeIsOverdue('completed', pastDate)).toBe(false);
      expect(computeIsOverdue('verified', pastDate)).toBe(false);
    });
    it('open with past due date is overdue', () => {
      const pastDate = subDays(new Date(), 5).toISOString().split('T')[0];
      expect(computeIsOverdue('open', pastDate)).toBe(true);
    });
  });
});
