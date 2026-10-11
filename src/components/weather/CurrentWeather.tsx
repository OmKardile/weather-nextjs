'use client';

import { format } from 'date-fns';
import {
  ArrowDown,
  ArrowUp,
  Bookmark,
  BookmarkCheck,
  Droplets,
  MapPin,
  RefreshCw,
  Sunrise,
  Wind,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { WeatherIcon } from '@/components/weather/WeatherIcon';
import { formatLocalClock, formatLocalDate } from '@/lib/time';
import { compassPoint, countryFlag, displayTemp, formatHour, formatTemp, formatWind } from '@/lib/units';
import { conditionLabel } from '@/lib/wmo';
import type { City, Units, WeatherBundle } from '@/types/weather';
import { cn } from '@/lib/utils';

interface CurrentWeatherProps {
  city: City;
  data: WeatherBundle;
  units: Units;
  isSaved: boolean;
  onToggleSave: () => void;
  onRefresh: () => void;
  refreshing: boolean;
}

function HeroChip({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="glass-subtle flex items-center gap-2.5 rounded-2xl px-3.5 py-2.5">
      <span className="text-surface-muted" aria-hidden="true">
        {icon}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-surface-faint">
          {label}
        </span>
        <span className="tnum truncate text-sm font-semibold text-surface">{value}</span>
      </span>
    </div>
  );
}

export function CurrentWeather({
  city,
  data,
  units,
  isSaved,
  onToggleSave,
  onRefresh,
  refreshing,
}: CurrentWeatherProps) {
  const { current, daily, hourly, utcOffsetSeconds } = data;
  const today = daily[0];
  const label = conditionLabel(current.weatherCode);

  // Live wall-clock for the location, ticking twice a minute.
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setTick((value) => value + 1), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  const clock = useMemo(
    () => formatLocalClock(utcOffsetSeconds),
    [utcOffsetSeconds, tick],
  );

  const precipChance = hourly[0]?.precipitationProbability ?? 0;
  const updatedAt = (() => {
    try {
      return format(new Date(data.fetchedAt), units === 'metric' ? 'HH:mm' : 'h:mm a');
    } catch {
      return '';
    }
  })();

  return (
    <section
      aria-label={`Current weather in ${city.name}`}
      className="glass animate-fade-up rounded-[var(--radius-hero)] p-5 shadow-[var(--shadow-glass)] sm:p-8"
    >
      {/* Header row */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 font-display text-2xl font-bold tracking-tight text-surface sm:text-3xl">
            <MapPin className="h-5 w-5 shrink-0 text-surface-muted" aria-hidden="true" />
            <span className="truncate">{city.name}</span>
            <span aria-hidden="true">{countryFlag(city.countryCode)}</span>
          </h1>
          <p className="mt-1 truncate text-sm text-surface-muted">
            {[city.admin1, city.country].filter(Boolean).join(' · ')}
          </p>
          <p className="tnum mt-0.5 text-xs text-surface-faint">
            {formatLocalDate(utcOffsetSeconds)} · {clock} local time
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleSave}
            aria-pressed={isSaved}
            aria-label={isSaved ? `Remove ${city.name} from saved cities` : `Save ${city.name} to saved cities`}
            title={isSaved ? 'Remove from saved' : 'Save city'}
            className="glass-subtle focus-ring flex h-10 w-10 items-center justify-center rounded-full text-surface transition-all duration-250 hover:bg-[var(--surface-strong)]"
          >
            {isSaved ? (
              <BookmarkCheck className="h-5 w-5 text-aurora-400" aria-hidden="true" />
            ) : (
              <Bookmark className="h-5 w-5" aria-hidden="true" />
            )}
          </button>
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            aria-label="Refresh weather data"
            title="Refresh"
            className="glass-subtle focus-ring flex h-10 w-10 items-center justify-center rounded-full text-surface transition-all duration-250 hover:bg-[var(--surface-strong)] disabled:opacity-60"
          >
            <RefreshCw
              className={cn('h-5 w-5', refreshing && 'animate-spin')}
              aria-hidden="true"
            />
          </button>
        </div>
      </div>

      {/* Hero temperature */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-4 sm:mt-8">
        <div className="animate-fade-in">
          <p
            className="font-display text-[92px] font-semibold leading-none tracking-tight text-surface tnum sm:text-[128px]"
            aria-label={`${displayTemp(current.temperature, units)} degrees`}
          >
            {formatTemp(current.temperature, units)}
          </p>
          <p className="mt-3 text-lg font-medium text-surface">{label}</p>
          <p className="tnum text-sm text-surface-muted">
            Feels like {formatTemp(current.apparentTemperature, units)}
            {units === 'metric' ? 'C' : 'F'}
          </p>
        </div>

        <div className="animate-scale-in mx-auto sm:mx-0">
          <WeatherIcon
            condition={current.condition}
            isDay={current.isDay}
            size={140}
            className="h-28 w-28 sm:h-36 sm:w-36"
          />
        </div>
      </div>

      {/* Quick chips */}
      <div className="mt-6 grid grid-cols-2 gap-2.5 sm:mt-8 sm:grid-cols-4 sm:gap-3">
        {today && (
          <HeroChip
            icon={
              <span className="flex gap-0.5">
                <ArrowUp className="h-4 w-4" />
                <ArrowDown className="h-4 w-4" />
              </span>
            }
            label="High · Low"
            value={`${formatTemp(today.tempMax, units)} / ${formatTemp(today.tempMin, units)}`}
          />
        )}
        <HeroChip
          icon={<Droplets className="h-4 w-4" />}
          label="Precip chance"
          value={`${precipChance}%`}
        />
        <HeroChip
          icon={<Wind className="h-4 w-4" />}
          label="Wind"
          value={`${formatWind(current.windSpeed, units)} ${compassPoint(current.windDirection)}`}
        />
        {today && (
          <HeroChip
            icon={<Sunrise className="h-4 w-4" />}
            label="Sunrise · Sunset"
            value={`${formatHour(today.sunrise, units)} → ${formatHour(today.sunset, units)}`}
          />
        )}
      </div>

      <p className="tnum mt-4 text-[11px] text-surface-faint">
        Updated {updatedAt} · data by Open-Meteo
      </p>
    </section>
  );
}
