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
import type { ThemeMode } from '@/hooks/use-preferences';
import { countryFlag } from '@/lib/units';
import type { City, Units } from '@/types/weather';
import { cn } from '@/lib/utils';

/* ================================================================== */
/* CommandPalette — ⌘K Spotlight.                                       */
/* Search cities (live geocoding), switch units/appearance, open AI,    */
/* save the current city, jump to sections. Full keyboard navigation.   */
/* ================================================================== */

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  savedCities: City[];
  activeCity: City | null;
  activeCitySaved: boolean;
  units: Units;
  theme: ThemeMode;
  onSelectCity: (city: City) => void;
  onToggleUnits: () => void;
  onSetTheme: (theme: ThemeMode) => void;
  onAskAi: () => void;
  onLocate: () => void;
  locating: boolean;
  onSaveCurrentCity: () => void;
  onRefresh: () => void;
  onJumpTo: (sectionId: string) => void;
}

const JUMP_TARGETS: Array<{ id: string; label: string; icon: 'clock' | 'calendar' | 'droplet' | 'gauge' | 'sparkle' }> = [
  { id: 'hourly', label: 'Hourly forecast', icon: 'clock' },
  { id: 'daily', label: '7-day forecast', icon: 'calendar' },
  { id: 'air', label: 'Air quality', icon: 'droplet' },
  { id: 'details', label: 'Weather details', icon: 'gauge' },
  { id: 'advisor', label: 'Smart advisor', icon: 'sparkle' },
];

const ICON_NAMES = {
  clock: 'sunrise',
  calendar: 'moon-phase',
  droplet: 'droplet',
  gauge: 'gauge',
  sparkle: 'sparkle',
} as const;

export function CommandPalette(props: CommandPaletteProps) {
  const {
    open,
    onOpenChange,
    savedCities,
    activeCity,
    activeCitySaved,
    units,
    theme,
    onSelectCity,
    onToggleUnits,
    onSetTheme,
    onAskAi,
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
                </CommandGroup>

                <CommandSeparator className="my-1 bg-[var(--surface-border)]" />

                <CommandGroup heading="Appearance">
                  {(['auto', 'light', 'dark'] as const).map((mode) => (
                    <CommandItem
                      key={mode}
                      value={`theme-${mode}`}
                      onSelect={() => run(() => onSetTheme(mode))}
                      className="rounded-xl text-surface aria-selected:bg-aurora-500/15"
                    >
                      <span
                        aria-hidden="true"
                        className={cn(
                          'h-2 w-2 rounded-full',
                          mode === 'auto' && 'bg-gradient-to-br from-aurora-300 to-[#0e2a2e]',
                          mode === 'light' && 'bg-[#F6ECD4]',
                          mode === 'dark' && 'bg-[#0A2B2A]',
                        )}
                      />
                      {mode === 'auto' ? 'Auto (follow the sky)' : mode === 'light' ? 'Light' : 'Dark'}
                      {theme === mode && (
                        <span className="ml-auto text-aurora-400" aria-hidden="true">
                          <Icon name="check" size={14} />
                        </span>
                      )}
                    </CommandItem>
                  ))}
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
