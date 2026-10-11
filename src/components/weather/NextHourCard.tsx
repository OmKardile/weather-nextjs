'use client';

import { useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import { Icon } from '@/components/icons/Icon';
import {
  AURORA_300,
  AURORA_400,
  clamp,
  f,
  useChartWidth,
  useMotionOk,
} from '@/components/weather/chart-helpers';
import { formatPrecip } from '@/lib/units';
import type { MinutelyPoint, Units } from '@/types/weather';

/* ================================================================== */
/* NextHourCard — minutely precipitation nowcast (next 2 hours,        */
/* 8 × 15-minute steps from bundle.minutely). Hidden entirely when     */
/* the nowcast call failed (null).                                     */
/* ================================================================== */

interface NextHourCardProps {
  minutely: MinutelyPoint[] | null | undefined;
  units: Units;
}

const CHART_H = 108;
const BASELINE = 90;
const BAR_MAX = 56;
const PROB_TOP = 12;
const PROB_SPAN = 46;

/** Compact 15-minute label ("20:15" / "8:15") — the window is only 2h wide. */
function minuteLabel(iso: string, units: Units): string {
  try {
    return format(parseISO(iso), units === 'metric' ? 'HH:mm' : 'h:mm');
  } catch {
    return '--:--';
  }
}

type Nowcast =
  | { kind: 'dry' }
  | { kind: 'starting'; minutes: number }
  | { kind: 'easing'; minutes: number }
  | { kind: 'continuing' };

function summarize(points: MinutelyPoint[]): Nowcast {
  const firstWet = points.findIndex((p) => p.precip > 0);
  if (firstWet === -1) return { kind: 'dry' };
  if (firstWet > 0) return { kind: 'starting', minutes: firstWet * 15 };
  const firstDry = points.findIndex((p, i) => i > 0 && p.precip <= 0);
  if (firstDry === -1) return { kind: 'continuing' };
  return { kind: 'easing', minutes: firstDry * 15 };
}

export function NextHourCard({ minutely, units }: NextHourCardProps) {
  const [wrapRef, width] = useChartWidth<HTMLDivElement>();
  const motionOk = useMotionOk();

  const points = useMemo(
    () => (minutely ?? []).filter((p) => Number.isFinite(p.precip) && Number.isFinite(p.precipProbability)),
    [minutely],
  );

  const nowcast = points.length >= 2 ? summarize(points) : null;

  const geom = useMemo(() => {
    if (points.length < 2 || width < 60) return null;
    const n = points.length;
    const padX = 8;
    const slot = (width - padX * 2) / (n - 1);
    const xs = points.map((_, i) => f(padX + slot * i));
    const maxPrecip = Math.max(...points.map((p) => p.precip), 0.001);
    const bars = points.map((p, i) => ({ x: xs[i], h: (p.precip / maxPrecip) * BAR_MAX }));
    const probPts = points.map((p, i) => ({
      x: xs[i],
      y: PROB_TOP + (1 - clamp(p.precipProbability, 0, 100) / 100) * PROB_SPAN,
    }));
    const probLine = probPts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${f(p.x)} ${f(p.y)}`).join(' ');
    return { xs, slot, barW: Math.min(22, slot * 0.5), bars, probLine, probPts };
  }, [points, width]);

  // Guard against points swapping under the (shared) memo.
  const safeGeom = geom && points.length === geom.bars.length ? geom : null;

  if (!nowcast) return null;

  const wet = nowcast.kind !== 'dry';
  const headline =
    nowcast.kind === 'dry'
      ? 'Dry for the next 2 hours'
      : nowcast.kind === 'starting'
        ? `Rain starts in ${nowcast.minutes} min`
        : nowcast.kind === 'easing'
          ? `Rain easing in ${nowcast.minutes} min`
          : 'Rain continuing for the next 2 hours';

  const maxProb = Math.round(Math.max(...points.map((p) => p.precipProbability), 0));
  const caption =
    nowcast.kind === 'dry'
      ? maxProb > 0
        ? `No precipitation expected · chance stays at or below ${maxProb}%`
        : 'Minutely nowcast shows no precipitation through the next two hours'
      : `Next 2 hours · 15-minute steps · up to ${maxProb}% chance`;

  return (
    <div className="glass animate-fade-up rounded-[var(--radius-card)] p-4 shadow-[var(--shadow-glass)] sm:p-5">
      <div className="flex items-center gap-3">
        <span className="glass-subtle flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
          <Icon
            name={wet ? 'rain' : 'sun'}
            size={22}
            animated={motionOk}
            className="text-aurora-300"
          />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-surface">{headline}</p>
          <p className="tnum mt-0.5 truncate text-[11px] text-surface-faint">{caption}</p>
        </div>
        <span className="ml-auto hidden text-[10px] font-semibold uppercase tracking-[0.14em] text-surface-faint sm:block">
          Nowcast
        </span>
      </div>

      {wet ? (
        <div ref={wrapRef} className="mt-2">
          {safeGeom ? (
            <>
          <svg
            width={width}
            height={CHART_H}
            className="block"
            role="img"
            aria-label={`Precipitation per 15 minutes for the next 2 hours. ${headline}. Peak chance ${maxProb}%.`}
          >
            {/* faint horizontal guides for the probability scale */}
            {[0, 50, 100].map((p) => {
              const y = PROB_TOP + (1 - p / 100) * PROB_SPAN;
              return (
                <line
                  key={p}
                  x1={4}
                  x2={width - 4}
                  y1={y}
                  y2={y}
                  stroke="var(--surface-border)"
                  strokeWidth={0.6}
                  opacity={0.5}
                  strokeDasharray="2 6"
                />
              );
            })}

            {/* precip amount bars */}
            {safeGeom.bars.map((bar, i) =>
              bar.h <= 0 ? null : (
                <rect
                  key={i}
                  x={f(bar.x - safeGeom.barW / 2)}
                  y={f(BASELINE - bar.h)}
                  width={f(safeGeom.barW)}
                  height={f(bar.h)}
                  rx={f(safeGeom.barW / 2)}
                  fill={AURORA_300}
                  opacity={0.6}
                />
              ),
            )}

            {/* probability overlay line + dots */}
            <path
              d={safeGeom.probLine}
              fill="none"
              stroke={AURORA_400}
              strokeWidth={1.4}
              strokeDasharray="3 4"
              strokeLinecap="round"
              opacity={0.5}
            />
            {safeGeom.probPts.map((p, i) => (
              <circle key={i} cx={f(p.x)} cy={f(p.y)} r={1.8} fill={AURORA_400} opacity={0.55} />
            ))}

            {/* baseline */}
            <line
              x1={2}
              x2={width - 2}
              y1={BASELINE}
              y2={BASELINE}
              stroke="var(--surface-border)"
              strokeWidth={1}
            />

            {/* x labels: every 2nd step */}
            {points.map((p, i) =>
              i % 2 === 0 ? (
                <text
                  key={p.time}
                  x={clamp(safeGeom.xs[i], 18, width - 18)}
                  y={CHART_H - 6}
                  textAnchor="middle"
                  fontSize={10}
                  className="tnum"
                  style={{ fill: 'var(--surface-muted)' }}
                >
                  {i === 0 ? 'Now' : minuteLabel(p.time, units)}
                </text>
              ) : null,
            )}
          </svg>
          <div className="tnum mt-1 flex items-center gap-4 text-[10px] text-surface-faint">
            <span className="flex items-center gap-1.5">
              <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
                <rect x="2" y="2" width="6" height="8" rx="3" fill={AURORA_300} opacity="0.6" />
              </svg>
              Amount · max {formatPrecip(Math.max(...points.map((p) => p.precip)), units)} / 15 min
            </span>
            <span className="flex items-center gap-1.5">
              <svg width="14" height="6" viewBox="0 0 14 6" aria-hidden="true">
                <path
                  d="M1 3 C 4 1, 6 5, 9 3 S 12 3, 13 3"
                  fill="none"
                  stroke={AURORA_400}
                  strokeWidth="1.4"
                  strokeDasharray="3 3"
                  opacity="0.6"
                />
              </svg>
              Chance
            </span>
          </div>
            </>
          ) : (
            <div className="skeleton h-[108px] w-full" aria-hidden="true" />
          )}
        </div>
      ) : null}
    </div>
  );
}
