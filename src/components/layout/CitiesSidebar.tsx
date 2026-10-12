'use client';

import { Glass } from '@/components/glass/Glass';
import { Icon } from '@/components/icons/Icon';
import { WeatherIcon } from '@/components/weather/WeatherIcon';
import { useWeather } from '@/hooks/use-weather';
import { countryFlag, formatTemp } from '@/lib/units';
import type { City, Units } from '@/types/weather';
import { cn } from '@/lib/utils';

/* ================================================================== */
/* CitiesSidebar — macOS translucent sidebar (desktop lg+).            */
/* Saved cities as glass rows: live temp + icon + 12h sparkline.       */
/* ================================================================== */

interface CitiesSidebarProps {
  cities: City[];
  activeCity: City | null;
  units: Units;
  onSelect: (city: City) => void;
  onRemove: (id: number) => void;
  onLocate: () => void;
  locating: boolean;
  onAddCity: () => void;
  /** Open the compare-cities dialog (≥2 saved cities). */
  onCompare: () => void;
  className?: string;
}

/** Tiny 12-hour temperature sparkline. */
function Sparkline({ temps, muted }: { temps: number[]; muted?: boolean }) {
  if (temps.length < 2) return <div className="h-5 w-16 rounded bg-[var(--surface-subtle)]" />;
  const min = Math.min(...temps);
  const max = Math.max(...temps);
  const range = max - min || 1;
  const points = temps
    .map((t, i) => {
      const x = (i / (temps.length - 1)) * 62;
      const y = 17 - ((t - min) / range) * 12;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <svg width={64} height={20} viewBox="0 0 64 20" aria-hidden="true" className="shrink-0">
      <polyline
        points={points}
        fill="none"
        stroke={muted ? '#7E9A94' : '#45D1B3'}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={muted ? 0.55 : 0.95}
      />
    </svg>
  );
}

function CityRow({
  city,
  active,
  units,
  onSelect,
  onRemove,
}: {
  city: City;
  active: boolean;
  units: Units;
  onSelect: (city: City) => void;
  onRemove: (id: number) => void;
}) {
  const weather = useWeather(city);
  const bundle = weather.data ?? null;
  const temps = bundle?.hourly.slice(0, 12).map((h) => h.temperature) ?? [];

  return (
    <div className="group relative">
      <button
        type="button"
        onClick={() => onSelect(city)}
        aria-current={active ? 'true' : undefined}
        className={cn(
          'focus-ring glass-hover flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left',
          active
            ? 'border-aurora-500/40 bg-aurora-500/12'
            : 'glass-subtle border-transparent',
        )}
      >
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-sm font-semibold text-surface">{city.name}</span>
            <span aria-hidden="true" className="text-xs">
              {countryFlag(city.countryCode)}
            </span>
          </span>
          <span className="mt-0.5 block truncate text-[11px] text-surface-faint">
            {city.admin1 ? `${city.admin1} · ` : ''}
            {city.country || 'Located'}
          </span>
        </span>
        <Sparkline temps={temps} muted={!active} />
        <span className="flex w-[68px] shrink-0 items-center justify-end gap-1.5">
          {bundle ? (
            <>
              <WeatherIcon
                condition={bundle.current.condition}
                isDay={bundle.current.isDay}
                size={22}
              />
              <span className="tnum text-sm font-medium text-surface">
                {formatTemp(bundle.current.temperature, units)}
              </span>
            </>
          ) : (
            <span className="skeleton h-4 w-12" aria-hidden="true" />
          )}
        </span>
      </button>
      <button
        type="button"
        onClick={() => onRemove(city.id)}
        aria-label={`Remove ${city.name} from saved cities`}
        title={`Remove ${city.name}`}
        className="focus-ring absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full border border-[var(--surface-border)] bg-[var(--surface-strong)] text-surface-muted opacity-0 shadow-[var(--shadow-glass)] transition-opacity duration-200 hover:text-[#E1552F] focus-visible:opacity-100 group-hover:opacity-100"
      >
        <Icon name="x" size={12} />
      </button>
    </div>
  );
}

export function CitiesSidebar({
  cities,
  activeCity,
  units,
  onSelect,
  onRemove,
  onLocate,
  locating,
  onAddCity,
  onCompare,
  className,
}: CitiesSidebarProps) {
  return (
    <Glass
      level="base"
      as="aside"
      aria-label="Saved cities"
      className={cn('hidden w-72 shrink-0 flex-col rounded-none border-x-0 border-y-0 lg:flex', className)}
    >
      <div className="flex items-center justify-between px-4 pb-2 pt-4">
        <h2 className="card-label">
          Cities
        </h2>
        <div className="flex items-center gap-1">
          {cities.length >= 2 && (
            <button
              type="button"
              onClick={onCompare}
              aria-label="Compare saved cities"
              title="Compare cities"
              className="surface-subtle focus-ring flex h-7 w-7 items-center justify-center rounded-full text-surface-muted transition-colors hover:text-surface"
            >
              <Icon name="compare" size={14} />
            </button>
          )}
          <button
            type="button"
            onClick={onAddCity}
            aria-label="Add a city"
            title="Add a city (⌘K)"
            className="glass-subtle focus-ring flex h-7 w-7 items-center justify-center rounded-full text-surface-muted transition-colors hover:text-surface"
          >
            <Icon name="plus" size={14} />
          </button>
        </div>
      </div>

      <div className="scroll-slim flex-1 space-y-1.5 overflow-y-auto px-3 pb-3">
        {cities.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--surface-border)] p-4 text-center">
            <p className="text-xs leading-relaxed text-surface-muted">
              No saved cities yet.
              <br />
              Press{' '}
              <kbd className="mx-0.5 inline-block rounded-md border border-[var(--surface-border)] bg-[var(--surface-subtle)] px-1.5 py-0.5 text-[10px] font-medium text-surface">
                ⌘K
              </kbd>{' '}
              to search the world.
            </p>
          </div>
        ) : (
          cities.map((city) => (
            <CityRow
              key={city.id}
              city={city}
              active={activeCity?.id === city.id}
              units={units}
              onSelect={onSelect}
              onRemove={onRemove}
            />
          ))
        )}
      </div>

      <div className="space-y-1.5 border-t border-[var(--surface-border)] p-3">
        <button
          type="button"
          onClick={onLocate}
          disabled={locating}
          className="glass-subtle glass-hover focus-ring flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left disabled:opacity-60"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-aurora-500/15 text-aurora-400">
            <Icon name="locate" size={15} animated={locating} />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-surface">My location</span>
            <span className="block text-[11px] text-surface-faint">
              {locating ? 'Locating…' : 'Use device location'}
            </span>
          </span>
        </button>
      </div>
    </Glass>
  );
}
