/**
 * Moon phase calculation (no dependency, ~0.01° accuracy is plenty for UI).
 * Reference new moon: 2000-01-06 18:14 UTC. Synodic month: 29.530588853 days.
 */

export interface MoonPhase {
  /** 0–1 cycle position. 0 = new, 0.25 = first quarter, 0.5 = full, 0.75 = last quarter. */
  phase: number;
  /** Human-readable phase name. */
  name: string;
  /** Illuminated fraction of the disc, 0–1. */
  illumination: number;
  /** Days until/since the nearest full moon (negative = past). */
  daysFromFull: number;
}

const SYNODIC = 29.530588853;
const REF_NEW_MOON_MS = Date.UTC(2000, 0, 6, 18, 14);

const PHASE_NAMES: Array<[max: number, name: string]> = [
  [0.0333, 'New moon'],
  [0.2167, 'Waxing crescent'],
  [0.2833, 'First quarter'],
  [0.4667, 'Waxing gibbous'],
  [0.5333, 'Full moon'],
  [0.7167, 'Waning gibbous'],
  [0.7833, 'Last quarter'],
  [0.9667, 'Waning crescent'],
  [1.0001, 'New moon'],
];

export function getMoonPhase(date: Date = new Date()): MoonPhase {
  const days = (date.getTime() - REF_NEW_MOON_MS) / 86_400_000;
  let phase = (days / SYNODIC) % 1;
  if (phase < 0) phase += 1;

  const name = PHASE_NAMES.find(([max]) => phase < max)?.[1] ?? 'New moon';
  // Illumination: half-cosine between new (0) and full (1).
  const illumination = (1 - Math.cos(2 * Math.PI * phase)) / 2;
  const daysFromFull = ((0.5 - phase + 1.5) % 1 - 0.5) * SYNODIC;

  return { phase, name, illumination, daysFromFull };
}
