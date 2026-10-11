'use client';

import { Waves } from 'lucide-react';
import { useMarine } from '@/hooks/use-marine';
import { compassPoint, formatWeekday } from '@/lib/units';
import type { City, Units } from '@/types/weather';

/* ================================================================== */
/* MarineCard — wave height, dominant direction + period for coastal   */
/* locations (from /api/marine). Inland cities and upstream failures   */
/* answer available:false → the card disappears.                       */
/* ================================================================== */

interface MarineCardProps {
  city: City;
  units: Units;
}

/** Metres → feet (no wave helper exists in lib/units, which is frozen). */
const FT_PER_M = 3.280_84;

function formatWaveHeight(meters: number, units: Units): string {
  if (units === 'metric') return `${meters.toFixed(1)} m`;
  return `${(meters * FT_PER_M).toFixed(1)} ft`;
}

export function MarineCard({ city, units }: MarineCardProps) {
  const query = useMarine(city);
  const data = query.data ?? null;

  if (query.isPending && !data) {
    return (
      <div className="glass rounded-[var(--radius-card)] p-4" aria-busy="true">
        <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-surface-muted">
          <Waves className="h-3.5 w-3.5" aria-hidden="true" />
          Marine
        </p>
        <div className="skeleton mt-3 h-16 w-full rounded-2xl" aria-hidden="true" />
      </div>
    );
  }

  const days = data?.available ? data.daily.filter((d) => d.waveHeightMax != null) : [];
  if (days.length === 0) return null;

  const today = days[0];
  const weeklyPeak = days.reduce((peak, d) => ((d.waveHeightMax ?? 0) > (peak.waveHeightMax ?? 0) ? d : peak), days[0]);

  const direction = today.waveDirectionDominant;
  const period = today.wavePeriodMax;

  return (
    <div className="glass glass-hover rounded-[var(--radius-card)] p-4">
      <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-surface-muted">
        <Waves className="h-3.5 w-3.5" aria-hidden="true" />
        Marine
      </p>

      <div className="mt-2 flex items-center gap-3">
        <svg
          viewBox="0 0 72 72"
          className="h-14 w-14 shrink-0"
          role="img"
          aria-label={
            direction != null
              ? `Dominant waves from ${compassPoint(direction)}`
              : 'Dominant wave direction unavailable'
          }
        >
          <circle cx="36" cy="36" r="30" fill="none" stroke="var(--surface-border)" strokeWidth="2" />
          {(['N', 'E', 'S', 'W'] as const).map((point, i) => {
            const angle = (i * 90 - 90) * (Math.PI / 180);
            const x = 36 + Math.cos(angle) * 24;
            const y = 36 + Math.sin(angle) * 24;
            return (
              <text
                key={point}
                x={x}
                y={y + 3.2}
                textAnchor="middle"
                fontSize="9"
                style={{ fill: 'var(--surface-muted)' }}
                className="tnum"
              >
                {point}
              </text>
            );
          })}
          {direction != null ? (
            <g transform={`rotate(${(direction + 180) % 360} 36 36)`}>
              <path d="M36 16 L41 42 L36 37 L31 42 Z" fill="#45D1B3" />
            </g>
          ) : null}
          <circle cx="36" cy="36" r="3" style={{ fill: 'var(--surface-strong)' }} stroke="#45D1B3" strokeWidth="1.5" />
        </svg>

        <div className="min-w-0">
          <p className="tnum text-xl font-semibold text-surface">
            {formatWaveHeight(today.waveHeightMax ?? 0, units)}
          </p>
          <p className="tnum text-xs text-surface-muted">
            {direction != null ? `from ${compassPoint(direction)}` : 'Direction unavailable'}
            {period != null ? ` · ${period.toFixed(0)} s period` : ''}
          </p>
          <p className="tnum text-xs text-surface-faint">
            Peak this week {formatWaveHeight(weeklyPeak.waveHeightMax ?? 0, units)} ·{' '}
            {formatWeekday(weeklyPeak.date) || weeklyPeak.date.slice(5)}
          </p>
        </div>
      </div>
    </div>
  );
}
