'use client';

import { useMemo, useId, useState } from 'react';
import type { ReactNode } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Glass } from '@/components/glass/Glass';
import { Icon } from '@/components/icons/Icon';
import { TemperatureChart } from '@/components/weather/TemperatureChart';
import {
  AURORA_300,
  AURORA_400,
  clamp,
  f,
  smoothPath,
  useChartWidth,
} from '@/components/weather/chart-helpers';
import {
  formatPrecip,
  formatPressure,
  formatTemp,
  formatVisibility,
  formatWind,
} from '@/lib/units';
import { cn } from '@/lib/utils';
import type { Units, WeatherBundle } from '@/types/weather';

/* ================================================================== */
/* ExpandableCard — Apple Weather-style detail sheets.                 */
/*                                                                    */
/* A metric card whose header (whole row + chevron) is a Radix dialog  */
/* trigger. The overlay is full-screen on mobile and a large centered  */
/* glass dialog on desktop, showing the metric's 48-hour chart with    */
/* scrub tooltip, a switcher between related metrics, and min/avg/max  */
/* summary stats. Radix provides focus trap, Esc-to-close, aria-modal  */
/* and focus restoration for free.                                     */
/* ================================================================== */

export type MetricGroupId =
  | 'temp'
  | 'humidity'
  | 'wind'
  | 'uv'
  | 'pressure'
  | 'visibility'
  | 'precip'
  | 'cloud';

interface MetricTabDef {
  key: string;
  label: string;
  /** 48h hourly values; absent → current-only view (no trend exists). */
  values?: (bundle: WeatherBundle) => number[];
  /** Current reading. */
  current: (bundle: WeatherBundle) => number;
  /** Value formatter shared by chart tooltip + stats chips. */
  format: (value: number, units: Units) => string;
  /** Shown under the big value on current-only tabs. */
  caption?: (bundle: WeatherBundle, units: Units) => string;
}

function dewPoint(celsius: number, humidity: number): number {
  const a = 17.27;
  const b = 237.7;
  const alpha = Math.log(Math.max(humidity, 1) / 100) + (a * celsius) / (b + celsius);
  return (b * alpha) / (a - alpha);
}

const METRIC_GROUPS: Record<MetricGroupId, { tabs: MetricTabDef[] }> = {
  temp: {
    tabs: [
      {
        key: 'temp',
        label: 'Temperature',
        values: (b) => b.hourly.map((h) => h.temperature),
        current: (b) => b.current.temperature,
        format: (v, u) => formatTemp(v, u),
      },
      {
        key: 'feels',
        label: 'Feels like',
        current: (b) => b.current.apparentTemperature,
        format: (v, u) => formatTemp(v, u),
        caption: (b, u) =>
          b.current.apparentTemperature > b.current.temperature + 0.5
            ? `Humidity makes it feel warmer than the actual ${formatTemp(b.current.temperature, u)}`
            : b.current.apparentTemperature < b.current.temperature - 0.5
              ? `Wind makes it feel cooler than the actual ${formatTemp(b.current.temperature, u)}`
              : `Close to the actual ${formatTemp(b.current.temperature, u)}`,
      },
    ],
  },
  humidity: {
    tabs: [
      {
        key: 'humidity',
        label: 'Humidity',
        current: (b) => b.current.humidity,
        format: (v) => `${Math.round(v)}%`,
        caption: (b, u) =>
          `Dew point ${formatTemp(dewPoint(b.current.temperature, b.current.humidity), u)}`,
      },
      {
        key: 'dew',
        label: 'Dew point',
        current: (b) => dewPoint(b.current.temperature, b.current.humidity),
        format: (v, u) => formatTemp(v, u),
        caption: (b, u) =>
          `At ${Math.round(b.current.humidity)}% relative humidity (air ${formatTemp(b.current.temperature, u)})`,
      },
    ],
  },
  wind: {
    tabs: [
      {
        key: 'wind',
        label: 'Wind speed',
        values: (b) => b.hourly.map((h) => h.windSpeed),
        current: (b) => b.current.windSpeed,
        format: (v, u) => formatWind(v, u),
      },
      {
        key: 'gusts',
        label: 'Gusts',
        current: (b) => b.current.windGust,
        format: (v, u) => formatWind(v, u),
        caption: (b, u) => `Sustained wind ${formatWind(b.current.windSpeed, u)}`,
      },
    ],
  },
  uv: {
    tabs: [
      {
        key: 'uv',
        label: 'UV index',
        values: (b) => b.hourly.map((h) => h.uvIndex),
        current: (b) => b.hourly[0]?.uvIndex ?? 0,
        format: (v) => v.toFixed(1),
      },
    ],
  },
  pressure: {
    tabs: [
      {
        key: 'pressure',
        label: 'Pressure',
        current: (b) => b.current.pressure,
        format: (v, u) => formatPressure(v, u),
        caption: (b) =>
          `${b.current.pressure < 1000 ? 'Low' : b.current.pressure > 1025 ? 'High' : 'Normal'} · measured at sea level`,
      },
    ],
  },
  visibility: {
    tabs: [
      {
        key: 'visibility',
        label: 'Visibility',
        values: (b) => b.hourly.map((h) => h.visibility),
        current: (b) => b.hourly[0]?.visibility ?? 24_000,
        format: (v, u) => formatVisibility(v, u),
      },
    ],
  },
  precip: {
    tabs: [
      {
        key: 'precip',
        label: 'Amount',
        values: (b) => b.hourly.map((h) => h.precipitation),
        current: (b) => b.current.precipitation,
        format: (v, u) => formatPrecip(v, u),
      },
      {
        key: 'chance',
        label: 'Chance',
        values: (b) => b.hourly.map((h) => h.precipitationProbability),
        current: (b) => b.hourly[0]?.precipitationProbability ?? 0,
        format: (v) => `${Math.round(v)}%`,
      },
    ],
  },
  cloud: {
    tabs: [
      {
        key: 'cloud',
        label: 'Cloud cover',
        current: (b) => b.current.cloudCover,
        format: (v) => `${Math.round(v)}%`,
        caption: () => 'Fraction of the sky covered by clouds right now',
      },
    ],
  },
};

/* ------------------------------------------------------------------ */
/* Generic single-series 48h line chart with scrub tooltip + keyboard  */
/* ------------------------------------------------------------------ */

function MetricLineChart({
  times,
  values,
  format,
  ariaLabel,
}: {
  times: string[];
  values: number[];
  format: (value: number) => string;
  ariaLabel: string;
}) {
  const [wrapRef, width] = useChartWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const rawId = useId();
  const gid = `mlc${rawId.replace(/[^a-zA-Z0-9]/g, '')}`;

  const chart = useMemo(() => {
    if (values.length < 2 || width < 80) return null;
    const n = values.length;
    const height = 240;
    const padX = 14;
    const slot = (width - padX * 2) / (n - 1);
    const xs = values.map((_, i) => f(padX + slot * i));
    let vMin = Infinity;
    let vMax = -Infinity;
    for (const v of values) {
      vMin = Math.min(vMin, v);
      vMax = Math.max(vMax, v);
    }
    const pad = Math.max((vMax - vMin) * 0.14, vMax * 0.04, 0.1);
    const lo = vMin - pad;
    const hi = vMax + pad;
    const top = 16;
    const bottom = height - 34;
    const ys = values.map((v) => f(bottom - ((v - lo) / (hi - lo)) * (bottom - top)));
    const line = smoothPath(xs.map((x, i) => ({ x, y: ys[i] })));
    const area = `${line} L ${f(xs[n - 1])} ${bottom} L ${f(xs[0])} ${bottom} Z`;
    return { height, padX, slot, xs, ys, line, area, bottom, labelEvery: n > 36 ? 6 : 3 };
  }, [values, width]);

  const activeIdx = active !== null && chart && active < values.length ? active : null;

  const handleKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!chart) return;
    const last = values.length - 1;
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
    if (!chart) return 0;
    return clamp(Math.round((clientX - rect.left - chart.padX) / chart.slot), 0, values.length - 1);
  };

  return (
    <div
      ref={wrapRef}
      role="img"
      aria-label={ariaLabel}
      tabIndex={chart ? 0 : undefined}
      onKeyDown={chart ? handleKeyDown : undefined}
      className="focus-ring relative w-full select-none"
    >
      {!chart ? (
        <div className="skeleton h-[240px] w-full" aria-hidden="true" />
      ) : (
        <>
          <svg width={width} height={chart.height} className="block" style={{ touchAction: 'pan-y' }} aria-hidden="true">
            <defs>
              <linearGradient id={`${gid}-area`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="rgb(69 209 179 / 0.22)" />
                <stop offset="1" stopColor="rgb(69 209 179 / 0)" />
              </linearGradient>
              <linearGradient id={`${gid}-stroke`} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stopColor={AURORA_400} />
                <stop offset="1" stopColor={AURORA_300} />
              </linearGradient>
            </defs>

            <path d={chart.area} fill={`url(#${gid}-area)`} />

            {activeIdx != null ? (
              <line
                x1={chart.xs[activeIdx]}
                x2={chart.xs[activeIdx]}
                y1={10}
                y2={chart.bottom}
                stroke="var(--surface-muted)"
                strokeWidth={1}
                strokeDasharray="3 3"
                opacity={0.6}
              />
            ) : null}

            <path
              d={chart.line}
              fill="none"
              stroke={`url(#${gid}-stroke)`}
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* now marker */}
            <circle cx={chart.xs[0]} cy={chart.ys[0]} r={8} fill={AURORA_400} fillOpacity={0.3} className="animate-pulse-soft" />
            <circle cx={chart.xs[0]} cy={chart.ys[0]} r={4} fill={AURORA_400} stroke="rgb(255 255 255 / 0.9)" strokeWidth={1.5} />

            {activeIdx != null ? (
              <circle
                cx={chart.xs[activeIdx]}
                cy={chart.ys[activeIdx]}
                r={4.5}
                fill={AURORA_400}
                stroke="rgb(255 255 255 / 0.9)"
                strokeWidth={1.5}
              />
            ) : null}

            {times.map((time, i) =>
              i % chart.labelEvery === 0 ? (
                <text
                  key={time}
                  x={clamp(chart.xs[i], 16, width - 16)}
                  y={chart.height - 10}
                  textAnchor="middle"
                  fontSize={10}
                  className="tnum"
                  style={{ fill: 'var(--surface-muted)' }}
                >
                  {i === 0 ? 'Now' : time.slice(11, 16)}
                </text>
              ) : null,
            )}

            <rect
              x={0}
              y={0}
              width={width}
              height={chart.height}
              fill="transparent"
              style={{ cursor: 'crosshair', touchAction: 'pan-y' }}
              onPointerDown={(e: ReactPointerEvent<SVGRectElement>) => {
                if (e.pointerType !== 'mouse') {
                  try {
                    e.currentTarget.setPointerCapture(e.pointerId);
                  } catch {
                    /* pointer already inactive */
                  }
                }
                setActive(indexFromClientX(e.clientX, e.currentTarget.getBoundingClientRect()));
              }}
              onPointerMove={(e: ReactPointerEvent<SVGRectElement>) => {
                if (e.pointerType !== 'mouse' && e.buttons === 0) return;
                setActive(indexFromClientX(e.clientX, e.currentTarget.getBoundingClientRect()));
              }}
              onPointerLeave={() => setActive(null)}
              onPointerCancel={() => setActive(null)}
            />
          </svg>

          {activeIdx != null ? (
            <div
              className="glass-strong text-surface pointer-events-none absolute top-0 z-20 rounded-xl px-3 py-2 shadow-glass"
              style={{
                left: clamp(chart.xs[activeIdx], 90, Math.max(width - 90, 90)),
                transform:
                  chart.xs[activeIdx] > width - 90
                    ? 'translateX(calc(-100% - 10px))'
                    : 'translateX(10px)',
              }}
            >
              <div className="tnum text-[11px] text-surface-muted">
                {activeIdx === 0 ? 'Now' : times[activeIdx].slice(11, 16)}
              </div>
              <div className="tnum text-sm font-semibold">{format(values[activeIdx])}</div>
            </div>
          ) : null}
        </>
      )}
      <div className="sr-only" aria-live="polite">
        {activeIdx != null ? `${activeIdx === 0 ? 'Now' : times[activeIdx].slice(11, 16)} · ${format(values[activeIdx])}` : ''}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Registry-driven detail body (chart + switcher + stats)              */
/* ------------------------------------------------------------------ */

function MetricDetailBody({
  group,
  bundle,
  units,
  activeTab,
  onTabChange,
}: {
  group: MetricGroupId;
  bundle: WeatherBundle;
  units: Units;
  activeTab: string;
  onTabChange: (key: string) => void;
}) {
  const def = METRIC_GROUPS[group];
  const tab = def.tabs.find((t) => t.key === activeTab) ?? def.tabs[0];
  const values = tab.values?.(bundle) ?? null;
  const currentVal = tab.current(bundle);

  // Min/avg/max over the 48h window (48 numbers — no memo needed).
  let stats: { min: number; max: number; avg: number } | null = null;
  if (values && values.length > 0) {
    let min = Infinity;
    let max = -Infinity;
    let sum = 0;
    for (const v of values) {
      min = Math.min(min, v);
      max = Math.max(max, v);
      sum += v;
    }
    stats = { min, max, avg: sum / values.length };
  }

  return (
    <>
      {def.tabs.length > 1 ? (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label={`${group} metrics`}>
          {def.tabs.map((t) => {
            const isActive = t.key === tab.key;
            return (
              <button
                key={t.key}
                type="button"
                aria-pressed={isActive}
                onClick={isActive ? undefined : () => onTabChange(t.key)}
                className={cn(
                  'focus-ring rounded-full px-3 py-1.5 text-xs font-semibold transition-all duration-200',
                  isActive
                    ? 'bg-aurora-500 text-[#04211C] shadow-[0_0_14px_-4px_rgb(34_188_160/0.8)]'
                    : 'glass-subtle text-surface-muted hover:text-surface',
                )}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      ) : null}

      {values ? (
        <div className="mt-4">
          {group === 'temp' && tab.key === 'temp' ? (
            <TemperatureChart hours={bundle.hourly} units={units} />
          ) : (
            <MetricLineChart
              times={bundle.hourly.map((h) => h.time)}
              values={values}
              format={(v) => tab.format(v, units)}
              ariaLabel={`${tab.label} over the next ${bundle.hourly.length} hours.`}
            />
          )}
          {stats ? (
            <div className="mt-4 grid grid-cols-3 gap-2">
              {(
                [
                  ['Min', stats.min],
                  ['Average', stats.avg],
                  ['Max', stats.max],
                ] as const
              ).map(([label, value]) => (
                <div key={label} className="glass-subtle rounded-2xl px-3 py-2.5 text-center">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-surface-faint">
                    {label}
                  </p>
                  <p className="tnum mt-0.5 text-sm font-semibold text-surface">
                    {tab.format(value, units)}
                  </p>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="mt-5">
          <p className="tnum font-display text-5xl font-semibold tracking-tight text-surface">
            {tab.format(currentVal, units)}
          </p>
          {tab.caption ? (
            <p className="mt-2 text-sm text-surface-muted">{tab.caption(bundle, units)}</p>
          ) : null}
          <p className="mt-4 text-xs leading-relaxed text-surface-faint">
            This metric has no hourly trend in the current forecast data — showing the latest
            reading only.
          </p>
        </div>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* The wrapper                                                         */
/* ------------------------------------------------------------------ */

interface ExpandableCardProps {
  label: string;
  icon: ReactNode;
  bundle: WeatherBundle;
  units: Units;
  /** Registry group for the default detail body. */
  group?: MetricGroupId;
  /** Fully custom detail body (used by the AQI card). Overrides `group`. */
  renderDetail?: ReactNode;
  /** Tab to open first (registry mode). */
  initialTab?: string;
  className?: string;
  children: ReactNode;
}

export function ExpandableCard({
  label,
  icon,
  bundle,
  units,
  group,
  renderDetail,
  initialTab,
  className,
  children,
}: ExpandableCardProps) {
  const [open, setOpen] = useState(false);
  const tabs = group ? METRIC_GROUPS[group].tabs : [];
  const [activeTab, setActiveTab] = useState(initialTab ?? tabs[0]?.key ?? '');
  const detailTitle = group
    ? tabs.find((t) => t.key === activeTab)?.label ?? label
    : label;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <div className={cn('glass glass-hover rounded-[var(--radius-card)] p-4', className)}>
        <DialogTrigger asChild>
          <button
            type="button"
            className="focus-ring group flex w-full items-center gap-1.5 rounded-lg text-left"
          >
            <span className="flex w-full items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-surface-muted">
              <span aria-hidden="true">{icon}</span>
              {label}
            </span>
            <span
              aria-hidden="true"
              className="ml-auto shrink-0 text-surface-faint transition-transform duration-300 ease-[var(--ease-out-expo)] group-hover:text-surface group-data-[state=open]:rotate-180"
            >
              <Icon name="chevron-down" size={14} strokeWidth={2} />
            </span>
          </button>
        </DialogTrigger>
        {children}
      </div>

      <DialogContent
        showCloseButton={false}
        className="top-0 left-0 h-dvh w-screen max-w-none translate-x-0 translate-y-0 gap-0 overflow-hidden rounded-none border-none bg-transparent p-0 text-surface shadow-none sm:top-1/2 sm:left-1/2 sm:h-auto sm:max-h-[88dvh] sm:max-w-none sm:w-[min(700px,calc(100%-2.5rem))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[var(--radius-hero)]"
      >
        <DialogTitle className="sr-only">{`${label} details`}</DialogTitle>
        <DialogDescription className="sr-only">
          {`${label} over the next 48 hours with summary statistics.`}
        </DialogDescription>
        <Glass
          level="overlay"
          className="flex h-full w-full flex-col overflow-hidden rounded-none sm:rounded-[var(--radius-hero)]"
        >
          <div className="flex items-center justify-between gap-3 px-5 pb-2 pt-4 sm:px-6 sm:pt-5">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-surface-muted">
                {label}
              </p>
              <h2 className="truncate font-display text-xl font-bold tracking-tight text-surface">
                {detailTitle}
              </h2>
            </div>
            <DialogClose
              className="glass-subtle focus-ring flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-surface transition-colors hover:text-aurora-300"
              aria-label="Close details"
            >
              <Icon name="x" size={16} strokeWidth={2} />
            </DialogClose>
          </div>

          <div className="scroll-slim min-h-0 flex-1 overflow-y-auto px-5 pb-6 sm:px-6">
            {renderDetail ?? (group ? (
              <MetricDetailBody
                group={group}
                bundle={bundle}
                units={units}
                activeTab={activeTab}
                onTabChange={setActiveTab}
              />
            ) : null)}
          </div>
        </Glass>
      </DialogContent>
    </Dialog>
  );
}
