'use client';

import { useCallback, useEffect, useSyncExternalStore } from 'react';

import { Icon } from '@/components/icons/Icon';
import { toast } from '@/hooks/use-toast';
import {
  ACHIEVEMENTS,
  getAchievementServerSnapshot,
  getAchievementSnapshot,
  hydrateAchievements,
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
}

export function useAchievementObserver({
  condition,
  savedCount,
  mapOpen,
}: ObserverInputs): void {
  // Hydrate from localStorage exactly once, after mount.
  useEffect(() => {
    hydrateAchievements();
  }, []);

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
  const { days } = useAchievements();
  useEffect(() => {
    if (days.length >= 7) tryUnlock('week-streak');
  }, [days.length, tryUnlock]);

  // Impulsive signals: sky section viewed at night / share card used.
  useEffect(() => {
    const onSignal = (event: Event) => {
      const kind = (event as CustomEvent<{ kind?: string }>).detail?.kind;
      if (kind === 'sky-night') tryUnlock('stargazer');
      if (kind === 'share-card') tryUnlock('sharer');
    };
    window.addEventListener('aether:achievement', onSignal);
    return () => window.removeEventListener('aether:achievement', onSignal);
  }, [tryUnlock]);
}

export { ACHIEVEMENTS };
