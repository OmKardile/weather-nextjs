'use client';

import { useEffect, useMemo, useSyncExternalStore } from 'react';

import {
  getLedgerServerSnapshot,
  getLedgerSnapshot,
  hydrateLedger,
  ledgerScoredDayCount,
  ledgerStatsForCity,
  recordTodaysForecast,
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
/* scores yesterday when the measured day arrives) — the observable   */
/* store emits and useSyncExternalStore re-renders the card. No        */
/* setState-in-effect, no localStorage reads during render.            */
/* ================================================================== */

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

  return useMemo(
    () => ledgerStatsForCity(city),
    // version re-derives stats after every mutation; identity is per-version
    [city, snapshot.version],  
  );
}
