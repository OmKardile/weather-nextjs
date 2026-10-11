import { addMinutes, differenceInMinutes, format, parseISO, subMinutes } from 'date-fns';
import type { Condition, DailyPoint, HourlyPoint } from '@/types/weather';

/* ================================================================== */
/* sky-time — golden/blue-hour + twilight-phase math for the Sky card.  */
/* All timestamps are the bundle's location-local ISO strings; parseISO */
/* puts them in the browser frame, matching locationNow() so now-vs-   */
/* event comparisons are exact (the established app pattern).           */
/*                                                                     */
/* Golden hour  ≈ the hour after sunrise and the hour before sunset.    */
/* Blue hour    ≈ the 20–30 min windows around the civil-twilight       */
/*               boundaries (sun between −6° and the horizon).          */
/* Nautical/astro phases are approximated from the civil duration      */
/* (nautical ≈ 1.4×, astro ≈ +1.6× civil) — accurate enough for the    */
/* day-strip visualization.                                            */
/* ================================================================== */

export interface PhaseWindow {
  /** Local ISO start. */
  start: string;
  /** Local ISO end. */
  end: string;
}

export interface DaySkyTimes {
  date: string;
  sunrise: Date;
  sunset: Date;
  civilBegin: Date;
  civilEnd: Date;
  /** Civil-twilight duration in minutes (sun −6° → horizon). */
  civilMinutes: number;
  goldenMorning: PhaseWindow;
  goldenEvening: PhaseWindow;
  blueMorning: PhaseWindow;
  blueEvening: PhaseWindow;
  nauticalDuskEnd: Date;
  astroDuskEnd: Date;
  nauticalDawnBegin: Date;
  astroDawnBegin: Date;
}

const BLUE_MAX = 28; // blue hour capped at 28 min (20–30 min spec)
const GOLDEN = 60; // golden hour length
const NAUTICAL_FACTOR = 1.4; // nautical phase ≈ 1.4× civil duration
const ASTRO_FACTOR = 1.6; // astro phase ≈ +1.6× civil duration

export function daySkyTimes(day: DailyPoint): DaySkyTimes {
  const sunrise = parseISO(day.sunrise);
  const sunset = parseISO(day.sunset);
  const civilBegin = parseISO(day.civilTwilightBegin ?? day.sunrise);
  const civilEnd = parseISO(day.civilTwilightEnd ?? day.sunset);
  // Mean of dawn/dusk civil duration; 30 min when the derived fields are
  // missing (they are always provided by the current bundle mapper).
  const civilMinutes =
    day.civilTwilightBegin != null && day.civilTwilightEnd != null
      ? Math.max(
          8,
          Math.round(
            (differenceInMinutes(sunrise, civilBegin) +
              differenceInMinutes(civilEnd, sunset)) /
              2,
          ),
        )
      : 30;

  // Wall-clock ISO in the browser frame (date-fns format, NOT toISOString —
  // these Dates are local-frame, and toISOString would shift them by the
  // browser timezone offset).
  const iso = (d: Date) => format(d, "yyyy-MM-dd'T'HH:mm");
  const window = (start: Date, end: Date): PhaseWindow => ({
    start: iso(start),
    end: iso(end),
  });

  return {
    date: day.date,
    sunrise,
    sunset,
    civilBegin,
    civilEnd,
    civilMinutes,
    goldenMorning: window(sunrise, addMinutes(sunrise, GOLDEN)),
    goldenEvening: window(subMinutes(sunset, GOLDEN), sunset),
    // Blue hour: the civil-twilight slice next to the horizon crossing,
    // clipped to a 20–30 minute window.
    blueMorning: window(
      /* later of */ new Date(Math.max(civilBegin.getTime(), subMinutes(sunrise, BLUE_MAX).getTime())),
      sunrise,
    ),
    blueEvening: window(
      sunset,
      /* earlier of */ new Date(Math.min(civilEnd.getTime(), addMinutes(sunset, BLUE_MAX).getTime())),
    ),
    nauticalDuskEnd: addMinutes(civilEnd, civilMinutes * NAUTICAL_FACTOR),
    astroDuskEnd: addMinutes(civilEnd, civilMinutes * (NAUTICAL_FACTOR + ASTRO_FACTOR)),
    nauticalDawnBegin: subMinutes(civilBegin, civilMinutes * NAUTICAL_FACTOR),
    astroDawnBegin: subMinutes(civilBegin, civilMinutes * (NAUTICAL_FACTOR + ASTRO_FACTOR)),
  };
}

/* ------------------------------------------------------------------ */
/* Day strip — noon-to-noon window covering tonight + tomorrow dawn     */
/* ------------------------------------------------------------------ */

export type StripPhase = 'night' | 'astro' | 'nautical' | 'civil' | 'golden' | 'day';

export interface StripSegment {
  phase: StripPhase;
  /** Minutes from the strip's start (window noon). */
  startMin: number;
  endMin: number;
}

export const STRIP_PHASE_COLORS: Record<StripPhase, string> = {
  night: '#152638',
  astro: '#22415C',
  nautical: '#35608B',
  civil: '#6D9CC4',
  golden: '#F2B75C',
  day: '#C4EAF8',
};

export const STRIP_PHASE_LABELS: Record<StripPhase, string> = {
  night: 'Night',
  astro: 'Astro',
  nautical: 'Nautical',
  civil: 'Civil',
  golden: 'Golden',
  day: 'Day',
};

/**
 * Build the phase segments for a noon→noon strip (today noon → tomorrow
 * noon), so tonight's dusk phases AND tomorrow's dawn phases are always
 * on the bar regardless of the current time of day.
 */
export function stripSegments(today: DaySkyTimes, tomorrow: DaySkyTimes): {
  windowStart: Date;
  /** 24h in minutes — always 1440, exposed for clarity. */
  durationMin: number;
  segments: StripSegment[];
} {
  const windowStart = parseISO(`${today.date}T12:00`);
  const startMin = (d: Date) => differenceInMinutes(d, windowStart);

  const raw: Array<{ phase: StripPhase; start: Date; end: Date }> = [
    // Today afternoon → dusk
    { phase: 'day', start: windowStart, end: subMinutes(today.sunset, GOLDEN) },
    { phase: 'golden', start: subMinutes(today.sunset, GOLDEN), end: today.sunset },
    { phase: 'civil', start: today.sunset, end: today.civilEnd },
    { phase: 'nautical', start: today.civilEnd, end: today.nauticalDuskEnd },
    { phase: 'astro', start: today.nauticalDuskEnd, end: today.astroDuskEnd },
    // Night spans across local midnight
    { phase: 'night', start: today.astroDuskEnd, end: tomorrow.astroDawnBegin },
    // Tomorrow dawn → morning
    { phase: 'astro', start: tomorrow.astroDawnBegin, end: tomorrow.nauticalDawnBegin },
    { phase: 'nautical', start: tomorrow.nauticalDawnBegin, end: tomorrow.civilBegin },
    { phase: 'civil', start: tomorrow.civilBegin, end: tomorrow.sunrise },
    { phase: 'golden', start: tomorrow.sunrise, end: addMinutes(tomorrow.sunrise, GOLDEN) },
    { phase: 'day', start: addMinutes(tomorrow.sunrise, GOLDEN), end: addMinutes(windowStart, 1440) },
  ];

  const segments: StripSegment[] = [];
  for (const seg of raw) {
    const start = Math.max(0, startMin(seg.start));
    const end = Math.min(1440, startMin(seg.end));
    if (end - start <= 0) continue;
    const prev = segments[segments.length - 1];
    // Drop degenerate duplicates (e.g. polar edge cases) but keep ordering.
    if (prev && prev.phase === seg.phase && Math.abs(prev.endMin - start) < 0.5) {
      prev.endMin = end;
      continue;
    }
    segments.push({ phase: seg.phase, startMin: start, endMin: end });
  }
  return { windowStart, durationMin: 1440, segments };
}

/** The phase the given moment sits in on a strip. */
export function phaseAt(segments: StripSegment[], minutesFromStart: number): StripPhase {
  for (const seg of segments) {
    if (minutesFromStart >= seg.startMin && minutesFromStart < seg.endMin) return seg.phase;
  }
  return segments.length > 0 ? segments[segments.length - 1].phase : 'night';
}

/* ------------------------------------------------------------------ */
/* Stargazing score                                                    */
/* ------------------------------------------------------------------ */

/** Effective cloudiness % per condition (bundle hourly has no cloud field). */
const CLOUD_BY_CONDITION: Record<Condition, number> = {
  clear: 5,
  'partly-cloudy': 40,
  cloudy: 85,
  fog: 92,
  drizzle: 95,
  rain: 100,
  snow: 100,
  thunder: 100,
};

/** Visibility (km) → 0–100 stargazing-friendliness, piecewise linear. */
export function visibilityScore(km: number): number {
  const anchors: Array<[km: number, score: number]> = [
    [0, 5],
    [1, 15],
    [4, 45],
    [10, 80],
    [20, 100],
  ];
  if (km <= 0) return 5;
  if (km >= 20) return 100;
  for (let i = 1; i < anchors.length; i += 1) {
    const [kmHi, scoreHi] = anchors[i];
    const [kmLo, scoreLo] = anchors[i - 1];
    if (km <= kmHi) {
      const t = (km - kmLo) / (kmHi - kmLo);
      return Math.round(scoreLo + t * (scoreHi - scoreLo));
    }
  }
  return 100;
}

export interface Stargazing {
  score: number;
  verdict: 'Excellent' | 'Good' | 'Fair' | 'Poor';
  /** 0–100: 100 = cloudless. */
  cloudScore: number;
  /** 0–100: 100 = new moon (no light pollution from the moon). */
  moonScore: number;
  /** 0–100: 100 = 20 km+ visibility. */
  visibilityScore: number;
  /** Average cloudiness % across tonight's hours. */
  cloudPercent: number;
  /** Average visibility in km across tonight's hours. */
  visibilityKm: number;
  /** Moon illumination 0–1 at the middle of the night. */
  moonIllumination: number;
  /** Number of hourly points the score is based on (0 → not computable). */
  hourCount: number;
}

/**
 * Tonight's stargazing score (0–100): 50% cloud cover, 30% moonlight,
 * 20% visibility across the dark hours (sunset→sunrise, or the remaining
 * night before dawn when viewed in the small hours).
 */
export function stargazingTonight(
  hours: HourlyPoint[],
  moonIllumination: number,
  now: Date,
  today: DaySkyTimes,
  tomorrow: DaySkyTimes,
): Stargazing | null {
  // Before dawn → score the remaining night; after sunset → tonight.
  const earlyMorning = now.getTime() < today.sunrise.getTime();
  const start = earlyMorning ? now : new Date(Math.max(now.getTime(), today.sunset.getTime()));
  const end = earlyMorning ? today.sunrise : tomorrow.sunrise;
  if (end.getTime() - start.getTime() < 30 * 60_000) return null;

  const nightHours = hours.filter((h) => {
    const t = parseISO(h.time).getTime();
    return t >= start.getTime() && t <= end.getTime();
  });
  if (nightHours.length === 0) return null;

  const cloudPercent =
    nightHours.reduce((sum, h) => sum + (CLOUD_BY_CONDITION[h.condition] ?? 50), 0) / nightHours.length;
  const visibilityKm =
    nightHours.reduce((sum, h) => sum + h.visibility / 1000, 0) / nightHours.length;
  const cloudScore = Math.round(Math.min(100, Math.max(0, 100 - cloudPercent)));
  const moonScore = Math.round(100 - moonIllumination * 100);
  const visScore = visibilityScore(visibilityKm);
  const score = Math.round(cloudScore * 0.5 + moonScore * 0.3 + visScore * 0.2);
  const verdict: Stargazing['verdict'] =
    score >= 80 ? 'Excellent' : score >= 60 ? 'Good' : score >= 40 ? 'Fair' : 'Poor';

  return {
    score,
    verdict,
    cloudScore,
    moonScore,
    visibilityScore: visScore,
    cloudPercent: Math.round(cloudPercent),
    visibilityKm: Math.round(visibilityKm * 10) / 10,
    moonIllumination,
    hourCount: nightHours.length,
  };
}
