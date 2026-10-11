import type { Condition } from '@/types/weather';

export interface WmoInfo {
  condition: Condition;
  label: string;
}

/**
 * Single source of truth for WMO 4677 weather-code → condition mapping.
 * https://open-meteo.com/en/docs (WMO weather interpretation codes)
 */
const WMO_MAP: Record<number, WmoInfo> = {
  0: { condition: 'clear', label: 'Clear sky' },
  1: { condition: 'clear', label: 'Mainly clear' },
  2: { condition: 'partly-cloudy', label: 'Partly cloudy' },
  3: { condition: 'cloudy', label: 'Overcast' },
  45: { condition: 'fog', label: 'Fog' },
  48: { condition: 'fog', label: 'Freezing fog' },
  51: { condition: 'drizzle', label: 'Light drizzle' },
  53: { condition: 'drizzle', label: 'Drizzle' },
  55: { condition: 'drizzle', label: 'Heavy drizzle' },
  56: { condition: 'drizzle', label: 'Freezing drizzle' },
  57: { condition: 'drizzle', label: 'Freezing drizzle' },
  61: { condition: 'rain', label: 'Light rain' },
  63: { condition: 'rain', label: 'Rain' },
  65: { condition: 'rain', label: 'Heavy rain' },
  66: { condition: 'rain', label: 'Freezing rain' },
  67: { condition: 'rain', label: 'Freezing rain' },
  71: { condition: 'snow', label: 'Light snow' },
  73: { condition: 'snow', label: 'Snow' },
  75: { condition: 'snow', label: 'Heavy snow' },
  77: { condition: 'snow', label: 'Snow grains' },
  80: { condition: 'rain', label: 'Light showers' },
  81: { condition: 'rain', label: 'Rain showers' },
  82: { condition: 'rain', label: 'Violent showers' },
  85: { condition: 'snow', label: 'Snow showers' },
  86: { condition: 'snow', label: 'Heavy snow showers' },
  95: { condition: 'thunder', label: 'Thunderstorm' },
  96: { condition: 'thunder', label: 'Thunderstorm · hail' },
  99: { condition: 'thunder', label: 'Severe thunderstorm · hail' },
};

const FALLBACK: WmoInfo = { condition: 'cloudy', label: 'Unknown' };

export function wmoInfo(code: number): WmoInfo {
  return WMO_MAP[code] ?? FALLBACK;
}

export function conditionOf(code: number): Condition {
  return wmoInfo(code).condition;
}

export function conditionLabel(code: number): string {
  return wmoInfo(code).label;
}
