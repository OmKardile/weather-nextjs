'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties, ElementType, HTMLAttributes, ReactNode } from 'react';
import { useSyncExternalStore } from 'react';
import { useSpecular } from '@/hooks/use-specular';
import { usePreferences } from '@/hooks/use-preferences';
import {
  acquireRefractionFilter,
  acquireRefractionSlot,
  isChromium,
  releaseRefractionSlot,
} from '@/lib/liquid';
import { cn } from '@/lib/utils';

/* ================================================================== */
/* LiquidGlass — the CONTROL layer (iOS 27 recipe).                     */
/*                                                                     */
/* Two layers only in the whole system: LiquidGlass for controls        */
/* (top bar cluster, dock, segmented controls, sheet grabber, map       */
/* controls, floating buttons), flat Surface material for content       */
/* cards (the <Glass> primitive). Never glass-on-glass.                 */
/*                                                                     */
/* Anatomy (4 stacked layers):                                         */
/*  a) backdrop — Chromium: url(#refraction-filter) blur(2px)          */
/*     saturate(1.7) brightness(1.05); others: blur(18px) saturate(1.8) */
/*  b) tint — scene-luminance-aware fill (dark: .05–.10, light: .18–.28 */
/*     + .04 black), scaled by the transparency slider                 */
/*  c) edge + light — 1px opposing-corner rim (bright TL/BR, faint      */
/*     TR/BL), inset top highlight, inner hairline, soft inner glow;    */
/*     pointer-following specular blob (desktop, rAF, reduced-motion    */
/*     aware, off with Reduce bright effects)                          */
/*  d) shadow — 0 10px 30px rgb(0 0 0/.20) + 0 2px 6px rgb(0 0 0/.12)   */
/*                                                                     */
/* Interaction: press → scale .96 + brighten (gel flex), release        */
/* springs back with a small overshoot. All CSS — no JS on the hot      */
/* path.                                                               */
/* ================================================================== */

export type LiquidGlassVariant = 'regular' | 'clear';

type LiquidGlassTag = 'div' | 'nav' | 'button' | 'span' | 'header' | 'footer' | 'aside';

export interface LiquidGlassProps extends HTMLAttributes<HTMLElement> {
  /** `regular` everywhere; `clear` only over the full-screen map. */
  variant?: LiquidGlassVariant;
  /** Semantic element (default 'div'). */
  as?: LiquidGlassTag;
  /** Pointer specular (default true; auto-off for touch, reduced motion,
   *  and when Reduce bright effects is on). */
  specular?: boolean;
  /** Opt into the Chromium refraction filter (≤3 live on screen:
   *  dock, top-bar cluster, drawer grabber). */
  refract?: boolean;
  /** Press "gel" interaction (scale + brighten). Default true. */
  press?: boolean;
  /** Button attributes (when as="button"). */
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
  /** Morph key — elements sharing a layoutId animate as one (segmented
   *  control capsules). */
  children?: ReactNode;
}

/* ------------------------------------------------------------------ */
/* Shared client state                                                 */
/* ------------------------------------------------------------------ */

const subscribeNoop = () => () => {};

function useIsChromium(): boolean {
  return useSyncExternalStore(
    subscribeNoop,
    () => isChromium(),
    () => false,
  );
}

function usePrefersReducedTransparency(): boolean {
  return useSyncExternalStore(
    subscribeNoop,
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-transparency: reduce)').matches,
    () => false,
  );
}

/**
 * Effective transparency 0–100: the slider value, forced to 100 under
 * prefers-reduced-transparency.
 */
export function useGlassTransparency(): number {
  const slider = usePreferences((state) => state.glassTransparency);
  const reduced = usePrefersReducedTransparency();
  return reduced ? 100 : slider;
}

/* ------------------------------------------------------------------ */
/* <GlassProvider> — CSS variable pipeline for the whole material       */
/* ------------------------------------------------------------------ */

/**
 * Computes and injects the --lg-* custom properties that every
 * LiquidGlass + Surface element reads (tint alpha, blur radius,
 * refraction strength, rim brightness). Rendered once at the app root.
 */
export function useLiquidGlassVars(): CSSProperties {
  const t = useGlassTransparency() / 100;
  // Slider: Ultra Clear (0) → Fully Tinted (100)
  // tint .04 → .55 · blur 2 → 28 px · refraction 1.0 → 0.25 · rim 1 → 0.35
  return {
    // Liquid Glass (control layer)
    '--lg-tint-a': (0.04 + t * 0.51).toFixed(3),
    '--lg-blur': `${(2 + t * 26).toFixed(1)}px`,
    '--lg-refract': (1 - t * 0.75).toFixed(3),
    '--lg-rim': (1 - t * 0.65).toFixed(3),
    // Surface (content layer) — flatter, follows the same slider
    '--surface-tint-a': (0.08 + t * 0.32).toFixed(3),
  } as CSSProperties;
}

/* ------------------------------------------------------------------ */
/* <LiquidGlass>                                                       */
/* ------------------------------------------------------------------ */

export function LiquidGlass({
  variant = 'regular',
  as = 'div',
  specular = true,
  refract = false,
  press = true,
  className,
  children,
  style,
  ...rest
}: LiquidGlassProps) {
  const isChromiumClient = useIsChromium();
  const reduceBright = usePreferences((state) => state.reduceBrightEffects);
  const transparency = useGlassTransparency();
  // Refraction only makes sense when the glass is clear-ish (spec:
  // fully tinted = no refraction) and never under reduced transparency.
  const refractionEnabled =
    refract && isChromiumClient && transparency < 100 && !reduceBright;

  const rootRef = useRef<HTMLElement | null>(null);
  const [filterId, setFilterId] = useState<string | null>(null);
  const specularRef = useSpecular<HTMLElement>({
    disabled: !specular || reduceBright,
  });

  // Refraction filter lifecycle: reserve one of the ≤3 slots, measure,
  // acquire the (w,h,radius)-cached filter, regenerate on resize.
  // filterId is only APPLIED while refractionEnabled — flipping the
  // setting off releases the filter (cleanup) and the style guard below
  // drops the url() so the CSS blur fallback takes over.
  useLayoutEffect(() => {
    if (!refractionEnabled) return;
    const el = rootRef.current;
    if (!el) return;

    let handle: ReturnType<typeof acquireRefractionFilter> | null = null;
    let slot: string | null = null;
    let observer: ResizeObserver | undefined;
    let raf = 0;

    const sync = () => {
      raf = 0;
      if (!slot) slot = acquireRefractionSlot();
      if (!slot) {
        setFilterId(null);
        return;
      }
      const rect = el.getBoundingClientRect();
      if (rect.width < 4 || rect.height < 4) return;
      const value = getComputedStyle(el).borderTopLeftRadius;
      const px = Number.parseFloat(value);
      const radius = Number.isFinite(px) ? px : 999;
      handle?.release();
      handle = acquireRefractionFilter(
        rect.width,
        rect.height,
        Math.min(radius, Math.min(rect.width, rect.height) / 2),
        1 - transparency / 133, // refraction strength 1.0 → 0.25 with the slider
      );
      setFilterId(handle?.id ?? null);
    };

    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(sync);
    };

    observer = new ResizeObserver(schedule);
    observer.observe(el);
    schedule();

    return () => {
      if (raf) cancelAnimationFrame(raf);
      observer?.disconnect();
      handle?.release();
      releaseRefractionSlot(slot);
    };
    // transparency changes regenerate through strength — cheap (cached)
  }, [refractionEnabled, transparency]);

  const Component = as as ElementType;

  const backdropStyle: CSSProperties =
    refractionEnabled && filterId != null
      ? {
          '--lg-backdrop': `url(#${filterId}) blur(2px) saturate(1.7) brightness(1.05)`,
        } as CSSProperties
      : {};

  return (
    <Component
      {...rest}
      ref={(node: HTMLElement | null) => {
        rootRef.current = node;
        return specularRef(node);
      }}
      data-lg-variant={variant}
      className={cn(
        'lg',
        press && 'lg-press',
        variant === 'clear' && 'lg-clear',
        reduceBright && 'lg-calm',
        className,
      )}
      style={{ ...backdropStyle, ...style }}
    >
      {children}
    </Component>
  );
}
