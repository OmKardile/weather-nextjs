'use client';

import { useRef, useState } from 'react';
import { LogoMark } from '@/components/brand/Logo';
import { Icon } from '@/components/icons/Icon';
import { useToast } from '@/hooks/use-toast';
import { getScene } from '@/lib/scenes';
import type { SceneConfig } from '@/lib/scenes';
import { formatLocalDate, getDayPhase } from '@/lib/time';
import { compassPoint, formatTemp, formatWind } from '@/lib/units';
import { conditionLabel } from '@/lib/wmo';
import type { City, Units, WeatherBundle } from '@/types/weather';

/* ================================================================== */
/* ShareCardButton — renders the current weather to a 1080×1350 PNG    */
/* (social-friendly portrait) on an offscreen canvas and hands it to   */
/* navigator.share (files) or a download fallback + toast.             */
/*                                                                    */
/* Scene-tinted vertical gradient + soft grain, thin (300) system      */
/* sans temperature numeral, condition/city/local date, the Aether    */
/* wordmark + LogoMark (serialized from the live inline SVG via       */
/* XMLSerializer → blob URL → drawImage), and the open-meteo          */
/* attribution line. All values follow the user's units.              */
/* ================================================================== */

const CARD_W = 1080;
const CARD_H = 1350;
const PAD = 96;

type LetterspacedContext = CanvasRenderingContext2D & { letterSpacing?: string };

type ShareNavigator = {
  canShare?: (data: ShareData) => boolean;
};

/** Serialize the live LogoMark SVG into a rasterizable Image. */
async function serializeLogo(host: HTMLElement | null): Promise<HTMLImageElement | null> {
  const svg = host?.querySelector('svg');
  if (!svg) return null;
  try {
    const clone = svg.cloneNode(true) as SVGSVGElement;
    // Standalone SVG rasterizes at 300×150 without explicit dimensions —
    // pin the size so the blob Image scales predictably.
    clone.setAttribute('width', '128');
    clone.setAttribute('height', '128');
    const markup = new XMLSerializer().serializeToString(clone);
    const blob = new Blob([markup], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('logo decode failed'));
      image.src = url;
    });
    URL.revokeObjectURL(url);
    return image;
  } catch {
    return null;
  }
}

/** Soft film grain — a 180×180 low-alpha noise tile repeated over the card. */
function drawGrain(ctx: CanvasRenderingContext2D): void {
  const tile = document.createElement('canvas');
  tile.width = 180;
  tile.height = 180;
  const tileCtx = tile.getContext('2d');
  if (!tileCtx) return;
  const image = tileCtx.createImageData(180, 180);
  for (let i = 0; i < image.data.length; i += 4) {
    const value = Math.random() * 255;
    image.data[i] = value;
    image.data[i + 1] = value;
    image.data[i + 2] = value;
    image.data[i + 3] = 14 + Math.random() * 10;
  }
  tileCtx.putImageData(image, 0, 0);
  const pattern = ctx.createPattern(tile, 'repeat');
  if (!pattern) return;
  ctx.save();
  ctx.fillStyle = pattern;
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  ctx.restore();
}

function drawShareCard(
  ctx: CanvasRenderingContext2D,
  options: {
    city: City;
    data: WeatherBundle;
    units: Units;
    scene: SceneConfig;
    logo: HTMLImageElement | null;
  },
): void {
  const { city, data, units, scene, logo } = options;
  const today = data.daily[0];
  const ink = scene.surface === 'light' ? '#0E2A2E' : '#F2F7F5';
  const inkSecondary =
    scene.surface === 'light' ? 'rgba(14, 42, 46, 0.68)' : 'rgba(242, 247, 245, 0.74)';
  const inkFaint = scene.surface === 'light' ? 'rgba(14, 42, 46, 0.38)' : 'rgba(242, 247, 245, 0.4)';

  // Background — scene gradient with a soft glow behind the numeral.
  const gradient = ctx.createLinearGradient(0, 0, 0, CARD_H);
  gradient.addColorStop(0, scene.gradient[0]);
  gradient.addColorStop(0.55, scene.gradient[1]);
  gradient.addColorStop(1, scene.gradient[2]);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  const glow = ctx.createRadialGradient(CARD_W / 2, 620, 60, CARD_W / 2, 620, 560);
  glow.addColorStop(0, 'rgba(255, 255, 255, 0.16)');
  glow.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  drawGrain(ctx);

  ctx.textBaseline = 'alphabetic';

  // Header — LogoMark + wordmark.
  if (logo) ctx.drawImage(logo, PAD, PAD - 6, 96, 96);
  ctx.fillStyle = ink;
  ctx.font = '700 46px ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif';
  const spaced = ctx as LetterspacedContext;
  const prevSpacing = spaced.letterSpacing;
  if (spaced.letterSpacing !== undefined) spaced.letterSpacing = '10px';
  ctx.fillText('AETHER', PAD + 124, PAD + 58);
  const wordmarkWidth = ctx.measureText('AETHER').width;
  if (spaced.letterSpacing !== undefined) spaced.letterSpacing = prevSpacing ?? '0px';
  ctx.font = '400 27px ui-sans-serif, system-ui, -apple-system, sans-serif';
  ctx.fillStyle = inkSecondary;
  ctx.fillText('— weather, elevated.', PAD + 124 + wordmarkWidth + 26, PAD + 58);

  // Big temperature numeral (thin, like the hero's display style).
  ctx.fillStyle = ink;
  ctx.font = '300 300px ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif';
  ctx.fillText(formatTemp(data.current.temperature, units), PAD - 8, 780);

  // Condition + city + local date.
  ctx.font = '500 64px ui-sans-serif, system-ui, -apple-system, sans-serif';
  ctx.fillText(conditionLabel(data.current.weatherCode), PAD, 878);

  ctx.font = '400 38px ui-sans-serif, system-ui, -apple-system, sans-serif';
  ctx.fillStyle = inkSecondary;
  const locationLine = `${city.name}${city.country ? ` · ${city.country}` : ''}`;
  ctx.fillText(locationLine, PAD, 942);
  ctx.font = '400 30px ui-sans-serif, system-ui, -apple-system, sans-serif';
  ctx.fillStyle = inkFaint;
  ctx.fillText(`${formatLocalDate(data.utcOffsetSeconds)} · local time`, PAD, 992);

  // Stat chips row.
  const stats: Array<{ label: string; value: string }> = [
    {
      label: 'High · Low',
      value:
        today && `${formatTemp(today.tempMax, units)} / ${formatTemp(today.tempMin, units)}`,
    },
    {
      label: 'Wind',
      value: `${formatWind(data.current.windSpeed, units)} ${compassPoint(data.current.windDirection)}`,
    },
    {
      label: 'Precip chance',
      value: `${data.hourly[0]?.precipitationProbability ?? 0}%`,
    },
  ].filter((stat) => stat.value !== undefined) as Array<{ label: string; value: string }>;

  stats.forEach((stat, index) => {
    const x = PAD + index * 300;
    ctx.font = '600 22px ui-sans-serif, system-ui, -apple-system, sans-serif';
    ctx.fillStyle = inkFaint;
    ctx.fillText(stat.label.toUpperCase(), x, 1064);
    ctx.font = '600 40px ui-sans-serif, system-ui, -apple-system, sans-serif';
    ctx.fillStyle = ink;
    ctx.fillText(stat.value, x, 1116);
  });

  // Footer — hairline + attribution.
  ctx.strokeStyle = scene.surface === 'light' ? 'rgba(14, 42, 46, 0.22)' : 'rgba(242, 247, 245, 0.24)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(PAD, 1200);
  ctx.lineTo(CARD_W - PAD, 1200);
  ctx.stroke();

  ctx.font = '500 24px ui-sans-serif, system-ui, -apple-system, sans-serif';
  ctx.fillStyle = inkFaint;
  ctx.fillText('Data · open-meteo.com', PAD, 1252);
  const tagline = 'AETHER';
  if (spaced.letterSpacing !== undefined) spaced.letterSpacing = '8px';
  ctx.fillStyle = inkSecondary;
  const taglineWidth = ctx.measureText(tagline).width;
  ctx.fillText(tagline, CARD_W - PAD - taglineWidth, 1252);
  if (spaced.letterSpacing !== undefined) spaced.letterSpacing = prevSpacing ?? '0px';
}

interface ShareCardButtonProps {
  city: City;
  data: WeatherBundle;
  units: Units;
}

export function ShareCardButton({ city, data, units }: ShareCardButtonProps) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const logoHostRef = useRef<HTMLSpanElement>(null);

  const handleShare = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = CARD_W;
      canvas.height = CARD_H;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas unavailable');

      const today = data.daily[0];
      const phase = getDayPhase({
        isDay: data.current.isDay,
        sunrise: today?.sunrise ?? '',
        sunset: today?.sunset ?? '',
        utcOffsetSeconds: data.utcOffsetSeconds,
      });
      const scene = getScene(data.current.condition, phase);
      const logo = await serializeLogo(logoHostRef.current);
      drawShareCard(ctx, { city, data, units, scene, logo });

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/png'),
      );
      if (!blob) throw new Error('PNG export failed');

      // Sharer badge fires on a successful render, share-sheet or download.
      window.dispatchEvent(
        new CustomEvent('aether:achievement', { detail: { kind: 'share-card' } }),
      );

      const fileName = `aether-${city.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`;
      const file = new File([blob], fileName, { type: 'image/png' });
      const nav = navigator as Navigator & ShareNavigator;

      if (nav.canShare?.({ files: [file] })) {
        await nav.share({
          files: [file],
          title: `Aether — ${city.name}`,
          text: `${conditionLabel(data.current.weatherCode)} · ${formatTemp(data.current.temperature, units)} in ${city.name}`,
        });
        toast({
          title: 'Shared',
          description: 'The weather card was handed to your share sheet.',
        });
      } else {
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = fileName;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
        toast({
          title: 'Saved share card',
          description: 'PNG downloaded — share it anywhere.',
        });
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      toast({
        variant: 'destructive',
        title: 'Couldn’t render the card',
        description:
          error instanceof Error ? error.message : 'The canvas export failed. Try again.',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => void handleShare()}
        disabled={busy}
        aria-label={`Share weather card for ${city.name}`}
        title="Share card"
        className="glass-subtle focus-ring flex h-10 w-10 items-center justify-center rounded-full text-surface transition-all duration-250 hover:bg-[var(--surface-strong)] disabled:opacity-60"
      >
        {busy ? (
          <Icon name="refresh" size={18} className="animate-spin" />
        ) : (
          <Icon name="share" size={18} />
        )}
      </button>
      {/* Host for the live LogoMark — serialized to the canvas on share. */}
      <span ref={logoHostRef} aria-hidden="true" className="sr-only">
        <LogoMark />
      </span>
    </>
  );
}
