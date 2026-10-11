'use client';

import { CloudOff, Crosshair, Loader2, WifiOff } from 'lucide-react';
import { LogoMark } from '@/components/brand/Logo';
import { SearchBar } from '@/components/weather/SearchBar';
import { POPULAR_CITIES } from '@/lib/cities';
import { countryFlag } from '@/lib/units';
import type { City } from '@/types/weather';

/** Full-page loading skeletons mirroring the loaded layout. */
export function LoadingSkeletons() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-4 sm:gap-6">
      <div className="glass rounded-[var(--radius-hero)] p-5 sm:p-8">
        <div className="skeleton h-7 w-48" />
        <div className="skeleton mt-2 h-4 w-32" />
        <div className="mt-6 flex items-end justify-between gap-6">
          <div className="skeleton h-24 w-40 sm:h-32 sm:w-56" />
          <div className="skeleton h-24 w-24 rounded-full sm:h-32 sm:w-32" />
        </div>
        <div className="mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="skeleton h-14 rounded-2xl" />
          ))}
        </div>
      </div>
      <div className="skeleton h-64 rounded-[var(--radius-card)]" />
      <div className="flex gap-2 overflow-hidden">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="skeleton h-28 w-[74px] shrink-0 rounded-2xl sm:w-[80px]" />
        ))}
      </div>
      <div className="skeleton h-80 rounded-[var(--radius-card)]" />
    </div>
  );
}

interface ErrorStateProps {
  message?: string;
  onRetry: () => void;
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div
      role="alert"
      className="glass animate-fade-up mx-auto flex max-w-lg flex-col items-center rounded-[var(--radius-hero)] px-6 py-14 text-center"
    >
      <span className="glass-subtle flex h-16 w-16 items-center justify-center rounded-full">
        <CloudOff className="h-8 w-8 text-surface-muted" aria-hidden="true" />
      </span>
      <h2 className="mt-5 font-display text-xl font-bold text-surface">
        Couldn’t load the weather
      </h2>
      <p className="mt-2 text-sm text-surface-muted">
        {message ?? 'The weather service is unreachable right now. Check your connection and try again.'}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="focus-ring mt-6 rounded-full bg-aurora-500 px-6 py-2.5 text-sm font-semibold text-[#04211C] shadow-[var(--shadow-glow)] transition-transform duration-250 hover:bg-aurora-400 active:scale-95"
      >
        Try again
      </button>
    </div>
  );
}

interface EmptyStateProps {
  onSelect: (city: City) => void;
  onLocate: () => void;
  locating: boolean;
}

export function EmptyState({ onSelect, onLocate, locating }: EmptyStateProps) {
  return (
    <div className="animate-fade-up mx-auto flex max-w-xl flex-col items-center px-2 py-10 text-center sm:py-16">
      <LogoMark className="h-20 w-20 shadow-[var(--shadow-glow)] rounded-[22px]" />
      <h1 className="mt-6 font-display text-4xl font-bold tracking-tight text-surface sm:text-5xl">
        Weather, elevated.
      </h1>
      <p className="mt-3 max-w-sm text-sm leading-relaxed text-surface-muted sm:text-base">
        Live conditions, 24-hour trends, a 7-day outlook and air quality — rendered
        against a sky that reacts to the weather itself.
      </p>

      <div className="mt-8 w-full max-w-md">
        <SearchBar onSelect={onSelect} />
      </div>

      <button
        type="button"
        onClick={onLocate}
        disabled={locating}
        className="focus-ring mt-4 flex items-center gap-2 rounded-full bg-aurora-500 px-6 py-2.5 text-sm font-semibold text-[#04211C] shadow-[var(--shadow-glow)] transition-all duration-250 hover:bg-aurora-400 active:scale-95 disabled:opacity-70"
      >
        {locating ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <Crosshair className="h-4 w-4" aria-hidden="true" />
        )}
        {locating ? 'Locating…' : 'Use my location'}
      </button>

      <fieldset className="mt-10 w-full">
        <legend className="text-[11px] font-semibold uppercase tracking-[0.16em] text-surface-muted">
          Popular right now
        </legend>
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          {POPULAR_CITIES.map((city) => (
            <button
              key={city.id}
              type="button"
              onClick={() => onSelect(city)}
              className="glass glass-hover focus-ring flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium text-surface"
            >
              <span aria-hidden="true">{countryFlag(city.countryCode)}</span>
              {city.name}
            </button>
          ))}
        </div>
      </fieldset>
    </div>
  );
}

export function OfflineBanner() {
  return (
    <div
      role="status"
      className="sticky top-16 z-30 mx-auto flex w-fit items-center gap-2 rounded-full border border-aurora-500/40 bg-[rgb(10_27_30/0.85)] px-4 py-2 text-xs font-medium text-aurora-200 shadow-[var(--shadow-glass)] backdrop-blur-md"
    >
      <WifiOff className="h-3.5 w-3.5" aria-hidden="true" />
      You’re offline — showing the last known forecast
    </div>
  );
}
