import type { City, Condition, DayPhase } from '@/types/weather';

/* ================================================================== */
/* Section registry — the ids/titles of the ForecastSections blocks.   */
/* Shared by ForecastSections (render + ⌘K jumps), the preferences    */
/* store (sectionOrder / hiddenSections validation) and Settings      */
/* (the "Hidden cards" manager). Pure data + helpers, no React.       */
/* ================================================================== */

export const SECTION_IDS = [
  'hourly',
  'daily',
  'air',
  'models',
  'sky',
  'details',
  'timemachine',
  'advisor',
] as const;

export type SectionId = (typeof SECTION_IDS)[number];

/** Static display titles (the daily section header shows the live count). */
export const SECTION_TITLES: Record<SectionId, string> = {
  hourly: 'Next 48 hours',
  daily: 'Daily forecast',
  air: 'Air quality',
  models: 'Models & confidence',
  sky: 'Sky & photography',
  details: 'Details',
  timemachine: 'Time machine',
  advisor: 'Smart advisor',
};

export const DEFAULT_SECTION_ORDER: SectionId[] = [...SECTION_IDS];

const VALID = new Set<string>(SECTION_IDS);

/**
 * Sanitize a persisted section order: drop unknown ids, keep the user's
 * sequence, then append any registry ids that are missing (new sections
 * shipped later stay visible instead of vanishing).
 */
export function normalizeSectionOrder(order: unknown): SectionId[] {
  if (!Array.isArray(order)) return [...DEFAULT_SECTION_ORDER];
  const kept = order.filter((id): id is SectionId => typeof id === 'string' && VALID.has(id));
  const seen = new Set(kept);
  const missing = DEFAULT_SECTION_ORDER.filter((id) => !seen.has(id));
  return [...kept, ...missing];
}

/** Sanitize a persisted hidden-sections list (unknown ids dropped). */
export function normalizeHiddenSections(hidden: unknown): SectionId[] {
  if (!Array.isArray(hidden)) return [];
  return hidden.filter((id): id is SectionId => typeof id === 'string' && VALID.has(id));
}

/* ------------------------------------------------------------------ */
/* Ambient sound scene derivation (shared by the hook + engine)        */
/* ------------------------------------------------------------------ */

export type AmbientSceneId =
  | 'rain'
  | 'drizzle'
  | 'thunder'
  | 'night'
  | 'snow'
  | 'wind'
  | 'fog'
  | 'breeze';

/**
 * Map the current weather to a synthesized ambience scene.
 * - rainy family by condition (drizzle quieter, thunder adds rumbles)
 * - night phases get a soft bed + sparse crickets (clear/partly nights)
 * - snow gets a muffled hush (no crickets — too cold for them)
 * - fog a low warm pad, cloudy a gentle wind bed, day variants a breeze
 */
export function deriveAmbientScene(
  condition: Condition,
  phase: DayPhase,
  _heavyPrecip = false,
): AmbientSceneId {
  switch (condition) {
    case 'rain':
      return 'rain';
    case 'drizzle':
      return 'drizzle';
    case 'thunder':
      return 'thunder';
    case 'snow':
      return 'snow';
    case 'fog':
      return 'fog';
    case 'cloudy':
      return 'wind';
    case 'clear':
    case 'partly-cloudy':
    default:
      return phase === 'night' ? 'night' : 'breeze';
  }
}

/* ------------------------------------------------------------------ */
/* Offline weather cache — localStorage bundle store (client-only)    */
/* ------------------------------------------------------------------ */

const WEATHER_CACHE_KEY = 'aether-weather-cache';
const WEATHER_CACHE_MAX_CITIES = 5;

interface CachedWeatherEntry {
  city: City;
  bundle: unknown;
  savedAt: number;
}

type WeatherCacheMap = Record<string, CachedWeatherEntry>;

function safeReadCache(): WeatherCacheMap {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(WEATHER_CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as WeatherCacheMap;
    if (parsed && typeof parsed === 'object') return parsed;
  } catch {
    // corrupted cache — treat as empty
  }
  return {};
}

function safeWriteCache(map: WeatherCacheMap): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify(map));
  } catch {
    // storage full / private mode — cache is best-effort
  }
}

export function cacheKeyForCity(city: City): string {
  const lat = Math.round(city.latitude * 1000) / 1000;
  const lon = Math.round(city.longitude * 1000) / 1000;
  return `${lat},${lon}`;
}

/** Persist the last successful bundle for a city (cap ~5, prune oldest). */
export function saveCachedBundle(city: City, bundle: unknown): void {
  if (typeof window === 'undefined') return;
  const map = safeReadCache();
  map[cacheKeyForCity(city)] = { city, bundle, savedAt: Date.now() };
  const entries = Object.values(map);
  if (entries.length > WEATHER_CACHE_MAX_CITIES) {
    entries
      .sort((a, b) => b.savedAt - a.savedAt)
      .slice(WEATHER_CACHE_MAX_CITIES)
      .forEach((entry) => {
        delete map[cacheKeyForCity(entry.city)];
      });
  }
  safeWriteCache(map);
}

export interface CachedWeatherBundle<T> {
  bundle: T;
  savedAt: number;
}

/** Read the cached bundle for a city (null when absent/unreadable). */
export function loadCachedBundle<T>(city: City): CachedWeatherBundle<T> | null {
  if (typeof window === 'undefined') return null;
  const entry = safeReadCache()[cacheKeyForCity(city)];
  if (!entry || typeof entry.savedAt !== 'number' || !entry.bundle) return null;
  return { bundle: entry.bundle as T, savedAt: entry.savedAt };
}
