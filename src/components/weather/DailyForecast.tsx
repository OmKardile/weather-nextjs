'use client';

import { WeatherIcon } from '@/components/weather/WeatherIcon';
import { formatTemp, formatWeekday } from '@/lib/units';
import type { DailyPoint, Units } from '@/types/weather';

interface DailyForecastProps {
  days: DailyPoint[];
  units: Units;
}

/**
 * 7-day forecast rows with a temperature range bar normalized across the week.
 */
export function DailyForecast({ days, units }: DailyForecastProps) {
  if (days.length === 0) return null;

  const weekMin = Math.min(...days.map((day) => day.tempMin));
  const weekMax = Math.max(...days.map((day) => day.tempMax));
  const span = Math.max(weekMax - weekMin, 1);

  return (
    <ol className="flex flex-col" aria-label="7 day forecast">
      {days.map((day, index) => {
        const left = ((day.tempMin - weekMin) / span) * 100;
        const width = Math.max(((day.tempMax - day.tempMin) / span) * 100, 6);
        const isToday = index === 0;

        return (
          <li
            key={day.date}
            className="grid grid-cols-[58px_36px_1fr_84px] items-center gap-2 rounded-xl px-2 py-2.5 transition-colors hover:bg-[var(--surface-subtle)] sm:grid-cols-[72px_40px_1fr_110px] sm:gap-3 sm:px-3"
          >
            <span className="flex flex-col">
              <span
                className={
                  isToday
                    ? 'text-sm font-semibold text-aurora-400'
                    : 'text-sm font-medium text-surface'
                }
              >
                {isToday ? 'Today' : formatWeekday(day.date)}
              </span>
              <span className="tnum text-[10px] text-surface-faint">{day.date.slice(5)}</span>
            </span>

            <WeatherIcon condition={day.condition} isDay size={30} className="justify-self-center" />

            <div
              className="relative h-1.5 overflow-hidden rounded-full bg-[var(--surface-subtle)]"
              aria-hidden="true"
            >
              <div
                className="absolute inset-y-0 rounded-full"
                style={{
                  left: `${left}%`,
                  width: `${width}%`,
                  background: 'linear-gradient(90deg, #74DCC2, #22BCA0)',
                }}
              />
            </div>

            <span className="tnum flex items-baseline justify-end gap-1.5 text-sm">
              <span className="font-semibold text-surface">
                {formatTemp(day.tempMax, units)}
              </span>
              <span className="text-surface-faint">{formatTemp(day.tempMin, units)}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
