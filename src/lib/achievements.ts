import type { IconName } from '@/components/icons/Icon';

/* ================================================================== */
/* Achievements — light, localStorage-only badge system.               */
/* Pure definitions + a tiny observable store; the React observer      */
/* (hooks/use-achievements.ts) unlocks badges and toasts them.         */
/* Hydration-safe: localStorage is only ever read from effects.        */
/* ================================================================== */

export interface AchievementDef {
  id: string;
  title: string;
  description: string;
  /** Existing Icon glyph name. */
  icon: IconName;
}

export const ACHIEVEMENTS: readonly AchievementDef[] = [
  {
    id: 'first-storm',
    title: 'Storm chaser',
    description: 'Watched a thunderstorm roll in.',
    icon: 'thunder',
  },
  {
    id: 'five-cities',
    title: 'World traveler',
    description: 'Saved five cities for quick access.',
    icon: 'pin',
  },
  {
    id: 'week-streak',
    title: 'Seven skies',
    description: 'Opened Aether on seven different days.',
    icon: 'sunrise',
  },
  {
    id: 'night-owl',
    title: 'Night owl',
    description: 'Checked the weather between 2 and 4 am.',
    icon: 'moon',
  },
  {
    id: 'cartographer',
    title: 'Cartographer',
    description: 'Opened the weather map.',
    icon: 'map',
  },
  {
    id: 'stargazer',
    title: 'Stargazer',
    description: 'Viewed the sky section under a night sky.',
    icon: 'moon-phase',
  },
  {
    id: 'sharer',
    title: 'Sharer',
    description: 'Shared an Aether weather card.',
    icon: 'send',
  },
  {
    id: 'truth-seeker',
    title: 'Truth seeker',
    description: 'Scored five days of Aether forecasts against the measured sky.',
    icon: 'check',
  },
  {
    id: 'streak-3',
    title: 'Kindling',
    description: 'Opened Aether three days in a row.',
    icon: 'flame',
  },
  {
    id: 'city-explorer',
    title: 'Globe-trotter',
    description: 'Checked the weather in ten different cities.',
    icon: 'compare',
  },
  {
    id: 'fresh-air',
    title: 'Fresh air',
    description: 'Looked up the air on a genuinely clean day (AQI 20 or better).',
    icon: 'leaf',
  },
] as const;

export interface AchievementState {
  /** Unlocked achievement ids. */
  unlocked: string[];
  /** Distinct local days (YYYY-MM-DD) the app was opened — capped window. */
  days: string[];
  /** Distinct viewed city ids — powers the globe-trotter badge. */
  cities: number[];
}

const STORAGE_KEY = 'aether-achievements';
const MAX_TRACKED_DAYS = 60;
const MAX_TRACKED_CITIES = 60;

const EMPTY_STATE: AchievementState = { unlocked: [], days: [], cities: [] };

let state: AchievementState = EMPTY_STATE;
let hydrated = false;
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((listener) => listener());
}

function persist(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // storage full / private mode — badges are best-effort
  }
}

function localDayKey(date = new Date()): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/* ------------------------------------------------------------------ */
/* Observable store (useSyncExternalStore-compatible)                  */
/* ------------------------------------------------------------------ */

export function subscribeAchievements(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getAchievementSnapshot(): AchievementState {
  return state;
}

export function getAchievementServerSnapshot(): AchievementState {
  return EMPTY_STATE;
}

/**
 * Read localStorage + record today's visit. Called once from a mount
 * effect — never during render/SSR.
 */
export function hydrateAchievements(): void {
  if (hydrated || typeof window === 'undefined') return;
  hydrated = true;

  let next: AchievementState = EMPTY_STATE;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AchievementState>;
      const unlocked = Array.isArray(parsed.unlocked)
        ? parsed.unlocked.filter((id) =>
            ACHIEVEMENTS.some((achievement) => achievement.id === id),
          )
        : [];
      const days = Array.isArray(parsed.days)
        ? Array.from(new Set(parsed.days.filter((day) => typeof day === 'string')))
        : [];
      const cities = Array.isArray(parsed.cities)
        ? Array.from(
            new Set(
              parsed.cities.filter(
                (id): id is number => typeof id === 'number' && Number.isFinite(id),
              ),
            ),
          )
        : [];
      next = { unlocked, days, cities };
    }
  } catch {
    // corrupted payload — start fresh
  }

  const today = localDayKey();
  if (!next.days.includes(today)) {
    next = { ...next, days: [...next.days, today].slice(-MAX_TRACKED_DAYS) };
  }
  state = next;
  persist();
  emit();
}

/** Returns the definition when a NEW unlock happened, null otherwise. */
export function unlockAchievement(id: string): AchievementDef | null {
  const def = ACHIEVEMENTS.find((achievement) => achievement.id === id);
  if (!def || state.unlocked.includes(id)) return null;
  state = { ...state, unlocked: [...state.unlocked, id] };
  persist();
  emit();
  return def;
}

/** Distinct-day streak progress (for the badge shelf hint). */
export function achievementDayCount(): number {
  return state.days.length;
}

/** Records a viewed city id (globe-trotter tracking). No-op when known. */
export function recordCityView(id: number): void {
  if (!Number.isFinite(id) || state.cities.includes(id)) return;
  state = { ...state, cities: [...state.cities, id].slice(-MAX_TRACKED_CITIES) };
  persist();
  emit();
}

/* ------------------------------------------------------------------ */
/* Visit streaks — pure helpers over the day-key list so React can     */
/* derive them memoized from `days` without touching the store.        */
/* ------------------------------------------------------------------ */

/** 'YYYY-MM-DD' → absolute day number (local-frame, DST-safe). */
function dayNumber(key: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!m) return null;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / 86_400_000;
}

function todayNumber(): number {
  const now = new Date();
  return Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86_400_000;
}

/** Consecutive visit days ending today (or yesterday, once today lapses). */
export function streakFromDays(days: readonly string[]): number {
  const nums = new Set<number>();
  for (const key of days) {
    const n = dayNumber(key);
    if (n != null) nums.add(n);
  }
  if (nums.size === 0) return 0;
  let cursor = todayNumber();
  if (!nums.has(cursor)) cursor -= 1; // streak survived into yesterday
  let streak = 0;
  while (nums.has(cursor)) {
    streak += 1;
    cursor -= 1;
  }
  return streak;
}

/** Longest consecutive visit run in the tracked window. */
export function bestStreakFromDays(days: readonly string[]): number {
  const nums: number[] = [];
  for (const key of days) {
    const n = dayNumber(key);
    if (n != null) nums.push(n);
  }
  nums.sort((a, b) => a - b);
  let best = 0;
  let run = 0;
  for (let i = 0; i < nums.length; i += 1) {
    run = i > 0 && nums[i] === nums[i - 1] + 1 ? run + 1 : 1;
    if (run > best) best = run;
  }
  return best;
}
