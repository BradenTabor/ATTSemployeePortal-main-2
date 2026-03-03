// src/lib/emergency.ts
// ============================================================
// Utility functions for Emergency Action Plan
// v3 — adds mergeProtocols for multi-select triage
// ============================================================

import type {
  Coordinates,
  CertifiedResponder,
  UtilityContact,
  EmergencyProtocol,
  EquipmentType,
} from '../config/emergency/types';

/**
 * Generate a directions URL that works cross-platform.
 * iOS → Apple Maps, Android/Web → Google Maps.
 */
export function getDirectionsUrl(destination: Coordinates & { address: string }): string {
  const isIOS =
    typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);

  if (isIOS) {
    return `maps://maps.apple.com/?daddr=${encodeURIComponent(destination.address)}`;
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${destination.lat},${destination.lng}`;
}

/**
 * Format a phone number as a tel: URI.
 * Returns null if the phone is a placeholder.
 */
export function getTelUri(phone: string): string | null {
  const cleaned = phone.replace(/[^0-9+]/g, '');
  if (!cleaned || cleaned.length < 3) return null;
  return `tel:${cleaned}`;
}

/**
 * Check if a phone number is real (not a placeholder).
 */
export function isValidPhone(phone: string): boolean {
  return getTelUri(phone) !== null;
}

/**
 * Check if a responder's certification is expired or expiring soon.
 */
export function getCertStatus(
  responder: CertifiedResponder
): 'valid' | 'expiring-soon' | 'expired' {
  const now = new Date();
  const expiry = new Date(responder.certExpiry);
  const thirtyDays = 30 * 24 * 60 * 60 * 1000;

  if (expiry < now) return 'expired';
  if (expiry.getTime() - now.getTime() < thirtyDays) return 'expiring-soon';
  return 'valid';
}

/**
 * Check if the EAP review is overdue.
 */
export function getReviewStatus(nextReviewDue: string): 'current' | 'due-soon' | 'overdue' {
  const now = new Date();
  const due = new Date(nextReviewDue);
  const fourteenDays = 14 * 24 * 60 * 60 * 1000;

  if (due < now) return 'overdue';
  if (due.getTime() - now.getTime() < fourteenDays) return 'due-soon';
  return 'current';
}

/**
 * Split utility contacts into those with real phones and those with placeholders.
 */
export function partitionUtilityContacts(utilities: UtilityContact[]): {
  actionable: UtilityContact[];
  informational: UtilityContact[];
} {
  return {
    actionable: utilities.filter((u) => isValidPhone(u.phone)),
    informational: utilities.filter((u) => !isValidPhone(u.phone)),
  };
}

/**
 * Format coordinates for reading to a 911 dispatcher.
 */
export function formatCoordinatesForDispatch(coords: Coordinates): string {
  return `${coords.lat.toFixed(4)}°N, ${Math.abs(coords.lng).toFixed(4)}°W`;
}

/**
 * Equipment type labels for display.
 */
export const EQUIPMENT_LABELS: Record<EquipmentType, string> = {
  AED: 'AED (Defibrillator)',
  'first-aid-kit': 'First Aid Kit',
  'fire-extinguisher-abc': 'Fire Extinguisher (ABC)',
  'fire-extinguisher-co2': 'Fire Extinguisher (CO₂)',
  'eyewash-station': 'Emergency Eyewash Station',
  'emergency-shower': 'Emergency Shower',
  'spill-kit': 'Spill Response Kit',
};

// ============================================================
// v3: Multi-select triage support
// ============================================================

export interface MergedProtocol {
  types: string[];
  labels: string[];
  call911: boolean;
  immediateActions: string[];
  contactPriority: string[];
  equipmentNeeded: EquipmentType[];
  musterRequired: boolean;
  criticalNotes: string[];
  whileWaiting: string[];
  doNot: string[];
}

/**
 * Merge multiple emergency protocols when the user selects more than one
 * emergency type (e.g., chemical spill WITH injuries).
 */
export function mergeProtocols(protocols: EmergencyProtocol[]): MergedProtocol {
  if (protocols.length === 0) {
    return {
      types: [],
      labels: [],
      call911: true,
      immediateActions: ['Call 911 immediately', 'Move away from danger', 'Notify your supervisor'],
      contactPriority: ['911', 'siteSuper', 'safetyOfficer'],
      equipmentNeeded: [],
      musterRequired: false,
      criticalNotes: [],
      whileWaiting: ['Stay calm and stay on the line with 911', 'Follow dispatcher instructions'],
      doNot: [],
    };
  }

  if (protocols.length === 1) {
    const p = protocols[0];
    return {
      types: [p.type],
      labels: [p.label],
      call911: p.call911,
      immediateActions: p.immediateActions,
      contactPriority: p.contactPriority,
      equipmentNeeded: p.equipmentNeeded,
      musterRequired: p.musterRequired,
      criticalNotes: p.criticalNotes ?? [],
      whileWaiting: p.whileWaiting,
      doNot: p.doNot,
    };
  }

  const seen = {
    actions: new Set<string>(),
    contacts: new Set<string>(),
    equipment: new Set<EquipmentType>(),
    notes: new Set<string>(),
    waiting: new Set<string>(),
    donts: new Set<string>(),
  };

  const merged: MergedProtocol = {
    types: [],
    labels: [],
    call911: false,
    immediateActions: [],
    contactPriority: [],
    equipmentNeeded: [],
    musterRequired: false,
    criticalNotes: [],
    whileWaiting: [],
    doNot: [],
  };

  for (const p of protocols) {
    merged.types.push(p.type);
    merged.labels.push(p.label);

    if (p.call911) merged.call911 = true;
    if (p.musterRequired) merged.musterRequired = true;

    for (const action of p.immediateActions) {
      if (!seen.actions.has(action)) {
        seen.actions.add(action);
        merged.immediateActions.push(action);
      }
    }

    for (const contact of p.contactPriority) {
      if (!seen.contacts.has(contact)) {
        seen.contacts.add(contact);
        merged.contactPriority.push(contact);
      }
    }

    for (const equip of p.equipmentNeeded) {
      if (!seen.equipment.has(equip)) {
        seen.equipment.add(equip);
        merged.equipmentNeeded.push(equip);
      }
    }

    for (const note of p.criticalNotes ?? []) {
      if (!seen.notes.has(note)) {
        seen.notes.add(note);
        merged.criticalNotes.push(note);
      }
    }

    for (const w of p.whileWaiting) {
      if (!seen.waiting.has(w)) {
        seen.waiting.add(w);
        merged.whileWaiting.push(w);
      }
    }

    for (const d of p.doNot) {
      if (!seen.donts.has(d)) {
        seen.donts.add(d);
        merged.doNot.push(d);
      }
    }
  }

  if (merged.call911 && merged.contactPriority[0] !== '911') {
    merged.contactPriority = ['911', ...merged.contactPriority.filter((c) => c !== '911')];
  }

  return merged;
}
