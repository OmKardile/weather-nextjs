'use client';

import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';

import { Icon } from '@/components/icons/Icon';
import { toast } from '@/hooks/use-toast';
import {
  ACHIEVEMENTS,
  getAchievementServerSnapshot,
  getAchievementSnapshot,
  hydrateAchievements,
  recordCityView,
  streakFromDays,
  subscribeAchievements,
  unlockAchievement,
} from '@/lib/achievements';

/* ================================================================== */
/* Achievements — React bindings.                                      */
/*                                                                    */
/* useAchievements(): observable badge state for the Settings shelf    */
/* (hydration-safe: server snapshot is always empty; localStorage is  */
/* only read from the observer's mount effect).                       */
/*                                                                    */
/* useAchievementObserver({ condition, savedCount, mapOpen }): mount  */
/* once in AetherApp; unlocks badges as conditions change and toasts  */
/* each new unlock. Impulsive signals (sky section viewed at night,   */
/* share card used) arrive as window CustomEvents — 'aether:          */
/* achievement' with detail.kind — dispatched from where they're      */
/* cheap to detect (ForecastSections' IntersectionObserver on the     */
/* sky section, ShareCardButton on success).                          */
/* ================================================================== */

export function useAchievements() {
  return useSyncExternalStore(
    subscribeAchievements,
    getAchievementSnapshot,
    getAchievementServerSnapshot,
  );
}

interface ObserverInputs {
  /** Displayed scene condition (debug override aware). */
  condition: string;
  /** Number of saved cities. */
  savedCount: number;
  /** Whether the map overlay is open. */
  mapOpen: boolean;
  /** Id of the city whose weather is on screen (null on the welcome state). */
  cityId: number | null;
  /** European AQI of the displayed city (null when air data is missing). */
  aqi: number | null;
}

export function useAchievementObserver({
  condition,
  savedCount,
  mapOpen,
  cityId,
  aqi,
}: ObserverInputs): void {
  // Hydrate from localStorage exactly once, after mount.
  useEffect(() => {
    hydrateAchievements();
  }, []);

  // Globe-trotter tracking: distinct viewed cities (external-store write
  // from an effect — the observable pattern, never React setState).
  useEffect(() => {
    if (cityId != null) recordCityView(cityId);
  }, [cityId]);

  const tryUnlock = useCallback((id: string) => {
    const def = unlockAchievement(id);
    if (!def) return;
    // The toast title type intersects Radix's aria `title?: string`, so the
    // icon node rides along via a contained cast — the toaster renders
    // ReactNode titles just fine.
    const title = (
      <span className="flex items-center gap-2">
        <Icon name={def.icon} size={16} className="shrink-0 text-aurora-400" />
        <span>Badge unlocked — {def.title}</span>
      </span>
    ) as unknown as string;
    toast({ title, description: def.description });
  }, []);

  // first-storm: the thunder scene is displayed.
  useEffect(() => {
    if (condition === 'thunder') tryUnlock('first-storm');
  }, [condition, tryUnlock]);

  // five-cities.
  useEffect(() => {
    if (savedCount >= 5) tryUnlock('five-cities');
  }, [savedCount, tryUnlock]);

  // cartographer.
  useEffect(() => {
    if (mapOpen) tryUnlock('cartographer');
  }, [mapOpen, tryUnlock]);

  // fresh-air: the displayed city's air is genuinely clean (European AQI
  // ≤ 20 — the "good" band floor; 0 is a real reading, not missing data).
  useEffect(() => {
    if (aqi != null && aqi >= 0 && aqi <= 20) tryUnlock('fresh-air');
  }, [aqi, tryUnlock]);

  // night-owl: local clock between 2 and 4 am (checked at mount + hourly).
  useEffect(() => {
    const check = () => {
      const hour = new Date().getHours();
      if (hour >= 2 && hour < 4) tryUnlock('night-owl');
    };
    check();
    const timer = window.setInterval(check, 60 * 60_000);
    return () => window.clearInterval(timer);
  }, [tryUnlock]);

  // week-streak: distinct tracked days (hydrate adds today first).
  // streak-3: three CONSECUTIVE visit days (true streak, not distinct count).
  const { days, cities } = useAchievements();
  const visitStreak = useMemo(() => streakFromDays(days), [days]);
  useEffect(() => {
    if (days.length >= 7) tryUnlock('week-streak');
  }, [days.length, tryUnlock]);
  useEffect(() => {
    if (visitStreak >= 3) tryUnlock('streak-3');
  }, [visitStreak, tryUnlock]);
  useEffect(() => {
    if (cities.length >= 10) tryUnlock('city-explorer');
  }, [cities.length, tryUnlock]);

  // Impulsive signals: sky section viewed at night / share card used.
  useEffect(() => {
    const onSignal = (event: Event) => {
      const kind = (event as CustomEvent<{ kind?: string }>).detail?.kind;
      if (kind === 'sky-night') tryUnlock('stargazer');
      if (kind === 'share-card') tryUnlock('sharer');
      if (kind === 'ledger-scored') tryUnlock('truth-seeker');
    };
    window.addEventListener('aether:achievement', onSignal);
    return () => window.removeEventListener('aether:achievement', onSignal);
  }, [tryUnlock]);
}

export { ACHIEVEMENTS };
