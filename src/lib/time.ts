import { differenceInMinutes, format, parseISO } from 'date-fns';
import type { DayPhase } from '@/types/weather';

/** Minutes the browser timezone is offset from UTC (e.g. IST → -330). */
function browserTzOffsetMinutes(): number {
  return new Date().getTimezoneOffset();
}

/**
 * The location's wall-clock time expressed as a Date in the browser frame,
 * so it can be compared with parseISO(local iso) values directly.
 */
export function locationNow(utcOffsetSeconds: number): Date {
  return new Date(Date.now() + (utcOffsetSeconds + browserTzOffsetMinutes() * 60) * 1000);
}

/** Minutes elapsed at the location since a local ISO time occurred (negative = in the future). */
export function minutesSinceLocal(iso: string, utcOffsetSeconds: number): number {
  return differenceInMinutes(locationNow(utcOffsetSeconds), parseISO(iso));
}

const GOLDEN_WINDOW_MIN = 45;

export interface DayPhaseInput {
  isDay: boolean;
  sunrise: string;
  sunset: string;
  utcOffsetSeconds: number;
}

/**
 * Derive the day phase: night, golden dawn (≈45 min after sunrise),
 * day, or golden dusk (≈45 min before sunset).
 */
export function getDayPhase({ isDay, sunrise, sunset, utcOffsetSeconds }: DayPhaseInput): DayPhase {
  if (!isDay) return 'night';
  if (!sunrise || !sunset) return 'day';

  const sinceSunrise = minutesSinceLocal(sunrise, utcOffsetSeconds);
  const untilSunset = -minutesSinceLocal(sunset, utcOffsetSeconds);

  if (sinceSunrise >= -GOLDEN_WINDOW_MIN / 2 && sinceSunrise <= GOLDEN_WINDOW_MIN) return 'dawn';
  if (untilSunset >= -GOLDEN_WINDOW_MIN / 2 && untilSunset <= GOLDEN_WINDOW_MIN) return 'dusk';
  return 'day';
}

export function formatLocalClock(utcOffsetSeconds: number): string {
  try {
    return format(locationNow(utcOffsetSeconds), 'HH:mm');
  } catch {
    return '--:--';
  }
}

export function formatLocalDate(utcOffsetSeconds: number): string {
  try {
    return format(locationNow(utcOffsetSeconds), 'EEEE, d MMMM');
  } catch {
    return '';
  }
}

/** Sun progress across the day, 0 at sunrise → 1 at sunset (clamped). */
export function sunProgress(
  sunrise: string,
  sunset: string,
  utcOffsetSeconds: number,
): number {
  const start = parseISO(sunrise).getTime();
  const end = parseISO(sunset).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  const now = locationNow(utcOffsetSeconds).getTime();
  return Math.min(1, Math.max(0, (now - start) / (end - start)));
}

export function daylightLength(sunrise: string, sunset: string): string {
  try {
    const mins = differenceInMinutes(parseISO(sunset), parseISO(sunrise));
    if (!Number.isFinite(mins) || mins <= 0) return '—';
    return `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, '0')}m`;
  } catch {
    return '—';
  }
}
