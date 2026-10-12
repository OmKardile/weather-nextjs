'use client';

import { format } from 'date-fns';
import {
  Bookmark,
  BookmarkCheck,
  Droplets,
  Flame,
  Minus,
  RefreshCw,
  Sunrise,
  TrendingDown,
  TrendingUp,
  Wind,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { WeatherIcon } from '@/components/weather/WeatherIcon';
import { ShareCardButton } from '@/components/weather/ShareCardButton';
import { LiquidGlass } from '@/components/glass/LiquidGlass';
import { useAchievements } from '@/hooks/use-achievements';
import { useCountUp } from '@/hooks/use-count-up';
import { streakFromDays } from '@/lib/achievements';
import { formatLocalClock, formatLocalDate } from '@/lib/time';
import {
  compassPoint,
  countryFlag,
  displayTemp,
  formatHour,
  formatTemp,
  formatTempDelta,
  formatWind,
} from '@/lib/units';
import { conditionLabel } from '@/lib/wmo';
import type { City, Units, WeatherBundle } from '@/types/weather';
import { cn } from '@/lib/utils';

/* ================================================================== */
/* CurrentWeather — the hero.                                           */
/*                                                                     */
/* NO panel: composed directly on the animated scene like Apple        */
/* Weather — city, giant thin temperature, condition, H/L, all white   */
/* (vibrancy tiers) with the scene scrim handling contrast. The        */
/* moon/sun glyph is large (~200px) with a soft glow. Quick stats are  */
/* a row of small flat Surface chips.                                  */
/* ================================================================== */

interface CurrentWeatherProps {
  city: City;
  data: WeatherBundle;
  units: Units;
  isSaved: boolean;
  onToggleSave: () => void;
  onRefresh: () => void;
  refreshing: boolean;
}

/** Small flat Surface chip for quick stats (content layer, no lensing). */
function StatChip({
  icon,
  label,
  value,
  iconClassName,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  iconClassName?: string;
}) {
  return (
    <div className="surface rounded-full px-3.5 py-2 transition-transform duration-200 ease-[var(--ease-spring-bouncy)] active:scale-95">
      <p className="flex items-center gap-2 text-[13px] leading-none text-surface">
        <span className={iconClassName ?? 'text-surface-muted'} aria-hidden="true">
          {icon}
        </span>
        <span className="font-medium">{value}</span>
        <span className="text-[12px] text-surface-muted">{label}</span>
      </p>
    </div>
  );
}

/** "vs yesterday" quick stat — compares today's forecast high with yesterday's measured high. */
function YesterdayChip({
  today,
  yesterday,
  units,
}: {
  today: { tempMax: number } | undefined;
  yesterday: { tempMax: number; tempMin: number } | null | undefined;
  units: Units;
}) {
  if (!today || !yesterday) return null;
  const delta = today.tempMax - yesterday.tempMax;
  // ±0.5° counts as "same" — no directional icon, neutral tone.
  const direction = delta > 0.5 ? 'up' : delta < -0.5 ? 'down' : 'flat';
  return (
    <StatChip
      icon={
        direction === 'up' ? (
          <TrendingUp className="h-4 w-4" />
        ) : direction === 'down' ? (
          <TrendingDown className="h-4 w-4" />
        ) : (
          <Minus className="h-4 w-4" />
        )
      }
      iconClassName={
        direction === 'up'
          ? 'text-amber-300'
          : direction === 'down'
            ? 'text-aurora-300'
            : 'text-surface-muted'
      }
      label="vs yesterday"
      value={formatTempDelta(delta, units)}
    />
  );
}

/** Visit-streak quick stat — a warm ember for consecutive daily visits (≥2). */
function StreakChip({ streak }: { streak: number }) {
  if (streak < 2) return null;
  const glow = streak >= 7;
  return (
    <StatChip
      icon={<Flame className="h-4 w-4" />}
      iconClassName={
        glow
          ? 'text-amber-300 drop-shadow-[0_0_6px_rgb(251_191_36/0.8)]'
          : 'text-amber-300/90'
      }
      label="day streak"
      value={`${streak}`}
    />
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
  const { current, daily, hourly, yesterday, utcOffsetSeconds } = data;
  const today = daily[0];
  const label = conditionLabel(current.weatherCode);

  // Visit streak (achievements store — hydration-safe: the server snapshot
  // is empty, so the chip only appears after mount-effect hydration).
  const { days } = useAchievements();
  const streak = useMemo(() => streakFromDays(days), [days]);

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

  const tempValue = displayTemp(current.temperature, units);
  // The giant readout counts to its new value (city switch, refresh) —
  // eased, tabular-nums so digits never shift width.
  const animatedTemp = useCountUp(tempValue);

  return (
    <section
      aria-label={`Current weather in ${city.name}`}
      className="animate-fade-up relative px-1 pt-2 sm:px-2"
    >
      {/* Header row — city + local time left, floating controls right */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-on-scene flex items-center gap-2 text-[28px] font-semibold leading-tight tracking-[-0.02em] sm:text-[34px]">
            <span className="truncate">{city.name}</span>
            <span aria-hidden="true" className="text-[0.8em] opacity-90">
              {countryFlag(city.countryCode)}
            </span>
          </h1>
          <p className="text-on-scene-2 mt-1 truncate text-[15px]">
            {[city.admin1, city.country].filter(Boolean).join(' · ')}
          </p>
          <p className="text-on-scene-3 tnum mt-0.5 text-[13px]">
            {formatLocalDate(utcOffsetSeconds)} · {clock} local
          </p>
        </div>

        <div className="flex items-center gap-2">
          <ShareCardButton city={city} data={data} units={units} />
          <LiquidGlass
            as="button"
            type="button"
            onClick={onToggleSave}
            aria-pressed={isSaved}
            aria-label={isSaved ? `Remove ${city.name} from saved cities` : `Save ${city.name} to saved cities`}
            title={isSaved ? 'Remove from saved' : 'Save city'}
            className="focus-ring flex h-11 w-11 items-center justify-center rounded-full"
          >
            {isSaved ? (
              <BookmarkCheck className="h-5 w-5" aria-hidden="true" />
            ) : (
              <Bookmark className="h-5 w-5" aria-hidden="true" />
            )}
          </LiquidGlass>
          <LiquidGlass
            as="button"
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            aria-label="Refresh weather data"
            title="Refresh"
            className="focus-ring flex h-11 w-11 items-center justify-center rounded-full disabled:opacity-60"
          >
            <RefreshCw
              className={cn('h-5 w-5', refreshing && 'animate-spin')}
              aria-hidden="true"
            />
          </LiquidGlass>
        </div>
      </div>

      {/* Giant temperature + glowing glyph — directly on the scene */}
      <div className="mt-4 flex items-end justify-between gap-2 sm:mt-6">
        <div className="animate-fade-in min-w-0">
          <p
            aria-label={`${tempValue} degrees ${label}`}
            className="text-on-scene tnum flex items-start leading-[0.95] tracking-[-0.045em]"
            style={{ fontSize: 'clamp(104px, 24vw, 176px)', fontWeight: 200 }}
          >
            {animatedTemp}
            <span
              aria-hidden="true"
              className="mt-[0.09em] ml-[0.02em]"
              style={{ fontSize: '0.52em', fontWeight: 300 }}
            >
              °
            </span>
          </p>
          <p className="text-on-scene mt-3 text-[19px] font-medium sm:text-[21px]">{label}</p>
          <p className="text-on-scene-2 mt-1 text-[15px]">
            {today ? (
              <span className="tnum">
                H {formatTemp(today.tempMax, units)} · L {formatTemp(today.tempMin, units)}
              </span>
            ) : null}
            <span className="tnum">
              {today ? '  ·  ' : ''}Feels like {formatTemp(current.apparentTemperature, units)}
            </span>
          </p>
        </div>

        <div className="animate-scale-in hidden shrink-0 pb-2 sm:block">
          <WeatherIcon
            condition={current.condition}
            isDay={current.isDay}
            size={200}
            className="h-44 w-44 drop-shadow-[0_10px_44px_rgb(255_255_255/0.28)] lg:h-[200px] lg:w-[200px]"
          />
        </div>
      </div>

      {/* Quick stats — row of small Surface chips */}
      <div className="mt-6 flex flex-wrap items-center gap-2 sm:mt-7 sm:gap-2.5">
        <StatChip
          icon={<Droplets className="h-4 w-4" />}
          label="rain"
          value={`${precipChance}%`}
        />
        <StatChip
          icon={<Wind className="h-4 w-4" />}
          label={compassPoint(current.windDirection)}
          value={formatWind(current.windSpeed, units)}
        />
        {today && (
          <StatChip
            icon={<Sunrise className="h-4 w-4" />}
            label={`→ ${formatHour(today.sunset, units)}`}
            value={formatHour(today.sunrise, units)}
          />
        )}
        <YesterdayChip today={today} yesterday={yesterday} units={units} />
        <StreakChip streak={streak} />
      </div>

      <p className="text-on-scene-3 tnum mt-5 text-[12px]">
        Updated {updatedAt} · data by Open-Meteo
      </p>
    </section>
  );
}
