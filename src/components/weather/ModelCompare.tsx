'use client';

import { useMemo, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';
import type { UseQueryResult } from '@tanstack/react-query';
import { Icon } from '@/components/icons/Icon';
import { SegmentedControl } from '@/components/glass/SegmentedControl';
import { formatPrecip, formatTemp, formatWeekday } from '@/lib/units';
import { cn } from '@/lib/utils';
import { AURORA_400, AURORA_300, clamp, f, smoothPath, useChartWidth } from '@/components/weather/chart-helpers';
import type { ModelsResponse, Units } from '@/types/weather';

/* ================================================================== */
/* ModelCompare — ECMWF / GFS / ICON side by side over the next 7 days. */
/* Temp view: three smoothed curves. Precip view: three step-ish lines.*/
/* Divergence note from the max inter-model temp gap (≥ 2.5 °C).        */
/* ================================================================== */

import type { ModelSeries } from '@/types/weather';

interface ModelCompareProps {
  units: Units;
  /** Shared per-coordinates models query (owned by ForecastSections). */
  query: UseQueryResult<ModelsResponse, Error>;
}

interface ModelStyle {
  color: string;
  dash?: string;
}

const MODEL_STYLES: Record<string, ModelStyle> = {
  ecmwf: { color: AURORA_400 }, // solid aurora
  gfs: { color: '#F0954A', dash: '7 4' }, // dashed warm
  icon: { color: AURORA_300, dash: '1.5 4' }, // dotted cool
};

const TOP_PAD = 18;
const BOTTOM_PAD = 26;
const DIVERGENCE_C = 2.5;

type Metric = 'temp' | 'precip';

function seriesValues(model: ModelSeries, metric: Metric): number[] {
  return model.hourly.map((p) => (metric === 'temp' ? p.temp : p.precip));
}

function polyline(xs: number[], ys: number[]): string {
  return xs.map((x, i) => `${i === 0 ? 'M' : 'L'} ${f(x)} ${f(ys[i])}`).join(' ');
}

export function ModelCompare({ units, query }: ModelCompareProps) {
  const models = query.data?.models ?? null;
  const [wrapRef, width] = useChartWidth<HTMLDivElement>();
  const [metric, setMetric] = useState<Metric>('temp');
  const [active, setActive] = useState<number | null>(null);

  const ready = models != null && models.length > 0;

  /* Times + aligned per-model value arrays (all models share the clock). */
  const aligned = useMemo(() => {
    if (!ready) return null;
    const length = Math.min(...models.map((m) => m.hourly.length));
    if (length < 2) return null;
    const times = models[0].hourly.slice(0, length).map((p) => p.time);
    const series = models.map((model) => seriesValues(model, metric).slice(0, length));
    return { times, series };
  }, [models, metric, ready]);

  const geom = useMemo(() => {
    if (!aligned || width < 80) return null;
    const { times, series } = aligned;
    const n = times.length;
    const compact = width < 420;
    const height = compact ? 180 : 200;
    const padX = compact ? 10 : 14;
    const slot = (width - padX * 2) / (n - 1);
    const xs = times.map((_, i) => f(padX + slot * i));

    let lo = metric === 'temp' ? Infinity : 0;
    let hi = metric === 'temp' ? -Infinity : 0.1;
    for (const values of series) {
      for (const v of values) {
        if (metric === 'temp') {
          lo = Math.min(lo, v);
          hi = Math.max(hi, v);
        } else {
          hi = Math.max(hi, v);
        }
      }
    }
    if (metric === 'temp') {
      const pad = Math.max((hi - lo) * 0.12, 1);
      lo -= pad;
      hi += pad;
    } else {
      hi = Math.max(hi * 1.15, 0.5);
    }

    const top = TOP_PAD;
    const bottom = height - BOTTOM_PAD;
    const yOf = (v: number) => bottom - ((v - lo) / (hi - lo)) * (bottom - top);
    const paths = series.map((values, i) =>
      metric === 'temp'
        ? smoothPath(xs.map((x, j) => ({ x, y: f(yOf(values[j])) })))
        : polyline(xs, values.map((v) => f(yOf(v)))),
    );

    // Day labels at local midnight boundaries.
    const dayTicks = times
      .map((time, i) => ({ time, x: xs[i], i }))
      .filter((p) => p.time.endsWith('T00:00'));

    return { height, padX, slot, xs, n, lo, hi, yOf, paths, dayTicks, top, bottom };
  }, [aligned, width, metric]);

  /* Divergence: max inter-model temp gap (always computed from temps). */
  const divergence = useMemo(() => {
    if (!ready || models.length < 2) return null;
    const length = Math.min(...models.map((m) => m.hourly.length));
    let best: { gap: number; index: number; warm: ModelSeries; cool: ModelSeries } | null = null;
    for (let i = 0; i < length; i++) {
      let min = Infinity;
      let max = -Infinity;
      let warm: ModelSeries = models[0];
      let cool: ModelSeries = models[0];
      for (const model of models) {
        const t = model.hourly[i]?.temp;
        if (!Number.isFinite(t)) continue;
        if (t < min) {
          min = t;
          cool = model;
        }
        if (t > max) {
          max = t;
          warm = model;
        }
      }
      const gap = max - min;
      if (!best || gap > best.gap) best = { gap, index: i, warm, cool };
    }
    if (!best || best.gap < DIVERGENCE_C) return null;
    return best;
  }, [models, ready]);

  const activeIdx =
    active !== null && aligned && active < aligned.times.length ? active : null;
  const showActive = geom !== null && aligned !== null && activeIdx !== null;

  let ax = 0;
  if (geom && activeIdx != null) ax = geom.xs[activeIdx];

  const handleKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!aligned) return;
    const last = aligned.times.length - 1;
    let next: number | null = null;
    switch (e.key) {
      case 'ArrowRight':
        next = activeIdx === null ? 0 : Math.min(activeIdx + 1, last);
        break;
      case 'ArrowLeft':
        next = activeIdx === null ? last : Math.max(activeIdx - 1, 0);
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = last;
        break;
      case 'Escape':
        setActive(null);
        break;
      default:
        return;
    }
    e.preventDefault();
    if (next !== null) setActive(next);
  };

  const indexFromClientX = (clientX: number, rect: DOMRect): number => {
    if (!geom || !aligned) return 0;
    return clamp(Math.round((clientX - rect.left - geom.padX) / geom.slot), 0, aligned.times.length - 1);
  };

  const handlePointerDown = (e: ReactPointerEvent<SVGRectElement>) => {
    if (e.pointerType !== 'mouse') {
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* pointer already inactive */
      }
    }
    setActive(indexFromClientX(e.clientX, e.currentTarget.getBoundingClientRect()));
  };
  const handlePointerMove = (e: ReactPointerEvent<SVGRectElement>) => {
    if (e.pointerType !== 'mouse' && e.buttons === 0) return;
    setActive(indexFromClientX(e.clientX, e.currentTarget.getBoundingClientRect()));
  };

  if (query.isPending && !models) {
    return (
      <div className="glass rounded-[var(--radius-card)] p-5" aria-busy="true">
        <p className="flex items-center gap-1.5 card-label">
          <Icon name="layers" size={14} strokeWidth={2} />
          Model comparison
        </p>
        <div className="skeleton mt-4 h-6 w-36" aria-hidden="true" />
        <div className="skeleton mt-4 h-[180px] w-full" aria-hidden="true" />
      </div>
    );
  }

  if (!ready || !aligned) return null;

  const formatValue = (v: number) => (metric === 'temp' ? formatTemp(v, units) : formatPrecip(v, units));

  const divergenceNote = divergence
    ? (() => {
        const day = aligned.times[divergence.index] ?? '';
        const weekday = formatWeekday(day) || day.slice(5);
        const gapDisplay = Math.round(units === 'metric' ? divergence.gap : divergence.gap * 1.8);
        return `${divergence.warm.label.split(' ')[0]} runs ${gapDisplay}° warmer than ${
          divergence.cool.label.split(' ')[0]
        } on ${weekday}`;
      })()
    : 'Models are in close agreement over the next 7 days';

  const ariaSummary = `Model comparison chart, ${
    metric === 'temp' ? 'temperature' : 'precipitation'
  } over the next 7 days. ${divergenceNote}.`;

  return (
    <div className="glass animate-fade-up flex h-full flex-col rounded-[var(--radius-card)] p-4 shadow-[var(--shadow-glass)] sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 card-label">
          <Icon name="layers" size={14} strokeWidth={2} aria-hidden="true" />
          Model comparison
        </p>
        <SegmentedControl
          aria-label="Model metric"
          options={[
            { id: 'temp' as Metric, label: 'Temp' },
            { id: 'precip' as Metric, label: 'Precip' },
          ]}
          value={metric}
          onChange={setMetric}
        />
      </div>

      {/* Legend chips */}
      <div className="mt-3 flex flex-wrap items-center gap-x-3.5 gap-y-1.5">
        {models.map((model) => {
          const style = MODEL_STYLES[model.id] ?? { color: AURORA_400 };
          return (
            <span key={model.id} className="flex items-center gap-1.5 text-[11px] text-surface-muted">
              <svg width="20" height="4" viewBox="0 0 20 4" aria-hidden="true" className="shrink-0">
                <line
                  x1="1"
                  y1="2"
                  x2="19"
                  y2="2"
                  stroke={style.color}
                  strokeWidth="2.4"
                  strokeDasharray={style.dash}
                  strokeLinecap="round"
                />
              </svg>
              {model.label}
            </span>
          );
        })}
      </div>

      <div
        ref={wrapRef}
        role="img"
        aria-label={ariaSummary}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        className="focus-ring relative mt-2 w-full select-none"
      >
        {!geom ? (
          <div className="skeleton h-[180px] w-full" aria-hidden="true" />
        ) : (
          <>
            <svg width={width} height={geom.height} className="block" style={{ touchAction: 'pan-y' }} aria-hidden="true">
              {/* faint y gridlines: min / mid / max */}
              {[geom.lo, (geom.lo + geom.hi) / 2, geom.hi].map((v, i) => {
                const y = f(geom.yOf(metric === 'temp' ? v : i === 0 ? 0 : v));
                return (
                  <g key={i}>
                    <line
                      x1={2}
                      x2={width - 2}
                      y1={y}
                      y2={y}
                      stroke="var(--surface-border)"
                      strokeWidth={0.6}
                      opacity={0.55}
                    />
                    <text
                      x={3}
                      y={y - 3}
                      fontSize={9}
                      className="tnum"
                      style={{ fill: 'var(--surface-faint)' }}
                    >
                      {metric === 'temp'
                        ? formatValue(v)
                        : formatValue(i === 0 ? 0 : v)}
                    </text>
                  </g>
                );
              })}

              {/* scrub guide */}
              {showActive ? (
                <line
                  x1={ax}
                  x2={ax}
                  y1={TOP_PAD - 8}
                  y2={geom.bottom}
                  stroke="var(--surface-muted)"
                  strokeWidth={1}
                  strokeDasharray="3 3"
                  opacity={0.6}
                />
              ) : null}

              {/* one path per model */}
              {geom.paths.map((d, i) => {
                const style = MODEL_STYLES[models[i].id] ?? { color: AURORA_400 };
                return (
                  <path
                    key={models[i].id}
                    d={d}
                    fill="none"
                    stroke={style.color}
                    strokeWidth={metric === 'temp' ? 2 : 1.6}
                    strokeDasharray={style.dash}
                    strokeLinecap={metric === 'temp' ? 'round' : 'butt'}
                    strokeLinejoin="round"
                    opacity={0.95}
                  />
                );
              })}

              {/* active dots */}
              {showActive
                ? models.map((model, i) => {
                    const value = aligned.series[i][activeIdx ?? 0];
                    const style = MODEL_STYLES[model.id] ?? { color: AURORA_400 };
                    return (
                      <circle
                        key={model.id}
                        cx={ax}
                        cy={f(geom.yOf(value))}
                        r={3.4}
                        fill={style.color}
                        stroke="rgb(255 255 255 / 0.9)"
                        strokeWidth={1.2}
                      />
                    );
                  })
                : null}

              {/* weekday labels at midnight boundaries */}
              {geom.dayTicks.map((tick) => (
                <text
                  key={tick.i}
                  x={clamp(tick.x, 16, width - 16)}
                  y={geom.height - 8}
                  textAnchor="middle"
                  fontSize={10}
                  className="tnum"
                  style={{ fill: 'var(--surface-muted)' }}
                >
                  {formatWeekday(tick.time)}
                </text>
              ))}

              {/* interaction surface */}
              <rect
                x={0}
                y={0}
                width={width}
                height={geom.height}
                fill="transparent"
                style={{ cursor: 'crosshair', touchAction: 'pan-y' }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerLeave={() => setActive(null)}
                onPointerCancel={() => setActive(null)}
              />
            </svg>

            {/* tooltip */}
            {showActive && activeIdx != null ? (
              <div
                className="glass-strong text-surface pointer-events-none absolute top-0 z-20 rounded-xl px-3 py-2 shadow-glass"
                style={{
                  left: clamp(ax, 96, Math.max(width - 96, 96)),
                  transform: ax > width - 96 ? 'translateX(calc(-100% - 10px))' : 'translateX(10px)',
                }}
              >
                <div className="tnum text-[11px] font-semibold text-surface-muted">
                  {aligned.times[activeIdx].slice(5, 10).replace('-', '/')} ·{' '}
                  {formatWeekday(aligned.times[activeIdx])}
                </div>
                <div className="mt-1 flex flex-col gap-0.5">
                  {models.map((model, i) => {
                    const style = MODEL_STYLES[model.id] ?? { color: AURORA_400 };
                    return (
                      <span key={model.id} className="tnum flex items-center gap-2 text-xs">
                        <svg width="14" height="4" viewBox="0 0 14 4" aria-hidden="true">
                          <line
                            x1="1"
                            y1="2"
                            x2="13"
                            y2="2"
                            stroke={style.color}
                            strokeWidth="2.2"
                            strokeDasharray={style.dash}
                            strokeLinecap="round"
                          />
                        </svg>
                        <span className="w-14 truncate text-surface-muted">{model.label.split(' ')[0]}</span>
                        <span className="font-semibold">{formatValue(aligned.series[i][activeIdx])}</span>
                      </span>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </>
        )}
        <div className="sr-only" aria-live="polite">
          {showActive && activeIdx != null
            ? models
                .map((model, i) => `${model.label} ${formatValue(aligned.series[i][activeIdx])}`)
                .join(', ')
            : ''}
        </div>
      </div>

      <p className="tnum mt-2.5 text-xs leading-relaxed text-surface-muted">
        <span className="font-semibold text-surface">{divergenceNote}</span>
        <span className="text-surface-faint"> · 7-day horizon, hourly steps</span>
      </p>
    </div>
  );
}
