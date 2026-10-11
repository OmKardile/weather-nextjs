'use client';

import { useEffect, useRef, useState } from 'react';
import type { SceneConfig } from '@/lib/scenes';
import { SceneCanvas } from './scene/SceneCanvas';
import { SceneLayers } from './scene/SceneLayers';
import './scene/scene.css';

/** Crossfade duration — must match the .scene-slot animation in scene.css. */
const CROSSFADE_MS = 600;
/**
 * Small buffer past the animation end so the outgoing layer is only
 * dropped once the incoming one is fully opaque (timer jitter safety).
 */
const DROP_DELAY_MS = CROSSFADE_MS + 80;

interface SceneSlot {
  id: number;
  scene: SceneConfig;
}

/**
 * Full-viewport, fixed, animated sky that reacts to weather condition ×
 * day phase. Scene changes crossfade: the previous scene stays rendered
 * while the new one fades in on top (600ms, expo-out), then the old
 * layer is dropped. The first mount fades in from opacity 0.
 */
export function WeatherScene({ scene }: { scene: SceneConfig }) {
  // At most [previous, current]; the previous slot is dropped after the
  // crossfade completes. Rapid scene changes simply replace the staled slot.
  const [slots, setSlots] = useState<SceneSlot[]>([{ id: 0, scene }]);
  const nextId = useRef(1);
  const seenKey = useRef(scene.key);
  const dropTimer = useRef<number | null>(null);

  useEffect(() => {
    if (scene.key === seenKey.current) return;
    seenKey.current = scene.key;

    const id = nextId.current;
    nextId.current += 1;
    setSlots((prev) => [...prev.slice(-1), { id, scene }]);

    if (dropTimer.current !== null) window.clearTimeout(dropTimer.current);
    dropTimer.current = window.setTimeout(() => {
      dropTimer.current = null;
      setSlots((prev) => prev.filter((slot) => slot.id === id));
    }, DROP_DELAY_MS);
  }, [scene]);

  useEffect(
    () => () => {
      if (dropTimer.current !== null) window.clearTimeout(dropTimer.current);
    },
    [],
  );

  return (
    <div aria-hidden="true" className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
      {slots.map((slot) => {
        const { layers, gradient } = slot.scene;
        const precipitation = layers.rain !== 'none' || layers.snow;
        return (
          <div key={slot.id} className="scene-slot">
            <div
              className="absolute inset-0"
              style={{
                background: `linear-gradient(180deg, ${gradient[0]} 0%, ${gradient[1]} 55%, ${gradient[2]} 100%)`,
              }}
            />
            <SceneLayers scene={slot.scene} />
            {precipitation ? (
              <SceneCanvas
                kind={layers.snow ? 'snow' : 'rain'}
                intensity={layers.rain === 'heavy' ? 'heavy' : 'light'}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
