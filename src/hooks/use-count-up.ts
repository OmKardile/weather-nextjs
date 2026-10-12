'use client';

import { useEffect, useRef, useState } from 'react';

/* ================================================================== */
/* useCountUp — animate an integer toward its target.                   */
/*                                                                     */
/* Rides a rAF loop with an ease-out cubic curve whenever the target   */
/* changes (city switch, refresh tick). First render and reduced-      */
/* motion users get the exact value immediately — no hydration drift,  */
/* no vestibular triggers. The "from" value tracks the last painted    */
/* frame so interrupted animations resume from where they stopped.    */
/* ================================================================== */

const DEFAULT_DURATION_MS = 650;

export function useCountUp(target: number, durationMs = DEFAULT_DURATION_MS): number {
  const [display, setDisplay] = useState(target);
  const fromRef = useRef(target);
  const rafRef = useRef(0);

  useEffect(() => {
    const from = fromRef.current;
    if (from === target) return undefined;

    // Respect prefers-reduced-motion — duration 0 makes the first rAF
    // tick land exactly on the target (setState stays in the async
    // callback, never synchronously in the effect body).
    const duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ? 0
      : durationMs;

    const start = performance.now();
    const tick = (now: number) => {
      const t = duration === 0 ? 1 : Math.min(1, (now - start) / duration);
      // easeOutCubic — fast start, gentle landing.
      const eased = 1 - Math.pow(1 - t, 3);
      const value = Math.round(from + (target - from) * eased);
      fromRef.current = value;
      setDisplay(value);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, durationMs]);

  return display;
}
