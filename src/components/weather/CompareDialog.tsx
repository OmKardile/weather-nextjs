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
import { useWeather } from '@/hooks/use-weather';
import { conditionLabel } from '@/lib/wmo';
import { countryFlag, formatTemp } from '@/lib/units';
import type { City, Units, WeatherBundle } from '@/types/weather';
import { cn } from '@/lib/utils';

/* ================================================================== */
/* CompareDialog — side-by-side live conditions across saved cities.    */
/* Reuses the per-city query cache (same keys as the sidebar rows), so  */
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
  const score = 100 - tempPenalty - precipPenalty - windPenalty - humidityPenalty;
  return Math.round(Math.max(0, Math.min(100, score)));
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
  comfort: number | null;
  localTime: string;
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
      <div className="glass-subtle flex items-center gap-3 rounded-2xl p-3.5" aria-busy="true">
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
  const comfort = snapshot.comfort ?? 0;

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={active ? 'true' : undefined}
      aria-label={`Show weather for ${city.name}, currently ${formatTemp(bundle.current.temperature, units)} and ${conditionLabel(bundle.current.weatherCode)}`}
      className={cn(
        'focus-ring glass-subtle glass-hover group flex w-full flex-col gap-3 rounded-2xl p-3.5 text-left transition-colors sm:flex-row sm:items-center',
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
            {conditionLabel(bundle.current.weatherCode)} · {snapshot.localTime} local
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

/** Loads one city's bundle from the shared query cache. */
function CitySnapshotLoader({
  city,
  children,
}: {
  city: City;
  children: (snapshot: CitySnapshot) => ReactElement;
}): ReactElement {
  const weather = useWeather(city);
  const bundle = weather.data ?? null;
  return (
    <>
      {children({
        city,
        bundle,
        comfort: bundle ? comfortScore(bundle) : null,
        localTime: bundle ? localTime(bundle.timezone) : '',
      })}
    </>
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

  const snapshots = useMemo<CitySnapshot[]>(
    () =>
      cities.map((city) => {
        // Read straight from the query cache (warmed by the sidebar rows)
        // without subscribing — the loader components below own live updates.
        const cached = useWeather.queryCache
          ? undefined
          : undefined; // placeholder to keep hooks out of the map
        void cached;
        return { city, bundle: null, comfort: null, localTime: '' };
      }),
    [cities],
  );
  void snapshots;

  const sorted = useMemo(() => {
    // Sorting happens inside a small render-time registry filled by the
    // loaders below — see SortableList. Here we just keep the mode.
    return cities;
  }, [cities]);
  void sorted;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden rounded-3xl border-none bg-transparent p-0 shadow-none sm:max-w-2xl">
        <div className="glass-2-overlay flex max-h-[82dvh] flex-col overflow-hidden rounded-3xl">
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

          <SortableList
            cities={cities}
            activeCity={activeCity}
            units={units}
            sort={sort}
            onSortChange={setSort}
            onSelect={(city) => {
              onSelect(city);
              onOpenChange(false);
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Sortable list — renders loaders, collects their scores via a render  */
/* registry, sorts, and paints.                                         */
/* ------------------------------------------------------------------ */

function SortableList({
  cities,
  activeCity,
  units,
  sort,
  onSortChange,
  onSelect,
}: {
  cities: City[];
  activeCity: City | null;
  units: Units;
  sort: SortMode;
  onSortChange: (mode: SortMode) => void;
  onSelect: (city: City) => void;
}): ReactElement {
  const registry = useMemo(() => new Map<string, CitySnapshot>(), []);

  return (
    <>
      <div
        className="flex items-center justify-between gap-3 px-5 pt-3"
        role="group"
        aria-label="Sort compared cities"
      >
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-surface-muted">
          {cities.length} {cities.length === 1 ? 'city' : 'cities'}
        </p>
        <div className="flex items-center gap-1 rounded-full border border-[var(--surface-border)] bg-[var(--surface-subtle)] p-0.5">
          {SORT_MODES.map((mode) => (
            <button
              key={mode.id}
              type="button"
              onClick={() => onSortChange(mode.id)}
              aria-pressed={sort === mode.id}
              className={cn(
                'focus-ring rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors',
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
        <SortedRows
          cities={cities}
          registry={registry}
          activeCity={activeCity}
          units={units}
          sort={sort}
          onSelect={onSelect}
        />
      </div>

      <p className="border-t border-[var(--surface-border)] px-5 py-3 text-center text-[10px] leading-relaxed text-surface-faint">
        Comfort blends feels-like temperature, rain chance over the next 12 hours, wind and
        humidity. Tap a city to open its forecast.
      </p>
    </>
  );
}

/**
 * Renders a hidden loader per city (fills the registry), then the visible
 * rows in sorted order. Loaders mount once per dialog open; rows re-render
 * whenever a bundle arrives (score/label updates propagate through the
 * registry object identity).
 */
function SortedRows({
  cities,
  registry,
  activeCity,
  units,
  sort,
  onSelect,
}: {
  cities: City[];
  registry: Map<string, CitySnapshot>;
  activeCity: City | null;
  units: Units;
  sort: SortMode;
  onSelect: (city: City) => void;
}): ReactElement {
  const [tick, setTick] = useState(0);
  const key = (city: City) => `${city.id}-${city.latitude},${city.longitude}`;

  const handleSnapshot = (city: City, snapshot: CitySnapshot) => {
    const id = key(city);
    const prev = registry.get(id);
    if (
      prev?.bundle !== snapshot.bundle ||
      prev?.comfort !== snapshot.comfort ||
      prev?.localTime !== snapshot.localTime
    ) {
      registry.set(id, snapshot);
      setTick((t) => t + 1);
    }
  };

  const withData = cities
    .map((city) => registry.get(key(city)))
    .filter((s): s is CitySnapshot => s?.bundle != null);

  const bestId =
    withData.length >= 2
      ? withData.reduce((best, s) => ((s.comfort ?? 0) > (best.comfort ?? 0) ? s : best), withData[0])
      : null;
  const bestKey = bestId ? key(bestId.city) : null;

  const ordered = useMemo(() => {
    const list = [...cities];
    if (sort === 'name') {
      list.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sort === 'warmest') {
      list.sort((a, b) => {
        const ta = registry.get(key(a))?.bundle?.current.temperature;
        const tb = registry.get(key(b))?.bundle?.current.temperature;
        if (ta == null || tb == null) return 0;
        return tb - ta;
      });
    } else {
      list.sort((a, b) => {
        const ca = registry.get(key(a))?.comfort;
        const cb = registry.get(key(b))?.comfort;
        if (ca == null || cb == null) return 0;
        return cb - ca;
      });
    }
    return list;
    // tick keeps the sort fresh as bundles stream in
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cities, sort, tick, registry]);

  void tick; // read for clarity

  return (
    <>
      {/* Hidden live loaders — one per city, stable mount order */}
      <div className="hidden" aria-hidden="true">
        {cities.map((city) => (
          <CitySnapshotLoader key={key(city)} city={city}>
            {(snapshot) => {
              handleSnapshot(city, snapshot);
              return <span />;
            }}
          </CitySnapshotLoader>
        ))}
      </div>

      {cities.length < 2 ? (
        <div className="rounded-2xl border border-dashed border-[var(--surface-border)] p-6 text-center">
          <p className="text-sm font-medium text-surface">Save at least two cities</p>
          <p className="mt-1 text-xs leading-relaxed text-surface-muted">
            Pin cities with the bookmark in the hero (or ⌘K) and they&apos;ll line up here for a
            side-by-side comparison.
          </p>
        </div>
      ) : (
        ordered.map((city) => {
          const snapshot = registry.get(key(city)) ?? {
            city,
            bundle: null,
            comfort: null,
            localTime: '',
          };
          return (
            <CompareRow
              key={key(city)}
              snapshot={snapshot}
              units={units}
              active={activeCity?.id === city.id}
              best={key(city) === bestKey}
              onSelect={() => onSelect(city)}
            />
          );
        })
      )}
    </>
  );
}
