'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import type { City } from '@/types/weather';

export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

/**
 * Debounced city search against /api/geocode (Open-Meteo geocoding).
 * Keeps previous results while typing to avoid dropdown flicker.
 */
export function useCitySearch(query: string) {
  const trimmed = query.trim();
  const debounced = useDebouncedValue(trimmed, 300);
  const enabled = debounced.length >= 2;

  return useQuery<City[], Error>({
    queryKey: ['geocode', debounced.toLowerCase()],
    queryFn: async ({ signal }) => {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(debounced)}`, { signal });
      if (!res.ok) throw new Error('Search is unavailable right now.');
      return (await res.json()) as City[];
    },
    enabled,
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
    placeholderData: (previous) => previous,
  });
}
