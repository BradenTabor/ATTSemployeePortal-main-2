#!/usr/bin/env npx tsx
// scripts/validate-eap-config.ts
// ============================================================
// Runs at build time (CI/CD). Fails the build if the EAP config
// has invalid data — wrong phone numbers, expired certs, missing
// muster points, null-island coordinates, etc.
//
// Usage: npx tsx scripts/validate-eap-config.ts
//        OR add to package.json: "prebuild": "npx tsx scripts/validate-eap-config.ts"
// ============================================================

import config from '../src/config/emergency/sampleSiteConfig';
import { isValidPhone } from '../src/lib/emergency';

function isPlaceholderPhone(phone: string): boolean {
  return phone === '—' || phone === '-' || phone === 'N/A' || phone.trim() === '';
}

interface ValidationResult {
  errors: string[];
  warnings: string[];
}

export function validateEAPConfig(cfg: typeof config): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const validatePhone = (label: string, phone: string) => {
    if (isPlaceholderPhone(phone)) return;
    if (!isValidPhone(phone)) {
      errors.push(`Invalid phone for ${label}: "${phone}"`);
    }
  };

  // Critical contacts
  const criticalContacts = [
    ['Company emergency', cfg.contacts?.company?.phone],
    ['Site Superintendent', cfg.contacts?.siteSuper?.phone],
    ['Safety Officer', cfg.contacts?.safetyOfficer?.phone],
    ['Nearest hospital', cfg.site?.nearestHospital?.phone],
    ['OSHA', cfg.contacts?.osha?.phone],
  ] as const;

  for (const [label, phone] of criticalContacts) {
    if (!phone) {
      errors.push(`Missing phone for critical contact: ${label}`);
    } else if (isPlaceholderPhone(phone)) {
      errors.push(`Critical contact "${label}" has placeholder phone "${phone}" — this MUST be a real number`);
    } else {
      validatePhone(label, phone);
    }
  }

  // Utility contacts
  if (cfg.contacts?.utilities) {
    for (const u of cfg.contacts.utilities) {
      if (isPlaceholderPhone(u.phone)) {
        warnings.push(`Utility "${u.name}" (${u.provider}) has placeholder phone "${u.phone}" — consider adding a real number`);
      } else {
        validatePhone(`Utility: ${u.name}`, u.phone);
      }
    }
  }

  // First aid responder phones
  if (cfg.roles?.firstAidResponders) {
    for (const r of cfg.roles.firstAidResponders) {
      validatePhone(`First Aid: ${r.name}`, r.phone);
    }
  }

  // Off-site escalation
  if (cfg.roles?.offSiteEscalation) {
    for (const c of cfg.roles.offSiteEscalation) {
      validatePhone(`Escalation: ${c.name}`, c.phone);
    }
  }

  // Certification expiry
  if (cfg.roles?.firstAidResponders) {
    const now = new Date();
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;

    for (const r of cfg.roles.firstAidResponders) {
      const expiry = new Date(r.certExpiry);
      if (isNaN(expiry.getTime())) {
        errors.push(`Invalid cert expiry date for ${r.name}: "${r.certExpiry}"`);
      } else if (expiry < now) {
        errors.push(`EXPIRED certification for ${r.name}: ${r.certification} expired ${r.certExpiry}`);
      } else if (expiry.getTime() - now.getTime() < thirtyDays) {
        warnings.push(`Certification expiring soon for ${r.name}: ${r.certification} expires ${r.certExpiry}`);
      }
    }
  }

  // Coordinate validation
  const validateCoords = (label: string, coords: { lat: number; lng: number } | undefined) => {
    if (!coords || typeof coords.lat !== 'number' || typeof coords.lng !== 'number') {
      errors.push(`Missing or invalid coordinates for ${label}`);
      return;
    }
    if (coords.lat < -90 || coords.lat > 90) {
      errors.push(`Latitude out of range for ${label}: ${coords.lat}`);
    }
    if (coords.lng < -180 || coords.lng > 180) {
      errors.push(`Longitude out of range for ${label}: ${coords.lng}`);
    }
    if (Math.abs(coords.lat) < 1 && Math.abs(coords.lng) < 1) {
      errors.push(`Coordinates for ${label} look like null island (0,0): ${coords.lat}, ${coords.lng}`);
    }
  };

  validateCoords('Site', cfg.site?.coordinates);
  validateCoords('Nearest hospital', cfg.site?.nearestHospital?.coordinates);

  if (cfg.site?.musterPoints) {
    for (const mp of cfg.site.musterPoints) {
      validateCoords(`Muster point: ${mp.name}`, mp.coordinates);
    }
  }

  // Muster points
  if (!cfg.site?.musterPoints || cfg.site.musterPoints.length === 0) {
    errors.push('No muster points defined');
  } else {
    const hasPrimary = cfg.site.musterPoints.some((m) => m.type === 'primary');
    if (!hasPrimary) {
      errors.push('No PRIMARY muster point defined — at least one muster point must have type "primary"');
    }
  }

  // Escalation chain
  if (!cfg.roles?.offSiteEscalation || cfg.roles.offSiteEscalation.length === 0) {
    errors.push('No off-site escalation contacts — what if no one on site is reachable?');
  }
  if (!cfg.roles?.incidentCommander?.backup) {
    errors.push('No backup Incident Commander defined');
  }
  if (!cfg.roles?.accountability?.backup) {
    errors.push('No backup Accountability Officer defined');
  }

  // Review dates
  if (cfg.metadata?.nextReviewDue) {
    const nextReview = new Date(cfg.metadata.nextReviewDue);
    if (isNaN(nextReview.getTime())) {
      errors.push(`Invalid next review date: "${cfg.metadata.nextReviewDue}"`);
    } else if (nextReview < new Date()) {
      warnings.push(`EAP review is OVERDUE (due: ${cfg.metadata.nextReviewDue}). Schedule review immediately.`);
    }
  } else {
    errors.push('No next review date set (metadata.nextReviewDue)');
  }

  // Required site info
  const requiredSiteFields = ['projectName', 'companyName', 'address', 'crossStreets'];
  for (const field of requiredSiteFields) {
    const val = cfg.site?.[field as keyof typeof cfg.site];
    if (!val || String(val).trim() === '') {
      errors.push(`Missing required site info: site.${field}`);
    }
  }

  if (!cfg.site?.emergencyAccess?.gate) {
    errors.push('Missing emergency access gate instructions (site.emergencyAccess.gate)');
  }
  if (!cfg.site?.emergencyAccess?.instructions) {
    errors.push('Missing emergency access instructions (site.emergencyAccess.instructions)');
  }

  // OSHA compliance gaps (v3)
  if (!cfg.site?.evacuationRoutes || cfg.site.evacuationRoutes.length === 0) {
    warnings.push('No evacuation routes defined — OSHA 29 CFR 1910.38(c)(2) requires exit route assignments');
  }
  if (!cfg.site?.criticalOperations || cfg.site.criticalOperations.length === 0) {
    warnings.push('No critical operations defined — OSHA 29 CFR 1910.38(c)(3) may require shutdown procedures if applicable');
  }

  return { errors, warnings };
}

// CLI execution
const { errors, warnings } = validateEAPConfig(config);

if (warnings.length > 0) {
  console.warn('WARNINGS:');
  warnings.forEach((w) => console.warn(`  - ${w}`));
  console.warn('');
}

if (errors.length > 0) {
  console.error('EAP CONFIG VALIDATION FAILED:');
  errors.forEach((e) => console.error(`  - ${e}`));
  console.error(`\n${errors.length} error(s) found. Fix before deploying.`);
  process.exit(1);
}

console.log(`EAP config validation passed (${warnings.length} warning(s))`);
process.exit(0);
