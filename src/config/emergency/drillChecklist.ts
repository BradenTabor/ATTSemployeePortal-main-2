// src/config/emergency/drillChecklist.ts
// ============================================================
// Tabletop drill scenarios for testing the EAP page
// Run quarterly per OSHA best practice
// Hand the phone to a worker and say: "[scenario]". Observe and time.
// ============================================================

export interface DrillScenario {
  id: string;
  scenario: string;
  expectedPath: string[];
  keyActions: string[];
  timeTarget: string;
  facilitatorNotes: string;
}

export const DRILL_SCENARIOS: DrillScenario[] = [
  {
    id: 'DRILL-001',
    scenario:
      'A coworker just fell from scaffolding on Building A, 2nd floor. They are on the ground and not moving. What do you do?',
    expectedPath: ['medical'],
    keyActions: [
      'User opens EAP page (or is already on it)',
      'User taps Call 911 or selects Medical → Call 911',
      'User can state the site address when asked "Where are you?"',
      'User can locate the nearest AED (Building A, 2nd floor break room)',
      'User knows to send someone to the gate for the ambulance',
      'User contacts Site Super after 911',
    ],
    timeTarget: '< 30 seconds from page load to 911 call initiated',
    facilitatorNotes:
      'Watch whether the user hesitates at the triage screen. If they bypass triage and hit the universal "Call 911 NOW" button, that is also acceptable — the panic path exists for this reason.',
  },
  {
    id: 'DRILL-002',
    scenario:
      'You are working near the south lot and you smell gas. No one appears injured, but the smell is strong. What do you do?',
    expectedPath: ['utility'],
    keyActions: [
      'User selects Utility emergency',
      'User sees the warning to move 300+ feet before using phone',
      'User can find the gas company emergency phone number',
      'User notifies Site Super',
      'User does NOT attempt to locate or fix the leak',
    ],
    timeTarget: '< 20 seconds to finding utility contact number',
    facilitatorNotes:
      'Key test: does the user try to look for the leak or call the gas company first? The EAP should make clear: evacuate first, call from a safe distance.',
  },
  {
    id: 'DRILL-003',
    scenario:
      'The fire alarm just went off. You are in Building C basement. What do you do?',
    expectedPath: ['fire'],
    keyActions: [
      'User selects Fire emergency',
      'User sees evacuation instructions (do not use elevators)',
      'User knows which exit to use from Building C basement',
      'User knows the muster point (Main Parking Lot — Flag Pole)',
      'User can find the Accountability Officer contact (Sarah Chen)',
    ],
    timeTarget: '< 15 seconds to evacuation instructions showing',
    facilitatorNotes:
      'Test whether evacuation routes by zone/floor are clear. If the user cannot immediately tell which exit to use from their specific location, the evacuation routes section needs improvement.',
  },
  {
    id: 'DRILL-004',
    scenario:
      'Something is wrong — people are running and shouting. You do not know what is happening. What do you do?',
    expectedPath: ['unknown/panic'],
    keyActions: [
      'User finds "Call 911 NOW" without needing to select a category',
      'User can state the site address for dispatch',
      'User can reach Site Super contact in 2 taps or fewer',
    ],
    timeTarget: '< 10 seconds from page load to 911 call initiated',
    facilitatorNotes:
      "This tests the panic path / 'I don't know' escape hatch. The user should NOT need to categorize the emergency. If they freeze at the triage grid, the panic path is not prominent enough.",
  },
  {
    id: 'DRILL-005',
    scenario:
      'There was a chemical spill in the storage shed and a coworker got chemicals in their eyes. They are screaming. What do you do?',
    expectedPath: ['chemical', 'medical'],
    keyActions: [
      'User calls 911',
      'User finds eyewash station location (chemical storage shed or Building A corridor)',
      'User knows to flush eyes for 15+ minutes',
      'User knows to locate the SDS for the chemical',
      'User does NOT try to clean up the spill',
    ],
    timeTarget: '< 25 seconds to eyewash station location found',
    facilitatorNotes:
      'Tests multi-emergency handling (chemical + medical). Watch if user selects one or both categories. Also test if they can find the eyewash station quickly — this is time-critical for chemical eye exposure.',
  },
  {
    id: 'DRILL-006',
    scenario:
      'An emergency just happened and EMS has taken the injured person. It is now 30 minutes later. The Safety Officer asks you: what needs to happen next?',
    expectedPath: ['post-incident'],
    keyActions: [
      'User can find the post-incident checklist',
      'User knows to preserve the scene (do not clean up)',
      'User knows OSHA reporting deadlines (fatality: 8hr, hospital: 24hr)',
      'User knows to document what happened while it is fresh',
      'User can find the OSHA reporting phone number and URL',
    ],
    timeTarget: 'N/A — this tests knowledge of the process, not speed',
    facilitatorNotes:
      'Post-incident is where most EAPs fall down. Workers do the right thing during the emergency but then the scene gets cleaned up, nobody documents, and the OSHA deadline passes. Test whether the post-incident section is even visible / findable.',
  },
];

export interface DrillResult {
  scenarioId: string;
  date: string;
  participant: string;
  timeToKeyAction: number;
  passedAllActions: boolean;
  failedActions: string[];
  notes: string;
}

export const DRILL_RESULT_TEMPLATE: DrillResult = {
  scenarioId: '',
  date: new Date().toISOString().split('T')[0],
  participant: '',
  timeToKeyAction: 0,
  passedAllActions: false,
  failedActions: [],
  notes: '',
};
