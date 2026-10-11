'use client';

import { useQuery } from '@tanstack/react-query';
import type { City, EnsembleResponse } from '@/types/weather';

const roundCoord = (value: number) => Math.round(value * 1000) / 1000;

/**
 * Ensemble forecast (mean + member spread) for a city — powers the
 * confidence card and the uncertainty band on the temperature chart.
 * The query key is shared, so every consumer triggers a single fetch.
 */
export function useEnsemble(city: City | null) {
  const lat = roundCoord(city?.latitude ?? 0);
  const lon = roundCoord(city?.longitude ?? 0);

  return useQuery<EnsembleResponse, Error>({
    queryKey: ['ensemble', lat, lon],
    queryFn: async ({ signal }) => {
      const res = await fetch(`/api/ensemble?lat=${lat}&lon=${lon}`, { signal });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Request failed (${res.status})`);
      }
      return (await res.json()) as EnsembleResponse;
    },
    enabled: city != null,
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
    retry: 1,
    placeholderData: (previous) => previous,
  });
}
