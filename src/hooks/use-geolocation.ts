'use client';

import { useCallback, useState } from 'react';
import type { City } from '@/types/weather';

interface GeolocationState {
  status: 'idle' | 'locating';
}

export interface LocateResult {
  city: City | null;
  error: string | null;
}

function friendlyError(error: GeolocationPositionError): string {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return 'Location permission denied — search for a city instead.';
    case error.POSITION_UNAVAILABLE:
      return 'Your location could not be determined. Try searching instead.';
    case error.TIMEOUT:
      return 'Locating took too long. Please try again.';
    default:
      return 'Something went wrong while locating you.';
  }
}

/**
 * One-shot geolocation with a graceful, user-friendly fallback message.
 * Resolves with { city, error } so callers avoid stale state reads.
 */
export function useGeolocation() {
  const [state, setState] = useState<GeolocationState>({ status: 'idle' });

  const locate = useCallback((): Promise<LocateResult> => {
    return new Promise((resolve) => {
      if (typeof window === 'undefined' || !('geolocation' in navigator)) {
        resolve({
          city: null,
          error: 'Geolocation is not supported by your browser.',
        });
        return;
      }

      setState({ status: 'locating' });

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            const { latitude, longitude } = position.coords;
            const res = await fetch(`/api/geocode?lat=${latitude}&lon=${longitude}`);
            if (!res.ok) throw new Error('reverse geocode failed');
            const city = (await res.json()) as City;
            setState({ status: 'idle' });
            resolve({ city: { ...city, source: 'location' }, error: null });
          } catch {
            // Reverse geocoding failed — still usable, just unnamed.
            setState({ status: 'idle' });
            resolve({
              city: {
                id: 0,
                name: 'My location',
                country: '',
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                source: 'location',
              },
              error: null,
            });
          }
        },
        (error) => {
          setState({ status: 'idle' });
          resolve({ city: null, error: friendlyError(error) });
        },
        { enableHighAccuracy: false, timeout: 10_000, maximumAge: 5 * 60_000 },
      );
    });
  }, []);

  return { ...state, locate };
}
