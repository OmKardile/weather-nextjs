'use client';

import { useId, useMemo } from 'react';
import type { JSX } from 'react';
import type { UseQueryResult } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { Icon } from '@/components/icons/Icon';
import { AURORA_400, f, smoothPath, useChartWidth, useMotionOk } from '@/components/weather/chart-helpers';
import { useSpaceWeather } from '@/hooks/use-official-alerts';
import { auroraVisibilityMinLatitude } from '@/lib/geo-space';
import type { Pt } from '@/components/weather/chart-helpers';
import type { City, SpaceWeather, Units, WeatherBundle } from '@/types/weather';

/* ================================================================== */
/* AuroraCard — NOAA SWPC planetary K-index: gauge, 3-day trend and a   */
/* "visible from your latitude?" hint. Shares the space-weather query   */
/* with the alerts pipeline (single fetch, shared TanStack cache).      */
/* ================================================================== */

interface AuroraCardProps {
  city: City;
  bundle: WeatherBundle;
  units: Units;
}

/** Kp gauge colors: quiet teal → unsettled yellow → storm red. */
const KP_GRADIENT = ['#45D1B3', '#74DCC2', '#E8C54D', '#F0954A', '#E1552F'];

function kpColor(kp: number): string {
  if (kp >= 7) return KP_GRADIENT[4];
  if (kp >= 5) return KP_GRADIENT[3];
  if (kp >= 4) return KP_GRADIENT[2];
  return KP_GRADIENT[0];
}

const GAUGE_CX = 110;
const GAUGE_CY = 100;
const GAUGE_R = 86;

/** Point on the gauge arc for a Kp value (0 = left end, 9 = right end). */
function gaugePoint(kp: number, radius = GAUGE_R): Pt {
  const theta = Math.PI * (1 - Math.min(9, Math.max(0, kp)) / 9);
  return {
    x: f(GAUGE_CX + radius * Math.cos(theta)),
    y: f(GAUGE_CY - radius * Math.sin(theta)),
  };
}

function KpGauge({ kp }: { kp: number }): JSX.Element {
  const rawId = useId();
  const gid = `kp${rawId.replace(/[^a-zA-Z0-9]/g, '')}`;
  const start = gaugePoint(0);
  const end = gaugePoint(9);
  const marker = gaugePoint(kp);
  const storm = gaugePoint(5);
  const color = kpColor(kp);

  return (
    <svg
      viewBox="0 0 220 118"
      className="mx-auto w-full max-w-[240px]"
      role="img"
      aria-label={`Planetary K-index gauge: current Kp ${kp.toFixed(1)} of 9`}
    >
      <defs>
        <linearGradient id={`${gid}-arc`} x1="0" y1="0" x2="1" y2="0">
          {KP_GRADIENT.map((c, i) => (
            <stop key={c} offset={i / (KP_GRADIENT.length - 1)} stopColor={c} />
          ))}
        </linearGradient>
      </defs>
      {/* track */}
      <path
        d={`M ${start.x} ${start.y} A ${GAUGE_R} ${GAUGE_R} 0 0 1 ${end.x} ${end.y}`}
        fill="none"
        stroke="var(--surface-border)"
        strokeWidth={11}
        strokeLinecap="round"
        opacity={0.55}
      />
      {/* colored arc */}
      <path
        d={`M ${start.x} ${start.y} A ${GAUGE_R} ${GAUGE_R} 0 0 1 ${end.x} ${end.y}`}
        fill="none"
        stroke={`url(#${gid}-arc)`}
        strokeWidth={11}
        strokeLinecap="round"
        opacity={0.9}
      />
      {/* storm-level notch (Kp 5) */}
      <line
        x1={storm.x}
        y1={storm.y}
        x2={gaugePoint(5, GAUGE_R + 9).x}
        y2={gaugePoint(5, GAUGE_R + 9).y}
        stroke="var(--surface-muted)"
        strokeWidth={1.5}
        strokeLinecap="round"
      />
      <text
        x={gaugePoint(5, GAUGE_R - 22).x}
        y={gaugePoint(5, GAUGE_R - 22).y}
        textAnchor="middle"
        fontSize={7.5}
        style={{ fill: 'var(--surface-muted)' }}
      >
        storm 5
      </text>
      {/* value marker */}
      <circle cx={marker.x} cy={marker.y} r={6.5} fill={color} stroke="rgb(255 255 255 / 0.9)" strokeWidth={2} />
      {/* readout */}
      <text
        x={GAUGE_CX}
        y={GAUGE_CY - 22}
        textAnchor="middle"
        fontSize={30}
        fontWeight={650}
        style={{ fill: 'var(--surface-text)' }}
        className="tnum"
      >
        {kp.toFixed(1)}
      </text>
      <text x={GAUGE_CX} y={GAUGE_CY - 4} textAnchor="middle" fontSize={9} letterSpacing={1.2} style={{ fill: 'var(--surface-muted)' }}>
        PLANETARY K-INDEX
      </text>
    </svg>
  );
}

function KpSparkline({ series, units }: { series: SpaceWeather['series']; units: Units }): JSX.Element | null {
  const [wrapRef, width] = useChartWidth<HTMLDivElement>();
  const height = 56;
  const padX = 6;

  const geom = useMemo(() => {
    if (series.length < 3 || width < 60) return null;
    const slot = (width - padX * 2) / (series.length - 1);
    const yOf = (kp: number) => f(10 + (1 - Math.min(9, Math.max(0, kp)) / 9) * (height - 22));
    const pts: Pt[] = series.map((p, i) => ({ x: f(padX + slot * i), y: yOf(p.kp) }));
    return { slot, yOf, pts, line: smoothPath(pts), thresholdY: yOf(5) };
  }, [series, width]);

  if (series.length < 3) return null;
  const first = series[0];
  const last = series[series.length - 1];

  return (
    <div ref={wrapRef} className="w-full">
      {/* Skeleton until the wrapper has been measured (chart-helpers pattern:
          the measured element must render for width to ever arrive). */}
      {!geom ? (
        <div className="skeleton h-14 w-full" aria-hidden="true" />
      ) : (
        <>
          <svg
            width={width}
            height={height}
            className="block"
            role="img"
            aria-label={`Kp trend over the last 3 days, from ${first.kp.toFixed(1)} to ${last.kp.toFixed(1)}`}
          >
        {/* storm threshold */}
        <line
          x1={padX}
          x2={width - padX}
          y1={geom.thresholdY}
          y2={geom.thresholdY}
          stroke="#F0954A"
          strokeWidth={1}
          strokeDasharray="4 4"
          opacity={0.55}
        />
        {/* area + line */}
        <path
          d={`${geom.line} L ${geom.pts[geom.pts.length - 1].x} ${height - 2} L ${geom.pts[0].x} ${height - 2} Z`}
          fill="rgb(69 209 179 / 0.12)"
        />
        <path d={geom.line} fill="none" stroke={AURORA_400} strokeWidth={2} strokeLinecap="round" />
        {/* endpoints */}
        <circle cx={geom.pts[0].x} cy={geom.pts[0].y} r={2.5} fill={AURORA_400} opacity={0.6} />
        <circle
          cx={geom.pts[geom.pts.length - 1].x}
          cy={geom.pts[geom.pts.length - 1].y}
          r={3.5}
          fill={AURORA_400}
          stroke="rgb(255 255 255 / 0.9)"
          strokeWidth={1.5}
        />
          </svg>
          <div className="tnum mt-0.5 flex justify-between text-[10px] text-surface-faint">
            <span>
              {format(
                parseISO(first.time),
                units === 'metric' ? 'd MMM HH:mm' : 'MMM d h a',
              )}
            </span>
            <span>now</span>
          </div>
        </>
      )}
    </div>
  );
}

export function AuroraCard({ city, bundle, units }: AuroraCardProps): JSX.Element {
  const query: UseQueryResult<SpaceWeather, Error> = useSpaceWeather(true, bundle.fetchedAt);
  const motionOk = useMotionOk();
  const rawId = useId();
  const shimmerClass = `aurora-shimmer-${rawId.replace(/[^a-zA-Z0-9]/g, '')}`;

  const data = query.data ?? null;
  const latestKp = data?.latestKp ?? 0;
  const active = latestKp >= 5;

  const trend = useMemo(() => {
    if (!data || data.series.length < 9) return null;
    const recent = data.latestKp;
    const baseline =
      data.series.slice(-9, -1).reduce((sum, p) => sum + p.kp, 0) / 8;
    const delta = recent - baseline;
    if (delta >= 0.67) return { arrow: '↑', word: 'rising' } as const;
    if (delta <= -0.67) return { arrow: '↓', word: 'easing' } as const;
    return { arrow: '→', word: 'steady' } as const;
  }, [data]);

  const minLat = auroraVisibilityMinLatitude(latestKp);
  const absLat = Math.round(Math.abs(city.latitude));
  const hemisphere = city.latitude >= 0 ? 'N' : 'S';
  const horizon = city.latitude >= 0 ? 'northern' : 'southern';
  const latNote =
    absLat >= minLat
      ? `You're at ${absLat}°${hemisphere} — inside the aurora belt tonight!`
      : absLat >= minLat - 8
        ? `Possible low on your ${horizon} horizon! You're at ${absLat}°${hemisphere}, sky glow may reach ~${minLat}°.`
        : `You're at ${absLat}°${hemisphere} — not tonight.`;

  const shimmerCss =
    `.${shimmerClass}{position:absolute;inset:0;overflow:hidden;border-radius:inherit;pointer-events:none}` +
    `.${shimmerClass}::before{content:'';position:absolute;top:-20%;bottom:-20%;left:-45%;width:36%;` +
    `background:linear-gradient(105deg,transparent,rgb(116 220 194 / 0.16),rgb(242 183 92 / 0.14),transparent);` +
    `transform:skewX(-18deg);animation:${shimmerClass}-sweep 3.2s ease-in-out infinite}` +
    `@keyframes ${shimmerClass}-sweep{from{left:-45%}to{left:115%}}`;

  return (
    <div
      className="glass animate-fade-up relative flex h-full flex-col overflow-hidden rounded-[var(--radius-card)] p-4 shadow-[var(--shadow-glass)] sm:p-5"
      aria-busy={query.isPending && !data}
    >
      {active && motionOk ? <style>{shimmerCss}</style> : null}
      {active && motionOk ? <div className={shimmerClass} aria-hidden="true" /> : null}

      <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-surface-muted">
        <Icon name="satellite" size={14} strokeWidth={2} aria-hidden="true" />
        Aurora activity
      </p>

      {query.isPending && !data ? (
        <>
          <div className="skeleton mx-auto mt-4 h-[104px] w-[220px] rounded-[110px_110px_0_0]" aria-hidden="true" />
          <div className="skeleton mt-4 h-2 w-3/4" aria-hidden="true" />
          <div className="skeleton mt-3 h-3 w-full" aria-hidden="true" />
          <div className="skeleton mt-3 h-3 w-5/6" aria-hidden="true" />
        </>
      ) : query.isError && !data ? (
        <div className="mt-4 flex flex-col items-start gap-2">
          <p className="text-xs text-surface-muted">Space weather feed unavailable right now.</p>
          <button
            type="button"
            onClick={() => void query.refetch()}
            className="glass-subtle glass-hover focus-ring flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs text-surface"
          >
            <Icon name="refresh" size={13} strokeWidth={2} aria-hidden="true" />
            Retry
          </button>
        </div>
      ) : data ? (
        <>
          <div className="mt-3">
            <KpGauge kp={latestKp} />
          </div>

          <p className="tnum mt-2 text-center text-xs text-surface-muted">
            Kp {latestKp.toFixed(1)} of 9
            {trend ? (
              <>
                {' · '}
                <span style={{ color: trend.word === 'rising' ? '#F0954A' : undefined }}>
                  {trend.arrow} {trend.word}
                </span>
              </>
            ) : null}
          </p>

          <div className="mt-3">
            <KpSparkline series={data.series} units={units} />
          </div>

          <div className="mt-auto pt-3">
            <p className="text-xs leading-relaxed text-surface-muted">
              Aurora visible from ~{minLat}°+ latitude at Kp {latestKp.toFixed(1)}.{' '}
              <span className={absLat >= minLat ? 'font-medium text-surface' : 'text-surface-faint'}>
                {latNote}
              </span>
            </p>
            <p className="mt-2 text-[10px] text-surface-faint">
              NOAA SWPC planetary K-index · 3-hour steps, last 3 days
            </p>
          </div>
        </>
      ) : null}
    </div>
  );
}
