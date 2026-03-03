/**
 * Minimum Approach Distances from OSHA 1910.269 Table R-6 (AC) and Table R-7 (DC).
 *
 * IMPORTANT: These values must be verified by a qualified person
 * against the current CFR text before production use.
 *
 * Last verified: 2026-02-17 (OSHA eTools, 1926.960 Table V-5/V-6, 1910.269 App B)
 * Source: 29 CFR 1910.269 Table R-6 (AC), Table R-7 (DC); 1926.960 Tables V-5, V-6
 */

export interface MADEntry {
  voltageRangeKV: { min: number; max: number };
  label: string;
  phaseToGround: string;
  phaseToPhase: string;
  phaseToGroundMeters: number;
  phaseToPhaseMeters: number;
}

export const MAD_TABLE: MADEntry[] = [
  {
    voltageRangeKV: { min: 0.05, max: 1.0 },
    label: '50V – 1.0kV',
    phaseToGround: 'Avoid contact',
    phaseToPhase: 'Avoid contact',
    phaseToGroundMeters: 0,
    phaseToPhaseMeters: 0,
  },
  {
    voltageRangeKV: { min: 1.1, max: 15.0 },
    label: '1.1kV – 15.0kV',
    phaseToGround: '2 ft 2 in',
    phaseToPhase: '2 ft 3 in',
    phaseToGroundMeters: 0.66,
    phaseToPhaseMeters: 0.69,
  },
  {
    voltageRangeKV: { min: 15.1, max: 36.0 },
    label: '15.1kV – 36.0kV',
    phaseToGround: '3 ft 0 in',
    phaseToPhase: '3 ft 4 in',
    phaseToGroundMeters: 0.91,
    phaseToPhaseMeters: 1.02,
  },
  {
    voltageRangeKV: { min: 36.1, max: 46.0 },
    label: '36.1kV – 46.0kV',
    phaseToGround: '3 ft 4 in',
    phaseToPhase: '3 ft 8 in',
    phaseToGroundMeters: 1.02,
    phaseToPhaseMeters: 1.12,
  },
  {
    voltageRangeKV: { min: 46.1, max: 72.5 },
    label: '46.1kV – 72.5kV',
    phaseToGround: '3 ft 8 in',
    phaseToPhase: '4 ft 0 in',
    phaseToGroundMeters: 1.12,
    phaseToPhaseMeters: 1.22,
  },
  {
    voltageRangeKV: { min: 72.6, max: 121.0 },
    label: '72.6kV – 121.0kV',
    phaseToGround: '3 ft 8 in',
    phaseToPhase: '4 ft 8 in',
    phaseToGroundMeters: 1.13,
    phaseToPhaseMeters: 1.42,
  },
  {
    voltageRangeKV: { min: 121.1, max: 145.0 },
    label: '121.1kV – 145.0kV',
    phaseToGround: '4 ft 3 in',
    phaseToPhase: '5 ft 5 in',
    phaseToGroundMeters: 1.3,
    phaseToPhaseMeters: 1.64,
  },
  {
    voltageRangeKV: { min: 145.1, max: 169.0 },
    label: '145.1kV – 169.0kV',
    phaseToGround: '4 ft 9 in',
    phaseToPhase: '6 ft 4 in',
    phaseToGroundMeters: 1.46,
    phaseToPhaseMeters: 1.94,
  },
  {
    voltageRangeKV: { min: 169.1, max: 242.0 },
    label: '169.1kV – 242.0kV',
    phaseToGround: '6 ft 7 in',
    phaseToPhase: '10 ft 1 in',
    phaseToGroundMeters: 2.01,
    phaseToPhaseMeters: 3.08,
  },
  {
    voltageRangeKV: { min: 242.1, max: 362.0 },
    label: '242.1kV – 362.0kV',
    phaseToGround: '11 ft 2 in',
    phaseToPhase: '18 ft 1 in',
    phaseToGroundMeters: 3.41,
    phaseToPhaseMeters: 5.52,
  },
  {
    voltageRangeKV: { min: 362.1, max: 420.0 },
    label: '362.1kV – 420.0kV',
    phaseToGround: '13 ft 11 in',
    phaseToPhase: '22 ft 4 in',
    phaseToGroundMeters: 4.25,
    phaseToPhaseMeters: 6.81,
  },
  {
    voltageRangeKV: { min: 420.1, max: 550.0 },
    label: '420.1kV – 550.0kV',
    phaseToGround: '16 ft 8 in',
    phaseToPhase: '27 ft 0 in',
    phaseToGroundMeters: 5.07,
    phaseToPhaseMeters: 8.24,
  },
  {
    voltageRangeKV: { min: 550.1, max: 800.0 },
    label: '550.1kV – 800.0kV',
    phaseToGround: '22 ft 7 in',
    phaseToPhase: '37 ft 4 in',
    phaseToGroundMeters: 6.88,
    phaseToPhaseMeters: 11.38,
  },
];

export function lookupMAD(voltageKV: number): MADEntry | null {
  if (voltageKV < 0) return null;
  return (
    MAD_TABLE.find(
      (entry) =>
        voltageKV >= entry.voltageRangeKV.min && voltageKV <= entry.voltageRangeKV.max
    ) ?? null
  );
}

export const COMMON_VOLTAGES: { label: string; kv: number }[] = [
  { label: '120V', kv: 0.12 },
  { label: '240V', kv: 0.24 },
  { label: '480V', kv: 0.48 },
  { label: '4.8kV', kv: 4.8 },
  { label: '7.2kV', kv: 7.2 },
  { label: '12.47kV', kv: 12.47 },
  { label: '23kV', kv: 23 },
  { label: '34.5kV', kv: 34.5 },
  { label: '69kV', kv: 69 },
  { label: '115kV', kv: 115 },
  { label: '138kV', kv: 138 },
  { label: '230kV', kv: 230 },
  { label: '345kV', kv: 345 },
  { label: '500kV', kv: 500 },
  { label: '765kV', kv: 765 },
  { label: 'Unknown — contact utility', kv: -1 },
];
