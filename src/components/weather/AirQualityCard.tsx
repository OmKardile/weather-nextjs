'use client';

import { Leaf } from 'lucide-react';
import { aqiBand, aqiPosition, aqiBands, aqiDominantPollutant } from '@/lib/aqi';
import { ExpandableCard } from '@/components/weather/ExpandableCard';
import type { AirQuality, Pollen, Units, WeatherBundle } from '@/types/weather';

/* ================================================================== */
/* AirQualityCard — EAQI + pollutants + pollen sub-section.            */
/* Pollen rows only when bundle.pollen reports coverage (Europe);      */
/* otherwise a single faint "not available in your region" line.       */
/* ================================================================== */

interface AirQualityCardProps {
  bundle: WeatherBundle;
  units: Units;
}

/* ------------------------------------------------------------------ */
/* Pollen scale — none / low / moderate / high (grains per m³).        */
/* Bands: 0 · ≤10 · ≤50 · >50. Marker maps 0…75+ across the track.    */
/* ------------------------------------------------------------------ */

const POLLEN_SEGMENTS = ['None', 'Low', 'Moderate', 'High'] as const;

function pollenLevel(value: number): (typeof POLLEN_SEGMENTS)[number] {
  if (value <= 0) return 'None';
  if (value <= 10) return 'Low';
  if (value <= 50) return 'Moderate';
  return 'High';
}

function pollenPosition(value: number): number {
  return Math.min(Math.max(value / 75, 0), 1) * 100;
}

const TREE_TYPES: Array<{ key: keyof Pollen; label: string }> = [
  { key: 'birch', label: 'birch' },
  { key: 'alder', label: 'alder' },
  { key: 'olive', label: 'olive' },
  { key: 'mugwort', label: 'mugwort' },
  { key: 'ragweed', label: 'ragweed' },
];

function PollenRow({ label, value, note }: { label: string; value: number | null; note?: string }) {
  if (value == null) return null;
  const level = pollenLevel(value);
  const position = pollenPosition(value);
  return (
    <div className="mt-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs text-surface-muted">
          {label}
          {note ? <span className="text-surface-faint"> · {note}</span> : null}
        </span>
        <span className="tnum text-xs font-semibold text-surface">
          {value.toFixed(1)}
          <span className="ml-0.5 text-[9px] font-normal text-surface-faint">grains/m³</span>
        </span>
      </div>
      <div
        className="relative mt-1.5 h-1.5 rounded-full"
        role="img"
        aria-label={`${label} pollen ${value.toFixed(1)} grains per cubic metre — ${level}`}
      >
        <div className="flex h-full overflow-hidden rounded-full" aria-hidden="true">
          {POLLEN_SEGMENTS.map((segment, i) => (
            <div
              key={segment}
              className="h-full"
              style={{
                width: '25%',
                background:
                  i === 0
                    ? 'var(--surface-subtle)'
                    : i === 1
                      ? 'rgb(116 220 194 / 0.4)'
                      : i === 2
                        ? 'rgb(232 197 77 / 0.45)'
                        : 'rgb(241 85 47 / 0.55)',
              }}
            />
          ))}
        </div>
        <div
          className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-aurora-400 shadow"
          style={{ left: `${position}%` }}
          aria-hidden="true"
        />
      </div>
      <div
        className="tnum mt-1 flex justify-between text-[9px] text-surface-faint"
        aria-hidden="true"
      >
        {POLLEN_SEGMENTS.map((segment) => (
          <span key={segment}>{segment}</span>
        ))}
      </div>
    </div>
  );
}

function PollenSection({ pollen }: { pollen: Pollen | null | undefined }) {
  if (!pollen || !pollen.available) {
    return (
      <p className="mt-auto pt-3 text-[11px] text-surface-faint">
        Pollen not available in your region
      </p>
    );
  }

  const trees = TREE_TYPES.map((type) => ({
    ...type,
    value: pollen[type.key] != null ? (pollen[type.key] as number) : null,
  }));
  const worstTree = trees.reduce((worst, t) => ((t.value ?? 0) > (worst.value ?? 0) ? t : worst), trees[0]);

  return (
    <div className="mt-3 border-t border-[var(--surface-border)] pt-3">
      <p className="flex items-baseline justify-between text-[10px] font-semibold uppercase tracking-[0.14em] text-surface-muted">
        Pollen
        <span className="tnum text-[9px] font-normal normal-case tracking-normal text-surface-faint">
          max next 24h
        </span>
      </p>
      <PollenRow
        label="Grass"
        value={pollen.grass != null ? pollen.grass : null}
      />
      <PollenRow
        label="Trees"
        value={worstTree.value}
        note={worstTree.value != null && worstTree.value > 0 ? `highest: ${worstTree.label}` : 'alder · birch · olive · mugwort · ragweed'}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Card                                                               */
/* ------------------------------------------------------------------ */

export function AirQualityCard({ bundle, units }: AirQualityCardProps) {
  const air: AirQuality | null = bundle.airQuality;
  const pollen = bundle.pollen ?? null;

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

  const pollutants: Array<{ label: string; value: number | null; unit: string }> = [
    { label: 'PM2.5', value: air.pm2_5, unit: 'µg/m³' },
    { label: 'PM10', value: air.pm10, unit: 'µg/m³' },
    { label: 'O₃', value: air.ozone, unit: 'µg/m³' },
    { label: 'NO₂', value: air.no2, unit: 'µg/m³' },
    { label: 'SO₂', value: air.so2, unit: 'µg/m³' },
    { label: 'CO', value: air.co, unit: 'µg/m³' },
  ];

  const detail = (
    <div>
      <div className="flex items-baseline gap-3">
        <span className="tnum font-display text-5xl font-bold text-surface">{Math.round(value)}</span>
        <div>
          <p className="text-sm font-semibold" style={{ color: band.color }}>
            {band.label}
          </p>
          <p className="tnum text-xs text-surface-faint">European AQI · 0–100+</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2.5 sm:grid-cols-3">
        {pollutants.map((pollutant) => (
          <div
            key={pollutant.label}
            className="glass-subtle rounded-2xl px-3 py-2.5"
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-surface-faint">
              {pollutant.label}
            </p>
            <p className="tnum mt-0.5 text-sm font-semibold text-surface">
              {pollutant.value != null ? Math.round(pollutant.value) : '—'}
              <span className="ml-1 text-[9px] font-normal text-surface-faint">{pollutant.unit}</span>
            </p>
          </div>
        ))}
      </div>

      <p className="tnum mt-4 text-xs leading-relaxed text-surface-muted">
        {dominant ? `Main pollutant: ${dominant}. ` : ''}
        {air.usAqi != null ? `US AQI ${Math.round(air.usAqi)}. ` : ''}
        European AQI by CAMS.
      </p>

      {pollenDetail(pollen)}
    </div>
  );

  return (
    <ExpandableCard
      label="Air quality"
      bundle={bundle}
      units={units}
      icon={<Leaf className="h-3.5 w-3.5" />}
      renderDetail={detail}
      className="h-full"
    >
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
        {pollutants.slice(0, 4).map((pollutant) => (
          <div key={pollutant.label} className="flex items-baseline justify-between gap-2">
            <span className="text-xs text-surface-muted">{pollutant.label}</span>
            <span className="tnum text-xs font-semibold text-surface">
              {pollutant.value != null ? Math.round(pollutant.value) : '—'}
              <span className="ml-0.5 text-[9px] font-normal text-surface-faint">µg/m³</span>
            </span>
          </div>
        ))}
      </div>

      <PollenSection pollen={pollen} />
    </ExpandableCard>
  );
}

/** Tiny helper so the dialog also shows the pollen lines when available. */
function pollenDetail(pollen: Pollen | null): React.ReactNode {
  if (!pollen || !pollen.available) return null;
  return (
    <div className="mt-4 border-t border-[var(--surface-border)] pt-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-surface-muted">Pollen</p>
      <div className="tnum mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-surface-muted">
        <span>
          Grass <span className="font-semibold text-surface">{(pollen.grass ?? 0).toFixed(1)}</span> grains/m³
        </span>
        <span>
          Trees <span className="font-semibold text-surface">{(Math.max(pollen.alder ?? 0, pollen.birch ?? 0, pollen.olive ?? 0, pollen.mugwort ?? 0, pollen.ragweed ?? 0)).toFixed(1)}</span> grains/m³
        </span>
      </div>
    </div>
  );
}
