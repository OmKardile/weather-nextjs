'use client';

import { useEffect } from 'react';
import { getAmbientEngine } from '@/lib/ambient-sound';
import { deriveAmbientScene } from '@/lib/sections';
import { usePreferences } from '@/hooks/use-preferences';
import type { Condition, DayPhase } from '@/types/weather';

/* ================================================================== */
/* useAmbientSound — mounts once in AetherApp; keeps the synthesized   */
/* engine in sync with the persisted preference + the live scene.      */
/* The toggle below is what MenuBar / Settings call — it starts the    */
/* AudioContext inside the click task (the gesture autoplay needs).    */
/* ================================================================== */

export function useAmbientSound(condition: Condition, phase: DayPhase): void {
  const enabled = usePreferences((state) => state.ambientSoundEnabled);
  const volume = usePreferences((state) => state.ambientVolume);

  const scene = deriveAmbientScene(condition, phase);

  // Enabled ⇄ engine lifecycle. If the preference survived a reload the
  // context may still be suspended — engine.start() arms a first-interaction
  // retry so audio resumes on the next tap.
  useEffect(() => {
    const engine = getAmbientEngine();
    if (enabled) engine.start();
    else engine.stop();
  }, [enabled]);

  useEffect(() => {
    getAmbientEngine().setVolume(volume);
  }, [volume]);

  useEffect(() => {
    getAmbientEngine().setScene(scene);
  }, [scene]);

  // Full teardown when the app unmounts (dev hot-reload safe).
  useEffect(() => () => getAmbientEngine().dispose(), []);
}

/**
 * Toggle ambient sound from any click handler. Starts/stops the engine
 * synchronously (user gesture) and persists the preference — the effect
 * above keeps engine and preference from drifting.
 */
export function toggleAmbientSound(): void {
  const { ambientSoundEnabled, setAmbientSoundEnabled } = usePreferences.getState();
  const next = !ambientSoundEnabled;
  const engine = getAmbientEngine();
  if (next) engine.start();
  else engine.stop();
  setAmbientSoundEnabled(next);
}
