'use client';

import { useQuery } from '@tanstack/react-query';
import type { Alert, City, FloodResponse, SpaceWeather } from '@/types/weather';

const roundCoord = (value: number) => Math.round(value * 1000) / 1000;

/**
 * Official-feed alerts for a city (NWS / MeteoAlarm / NDMA SACHET depending
 * on the country). The query refreshes together with the parent weather
 * bundle — `bundleFetchedAt` is part of the key, so every bundle refresh
 * revalidates alerts too (server caches each feed for 10 minutes).
 */
export function useOfficialAlerts(city: City | null, bundleFetchedAt?: string) {
  const lat = roundCoord(city?.latitude ?? 0);
  const lon = roundCoord(city?.longitude ?? 0);
  const country = city?.countryCode?.trim().toUpperCase() ?? '';
  const region = city?.admin1?.trim() ?? '';

  return useQuery<{ alerts: Alert[] }, Error>({
    queryKey: ['official-alerts', lat, lon, country, region, bundleFetchedAt ?? ''],
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams({ lat: String(lat), lon: String(lon), country });
      if (region) params.set('region', region);
      const res = await fetch(`/api/alerts?${params.toString()}`, { signal });
      if (!res.ok) throw new Error(`Alerts request failed (${res.status})`);
      return (await res.json()) as { alerts: Alert[] };
    },
    // No ISO country code → no official feed applies; computed alerts still work.
    enabled: city != null && country.length === 2,
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
    retry: 1,
    placeholderData: (previous) => previous,
  });
}

/**
 * River discharge (GloFAS via /api/flood) for the computed river-discharge
 * alert. Strictly optional — the route always answers 200 and the query
 * silently degrades to no data on failure.
 */
export function useFlood(city: City | null, bundleFetchedAt?: string) {
  const lat = roundCoord(city?.latitude ?? 0);
  const lon = roundCoord(city?.longitude ?? 0);

  return useQuery<FloodResponse, Error>({
    queryKey: ['flood', lat, lon, bundleFetchedAt ?? ''],
    queryFn: async ({ signal }) => {
      const res = await fetch(`/api/flood?lat=${lat}&lon=${lon}`, { signal });
      if (!res.ok) throw new Error(`Flood request failed (${res.status})`);
      return (await res.json()) as FloodResponse;
    },
    enabled: city != null,
    staleTime: 30 * 60_000,
    gcTime: 60 * 60_000,
    retry: 1,
    placeholderData: (previous) => previous,
  });
}

/**
 * Space weather (NOAA SWPC K-index via /api/space-weather) for the computed
 * aurora alert. Global — not city-dependent, but only fetched while an
 * alerts consumer is actually on screen.
 */
export function useSpaceWeather(enabled: boolean, bundleFetchedAt?: string) {
  return useQuery<SpaceWeather, Error>({
    queryKey: ['space-weather', bundleFetchedAt ?? ''],
    queryFn: async ({ signal }) => {
      const res = await fetch('/api/space-weather', { signal });
      if (!res.ok) throw new Error(`Space weather request failed (${res.status})`);
      const data = (await res.json()) as SpaceWeather | { error?: string };
      if (typeof (data as SpaceWeather).latestKp !== 'number') {
        throw new Error((data as { error?: string }).error ?? 'Space weather unavailable');
      }
      return data as SpaceWeather;
    },
    enabled,
    staleTime: 15 * 60_000,
    gcTime: 60 * 60_000,
    retry: 1,
    placeholderData: (previous) => previous,
  });
}
