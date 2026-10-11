'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import type { ElementType, HTMLAttributes } from 'react';
import { useSpecular } from '@/hooks/use-specular';
import './glass.css';

type GlassLevel = 'base' | 'raised' | 'overlay';
type GlassTag = 'div' | 'section' | 'aside' | 'header' | 'nav' | 'footer' | 'article';

export interface GlassProps extends HTMLAttributes<HTMLDivElement> {
  /**
   * Elevation level:
   * - `base`    — cards (workhorse; max ~6 backdrop layers per screen)
   * - `raised`  — one hero / feature surface per view
   * - `overlay` — command palette, dock, modals, dropdowns (near-opaque)
   */
  level?: GlassLevel;
  /** Semantic element to render (default 'div'). */
  as?: GlassTag;
  /** Pointer-following specular highlight (default true; auto-off on
   *  touch devices and under prefers-reduced-motion). */
  specular?: boolean;
  /** Chromium-only liquid refraction sheen — hero card + dock/nav only.
   *  Safari/Firefox silently fall back to plain glass. */
  refract?: boolean;
}

/* ------------------------------------------------------------------ */
/* Shared SVG filter defs (id="aether-refract") — single instance      */
/* ------------------------------------------------------------------ */
/* Rendered by exactly ONE refract Glass instance per page. A tiny     */
/* module-level coordinator assigns ownership; if the owner unmounts  */
/* while other refract instances remain, ownership is handed to the   */
/* next one so the filter never disappears while still referenced.    */

type DefsListener = (owner: boolean) => void;

const defsListeners = new Map<number, DefsListener>();
let nextDefsKey = 0;
let activeDefsOwner: number | null = null;

function broadcastDefsOwnership(): void {
  for (const [key, listener] of defsListeners) listener(activeDefsOwner === key);
}

function RefractDefs() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}
    >
      <defs>
        <filter id="aether-refract" x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="0.012 0.02" numOctaves="2" seed="7" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="14" xChannelSelector="R" yChannelSelector="G" />
          <feGaussianBlur stdDeviation="0.35" />
        </filter>
      </defs>
    </svg>
  );
}

/** Returns true when THIS instance should render the shared defs. */
function useRefractDefs(enabled: boolean): boolean {
  const [owner, setOwner] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    const key = ++nextDefsKey;
    defsListeners.set(key, setOwner);
    if (activeDefsOwner === null) activeDefsOwner = key;
    broadcastDefsOwnership();
    return () => {
      defsListeners.delete(key);
      if (activeDefsOwner === key) {
        const next = defsListeners.keys().next();
        activeDefsOwner = next.done ? null : next.value;
      }
      broadcastDefsOwnership();
    };
  }, [enabled]);

  return owner;
}

/* ------------------------------------------------------------------ */
/* Chromium detection — hydration-safe                                */
/* ------------------------------------------------------------------ */
/* SSR and the hydration render report `false` (matching server HTML),
/* then a post-hydration re-render applies the real value. Cached in a
/* module variable so useSyncExternalStore gets a stable snapshot.     */

interface NavigatorUAData {
  brands?: ReadonlyArray<{ brand: string; version: string }>;
}

let chromiumSnapshot: boolean | null = null;

function detectChromium(): boolean {
  const brands = (navigator as Navigator & { userAgentData?: NavigatorUAData })
    .userAgentData?.brands;
  return brands?.some((brand) => brand.brand === 'Chromium') ?? false;
}

function subscribeToNothing(): () => void {
  return () => {};
}

function useIsChromium(): boolean {
  return useSyncExternalStore(
    subscribeToNothing,
    () => (chromiumSnapshot ??= detectChromium()),
    () => false,
  );
}

/* ------------------------------------------------------------------ */
/* <Glass> primitive                                                   */
/* ------------------------------------------------------------------ */

export function Glass({
  level = 'base',
  as = 'div',
  specular = true,
  refract = false,
  className,
  children,
  ...rest
}: GlassProps) {
  const isChromium = useIsChromium();
  const ownsRefractDefs = useRefractDefs(refract && isChromium);
  const specularRef = useSpecular<HTMLElement>({ disabled: !specular });

  const Component = as as ElementType;

  const classes = [
    `glass-2-${level}`,
    refract ? 'glass-refract' : null,
    refract && isChromium ? 'refract-on' : null,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <Component {...rest} ref={specularRef} className={classes}>
      {refract && isChromium && ownsRefractDefs && <RefractDefs />}
      {children}
    </Component>
  );
}
