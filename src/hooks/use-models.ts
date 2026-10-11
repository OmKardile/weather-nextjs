'use client';

import { useQuery } from '@tanstack/react-query';
import type { City, ModelsResponse } from '@/types/weather';

const roundCoord = (value: number) => Math.round(value * 1000) / 1000;

/**
 * Multi-model comparison (ECMWF / GFS / ICON) for a city.
 * Server caches Open-Meteo responses for 10 minutes; TanStack Query shares
 * the result per coordinates (the same key used by the chart band etc).
 */
export function useModels(city: City | null) {
  const lat = roundCoord(city?.latitude ?? 0);
  const lon = roundCoord(city?.longitude ?? 0);

  return useQuery<ModelsResponse, Error>({
    queryKey: ['models', lat, lon],
    queryFn: async ({ signal }) => {
      const res = await fetch(`/api/models?lat=${lat}&lon=${lon}`, { signal });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Request failed (${res.status})`);
      }
      return (await res.json()) as ModelsResponse;
    },
    enabled: city != null,
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
    retry: 1,
    placeholderData: (previous) => previous,
  });
}
