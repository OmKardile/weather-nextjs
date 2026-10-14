'use client';

import { useMemo } from 'react';
import { computedAlerts, mergeAlerts } from '@/lib/computed-alerts';
import { useFlood, useOfficialAlerts, useSpaceWeather } from '@/hooks/use-official-alerts';
import type { Alert, City, WeatherBundle } from '@/types/weather';

export interface MergedAlerts {
  /** Severity-ranked merged list (official feeds + Aether-computed, deduped). */
  alerts: Alert[];
  /** Top severity among active alerts — null while the list is empty. */
  topSeverity: Alert['severity'] | null;
  /** True only during the very first fetch with nothing computed to show yet. */
  isLoading: boolean;
}

/**
 * The ONE place the merged alert list is assembled. OfficialAlerts renders
 * it as banners; the mobile dock's Today badge counts it. TanStack Query
 * dedupes the underlying queries by key — N consumers, one fetch.
 */
export function useMergedAlerts(city: City | null, bundle: WeatherBundle | null): MergedAlerts {
  const officialQuery = useOfficialAlerts(city, bundle?.fetchedAt);
  const floodQuery = useFlood(city, bundle?.fetchedAt);
  const spaceQuery = useSpaceWeather(bundle != null, bundle?.fetchedAt);

  const computed = useMemo(
    () => (bundle ? computedAlerts(bundle, floodQuery.data, spaceQuery.data) : []),
    [bundle, floodQuery.data, spaceQuery.data],
  );

  const alerts = useMemo(
    () => mergeAlerts(officialQuery.data?.alerts ?? [], computed),
    [officialQuery.data, computed],
  );

  return {
    alerts,
    topSeverity: alerts[0]?.severity ?? null,
    isLoading: officialQuery.data == null && officialQuery.isFetching && computed.length === 0,
  };
}
