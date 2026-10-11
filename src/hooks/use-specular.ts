'use client';

import { useCallback } from 'react';
import type { RefCallback } from 'react';

/**
 * Pointer-following specular light for Liquid Glass surfaces.
 *
 * Attach the returned ref callback to a glass element; it writes
 * `--spec-x` / `--spec-y` (pointer position in px, relative to the element)
 * and toggles `--spec-active` (1 while the pointer is over the element,
 * back to 0 ~600ms after it leaves) so the CSS specular layer can fade.
 *
 * - rAF-throttled, passive `pointermove` (no React re-renders — the hook
 *   only touches `el.style` custom properties).
 * - Only active on hover-capable, fine-pointer devices and never under
 *   `prefers-reduced-motion` (both media queries are watched live).
 * - Cleanup on unmount / when `disabled` flips.
 */
export interface UseSpecularOptions {
  /** Disable the effect entirely (static chrome, reduced-motion gates, …). */
  disabled?: boolean;
}

const SPEC_DEACTIVATE_DELAY = 600;

export function useSpecular<T extends HTMLElement>(
  options?: UseSpecularOptions,
): RefCallback<T> {
  const disabled = options?.disabled === true;

  return useCallback(
    (el: T | null): (() => void) | void => {
      if (!el || disabled) return;

      let frame = 0;
      let deactivateTimer: ReturnType<typeof setTimeout> | undefined;
      let attached = false;

      const hoverQuery = window.matchMedia('(hover: hover) and (pointer: fine)');
      const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

      const deactivate = () => {
        el.style.setProperty('--spec-active', '0');
      };

      const onPointerMove = (event: PointerEvent) => {
        // Touch pointers must not light the glass (they have no hover state).
        if (event.pointerType !== 'mouse') return;
        if (frame) return;
        const { clientX, clientY } = event;
        frame = requestAnimationFrame(() => {
          frame = 0;
          const rect = el.getBoundingClientRect();
          el.style.setProperty('--spec-x', `${Math.round(clientX - rect.left)}px`);
          el.style.setProperty('--spec-y', `${Math.round(clientY - rect.top)}px`);
          el.style.setProperty('--spec-active', '1');
          if (deactivateTimer !== undefined) {
            clearTimeout(deactivateTimer);
            deactivateTimer = undefined;
          }
        });
      };

      const onPointerLeave = () => {
        if (deactivateTimer !== undefined) return;
        deactivateTimer = setTimeout(() => {
          deactivateTimer = undefined;
          deactivate();
        }, SPEC_DEACTIVATE_DELAY);
      };

      const detach = () => {
        el.removeEventListener('pointermove', onPointerMove);
        el.removeEventListener('pointerleave', onPointerLeave);
        attached = false;
      };

      // Re-evaluate capability whenever either media query flips (live).
      const sync = () => {
        const capable = hoverQuery.matches && !motionQuery.matches;
        if (capable && !attached) {
          el.addEventListener('pointermove', onPointerMove, { passive: true });
          el.addEventListener('pointerleave', onPointerLeave);
          attached = true;
        } else if (!capable && attached) {
          if (frame) cancelAnimationFrame(frame);
          if (deactivateTimer !== undefined) {
            clearTimeout(deactivateTimer);
            deactivateTimer = undefined;
          }
          detach();
          deactivate();
        }
      };

      hoverQuery.addEventListener('change', sync);
      motionQuery.addEventListener('change', sync);
      sync();

      return () => {
        if (frame) cancelAnimationFrame(frame);
        if (deactivateTimer !== undefined) clearTimeout(deactivateTimer);
        detach();
        hoverQuery.removeEventListener('change', sync);
        motionQuery.removeEventListener('change', sync);
        deactivate();
      };
    },
    [disabled],
  );
}
