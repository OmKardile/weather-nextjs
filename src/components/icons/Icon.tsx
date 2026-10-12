'use client';

import { useEffect, useId, useRef } from 'react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import './icons.css';

/* ================================================================== */
/* Aether unified icon system                                          */
/*                                                                    */
/* One component, two bespoke sets:                                   */
/*  • Weather glyphs — 64×64, filled, multi-layer, gradient-lit,      */
/*    softly animated (transform/opacity only).                       */
/*  • UI icons — 24×24, currentColor strokes, round caps/joins.       */
/*                                                                    */
/* All gradient / mask / clip ids are namespaced with React useId()   */
/* so dozens of icons can share a page (hourly strip) without         */
/* collisions. Animations are gated on the root `.ic-anim` class;     */
/* a shared IntersectionObserver pauses off-screen icons.             */
/* ================================================================== */

export type WeatherIconName =
  | 'sun'
  | 'moon'
  | 'partly-cloudy-day'
  | 'partly-cloudy-night'
  | 'cloudy'
  | 'fog'
  | 'drizzle'
  | 'rain'
  | 'thunder'
  | 'snow'
  | 'wind'
  | 'hail';

export type UiIconName =
  | 'search'
  | 'pin'
  | 'gear'
  | 'plus'
  | 'check'
  | 'x'
  | 'chevron-up'
  | 'chevron-down'
  | 'chevron-left'
  | 'chevron-right'
  | 'sparkle'
  | 'droplet'
  | 'thermometer'
  | 'eye'
  | 'gauge'
  | 'sunrise'
  | 'sunset'
  | 'bookmark'
  | 'send'
  | 'stop'
  | 'refresh'
  | 'locate'
  | 'command'
  | 'info'
  | 'alert'
  | 'moon-phase'
  | 'map'
  | 'layers'
  | 'play'
  | 'pause'
  | 'radar'
  | 'satellite'
  | 'volume'
  | 'grip'
  | 'share'
  | 'compare';

export type IconName = WeatherIconName | UiIconName;

export interface IconProps {
  /** Glyph to render. */
  name: IconName;
  /** Pixel size (square). Default 24. */
  size?: number;
  /** Enable looping weather animations / hover effects. Default true. */
  animated?: boolean;
  className?: string;
  /** Stroke width for UI (stroke) icons. Default 2. */
  strokeWidth?: number;
}

const WEATHER_NAMES: ReadonlySet<string> = new Set<WeatherIconName>([
  'sun',
  'moon',
  'partly-cloudy-day',
  'partly-cloudy-night',
  'cloudy',
  'fog',
  'drizzle',
  'rain',
  'thunder',
  'snow',
  'wind',
  'hail',
]);

/* ------------------------------------------------------------------ */
/* Visibility gating — ONE IntersectionObserver shared by every icon.  */
/* Leaving the viewport adds `.icon-paused` to the root <svg>.         */
/* Ancient browsers without IntersectionObserver simply never pause.  */
/* ------------------------------------------------------------------ */

let iconVisibilityObserver: IntersectionObserver | null | undefined;

function getIconVisibilityObserver(): IntersectionObserver | null {
  if (iconVisibilityObserver !== undefined) return iconVisibilityObserver;
  if (typeof window === 'undefined' || typeof IntersectionObserver === 'undefined') {
    iconVisibilityObserver = null;
    return null;
  }
  iconVisibilityObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        entry.target.classList.toggle('icon-paused', !entry.isIntersecting);
      }
    },
    { rootMargin: '32px 0px' },
  );
  return iconVisibilityObserver;
}

/* ------------------------------------------------------------------ */
/* Palette — on-brand teal / sage / amber (no default blue/indigo)     */
/* ------------------------------------------------------------------ */

const PAL = {
  sunCore: ['#FFF6E8', '#FFE3AE', '#F0954A'],
  ray: '#FFD9A0',
  moon: ['#F7FBF9', '#C9E4DC'],
  crater: '#C4DBD3',
  cloudDay: ['#EEF6F2', '#D6E6E0', '#B9CFC9'],
  cloudNight: ['#D5E4E0', '#BCCFCB', '#9FB5B0'],
  cloudShadeDay: '#91A7A2',
  cloudShadeNight: '#7E938F',
  drop: ['#8FD4C6', '#4E9C8F'],
  bolt: ['#FFE08A', '#F0954A'],
  flake: ['#FDFEFE', '#D9EAE7'],
  fogBand: '#DFE9E5',
  hail: ['#FDFEFE', '#E8F4F1'],
} as const;

const RAY_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];

/* ------------------------------------------------------------------ */
/* Weather glyph building blocks                                       */
/* ------------------------------------------------------------------ */

/** Cloud silhouette — union of puffs + a flat-bottom bar. Rendered as
 *  one seamless fill because the gradient uses userSpaceOnUse coords. */
const CLOUD_PARTS = (
  <>
    <circle cx="21.5" cy="38.3" r="8.9" />
    <circle cx="32" cy="29" r="11.6" />
    <circle cx="42.8" cy="36.8" r="8.5" />
    <rect x="20.5" y="37" width="23.5" height="10.2" rx="5.1" />
  </>
);

function CloudBody({ id, variant }: { id: string; variant: 'day' | 'night' }) {
  const stops = variant === 'day' ? PAL.cloudDay : PAL.cloudNight;
  const shade = variant === 'day' ? PAL.cloudShadeDay : PAL.cloudShadeNight;
  return (
    <>
      <defs>
        <linearGradient id={`${id}-cl`} gradientUnits="userSpaceOnUse" x1="32" y1="17" x2="32" y2="48">
          <stop offset="0" stopColor={stops[0]} />
          <stop offset="0.55" stopColor={stops[1]} />
          <stop offset="1" stopColor={stops[2]} />
        </linearGradient>
        <radialGradient id={`${id}-clh`} cx="0.5" cy="0.42" r="0.62">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.5" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        <clipPath id={`${id}-cc`}>{CLOUD_PARTS}</clipPath>
      </defs>
      {/* main body */}
      <g fill={`url(#${id}-cl)`}>{CLOUD_PARTS}</g>
      {/* inner top-left highlight + darker underside, clipped to the body */}
      <g clipPath={`url(#${id}-cc)`}>
        <ellipse
          cx="28.5"
          cy="25"
          rx="13"
          ry="7"
          fill={`url(#${id}-clh)`}
          opacity="0.85"
          transform="rotate(-14 28.5 25)"
        />
        <ellipse cx="33" cy="46.5" rx="18" ry="5.2" fill={shade} opacity="0.32" />
      </g>
    </>
  );
}

/** Soft radial ground shadow — the "sits in space" depth layer. */
function GroundShadow({
  id,
  cx = 32,
  cy = 53,
  rx = 16.5,
  ry = 3.4,
  opacity = 0.16,
}: {
  id: string;
  cx?: number;
  cy?: number;
  rx?: number;
  ry?: number;
  opacity?: number;
}) {
  return (
    <>
      <defs>
        <radialGradient id={`${id}-gs`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#0A1B1E" stopOpacity={opacity} />
          <stop offset="1" stopColor="#0A1B1E" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={`url(#${id}-gs)`} />
    </>
  );
}

/** Candy sun — radial-lit core, rotating rays, warm aura. */
function SunGlyph({
  id,
  cx,
  cy,
  r,
  rays = true,
}: {
  id: string;
  cx: number;
  cy: number;
  r: number;
  rays?: boolean;
}) {
  const rIn = r * 1.5;
  const rOut = r * 2.1;
  return (
    <>
      <defs>
        <radialGradient id={`${id}-sc`} cx="0.36" cy="0.32" r="0.85">
          <stop offset="0" stopColor={PAL.sunCore[0]} />
          <stop offset="0.42" stopColor={PAL.sunCore[1]} />
          <stop offset="1" stopColor={PAL.sunCore[2]} />
        </radialGradient>
        <radialGradient id={`${id}-sg`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#F0954A" stopOpacity="0.22" />
          <stop offset="0.72" stopColor="#F0954A" stopOpacity="0.08" />
          <stop offset="1" stopColor="#F0954A" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${id}-sh`} cx="0.5" cy="0.38" r="0.62">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.65" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* warm aura */}
      <circle cx={cx} cy={cy} r={r * 2.5} fill={`url(#${id}-sg)`} />
      {rays && (
        <g className="ic-sun-rays" stroke={PAL.ray} strokeWidth={r * 0.3} strokeLinecap="round">
          {RAY_ANGLES.map((deg) => {
            const rad = (deg * Math.PI) / 180;
            const cos = Math.cos(rad);
            const sin = Math.sin(rad);
            return (
              <line
                key={deg}
                x1={cx + cos * rIn}
                y1={cy + sin * rIn}
                x2={cx + cos * rOut}
                y2={cy + sin * rOut}
              />
            );
          })}
        </g>
      )}
      <g className="ic-sun-core">
        <circle cx={cx} cy={cy} r={r} fill={`url(#${id}-sc)`} />
        <ellipse
          cx={cx - r * 0.3}
          cy={cy - r * 0.34}
          rx={r * 0.42}
          ry={r * 0.3}
          fill={`url(#${id}-sh)`}
          transform={`rotate(-18 ${cx - r * 0.3} ${cy - r * 0.34})`}
        />
      </g>
    </>
  );
}

/** Crescent moon — masked cut for a fat Apple-style crescent, craters,
 *  soft glow, gentle float; optional twinkling companion stars. */
function MoonGlyph({
  id,
  cx,
  cy,
  r,
  stars = false,
}: {
  id: string;
  cx: number;
  cy: number;
  r: number;
  stars?: boolean;
}) {
  const cut = { x: cx + r * 0.6, y: cy - r * 0.52, r: r * 0.92 };
  return (
    <>
      <defs>
        <linearGradient
          id={`${id}-mg`}
          gradientUnits="userSpaceOnUse"
          x1={cx - r}
          y1={cy - r}
          x2={cx + r * 0.4}
          y2={cy + r}
        >
          <stop offset="0" stopColor={PAL.moon[0]} />
          <stop offset="1" stopColor={PAL.moon[1]} />
        </linearGradient>
        <radialGradient id={`${id}-mgl`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#C9E4DC" stopOpacity="0.2" />
          <stop offset="1" stopColor="#C9E4DC" stopOpacity="0" />
        </radialGradient>
        <mask id={`${id}-mm`}>
          <rect x={cx - r - 2} y={cy - r - 2} width={r * 2 + 4} height={r * 2 + 4} fill="#ffffff" />
          <circle cx={cut.x} cy={cut.y} r={cut.r} fill="#000000" />
        </mask>
        <radialGradient id={`${id}-mh`} cx="0.5" cy="0.38" r="0.65">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.55" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* cool aura */}
      <circle cx={cx} cy={cy} r={r * 2.15} fill={`url(#${id}-mgl)`} />
      <g className="ic-moon-float">
        <g mask={`url(#${id}-mm)`}>
          <circle cx={cx} cy={cy} r={r} fill={`url(#${id}-mg)`} />
          <ellipse
            cx={cx - r * 0.42}
            cy={cy - r * 0.26}
            rx={r * 0.36}
            ry={r * 0.25}
            fill={`url(#${id}-mh)`}
            transform={`rotate(-20 ${cx - r * 0.42} ${cy - r * 0.26})`}
          />
          <g fill={PAL.crater}>
            <circle cx={cx - r * 0.4} cy={cy + r * 0.2} r={r * 0.115} opacity="0.5" />
            <circle cx={cx - r * 0.06} cy={cy + r * 0.54} r={r * 0.08} opacity="0.45" />
            <circle cx={cx - r * 0.52} cy={cy - r * 0.18} r={r * 0.07} opacity="0.4" />
          </g>
        </g>
      </g>
      {stars && (
        <g fill={PAL.moon[0]}>
          <circle className="ic-star-a" cx="50.5" cy="15.5" r="1.3" />
          <circle className="ic-star-b" cx="55" cy="24.5" r="0.85" />
        </g>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Weather glyphs (composition)                                        */
/* ------------------------------------------------------------------ */

function PartlyCloudyGlyph({ id, night }: { id: string; night: boolean }) {
  return (
    <>
      <GroundShadow id={id} cy={52} rx={15} />
      {night ? (
        /* small moon (~70%) peeking out up-right, floating */
        <g transform="translate(14 -9.5)">
          <MoonGlyph id={id} cx={30.5} cy={29} r={8.6} />
        </g>
      ) : (
        /* small sun (~70%) peeking out up-right */
        <SunGlyph id={id} cx={43} cy={21.5} r={8} />
      )}
      <g transform="translate(-0.5 3) scale(0.92)">
        <g className="ic-drift">
          <CloudBody id={id} variant={night ? 'night' : 'day'} />
        </g>
      </g>
    </>
  );
}

function CloudyGlyph({ id }: { id: string }) {
  return (
    <>
      <GroundShadow id={id} cy={52.5} />
      {/* back layer — smaller, higher, drifting the other way */}
      <g transform="translate(21.5 -4.5) scale(0.58)">
        <g className="ic-drift-back">
          <CloudBody id={`${id}b`} variant="day" />
        </g>
      </g>
      {/* front layer */}
      <g transform="translate(-0.8 3.2) scale(0.97)">
        <g className="ic-drift-front">
          <CloudBody id={id} variant="day" />
        </g>
      </g>
    </>
  );
}

function FogGlyph({ id }: { id: string }) {
  const bands = [
    { x: 18, w: 27, y: 42, h: 4.6, o: 0.95, cls: 'ic-fog-1' },
    { x: 23, w: 20, y: 48.5, h: 4.2, o: 0.8, cls: 'ic-fog-2' },
    { x: 20, w: 24, y: 54.5, h: 3.9, o: 0.65, cls: 'ic-fog-3' },
  ];
  return (
    <>
      <GroundShadow id={id} cy={61} rx={17} ry={2.6} opacity={0.1} />
      <g transform="translate(1 -7) scale(0.94)">
        <CloudBody id={id} variant="day" />
      </g>
      {bands.map((b) => (
        <rect
          key={b.cls}
          className={b.cls}
          x={b.x}
          y={b.y}
          width={b.w}
          height={b.h}
          rx={b.h / 2}
          fill={PAL.fogBand}
          opacity={b.o}
        />
      ))}
    </>
  );
}

function RainGlyph({ id, kind }: { id: string; kind: 'rain' | 'drizzle' }) {
  const rain = kind === 'rain';
  const drops = rain
    ? [
        { x: 24.5, d: '' },
        { x: 32, d: 'ic-delay-2' },
        { x: 39.5, d: 'ic-delay-3' },
      ]
    : [
        { x: 21.5, d: '' },
        { x: 28.2, d: 'ic-delay-2' },
        { x: 34.9, d: 'ic-delay-3' },
        { x: 41.6, d: 'ic-delay-4' },
      ];
  const w = rain ? 3 : 2.2;
  const h = rain ? 8.5 : 6.5;
  const y = rain ? 42 : 43.5;
  const cls = rain ? 'ic-rain-drop' : 'ic-drizzle-drop';
  return (
    <>
      <GroundShadow id={id} cy={53} rx={15.5} />
      <defs>
        <linearGradient id={`${id}-rd`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={PAL.drop[0]} />
          <stop offset="1" stopColor={PAL.drop[1]} />
        </linearGradient>
      </defs>
      <g transform={rain ? 'translate(0 -4.5)' : 'translate(0 -3.5)'}>
        <CloudBody id={id} variant="day" />
      </g>
      {drops.map((drop) => (
        <rect
          key={drop.x}
          className={cn(cls, drop.d)}
          x={drop.x - w / 2}
          y={y}
          width={w}
          height={h}
          rx={w / 2}
          fill={`url(#${id}-rd)`}
        />
      ))}
    </>
  );
}

const BOLT_D =
  'M33 39.5 L40 39.5 L35.6 47.4 L40 47.4 L28.2 59 L32.8 50 L28.6 50 Z';

function ThunderGlyph({ id }: { id: string }) {
  return (
    <>
      <GroundShadow id={id} cy={53.5} rx={15.5} />
      <defs>
        <linearGradient id={`${id}-bo`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={PAL.bolt[0]} />
          <stop offset="1" stopColor={PAL.bolt[1]} />
        </linearGradient>
        <radialGradient id={`${id}-bog`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#FFE08A" stopOpacity="0.55" />
          <stop offset="1" stopColor="#FFE08A" stopOpacity="0" />
        </radialGradient>
      </defs>
      <g transform="translate(0 -7) scale(0.98)">
        <g className="ic-cloud-shake">
          <CloudBody id={id} variant="day" />
        </g>
      </g>
      {/* flash glow + hot core, both synced with the cloud shake */}
      <ellipse className="ic-bolt-flash" cx="34.5" cy="48" rx="13" ry="11" fill={`url(#${id}-bog)`} />
      <path d={BOLT_D} fill={`url(#${id}-bo)`} opacity="0.95" />
      <path className="ic-bolt-flash" d={BOLT_D} fill="#FFF6E8" />
    </>
  );
}

function SnowGlyph({ id }: { id: string }) {
  const flakes = [
    { x: 23.5, y: 47.5, d: '' },
    { x: 32.5, y: 50.5, d: 'ic-delay-2' },
    { x: 41.5, y: 47.5, d: 'ic-delay-3' },
  ];
  return (
    <>
      <GroundShadow id={id} cy={54} rx={15.5} />
      <defs>
        <linearGradient id={`${id}-fl`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={PAL.flake[0]} />
          <stop offset="1" stopColor={PAL.flake[1]} />
        </linearGradient>
      </defs>
      <g transform="translate(0 -4.5)">
        <CloudBody id={id} variant="day" />
      </g>
      {flakes.map((f) => (
        <g key={f.x} transform={`translate(${f.x} ${f.y})`}>
          <g className={cn('ic-flake', f.d)}>
            <path
              d="M-3.9 0H3.9M-1.95 -3.38L1.95 3.38M-1.95 3.38L1.95 -3.38"
              stroke={`url(#${id}-fl)`}
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </g>
        </g>
      ))}
    </>
  );
}

const WIND_LINES = [
  { d: 'M16 26 H35 A6 6 0 1 0 29 20', w: 4, c: '#E9F2EF', o: 1, cls: '' },
  { d: 'M13 36 H41 A5 5 0 1 1 36 41', w: 4, c: '#DCE9E4', o: 0.9, cls: 'ic-delay-2' },
  { d: 'M18 48 H36 A4.5 4.5 0 1 0 31.5 43.5', w: 3.6, c: '#CFE0DA', o: 0.8, cls: 'ic-delay-3' },
];

function WindGlyph() {
  return (
    <g fill="none" strokeLinecap="round">
      {WIND_LINES.map((l) => (
        <g key={l.d}>
          {/* faint constant underlay keeps the glyph legible between gusts */}
          <path d={l.d} stroke={l.c} strokeWidth={l.w} opacity={l.o * 0.28} />
          <path
            d={l.d}
            stroke={l.c}
            strokeWidth={l.w}
            opacity={l.o}
            pathLength={100}
            className={cn('ic-wind-sweep', l.cls)}
          />
        </g>
      ))}
    </g>
  );
}

function HailGlyph({ id }: { id: string }) {
  const stones = [
    { x: 21.5, d: '' },
    { x: 28.8, d: 'ic-delay-2' },
    { x: 36.1, d: 'ic-delay-3' },
    { x: 43.4, d: 'ic-delay-4' },
  ];
  return (
    <>
      <GroundShadow id={id} cy={55} rx={15} />
      <defs>
        <radialGradient id={`${id}-ha`} cx="0.35" cy="0.3" r="0.85">
          <stop offset="0" stopColor={PAL.hail[0]} />
          <stop offset="1" stopColor={PAL.hail[1]} />
        </radialGradient>
      </defs>
      <g transform="translate(0 -5.5) scale(0.97)">
        <CloudBody id={id} variant="day" />
      </g>
      {stones.map((s) => (
        <circle
          key={s.x}
          className={cn('ic-hail', s.d)}
          cx={s.x}
          cy={45}
          r={2.4}
          fill={`url(#${id}-ha)`}
        />
      ))}
    </>
  );
}

const WEATHER_GLYPHS: Record<WeatherIconName, (id: string) => ReactNode> = {
  sun: (id) => <SunGlyph id={id} cx={32} cy={32} r={11.5} />,
  moon: (id) => <MoonGlyph id={id} cx={32} cy={31.5} r={12.5} stars />,
  'partly-cloudy-day': (id) => <PartlyCloudyGlyph id={id} night={false} />,
  'partly-cloudy-night': (id) => <PartlyCloudyGlyph id={id} night />,
  cloudy: (id) => <CloudyGlyph id={id} />,
  fog: (id) => <FogGlyph id={id} />,
  drizzle: (id) => <RainGlyph id={id} kind="drizzle" />,
  rain: (id) => <RainGlyph id={id} kind="rain" />,
  thunder: (id) => <ThunderGlyph id={id} />,
  snow: (id) => <SnowGlyph id={id} />,
  wind: () => <WindGlyph />,
  hail: (id) => <HailGlyph id={id} />,
};

/* ------------------------------------------------------------------ */
/* UI icons — 24×24, currentColor, round caps/joins                    */
/* ------------------------------------------------------------------ */

const PIN_D = 'M12 21.5C9.8 19.7 4.8 15.6 4.8 10.1a7.2 7.2 0 0 1 14.4 0c0 5.5-5 9.6-7.2 11.4z';
const GEAR_D =
  'M19.17 13.62 L21.26 14.88 A9.7 9.7 0 0 1 20.59 16.51 L18.21 15.93 A7.35 7.35 0 0 1 15.93 18.21 L16.51 20.59 A9.7 9.7 0 0 1 14.88 21.26 L13.62 19.17 A7.35 7.35 0 0 1 10.38 19.17 L9.12 21.26 A9.7 9.7 0 0 1 7.49 20.59 L8.07 18.21 A7.35 7.35 0 0 1 5.79 15.93 L3.41 16.51 A9.7 9.7 0 0 1 2.74 14.88 L4.83 13.62 A7.35 7.35 0 0 1 4.83 10.38 L2.74 9.12 A9.7 9.7 0 0 1 3.41 7.49 L5.79 8.07 A7.35 7.35 0 0 1 8.07 5.79 L7.49 3.41 A9.7 9.7 0 0 1 9.12 2.74 L10.38 4.83 A7.35 7.35 0 0 1 13.62 4.83 L14.88 2.74 A9.7 9.7 0 0 1 16.51 3.41 L15.93 5.79 A7.35 7.35 0 0 1 18.21 8.07 L20.59 7.49 A9.7 9.7 0 0 1 21.26 9.12 L19.17 10.38 A7.35 7.35 0 0 1 19.17 13.62 Z';
const SPARKLE_D =
  'M12 2.8C12.5 7 14.5 9.3 19.2 12C14.5 14.7 12.5 17 12 21.2C11.5 17 9.5 14.7 4.8 12C9.5 9.3 11.5 7 12 2.8Z';

function strokeProps(sw: number) {
  return {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: sw,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
}

const UI_GLYPHS: Record<UiIconName, (args: { id: string; sw: number }) => ReactNode> = {
  search: ({ sw }) => (
    <g {...strokeProps(sw)}>
      <circle cx="11" cy="11" r="7" />
      <path d="M16.2 16.2 21 21" />
    </g>
  ),
  pin: ({ sw }) => (
    <g {...strokeProps(sw)}>
      <path className="ic-pin-ring" d={PIN_D} />
      <path d={PIN_D} />
      <circle cx="12" cy="10" r="2.6" />
    </g>
  ),
  gear: ({ sw }) => (
    <g {...strokeProps(sw)}>
      <path className="ic-gear" d={GEAR_D} />
      <circle cx="12" cy="12" r="3.1" />
    </g>
  ),
  plus: ({ sw }) => (
    <g {...strokeProps(sw)}>
      <path d="M12 5v14M5 12h14" />
    </g>
  ),
  check: ({ sw }) => (
    <g {...strokeProps(sw)}>
      <path className="ic-check-draw" pathLength={100} d="M5 12.5l4.5 4.5L19 7.5" />
    </g>
  ),
  x: ({ sw }) => (
    <g {...strokeProps(sw)}>
      <path d="M6 6l12 12M18 6 6 18" />
    </g>
  ),
  'chevron-up': ({ sw }) => (
    <g {...strokeProps(sw)}>
      <path d="M6 14.5l6-6 6 6" />
    </g>
  ),
  'chevron-down': ({ sw }) => (
    <g {...strokeProps(sw)}>
      <path d="M6 9.5l6 6 6-6" />
    </g>
  ),
  'chevron-left': ({ sw }) => (
    <g {...strokeProps(sw)}>
      <path d="M14.5 6l-6 6 6 6" />
    </g>
  ),
  'chevron-right': ({ sw }) => (
    <g {...strokeProps(sw)}>
      <path d="M9.5 6l6 6-6 6" />
    </g>
  ),
  sparkle: ({ id, sw }) => (
    <g>
      <defs>
        <clipPath id={`${id}-spc`}>
          <path d={SPARKLE_D} />
        </clipPath>
        <linearGradient id={`${id}-sph`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="0.5" stopColor="#ffffff" stopOpacity="0.55" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <g className="ic-sparkle">
        <path
          d={SPARKLE_D}
          fill="currentColor"
          stroke="currentColor"
          strokeWidth={sw * 0.6}
          strokeLinejoin="round"
        />
        <rect
          className="ic-shimmer"
          x="-13"
          y="0"
          width="12"
          height="24"
          fill={`url(#${id}-sph)`}
          clipPath={`url(#${id}-spc)`}
        />
      </g>
    </g>
  ),
  droplet: ({ sw }) => (
    <g {...strokeProps(sw)}>
      <path d="M12 3.4C14.9 6.8 18 10.1 18 13.6A6 6 0 1 1 6 13.6C6 10.1 9.1 6.8 12 3.4Z" />
    </g>
  ),
  thermometer: ({ sw }) => (
    <g {...strokeProps(sw)}>
      <path d="M10 4a2 2 0 0 1 4 0v9.4a4.6 4.6 0 1 1-4 0Z" />
      <path d="M12 13.2v3.4" />
    </g>
  ),
  eye: ({ sw }) => (
    <g {...strokeProps(sw)}>
      <path d="M2.8 12C2.8 12 6.4 5.6 12 5.6C17.6 5.6 21.2 12 21.2 12C21.2 12 17.6 18.4 12 18.4C6.4 18.4 2.8 12 2.8 12Z" />
      <circle cx="12" cy="12" r="3" />
    </g>
  ),
  gauge: ({ sw }) => (
    <g {...strokeProps(sw)}>
      <path d="M5.2 18.6a8.6 8.6 0 1 1 13.6 0" />
      <path d="M12 16.9 9.1 10.3" />
      <circle cx="12" cy="17" r="1.5" fill="currentColor" stroke="none" />
    </g>
  ),
  sunrise: ({ sw }) => (
    <g {...strokeProps(sw)}>
      <path d="M4 18.6h16" />
      <path d="M7.8 18.6a4.2 4.2 0 0 1 8.4 0" />
      <path d="M12 9.8V4" />
      <path d="M9.4 6.4 12 3.8l2.6 2.6" />
      <path d="M5.3 12.7 3.7 11.1M18.7 12.7l1.6-1.6" />
    </g>
  ),
  sunset: ({ sw }) => (
    <g {...strokeProps(sw)}>
      <path d="M4 18.6h16" />
      <path d="M7.8 18.6a4.2 4.2 0 0 1 8.4 0" />
      <path d="M12 4v5.8" />
      <path d="M9.4 7.2 12 9.8l2.6-2.6" />
      <path d="M5.3 12.7 3.7 11.1M18.7 12.7l1.6-1.6" />
    </g>
  ),
  bookmark: ({ sw }) => (
    <g {...strokeProps(sw)}>
      <path d="M8 3.8h8a2 2 0 0 1 2 2v14.9l-6-4.1-6 4.1V5.8a2 2 0 0 1 2-2z" />
    </g>
  ),
  send: ({ sw }) => (
    <g {...strokeProps(sw)}>
      <path d="M21 3 10.8 13.2" />
      <path d="M21 3l-6.6 18-3.6-8.4L2.4 9z" />
    </g>
  ),
  stop: ({ sw }) => (
    <g {...strokeProps(sw)}>
      <rect x="5.4" y="5.4" width="13.2" height="13.2" rx="3.4" />
    </g>
  ),
  refresh: ({ sw }) => (
    <g className="ic-refresh" {...strokeProps(sw)}>
      <path d="M20.4 12a8.4 8.4 0 1 1-2.4-6.4" />
      <path d="M20.8 3.2v4.8H16" />
    </g>
  ),
  locate: ({ sw }) => (
    <g {...strokeProps(sw)}>
      <circle cx="12" cy="12" r="7" />
      <path d="M12 2.2v3.6M12 18.2v3.6M2.2 12h3.6M18.2 12h3.6" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
    </g>
  ),
  command: ({ sw }) => (
    <g {...strokeProps(sw)}>
      <path d="M15.2 6.2v11.4a2.9 2.9 0 1 0 2.9-2.9H5.9a2.9 2.9 0 1 0 2.9 2.9V6.2a2.9 2.9 0 1 0-2.9 2.9h12.2a2.9 2.9 0 1 0-2.9-2.9z" />
    </g>
  ),
  info: ({ sw }) => (
    <g {...strokeProps(sw)}>
      <circle cx="12" cy="12" r="8.8" />
      <path d="M12 11v5.2" />
      <path d="M12 7.6v.01" />
    </g>
  ),
  alert: ({ sw }) => (
    <g {...strokeProps(sw)}>
      <path d="M12 4.1 21 19.4a1.3 1.3 0 0 1-1.1 2H4.1a1.3 1.3 0 0 1-1.1-2L12 4.1z" />
      <path d="M12 10.2v4.4" />
      <path d="M12 17.6v.01" />
    </g>
  ),
  'moon-phase': ({ sw }) => (
    <g>
      {/* full-moon outline (the "shadow" disc) + lit crescent */}
      <circle cx="12" cy="12" r="8.6" fill="none" stroke="currentColor" strokeWidth={sw} opacity="0.45" />
      <path d="M14 3.6A8.6 8.6 0 0 0 14 20.4A8.6 8.6 0 0 1 14 3.6Z" fill="currentColor" />
    </g>
  ),
  map: ({ sw }) => (
    <g {...strokeProps(sw)}>
      {/* folded map: two outer panels + raised center panel */}
      <path d="M3.6 6.6l5.1-2.3 6.6 2.3 5.1-2.3v13.1l-5.1 2.3-6.6-2.3-5.1 2.3z" />
      <path d="M8.7 4.3v13.1M15.3 6.6v13.1" />
    </g>
  ),
  layers: ({ sw }) => (
    <g {...strokeProps(sw)}>
      <path d="M12 3.6 20 8l-8 4.4L4 8z" />
      <path d="M5.6 12.6 12 16.1l6.4-3.5" />
      <path d="M5.6 16.8 12 20.3l6.4-3.5" />
    </g>
  ),
  play: ({ sw }) => (
    <path
      d="M8.4 5.6v12.8L19 12z"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth={sw * 0.6}
      strokeLinejoin="round"
      strokeLinecap="round"
    />
  ),
  pause: ({ sw }) => (
    <g fill="currentColor" stroke="currentColor" strokeWidth={sw * 0.5} strokeLinejoin="round">
      <rect x="6.6" y="5.4" width="3.6" height="13.2" rx="1.5" />
      <rect x="13.8" y="5.4" width="3.6" height="13.2" rx="1.5" />
    </g>
  ),
  radar: ({ sw }) => (
    <g {...strokeProps(sw)}>
      <circle cx="12" cy="12" r="8.6" />
      <path d="M12 12l5.7-5.7" />
      <path d="M12 3.4a8.6 8.6 0 0 1 6.1 2.5" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
    </g>
  ),
  satellite: ({ sw }) => (
    <g {...strokeProps(sw)} transform="rotate(-45 12 12)">
      <rect x="10.1" y="8" width="3.8" height="8" rx="1.4" />
      <path d="M9 10.6 5.7 9M9 13.4 5.7 15M15 10.6 18.3 9M15 13.4 18.3 15" />
    </g>
  ),
  volume: ({ sw }) => (
    <g {...strokeProps(sw)}>
      {/* speaker + two sound arcs */}
      <path d="M4.2 9.4v5.2h2.9l4.5 3.8V5.6L7.1 9.4H4.2z" />
      <path d="M15.4 9.3a4 4 0 0 1 0 5.4" />
      <path d="M18 7.1a7.4 7.4 0 0 1 0 9.8" />
    </g>
  ),
  grip: () => (
    <g fill="currentColor" stroke="none">
      {/* six-dot drag handle */}
      <circle cx="9" cy="7" r="1.5" />
      <circle cx="15" cy="7" r="1.5" />
      <circle cx="9" cy="12" r="1.5" />
      <circle cx="15" cy="12" r="1.5" />
      <circle cx="9" cy="17" r="1.5" />
      <circle cx="15" cy="17" r="1.5" />
    </g>
  ),
  share: ({ sw }) => (
    <g {...strokeProps(sw)}>
      {/* three nodes + connectors */}
      <circle cx="6.4" cy="12" r="2.5" />
      <circle cx="17.2" cy="5.8" r="2.5" />
      <circle cx="17.2" cy="18.2" r="2.5" />
      <path d="M8.6 10.9l6.4-3.9M8.6 13.1l6.4 3.9" />
    </g>
  ),
  compare: ({ sw }) => (
    <g {...strokeProps(sw)}>
      {/* two opposing arrows — side-by-side comparison */}
      <path d="M3.5 8.5h14M14.5 5.5l3 3-3 3" />
      <path d="M20.5 15.5h-14M9.5 12.5l-3 3 3 3" />
    </g>
  ),
};

/* ------------------------------------------------------------------ */
/* <Icon />                                                            */
/* ------------------------------------------------------------------ */

export function Icon({ name, size = 24, animated = true, className, strokeWidth = 2 }: IconProps) {
  // useId → collision-free ids for gradients / masks / clipPaths
  // (10+ icons share the hourly strip page).
  const rawId = useId();
  const id = `a${rawId.replace(/[^a-zA-Z0-9]/g, '')}`;
  const rootRef = useRef<SVGSVGElement | null>(null);
  const isWeather = WEATHER_NAMES.has(name);

  // Pause looping weather animations while off-screen (one shared observer).
  useEffect(() => {
    if (!isWeather || !animated) return;
    const el = rootRef.current;
    if (!el) return;
    const observer = getIconVisibilityObserver();
    if (!observer) return;
    observer.observe(el);
    return () => {
      observer.unobserve(el);
      el.classList.remove('icon-paused');
    };
  }, [isWeather, animated]);

  return (
    <svg
      ref={rootRef}
      viewBox={isWeather ? '0 0 64 64' : '0 0 24 24'}
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      className={cn('shrink-0', animated && 'ic-anim', !isWeather && 'ui-icon', className)}
    >
      {isWeather
        ? WEATHER_GLYPHS[name as WeatherIconName](id)
        : UI_GLYPHS[name as UiIconName]({ id, sw: strokeWidth })}
    </svg>
  );
}
