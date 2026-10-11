'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { City, Units } from '@/types/weather';

const MAX_SAVED_CITIES = 8;

interface PreferencesState {
  units: Units;
  savedCities: City[];
  lastCity: City | null;
  setUnits: (units: Units) => void;
  toggleUnits: () => void;
  saveCity: (city: City) => void;
  removeCity: (id: number) => void;
  isSaved: (id: number) => boolean;
  setLastCity: (city: City | null) => void;
}

/**
 * Persisted preferences (localStorage): units, saved cities, last city.
 * Zustand persist rehydrates synchronously on the client; the app gates
 * persisted-derived UI behind a mounted flag to avoid hydration mismatch.
 */
export const usePreferences = create<PreferencesState>()(
  persist(
    (set, get) => ({
      units: 'metric',
      savedCities: [],
      lastCity: null,

      setUnits: (units) => set({ units }),
      toggleUnits: () =>
        set((state) => ({ units: state.units === 'metric' ? 'imperial' : 'metric' })),

      saveCity: (city) =>
        set((state) =>
          state.savedCities.some((saved) => saved.id === city.id)
            ? state
            : { savedCities: [city, ...state.savedCities].slice(0, MAX_SAVED_CITIES) },
        ),

      removeCity: (id) =>
        set((state) => ({ savedCities: state.savedCities.filter((city) => city.id !== id) })),

      isSaved: (id) => get().savedCities.some((city) => city.id === id),

      setLastCity: (city) => set({ lastCity: city }),
    }),
    { name: 'aether-preferences', version: 1 },
  ),
);
