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
] as const;

export interface AchievementState {
  /** Unlocked achievement ids. */
  unlocked: string[];
  /** Distinct local days (YYYY-MM-DD) the app was opened — capped window. */
  days: string[];
}

const STORAGE_KEY = 'aether-achievements';
const MAX_TRACKED_DAYS = 60;

const EMPTY_STATE: AchievementState = { unlocked: [], days: [] };

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
      next = { unlocked, days };
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
