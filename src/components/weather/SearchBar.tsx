'use client';

import { Loader2, MapPin, Search } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { useCitySearch } from '@/hooks/use-city-search';
import { countryFlag } from '@/lib/units';
import type { City } from '@/types/weather';
import { cn } from '@/lib/utils';

interface SearchBarProps {
  onSelect: (city: City) => void;
  autoFocus?: boolean;
  className?: string;
}

/**
 * Accessible city search combobox: debounced autocomplete, full keyboard
 * navigation (arrows/enter/escape), ARIA listbox pattern, "/" shortcut.
 */
export function SearchBar({ onSelect, autoFocus, className }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const results = useCitySearch(query);
  const cities = results.data ?? [];
  const minChars = query.trim().length >= 2;
  const showList = open && minChars;

  const select = (city: City) => {
    onSelect(city);
    setQuery('');
    setOpen(false);
    setActiveIndex(-1);
    inputRef.current?.blur();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!showList) {
        setOpen(true);
        return;
      }
      setActiveIndex((index) => (cities.length ? (index + 1) % cities.length : -1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => (cities.length ? (index - 1 + cities.length) % cities.length : -1));
    } else if (event.key === 'Enter') {
      if (showList && activeIndex >= 0 && cities[activeIndex]) {
        event.preventDefault();
        select(cities[activeIndex]);
      }
    } else if (event.key === 'Escape') {
      setOpen(false);
      setActiveIndex(-1);
    } else if (event.key === 'Tab') {
      setOpen(false);
    }
  };

  // "/" anywhere focuses the search (unless already typing in a field).
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable;
      if (event.key === '/' && !typing) {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <div
      ref={containerRef}
      className={cn('relative w-full', className)}
      onBlur={(event) => {
        if (!containerRef.current?.contains(event.relatedTarget as Node)) {
          setOpen(false);
          setActiveIndex(-1);
        }
      }}
    >
      <div className="glass flex h-11 items-center gap-2.5 rounded-full px-4 focus-within:border-[var(--surface-ring)] transition-colors">
        <Search className="h-4 w-4 shrink-0 text-surface-muted" aria-hidden="true" />
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={showList}
          aria-controls={`${listId}-listbox`}
          aria-activedescendant={
            showList && activeIndex >= 0 ? `${listId}-option-${activeIndex}` : undefined
          }
          aria-autocomplete="list"
          aria-label="Search for a city"
          autoComplete="off"
          autoFocus={autoFocus}
          spellCheck={false}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
            setActiveIndex(-1);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search city…"
          className="h-full w-full bg-transparent text-sm text-surface placeholder:text-surface-faint focus:outline-none"
        />
        {results.isFetching && minChars ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-surface-muted" aria-hidden="true" />
        ) : null}
        <kbd
          className="pointer-events-none hidden sm:inline-flex h-5 min-w-5 items-center justify-center rounded border border-[var(--surface-border)] px-1 font-sans text-[10px] text-surface-faint"
          aria-hidden="true"
        >
          /
        </kbd>
      </div>

      {showList && (
        <div
          id={`${listId}-listbox`}
          role="listbox"
          aria-label="City results"
          className="glass-strong scroll-slim absolute left-0 right-0 top-full z-50 mt-2 max-h-80 overflow-y-auto rounded-2xl p-1.5 shadow-[var(--shadow-glass-lg)] animate-fade-in"
        >
          {results.isError ? (
            <p className="px-3.5 py-4 text-sm text-surface-muted" role="alert">
              Search is unavailable right now. Please try again.
            </p>
          ) : !results.isFetching && cities.length === 0 ? (
            <p className="px-3.5 py-4 text-sm text-surface-muted">
              No cities found for “{query.trim()}”. Try a different spelling.
            </p>
          ) : (
            cities.map((city, index) => (
              <button
                key={`${city.id}-${city.latitude}`}
                id={`${listId}-option-${index}`}
                role="option"
                aria-selected={index === activeIndex}
                type="button"
                tabIndex={-1}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => select(city)}
                className={cn(
                  'focus-ring flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors',
                  index === activeIndex ? 'bg-[var(--surface-strong)]' : 'hover:bg-[var(--surface-strong)]',
                )}
              >
                <span aria-hidden="true" className="text-lg leading-none">
                  {countryFlag(city.countryCode) || '📍'}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-surface">
                    {city.name}
                  </span>
                  {city.admin1 ? (
                    <span className="block truncate text-xs text-surface-muted">
                      {city.admin1} · {city.country}
                    </span>
                  ) : (
                    <span className="block truncate text-xs text-surface-muted">{city.country}</span>
                  )}
                </span>
                <MapPin className="h-3.5 w-3.5 shrink-0 text-surface-faint" aria-hidden="true" />
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
