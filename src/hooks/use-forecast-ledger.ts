'use client';

import { useEffect, useMemo, useSyncExternalStore } from 'react';

import {
  getLedgerServerSnapshot,
  getLedgerSnapshot,
  hydrateLedger,
  ledgerScoredDayCount,
  ledgerStatsForCity,
  pendingBackfillDates,
  recordTodaysForecast,
  scoreBackfill,
  scoreYesterday,
  subscribeLedger,
} from '@/lib/forecast-ledger';
import type { LedgerStats } from '@/lib/forecast-ledger';
import type { City, WeatherBundle } from '@/types/weather';

/* ================================================================== */
/* useForecastLedger — the store bindings for the Forecast log card.    */
/*                                                                     */
/* Mount effect hydrates localStorage once; the record effect treats   */
/* the ledger as the external system (records today's "morning call",  */
/* scores yesterday when the measured day arrives); the backfill       */
/* effect opportunistically grades older pending records through      */
/* /api/ledger-backfill (measured daily actuals) so a missed visit     */
/* never leaves a day ungraded. No setState-in-effect, no             */
/* localStorage reads during render.                                   */
/* ================================================================== */

/** Per-session backfill guard: one attempt per city. */
const backfilledCities = new Set<string>();

export function useForecastLedger(city: City, bundle: WeatherBundle): LedgerStats {
  const snapshot = useSyncExternalStore(
    subscribeLedger,
    getLedgerSnapshot,
    getLedgerServerSnapshot,
  );

  // Hydrate from localStorage exactly once, after mount.
  useEffect(() => {
    hydrateLedger();
  }, []);

  // External-system update: first successful fetch of the local day writes
  // the morning call; the measured yesterday scores any stored record.
  useEffect(() => {
    const scored = scoreYesterday(city, bundle);
    recordTodaysForecast(city, bundle);

    if (scored && ledgerScoredDayCount() >= 5) {
      // Achievement signal: the self-check log just scored another day.
      window.dispatchEvent(
        new CustomEvent('aether:achievement', { detail: { kind: 'ledger-scored' } }),
      );
    }
  }, [city, bundle.fetchedAt]);  

  // Backfill: grade pending records older than yesterday (once per city
  // per session, best-effort — failures just try again next session).
  useEffect(() => {
    const yesterday = bundle.yesterday?.date;
    if (!yesterday) return;
    const pending = pendingBackfillDates(city, yesterday);
    if (pending.length === 0) return;

    const guardKey = `${city.id}:${yesterday}`;
    if (backfilledCities.has(guardKey)) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/ledger-backfill?lat=${city.latitude}&lon=${city.longitude}`,
        );
        if (!res.ok) return;
        const data = (await res.json()) as {
          byDate?: Record<string, { max: number; min: number }>;
        };
        if (cancelled || !data.byDate) return;
        const scoredCount = scoreBackfill(city, data.byDate, yesterday);
        if (scoredCount > 0 && ledgerScoredDayCount() >= 5) {
          window.dispatchEvent(
            new CustomEvent('aether:achievement', { detail: { kind: 'ledger-scored' } }),
          );
        }
      } catch {
        // offline / upstream flake — the records stay pending
      } finally {
        if (!cancelled) backfilledCities.add(guardKey);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [city, bundle.yesterday?.date]);  

  return useMemo(
    () => ledgerStatsForCity(city),
    // version re-derives stats after every mutation; identity is per-version
    [city, snapshot.version],  
  );
}
