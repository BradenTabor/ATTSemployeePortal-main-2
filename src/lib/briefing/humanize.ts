/**
 * Turn raw JSA / PPE / hazard keys into language a field worker would say.
 * The briefing page used to dump `line_clearances_signed` onto the card.
 *
 * Labels stay in this module (not imported from form pages) so lib/ cannot
 * depend on pages/.
 */

const KNOWN_LABELS: Record<string, string> = {
  lines_energized: 'Lines energized',
  secondary_voltage: 'Secondary voltage',
  open_wire_secondary: 'Open-wire secondary',
  guy_wire_present: 'Guy wire present',
  rotten_poles: 'Rotten poles',
  broken_poles: 'Broken / damaged poles',
  line_clearances_signed: 'Line clearances needed and signed',
  voltages_grounded: 'Voltages grounded',
  voltages_verified: 'Grounds verified',
  hard_hats: 'Hard hats',
  safety_glasses: 'Safety glasses',
  ear_plugs: 'Ear plugs',
  reflective_vest: 'Reflective vest',
  fall_protection: 'Fall protection',
  gloves: 'Gloves',
  chaps: 'Chaps',
  hills: 'Hills',
  curves: 'Curves',
  heavy_traffic: 'Heavy traffic',
  construction_zone: 'Construction zone',
  school_zone: 'School zone',
  closing_lane: 'Closing a lane',
  flagger_needed: 'Flagger needed',
  flagger_trained: 'Flagger trained',
  has_stop_paddles: 'Stop/Slow paddles ready',
  has_radios: 'Required radios ready',
  warning_signs_used: 'Proper warning signs used',
  warning_signs_distance: 'Signs at correct distance',
  reflective_cones: 'Reflective cones placed',
  cone_separation: 'Cone separation correct',
  buffer_zone: 'Buffer/Taper zone correct',
  sunny: 'Sunny',
  rain: 'Rain',
  overcast: 'Overcast',
  windy: 'Windy',
  hot_dry: 'Hot / Dry',
  wet: 'Wet',
  cold: 'Cold',
  ice_snow: 'Ice / Snow',
  overhead_lines: 'Overhead lines',
  wet_ground: 'Wet ground',
  escape_routes: 'Escape routes',
  drop_zone: 'Drop zone',
  heat_stress: 'Heat stress',
  chipper: 'Chipper',
  chainsaw: 'Chainsaw',
  mad: 'Minimum approach distance',
};

/**
 * Convert a storage key or free-text hazard into a readable label.
 * Known JSA keys win. Everything else is title-cased and de-snaked.
 */
export function humanizeBriefingLabel(raw: string | null | undefined): string {
  if (!raw) return '';
  const trimmed = raw.replace(/\?+$/, '').trim();
  if (!trimmed) return '';

  const known = KNOWN_LABELS[trimmed] ?? KNOWN_LABELS[trimmed.toLowerCase()];
  if (known) return known;

  if (!/[_-]/.test(trimmed) && trimmed.includes(' ')) {
    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  }

  return trimmed
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

export function humanizeBriefingList(values: string[] | null | undefined, limit = 6): string[] {
  if (!values?.length) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const label = humanizeBriefingLabel(value);
    const key = label.toLowerCase();
    if (!label || seen.has(key)) continue;
    seen.add(key);
    out.push(label);
    if (out.length >= limit) break;
  }
  return out;
}
