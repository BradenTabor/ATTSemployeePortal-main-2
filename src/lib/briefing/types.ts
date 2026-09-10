/**
 * Daily safety briefing domain types.
 * Kept separate from the page so question scoring, personalization, and
 * copy can be unit-tested without React.
 */

export type BriefingFieldRole = 'employee' | 'foreman' | 'general_foreman' | 'mechanic';
export type BriefingQuestionKind = 'knowledge' | 'checkin';
export type BriefingQuestionCategory = 'tree_safety' | 'personal_health' | 'announcement';
export type FocusSeverity = 'info' | 'watch' | 'urgent';
export type FocusKind = 'cert' | 'hazard' | 'incident' | 'role' | 'weather' | 'crew' | 'standard';

export interface BriefingOption {
  id: string;
  text: string;
}

export interface BriefingQuestion {
  id: string;
  category: BriefingQuestionCategory;
  kind?: BriefingQuestionKind;
  text: string;
  options: BriefingOption[];
  /** Required for knowledge questions. Absent on check-in questions. */
  correctOptionId?: string;
  /** Shown after the worker locks an answer. */
  explanation?: string;
  /** OSHA / ANSI citation shown with the explanation. */
  standardRef?: string;
  /** If set, only these field roles see the question. */
  roles?: BriefingFieldRole[];
  /** Check-in coaching keyed by option id. */
  coaching?: Record<string, string>;
}

export type QuestionPool = Record<BriefingQuestionCategory, BriefingQuestion[]>;

export interface BriefingSections {
  overview?: string;
  topHazards?: { hazard: string; count?: number; note?: string }[];
  ppeReminders?: string[];
  equipmentAlerts?: string[];
  expectations?: string[];
}

export interface BriefingConditions {
  tempF?: number;
  windSpeed?: number;
  conditions?: string;
  note?: string;
}

export interface FocusCard {
  id: string;
  kind: FocusKind;
  severity: FocusSeverity;
  title: string;
  body: string;
  chips?: string[];
}

export interface ScoredAnswer {
  questionId: string;
  selectedOptionId: string;
  category: BriefingQuestionCategory;
  kind: BriefingQuestionKind;
  isCorrect: boolean | null;
}

export interface KnowledgeScore {
  correct: number;
  total: number;
  missed: Array<{
    questionId: string;
    questionText: string;
    selectedText: string;
    correctText: string;
    explanation?: string;
    standardRef?: string;
  }>;
}

export const BRIEFING_STEPS = ['today', 'you', 'check', 'go'] as const;
export type BriefingStepId = (typeof BRIEFING_STEPS)[number];
