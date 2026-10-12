'use client';

import { useMemo, useState } from 'react';
import type { JSX, PointerEvent as ReactPointerEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { CSSProperties } from 'react';
import { format, parseISO } from 'date-fns';
import { Icon } from '@/components/icons/Icon';
import { clamp, f, useChartWidth } from '@/components/weather/chart-helpers';
import { formatTemp } from '@/lib/units';
import type {
  City,
  HistoricalResponse,
  HistoricalYear,
  Units,
  WeatherBundle,
} from '@/types/weather';
import { cn } from '@/lib/utils';
import './sky.css';

/* ================================================================== */
/* TimeMachineCard — pick any month/day and see that date's high/low    */
/* across ~30 years of ERA5 reanalysis vs the 30-year normal.           */
/* ================================================================== */

interface TimeMachineCardProps {
  city: City;
  bundle: WeatherBundle;
  units: Units;
}

type HistoricalOrError = HistoricalResponse | { error: string };

function isHistoricalError(data: HistoricalOrError): data is { error: string } {
  return typeof (data as { error?: unknown }).error === 'string';
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

/** Selectable days per month — Feb keeps 29 so leap-day is reachable. */
function daysInMonth(month: number): number {
  if (month === 2) return 29;
  if ([4, 6, 9, 11].includes(month)) return 30;
  return 31;
}

const WARM = '#F2B75C';
const COOL = '#45D1B3';
const CHART_TOP = 10;
const CHART_BOTTOM = 20; // year labels
const LABEL_W = 44; // right gutter for the normal-line labels

/* ------------------------------------------------------------------ */
/* The year-by-year dot chart                                          */
/* ------------------------------------------------------------------ */

function HistoricalChart({
  years,
  normal,
  units,
  dateLabel,
}: {
  years: HistoricalYear[];
  normal: { tmax: number | null; tmin: number | null };
  units: Units;
  dateLabel: string;
}): JSX.Element | null {
  const [wrapRef, width] = useChartWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const height = 190;

  const geom = useMemo(() => {
    const withData = years.filter((y) => y.tmax != null || y.tmin != null);
    if (years.length < 2 || withData.length === 0 || width < 80) return null;

    const values: number[] = [];
    for (const y of withData) {
      if (y.tmax != null) values.push(y.tmax);
      if (y.tmin != null) values.push(y.tmin);
    }
    if (normal.tmax != null) values.push(normal.tmax);
    if (normal.tmin != null) values.push(normal.tmin);
    const lo = Math.min(...values) - 2;
    const hi = Math.max(...values) + 2;

    const padX = 8;
    const plotW = width - padX * 2 - LABEL_W;
    const slot = years.length > 1 ? plotW / (years.length - 1) : 0;
    const xOf = (i: number) => f(padX + slot * i);
    const yOf = (t: number) =>
      f(CHART_TOP + (1 - (t - lo) / (hi - lo)) * (height - CHART_TOP - CHART_BOTTOM));

    return { padX, slot, xOf, yOf, lo, hi };
  }, [years, normal, width]);

  if (!geom) {
    // Wrapper still renders so useChartWidth can measure it (chart-helpers
    // pattern — the measured element must exist for width to ever arrive).
    return (
      <div ref={wrapRef} className="relative w-full">
        <div className="skeleton h-[190px] w-full rounded-xl" aria-hidden="true" />
      </div>
    );
  }

  const activeIdx =
    active !== null && active >= 0 && active < years.length ? active : null;
  const activeYear = activeIdx !== null ? years[activeIdx] : null;

  let tipStyle: CSSProperties | null = null;
  if (activeIdx !== null && activeYear) {
    const x = geom.xOf(activeIdx);
    const tx =
      x > width - 96
        ? 'translateX(calc(-100% - 12px))'
        : x < 76
          ? 'translateX(12px)'
          : 'translateX(-50%)';
    const activeY =
      activeYear.tmax != null
        ? geom.yOf(activeYear.tmax)
        : activeYear.tmin != null
          ? geom.yOf(activeYear.tmin)
          : CHART_TOP;
    tipStyle = {
      left: x,
      top: activeY,
      transform: `${tx} ${activeY > 110 ? 'translateY(calc(-100% - 10px))' : 'translateY(10px)'}`,
    };
  }

  const indexFromClientX = (clientX: number, el: SVGSVGElement): number => {
    const rect = el.getBoundingClientRect();
    return clamp(Math.round((clientX - rect.left - geom.padX) / geom.slot), 0, years.length - 1);
  };

  const withData = years.filter((y) => y.tmax != null || y.tmin != null);
  const warmest = withData.reduce<HistoricalYear | null>(
    (best, y) => (y.tmax != null && (!best?.tmax || y.tmax > best.tmax) ? y : best),
    null,
  );
  const coldest = withData.reduce<HistoricalYear | null>(
    (best, y) => (y.tmin != null && (!best?.tmin || y.tmin < best.tmin) ? y : best),
    null,
  );

  const aria =
    `High and low temperatures on ${dateLabel} across ${withData.length} years, ` +
    `${years[0].year} to ${years[years.length - 1].year}. ` +
    (normal.tmax != null && normal.tmin != null
      ? `30-year normal: high ${formatTemp(normal.tmax, units)}, low ${formatTemp(normal.tmin, units)}. `
      : '') +
    (warmest?.tmax != null
      ? `Warmest high ${formatTemp(warmest.tmax, units)} in ${warmest.year}. `
      : '') +
    (coldest?.tmin != null ? `Coldest low ${formatTemp(coldest.tmin, units)} in ${coldest.year}.` : '');

  const mid = Math.floor((years.length - 1) / 2);
  const ticks = [0, mid, years.length - 1];

  const handlePointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (e.pointerType !== 'mouse') {
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* pointer already inactive — ignore */
      }
    }
    setActive(indexFromClientX(e.clientX, e.currentTarget));
  };
  const handlePointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (e.pointerType !== 'mouse' && e.buttons === 0) return;
    setActive(indexFromClientX(e.clientX, e.currentTarget));
  };

  return (
    <div ref={wrapRef} className="relative w-full">
      <svg
        width={width}
        height={height}
        className="block touch-pan-y"
        role="img"
        aria-label={aria}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerLeave={() => setActive(null)}
        onPointerCancel={() => setActive(null)}
      >
        {/* 30-year normal lines */}
        {normal.tmax != null ? (
          <g>
            <line
              x1={geom.padX}
              x2={width - LABEL_W}
              y1={geom.yOf(normal.tmax)}
              y2={geom.yOf(normal.tmax)}
              stroke={WARM}
              strokeWidth={1.25}
              strokeDasharray="5 5"
              opacity={0.55}
            />
            <text
              x={width - LABEL_W + 6}
              y={geom.yOf(normal.tmax)}
              dominantBaseline="central"
              fontSize={10}
              className="tnum"
              style={{ fill: WARM }}
            >
              H {formatTemp(normal.tmax, units)}
            </text>
          </g>
        ) : null}
        {normal.tmin != null ? (
          <g>
            <line
              x1={geom.padX}
              x2={width - LABEL_W}
              y1={geom.yOf(normal.tmin)}
              y2={geom.yOf(normal.tmin)}
              stroke={COOL}
              strokeWidth={1.25}
              strokeDasharray="5 5"
              opacity={0.55}
            />
            <text
              x={width - LABEL_W + 6}
              y={geom.yOf(normal.tmin)}
              dominantBaseline="central"
              fontSize={10}
              className="tnum"
              style={{ fill: COOL }}
            >
              L {formatTemp(normal.tmin, units)}
            </text>
          </g>
        ) : null}

        {/* year dots */}
        {years.map((y, i) => {
          if (y.tmax == null && y.tmin == null) return null;
          return (
            <g key={y.year}>
              {y.tmin != null && normal.tmin != null ? (
                <circle
                  cx={geom.xOf(i)}
                  cy={geom.yOf(y.tmin)}
                  r={2.75}
                  fill={y.tmin >= normal.tmin ? WARM : COOL}
                  opacity={0.5}
                />
              ) : null}
              {y.tmax != null && normal.tmax != null ? (
                <circle
                  cx={geom.xOf(i)}
                  cy={geom.yOf(y.tmax)}
                  r={activeIdx === i ? 5.5 : 4.25}
                  fill={y.tmax > normal.tmax ? WARM : COOL}
                  stroke="rgb(255 255 255 / 0.75)"
                  strokeWidth={1}
                />
              ) : null}
              {activeIdx === i ? (
                <line
                  x1={geom.xOf(i)}
                  x2={geom.xOf(i)}
                  y1={CHART_TOP}
                  y2={height - CHART_BOTTOM}
                  stroke="var(--surface-muted)"
                  strokeWidth={1}
                  strokeDasharray="3 3"
                  opacity={0.6}
                />
              ) : null}
            </g>
          );
        })}

        {/* year ticks */}
        {ticks.map((i) => (
          <text
            key={i}
            x={clamp(geom.xOf(i), 16, width - LABEL_W - 16)}
            y={height - 6}
            textAnchor="middle"
            fontSize={10}
            className="tnum"
            style={{ fill: 'var(--surface-muted)' }}
          >
            {years[i].year}
          </text>
        ))}
      </svg>

      {/* tooltip (year, tmax/tmin) */}
      {activeIdx !== null && activeYear && tipStyle ? (
        <div
          className="glass-strong text-surface pointer-events-none absolute z-20 rounded-xl px-3 py-2 shadow-glass"
          style={tipStyle}
        >
          <div className="tnum text-[11px] text-surface-muted">{activeYear.year}</div>
          <div className="tnum text-sm font-medium">
            {activeYear.tmax != null
              ? `H ${formatTemp(activeYear.tmax, units)}`
              : 'H —'}
            <span className="mx-1 text-surface-faint">·</span>
            {activeYear.tmin != null ? `L ${formatTemp(activeYear.tmin, units)}` : 'L —'}
          </div>
          {activeYear.tmax == null && activeYear.tmin == null ? (
            <div className="text-[11px] text-surface-faint">No data (not a leap year)</div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The card                                                            */
/* ------------------------------------------------------------------ */

export function TimeMachineCard({ city, bundle, units }: TimeMachineCardProps): JSX.Element {
  const today = bundle.daily[0];
  const todayMonth = today ? Number(today.date.slice(5, 7)) : 1;
  const todayDay = today ? Number(today.date.slice(8, 10)) : 1;

  const [month, setMonth] = useState(todayMonth);
  const [day, setDay] = useState(todayDay);

  const lat = Math.round(city.latitude * 1000) / 1000;
  const lon = Math.round(city.longitude * 1000) / 1000;

  const query = useQuery<HistoricalOrError, Error>({
    queryKey: ['historical', lat, lon, month, day],
    queryFn: async ({ signal }) => {
      const res = await fetch(
        `/api/historical?lat=${lat}&lon=${lon}&month=${month}&day=${day}`,
        { signal },
      );
      if (!res.ok) throw new Error(`Historical request failed (${res.status})`);
      return (await res.json()) as HistoricalOrError;
    },
    staleTime: 10 * 60_000,
    gcTime: 60 * 60_000,
    retry: 1,
  });

  const data = query.data ?? null;
  const failed = query.isError || (data != null && isHistoricalError(data));
  const dateLabel = `${MONTHS[month - 1]} ${day}`;
  const isToday = month === todayMonth && day === todayDay;

  const dayOptions = useMemo(() => {
    const count = daysInMonth(month);
    return Array.from({ length: count }, (_, i) => i + 1);
  }, [month]);

  const handleMonthChange = (nextMonth: number) => {
    setMonth(nextMonth);
    setDay((d) => Math.min(d, daysInMonth(nextMonth)));
  };

  /* --- today's badge (only when the picked date is today) --- */
  const normal = data && !isHistoricalError(data) ? data.normal : null;
  const badge = useMemo(() => {
    if (!isToday || !today || !normal || normal.tmax == null) return null;
    const deltaC = today.tempMax - normal.tmax;
    const delta = units === 'metric' ? deltaC : deltaC * 1.8;
    if (Math.abs(deltaC) < 0.5) {
      return {
        tone: 'neutral' as const,
        text: 'Right on the 30-year normal',
      };
    }
    return {
      tone: deltaC > 0 ? ('warm' as const) : ('cool' as const),
      text: `${Math.abs(delta).toFixed(1)}° ${deltaC > 0 ? 'warmer' : 'cooler'} than the 30-year normal`,
    };
  }, [isToday, today, normal, units]);

  const loading = query.isPending && !data;

  return (
    <div className="glass animate-fade-up rounded-[var(--radius-card)] p-4 shadow-[var(--shadow-glass)] sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="flex items-center gap-1.5 card-label">
            <Icon name="sunset" size={14} strokeWidth={2} aria-hidden="true" />
            Time machine
          </p>
          <p className="mt-1 text-xs text-surface-faint">
            {dateLabel} in {city.name} · 30 years of ERA5 reanalysis
          </p>
        </div>

        {/* today-comparison badge OR the plain normal summary */}
        {badge ? (
          <span
            className={cn(
              'sky-chip tnum rounded-full px-3 py-1.5 text-[11px] font-semibold',
              badge.tone === 'warm' && 'sky-tone-warm',
              badge.tone === 'cool' && 'sky-tone-cool',
            )}
          >
            {badge.tone === 'warm' ? '↑ ' : badge.tone === 'cool' ? '↓ ' : ''}
            {badge.text}
          </span>
        ) : normal && normal.tmax != null && normal.tmin != null ? (
          <span className="glass-subtle tnum rounded-full px-3 py-1.5 text-[11px] font-medium text-surface">
            30-year normal: H {formatTemp(normal.tmax, units)} / L {formatTemp(normal.tmin, units)}
          </span>
        ) : null}
      </div>

      {/* --- date picker --- */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <div className="relative">
          <select
            aria-label="Month"
            value={month}
            onChange={(e) => handleMonthChange(Number(e.target.value))}
            className="glass-subtle glass-hover focus-ring cursor-pointer appearance-none rounded-xl py-2 pl-3 pr-8 text-sm text-surface"
          >
            {MONTHS.map((m, i) => (
              <option key={m} value={i + 1}>
                {m}
              </option>
            ))}
          </select>
          <Icon
            name="chevron-down"
            size={13}
            className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-surface-faint"
          />
        </div>
        <div className="relative">
          <select
            aria-label="Day"
            value={day}
            onChange={(e) => setDay(Number(e.target.value))}
            className="glass-subtle glass-hover focus-ring tnum cursor-pointer appearance-none rounded-xl py-2 pl-3 pr-8 text-sm text-surface"
          >
            {dayOptions.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          <Icon
            name="chevron-down"
            size={13}
            className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-surface-faint"
          />
        </div>
        {!isToday ? (
          <button
            type="button"
            onClick={() => {
              setMonth(todayMonth);
              setDay(todayDay);
            }}
            className="glass-subtle glass-hover focus-ring rounded-full px-3 py-1.5 text-xs text-surface-muted"
          >
            Back to today
          </button>
        ) : null}
      </div>

      {/* --- chart / states --- */}
      <div className="mt-4">
        {loading ? (
          <div aria-busy="true" aria-label="Loading 30 years of ERA5 data">
            <p className="text-xs text-surface-muted">
              Crunching 30 years of ERA5…{' '}
              <span className="text-surface-faint">the first look per city can take a few seconds</span>
            </p>
            <div className="skeleton mt-3 h-[150px] w-full rounded-xl" aria-hidden="true" />
            <div className="skeleton mt-3 h-3 w-2/5" aria-hidden="true" />
          </div>
        ) : failed ? (
          <div className="flex flex-col items-start gap-2.5 py-4">
            <p className="text-xs text-surface-muted">
              Historical climate data is unavailable right now — the ERA5 archive may be slow.
            </p>
            <button
              type="button"
              onClick={() => void query.refetch()}
              className="glass-subtle glass-hover focus-ring flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs text-surface"
            >
              <Icon name="refresh" size={13} strokeWidth={2} aria-hidden="true" />
              Retry
            </button>
          </div>
        ) : data && !isHistoricalError(data) ? (
          data.normal.tmax == null && data.years.every((y) => y.tmax == null && y.tmin == null) ? (
            <div className="flex flex-col items-start gap-1 py-6">
              <p className="text-sm font-medium text-surface">No data for this date</p>
              <p className="text-xs text-surface-muted">
                {dateLabel} has no ERA5 records here — try another day.
              </p>
            </div>
          ) : (
            <>
              <HistoricalChart
                years={data.years}
                normal={data.normal}
                units={units}
                dateLabel={dateLabel}
              />
              <p className="tnum mt-3 text-[11px] leading-relaxed text-surface-faint">
                Each dot is one year — large dots are daily highs (amber above the normal,
                teal below), small dots are lows. Dashed lines mark the 30-year normal.
              </p>
            </>
          )
        ) : null}
      </div>
    </div>
  );
}
