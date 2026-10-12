'use client';

import { useState } from 'react';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Icon } from '@/components/icons/Icon';
import { useCitySearch } from '@/hooks/use-city-search';
import { countryFlag } from '@/lib/units';
import type { City, Units } from '@/types/weather';
import { cn } from '@/lib/utils';

/* ================================================================== */
/* CommandPalette — ⌘K Spotlight.                                       */
/* Search cities (live geocoding), switch units, open AI, customize     */
/* cards, save the current city, jump to sections. Full keyboard nav.   */
/* (No theme command — the interface themes itself from the live sky.)  */
/* ================================================================== */

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  savedCities: City[];
  activeCity: City | null;
  activeCitySaved: boolean;
  units: Units;
  mapOpen: boolean;
  onSelectCity: (city: City) => void;
  onToggleUnits: () => void;
  onCustomizeCards: () => void;
  onCompareCities: () => void;
  onAskAi: () => void;
  onToggleMap: () => void;
  onLocate: () => void;
  locating: boolean;
  onSaveCurrentCity: () => void;
  onRefresh: () => void;
  onJumpTo: (sectionId: string) => void;
}

const JUMP_TARGETS: Array<{
  id: string;
  label: string;
  icon: 'clock' | 'calendar' | 'droplet' | 'gauge' | 'sparkle' | 'sky' | 'time' | 'ledger';
}> = [
  { id: 'hourly', label: 'Hourly forecast', icon: 'clock' },
  { id: 'daily', label: '7-day forecast', icon: 'calendar' },
  { id: 'air', label: 'Air quality', icon: 'droplet' },
  { id: 'ledger', label: 'Forecast log', icon: 'ledger' },
  { id: 'sky', label: 'Sky & photography', icon: 'sky' },
  { id: 'details', label: 'Weather details', icon: 'gauge' },
  { id: 'timemachine', label: 'Time machine', icon: 'time' },
  { id: 'advisor', label: 'Smart advisor', icon: 'sparkle' },
];

const ICON_NAMES = {
  clock: 'sunrise',
  calendar: 'moon-phase',
  droplet: 'droplet',
  gauge: 'gauge',
  sparkle: 'sparkle',
  sky: 'moon-phase',
  time: 'sunset',
  ledger: 'check',
} as const;

export function CommandPalette(props: CommandPaletteProps) {
  const {
    open,
    onOpenChange,
    savedCities,
    activeCity,
    activeCitySaved,
    units,
    mapOpen,
    onSelectCity,
    onToggleUnits,
    onCustomizeCards,
    onCompareCities,
    onAskAi,
    onToggleMap,
    onLocate,
    locating,
    onSaveCurrentCity,
    onRefresh,
    onJumpTo,
  } = props;

  const [query, setQuery] = useState('');
  const search = useCitySearch(query);
  const isSearching = query.trim().length >= 2;
  const results = search.data ?? [];

  const close = () => {
    setQuery('');
    onOpenChange(false);
  };
  const run = (action: () => void) => {
    action();
    close();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setQuery('');
        onOpenChange(next);
      }}
    >
      <DialogContent
        className="overflow-hidden rounded-3xl border-none bg-transparent p-0 shadow-none sm:max-w-lg"
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">Search and commands</DialogTitle>
        <DialogDescription className="sr-only">
          Search cities worldwide or run quick actions.
        </DialogDescription>
        <Command
          shouldFilter={false}
          onValueChange={() => {
            /* item selection handled per-item */
          }}
          loop
          className="glass-2-overlay rounded-3xl [--font-size:14px]"
        >
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder="Search cities or type a command…"
            className="text-surface placeholder:text-surface-faint"
          />
          <CommandList className="scroll-slim max-h-[min(60dvh,420px)] px-1 pb-2 text-surface">
            {isSearching ? (
              <>
                {search.isFetching && results.length === 0 ? (
                  <p className="px-3 py-6 text-center text-sm text-surface-faint">Searching…</p>
                ) : null}
                <CommandEmpty>No cities found for “{query.trim()}”.</CommandEmpty>
                <CommandGroup heading="Cities">
                  {results.map((city) => (
                    <CommandItem
                      key={`${city.id}-${city.latitude}`}
                      value={`${city.name} ${city.country} ${city.id}`}
                      onSelect={() => run(() => onSelectCity(city))}
                      className="rounded-xl text-surface aria-selected:bg-aurora-500/15"
                    >
                      <Icon name="pin" size={16} className="shrink-0 text-surface-faint" />
                      <span className="flex min-w-0 items-center gap-1.5">
                        <span className="truncate font-medium">{city.name}</span>
                        <span aria-hidden="true">{countryFlag(city.countryCode)}</span>
                      </span>
                      <span className="ml-auto truncate text-xs text-surface-faint">
                        {[city.admin1, city.country].filter(Boolean).join(' · ')}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            ) : (
              <>
                {savedCities.length > 0 && (
                  <CommandGroup heading="Saved cities">
                    {savedCities.map((city) => (
                      <CommandItem
                        key={city.id}
                        value={`saved-${city.id}-${city.name}`}
                        onSelect={() => run(() => onSelectCity(city))}
                        className="rounded-xl text-surface aria-selected:bg-aurora-500/15"
                      >
                        <Icon name="bookmark" size={16} className="shrink-0 text-aurora-400" />
                        <span className="flex min-w-0 items-center gap-1.5">
                          <span className="truncate font-medium">{city.name}</span>
                          <span aria-hidden="true">{countryFlag(city.countryCode)}</span>
                        </span>
                        {activeCity?.id === city.id && (
                          <span className="ml-auto text-[10px] font-semibold uppercase tracking-wider text-aurora-400">
                            Current
                          </span>
                        )}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}

                <CommandSeparator className="my-1 bg-[var(--surface-border)]" />

                <CommandGroup heading="Actions">
                  <CommandItem
                    value="units"
                    onSelect={() => run(onToggleUnits)}
                    className="rounded-xl text-surface aria-selected:bg-aurora-500/15"
                  >
                    <Icon name="thermometer" size={16} className="shrink-0 text-surface-faint" />
                    Switch to {units === 'metric' ? '°F' : '°C'}
                  </CommandItem>
                  {activeCity && !activeCitySaved && (
                    <CommandItem
                      value="save-city"
                      onSelect={() => run(onSaveCurrentCity)}
                      className="rounded-xl text-surface aria-selected:bg-aurora-500/15"
                    >
                      <Icon name="plus" size={16} className="shrink-0 text-surface-faint" />
                      Save {activeCity.name}
                    </CommandItem>
                  )}
                  <CommandItem
                    value="locate"
                    onSelect={() => run(onLocate)}
                    disabled={locating}
                    className="rounded-xl text-surface aria-selected:bg-aurora-500/15"
                  >
                    <Icon name="locate" size={16} className="shrink-0 text-surface-faint" />
                    {locating ? 'Locating…' : 'Use my location'}
                  </CommandItem>
                  <CommandItem
                    value="refresh"
                    onSelect={() => run(onRefresh)}
                    className="rounded-xl text-surface aria-selected:bg-aurora-500/15"
                  >
                    <Icon name="refresh" size={16} className="shrink-0 text-surface-faint" />
                    Refresh weather
                  </CommandItem>
                  <CommandItem
                    value="ask-ai"
                    onSelect={() => run(onAskAi)}
                    className="rounded-xl text-surface aria-selected:bg-aurora-500/15"
                  >
                    <Icon name="sparkle" size={16} className="shrink-0 text-aurora-400" />
                    Ask AI about the weather
                  </CommandItem>
                  <CommandItem
                    value="customize-cards"
                    onSelect={() => run(onCustomizeCards)}
                    className="rounded-xl text-surface aria-selected:bg-aurora-500/15"
                  >
                    <Icon name="grip" size={16} className="shrink-0 text-surface-faint" />
                    Customize cards
                  </CommandItem>
                  {savedCities.length >= 2 && (
                    <CommandItem
                      value="compare-cities"
                      onSelect={() => run(onCompareCities)}
                      className="rounded-xl text-surface aria-selected:bg-aurora-500/15"
                    >
                      <Icon name="compare" size={16} className="shrink-0 text-aurora-400" />
                      Compare saved cities
                    </CommandItem>
                  )}
                  <CommandItem
                    value="map"
                    onSelect={() => run(onToggleMap)}
                    className="rounded-xl text-surface aria-selected:bg-aurora-500/15"
                  >
                    <Icon name="map" size={16} className="shrink-0 text-aurora-400" />
                    {mapOpen ? 'Close map' : 'Open map'}
                  </CommandItem>
                </CommandGroup>

                {activeCity && (
                  <>
                    <CommandSeparator className="my-1 bg-[var(--surface-border)]" />
                    <CommandGroup heading="Jump to">
                      {JUMP_TARGETS.map((target) => (
                        <CommandItem
                          key={target.id}
                          value={`jump-${target.id}`}
                          onSelect={() => run(() => onJumpTo(target.id))}
                          className="rounded-xl text-surface aria-selected:bg-aurora-500/15"
                        >
                          <Icon
                            name={ICON_NAMES[target.icon]}
                            size={16}
                            className="shrink-0 text-surface-faint"
                          />
                          {target.label}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </>
                )}
              </>
            )}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
