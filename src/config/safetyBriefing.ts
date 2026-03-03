/**
 * Daily Safety Briefing config: field roles, question pool, static dropdown content.
 * Option B: predefined questions only (no daily_safety_questions table in v1).
 */

import { getDayOfYear, parseISO } from 'date-fns';

export const FIELD_ROLES = ['employee', 'foreman', 'general_foreman', 'mechanic'] as const;
export type FieldRole = (typeof FIELD_ROLES)[number];

export function isFieldRole(role: string | null | undefined): role is FieldRole {
  return role != null && (FIELD_ROLES as readonly string[]).includes(role);
}

export interface BriefingQuestion {
  id: string;
  category: 'tree_safety' | 'personal_health' | 'announcement';
  text: string;
  options: { id: string; text: string }[];
}

export const QUESTION_POOL: Record<BriefingQuestion['category'], BriefingQuestion[]> = {
  tree_safety: [
    {
      id: 'ts-1',
      category: 'tree_safety',
      text: 'Before starting any cut, what is the most important factor to assess?',
      options: [
        { id: 'ts-1-a', text: 'Lean direction and weight distribution of the tree' },
        { id: 'ts-1-b', text: 'Distance to the nearest road' },
        { id: 'ts-1-c', text: 'Time of day' },
        { id: 'ts-1-d', text: 'Number of crew members present' },
      ],
    },
    {
      id: 'ts-2',
      category: 'tree_safety',
      text: 'When working near power lines, what is the minimum approach distance for unqualified personnel?',
      options: [
        { id: 'ts-2-a', text: '10 feet' },
        { id: 'ts-2-b', text: 'Minimum approach distance per voltage (e.g. 10–20+ ft)' },
        { id: 'ts-2-c', text: 'No minimum if the line is insulated' },
        { id: 'ts-2-d', text: 'Same as for qualified personnel' },
      ],
    },
    {
      id: 'ts-3',
      category: 'tree_safety',
      text: 'What should you do before making the first cut on a tree?',
      options: [
        { id: 'ts-3-a', text: 'Identify escape routes and clear the drop zone' },
        { id: 'ts-3-b', text: 'Check the weather only' },
        { id: 'ts-3-c', text: 'Ensure the chipper is running' },
        { id: 'ts-3-d', text: 'Call the foreman' },
      ],
    },
    {
      id: 'ts-4',
      category: 'tree_safety',
      text: 'Which PPE is required for chainsaw operation per ANSI Z133?',
      options: [
        { id: 'ts-4-a', text: 'Hard hat, eye protection, hearing protection, leg protection, gloves, boots' },
        { id: 'ts-4-b', text: 'Hard hat and gloves only' },
        { id: 'ts-4-c', text: 'Eye protection only when cutting overhead' },
        { id: 'ts-4-d', text: 'Leg protection only when on the ground' },
      ],
    },
  ],
  personal_health: [
    {
      id: 'ph-1',
      category: 'personal_health',
      text: 'How well-rested do you feel starting your shift today?',
      options: [
        { id: 'ph-1-a', text: 'Well-rested (7+ hours of sleep)' },
        { id: 'ph-1-b', text: 'Adequate (5–7 hours)' },
        { id: 'ph-1-c', text: 'Tired (under 5 hours)' },
        { id: 'ph-1-d', text: 'Prefer not to say' },
      ],
    },
    {
      id: 'ph-2',
      category: 'personal_health',
      text: 'Are you staying hydrated today?',
      options: [
        { id: 'ph-2-a', text: 'Yes, I have water and will drink regularly' },
        { id: 'ph-2-b', text: 'I have water but sometimes forget' },
        { id: 'ph-2-c', text: 'I need to refill / get water' },
        { id: 'ph-2-d', text: 'Prefer not to say' },
      ],
    },
    {
      id: 'ph-3',
      category: 'personal_health',
      text: 'Do you have any physical limitations today that could affect your safety?',
      options: [
        { id: 'ph-3-a', text: 'No, I am good to go' },
        { id: 'ph-3-b', text: 'Minor (e.g. stiff back); I will pace myself' },
        { id: 'ph-3-c', text: 'Yes; I will discuss with my supervisor' },
        { id: 'ph-3-d', text: 'Prefer not to say' },
      ],
    },
    {
      id: 'ph-4',
      category: 'personal_health',
      text: 'Did you get at least 7 hours of sleep last night?',
      options: [
        { id: 'ph-4-a', text: 'Yes' },
        { id: 'ph-4-b', text: 'Between 5 and 7 hours' },
        { id: 'ph-4-c', text: 'Less than 5 hours' },
        { id: 'ph-4-d', text: 'Prefer not to say' },
      ],
    },
  ],
  announcement: [
    {
      id: 'ann-1',
      category: 'announcement',
      text: "After reading today's safety announcement, which area will you pay extra attention to?",
      options: [
        { id: 'ann-1-a', text: 'PPE compliance' },
        { id: 'ann-1-b', text: 'Equipment pre-trip inspection' },
        { id: 'ann-1-c', text: 'Weather-related hazards' },
        { id: 'ann-1-d', text: 'Communication with my crew' },
        { id: 'ann-1-e', text: 'All of the above' },
      ],
    },
    {
      id: 'ann-2',
      category: 'announcement',
      text: "What from today's safety message will you apply on the job today?",
      options: [
        { id: 'ann-2-a', text: 'The main hazard or condition mentioned' },
        { id: 'ann-2-b', text: 'PPE and pre-trip reminders' },
        { id: 'ann-2-c', text: 'Crew communication and lookout' },
        { id: 'ann-2-d', text: 'All of the above' },
      ],
    },
    {
      id: 'ann-3',
      category: 'announcement',
      text: "Today's announcement reminded us to:",
      options: [
        { id: 'ann-3-a', text: 'Stay alert and watch out for each other' },
        { id: 'ann-3-b', text: 'Complete inspections before starting' },
        { id: 'ann-3-c', text: 'Dress for the conditions and wear required PPE' },
        { id: 'ann-3-d', text: 'Any of the above (message may vary by day)' },
      ],
    },
    {
      id: 'ann-4',
      category: 'announcement',
      text: 'I have read and understood today\'s safety announcement.',
      options: [
        { id: 'ann-4-a', text: 'Yes' },
        { id: 'ann-4-b', text: 'Yes, and I will share key points with my crew' },
        { id: 'ann-4-c', text: 'I need to re-read it' },
        { id: 'ann-4-d', text: 'Prefer not to say' },
      ],
    },
  ],
};

/**
 * Deterministic selection by day-of-year so all users see the same questions.
 * Uses date-fns getDayOfYear (project dependency).
 */
export function getTodaysQuestions(dateString: string): BriefingQuestion[] {
  const day = getDayOfYear(parseISO(dateString));
  return (['tree_safety', 'personal_health', 'announcement'] as const).map((cat) => {
    const pool = QUESTION_POOL[cat];
    return pool[day % pool.length];
  });
}

// --- Static dropdown content ---

/** Tree-service standard safety (dropdown 1). */
export const TREE_SERVICE_STANDARD = {
  title: 'Tree Service Safety Standards',
  body: `ANSI Z133 and OSHA 29 CFR 1910.266 apply to arboricultural operations. Key points:
• Maintain minimum approach distances near electrical conductors.
• Use appropriate PPE: hard hat, eye and hearing protection, leg protection, gloves, and footwear.
• Pre-job hazard assessment and escape routes before making the first cut.
• Only qualified personnel may work within minimum approach distance of energized lines.
• Inspect equipment and rigging before use. Communicate with your crew and lookouts.`,
};

/** Fallback when personalized data is empty (dropdown 2). */
export const PERSONALIZED_FALLBACK = {
  title: 'Your Daily Safety Check',
  body: 'Are you staying hydrated? Did you get at least 7 hours of sleep? Take a moment to check in with yourself before starting work.',
};

/** Fallback for announcement detail when raw_data has no sections (dropdown 3). */
export const ANNOUNCEMENT_DETAIL_FALLBACK_TITLE = "Today's key points";
export const ANNOUNCEMENT_DETAIL_FALLBACK_BODY = 'Review the main safety message above. Focus on PPE, equipment checks, and conditions mentioned for today.';
