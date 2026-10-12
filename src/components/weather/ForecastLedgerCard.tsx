'use client';

import { useMemo } from 'react';
import type { JSX } from 'react';
import { format, parseISO } from 'date-fns';
import { Icon } from '@/components/icons/Icon';
import { AURORA_300, AURORA_400, clamp, useMotionOk } from '@/components/weather/chart-helpers';
import { useForecastLedger } from '@/hooks/use-forecast-ledger';
import { formatTemp, formatTempDelta } from '@/lib/units';
import type { City, Units, WeatherBundle } from '@/types/weather';
import { recordErrorC } from '@/lib/forecast-ledger';
import type { LedgerRecord, LedgerStats } from '@/lib/forecast-ledger';

/* ================================================================== */
/* ForecastLedgerCard — "Aether scores itself".                         */
/*                                                                     */
/* Each day the forecast high/low shown that morning is stored; once   */
/* the measured day lands (yesterday upstream) the call is scored.     */
/* The card shows the rolling accuracy: headline verdict, mean miss,   */
/* within-2° share and a last-7-days error bar strip (green ≤1°,       */
/* amber ≤2.5°, orange beyond) with per-day tooltips + a full          */
/* screen-reader summary. Records store °C and convert for display.    */
/* ================================================================== */

interface ForecastLedgerCardProps {
  city: City;
  bundle: WeatherBundle;
  units: Units;
}

const NEAR_C = 1;
const OK_C = 2.5;

function errorTone(errorC: number): { color: string; label: string } {
  if (errorC <= NEAR_C) return { color: AURORA_400, label: 'spot on' };
  if (errorC <= OK_C) return { color: '#E8C54D', label: 'close' };
  return { color: '#F0954A', label: 'off' };
}

function dayLabel(iso: string): string {
  try {
    return format(parseISO(iso), 'EEE d');
  } catch {
    return iso.slice(5);
  }
}

/** One scored day: a rounded error bar + the date + the °-miss. */
function ErrorChip({ record, units }: { record: LedgerRecord; units: Units }): JSX.Element {
  const errorC = recordErrorC(record);
  const { color, label } = errorTone(errorC);
  const height = clamp(10 + (errorC / OK_C) * 22, 10, 34);

  return (
    <div
      className="flex min-w-0 flex-1 flex-col items-center gap-1.5"
      title={`${dayLabel(record.date)} — missed by ${formatTempDelta(errorC, units).replace('+', '')} on average (${label})`}
    >
      <div className="flex h-9 items-end" aria-hidden="true">
        <div
          className="w-6 rounded-full transition-[height] duration-500"
          style={{
            height: `${height}px`,
            background: `linear-gradient(180deg, ${color} 0%, color-mix(in srgb, ${color} 55%, transparent) 100%)`,
            boxShadow: `0 0 12px -4px ${color}`,
          }}
        />
      </div>
      <span className="tnum text-[10px] text-surface-muted">{dayLabel(record.date)}</span>
    </div>
  );
}

function Verdict({ stats, units }: { stats: LedgerStats; units: Units }): JSX.Element {
  const pct = stats.withinTwoPct;
  if (pct == null) {
    return (
      <>
        <p className="text-sm font-semibold text-surface">The ledger is open</p>
        <p className="mt-0.5 text-[11px] leading-relaxed text-surface-faint">
          Aether keeps an honest log of every forecast it shows you — and grades it
          against the measured sky once the day is done.
        </p>
      </>
    );
  }
  const verdict =
    pct >= 80 ? 'Sharp calls' : pct >= 60 ? 'Mostly right' : 'Room to grow';
  return (
    <>
      <p className="text-sm font-semibold text-surface">
        {verdict} — {pct}% within 2°
      </p>
      <p className="tnum mt-0.5 text-[11px] text-surface-faint">
        {stats.scoredDays} scored {stats.scoredDays === 1 ? 'day' : 'days'} · average miss{' '}
        {stats.meanErrorC != null ? formatTempDelta(stats.meanErrorC, units).replace('+', '') : '—'}
      </p>
    </>
  );
}

function StatsRow({ stats, units }: { stats: LedgerStats; units: Units }): JSX.Element {
  return (
    <div className="grid grid-cols-3 gap-2">
      <div className="glass-subtle rounded-xl px-3 py-2">
        <p className="tnum text-base font-bold text-surface">
          {stats.meanErrorC != null ? formatTempDelta(stats.meanErrorC, units).replace('+', '') : '—'}
        </p>
        <p className="mt-0.5 text-[10px] text-surface-muted">avg miss</p>
      </div>
      <div className="glass-subtle rounded-xl px-3 py-2">
        <p className="tnum text-base font-bold text-surface">{stats.scoredDays}</p>
        <p className="mt-0.5 text-[10px] text-surface-muted">days scored</p>
      </div>
      <div className="glass-subtle rounded-xl px-3 py-2">
        <p className="tnum text-base font-bold text-surface">{stats.cleanDays}</p>
        <p className="mt-0.5 text-[10px] text-surface-muted">both high &amp; low ≤2°</p>
      </div>
    </div>
  );
}

export function ForecastLedgerCard({ city, bundle, units }: ForecastLedgerCardProps) {
  const stats = useForecastLedger(city, bundle);
  const motionOk = useMotionOk();

  const ariaSummary = useMemo(() => {
    if (stats.scoredDays === 0) {
      return 'Forecast log: no scored days yet. Aether records each day’s forecast and grades it against the measured high and low once the day passes.';
    }
    const days = stats.recent
      .map((r) => `${dayLabel(r.date)} missed by ${recordErrorC(r).toFixed(1)} degrees on average`)
      .join('; ');
    return `Forecast log: ${stats.scoredDays} scored days, ${stats.withinTwoPct}% of high and low calls within 2 degrees, average miss ${stats.meanErrorC?.toFixed(1)} degrees. Recent: ${days}.`;
  }, [stats]);

  return (
    <div className="glass card-lift fs-card rounded-[var(--radius-card)] p-4 shadow-[var(--shadow-glass)] sm:p-5">
      <div className="flex items-center gap-3">
        <span className="glass-subtle flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
          <Icon name="check" size={20} animated={motionOk} className="text-aurora-300" />
        </span>
        <div className="min-w-0 flex-1">
          <Verdict stats={stats} units={units} />
        </div>
        <span className="ml-auto hidden card-label-muted shrink-0 sm:block">Self-check</span>
      </div>

      {stats.scoredDays > 0 ? (
        <div className="mt-4 space-y-4">
          {/* Last 7 scored days — error magnitude strip */}
          <div
            className="flex items-end gap-1.5 rounded-2xl px-3 pb-2 pt-3"
            style={{ background: 'color-mix(in srgb, var(--surface-border) 26%, transparent)' }}
            role="img"
            aria-label={ariaSummary}
          >
            {stats.recent
              .slice()
              .reverse()
              .map((record) => (
                <ErrorChip key={record.date} record={record} units={units} />
              ))}
          </div>
          <StatsRow stats={stats} units={units} />
          <p className="text-[10px] leading-relaxed text-surface-faint">
            The morning forecast for each day is stored on first view; the measured high
            and low arrive the day after. Bars show the average miss of the high/low pair.
          </p>
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          <div
            className="flex items-end gap-1.5 rounded-2xl px-3 pb-2 pt-3"
            style={{ background: 'color-mix(in srgb, var(--surface-border) 26%, transparent)' }}
            aria-hidden="true"
          >
            {/* Pending preview: today's entry waits for its grade */}
            <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
              <div className="flex h-9 items-end">
                <div
                  className="w-6 rounded-full opacity-40"
                  style={{
                    height: '22px',
                    background: `linear-gradient(180deg, ${AURORA_300} 0%, transparent 100%)`,
                  }}
                />
              </div>
              <span className="text-[10px] text-surface-muted">today</span>
            </div>
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
                <div className="flex h-9 items-end">
                  <div className="skeleton w-6 rounded-full" style={{ height: '12px' }} />
                </div>
                <span className="skeleton h-2.5 w-6 rounded-full" />
              </div>
            ))}
          </div>
          <p className="text-[11px] leading-relaxed text-surface-muted">
            Today’s call is already in the book — <span className="font-semibold text-surface">{formatTemp(bundle.daily[0]?.tempMax ?? 0, units)}</span> high,{' '}
            <span className="font-semibold text-surface">{formatTemp(bundle.daily[0]?.tempMin ?? 0, units)}</span> low.
            Check back tomorrow to see how it scores against the measured sky.
          </p>
        </div>
      )}
    </div>
  );
}
