'use client';

import { Droplets } from 'lucide-react';
import { WeatherIcon } from '@/components/weather/WeatherIcon';
import { formatHour, formatTemp } from '@/lib/units';
import type { HourlyPoint, Units } from '@/types/weather';
import { cn } from '@/lib/utils';

interface HourlyStripProps {
  hours: HourlyPoint[];
  units: Units;
}

/**
 * Horizontally scrollable 48-hour strip with snap points.
 */
export function HourlyStrip({ hours, units }: HourlyStripProps) {
  return (
    <div
      role="list"
      aria-label="Hourly forecast for the next 48 hours"
      className="scroll-slim -mx-1 flex snap-x snap-mandatory gap-2 overflow-x-auto px-1 pb-2"
    >
      {hours.map((hour, index) => {
        const isNow = index === 0;
        return (
          <div
            key={hour.time}
            role="listitem"
            aria-label={`${formatHour(hour.time, units)}, ${formatTemp(hour.temperature, units)}, ${hour.precipitationProbability}% precipitation chance`}
            className={cn(
              'glass-subtle flex w-[74px] shrink-0 snap-start flex-col items-center gap-1.5 rounded-2xl px-2 py-3 sm:w-[80px]',
              isNow && 'border-[var(--surface-ring)] bg-[var(--surface-strong)]',
            )}
          >
            <span
              className={cn(
                'tnum text-[11px] font-semibold uppercase tracking-wide',
                isNow ? 'text-aurora-400' : 'text-surface-muted',
              )}
            >
              {isNow ? 'Now' : formatHour(hour.time, units)}
            </span>
            <WeatherIcon condition={hour.condition} isDay={hour.isDay} size={30} />
            <span className="tnum text-sm font-semibold text-surface">
              {formatTemp(hour.temperature, units)}
            </span>
            <span
              className={cn(
                'tnum flex items-center gap-0.5 text-[10px]',
                hour.precipitationProbability >= 30
                  ? 'text-aurora-300'
                  : 'text-surface-faint',
              )}
            >
              <Droplets className="h-2.5 w-2.5" aria-hidden="true" />
              {hour.precipitationProbability}%
            </span>
          </div>
        );
      })}
    </div>
  );
}
