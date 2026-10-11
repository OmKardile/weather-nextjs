'use client';

import { useQuery } from '@tanstack/react-query';
import { saveCachedBundle } from '@/lib/sections';
import type { City, WeatherBundle } from '@/types/weather';

const roundCoord = (value: number) => Math.round(value * 1000) / 1000;

/**
 * Weather bundle for a city (current + 24h + 7d + air quality).
 * Server caches Open-Meteo responses for 10 minutes; TanStack Query caches
 * per coordinates client-side so quick-switching saved cities is instant.
 */
export function useWeather(city: City | null) {
  const lat = roundCoord(city?.latitude ?? 0);
  const lon = roundCoord(city?.longitude ?? 0);

  return useQuery<WeatherBundle, Error>({
    queryKey: ['weather', lat, lon],
    queryFn: async ({ signal }) => {
      const res = await fetch(`/api/weather?lat=${lat}&lon=${lon}`, { signal });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Request failed (${res.status})`);
      }
      const bundle = (await res.json()) as WeatherBundle;
      // Offline cache (Task 20-b): persist the last successful bundle for
      // this city (≤5 cities, oldest pruned) so a failed reload can fall
      // back to it. Runs client-side only — queryFn never executes on SSR.
      if (city) saveCachedBundle(city, bundle);
      return bundle;
    },
    enabled: city != null,
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
    retry: 1,
    placeholderData: (previous) => previous,
  });
}
