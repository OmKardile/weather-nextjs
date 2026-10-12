'use client';

import { useEffect, useRef } from 'react';

import { getScene } from '@/lib/scenes';
import { formatTemp } from '@/lib/units';
import type { City, Units, WeatherBundle } from '@/types/weather';

/* ================================================================== */
/* useDynamicFavicon — the tab becomes a thermometer.                   */
/*                                                                     */
/* A 64px canvas favicon is redrawn from the live bundle: a vertical   */
/* gradient sampled from the app's own scene engine (so the tab        */
/* always matches the sky on screen) with the current temperature in   */
/* bold white. The document title mirrors it ("20° Clear sky · Tokyo   */
/* — Aether") so tabs and history read like a weather glance. Both     */
/* update only on real changes (temperature / condition / phase /      */
/* city / units), never on a refetch tick.                             */
/* ================================================================== */

const FAVICON_SIZE = 64;

function drawFavicon(gradient: readonly string[], tempText: string): string | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = FAVICON_SIZE;
  canvas.height = FAVICON_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // Rounded-square backdrop with the scene's gradient.
  const radius = 14;
  ctx.beginPath();
  ctx.moveTo(radius, 0);
  ctx.lineTo(FAVICON_SIZE - radius, 0);
  ctx.quadraticCurveTo(FAVICON_SIZE, 0, FAVICON_SIZE, radius);
  ctx.lineTo(FAVICON_SIZE, FAVICON_SIZE - radius);
  ctx.quadraticCurveTo(FAVICON_SIZE, FAVICON_SIZE, FAVICON_SIZE - radius, FAVICON_SIZE);
  ctx.lineTo(radius, FAVICON_SIZE);
  ctx.quadraticCurveTo(0, FAVICON_SIZE, 0, FAVICON_SIZE - radius);
  ctx.lineTo(0, radius);
  ctx.quadraticCurveTo(0, 0, radius, 0);
  ctx.closePath();
  ctx.clip();

  const fill = ctx.createLinearGradient(0, 0, 0, FAVICON_SIZE);
  fill.addColorStop(0, gradient[0]);
  fill.addColorStop(1, gradient[gradient.length - 1]);
  ctx.fillStyle = fill;
  ctx.fillRect(0, 0, FAVICON_SIZE, FAVICON_SIZE);

  // Subtle top highlight, echoing the glass inset language.
  const sheen = ctx.createLinearGradient(0, 0, 0, FAVICON_SIZE * 0.45);
  sheen.addColorStop(0, 'rgba(255,255,255,0.28)');
  sheen.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = sheen;
  ctx.fillRect(0, 0, FAVICON_SIZE, FAVICON_SIZE * 0.45);

  // Temperature text — scaled down for long strings (e.g. "100°", "−12°").
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const fontSize = tempText.length >= 4 ? 24 : tempText.length === 3 ? 27 : 30;
  ctx.font = `700 ${fontSize}px Inter, "Segoe UI", system-ui, sans-serif`;
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = 4;
  ctx.fillText(tempText, FAVICON_SIZE / 2, FAVICON_SIZE / 2 + 1);

  try {
    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
}

function upsertFaviconLink(href: string): void {
  let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  link.type = 'image/png';
  link.href = href;
}

interface DynamicFaviconInputs {
  bundle: WeatherBundle | null;
  city: City | null;
  units: Units;
}

const DEFAULT_TITLE = 'Aether — Weather, elevated.';

export function useDynamicFavicon({ bundle, city, units }: DynamicFaviconInputs): void {
  const temp = bundle?.current?.temperature;
  const condition = bundle?.current?.condition;
  const isDay = bundle?.current?.isDay;
  const cityName = city?.name;

  const desiredTitle =
    temp == null || !condition
      ? DEFAULT_TITLE
      : `${formatTemp(temp, units)} ${conditionLabel(condition)}${cityName ? ` · ${cityName}` : ''} — Aether`;

  // React can re-commit the static metadata <title> after late streamed
  // Suspense boundaries resolve — the observer keeps the live title
  // authoritative once the weather has spoken.
  const desiredRef = useRef(desiredTitle);

  useEffect(() => {
    desiredRef.current = desiredTitle;
    document.title = desiredTitle;
  }, [desiredTitle]);

  useEffect(() => {
    const titleEl = document.querySelector('title');
    if (!titleEl) return;
    const observer = new MutationObserver(() => {
      if (document.title !== desiredRef.current) {
        document.title = desiredRef.current;
      }
    });
    observer.observe(titleEl, { childList: true, characterData: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  // Favicon: scene-gradient backdrop + temperature (redrawn only on real
  // changes — temperature / condition / phase / city / units).
  useEffect(() => {
    if (temp == null || !condition) return;

    // Scene gradient keeps the tab in lockstep with the app's palette.
    const phase = isDay ? 'day' : 'night';
    const scene = getScene(condition, phase);
    const tempText = formatTemp(temp, units);
    const href = drawFavicon(scene.gradient, tempText);
    if (href) upsertFaviconLink(href);
  }, [temp, condition, isDay, units]);
}

function conditionLabel(condition: string): string {
  switch (condition) {
    case 'clear':
      return 'Clear';
    case 'partly-cloudy':
      return 'Partly cloudy';
    case 'cloudy':
      return 'Cloudy';
    case 'fog':
      return 'Fog';
    case 'drizzle':
      return 'Drizzle';
    case 'rain':
      return 'Rain';
    case 'snow':
      return 'Snow';
    case 'thunder':
      return 'Thunderstorm';
    default:
      return '';
  }
}
