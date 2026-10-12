'use client';

import { Glass } from '@/components/glass/Glass';
import { rampGradient, type RampStop } from './map-styles';

/* ================================================================== */
/* MapLegend — bottom-left glass chip: active metric, color scale      */
/* swatches + units (radar gets the dBZ-ish ramp + "Past 2h").         */
/* ================================================================== */

export interface LegendInfo {
  label: string;
  ramp: RampStop[];
  ticks: string[];
  note?: string;
}

export interface MapLegendProps {
  legend: LegendInfo | null;
  loading?: boolean;
}

export function MapLegend({ legend, loading }: MapLegendProps) {
  if (!legend) return null;
  return (
    <Glass
      level="raised"
      aria-label={`${legend.label} legend`}
      className="absolute bottom-3 left-3 z-20 max-w-[calc(100vw-1.5rem)] rounded-2xl px-3.5 py-2.5 lg:bottom-4 lg:left-4"
    >
      <p className="flex items-center gap-2 card-label">
        {legend.label}
        {loading && (
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-aurora-400" aria-hidden="true" />
        )}
      </p>
      <div className="mt-1.5 flex items-center gap-2">
        <span
          aria-hidden="true"
          className="h-2 w-32 rounded-full sm:w-40"
          style={{ background: rampGradient(legend.ramp) }}
        />
      </div>
      <div className="mt-1 flex w-[calc(8rem+1rem)] justify-between text-[10px] font-medium text-surface-faint sm:w-[calc(10rem+1rem)]">
        {legend.ticks.map((tick) => (
          <span key={tick} className="tnum">
            {tick}
          </span>
        ))}
      </div>
      {legend.note && (
        <p className="mt-1 text-[10px] font-medium text-surface-muted">{legend.note}</p>
      )}
    </Glass>
  );
}
