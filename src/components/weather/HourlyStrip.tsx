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
              'glass-subtle flex w-[74px] shrink-0 snap-start flex-col items-center gap-1.5 rounded-2xl px-2 py-3 transition-shadow duration-300 sm:w-[80px]',
              isNow &&
                'border-aurora-500/45 bg-aurora-500/12 shadow-[0_0_20px_-6px_rgb(69_209_179/0.45),inset_0_1px_0_rgb(255_255_255/0.14)]',
            )}
          >
            <span
              className={cn(
                'tnum text-[12px] font-semibold',
                isNow ? 'text-aurora-400' : 'text-surface-muted',
              )}
            >
              {isNow ? 'Now' : formatHour(hour.time, units)}
            </span>
            <WeatherIcon condition={hour.condition} isDay={hour.isDay} size={30} />
            <span className={cn('tnum text-sm font-semibold', isNow && 'text-[15px] font-bold')}>
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
