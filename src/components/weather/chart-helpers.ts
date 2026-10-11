'use client';

import { useCallback, useEffect, useState } from 'react';
import type { RefCallback } from 'react';

/* ================================================================== */
/* chart-helpers — tiny shared toolkit for the hand-rolled SVG charts   */
/* (TemperatureChart, ModelCompare, metric dialogs, NextHourCard).      */
/* Extracted from TemperatureChart (Task 2-b) so every chart in the     */
/* app draws curves, measures itself and honours reduced motion the    */
/* exact same way.                                                     */
/* ================================================================== */

/** Aurora data hexes (mirror the @theme scale in globals.css). */
export const AURORA_300 = '#74DCC2';
export const AURORA_400 = '#45D1B3';
export const AURORA_500 = '#22BCA0';

export const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

/** 2-decimal precision for path/attr output. */
export const f = (v: number) => Math.round(v * 100) / 100;

export interface Pt {
  x: number;
  y: number;
}

/**
 * Catmull-Rom spline through every point, converted segment by segment
 * to cubic Béziers (control points at ±1/6 of the neighbour delta).
 * Endpoints use clamped phantoms, so the curve never leaves the point
 * hull's x-range. No dependencies.
 */
export function smoothPath(pts: Pt[]): string {
  if (pts.length < 2) return '';
  let d = `M ${f(pts[0].x)} ${f(pts[0].y)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    d +=
      ` C ${f(p1.x + (p2.x - p0.x) / 6)} ${f(p1.y + (p2.y - p0.y) / 6)}` +
      ` ${f(p2.x - (p3.x - p1.x) / 6)} ${f(p2.y - (p3.y - p1.y) / 6)}` +
      ` ${f(p2.x)} ${f(p2.y)}`;
  }
  return d;
}

/**
 * ResizeObserver-measured content width for a wrapper element.
 * Returns a [refCallback, width] pair — the callback-ref re-attaches the
 * observer whenever the element (re)mounts, so it keeps working for
 * components whose measured element only appears after data arrives
 * (e.g. charts behind a loading early-return). Width stays 0 until the
 * first observation (callers render a skeleton while below their minimum).
 */
export function useChartWidth<T extends HTMLElement>(): [RefCallback<T>, number] {
  const [width, setWidth] = useState(0);

  const setEl = useCallback<RefCallback<T>>((el) => {
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      setWidth(Math.round(entries[0]?.contentRect.width ?? 0));
    });
    ro.observe(el);
    // React 19 ref-cleanup: disconnect when this element unmounts.
    return () => ro.disconnect();
  }, []);

  return [setEl, width];
}

/**
 * Live prefers-reduced-motion watch. Returns true while motion is
 * ALLOWED (matches the TemperatureChart's original motionOk semantics).
 * The globals.css reduce override additionally flattens CSS animations.
 */
export function useMotionOk(): boolean {
  const [motionOk, setMotionOk] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setMotionOk(!mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  return motionOk;
}
