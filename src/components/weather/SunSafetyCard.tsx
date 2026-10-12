'use client';

import { useMemo } from 'react';
import type { JSX } from 'react';
import { format, parseISO } from 'date-fns';
import { Icon } from '@/components/icons/Icon';
import {
  AURORA_400,
  clamp,
  f,
  useChartWidth,
  useMotionOk,
} from '@/components/weather/chart-helpers';
import { usePreferences } from '@/hooks/use-preferences';
import type { SkinType } from '@/hooks/use-preferences';
import { uvInfo } from '@/lib/units';
import type { Units, WeatherBundle } from '@/types/weather';

/* ================================================================== */
/* SunSafetyCard — when the sun demands respect.                        */
/*                                                                     */
/* The hourly UV curve for the next 48 hours, band-colored (the same   */
/* scale as the UV metric tile), with a live now-marker and peak dot.  */
/* A Fitzpatrick I–VI selector (persisted preference) personalizes     */
/* burn-time estimates: minutes ≈ MED × 2 / (3 × UV) — the ISO        */
/* erythemal-dose arithmetic (UV index 1 ≈ 25 mJ/m²/min). SPF 30      */
/* multiplies exposure time ~30×. A "low-UV window" line tells you    */
/* when the index stays ≤ 3. Estimates, not a dermatologist.          */
/* ================================================================== */

interface SunSafetyCardProps {
  bundle: WeatherBundle;
  units: Units;
}

/** Minimal erythemal dose per phototype (J/m², ISO/Diffey table). */
const MED_J: Record<SkinType, number> = { 1: 200, 2: 250, 3: 300, 4: 450, 5: 600, 6: 1000 };

const SKIN_LABELS: Record<SkinType, string> = {
  1: 'I · very fair',
  2: 'II · fair',
  3: 'III · light',
  4: 'IV · olive',
  5: 'V · brown',
  6: 'VI · dark',
};

const CHART_H = 116;
const TOP = 14;
const BASE = 92;
const UV_MAX = 12; // the scale tops at "extreme 11+", so 12 is the ceiling

/** Unprotected minutes-to-erythema at a given UV index (ISO arithmetic). */
function burnMinutes(uv: number, skin: SkinType): number | null {
  if (!Number.isFinite(uv) || uv < 0.1) return null;
  return Math.round((MED_J[skin] * 2) / (3 * uv));
}

function formatMinutes(minutes: number | null): string {
  if (minutes == null) return '—';
  if (minutes >= 480) return '8 h+';
  if (minutes >= 60) {
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    return m > 0 ? `${h} h ${m} m` : `${h} h`;
  }
  return `${minutes} min`;
}

function hourLabel(iso: string, units: Units): string {
  try {
    return format(parseISO(iso), units === 'metric' ? 'HH' : 'h a');
  } catch {
    return '';
  }
}

function safeHour(iso: string, units: Units): string {
  try {
    return format(parseISO(iso), units === 'metric' ? 'HH:mm' : 'h:mm a');
  } catch {
    return '--:--';
  }
}

export function SunSafetyCard({ bundle, units }: SunSafetyCardProps): JSX.Element {
  const [wrapRef, width] = useChartWidth<HTMLDivElement>();
  const motionOk = useMotionOk();
  const skinType = usePreferences((state) => state.skinType);
  const setSkinType = usePreferences((state) => state.setSkinType);

  const hours = bundle.hourly;
  const uvNow = hours[0]?.uvIndex ?? 0;
  const peak = useMemo(
    () =>
      hours.reduce(
        (best, h) => (h.uvIndex > best.uvIndex ? h : best),
        hours[0] ?? { time: '', uvIndex: 0 },
      ),
    [hours],
  );

  // Geometry: band-colored gradient stops, smooth curve, now + peak markers.
  const geom = useMemo(() => {
    if (hours.length < 2 || width < 60) return null;
    const n = hours.length;
    const padX = 8;
    const slot = (width - padX * 2) / (n - 1);
    const xs = hours.map((_, i) => f(padX + slot * i));
    const ys = hours.map((h) => f(BASE - (clamp(h.uvIndex, 0, UV_MAX) / UV_MAX) * (BASE - TOP)));
    const pts = xs.map((x, i) => ({ x, y: ys[i] }));

    // Path (angular, like a mountain ridge — smoothing would invent peaks
    // between hourly samples; hourly resolution is the truth here).
    const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    const area = `${line} L ${f(pts[n - 1].x)} ${BASE} L ${f(pts[0].x)} ${BASE} Z`;

    // Gradient stops colored by each sample's UV band → smooth transitions.
    const stops = hours.map((h, i) => ({
      offset: f((i / (n - 1)) * 100),
      color: uvInfo(h.uvIndex).color,
    }));

    // Now marker (first sample) + peak marker.
    const nowX = pts[0].x;
    const nowY = pts[0].y;
    const peakIdx = hours.findIndex((h) => h === peak);
    const peakPt = peakIdx >= 0 ? pts[peakIdx] : null;

    return { xs, pts, line, area, stops, nowX, nowY, peakPt };
  }, [hours, width, peak]);

  const safeGeom = geom && hours.length === geom.pts.length ? geom : null;

  // Low-UV window: the last hour before the index first crosses 3 upward,
  // and the first hour after it last crosses back down.
  const windows = useMemo(() => {
    if (hours.length === 0) return null;
    const above = hours.map((h) => h.uvIndex > 3);
    const firstHigh = above.findIndex((a) => a);
    if (firstHigh === -1) return { kind: 'never' as const };
    let lastHigh = -1;
    for (let i = above.length - 1; i >= 0; i -= 1) {
      if (above[i]) {
        lastHigh = i;
        break;
      }
    }
    return {
      kind: 'crosses' as const,
      morning: hours[Math.max(0, firstHigh - 1)]?.time ?? hours[0].time,
      evening: hours[Math.min(hours.length - 1, lastHigh + 1)]?.time ?? hours[hours.length - 1].time,
    };
  }, [hours]);

  const peakBurn = burnMinutes(peak.uvIndex, skinType);
  const nowBurn = burnMinutes(uvNow, skinType);
  const nowInfo = uvInfo(uvNow);
  const peakInfo = uvInfo(peak.uvIndex);

  const ariaSummary = `Sun safety: UV index ${uvNow.toFixed(1)} now (${nowInfo.label}), peaking at ${peak.uvIndex.toFixed(1)} (${peakInfo.label}) around ${safeHour(peak.time, units)}. For skin type ${skinType} (${SKIN_LABELS[skinType].split('·')[1].trim()}), unprotected skin may redden in about ${formatMinutes(nowBurn)} now and ${formatMinutes(peakBurn)} at the peak; SPF 30 extends that roughly thirty-fold.${windows?.kind === 'crosses' ? ` UV stays low before ${safeHour(windows.morning, units)} and after ${safeHour(windows.evening, units)}.` : ' UV stays low for the whole window.'}`;

  return (
    <div className="glass card-lift fs-card rounded-[var(--radius-card)] p-4 shadow-[var(--shadow-glass)] sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="glass-subtle flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
            <Icon name="sun" size={22} animated={motionOk} className="text-aurora-300" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-surface">
              Sun safety{' '}
              <span className="font-normal text-surface-muted">· next 48 hours</span>
            </p>
            <p className="tnum mt-0.5 text-[11px] text-surface-faint">
              UV {uvNow.toFixed(1)} {nowInfo.label} now · peaks {peak.uvIndex.toFixed(1)}{' '}
              {peakInfo.label.toLowerCase()}
            </p>
          </div>
        </div>
        <span className="hidden card-label-muted shrink-0 sm:block">Exposure</span>
      </div>

      {/* UV curve — band-colored gradient area */}
      <div ref={wrapRef} className="mt-3">
        {safeGeom ? (
          <svg
            width={width}
            height={CHART_H}
            className="block"
            role="img"
            aria-label={ariaSummary}
          >
            <defs>
              <linearGradient id="aether-uv-area" x1="0" y1="0" x2="1" y2="0">
                {safeGeom.stops.map((s, i) => (
                  <stop key={i} offset={`${s.offset}%`} stopColor={s.color} stopOpacity="0.42" />
                ))}
              </linearGradient>
            </defs>

            {/* band guide lines at UV 3 / 6 / 8 / 11 */}
            {[3, 6, 8, 11].map((band) => {
              const y = BASE - (band / UV_MAX) * (BASE - TOP);
              return (
                <g key={band}>
                  <line
                    x1={4}
                    x2={width - 4}
                    y1={y}
                    y2={y}
                    stroke="var(--surface-border)"
                    strokeWidth={0.6}
                    opacity={0.5}
                    strokeDasharray="2 6"
                  />
                  <text
                    x={width - 4}
                    y={y - 2}
                    textAnchor="end"
                    fontSize={8}
                    className="tnum"
                    style={{ fill: 'var(--surface-faint)' }}
                  >
                    {band}
                  </text>
                </g>
              );
            })}

            <path d={safeGeom.area} fill="url(#aether-uv-area)" />
            <path
              d={safeGeom.line}
              fill="none"
              stroke="var(--surface)"
              strokeOpacity={0.55}
              strokeWidth={1.2}
              strokeLinejoin="round"
            />

            {/* now marker */}
            <line
              x1={safeGeom.nowX}
              x2={safeGeom.nowX}
              y1={safeGeom.nowY - 6}
              y2={BASE}
              stroke={AURORA_400}
              strokeWidth={1}
              strokeDasharray="3 3"
              opacity={0.7}
            />
            <circle cx={safeGeom.nowX} cy={safeGeom.nowY} r={3} fill={AURORA_400} />
            <circle cx={safeGeom.nowX} cy={safeGeom.nowY} r={6.5} fill={AURORA_400} opacity={0.25} />

            {/* peak marker */}
            {safeGeom.peakPt && safeGeom.peakPt !== safeGeom.pts[0] ? (
              <>
                <circle
                  cx={safeGeom.peakPt.x}
                  cy={safeGeom.peakPt.y}
                  r={3.2}
                  fill={peakInfo.color}
                  stroke="rgb(255 255 255 / 0.85)"
                  strokeWidth={1.2}
                />
                <text
                  x={clamp(safeGeom.peakPt.x, 22, width - 22)}
                  y={Math.max(10, safeGeom.peakPt.y - 7)}
                  textAnchor="middle"
                  fontSize={9}
                  className="tnum font-semibold"
                  style={{ fill: 'var(--surface-muted)' }}
                >
                  {peak.uvIndex.toFixed(1)}
                </text>
              </>
            ) : null}

            <line
              x1={2}
              x2={width - 2}
              y1={BASE}
              y2={BASE}
              stroke="var(--surface-border)"
              strokeWidth={1}
            />

            {hours.map((h, i) =>
              i % 6 === 0 ? (
                <text
                  key={h.time}
                  x={clamp(safeGeom.xs[i], 16, width - 16)}
                  y={CHART_H - 4}
                  textAnchor="middle"
                  fontSize={9}
                  className="tnum"
                  style={{ fill: 'var(--surface-faint)' }}
                >
                  {i === 0 ? 'Now' : hourLabel(h.time, units)}
                </text>
              ) : null,
            )}
          </svg>
        ) : (
          <div className="skeleton h-[116px] w-full" aria-hidden="true" />
        )}
      </div>

      {/* Skin type selector */}
      <div className="mt-4">
        <p className="mb-1.5 text-[11px] font-medium text-surface-muted">
          Your skin (Fitzpatrick type)
        </p>
        <div
          className="flex flex-wrap gap-1.5"
          role="radiogroup"
          aria-label="Fitzpatrick skin type"
        >
          {([1, 2, 3, 4, 5, 6] as const).map((type) => {
            const active = type === skinType;
            return (
              <button
                key={type}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setSkinType(type)}
                className={
                  'focus-ring tnum rounded-full px-3 py-1 text-[11px] font-semibold transition-transform duration-200 active:scale-95 ' +
                  (active ? '' : 'glass-subtle text-surface-muted transition-colors duration-200 hover:text-surface')
                }
                style={
                  active
                    ? {
                        background: 'color-mix(in srgb, #F5C97B 22%, transparent)',
                        boxShadow:
                          '0 0 14px -6px rgb(245 201 123 / 0.8), inset 0 1px 0 rgb(255 255 255 / 0.18)',
                        border: '1px solid rgb(245 201 123 / 0.45)',
                        color: '#F5C97B',
                      }
                    : undefined
                }
              >
                {SKIN_LABELS[type]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Burn-time readouts */}
      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="glass-subtle rounded-xl px-3 py-2.5">
          <p className="text-[10px] text-surface-muted">Unprotected now</p>
          <p className="tnum mt-0.5 text-lg font-bold text-surface">
            {uvNow < 0.1 ? 'No UV' : formatMinutes(nowBurn)}
          </p>
          <p className="text-[10px] text-surface-faint">
            {uvNow < 0.1 ? 'the sun is down / too low to burn' : `to redden at UV ${uvNow.toFixed(1)}`}
          </p>
        </div>
        <div className="glass-subtle rounded-xl px-3 py-2.5">
          <p className="text-[10px] text-surface-muted">At today&apos;s peak</p>
          <p className="tnum mt-0.5 text-lg font-bold" style={{ color: peakInfo.color }}>
            {formatMinutes(peakBurn)}
          </p>
          <p className="text-[10px] text-surface-faint">
            at {safeHour(peak.time, units)} · SPF 30 ≈ {formatMinutes(peakBurn != null ? peakBurn * 30 : null)}
          </p>
        </div>
      </div>

      <p className="mt-3 text-[10px] leading-relaxed text-surface-faint">
        {windows?.kind === 'crosses' ? (
          <>
            UV stays low (≤3) before{' '}
            <span className="tnum font-semibold text-surface-muted">
              {safeHour(windows.morning, units)}
            </span>{' '}
            and after{' '}
            <span className="tnum font-semibold text-surface-muted">
              {safeHour(windows.evening, units)}
            </span>
            .{' '}
          </>
        ) : (
          <>UV stays low for the whole window. </>
        )}
        Estimates assume unobstructed midday-style exposure; shade, clothing and SPF multiply
        your safe time.
      </p>
    </div>
  );
}
