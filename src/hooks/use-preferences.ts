'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AiVoiceId } from '@/types/ai';
import { AI_VOICE_IDS } from '@/types/ai';
import {
  DEFAULT_SECTION_ORDER,
  normalizeHiddenSections,
  normalizeSectionOrder,
} from '@/lib/sections';
import type { SectionId } from '@/lib/sections';
import type { City, Units } from '@/types/weather';

const MAX_SAVED_CITIES = 8;

/** Daily-forecast horizon: 7 days by default, 16 when the user opts in. */
export type ForecastDays = 7 | 16;

/** Forecast-section spacing: roomy default vs tighter information density. */
export type Density = 'comfortable' | 'compact';

/** Liquid Glass transparency: 0 = ultra clear, 100 = fully tinted. */
export type GlassTransparency = number;

interface PreferencesState {
  units: Units;
  forecastDays: ForecastDays;
  /** AI persona — tone only, applied to briefing/chat/story/planner text. */
  aiVoice: AiVoiceId;
  /** Synthesized ambient sound — off by default, started by a user gesture. */
  ambientSoundEnabled: boolean;
  /** 0…1 master volume for the ambient engine. */
  ambientVolume: number;
  /** User's card order (ids from lib/sections). */
  sectionOrder: SectionId[];
  /** Hidden card ids (restoreable from Settings). */
  hiddenSections: SectionId[];
  /** Forecast-section spacing. */
  density: Density;
  /** Liquid Glass transparency 0–100 (0 ultra clear → 100 fully tinted). */
  glassTransparency: GlassTransparency;
  /** Reduce bright effects: no specular pointer highlight, no chromatic fringe. */
  reduceBrightEffects: boolean;
  savedCities: City[];
  lastCity: City | null;
  setUnits: (units: Units) => void;
  toggleUnits: () => void;
  setAiVoice: (voice: AiVoiceId) => void;
  setForecastDays: (days: ForecastDays) => void;
  setAmbientSoundEnabled: (enabled: boolean) => void;
  setAmbientVolume: (volume: number) => void;
  setSectionOrder: (order: SectionId[]) => void;
  toggleSectionHidden: (id: SectionId) => void;
  restoreAllSections: () => void;
  setDensity: (density: Density) => void;
  setGlassTransparency: (value: GlassTransparency) => void;
  setReduceBrightEffects: (enabled: boolean) => void;
  saveCity: (city: City) => void;
  removeCity: (id: number) => void;
  /** Reorder saved cities (new full order, e.g. from a drag-and-drop list). */
  reorderCities: (cities: City[]) => void;
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
      forecastDays: 7,
      aiVoice: 'pro',
      ambientSoundEnabled: false,
      ambientVolume: 0.5,
      sectionOrder: [...DEFAULT_SECTION_ORDER],
      hiddenSections: [],
      density: 'comfortable',
      glassTransparency: 0,
      reduceBrightEffects: false,
      savedCities: [],
      lastCity: null,

      setUnits: (units) => set({ units }),
      toggleUnits: () =>
        set((state) => ({ units: state.units === 'metric' ? 'imperial' : 'metric' })),

      setAiVoice: (voice) => set({ aiVoice: voice }),

      setForecastDays: (days) => set({ forecastDays: days }),

      setAmbientSoundEnabled: (enabled) => set({ ambientSoundEnabled: enabled }),

      setAmbientVolume: (volume) => set({ ambientVolume: Math.min(1, Math.max(0, volume)) }),

      setSectionOrder: (order) => set({ sectionOrder: normalizeSectionOrder(order) }),

      toggleSectionHidden: (id) =>
        set((state) => ({
          hiddenSections: state.hiddenSections.includes(id)
            ? state.hiddenSections.filter((section) => section !== id)
            : [...state.hiddenSections, id],
        })),

      restoreAllSections: () => set({ hiddenSections: [] }),

      setDensity: (density) => set({ density }),

      setGlassTransparency: (value) =>
        set({ glassTransparency: Math.round(Math.min(100, Math.max(0, value))) }),

      setReduceBrightEffects: (enabled) => set({ reduceBrightEffects: enabled }),

      saveCity: (city) =>
        set((state) =>
          state.savedCities.some((saved) => saved.id === city.id)
            ? state
            : { savedCities: [city, ...state.savedCities].slice(0, MAX_SAVED_CITIES) },
        ),

      removeCity: (id) =>
        set((state) => ({ savedCities: state.savedCities.filter((city) => city.id !== id) })),

      reorderCities: (cities) =>
        set((state) => {
          // Trust the input order only if it is a permutation of the current
          // saved set — never add or drop cities through the reorder path.
          const currentIds = new Set(state.savedCities.map((city) => city.id));
          const nextIds = new Set(cities.map((city) => city.id));
          if (currentIds.size !== nextIds.size) return state;
          for (const id of currentIds) if (!nextIds.has(id)) return state;
          return { savedCities: cities };
        }),

      isSaved: (id) => get().savedCities.some((city) => city.id === id),

      setLastCity: (city) => set({ lastCity: city }),
    }),
    { name: 'aether-preferences', version: 3, merge: (persisted, current) => ({
      ...current,
      ...((() => {
        // v3 dropped `theme` + `accent` (the interface now themes itself
        // from the live sky; the aurora accent is the brand). Strip the
        // retired keys so re-persisted state stays clean.
        const { theme: _theme, accent: _accent, ...rest } =
          (persisted as Record<string, unknown> | undefined) ?? {};
        return rest as Partial<PreferencesState>;
      })()),
      // New fields keep their defaults when upgrading from older persisted state.
      aiVoice: AI_VOICE_IDS.includes((persisted as { aiVoice?: AiVoiceId } | undefined)?.aiVoice as AiVoiceId)
        ? ((persisted as { aiVoice?: AiVoiceId }).aiVoice as AiVoiceId)
        : current.aiVoice,
      ambientSoundEnabled:
        (persisted as { ambientSoundEnabled?: boolean } | undefined)?.ambientSoundEnabled === true,
      ambientVolume: (() => {
        const value = (persisted as { ambientVolume?: number } | undefined)?.ambientVolume;
        return typeof value === 'number' && Number.isFinite(value)
          ? Math.min(1, Math.max(0.05, value))
          : current.ambientVolume;
      })(),
      sectionOrder: normalizeSectionOrder(
        (persisted as { sectionOrder?: unknown } | undefined)?.sectionOrder,
      ),
      hiddenSections: normalizeHiddenSections(
        (persisted as { hiddenSections?: unknown } | undefined)?.hiddenSections,
      ),
      density: (persisted as { density?: Density } | undefined)?.density === 'compact'
        ? 'compact'
        : 'comfortable',
      glassTransparency: (() => {
        const value = (persisted as { glassTransparency?: number } | undefined)?.glassTransparency;
        return typeof value === 'number' && Number.isFinite(value)
          ? Math.round(Math.min(100, Math.max(0, value)))
          : current.glassTransparency;
      })(),
      reduceBrightEffects:
        (persisted as { reduceBrightEffects?: boolean } | undefined)?.reduceBrightEffects === true,
    }) },
  ),
);
