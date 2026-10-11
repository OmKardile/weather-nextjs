'use client';

import { useMemo } from 'react';
import type { UseQueryResult } from '@tanstack/react-query';
import { Icon } from '@/components/icons/Icon';
import { formatWeekday } from '@/lib/units';
import type { EnsembleResponse, Units, WeatherBundle } from '@/types/weather';

/* ================================================================== */
/* ForecastConfidence — how much the models agree. Derived from the    */
/* /api/ensemble member spread (tempSpread = ±σ across 40 members):    */
/* mean spread ≤ 1° = high, ≤ 2.5° = medium, above = low. The meter    */
/* maps spread linearly (0° → 100, 2.5° → ~37, 4° → floor).            */
/* ================================================================== */

interface ForecastConfidenceProps {
  bundle: WeatherBundle;
  units: Units;
  /** Shared per-coordinates ensemble query (owned by ForecastSections). */
  query: UseQueryResult<EnsembleResponse, Error>;
}

const CONFIDENCE_GRADIENT =
  'linear-gradient(90deg, #22BCA0 0%, #45D1B3 30%, #E8C54D 55%, #F0954A 78%, #E1552F 100%)';

interface DayBucket {
  date: string;
  spreadSum: number;
  spreadCount: number;
  precipSum: number;
}

interface Confidence {
  level: 'high' | 'medium' | 'low';
  score: number;
  meanSpread: number;
  /** Human sentence beyond the level headline. */
  detail: string;
}

function groupByDay<T extends { time: string }>(points: T[]): Map<string, T[]> {
  const byDay = new Map<string, T[]>();
  for (const point of points) {
    const date = point.time.slice(0, 10);
    const bucket = byDay.get(date);
    if (bucket) bucket.push(point);
    else byDay.set(date, [point]);
  }
  return byDay;
}

function analyze(ensemble: EnsembleResponse, bundle: WeatherBundle): Confidence | null {
  const hourly = ensemble.hourly;
  if (hourly.length < 6) return null;

  const spreads = hourly
    .map((p) => p.tempSpread)
    .filter((s): s is number => s != null && Number.isFinite(s));
  if (spreads.length < 6) return null;

  const meanSpread = spreads.reduce((sum, s) => sum + s, 0) / spreads.length;
  const level: Confidence['level'] = meanSpread <= 1 ? 'high' : meanSpread <= 2.5 ? 'medium' : 'low';
  const score = Math.min(Math.max(Math.round(100 - meanSpread * 25), 8), 100);

  // --- detail sentence -------------------------------------------------
  // 1) Rain disagreement: compare ensemble precip totals per day against
  //    the deterministic bundle hourly precip (48h overlap only).
  const ensDays = groupByDay(hourly);
  const detDays = groupByDay(bundle.hourly);
  let rainDay: { date: string; diff: number } | null = null;
  for (const [date, ensPoints] of ensDays) {
    const detPoints = detDays.get(date);
    if (!detPoints || detPoints.length === 0) continue;
    const ensSum = ensPoints.reduce((sum, p) => sum + (Number.isFinite(p.precip) ? p.precip : 0), 0);
    const detSum = detPoints.reduce((sum, p) => sum + (Number.isFinite(p.precipitation) ? p.precipitation : 0), 0);
    if (ensSum < 0.5 && detSum < 0.5) continue;
    const diff = Math.abs(ensSum - detSum);
    const meaningful = diff >= Math.max(1, 0.5 * Math.max(detSum, ensSum));
    if (meaningful && (!rainDay || diff > rainDay.diff)) rainDay = { date, diff };
  }
  if (rainDay) {
    return {
      level,
      score,
      meanSpread,
      detail: `Ensemble and deterministic forecasts disagree on rain ${formatWeekday(rainDay.date) ||
        rainDay.date.slice(5)} — treat the timing as uncertain.`,
    };
  }

  // 2) Otherwise: the day where temperature uncertainty peaks.
  const dayStats: DayBucket[] = [];
  for (const [date, points] of ensDays) {
    let spreadSum = 0;
    let spreadCount = 0;
    let precipSum = 0;
    for (const p of points) {
      if (p.tempSpread != null) {
        spreadSum += p.tempSpread;
        spreadCount += 1;
      }
      precipSum += Number.isFinite(p.precip) ? p.precip : 0;
    }
    if (spreadCount > 0) dayStats.push({ date, spreadSum, spreadCount, precipSum });
  }
  let peak = dayStats[0];
  for (const day of dayStats) {
    if (day.spreadSum / day.spreadCount > (peak?.spreadSum ?? 0) / (peak?.spreadCount ?? 1)) peak = day;
  }
  if (peak) {
    const peakMean = peak.spreadSum / peak.spreadCount;
    const weekday = formatWeekday(peak.date) || peak.date.slice(5);
    if (peakMean >= Math.max(1.3 * meanSpread, 1.2)) {
      return {
        level,
        score,
        meanSpread,
        detail: `Temperature uncertainty peaks ${weekday} (±${peakMean.toFixed(1)}° between members).`,
      };
    }
    if (peak.precipSum >= 0.5) {
      return {
        level,
        score,
        meanSpread,
        detail: `Wettest ensemble signal ${weekday} — timing may still shift by a few hours.`,
      };
    }
  }

  const closeness =
    level === 'high'
      ? 'Members are tightly clustered through the forecast window.'
      : 'Members agree on the overall picture with some spread later on.';
  return { level, score, meanSpread, detail: closeness };
}

export function ForecastConfidence({ bundle, units, query }: ForecastConfidenceProps) {
  const data = query.data ?? null;

  const confidence = useMemo(
    () => (data ? analyze(data, bundle) : null),
    [data, bundle],
  );

  if (query.isPending && !data) {
    return (
      <div className="glass rounded-[var(--radius-card)] p-5" aria-busy="true">
        <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-surface-muted">
          <Icon name="gauge" size={14} strokeWidth={2} />
          Forecast confidence
        </p>
        <div className="skeleton mt-4 h-9 w-40" aria-hidden="true" />
        <div className="skeleton mt-3 h-2 w-full" aria-hidden="true" />
        <div className="skeleton mt-3 h-3 w-3/4" aria-hidden="true" />
      </div>
    );
  }

  if (!confidence) return null;

  const headline =
    confidence.level === 'high'
      ? 'High confidence'
      : confidence.level === 'medium'
        ? 'Medium confidence'
        : 'Low confidence';
  const headlineColor =
    confidence.level === 'high' ? '#22BCA0' : confidence.level === 'medium' ? '#E8C54D' : '#F0954A';
  // The API reports spread in °C; deltas scale ×1.8 for °F (no delta helper
  // in lib/units — cToF would wrongly re-bias the zero point).
  const spreadDisplay = units === 'metric' ? confidence.meanSpread : confidence.meanSpread * 1.8;

  return (
    <div className="glass animate-fade-up flex h-full flex-col rounded-[var(--radius-card)] p-5 shadow-[var(--shadow-glass)]">
      <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-surface-muted">
        <Icon name="gauge" size={14} strokeWidth={2} aria-hidden="true" />
        Forecast confidence
      </p>

      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-lg font-semibold text-surface">{headline}</span>
        <span className="tnum text-xs text-surface-faint">
          ±{spreadDisplay.toFixed(1)}°{units === 'metric' ? 'C' : 'F'} spread
        </span>
      </div>

      {/* 0–100 confidence meter */}
      <div
        className="relative mt-3 h-2 rounded-full"
        role="img"
        aria-label={`Forecast confidence ${confidence.score} out of 100 — ${headline}`}
      >
        <div
          className="h-full w-full rounded-full"
          style={{ background: CONFIDENCE_GRADIENT, opacity: 0.85 }}
          aria-hidden="true"
        />
        <div
          className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
          style={{ left: `${confidence.score}%`, background: headlineColor }}
          aria-hidden="true"
        />
      </div>
      <div className="tnum mt-1 flex justify-between text-[10px] text-surface-faint" aria-hidden="true">
        <span>Certain</span>
        <span>{confidence.score}</span>
        <span>Uncertain</span>
      </div>

      <p className="mt-3 text-xs leading-relaxed text-surface-muted">{confidence.detail}</p>

      <p className="mt-auto pt-3 text-[11px] leading-relaxed text-surface-faint">
        ICON 40-member ensemble. The shaded band on the temperature chart shows this uncertainty.
      </p>
    </div>
  );
}
