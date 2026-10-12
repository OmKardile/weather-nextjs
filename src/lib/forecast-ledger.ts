import type { City, WeatherBundle } from '@/types/weather';

/* ================================================================== */
/* Forecast ledger — Aether scores itself.                              */
/*                                                                     */
/* Every day the app records the forecast high/low it showed for that  */
/* date (first successful fetch of the local calendar day wins — the   */
/* "morning call"). When the measured yesterday (past_days=1 upstream) */
/* later arrives, the stored forecast is scored against the actual     */
/* high/low. The Forecast log card surfaces the rolling accuracy.      */
/*                                                                     */
/* Shape follows lib/achievements: a tiny in-memory observable store   */
/* (+ useSyncExternalStore bindings in hooks/use-forecast-ledger.ts).  */
/* localStorage is only ever read from hydrate/persist call sites —   */
/* never during render. All values are stored in the upstream metric   */
/* °C; the card converts for display.                                  */
/* ================================================================== */

export interface LedgerRecord {
  /** YYYY-MM-DD — the forecast *target* day, in the city's local time. */
  date: string;
  /** Forecast high (°C) as shown that morning. */
  fHigh: number;
  /** Forecast low (°C). */
  fLow: number;
  /** Measured high (°C) — filled once the day is in the past. */
  aHigh?: number;
  /** Measured low (°C). */
  aLow?: number;
}

export interface LedgerStats {
  /** Records kept for this city (scored + pending). */
  records: LedgerRecord[];
  /** Days with both forecast and actuals (scored). */
  scoredDays: number;
  /** Mean absolute error across high+low of scored days (°C). */
  meanErrorC: number | null;
  /** Share of scored high/low calls within 2 °C (0–100). */
  withinTwoPct: number | null;
  /** Scored days whose high AND low both landed within 2 °C. */
  cleanDays: number;
  /** Most recent scored records first (max 7 for the card). */
  recent: LedgerRecord[];
}

const STORAGE_KEY = 'aether-ledger';
const MAX_RECORDS_PER_CITY = 30;
const MAX_CITIES = 8;
const NEAR_MISS_C = 2;

type LedgerMap = Record<string, LedgerRecord[]>;

/* ------------------------------------------------------------------ */
/* Observable store (useSyncExternalStore-compatible)                  */
/* ------------------------------------------------------------------ */

const EMPTY_MAP: LedgerMap = {};

interface LedgerSnapshot {
  map: LedgerMap;
  /** Monotonic bump on every mutation (stats memos depend on it). */
  version: number;
}

let snapshot: LedgerSnapshot = { map: EMPTY_MAP, version: 0 };
let hydrated = false;
const listeners = new Set<() => void>();

function emit(): void {
  snapshot = { map: snapshot.map, version: snapshot.version + 1 };
  listeners.forEach((listener) => listener());
}

function persist(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot.map));
  } catch {
    // storage full / private mode — the ledger is best-effort
  }
}

export function subscribeLedger(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getLedgerSnapshot(): LedgerSnapshot {
  return snapshot;
}

export function getLedgerServerSnapshot(): LedgerSnapshot {
  return { map: EMPTY_MAP, version: 0 };
}

function isValidRecord(value: unknown): value is LedgerRecord {
  if (!value || typeof value !== 'object') return false;
  const r = value as Record<string, unknown>;
  return (
    typeof r.date === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(r.date) &&
    Number.isFinite(r.fHigh) &&
    Number.isFinite(r.fLow) &&
    (r.aHigh === undefined || Number.isFinite(r.aHigh)) &&
    (r.aLow === undefined || Number.isFinite(r.aLow))
  );
}

/**
 * Read localStorage into the in-memory store. Called once from the hook's
 * mount effect — never during render/SSR.
 */
export function hydrateLedger(): void {
  if (hydrated || typeof window === 'undefined') return;
  hydrated = true;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const map: LedgerMap = {};
        for (const [key, records] of Object.entries(parsed as Record<string, unknown>)) {
          if (typeof key !== 'string' || !Array.isArray(records)) continue;
          const valid = records.filter(isValidRecord);
          if (valid.length > 0) map[key] = valid.slice(-MAX_RECORDS_PER_CITY);
        }
        snapshot = { map, version: snapshot.version + 1 };
      }
    }
  } catch {
    // corrupted payload — start with an empty ledger
  }
}

/* ------------------------------------------------------------------ */
/* Recording + scoring (mutate the store, persist, emit)                */
/* ------------------------------------------------------------------ */

/** Stable key for a city (same rounding as the offline bundle cache). */
function ledgerCityKey(city: City): string {
  const lat = Math.round(city.latitude * 1000) / 1000;
  const lon = Math.round(city.longitude * 1000) / 1000;
  return `${lat},${lon}`;
}

function sameDate(a: string, b: string): boolean {
  return a.slice(0, 10) === b.slice(0, 10);
}

function pruneCities(): void {
  const keys = Object.keys(snapshot.map);
  if (keys.length <= MAX_CITIES) return;
  const stale = keys
    .map((k) => ({ k, last: snapshot.map[k][snapshot.map[k].length - 1]?.date ?? '' }))
    .sort((a, b) => b.last.localeCompare(a.last))
    .slice(MAX_CITIES)
    .map((entry) => entry.k);
  const map = { ...snapshot.map };
  for (const key of stale) delete map[key];
  snapshot = { map, version: snapshot.version + 1 };
}

/**
 * Record today's forecast high/low for the city (first fetch of the local
 * day wins — the "morning call"). Returns true when a NEW record was kept.
 */
export function recordTodaysForecast(city: City, bundle: WeatherBundle): boolean {
  const today = bundle.daily[0];
  if (!today || !today.date) return false;

  const key = ledgerCityKey(city);
  const records = snapshot.map[key];
  if (records?.some((r) => sameDate(r.date, today.date))) return false;

  const next = [...(records ?? []), { date: today.date, fHigh: today.tempMax, fLow: today.tempMin }]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-MAX_RECORDS_PER_CITY);

  snapshot = { map: { ...snapshot.map, [key]: next }, version: snapshot.version + 1 };
  pruneCities();
  persist();
  emit();
  return true;
}

/**
 * Fill measured actuals onto the stored record for the bundle's yesterday
 * (past_days=1 upstream). Returns true when a record was newly scored.
 */
export function scoreYesterday(city: City, bundle: WeatherBundle): boolean {
  const yesterday = bundle.yesterday;
  if (!yesterday || !yesterday.date) return false;

  const key = ledgerCityKey(city);
  const records = snapshot.map[key];
  const target = records?.find((r) => sameDate(r.date, yesterday.date));
  if (!target || target.aHigh !== undefined) return false;

  const next = records.map((r) =>
    r === target
      ? { ...r, aHigh: yesterday.tempMax, aLow: yesterday.tempMin }
      : r,
  );
  snapshot = { map: { ...snapshot.map, [key]: next }, version: snapshot.version + 1 };
  persist();
  emit();
  return true;
}

/** Scored-day count across every tracked city (achievement signal). */
export function ledgerScoredDayCount(): number {
  return Object.values(snapshot.map).reduce(
    (sum, records) => sum + records.filter((r) => r.aHigh !== undefined).length,
    0,
  );
}

/* ------------------------------------------------------------------ */
/* Stats for the card (pure reads off the snapshot)                     */
/* ------------------------------------------------------------------ */

/** Mean absolute error of a scored record's high/low pair (°C). */
export function recordErrorC(r: LedgerRecord): number {
  const high = Math.abs((r.aHigh ?? r.fHigh) - r.fHigh);
  const low = Math.abs((r.aLow ?? r.fLow) - r.fLow);
  return (high + low) / 2;
}

export function ledgerStatsForCity(city: City): LedgerStats {
  const records = [...(snapshot.map[ledgerCityKey(city)] ?? [])].sort((a, b) =>
    b.date.localeCompare(a.date),
  );
  const scored = records.filter((r) => r.aHigh !== undefined && r.aLow !== undefined);

  if (scored.length === 0) {
    return { records, scoredDays: 0, meanErrorC: null, withinTwoPct: null, cleanDays: 0, recent: [] };
  }

  const calls = scored.flatMap((r) => [
    Math.abs((r.aHigh ?? r.fHigh) - r.fHigh),
    Math.abs((r.aLow ?? r.fLow) - r.fLow),
  ]);
  const meanErrorC = calls.reduce((sum, e) => sum + e, 0) / calls.length;
  const within = calls.filter((e) => e <= NEAR_MISS_C).length;
  const cleanDays = scored.filter(
    (r) =>
      Math.abs((r.aHigh ?? r.fHigh) - r.fHigh) <= NEAR_MISS_C &&
      Math.abs((r.aLow ?? r.fLow) - r.fLow) <= NEAR_MISS_C,
  ).length;

  return {
    records,
    scoredDays: scored.length,
    meanErrorC,
    withinTwoPct: Math.round((within / calls.length) * 100),
    cleanDays,
    recent: scored.slice(0, 7),
  };
}
