import { format, parseISO } from 'date-fns';
import type { Units } from '@/types/weather';

export const cToF = (celsius: number): number => (celsius * 9) / 5 + 32;
export const kmhToMph = (kmh: number): number => kmh * 0.621371_2;
export const mmToIn = (mm: number): number => mm / 25.4;
export const kmToMi = (km: number): number => km * 0.621371_2;
export const hpaToInHg = (hpa: number): number => hpa * 0.02953;

/** Convert a metric temperature for display (no unit suffix). */
export function displayTemp(celsius: number, units: Units): number {
  return Math.round(units === 'metric' ? celsius : cToF(celsius));
}

export function formatTemp(celsius: number, units: Units): string {
  return `${displayTemp(celsius, units)}°`;
}

/** Signed temperature *difference* in display units, e.g. "+2°" / "−3°". */
export function formatTempDelta(deltaCelsius: number, units: Units): string {
  const delta = units === 'metric' ? deltaCelsius : deltaCelsius * (9 / 5);
  const rounded = Math.round(Math.abs(delta));
  const sign = delta >= 0.5 ? '+' : delta <= -0.5 ? '−' : '±';
  return `${sign}${rounded}°`;
}

export function formatWind(kmh: number, units: Units): string {
  if (units === 'metric') return `${Math.round(kmh)} km/h`;
  return `${Math.round(kmhToMph(kmh))} mph`;
}

export function formatWindUnit(units: Units): string {
  return units === 'metric' ? 'km/h' : 'mph';
}

export function formatVisibility(meters: number, units: Units): string {
  if (units === 'metric') {
    return meters >= 1000 ? `${Math.round(meters / 1000)} km` : `${Math.round(meters)} m`;
  }
  const mi = kmToMi(meters / 1000);
  return mi < 1 ? `${Math.round(mi * 5280)} ft` : `${mi.toFixed(1)} mi`;
}

export function formatPressure(hpa: number, units: Units): string {
  if (units === 'metric') return `${Math.round(hpa)} hPa`;
  return `${hpaToInHg(hpa).toFixed(2)} inHg`;
}

export function formatPrecip(mm: number, units: Units): string {
  if (units === 'metric') return `${mm.toFixed(1)} mm`;
  return `${mmToIn(mm).toFixed(2)} in`;
}

/**
 * Format a local ISO time (e.g. "2025-06-01T14:00") for the location.
 * parseISO interprets it in the browser frame; we only render clock
 * components, so the wall-clock round-trips exactly.
 */
export function formatHour(iso: string, units: Units): string {
  try {
    return format(parseISO(iso), units === 'metric' ? 'HH:mm' : 'h a');
  } catch {
    return '--:--';
  }
}

export function formatHourShort(iso: string, units: Units): string {
  try {
    return format(parseISO(iso), units === 'metric' ? 'HH' : 'h');
  } catch {
    return '--';
  }
}

export function formatWeekday(dateIso: string): string {
  try {
    return format(parseISO(dateIso), 'EEE');
  } catch {
    return '';
  }
}

export function formatMonthDay(dateIso: string): string {
  try {
    return format(parseISO(dateIso), 'd MMM');
  } catch {
    return '';
  }
}

const COMPASS_16 = [
  'N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
  'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW',
] as const;

export function compassPoint(degrees: number): string {
  const normalized = ((degrees % 360) + 360) % 360;
  return COMPASS_16[Math.round(normalized / 22.5) % 16];
}

export interface UvInfo {
  label: string;
  /** Semantic scale color (hex) — greens through ambers to plum for extreme. */
  color: string;
}

export function uvInfo(uv: number): UvInfo {
  if (uv < 3) return { label: 'Low', color: '#22BCA0' };
  if (uv < 6) return { label: 'Moderate', color: '#E8C54D' };
  if (uv < 8) return { label: 'High', color: '#F0954A' };
  if (uv < 11) return { label: 'Very high', color: '#E1552F' };
  return { label: 'Extreme', color: '#9B4A9E' };
}

export function visibilityLabel(meters: number): string {
  if (meters >= 20000) return 'Excellent';
  if (meters >= 10000) return 'Good';
  if (meters >= 4000) return 'Moderate';
  if (meters >= 1000) return 'Poor';
  return 'Very poor';
}

/** ISO 3166-1 alpha-2 code → regional-indicator emoji flag. */
export function countryFlag(countryCode?: string): string {
  if (!countryCode || countryCode.length !== 2) return '';
  const base = 0x1f1e6;
  const upper = countryCode.toUpperCase();
  return String.fromCodePoint(
    base + upper.charCodeAt(0) - 65,
    base + upper.charCodeAt(1) - 65,
  );
}
