/**
 * Daily Safety Briefing config: field roles, question pool, static dropdown content.
 * Knowledge questions carry a correct option + explanation so the briefing
 * teaches, not just collects a tap.
 */

import { getDayOfYear, parseISO } from 'date-fns';
import type { BriefingQuestion, QuestionPool } from '../lib/briefing/types';
import { getTodaysQuestionsFromPool } from '../lib/briefing/buildBriefing';

export const FIELD_ROLES = ['employee', 'foreman', 'general_foreman', 'mechanic'] as const;
export type FieldRole = (typeof FIELD_ROLES)[number];

export function isFieldRole(role: string | null | undefined): role is FieldRole {
  return role != null && (FIELD_ROLES as readonly string[]).includes(role);
}

export type { BriefingQuestion };

export const QUESTION_POOL: QuestionPool = {
  tree_safety: [
    {
      id: 'ts-1',
      category: 'tree_safety',
      kind: 'knowledge',
      text: 'Before starting any cut, what is the most important factor to assess?',
      options: [
        { id: 'ts-1-a', text: 'Lean direction and weight distribution of the tree' },
        { id: 'ts-1-b', text: 'Distance to the nearest road' },
        { id: 'ts-1-c', text: 'Time of day' },
        { id: 'ts-1-d', text: 'Number of crew members present' },
      ],
      correctOptionId: 'ts-1-a',
      explanation:
        'Lean and weight tell you where the tree wants to go. Roads, clocks, and headcount do not change the hinge or the drop zone.',
      standardRef: 'ANSI Z133',
    },
    {
      id: 'ts-2',
      category: 'tree_safety',
      kind: 'knowledge',
      text: 'When working near power lines, what is the minimum approach distance for unqualified personnel?',
      options: [
        { id: 'ts-2-a', text: 'A flat 10 feet for every voltage' },
        { id: 'ts-2-b', text: 'The MAD for that voltage — often 10–20+ feet, never closer' },
        { id: 'ts-2-c', text: 'No minimum if the line looks insulated' },
        { id: 'ts-2-d', text: 'The same distance as a qualified lineworker' },
      ],
      correctOptionId: 'ts-2-b',
      explanation:
        'MAD is voltage-specific. Cover-up is not a license to crowd the line. If you are not qualified, you stay outside the published distance.',
      standardRef: 'OSHA 1910.269 / ANSI Z133',
    },
    {
      id: 'ts-3',
      category: 'tree_safety',
      kind: 'knowledge',
      text: 'What should you do before making the first cut on a tree?',
      options: [
        { id: 'ts-3-a', text: 'Identify escape routes and clear the drop zone' },
        { id: 'ts-3-b', text: 'Check the weather only' },
        { id: 'ts-3-c', text: 'Ensure the chipper is running' },
        { id: 'ts-3-d', text: 'Call the foreman after you start' },
      ],
      correctOptionId: 'ts-3-a',
      explanation:
        'Two escape routes, a cleared drop zone, and a lookout. The chipper can wait. A tree will not.',
      standardRef: 'ANSI Z133',
    },
    {
      id: 'ts-4',
      category: 'tree_safety',
      kind: 'knowledge',
      text: 'Which PPE is required for chainsaw operation per ANSI Z133?',
      options: [
        { id: 'ts-4-a', text: 'Hard hat, eye protection, hearing protection, leg protection, gloves, boots' },
        { id: 'ts-4-b', text: 'Hard hat and gloves only' },
        { id: 'ts-4-c', text: 'Eye protection only when cutting overhead' },
        { id: 'ts-4-d', text: 'Leg protection only when on the ground' },
      ],
      correctOptionId: 'ts-4-a',
      explanation:
        'Chainsaw PPE is a set, not a suggestion. Missing chaps or hearing protection is how routine cuts become recordable injuries.',
      standardRef: 'ANSI Z133',
    },
    {
      id: 'ts-5',
      category: 'tree_safety',
      kind: 'knowledge',
      text: 'When climbing, how many points of contact should you keep?',
      options: [
        { id: 'ts-5-a', text: 'Three points of contact, and a secured tie-in before you advance' },
        { id: 'ts-5-b', text: 'Two points if you are moving quickly' },
        { id: 'ts-5-c', text: 'One hand is enough if the spikes are set' },
        { id: 'ts-5-d', text: 'None required below 12 feet' },
      ],
      correctOptionId: 'ts-5-a',
      explanation:
        'Three points of contact and a tied-in system before you move. Spikes are not a fall-protection system.',
      standardRef: 'ANSI Z133',
    },
    {
      id: 'ts-6',
      category: 'tree_safety',
      kind: 'knowledge',
      text: 'What is the rule at the chipper feed?',
      options: [
        { id: 'ts-6-a', text: 'Never reach into the feed. Use a push stick. Keep hands and loose clothing clear.' },
        { id: 'ts-6-b', text: 'Reach in only to pull a short piece free' },
        { id: 'ts-6-c', text: 'Gloves make it safe to push material by hand' },
        { id: 'ts-6-d', text: 'Stand on the infeed tray for leverage' },
      ],
      correctOptionId: 'ts-6-a',
      explanation:
        'Chipper infeed is a kill zone. If it grabs, you do not win the tug-of-war. Push stick, clear hands, emergency stop known by everyone.',
      standardRef: 'ANSI Z133 / manufacturer manual',
    },
    {
      id: 'ts-7',
      category: 'tree_safety',
      kind: 'knowledge',
      text: 'Who is allowed inside the minimum approach distance of an energized line?',
      options: [
        { id: 'ts-7-a', text: 'Only qualified personnel using the required controls' },
        { id: 'ts-7-b', text: 'Anyone wearing a hard hat' },
        { id: 'ts-7-c', text: 'Groundsmen if the foreman says it is fine' },
        { id: 'ts-7-d', text: 'New hires, so they can learn' },
      ],
      correctOptionId: 'ts-7-a',
      explanation:
        'Qualification is not a vibe. If you are not qualified for that voltage, you stay out. Period.',
      standardRef: 'OSHA 1910.269',
    },
    {
      id: 'ts-8',
      category: 'tree_safety',
      kind: 'knowledge',
      roles: ['mechanic'],
      text: 'What must be true before a truck or chipper leaves the yard?',
      options: [
        { id: 'ts-8-a', text: 'A real walk-around: tires, lights, brakes, hydraulics, secure loads' },
        { id: 'ts-8-b', text: 'The previous driver said it was fine yesterday' },
        { id: 'ts-8-c', text: 'Fuel is full — that covers the rest' },
        { id: 'ts-8-d', text: 'DVIR can be finished at the first stop' },
      ],
      correctOptionId: 'ts-8-a',
      explanation:
        'Pre-trip is how defects get found on pavement, not on a two-lane with a loaded chip box. Finish the walk-around before the wheels roll.',
      standardRef: '49 CFR 396 / DVIR',
    },
    {
      id: 'ts-9',
      category: 'tree_safety',
      kind: 'knowledge',
      roles: ['foreman', 'general_foreman'],
      text: 'When can a crew start the first cut?',
      options: [
        { id: 'ts-9-a', text: 'After every person can name the drop zone, lookout, and escape routes' },
        { id: 'ts-9-b', text: 'As soon as the saw is fueled' },
        { id: 'ts-9-c', text: 'When the first person is ready' },
        { id: 'ts-9-d', text: 'After the chipper is running, even if the plan was not said out loud' },
      ],
      correctOptionId: 'ts-9-a',
      explanation:
        'A tailboard that only lives in your head is not a tailboard. Make people say the plan back.',
      standardRef: 'ANSI Z133 job briefing',
    },
    {
      id: 'ts-10',
      category: 'tree_safety',
      kind: 'knowledge',
      text: 'What do you do if you see a hung-up limb or a tree that did not fall clean?',
      options: [
        { id: 'ts-10-a', text: 'Stop, keep people out, and make a new plan before anyone walks under it' },
        { id: 'ts-10-b', text: 'Shake the tree until it comes down' },
        { id: 'ts-10-c', text: 'Send the newest person in to pull it' },
        { id: 'ts-10-d', text: 'Keep cutting from the same spot — it will go' },
      ],
      correctOptionId: 'ts-10-a',
      explanation:
        'A hung-up tree is stored energy. Nobody walks under it. Reset the work, then cut.',
      standardRef: 'ANSI Z133',
    },
    {
      id: 'ts-11',
      category: 'tree_safety',
      kind: 'knowledge',
      text: 'When should rigging and climbing gear be inspected?',
      options: [
        { id: 'ts-11-a', text: 'Before each use, and pulled from service if it is damaged or worn' },
        { id: 'ts-11-b', text: 'Once a year during the safety meeting' },
        { id: 'ts-11-c', text: 'Only after a near-miss' },
        { id: 'ts-11-d', text: 'If it held yesterday it will hold today' },
      ],
      correctOptionId: 'ts-11-a',
      explanation:
        'Frayed rope and cracked hardware fail without a warning shot. Inspect before you trust your weight to it.',
      standardRef: 'ANSI Z133',
    },
    {
      id: 'ts-12',
      category: 'tree_safety',
      kind: 'knowledge',
      text: 'A lookout’s job is to…',
      options: [
        { id: 'ts-12-a', text: 'Watch the drop zone, stop traffic or crew, and halt the cut if someone enters' },
        { id: 'ts-12-b', text: 'Hold tools until the cutter needs them' },
        { id: 'ts-12-c', text: 'Stay on their phone unless the saw is running' },
        { id: 'ts-12-d', text: 'Only watch the street, not the crew' },
      ],
      correctOptionId: 'ts-12-a',
      explanation:
        'A lookout who is not looking is just another body in the zone. Their voice is the last control before impact.',
      standardRef: 'ANSI Z133',
    },
  ],
  personal_health: [
    {
      id: 'ph-1',
      category: 'personal_health',
      kind: 'checkin',
      text: 'How well-rested do you feel starting your shift today?',
      options: [
        { id: 'ph-1-a', text: 'Well-rested (7+ hours of sleep)' },
        { id: 'ph-1-b', text: 'Adequate (5–7 hours)' },
        { id: 'ph-1-c', text: 'Tired (under 5 hours)' },
        { id: 'ph-1-d', text: 'Prefer not to say' },
      ],
      coaching: {
        'ph-1-a': 'Good. Protect that through the last hour — fatigue hits after lunch, not at tailboard.',
        'ph-1-b': 'You are on the edge. Ask for the cleaner work and say something if your reaction time slips.',
        'ph-1-c': 'Fatigue is a leading factor in struck-by and chainsaw incidents. Tell your foreman before the first cut. Ask for a ground assignment if you need one.',
        'ph-1-d': 'Understood. Watch your crew anyway — tired people do not always self-report.',
      },
    },
    {
      id: 'ph-2',
      category: 'personal_health',
      kind: 'checkin',
      text: 'Are you staying hydrated today?',
      options: [
        { id: 'ph-2-a', text: 'Yes — water is with me and I will drink on a schedule' },
        { id: 'ph-2-b', text: 'I have water but I forget when we get busy' },
        { id: 'ph-2-c', text: 'I still need to grab or refill water' },
        { id: 'ph-2-d', text: 'Prefer not to say' },
      ],
      coaching: {
        'ph-2-a': 'Keep the bottle where you have to see it. Heat illness starts before you feel thirsty.',
        'ph-2-b': 'Set a rule: drink every time you fuel the saw or walk back to the truck.',
        'ph-2-c': 'Stop and get water before you leave the yard. Do not start a cut dry.',
        'ph-2-d': 'Fair. Still put water on the truck — your future self will need it.',
      },
    },
    {
      id: 'ph-3',
      category: 'personal_health',
      kind: 'checkin',
      text: 'Do you have any physical limitations today that could affect your safety?',
      options: [
        { id: 'ph-3-a', text: 'No — I am good to go' },
        { id: 'ph-3-b', text: 'Minor (stiff back, sore shoulder). I will pace myself.' },
        { id: 'ph-3-c', text: 'Yes. I will talk to my supervisor before we start.' },
        { id: 'ph-3-d', text: 'Prefer not to say' },
      ],
      coaching: {
        'ph-3-a': 'Stay honest with yourself as the day goes on. Pride is not PPE.',
        'ph-3-b': 'Tell the person next to you so they are not surprised if you skip a lift.',
        'ph-3-c': 'Good call. We would rather reassign work than treat an injury.',
        'ph-3-d': 'If it changes mid-day, speak up then. Nobody here is paid to guess.',
      },
    },
    {
      id: 'ph-4',
      category: 'personal_health',
      kind: 'checkin',
      text: 'Did you get at least 7 hours of sleep last night?',
      options: [
        { id: 'ph-4-a', text: 'Yes' },
        { id: 'ph-4-b', text: 'Between 5 and 7 hours' },
        { id: 'ph-4-c', text: 'Less than 5 hours' },
        { id: 'ph-4-d', text: 'Prefer not to say' },
      ],
      coaching: {
        'ph-4-a': 'Use it. The dangerous hour is usually the last one, not the first.',
        'ph-4-b': 'You will feel this on a saw or a steering wheel. Double-check your setup.',
        'ph-4-c': 'That is impairment. Tell your foreman. This is not a toughness contest.',
        'ph-4-d': 'Keep an extra eye on the person beside you. Sleep debt is contagious in a crew.',
      },
    },
    {
      id: 'ph-5',
      category: 'personal_health',
      kind: 'checkin',
      text: 'If you felt heat-sick, dizzy, or unsafe mid-job, what would you do?',
      options: [
        { id: 'ph-5-a', text: 'Stop, tell my crew, and get shade / water / help' },
        { id: 'ph-5-b', text: 'Push through until the next break' },
        { id: 'ph-5-c', text: 'I am not sure I would say anything' },
        { id: 'ph-5-d', text: 'Prefer not to say' },
      ],
      coaching: {
        'ph-5-a': 'That is the standard. Stopping early is how people go home.',
        'ph-5-b': 'Pushing through is how heat stroke looks in the first fifteen minutes. Stop sooner.',
        'ph-5-c': 'Practice the sentence now: “I need a minute.” Your crew would rather hear it.',
        'ph-5-d': 'Decide the phrase before you need it. Waiting until you are sick is too late.',
      },
    },
  ],
  announcement: [
    {
      id: 'ann-1',
      category: 'announcement',
      kind: 'knowledge',
      text: 'After a safety message, what actually changes your risk today?',
      options: [
        { id: 'ann-1-a', text: 'Naming one hazard out loud and putting a control on it before you cut' },
        { id: 'ann-1-b', text: 'Remembering the message exists' },
        { id: 'ann-1-c', text: 'Tapping through so you can get to the dashboard' },
        { id: 'ann-1-d', text: 'Waiting for the foreman to repeat it later' },
      ],
      correctOptionId: 'ann-1-a',
      explanation:
        'A briefing that does not change a setup is just reading. Pick one thing and make it visible on the site.',
      standardRef: 'ANSI Z133 job briefing',
    },
    {
      id: 'ann-2',
      category: 'announcement',
      kind: 'knowledge',
      text: 'What should you do with today’s safety message once you are on site?',
      options: [
        { id: 'ann-2-a', text: 'Apply the main hazard, PPE, and lookout points — not just one of them' },
        { id: 'ann-2-b', text: 'Keep it to yourself so you do not slow the crew' },
        { id: 'ann-2-c', text: 'Ignore weather notes if the sun is out' },
        { id: 'ann-2-d', text: 'Only worry about PPE if an inspector is coming' },
      ],
      correctOptionId: 'ann-2-a',
      explanation:
        'The message is a set: condition, PPE, communication. Dropping two of the three is how “we talked about it” still ends in an incident.',
      standardRef: 'ATTS daily briefing',
    },
    {
      id: 'ann-3',
      category: 'announcement',
      kind: 'knowledge',
      text: 'Who is responsible for stopping work if a control is missing?',
      options: [
        { id: 'ann-3-a', text: 'Anyone on the crew — including you' },
        { id: 'ann-3-b', text: 'Only the general foreman' },
        { id: 'ann-3-c', text: 'Only safety after an incident' },
        { id: 'ann-3-d', text: 'The newest person, so they learn' },
      ],
      correctOptionId: 'ann-3-a',
      explanation:
        'Stop-work authority is not a title. If the drop zone is open or MAD is blown, you call it.',
      standardRef: 'ATTS safety policy / OSHA general duty',
    },
    {
      id: 'ann-4',
      category: 'announcement',
      kind: 'knowledge',
      text: 'You have read today’s message. What is the minimum you owe your crew?',
      options: [
        { id: 'ann-4-a', text: 'Share the key point and watch for it on the site' },
        { id: 'ann-4-b', text: 'Keep it in the app and move on' },
        { id: 'ann-4-c', text: 'Assume someone else already briefed them' },
        { id: 'ann-4-d', text: 'Wait until after the first cut' },
      ],
      correctOptionId: 'ann-4-a',
      explanation:
        'If the message never leaves your phone, the person on the saw never got a briefing.',
      standardRef: 'ANSI Z133 job briefing',
    },
  ],
};

/**
 * Deterministic daily pick so the whole company shares the same knowledge
 * check. Role filters apply on top. A live announcement question is injected
 * by getTodaysQuestionsFromPool when field data exists.
 */
export function getTodaysQuestions(
  dateString: string,
  pool: QuestionPool = QUESTION_POOL,
  role?: string | null,
): BriefingQuestion[] {
  return getTodaysQuestionsFromPool(dateString, pool, role);
}

/** Tree-service standard safety (reference plate). */
export const TREE_SERVICE_STANDARD = {
  title: 'Tree Service Safety Standards',
  body: `ANSI Z133 and OSHA 29 CFR 1910.266 apply to arboricultural operations. Key points:
• Maintain minimum approach distances near electrical conductors.
• Use appropriate PPE: hard hat, eye and hearing protection, leg protection, gloves, and footwear.
• Pre-job hazard assessment and escape routes before making the first cut.
• Only qualified personnel may work within minimum approach distance of energized lines.
• Inspect equipment and rigging before use. Communicate with your crew and lookouts.`,
};

/** Fallback when personalized data is empty. */
export const PERSONALIZED_FALLBACK = {
  title: 'Your Daily Safety Check',
  body: 'Are you staying hydrated? Did you get at least 7 hours of sleep? Take a moment to check in with yourself before starting work.',
};

export const ANNOUNCEMENT_DETAIL_FALLBACK_TITLE = "Today's key points";
export const ANNOUNCEMENT_DETAIL_FALLBACK_BODY =
  'Review the main safety message. Focus on PPE, equipment checks, and the conditions called out for today.';

export const SAFETY_TIPS: string[] = [
  'Before the first cut, identify escape routes and clear the drop zone.',
  'Maintain minimum approach distance near energized lines — only qualified personnel inside MAD.',
  'Hard hat, eye and hearing protection, leg protection, gloves, and boots are required for chainsaw work per ANSI Z133.',
  'Inspect rigging and equipment before use; communicate with your crew and lookouts.',
  'Stay hydrated and take breaks in the heat; watch for signs of heat stress in yourself and others.',
  'Three points of contact when climbing; secure your tie-in before advancing.',
  'Pre-trip inspection: tires, lights, brakes, and secure loads before driving.',
  'If you see something that could hurt someone, say something — everyone is responsible for safety.',
  'Cold weather: dress in layers and keep extremities warm; watch for ice on surfaces.',
  'Chipper: never reach into the feed area; use a push stick and keep hands clear.',
  'Know where your first-aid kit and eyewash are on every job site.',
  'Report near-misses so we can prevent real incidents. No blame.',
];

export function getTodaysTip(dateString: string): string {
  const day = getDayOfYear(parseISO(dateString));
  return SAFETY_TIPS[day % SAFETY_TIPS.length] ?? SAFETY_TIPS[0]!;
}
