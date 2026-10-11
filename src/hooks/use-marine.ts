'use client';

import { useQuery } from '@tanstack/react-query';
import type { City, MarineResponse } from '@/types/weather';

const roundCoord = (value: number) => Math.round(value * 1000) / 1000;

/**
 * Marine conditions (wave height / direction / period) for a city.
 * Inland coordinates answer `{ available: false }` — callers hide the
 * card in that case. 60-minute refresh matches the nearshore grid.
 */
export function useMarine(city: City | null) {
  const lat = roundCoord(city?.latitude ?? 0);
  const lon = roundCoord(city?.longitude ?? 0);

  return useQuery<MarineResponse, Error>({
    queryKey: ['marine', lat, lon],
    queryFn: async ({ signal }) => {
      const res = await fetch(`/api/marine?lat=${lat}&lon=${lon}`, { signal });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Request failed (${res.status})`);
      }
      return (await res.json()) as MarineResponse;
    },
    enabled: city != null,
    staleTime: 60 * 60_000,
    gcTime: 90 * 60_000,
    retry: 1,
    placeholderData: (previous) => previous,
  });
}
