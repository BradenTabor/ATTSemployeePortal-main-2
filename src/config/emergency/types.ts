// src/config/emergency/types.ts
// ============================================================
// Type definitions for the Emergency Action Plan system
// v3 — adds whileWaiting, doNot, evacuation routes, critical
//       operations, rescue areas, text-911, verification metadata
// ============================================================

export interface ContactInfo {
  name: string;
  title: string;
  phone: string;
  phoneBackup?: string;
}

export interface RoleAssignment {
  primary: ContactInfo;
  backup: ContactInfo;
}

export interface CertifiedResponder extends ContactInfo {
  certification: 'CPR' | 'First Aid' | 'CPR + First Aid' | 'EMT' | 'HazMat';
  certExpiry: string; // ISO date
}

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface LocationInfo {
  name: string;
  description?: string;
  address?: string;
  coordinates: Coordinates;
}

// ---- Site Info ----

export interface MusterPoint extends LocationInfo {
  type: 'primary' | 'secondary' | 'weather-shelter';
}

export interface HospitalInfo extends LocationInfo {
  phone: string;
  traumaLevel?: 'Level I' | 'Level II' | 'Level III' | 'Level IV' | 'Level V';
  specialty?: string;
  distanceMiles: number;
  driveTimeMinutes: number;
}

/** v3: Evacuation route assignment by zone/floor (OSHA 29 CFR 1910.38(c)(2)) */
export interface EvacuationRoute {
  zone: string;
  primaryExit: string;
  secondaryExit: string;
  musterPoint: string;
  notes?: string;
}

/** v3: Critical operation shutdown procedure (OSHA 29 CFR 1910.38(c)(3)) */
export interface CriticalOperation {
  operation: string;
  shutdownProcedure: string;
  responsibleRole: string;
  location: string;
  maxShutdownTime: string;
  abandonProcedure: string;
}

/** v3: ADA rescue assistance area for mobility-impaired workers */
export interface RescueAssistanceArea {
  building: string;
  floor: string;
  location: string;
  description: string;
}

export interface SiteInfo {
  projectName: string;
  companyName: string;
  address: string;
  crossStreets: string;
  coordinates: Coordinates;
  what3words?: string;
  emergencyAccess: {
    gate: string;
    instructions: string;
    landmarks: string;
  };
  musterPoints: MusterPoint[];
  nearestHospital: HospitalInfo;
  specialtyHospitals?: HospitalInfo[];
  /** v3: OSHA 1910.38(c)(2) — evacuation routes by zone */
  evacuationRoutes: EvacuationRoute[];
  /** v3: OSHA 1910.38(c)(3) — critical operations requiring shutdown before evacuation */
  criticalOperations: CriticalOperation[];
  /** v3: ADA — areas of rescue assistance for mobility-impaired workers */
  rescueAssistanceAreas?: RescueAssistanceArea[];
  /** v3: Whether local 911 center supports text-to-911 */
  text911Available: boolean;
  text911Instructions?: string;
  alarmSystem?: string;
}

// ---- Equipment ----

export type EquipmentType =
  | 'AED'
  | 'first-aid-kit'
  | 'fire-extinguisher-abc'
  | 'fire-extinguisher-co2'
  | 'eyewash-station'
  | 'emergency-shower'
  | 'spill-kit';

export interface EquipmentLocation {
  type: EquipmentType;
  location: string;
  floor?: string;
  notes?: string;
}

// ---- Emergency Protocols ----

export type EmergencyType =
  | 'medical'
  | 'fire'
  | 'equipment-fire'
  | 'chemical'
  | 'structural'
  | 'weather'
  | 'utility'
  | 'threat';

export interface EmergencyProtocol {
  type: EmergencyType;
  label: string;
  icon: string;
  call911: boolean;
  immediateActions: string[];
  contactPriority: Array<'911' | 'siteSuper' | 'safetyOfficer' | 'fireWatch' | 'hazmat' | 'utility'>;
  equipmentNeeded: EquipmentType[];
  musterRequired: boolean;
  criticalNotes?: string[];
  /** v3: Actions while waiting for EMS arrival (post-911, pre-arrival) */
  whileWaiting: string[];
  /** v3: Critical "don'ts" — common dangerous mistakes */
  doNot: string[];
}

// ---- Emergency Roles ----

export interface EmergencyRoles {
  incidentCommander: RoleAssignment;
  accountability: RoleAssignment;
  firstAidResponders: CertifiedResponder[];
  fireWatch?: RoleAssignment;
  hazmat?: RoleAssignment;
  offSiteEscalation: ContactInfo[];
}

// ---- Contacts ----

export interface UtilityContact {
  name: string;
  provider: string;
  phone: string;
  emergencyPhone?: string;
}

export interface EmergencyContacts {
  company: ContactInfo;
  siteSuper: ContactInfo;
  safetyOfficer: ContactInfo;
  utilities: UtilityContact[];
  osha: {
    phone: string;
    reportUrl: string;
    reportingDeadlines: {
      fatality: string;
      hospitalization: string;
    };
  };
  additional?: ContactInfo[];
}

// ---- Metadata / Governance ----

export interface EAPChangeLogEntry {
  version: string;
  date: string;
  change: string;
  author: string;
}

export interface EAPMetadata {
  version: string;
  effectiveDate: string;
  lastReviewedDate: string;
  lastReviewedBy: string;
  approvedBy: string;
  nextReviewDue: string;
  changeLog: EAPChangeLogEntry[];
  /** v3: Last time all phone numbers were physically test-called */
  lastPhoneVerification: string;
  phoneVerifiedBy: string;
  /** v3: Last time all physical locations (AED, muster, etc.) were walked and confirmed */
  lastPhysicalVerification: string;
  physicalVerifiedBy: string;
}

// ---- Complete EAP Config ----

export interface EmergencyActionPlanConfig {
  metadata: EAPMetadata;
  site: SiteInfo;
  contacts: EmergencyContacts;
  roles: EmergencyRoles;
  protocols: EmergencyProtocol[];
  equipment: EquipmentLocation[];
}
