'use client';

import type { JSX } from 'react';
import { differenceInMinutes, parseISO } from 'date-fns';
import { Icon } from '@/components/icons/Icon';
import { AURORA_400, AURORA_500, useMotionOk } from '@/components/weather/chart-helpers';
import type { City, Units, WeatherBundle } from '@/types/weather';

/* ================================================================== */
/* DaylightCard — how much sun the day holds, and where we are in the  */
/* year's swing.                                                       */
/*                                                                     */
/* The semicircle gauge fills between the year's shortest and longest  */
/* day at this latitude (Cooper solar-declination approximation, ±2    */
/* minutes — plenty for a progress arc). Stats: today's length, the    */
/* per-day delta from tomorrow's bundle row, sunrise/sunset/night and */
/* the distance to the next solstice in daylight terms.                */
/* ================================================================== */

interface DaylightCardProps {
  city: City;
  bundle: WeatherBundle;
  units: Units;
}

/** Cooper's equation: solar declination (deg) for a day of the year. */
function solarDeclination(dayOfYear: number): number {
  return 23.44 * Math.sin((2 * Math.PI * (dayOfYear + 284)) / 365.24);
}

/**
 * Approximate day length in minutes for a date + latitude (hour-angle
 * formula; the acos argument is clamped for polar day/night).
 */
function approxDayLengthMinutes(date: Date, latitude: number): number {
  const dayOfYear = Math.floor(
    (date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86_400_000,
  );
  const decl = (solarDeclination(dayOfYear) * Math.PI) / 180;
  const lat = (latitude * Math.PI) / 180;
  const cosH = -Math.tan(lat) * Math.tan(decl);
  const clamped = Math.min(1, Math.max(-1, cosH));
  return Math.round(((2 * Math.acos(clamped) * (180 / Math.PI)) / 15) * 60);
}

function formatLength(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

/** "+1m 24s" / "−2m 10s" of daylight per day. */
function formatDelta(minutes: number): { text: string; gaining: boolean } {
  const abs = Math.abs(minutes);
  const m = Math.floor(abs);
  const s = Math.round((abs - m) * 60);
  const label = m > 0 ? `${m}m ${String(s).padStart(2, '0')}s` : `${s}s`;
  return { text: `${minutes >= 0 ? '+' : '−'}${label}`, gaining: minutes >= 0 };
}

/** Semicircle gauge geometry (viewBox 220 × 122). */
const CX = 110;
const CY = 106;
const R = 88;

function polarToXY(angleDeg: number): { x: number; y: number } {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: CX + R * Math.cos(rad), y: CY - R * Math.sin(rad) };
}

/** Arc path sweeping from 180° (left, shortest) to `toAngle` (0° = right). */
function arcPath(toAngle: number): string {
  const start = polarToXY(180);
  const end = polarToXY(Math.min(180, Math.max(0, toAngle)));
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${R} ${R} 0 0 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
}

export function DaylightCard({ city, bundle }: DaylightCardProps): JSX.Element | null {
  const motionOk = useMotionOk();
  const today = bundle.daily[0];
  const tomorrow = bundle.daily[1];
  if (!today || !tomorrow || !today.sunrise || !today.sunset || !tomorrow.sunset) return null;

  // Plain derivations (cheap trig) — no conditional hooks past this point.
  const todayLen = differenceInMinutes(parseISO(today.sunset), parseISO(today.sunrise));
  const tomorrowLen = differenceInMinutes(
    parseISO(tomorrow.sunset),
    parseISO(tomorrow.sunrise),
  );
  const delta = tomorrowLen - todayLen;

  // Year swing at this latitude (approximation — the gauge's scale).
  const anchor = parseISO(today.date);
  const shortest = approxDayLengthMinutes(new Date(anchor.getFullYear(), 11, 21), city.latitude);
  const longest = approxDayLengthMinutes(new Date(anchor.getFullYear(), 5, 21), city.latitude);
  const span = Math.max(1, longest - shortest);
  const progress = Math.min(1, Math.max(0, (todayLen - shortest) / span));

  const toward = delta >= 0 ? 'longest' : 'shortest';
  const remaining =
    toward === 'longest' ? Math.max(0, longest - todayLen) : Math.max(0, todayLen - shortest);
  const solsticeDate =
    toward === 'longest'
      ? new Date(anchor.getFullYear(), 5, 21)
      : new Date(anchor.getFullYear(), 11, 21);
  const monthsToSolstice = Math.max(
    0,
    Math.round((solsticeDate.getTime() - anchor.getTime()) / (30.44 * 86_400_000)),
  );

  const fillAngle = 180 * (1 - progress); // 0° = right end (longest)
  const deltaChip = formatDelta(delta);
  const marker = polarToXY(fillAngle);

  return (
    <div className="glass card-lift fs-card rounded-[var(--radius-card)] p-4 shadow-[var(--shadow-glass)] sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="glass-subtle flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
            <Icon name="sun" size={22} animated={motionOk} className="text-aurora-300" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-surface">Daylight</p>
            <p className="tnum mt-0.5 text-[11px] text-surface-faint">
              {formatLength(todayLen)} of light · {formatLength(1440 - todayLen)} of night
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="tnum flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold"
            style={{
              background: deltaChip.gaining
                ? 'color-mix(in srgb, #45D1B3 18%, transparent)'
                : 'color-mix(in srgb, #E8C54D 16%, transparent)',
              color: deltaChip.gaining ? AURORA_400 : '#E8C54D',
            }}
          >
            <Icon name={deltaChip.gaining ? 'chevron-up' : 'chevron-down'} size={12} />
            {deltaChip.text}/day
          </span>
          <span className="hidden card-label-muted sm:block">Solstice</span>
        </div>
      </div>

      {/* Semicircle gauge: year progress between shortest and longest day */}
      <div className="mt-3">
        <svg
          viewBox="0 0 220 122"
          className="mx-auto block w-full max-w-[280px]"
          role="img"
          aria-label={`Daylight gauge: ${formatLength(todayLen)} today, between the year's shortest day at ${formatLength(shortest)} and longest at ${formatLength(longest)}. ${deltaChip.text} of daylight per day, heading toward the ${toward} day.`}
        >
          <defs>
            <linearGradient id="aether-daylight-arc" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={AURORA_500} stopOpacity="0.55" />
              <stop offset="100%" stopColor="#F5C97B" />
            </linearGradient>
          </defs>

          {/* Track */}
          <path
            d={arcPath(0)}
            fill="none"
            stroke="color-mix(in srgb, var(--surface-border) 70%, transparent)"
            strokeWidth={9}
            strokeLinecap="round"
          />
          {/* Fill (from the shortest-day end) */}
          <path
            d={arcPath(fillAngle)}
            fill="none"
            stroke="url(#aether-daylight-arc)"
            strokeWidth={9}
            strokeLinecap="round"
          />
          {/* Progress marker dot */}
          <circle
            cx={marker.x}
            cy={marker.y}
            r={6.5}
            fill="#F5C97B"
            stroke="rgb(255 255 255 / 0.85)"
            strokeWidth={2}
          />

          {/* Sun glyph above the marker */}
          <g transform={`translate(${marker.x - 11}, ${marker.y - 34})`} opacity={0.9}>
            <circle cx={11} cy={11} r={5.5} fill="#F5C97B" />
            {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
              const rad = (deg * Math.PI) / 180;
              return (
                <line
                  key={deg}
                  x1={11 + 8 * Math.cos(rad)}
                  y1={11 + 8 * Math.sin(rad)}
                  x2={11 + 10.5 * Math.cos(rad)}
                  y2={11 + 10.5 * Math.sin(rad)}
                  stroke="#F5C97B"
                  strokeWidth={1.6}
                  strokeLinecap="round"
                />
              );
            })}
          </g>

          {/* End labels */}
          <text x={8} y={120} fontSize={9} fill="var(--surface-muted)" className="tnum">
            {formatLength(shortest)}
          </text>
          <text x={212} y={120} fontSize={9} textAnchor="end" fill="var(--surface-muted)" className="tnum">
            {formatLength(longest)}
          </text>
        </svg>
      </div>

      {/* Sunrise/sunset times were removed here (v4.2 dedup): the hero
          chip and the Sun path card in Details already show both times;
          this card keeps what only it knows — night length, the daily
          delta, the year gauge and the solstice countdown. */}

      <p className="mt-3 text-[10px] leading-relaxed text-surface-faint">
        {formatLength(remaining)} of daylight {toward === 'longest' ? 'still to gain' : 'still to lose'}{' '}
        before the {toward} day{monthsToSolstice > 0 ? ` (~${monthsToSolstice} mo)` : ''}.
      </p>
    </div>
  );
}
