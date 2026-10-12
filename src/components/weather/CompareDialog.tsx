'use client';

import { useMemo, useState } from 'react';
import type { ReactElement } from 'react';
import { Crown, Droplets, Wind } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { Icon } from '@/components/icons/Icon';
import { WeatherIcon } from '@/components/weather/WeatherIcon';
import { useWeatherMany } from '@/hooks/use-weather';
import { conditionLabel } from '@/lib/wmo';
import { countryFlag, formatTemp } from '@/lib/units';
import type { City, Units, WeatherBundle } from '@/types/weather';
import { cn } from '@/lib/utils';

/* ================================================================== */
/* CompareDialog — side-by-side live conditions across saved cities.    */
/* Uses useWeatherMany (same cache keys as the sidebar rows), so        */
/* opening the dialog is instant when cities are already loaded.        */
/* ================================================================== */

interface CompareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cities: City[];
  activeCity: City | null;
  units: Units;
  onSelect: (city: City) => void;
}

type SortMode = 'comfort' | 'warmest' | 'name';

const SORT_MODES: Array<{ id: SortMode; label: string }> = [
  { id: 'comfort', label: 'Comfort' },
  { id: 'warmest', label: 'Warmest' },
  { id: 'name', label: 'A–Z' },
];

/**
 * Deterministic comfort score, 0–100: distance from a 21 °C feels-like
 * ideal, upcoming rain, strong wind and tropical humidity each subtract.
 * Runs client-side on already-fetched data — no extra requests.
 */
function comfortScore(bundle: WeatherBundle): number {
  const tempPenalty = Math.min(35, Math.abs(bundle.current.apparentTemperature - 21) * 2.2);
  const next12 = bundle.hourly.slice(0, 12);
  const precipMax = next12.reduce((max, h) => Math.max(max, h.precipitationProbability), 0);
  const precipPenalty = Math.min(30, precipMax * 0.45);
  const windPenalty = Math.min(15, Math.max(0, bundle.current.windSpeed - 20) * 0.5);
  const humidityPenalty = bundle.current.humidity > 85 ? 5 : 0;
  return Math.round(
    Math.max(0, Math.min(100, 100 - tempPenalty - precipPenalty - windPenalty - humidityPenalty)),
  );
}

function comfortTone(score: number): string {
  if (score >= 70) return 'from-aurora-500 to-aurora-300';
  if (score >= 45) return 'from-[#E8C54D] to-[#F0954A]';
  return 'from-[#E1552F] to-[#F0954A]';
}

function localTime(timezone: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: timezone,
    }).format(new Date());
  } catch {
    return '';
  }
}

interface CitySnapshot {
  city: City;
  bundle: WeatherBundle | null;
  comfort: number;
}

function CompareRow({
  snapshot,
  units,
  active,
  best,
  onSelect,
}: {
  snapshot: CitySnapshot;
  units: Units;
  active: boolean;
  best: boolean;
  onSelect: () => void;
}): ReactElement {
  const { city, bundle } = snapshot;

  if (!bundle) {
    return (
      <div className="surface-subtle flex items-center gap-3 rounded-2xl p-3.5" aria-busy="true">
        <span className="skeleton h-9 w-9 shrink-0 rounded-xl" aria-hidden="true" />
        <span className="min-w-0 flex-1 space-y-1.5">
          <span className="skeleton block h-3.5 w-24 rounded" aria-hidden="true" />
          <span className="skeleton block h-3 w-16 rounded" aria-hidden="true" />
        </span>
        <span className="skeleton h-6 w-12 rounded" aria-hidden="true" />
      </div>
    );
  }

  const next12 = bundle.hourly.slice(0, 12);
  const precipMax = next12.reduce((max, h) => Math.max(max, h.precipitationProbability), 0);
  const time = localTime(bundle.timezone);
  const comfort = snapshot.comfort;

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={active ? 'true' : undefined}
      aria-label={`Show weather for ${city.name}, currently ${formatTemp(bundle.current.temperature, units)} and ${conditionLabel(bundle.current.weatherCode)}`}
      className={cn(
        'focus-ring surface-subtle surface-hover flex w-full flex-col gap-3 rounded-2xl p-3.5 text-left sm:flex-row sm:items-center',
        active && 'border-aurora-500/40 bg-aurora-500/12',
        best && !active && 'border-aurora-500/25',
      )}
    >
      {/* City identity */}
      <span className="flex min-w-0 flex-1 items-center gap-3">
        <WeatherIcon
          condition={bundle.current.condition}
          isDay={bundle.current.isDay}
          size={36}
          className="shrink-0"
        />
        <span className="min-w-0">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-sm font-semibold text-surface">{city.name}</span>
            <span aria-hidden="true" className="text-xs leading-none">
              {countryFlag(city.countryCode)}
            </span>
            {best && (
              <span className="inline-flex items-center gap-1 rounded-full bg-aurora-500/18 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-aurora-300">
                <Crown className="h-2.5 w-2.5" aria-hidden="true" />
                Best now
              </span>
            )}
          </span>
          <span className="mt-0.5 block truncate text-[11px] text-surface-muted">
            {conditionLabel(bundle.current.weatherCode)}
            {time ? ` · ${time} local` : ''}
          </span>
        </span>
      </span>

      {/* Now + feels like */}
      <span className="flex shrink-0 items-baseline gap-2 sm:w-28 sm:flex-col sm:items-end sm:gap-0">
        <span className="tnum text-xl font-semibold leading-none text-surface">
          {formatTemp(bundle.current.temperature, units)}
        </span>
        <span className="tnum text-[11px] text-surface-muted">
          feels {formatTemp(bundle.current.apparentTemperature, units)}
        </span>
      </span>

      {/* Rain + wind */}
      <span className="flex shrink-0 items-center gap-3 sm:w-28 sm:justify-end">
        <span
          className="tnum inline-flex items-center gap-1 text-xs text-surface-muted"
          title={`Rain chance next 12 hours: ${precipMax}%`}
        >
          <Droplets className="h-3.5 w-3.5" aria-hidden="true" />
          {precipMax}%
        </span>
        <span
          className="tnum inline-flex items-center gap-1 text-xs text-surface-muted"
          title={`Wind: ${Math.round(bundle.current.windSpeed)} km/h`}
        >
          <Wind className="h-3.5 w-3.5" aria-hidden="true" />
          {Math.round(bundle.current.windSpeed)}
        </span>
      </span>

      {/* Comfort meter */}
      <span className="flex shrink-0 items-center gap-2 sm:w-24">
        <span
          role="img"
          aria-label={`Comfort score ${comfort} out of 100`}
          className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--surface-subtle)]"
        >
          <span
            className={cn(
              'block h-full rounded-full bg-gradient-to-r transition-[width] duration-500',
              comfortTone(comfort),
            )}
            style={{ width: `${Math.max(comfort, 3)}%` }}
          />
        </span>
        <span className="tnum text-xs font-medium text-surface-muted">{comfort}</span>
      </span>
    </button>
  );
}

export function CompareDialog({
  open,
  onOpenChange,
  cities,
  activeCity,
  units,
  onSelect,
}: CompareDialogProps): ReactElement {
  const [sort, setSort] = useState<SortMode>('comfort');
  const queries = useWeatherMany(cities);

  const snapshots = useMemo<CitySnapshot[]>(
    () =>
      cities.map((city, index) => ({
        city,
        bundle: queries[index]?.data ?? null,
        comfort: queries[index]?.data ? comfortScore(queries[index].data as WeatherBundle) : 0,
      })),
    [cities, queries],
  );

  const withData = snapshots.filter((s) => s.bundle != null);
  const best =
    withData.length >= 2
      ? withData.reduce((top, s) => (s.comfort > top.comfort ? s : top), withData[0])
      : null;

  const ordered = [...snapshots].sort((a, b) => {
    if (sort === 'name') return a.city.name.localeCompare(b.city.name);
    if (!a.bundle || !b.bundle) return 0;
    if (sort === 'warmest') return b.bundle.current.temperature - a.bundle.current.temperature;
    return b.comfort - a.comfort;
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden rounded-3xl border-none bg-transparent p-0 shadow-none sm:max-w-2xl">
        <div className="surface-overlay flex max-h-[82dvh] flex-col overflow-hidden rounded-3xl">
          <div className="flex items-start justify-between gap-3 border-b border-[var(--surface-border)] p-5 pb-4">
            <div className="min-w-0">
              <DialogTitle className="flex items-center gap-2 text-base font-semibold text-surface">
                <Icon name="compare" size={16} className="text-aurora-400" />
                Compare cities
              </DialogTitle>
              <DialogDescription className="mt-1 text-xs leading-relaxed text-surface-muted">
                Live conditions across your saved cities — the comfort score blends temperature,
                rain, wind and humidity.
              </DialogDescription>
            </div>
          </div>

          <div
            className="flex items-center justify-between gap-3 px-5 pt-3"
            role="group"
            aria-label="Sort compared cities"
          >
            <p className="text-[12px] font-medium text-surface-muted">
              {cities.length} {cities.length === 1 ? 'city' : 'cities'}
            </p>
            <div className="flex items-center gap-1 rounded-full border border-[var(--surface-border)] bg-[var(--surface-subtle)] p-0.5">
              {SORT_MODES.map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => setSort(mode.id)}
                  aria-pressed={sort === mode.id}
                  className={cn(
                    'focus-ring rounded-full px-2.5 py-1 text-[12px] font-medium transition-colors',
                    sort === mode.id
                      ? 'bg-aurora-500/20 text-aurora-300'
                      : 'text-surface-muted hover:text-surface',
                  )}
                >
                  {mode.label}
                </button>
              ))}
            </div>
          </div>

          <div className="scroll-slim flex-1 space-y-2 overflow-y-auto p-5 pt-3">
            {cities.length < 2 ? (
              <div className="rounded-2xl border border-dashed border-[var(--surface-border)] p-6 text-center">
                <p className="text-sm font-medium text-surface">Save at least two cities</p>
                <p className="mt-1 text-xs leading-relaxed text-surface-muted">
                  Pin cities with the bookmark in the hero (or ⌘K) and they&apos;ll line up here
                  for a side-by-side comparison.
                </p>
              </div>
            ) : (
              ordered.map((snapshot) => (
                <CompareRow
                  key={`${snapshot.city.id}-${snapshot.city.latitude}`}
                  snapshot={snapshot}
                  units={units}
                  active={activeCity?.id === snapshot.city.id}
                  best={best != null && snapshot.city.id === best.city.id}
                  onSelect={() => {
                    onSelect(snapshot.city);
                    onOpenChange(false);
                  }}
                />
              ))
            )}
          </div>

          <p className="border-t border-[var(--surface-border)] px-5 py-3 text-center text-[11px] leading-relaxed text-surface-faint">
            Comfort blends feels-like temperature, rain chance over the next 12 hours, wind and
            humidity. Tap a city to open its forecast.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
