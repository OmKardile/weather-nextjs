'use client';

import { Crosshair, Loader2 } from 'lucide-react';
import { Logo } from '@/components/brand/Logo';
import { SearchBar } from '@/components/weather/SearchBar';
import type { City, Units } from '@/types/weather';
import { cn } from '@/lib/utils';

interface TopBarProps {
  units: Units;
  onToggleUnits: () => void;
  onSelectCity: (city: City) => void;
  onLocate: () => void;
  locating: boolean;
}

function UnitToggle({ units, onToggle }: { units: Units; onToggle: () => void }) {
  return (
    <div
      role="group"
      aria-label="Temperature units"
      className="glass-subtle flex h-9 items-center rounded-full p-1"
    >
      {(['metric', 'imperial'] as const).map((option) => {
        const active = units === option;
        return (
          <button
            key={option}
            type="button"
            aria-pressed={active}
            onClick={active ? undefined : onToggle}
            className={cn(
              'focus-ring h-7 min-w-9 rounded-full px-2.5 text-xs font-semibold tnum transition-all duration-250',
              active
                ? 'bg-aurora-500 text-[#04211C] shadow-[0_0_16px_-4px_rgb(34_188_160/0.8)]'
                : 'text-surface-muted hover:text-surface',
            )}
          >
            {option === 'metric' ? '°C' : '°F'}
          </button>
        );
      })}
    </div>
  );
}

function LocationButton({
  onLocate,
  locating,
}: {
  onLocate: () => void;
  locating: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onLocate}
      disabled={locating}
      aria-label="Use my location"
      title="Use my location"
      className="glass-subtle focus-ring flex h-11 w-11 items-center justify-center rounded-full text-surface transition-all duration-250 hover:bg-[var(--surface-strong)] disabled:opacity-70"
    >
      {locating ? (
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
      ) : (
        <Crosshair className="h-5 w-5" aria-hidden="true" />
      )}
    </button>
  );
}

export function TopBar({ units, onToggleUnits, onSelectCity, onLocate, locating }: TopBarProps) {
  return (
    <header className="sticky top-0 z-40">
      <div className="glass border-x-0 border-t-0">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-2 px-4 sm:gap-4 sm:px-6">
          <Logo className="shrink-0" />
          <div className="flex min-w-0 flex-1 justify-center">
            <SearchBar onSelect={onSelectCity} className="max-w-md" />
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <UnitToggle units={units} onToggle={onToggleUnits} />
            <LocationButton onLocate={onLocate} locating={locating} />
          </div>
        </div>
      </div>
    </header>
  );
}
