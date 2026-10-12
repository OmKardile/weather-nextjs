'use client';

import { Plus, Star, X } from 'lucide-react';
import { useWeather } from '@/hooks/use-weather';
import { countryFlag, formatTemp } from '@/lib/units';
import type { City, Units } from '@/types/weather';
import { cn } from '@/lib/utils';

interface SavedCitiesProps {
  cities: City[];
  activeCity: City | null;
  units: Units;
  onSelect: (city: City) => void;
  onRemove: (id: number) => void;
  onSaveCurrent: () => void;
  canSaveCurrent: boolean;
}

function SavedCityChip({
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
  const temp = weather.data?.current.temperature;

  return (
    <div
      className={cn(
        'glass group flex items-center overflow-hidden rounded-full transition-all duration-250',
        active && 'border-[var(--surface-ring)] bg-[var(--surface-strong)]',
      )}
    >
      <button
        type="button"
        onClick={() => onSelect(city)}
        aria-label={`Show weather for ${city.name}${temp != null ? `, currently ${formatTemp(temp, units)}` : ''}`}
        aria-current={active ? 'true' : undefined}
        className="focus-ring flex items-center gap-2 py-2 pl-3.5 pr-1 text-left"
      >
        <span aria-hidden="true" className="text-sm leading-none">
          {countryFlag(city.countryCode) || '📍'}
        </span>
        <span className="max-w-28 truncate text-sm font-medium text-surface">{city.name}</span>
        <span className="tnum text-xs text-surface-muted">
          {temp != null ? formatTemp(temp, units) : <span className="inline-block h-3 w-7 rounded skeleton" />}
        </span>
      </button>
      <button
        type="button"
        onClick={() => onRemove(city.id)}
        aria-label={`Remove ${city.name} from saved cities`}
        className="focus-ring mr-1 flex h-6 w-6 items-center justify-center rounded-full text-surface-faint transition-colors hover:bg-[var(--surface-strong)] hover:text-surface"
      >
        <X className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}

export function SavedCities({
  cities,
  activeCity,
  units,
  onSelect,
  onRemove,
  onSaveCurrent,
  canSaveCurrent,
}: SavedCitiesProps) {
  return (
    <section aria-labelledby="saved-cities-heading">
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <h2
          id="saved-cities-heading"
          className="flex items-center gap-1.5 card-label"
        >
          <Star className="h-3.5 w-3.5" aria-hidden="true" />
          Saved cities
        </h2>
        <span className="text-[10px] text-surface-faint">{cities.length}/8</span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {cities.map((city) => (
          <SavedCityChip
            key={city.id}
            city={city}
            active={activeCity?.id === city.id && activeCity?.latitude === city.latitude}
            units={units}
            onSelect={onSelect}
            onRemove={onRemove}
          />
        ))}

        {canSaveCurrent ? (
          <button
            type="button"
            onClick={onSaveCurrent}
            className="glass glass-hover focus-ring flex items-center gap-1.5 rounded-full py-2 pl-3 pr-3.5 text-sm font-medium text-surface"
          >
            <Plus className="h-3.5 w-3.5 text-aurora-400" aria-hidden="true" />
            Save {activeCity?.name}
          </button>
        ) : null}

        {cities.length === 0 && !canSaveCurrent && (
          <p className="text-sm text-surface-muted">
            No saved cities yet — tap the bookmark in the hero to pin one.
          </p>
        )}
      </div>
    </section>
  );
}
