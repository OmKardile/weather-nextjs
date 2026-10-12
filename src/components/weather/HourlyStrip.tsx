'use client';

import { Droplets } from 'lucide-react';
import { WeatherIcon } from '@/components/weather/WeatherIcon';
import { formatHour, formatTemp } from '@/lib/units';
import type { HourlyPoint, Units } from '@/types/weather';
import { cn } from '@/lib/utils';

/* ================================================================== */
/* HourlyStrip — horizontally scrollable 48-hour strip with snap        */
/* points. Hours inside a golden-hour window (passed down from the     */
/* sky engine via ForecastSections) get a warm underglow — a subtle    */
/* amber wash + label tint that echoes the DaylightCard language.     */
/* ================================================================== */

export interface HourWindow {
  /** Local ISO "yyyy-MM-dd'T'HH:mm" (same frame as hour.time). */
  start: string;
  end: string;
  /** Extra context for the tooltip/aria label. */
  label?: 'Golden hour';
}

interface HourlyStripProps {
  hours: HourlyPoint[];
  units: Units;
  /** Golden-hour windows (today + tomorrow) to highlight; optional. */
  goldenWindows?: HourWindow[];
}

/** Lexicographic window test — both strings share the ISO local frame. */
function inWindow(time: string, window: HourWindow): boolean {
  return time >= window.start && time <= window.end;
}

export function HourlyStrip({ hours, units, goldenWindows = [] }: HourlyStripProps) {
  return (
    <div
      role="list"
      aria-label="Hourly forecast for the next 48 hours"
      className="scroll-slim -mx-1 flex snap-x snap-mandatory gap-2 overflow-x-auto px-1 pb-2"
    >
      {hours.map((hour, index) => {
        const isNow = index === 0;
        const golden = goldenWindows.find((w) => inWindow(hour.time, w));
        return (
          <div
            key={hour.time}
            role="listitem"
            aria-label={`${formatHour(hour.time, units)}, ${formatTemp(hour.temperature, units)}, ${hour.precipitationProbability}% precipitation chance${golden ? ', golden hour' : ''}`}
            title={golden ? 'Golden hour' : undefined}
            className={cn(
              'glass-subtle relative flex w-[74px] shrink-0 snap-start flex-col items-center gap-1.5 overflow-hidden rounded-2xl px-2 py-3 transition-shadow duration-300 sm:w-[80px]',
              isNow &&
                'border-aurora-500/45 bg-aurora-500/12 shadow-[0_0_20px_-6px_rgb(69_209_179/0.45),inset_0_1px_0_rgb(255_255_255/0.14)]',
              !isNow && golden && 'border-amber-300/25',
            )}
          >
            {/* Golden-hour warm underglow — a soft amber wash rising from
                the bottom edge, away from the "Now" aurora treatment. */}
            {!isNow && golden ? (
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 bottom-0 h-[62%]"
                style={{
                  background:
                    'linear-gradient(180deg, transparent 0%, rgb(245 201 123 / 0.05) 35%, rgb(245 201 123 / 0.16) 100%)',
                  boxShadow: 'inset 0 -10px 14px -12px rgb(245 201 123 / 0.55)',
                }}
              />
            ) : null}

            <span
              className={cn(
                'tnum relative text-[12px] font-semibold',
                isNow ? 'text-aurora-400' : golden ? 'text-amber-200/90' : 'text-surface-muted',
              )}
            >
              {isNow ? 'Now' : formatHour(hour.time, units)}
            </span>
            <WeatherIcon condition={hour.condition} isDay={hour.isDay} size={30} />
            <span className={cn('tnum relative text-sm font-semibold', isNow && 'text-[15px] font-bold')}>
              {formatTemp(hour.temperature, units)}
            </span>
            <span
              className={cn(
                'tnum relative flex items-center gap-0.5 text-[10px]',
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
