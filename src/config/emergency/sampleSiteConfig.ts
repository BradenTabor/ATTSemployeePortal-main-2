// src/config/emergency/sampleSiteConfig.ts
// ============================================================
// SAMPLE — Replace with actual site data
// This file is the SINGLE SOURCE OF TRUTH for all emergency info.
// Safety Officer updates this file; no JSX changes needed.
// v3 — adds evacuationRoutes, criticalOperations, text911Available,
//      verification metadata
// ============================================================

import type { EmergencyActionPlanConfig } from './types';
import { EMERGENCY_PROTOCOLS } from './protocols';

const config: EmergencyActionPlanConfig = {
  metadata: {
    version: '3.2',
    effectiveDate: '2025-01-15',
    lastReviewedDate: '2025-01-15',
    lastReviewedBy: 'Jane Smith, CSP',
    approvedBy: 'Robert Johnson, VP Safety',
    nextReviewDue: '2027-07-15',
    lastPhoneVerification: '2025-01-10',
    phoneVerifiedBy: 'Jane Smith',
    lastPhysicalVerification: '2025-01-10',
    physicalVerifiedBy: 'Jane Smith',
    changeLog: [
      {
        version: '3.2',
        date: '2025-01-15',
        change: 'Updated nearest hospital to Memorial Medical (St. Johns closed Dec 2024)',
        author: 'Jane Smith',
      },
      {
        version: '3.1',
        date: '2024-10-01',
        change: 'Added Carlos Reyes as CPR/First Aid certified responder',
        author: 'Jane Smith',
      },
      {
        version: '3.0',
        date: '2024-07-15',
        change: 'Complete rewrite for new Riverdale Phase 2 site',
        author: 'Jane Smith',
      },
    ],
  },

  site: {
    projectName: 'Riverdale Phase 2',
    companyName: 'Acme Construction',
    address: '4500 Industrial Blvd, Springfield, IL 62704',
    crossStreets: 'Industrial Blvd & Commerce Dr',
    coordinates: { lat: 39.7817, lng: -89.6501 },
    what3words: 'filled.count.soap',
    emergencyAccess: {
      gate: 'North gate on Industrial Blvd',
      instructions:
        'Tell 911/ambulance to enter through the NORTH gate. Security will direct them to the incident location.',
      landmarks: 'Blue construction trailer at the north entrance',
    },
    musterPoints: [
      {
        name: 'Main Parking Lot — Flag Pole',
        type: 'primary',
        coordinates: { lat: 39.782, lng: -89.6498 },
      },
      {
        name: 'South Field — Near Water Tank',
        type: 'secondary',
        coordinates: { lat: 39.7812, lng: -89.6505 },
      },
      {
        name: 'Building C Interior — Break Room',
        type: 'weather-shelter',
        description: 'Use during tornado/severe weather. Interior room, no windows.',
        coordinates: { lat: 39.7816, lng: -89.6502 },
      },
    ],
    nearestHospital: {
      name: 'Memorial Medical Center',
      address: '701 N First St, Springfield, IL 62781',
      coordinates: { lat: 39.8055, lng: -89.637 },
      phone: '217-788-3000',
      traumaLevel: 'Level I',
      distanceMiles: 4.2,
      driveTimeMinutes: 8,
    },
    specialtyHospitals: [
      {
        name: 'SIU Medicine — Burn & Wound Center',
        address: '747 N Rutledge St, Springfield, IL 62702',
        coordinates: { lat: 39.8012, lng: -89.6398 },
        phone: '217-545-8000',
        specialty: 'Burn Center',
        distanceMiles: 5.1,
        driveTimeMinutes: 11,
      },
    ],
    evacuationRoutes: [
      {
        zone: 'Building A, Floors 1–3',
        primaryExit: 'North stairwell to parking lot',
        secondaryExit: 'South stairwell to Commerce Dr',
        musterPoint: 'Main Parking Lot — Flag Pole',
        notes: 'If north stairwell blocked, use exterior scaffold stair',
      },
      {
        zone: 'Building C, Basement',
        primaryExit: 'North stairwell to parking lot',
        secondaryExit: 'East exit to Commerce Dr',
        musterPoint: 'Main Parking Lot — Flag Pole',
      },
    ],
    criticalOperations: [
      {
        operation: 'Tower crane',
        shutdownProcedure: 'Operator: lower load, set brake, kill power at panel',
        responsibleRole: 'Crane Operator (or Signal Person if operator incapacitated)',
        location: 'Building A, crane panel at ground level',
        maxShutdownTime: '2 minutes',
        abandonProcedure: 'If crane cannot be safely stopped, evacuate 200ft radius',
      },
    ],
    text911Available: true,
    text911Instructions: 'Text "911" with your emergency and location: 4500 Industrial Blvd, Springfield IL',
  },

  contacts: {
    company: {
      name: 'Acme Construction — Emergency Line',
      title: 'Company Emergency',
      phone: '555-0100',
    },
    siteSuper: {
      name: 'Mike Torres',
      title: 'Site Superintendent',
      phone: '555-0101',
      phoneBackup: '555-0101-cell',
    },
    safetyOfficer: {
      name: 'Jane Smith',
      title: 'Safety Officer, CSP',
      phone: '555-0102',
      phoneBackup: '555-0102-cell',
    },
    utilities: [
      {
        name: 'Electric',
        provider: 'City Water Light & Power',
        phone: '217-789-2121',
        emergencyPhone: '217-789-2121',
      },
      {
        name: 'Gas',
        provider: 'Ameren Illinois',
        phone: '800-755-5000',
        emergencyPhone: '800-755-5000',
      },
      {
        name: 'Water',
        provider: 'City of Springfield Water',
        phone: '217-789-2323',
      },
      {
        name: 'Sewer',
        provider: 'Springfield Metro Sanitary District',
        phone: '217-789-2500',
      },
    ],
    osha: {
      phone: '1-800-321-OSHA (6742)',
      reportUrl: 'https://www.osha.gov/ords/imis/establishment.html',
      reportingDeadlines: {
        fatality: '8 hours from time of incident',
        hospitalization: '24 hours from time of incident (includes amputation, eye loss)',
      },
    },
    additional: [
      {
        name: 'Poison Control Center',
        title: 'National Poison Control',
        phone: '1-800-222-1222',
      },
      {
        name: 'Illinois EPA Emergency',
        title: 'Environmental Spill Reporting',
        phone: '217-782-7860',
      },
    ],
  },

  roles: {
    incidentCommander: {
      primary: {
        name: 'Mike Torres',
        title: 'Site Superintendent',
        phone: '555-0101',
      },
      backup: {
        name: 'Sarah Chen',
        title: 'General Foreman',
        phone: '555-0103',
      },
    },
    accountability: {
      primary: {
        name: 'Sarah Chen',
        title: 'General Foreman',
        phone: '555-0103',
      },
      backup: {
        name: 'Dave Wilson',
        title: 'Foreman — Zone A',
        phone: '555-0104',
      },
    },
    firstAidResponders: [
      {
        name: 'Jane Smith',
        title: 'Safety Officer',
        phone: '555-0102',
        certification: 'CPR + First Aid',
        certExpiry: '2027-09-15',
      },
      {
        name: 'Carlos Reyes',
        title: 'Lead Electrician',
        phone: '555-0105',
        certification: 'CPR + First Aid',
        certExpiry: '2027-06-20',
      },
      {
        name: 'Maria Gonzalez',
        title: 'Foreman — Zone B',
        phone: '555-0106',
        certification: 'First Aid',
        certExpiry: '2027-01-10',
      },
    ],
    fireWatch: {
      primary: {
        name: 'Jane Smith',
        title: 'Safety Officer',
        phone: '555-0102',
      },
      backup: {
        name: 'Tom Bradley',
        title: 'Lead Welder',
        phone: '555-0107',
      },
    },
    offSiteEscalation: [
      {
        name: 'Linda Park',
        title: 'Regional Safety Director',
        phone: '555-0200',
      },
      {
        name: 'Acme Construction HQ',
        title: 'Corporate Emergency Line (24/7)',
        phone: '555-0300',
      },
    ],
  },

  protocols: EMERGENCY_PROTOCOLS,

  equipment: [
    { type: 'AED', location: 'Main trailer, east wall by entrance' },
    { type: 'AED', location: 'Building A, 2nd floor break room' },
    { type: 'first-aid-kit', location: 'Main trailer, east wall' },
    { type: 'first-aid-kit', location: 'Each floor break room (Buildings A–C)' },
    { type: 'first-aid-kit', location: 'Foreman truck (Zone A & B)' },
    {
      type: 'fire-extinguisher-abc',
      location: 'Every floor, near stairwells (see posted maps)',
    },
    {
      type: 'fire-extinguisher-co2',
      location: 'Electrical room, Building B basement',
    },
    {
      type: 'eyewash-station',
      location: 'Chemical storage shed (south lot)',
    },
    {
      type: 'eyewash-station',
      location: 'Building A, ground floor restroom corridor',
    },
    {
      type: 'spill-kit',
      location: 'Chemical storage shed (south lot)',
      notes: 'Contains absorbent pads, booms, PPE gloves, disposal bags',
    },
  ],
};

export default config;
