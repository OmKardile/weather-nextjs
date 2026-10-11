'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type {
  CSSProperties,
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
} from 'react';
import type { EnsembleHourly, HourlyPoint, Units } from '@/types/weather';
import { formatHour, formatHourShort, formatTemp } from '@/lib/units';
import { cn } from '@/lib/utils';
import {
  AURORA_300,
  AURORA_400,
  AURORA_500,
  clamp,
  f,
  smoothPath,
  useMotionOk,
} from '@/components/weather/chart-helpers';

/* ------------------------------------------------------------------ */
/* Hand-rolled SVG temperature chart (Task 2-b; 17-a added the        */
/* ensemble uncertainty band)                                         */
/*                                                                    */
/* Deliberately replaces recharts (~100 kB) with a few kB of           */
/* purpose-built SVG that matches the glass design system.             */
/* Layout (top → bottom): max pill headroom · temp curve + area ·      */
/* precip probability bars · hour labels.                              */
/* ------------------------------------------------------------------ */

const TOP_PAD = 36; // headroom for the max pill
const PRECIP_MAX_BAR = 28; // px height for a 100 % chance

interface ChartData {
  temps: number[];
  probs: number[];
  maxIdx: number;
  minIdx: number;
  tMin: number;
  tMax: number;
  maxProb: number;
  allZero: boolean;
}

interface ChartGeom {
  height: number;
  padX: number;
  slot: number;
  xs: number[];
  ys: number[];
  line: string;
  area: string;
  precipBase: number;
  labelY: number;
  noteY: number;
  barW: number;
  labelEvery: number;
  /** Y-scale inputs, reused by the ensemble band. */
  lo: number;
  hi: number;
  curveBottom: number;
}

/** One contiguous run of ensemble spread values (temp ± σ) matched by time. */
interface BandSegment {
  top: string;
  bottom: string;
}

export function TemperatureChart({
  hours,
  units,
  ensemble,
  className,
}: {
  hours: HourlyPoint[];
  units: Units;
  /** Ensemble series matched by time — draws an uncertainty band behind the curve. */
  ensemble?: EnsembleHourly[] | null;
  className?: string;
}) {
  const rawId = useId();
  const gid = `tc${rawId.replace(/[^a-zA-Z0-9]/g, '')}`;
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const draggingRef = useRef(false);

  const [width, setWidth] = useState(0);
  const [motionOk, setMotionOk] = useState(false);
  const [active, setActive] = useState<number | null>(null);

  /* --- width measurement + reduced-motion (both cleaned up on unmount) --- */
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      setWidth(Math.round(entries[0]?.contentRect.width ?? 0));
    });
    ro.observe(el);
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const applyMotion = () => setMotionOk(!mq.matches);
    applyMotion();
    mq.addEventListener('change', applyMotion);
    return () => {
      ro.disconnect();
      mq.removeEventListener('change', applyMotion);
    };
  }, []);

  /* --- data-level stats (layout independent, also powers the aria-label) --- */
  const data = useMemo<ChartData | null>(() => {
    if (hours.length < 2) return null;
    const temps = hours.map((h) => h.temperature);
    const probs = hours.map((h) => clamp(h.precipitationProbability, 0, 100));
    let maxIdx = 0;
    let minIdx = 0;
    for (let i = 1; i < temps.length; i++) {
      if (temps[i] > temps[maxIdx]) maxIdx = i;
      if (temps[i] < temps[minIdx]) minIdx = i;
    }
    const maxProb = Math.max(...probs);
    return {
      temps,
      probs,
      maxIdx,
      minIdx,
      tMin: temps[minIdx],
      tMax: temps[maxIdx],
      maxProb,
      allZero: maxProb <= 0,
    };
  }, [hours]);

  /* --- geometry (depends on the measured width) --- */
  const geom = useMemo<ChartGeom | null>(() => {
    if (!data || width < 80) return null;
    const n = data.temps.length;
    const compact = width < 420;
    const height = compact ? 170 : 210;
    const padX = compact ? 10 : 16;
    const slot = (width - padX * 2) / (n - 1);
    const xs = data.temps.map((_, i) => f(padX + slot * i));
    // Headroom around the extremes: 2.5 °C metric / 4.5 °F imperial (identical: 4.5 °F = 2.5 °C).
    const pad = units === 'metric' ? 2.5 : 4.5 / 1.8;
    const lo = data.tMin - pad;
    const hi = data.tMax + pad;
    const curveBottom = height - 56; // area baseline, sits just above the precip band
    const ys = data.temps.map((t) => f(curveBottom - ((t - lo) / (hi - lo)) * (curveBottom - TOP_PAD)));
    const line = smoothPath(xs.map((x, i) => ({ x, y: ys[i] })));
    const area = `${line} L ${f(xs[n - 1])} ${curveBottom} L ${f(xs[0])} ${curveBottom} Z`;
    return {
      height,
      padX,
      slot,
      xs,
      ys,
      line,
      area,
      precipBase: height - 24, // bars grow up from here
      labelY: height - 8,
      noteY: height - 32,
      barW: Math.min(10, slot * 0.32),
      labelEvery: n > 36 ? 6 : 3,
      lo,
      hi,
      curveBottom,
    };
  }, [data, width, units]);

  /* --- ensemble uncertainty band: temp ± σ behind the curve ------------- */
  const band = useMemo<BandSegment[]>(() => {
    if (!geom || !ensemble || ensemble.length === 0) return [];
    const spreadByTime = new Map<string, EnsembleHourly>();
    for (const point of ensemble) spreadByTime.set(point.time, point);
    const yOf = (t: number) =>
      f(
        clamp(
          geom.curveBottom - ((t - geom.lo) / (geom.hi - geom.lo)) * (geom.curveBottom - TOP_PAD),
          TOP_PAD - 6,
          geom.curveBottom,
        ),
      );
    const segments: BandSegment[] = [];
    let run: Array<{ x: number; top: number; bottom: number }> = [];
    const flush = () => {
      if (run.length >= 2) {
        segments.push({
          top: smoothPath(run.map((p) => ({ x: p.x, y: p.top }))),
          bottom: smoothPath([...run].reverse().map((p) => ({ x: p.x, y: p.bottom }))),
        });
      }
      run = [];
    };
    hours.forEach((hour, i) => {
      const matched = spreadByTime.get(hour.time);
      if (matched && matched.tempSpread != null) {
        run.push({
          x: geom.xs[i],
          top: yOf(matched.temp + matched.tempSpread),
          bottom: yOf(matched.temp - matched.tempSpread),
        });
      } else {
        flush();
      }
    });
    flush();
    return segments;
  }, [geom, ensemble, hours]);

  const ready = data !== null && geom !== null;

  /* Guard against `hours` swapping under a live hover. */
  const activeIdx =
    active !== null && data !== null && active < data.temps.length ? active : null;
  const activePoint = activeIdx !== null ? hours[activeIdx] : null;

  let ax = 0;
  let ay = 0;
  if (geom && activeIdx !== null) {
    ax = geom.xs[activeIdx];
    ay = geom.ys[activeIdx];
  }
  const showActive = geom !== null && activeIdx !== null;

  const probOf = (h: HourlyPoint) => Math.round(clamp(h.precipitationProbability, 0, 100));

  /* --- keyboard scrubbing --- */
  const handleKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!data) return;
    const last = data.temps.length - 1;
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

  /* --- pointer scrubbing (mouse hover + touch drag) --- */
  const indexFromClientX = (clientX: number): number => {
    if (!data || !geom || !svgRef.current) return 0;
    const rect = svgRef.current.getBoundingClientRect();
    return clamp(Math.round((clientX - rect.left - geom.padX) / geom.slot), 0, data.temps.length - 1);
  };

  const handlePointerDown = (e: ReactPointerEvent<SVGRectElement>) => {
    draggingRef.current = true;
    if (e.pointerType !== 'mouse') {
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* pointer already inactive — ignore */
      }
    }
    setActive(indexFromClientX(e.clientX));
  };

  const handlePointerMove = (e: ReactPointerEvent<SVGRectElement>) => {
    if (e.pointerType !== 'mouse' && !draggingRef.current) return;
    setActive(indexFromClientX(e.clientX));
  };

  const handlePointerUp = () => {
    draggingRef.current = false;
    /* tooltip intentionally persists after touch-lift so it can be read
       without a finger covering it */
  };

  const handlePointerLeave = (e: ReactPointerEvent<SVGRectElement>) => {
    draggingRef.current = false;
    if (e.pointerType === 'mouse') setActive(null);
  };

  const handlePointerCancel = () => {
    draggingRef.current = false;
    setActive(null);
  };

  /* --- a11y label --- */
  const ariaLabel = !data
    ? 'Hourly temperature chart is loading.'
    : `${hours.length}-hour forecast chart. Temperatures from ${formatTemp(data.tMin, units)} to ${formatTemp(data.tMax, units)}, peaking around ${formatHour(hours[data.maxIdx].time, units)}. ${
        data.allZero
          ? 'No precipitation expected.'
          : `Precipitation chance up to ${Math.round(data.maxProb)}%.`
      }${band.length > 0 ? ' Shaded band shows the ensemble forecast uncertainty.' : ''}`;

  /* --- optional ≤500 ms draw-in, only when motion is allowed --- */
  const drawCls = `${gid}-draw`;
  const fadeCls = `${gid}-fade`;
  const lateCls = `${gid}-late`;
  const motionCss =
    `.${drawCls}{stroke-dasharray:1;animation:${gid}draw 500ms cubic-bezier(0.22,1,0.36,1) both}` +
    `.${fadeCls}{animation:${gid}fade 480ms ease-out both}` +
    `.${lateCls}{animation:${gid}fade 480ms 140ms ease-out both}` +
    `@keyframes ${gid}draw{from{stroke-dashoffset:1}to{stroke-dashoffset:0}}` +
    `@keyframes ${gid}fade{from{opacity:0}}`;

  /* --- extreme annotation: dot + rounded pill, clamped inside the SVG --- */
  const pill = (i: number, above: boolean) => {
    if (!geom || !data) return null;
    const label = formatTemp(data.temps[i], units);
    const w = 14 + label.length * 6.4;
    const h = 18;
    const px = geom.xs[i];
    const py = geom.ys[i];
    const top = clamp(above ? py - 27 : py + 9, 2, geom.height - h - 22);
    const left = clamp(px - w / 2, 2, Math.max(2, width - w - 2));
    return (
      <g>
        <circle
          cx={px}
          cy={py}
          r={3}
          fill={AURORA_400}
          stroke="rgb(255 255 255 / 0.9)"
          strokeWidth={1.25}
        />
        <rect
          x={left}
          y={top}
          width={w}
          height={h}
          rx={9}
          style={{ fill: "var(--surface-strong)", stroke: "var(--surface-border)" }}
          strokeWidth={1}
        />
        <text
          x={left + w / 2}
          y={top + h / 2}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={11}
          style={{ fill: "var(--surface-text)" }}
          className="tnum"
        >
          {label}
        </text>
      </g>
    );
  };

  /* --- tooltip position: flip near edges, prefer above, clamp below --- */
  let tipStyle: CSSProperties | null = null;
  if (showActive && activePoint) {
    const tx =
      ax > width - 78
        ? 'translateX(calc(-100% - 12px))'
        : ax < 78
          ? 'translateX(12px)'
          : 'translateX(-50%)';
    const ty = ay > 92 ? 'translateY(calc(-100% - 12px))' : 'translateY(14px)';
    tipStyle = { left: ax, top: ay, transform: `${tx} ${ty}` };
  }

  return (
    <div
      ref={wrapRef}
      role="img"
      aria-label={ariaLabel}
      tabIndex={ready ? 0 : undefined}
      onKeyDown={ready ? handleKeyDown : undefined}
      className={cn('focus-ring relative w-full select-none', className)}
    >
      {!data ? (
        <div className="flex h-[210px] w-full items-center justify-center px-6 text-center text-sm text-surface-muted">
          Not enough hourly forecast data to draw the trend.
        </div>
      ) : !geom ? (
        <div className="skeleton w-full" style={{ height: 210 }} />
      ) : (
        <>
          {motionOk ? <style>{motionCss}</style> : null}
          <svg
            ref={svgRef}
            width={width}
            height={geom.height}
            className="block"
            style={{ touchAction: 'pan-y' }}
            aria-hidden="true"
          >
            <defs>
              <linearGradient id={`${gid}-line`} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stopColor={AURORA_400} />
                <stop offset="1" stopColor={AURORA_500} />
              </linearGradient>
              <linearGradient id={`${gid}-area`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="rgb(69 209 179 / 0.2)" />
                <stop offset="1" stopColor="rgb(69 209 179 / 0)" />
              </linearGradient>
              <linearGradient id={`${gid}-band`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="rgb(69 209 179 / 0.16)" />
                <stop offset="0.5" stopColor="rgb(69 209 179 / 0.09)" />
                <stop offset="1" stopColor="rgb(69 209 179 / 0.16)" />
              </linearGradient>
            </defs>

            {/* area under the curve */}
            <path
              d={geom.area}
              fill={`url(#${gid}-area)`}
              className={motionOk ? fadeCls : undefined}
            />

            {/* ensemble uncertainty band (temp ± σ) behind the curve */}
            {band.length > 0 ? (
              <g className={motionOk ? fadeCls : undefined} aria-hidden="true">
                {band.map((segment, i) => {
                  // Top edge runs left→right, bottom edge (already reversed)
                  // right→left — drop its "M x y" head and chain on.
                  const bottomRest = segment.bottom.slice(segment.bottom.indexOf('C'));
                  return (
                    <path
                      key={i}
                      d={`${segment.top} ${bottomRest} Z`}
                      fill={`url(#${gid}-band)`}
                      stroke={AURORA_300}
                      strokeWidth={0.75}
                      strokeOpacity={0.3}
                    />
                  );
                })}
              </g>
            ) : null}

            {/* scrub guide */}
            {showActive ? (
              <line
                x1={ax}
                x2={ax}
                y1={26}
                y2={geom.height - 26}
                style={{ stroke: "var(--surface-muted)" }}
                strokeWidth={1}
                strokeDasharray="3 3"
                opacity={0.6}
              />
            ) : null}

            {/* precipitation probability band */}
            <g className={motionOk ? lateCls : undefined}>
              {data.allZero ? (
                <text
                  x={f(width / 2)}
                  y={geom.noteY}
                  textAnchor="middle"
                  fontSize={11}
                  style={{ fill: "var(--surface-muted)" }}
                >
                  {`No precipitation expected in the next ${hours.length}h`}
                </text>
              ) : (
                data.probs.map((p, i) =>
                  p <= 0 ? null : (
                    <rect
                      key={i}
                      x={geom.xs[i] - geom.barW / 2}
                      y={geom.precipBase - (p / 100) * PRECIP_MAX_BAR}
                      width={geom.barW}
                      height={(p / 100) * PRECIP_MAX_BAR}
                      rx={geom.barW / 2}
                      fill={AURORA_300}
                      opacity={p >= 50 ? 0.55 : 0.34}
                    />
                  ),
                )
              )}
            </g>

            {/* temperature curve */}
            <path
              d={geom.line}
              fill="none"
              stroke={`url(#${gid}-line)`}
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              pathLength={motionOk ? 1 : undefined}
              className={motionOk ? drawCls : undefined}
            />

            {/* hour labels, extreme pills, "now" marker */}
            <g className={motionOk ? lateCls : undefined}>
              {hours.map((h, i) =>
                i % geom.labelEvery === 0 ? (
                  <text
                    key={i}
                    x={clamp(geom.xs[i], 14, width - 14)}
                    y={geom.labelY}
                    textAnchor="middle"
                    fontSize={11}
                    style={{ fill: "var(--surface-muted)" }}
                    className="tnum"
                  >
                    {i === 0 ? 'Now' : formatHourShort(h.time, units)}
                  </text>
                ) : null,
              )}

              {pill(data.maxIdx, true)}
              {data.minIdx !== data.maxIdx ? pill(data.minIdx, false) : null}

              <circle
                cx={geom.xs[0]}
                cy={geom.ys[0]}
                r={9}
                fill={AURORA_400}
                fillOpacity={0.3}
                className="animate-pulse-soft"
              />
              <circle
                cx={geom.xs[0]}
                cy={geom.ys[0]}
                r={4}
                fill={AURORA_400}
                stroke="rgb(255 255 255 / 0.9)"
                strokeWidth={1.5}
              />
            </g>

            {/* active marker */}
            {showActive ? (
              <circle
                cx={ax}
                cy={ay}
                r={4.5}
                fill={AURORA_400}
                stroke="rgb(255 255 255 / 0.9)"
                strokeWidth={1.5}
              />
            ) : null}

            {/* full-size interaction surface (kept topmost) */}
            <rect
              x={0}
              y={0}
              width={width}
              height={geom.height}
              fill="transparent"
              style={{ cursor: 'crosshair', touchAction: 'pan-y' }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerLeave}
              onPointerCancel={handlePointerCancel}
            />
          </svg>

          {/* HTML tooltip */}
          {showActive && activePoint && tipStyle ? (
            <div
              className="glass-strong text-surface pointer-events-none absolute z-20 rounded-xl px-3 py-2 shadow-glass"
              style={tipStyle}
            >
              <div className="tnum text-[11px] text-surface-muted">
                {formatHour(activePoint.time, units)}
              </div>
              <div className="tnum text-sm font-medium">
                {formatTemp(activePoint.temperature, units)}
                {units === 'metric' ? 'C' : 'F'}
              </div>
              <div className="tnum mt-0.5 flex items-center gap-1.5 text-[11px] text-surface-muted">
                <svg width="10" height="13" viewBox="0 0 10 13" aria-hidden="true" className="shrink-0">
                  <path
                    d="M5 1.4C5 1.4 1.5 5.9 1.5 8.4a3.5 3.5 0 0 0 7 0C8.5 5.9 5 1.4 5 1.4Z"
                    fill="none"
                    stroke={AURORA_300}
                    strokeWidth={1.4}
                    strokeLinejoin="round"
                  />
                </svg>
                Precip {probOf(activePoint)}%
              </div>
            </div>
          ) : null}
        </>
      )}

      {/* screen-reader announcement of the scrubbed point */}
      <div className="sr-only" aria-live="polite">
        {activeIdx !== null && activePoint
          ? `${formatHour(activePoint.time, units)} · ${formatTemp(activePoint.temperature, units)} · precip ${probOf(activePoint)}%`
          : ''}
      </div>
    </div>
  );
}
