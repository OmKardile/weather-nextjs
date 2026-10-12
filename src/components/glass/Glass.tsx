'use client';

import type { ElementType, HTMLAttributes } from 'react';
import './glass.css';

/* ================================================================== */
/* Glass — the CONTENT layer material (flat "Surface").                */
/*                                                                     */
/* iOS 27 two-layer rule: controls are LiquidGlass (<LiquidGlass>,     */
/* src/components/glass/LiquidGlass.tsx — lensing, rim light,          */
/* specular, press gel); content cards are THIS — flat, calm,          */
/* deliberately blurrier and flatter so controls pop above it. No      */
/* refraction, no specular, no glass-on-glass.                         */
/*                                                                     */
/* Legacy `specular` / `refract` props are accepted and ignored —      */
/* they belonged to the v2 frosted system; content never lenses.       */
/* ================================================================== */

type GlassLevel = 'base' | 'raised' | 'overlay';
type GlassTag = 'div' | 'section' | 'aside' | 'header' | 'nav' | 'footer' | 'article';

export interface GlassProps extends HTMLAttributes<HTMLDivElement> {
  /**
   * Elevation level:
   * - `base`    — cards (workhorse)
   * - `raised`  — one feature surface per view
   * - `overlay` — sheets / modals (command palette, settings, pickers)
   */
  level?: GlassLevel;
  /** Semantic element to render (default 'div'). */
  as?: GlassTag;
  /** @deprecated Content surfaces never carry pointer specular. */
  specular?: boolean;
  /** @deprecated Content surfaces never refract — controls only. */
  refract?: boolean;
}

export function Glass({
  level = 'base',
  as = 'div',
  className,
  children,
  ...rest
}: GlassProps) {
  const Component = as as ElementType;
  return (
    <Component className={`glass-2-${level} ${className ?? ''}`} {...rest}>
      {children}
    </Component>
  );
}
