'use client';

import { useMemo } from 'react';
import type { ReactElement } from 'react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { WeatherIcon } from '@/components/weather/WeatherIcon';
import { Icon } from '@/components/icons/Icon';
import { usePreferences } from '@/hooks/use-preferences';
import { useWeather } from '@/hooks/use-weather';
import { countryFlag, formatTemp } from '@/lib/units';
import type { City, Units } from '@/types/weather';
import { cn } from '@/lib/utils';

/* ================================================================== */
/* CityReorderList — drag-to-reorder saved cities.                      */
/*                                                                     */
/* The completion of the reorderCities store action (v3.1.0): a        */
/* dnd-kit sortable list matching the ForecastSections recipe          */
/* (PointerSensor 5px activation + KeyboardSensor with arrow-key       */
/* sorting on the focusable grip). Used by the desktop sidebar and     */
/* the mobile Cities tab in their reorder modes.                       */
/* ================================================================== */

interface CityReorderListProps {
  cities: City[];
  units: Units;
  activeCity: City | null;
  /** Exit reorder mode (the caller owns the mode flag). */
  onDone: () => void;
  className?: string;
}

const cityKey = (city: City) => `${city.id}-${city.latitude},${city.longitude}`;

function SortableCityRow({
  city,
  units,
  active,
}: {
  city: City;
  units: Units;
  active: boolean;
}): ReactElement {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: cityKey(city),
  });
  const weather = useWeather(city);
  const bundle = weather.data ?? null;

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'surface-subtle relative flex touch-none items-center gap-2 rounded-2xl px-2 py-2.5',
        active && 'border-aurora-500/40',
        isDragging && 'z-20 scale-[1.02] shadow-[0_14px_36px_-8px_rgb(0_0_0/0.4)]',
      )}
    >
      {/* Grip — the drag surface (keyboard sortable via attributes) */}
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Reorder ${city.name}`}
        className="focus-ring flex h-9 w-7 shrink-0 cursor-grab items-center justify-center rounded-xl text-surface-faint transition-colors hover:text-surface active:cursor-grabbing"
      >
        <Icon name="grip" size={15} />
      </button>

      <span aria-hidden="true" className="text-base leading-none">
        {countryFlag(city.countryCode) || '📍'}
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-sm font-semibold text-surface">{city.name}</span>
          {active && (
            <span className="rounded-full bg-aurora-500/18 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-aurora-300">
              Current
            </span>
          )}
        </span>
        <span className="mt-0.5 block truncate text-[11px] text-surface-muted">
          {city.admin1 ? `${city.admin1} · ` : ''}
          {city.country || 'Located'}
        </span>
      </span>

      <span className="flex w-16 shrink-0 items-center justify-end gap-1.5">
        {bundle ? (
          <>
            <WeatherIcon
              condition={bundle.current.condition}
              isDay={bundle.current.isDay}
              size={20}
            />
            <span className="tnum text-sm font-medium text-surface">
              {formatTemp(bundle.current.temperature, units)}
            </span>
          </>
        ) : (
          <span className="skeleton h-4 w-12" aria-hidden="true" />
        )}
      </span>
    </div>
  );
}

export function CityReorderList({
  cities,
  units,
  activeCity,
  onDone,
  className,
}: CityReorderListProps): ReactElement {
  const reorderCities = usePreferences((state) => state.reorderCities);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const keys = useMemo(() => cities.map(cityKey), [cities]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = cities.findIndex((city) => cityKey(city) === active.id);
    const to = cities.findIndex((city) => cityKey(city) === over.id);
    if (from < 0 || to < 0) return;
    reorderCities(arrayMove(cities, from, to));
  };

  return (
    <div className={cn('flex flex-col gap-2', className)} role="group" aria-label="Reorder saved cities">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={keys} strategy={verticalListSortingStrategy}>
          {cities.map((city) => (
            <SortableCityRow
              key={cityKey(city)}
              city={city}
              units={units}
              active={activeCity?.id === city.id}
            />
          ))}
        </SortableContext>
      </DndContext>
      <button
        type="button"
        onClick={onDone}
        className="focus-ring mt-1 self-center rounded-full bg-aurora-500 px-5 py-1.5 text-xs font-semibold text-[#04211C] transition-transform duration-200 hover:active:scale-95"
      >
        Done
      </button>
      <p className="text-center text-[11px] text-surface-faint">
        Drag the handle to reorder — or focus it and use the arrow keys.
      </p>
    </div>
  );
}
