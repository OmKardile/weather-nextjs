'use client';

import { Leaf } from 'lucide-react';
import { aqiBand, aqiPosition, aqiBands, aqiDominantPollutant } from '@/lib/aqi';
import type { AirQuality } from '@/types/weather';

interface AirQualityCardProps {
  air: AirQuality | null;
}

export function AirQualityCard({ air }: AirQualityCardProps) {
  if (!air || air.europeanAqi == null) {
    return (
      <div className="glass flex h-full min-h-[168px] flex-col justify-center rounded-[var(--radius-card)] p-5">
        <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-surface-muted">
          <Leaf className="h-3.5 w-3.5" aria-hidden="true" />
          Air quality
        </p>
        <p className="mt-3 text-sm text-surface-muted">
          Air quality data is unavailable for this location right now.
        </p>
      </div>
    );
  }

  const value = air.europeanAqi;
  const band = aqiBand(value, 'european');
  const position = aqiPosition(value, 'european') * 100;
  const bands = aqiBands('european');
  const dominant = aqiDominantPollutant(air);

  const pollutants: Array<{ label: string; value: number | null }> = [
    { label: 'PM2.5', value: air.pm2_5 },
    { label: 'PM10', value: air.pm10 },
    { label: 'O₃', value: air.ozone },
    { label: 'NO₂', value: air.no2 },
  ];

  return (
    <div className="glass flex h-full flex-col rounded-[var(--radius-card)] p-5">
      <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-surface-muted">
        <Leaf className="h-3.5 w-3.5" aria-hidden="true" />
        Air quality
      </p>

      <div className="mt-2 flex items-baseline gap-2.5">
        <span className="tnum font-display text-4xl font-bold text-surface">{Math.round(value)}</span>
        <span className="text-sm font-semibold" style={{ color: band.color }}>
          {band.label}
        </span>
      </div>

      {/* European AQI segmented scale */}
      <div
        className="relative mt-3 h-2 rounded-full"
        role="img"
        aria-label={`European air quality index ${Math.round(value)} of 100, ${band.label}`}
      >
        <div className="flex h-full overflow-hidden rounded-full" aria-hidden="true">
          {bands.map((b) => (
            <div
              key={b.label}
              className="h-full"
              style={{ background: b.color, width: `${(Math.min(b.max, 100) / 100) * 100 / bands.length}%`, opacity: 0.9 }}
            />
          ))}
        </div>
        <div
          className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
          style={{ left: `${position}%`, background: band.color }}
          aria-hidden="true"
        />
      </div>
      <div className="tnum mt-1 flex justify-between text-[10px] text-surface-faint" aria-hidden="true">
        <span>0</span>
        <span>EAQI</span>
        <span>100+</span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5">
        {pollutants.map((pollutant) => (
          <div key={pollutant.label} className="flex items-baseline justify-between gap-2">
            <span className="text-xs text-surface-muted">{pollutant.label}</span>
            <span className="tnum text-xs font-semibold text-surface">
              {pollutant.value != null ? Math.round(pollutant.value) : '—'}
              <span className="ml-0.5 text-[9px] font-normal text-surface-faint">µg/m³</span>
            </span>
          </div>
        ))}
      </div>

      <p className="mt-auto pt-3 text-[11px] text-surface-faint">
        {dominant ? `Main pollutant: ${dominant}. ` : ''}
        {air.usAqi != null ? `US AQI ${Math.round(air.usAqi)}. ` : ''}
        European AQI by CAMS.
      </p>
    </div>
  );
}
