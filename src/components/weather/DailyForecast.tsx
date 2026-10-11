'use client';

import { Droplets } from 'lucide-react';
import { WeatherIcon } from '@/components/weather/WeatherIcon';
import { usePreferences } from '@/hooks/use-preferences';
import { formatTemp, formatWeekday } from '@/lib/units';
import { conditionLabel } from '@/lib/wmo';
import { cn } from '@/lib/utils';
import type { DailyPoint, Units } from '@/types/weather';

interface DailyForecastProps {
  days: DailyPoint[];
  units: Units;
  /** Current temperature (°C) — positions the "now" marker on today's row. */
  currentTempC?: number;
}

/**
 * Daily forecast rows with temperature range bars normalized across the
 * whole 16-day window (stable when the 7 ↔ 16 toggle switches).
 * 7-day / 16-day segmented toggle, persisted in the preferences store.
 */
export function DailyForecast({ days, units, currentTempC }: DailyForecastProps) {
  const forecastDays = usePreferences((state) => state.forecastDays);
  const setForecastDays = usePreferences((state) => state.setForecastDays);

  if (days.length === 0) return null;

  const showToggle = days.length > 8;
  const count = showToggle ? Math.min(forecastDays, days.length) : days.length;
  const visible = days.slice(0, count);

  // Normalize across ALL days so the bars don't re-scale when toggling.
  const weekMin = Math.min(...days.map((day) => day.tempMin));
  const weekMax = Math.max(...days.map((day) => day.tempMax));
  const span = Math.max(weekMax - weekMin, 1);

  const nowPct =
    currentTempC != null
      ? Math.min(Math.max(((currentTempC - weekMin) / span) * 100, 1.5), 98.5)
      : null;

  return (
    <div>
      {showToggle ? (
        <div className="mb-1 flex items-center justify-end px-1 sm:px-2">
          <div
            role="group"
            aria-label="Forecast length"
            className="glass-subtle flex h-8 items-center rounded-full p-0.5"
          >
            {([7, 16] as const).map((option) => {
              const active = forecastDays === option;
              return (
                <button
                  key={option}
                  type="button"
                  aria-pressed={active}
                  onClick={active ? undefined : () => setForecastDays(option)}
                  className={cn(
                    'focus-ring tnum h-7 min-w-14 rounded-full px-3 text-xs font-semibold transition-all duration-200',
                    active
                      ? 'bg-aurora-500 text-[#04211C] shadow-[0_0_14px_-4px_rgb(34_188_160/0.8)]'
                      : 'text-surface-muted hover:text-surface',
                  )}
                >
                  {option}-day
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <ol
        aria-label={`Daily forecast for the next ${count} days`}
        className="scroll-slim flex flex-col lg:max-h-[426px] lg:overflow-y-auto lg:pr-1"
      >
        {visible.map((day, index) => {
          const left = ((day.tempMin - weekMin) / span) * 100;
          const width = Math.max(((day.tempMax - day.tempMin) / span) * 100, 4);
          const isToday = index === 0;
          const precip = Math.round(day.precipitationProbabilityMax);
          const label = conditionLabel(day.weatherCode);

          return (
            <li
              key={day.date}
              className="grid grid-cols-[54px_30px_1fr_76px] items-center gap-2 rounded-xl px-2 py-2.5 transition-colors hover:bg-[var(--surface-subtle)] sm:grid-cols-[62px_32px_9rem_1fr_3rem_5.5rem] sm:gap-2.5 sm:px-3"
            >
              <span className="flex flex-col">
                <span
                  className={cn(
                    'text-sm font-medium',
                    isToday ? 'font-semibold text-aurora-400' : 'text-surface',
                  )}
                >
                  {isToday ? 'Today' : formatWeekday(day.date)}
                </span>
                <span className="tnum text-[10px] text-surface-faint">{day.date.slice(5)}</span>
                {isToday && currentTempC != null ? (
                  <span className="tnum sr-only">{` · now ${formatTemp(currentTempC, units)}`}</span>
                ) : null}
              </span>

              <WeatherIcon
                condition={day.condition}
                isDay
                size={30}
                className="justify-self-center"
              />

              <span
                className="hidden truncate text-xs text-surface-muted sm:block"
                aria-label={label}
                title={label}
              >
                {label}
              </span>

              <div
                className="relative h-1.5 overflow-visible rounded-full bg-[var(--surface-subtle)]"
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
                {isToday && nowPct != null ? (
                  <span
                    className="absolute -top-[5px] z-[1] h-4 w-[3px] -translate-x-1/2 rounded-full bg-white shadow-[0_0_0_1.5px_rgb(34_188_160/0.9)]"
                    style={{ left: `${nowPct}%` }}
                  />
                ) : null}
              </div>

              <span className="tnum hidden items-center justify-end gap-0.5 text-[11px] sm:flex">
                {precip > 0 ? (
                  <span className={precip >= 40 ? 'text-aurora-300' : 'text-surface-faint'}>
                    <Droplets className="h-2.5 w-2.5" aria-hidden="true" />
                    {precip}%
                  </span>
                ) : null}
              </span>

              <span className="tnum flex items-baseline justify-end gap-1.5 text-sm">
                <span className="font-semibold text-surface">{formatTemp(day.tempMax, units)}</span>
                <span className="text-surface-faint">{formatTemp(day.tempMin, units)}</span>
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
