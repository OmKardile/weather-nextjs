'use client';

import { useEffect } from 'react';

/* ================================================================== */
/* useTiltGlow — device-tilt ambient highlight for Liquid Glass.        */
/*                                                                     */
/* The last piece of the iOS 27 recipe: on devices with a motion sensor */
/* the specular light on glass controls drifts with the physical tilt   */
/* of the device (like a light source fixed in the room).              */
/*                                                                     */
/* · Writes --tilt-x / --tilt-y (−1…1) and --tilt-on (1) on            */
/*   <html>; the .lg::after specular layer uses them as the position    */
/*   fallback when no pointer has lit the element — pointer always      */
/*   wins. All animation is CSS repaint, no layout, rAF-throttled.     */
/* · iOS 13+ gates DeviceOrientationEvent behind requestPermission()   */
/*   which must run inside a user gesture — call requestTiltPermission */
/*   from the Settings switch handler, then enable the pref.           */
/* · Never active under prefers-reduced-motion or Reduce bright        */
/*   effects (.lg-calm / reduced-motion CSS kill the layer anyway).    */
/* ================================================================== */

const MAX_DEGREES = 45;

const clamp = (value: number): number => Math.min(1, Math.max(-1, value));

/** True when the platform can deliver deviceorientation at all. */
export function tiltGlowSupported(): boolean {
  return typeof window !== 'undefined' && typeof window.DeviceOrientationEvent !== 'undefined';
}

/**
 * Request motion-sensor permission (iOS 13+). MUST be called from a user
 * gesture (the switch click). Returns whether orientation events may flow.
 */
export async function requestTiltPermission(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  const ctor = window.DeviceOrientationEvent as unknown as {
    requestPermission?: () => Promise<'granted' | 'denied'>;
  };
  if (typeof ctor?.requestPermission !== 'function') return true; // no gate on this platform
  try {
    return (await ctor.requestPermission()) === 'granted';
  } catch {
    return false;
  }
}

/** Normalize a deviceorientation reading into the CSS custom properties. */
function writeTilt(gamma: number, beta: number): void {
  const root = document.documentElement;
  // Portrait-neutral held at ~45° beta; gamma is left/right. Clamped so the
  // highlight never runs off the control.
  root.style.setProperty('--tilt-x', clamp(gamma / MAX_DEGREES).toFixed(3));
  root.style.setProperty('--tilt-y', clamp((beta - 45) / MAX_DEGREES).toFixed(3));
}

/**
 * Mount once at the app root. `enabled` comes from the persisted pref; the
 * effect attaches/detaches the sensor listener and manages the root vars.
 */
export function useTiltGlow(enabled: boolean): void {
  useEffect(() => {
    if (!enabled || !tiltGlowSupported()) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let frame = 0;
    let latest: { gamma: number; beta: number } | null = null;

    const onOrientation = (event: DeviceOrientationEvent) => {
      if (event.gamma == null || event.beta == null) return;
      latest = { gamma: event.gamma, beta: event.beta };
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        if (latest) writeTilt(latest.gamma, latest.beta);
      });
    };

    window.addEventListener('deviceorientation', onOrientation, { passive: true });
    document.documentElement.style.setProperty('--tilt-on', '1');

    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener('deviceorientation', onOrientation);
      const root = document.documentElement;
      root.style.removeProperty('--tilt-on');
      root.style.removeProperty('--tilt-x');
      root.style.removeProperty('--tilt-y');
    };
  }, [enabled]);
}
