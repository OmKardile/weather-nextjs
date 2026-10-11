'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { Logo } from '@/components/brand/Logo';
import { Icon } from '@/components/icons/Icon';
import { WeatherIcon } from '@/components/weather/WeatherIcon';
import { formatLocalClock } from '@/lib/time';
import { springs } from '@/lib/motion';
import { formatTemp } from '@/lib/units';
import { conditionLabel } from '@/lib/wmo';
import type { City, Units, WeatherBundle } from '@/types/weather';
import { cn } from '@/lib/utils';

/* ================================================================== */
/* MenuBar — macOS-style top bar.                                      */
/* Center morphs from city + local clock to a compact weather summary  */
/* once the hero scrolls out of view (iOS Weather behavior).           */
/* ================================================================== */

interface MenuBarProps {
  city: City | null;
  bundle: WeatherBundle | null;
  units: Units;
  scrolled: boolean;
  aiOpen: boolean;
  locating: boolean;
  onToggleUnits: () => void;
  onOpenPalette: () => void;
  onToggleAi: () => void;
  onOpenSettings: () => void;
  onLocate: () => void;
}

function UnitToggle({ units, onToggle }: { units: Units; onToggle: () => void }) {
  return (
    <div
      role="group"
      aria-label="Temperature units"
      className="glass-subtle flex h-8 items-center rounded-full p-0.5"
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
              'focus-ring tnum h-7 min-w-8 rounded-full px-2 text-xs font-semibold transition-all duration-200',
              active
                ? 'bg-aurora-500 text-[#04211C] shadow-[0_0_14px_-4px_rgb(34_188_160/0.8)]'
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

function IconActionButton({
  label,
  icon,
  onClick,
  active,
  disabled,
  className,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={cn(
        'glass-subtle focus-ring flex h-9 w-9 items-center justify-center rounded-full transition-all duration-200 hover:bg-[var(--surface-strong)] disabled:opacity-60',
        active && 'border-aurora-500/50 bg-aurora-500/15 text-aurora-400',
        className,
      )}
    >
      {icon}
    </button>
  );
}

export function MenuBar({
  city,
  bundle,
  units,
  scrolled,
  aiOpen,
  locating,
  onToggleUnits,
  onOpenPalette,
  onToggleAi,
  onOpenSettings,
  onLocate,
}: MenuBarProps) {
  // Live local clock for the active city.
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setTick((v) => v + 1), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  const clock = bundle ? formatLocalClock(bundle.utcOffsetSeconds) : '';

  const showCompact = scrolled && bundle != null;

  return (
    <header className="sticky top-0 z-40 shrink-0">
      <div className="glass border-x-0 border-t-0">
        <div className="mx-auto flex h-12 w-full items-center gap-2 px-3 sm:px-5 lg:h-[52px]">
          {/* Left — brand */}
          <Logo className="shrink-0 [&>span:last-child]:hidden sm:[&>span:last-child]:inline" />

          {/* Center — city morph (clock ⇄ compact weather) */}
          <div className="relative flex h-full min-w-0 flex-1 items-center justify-center">
            <AnimatePresence mode="popLayout" initial={false}>
              {!city ? (
                <motion.p
                  key="tagline"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={springs.snappy}
                  className="hidden truncate text-sm text-surface-muted sm:block"
                >
                  Weather, elevated.
                </motion.p>
              ) : showCompact && bundle ? (
                <motion.div
                  key="compact"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={springs.snappy}
                  className="flex min-w-0 items-center gap-2"
                >
                  <WeatherIcon
                    condition={bundle.current.condition}
                    isDay={bundle.current.isDay}
                    size={24}
                  />
                  <span className="truncate text-sm font-semibold text-surface">{city.name}</span>
                  <span className="tnum text-sm font-semibold text-surface">
                    {formatTemp(bundle.current.temperature, units)}
                  </span>
                  <span className="hidden truncate text-xs text-surface-muted sm:block">
                    {conditionLabel(bundle.current.weatherCode)}
                  </span>
                </motion.div>
              ) : (
                <motion.div
                  key="clock"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={springs.snappy}
                  className="flex min-w-0 items-center gap-2"
                >
                  <span className="truncate text-sm font-semibold text-surface">{city.name}</span>
                  {clock && (
                    <>
                      <span aria-hidden="true" className="text-surface-faint">
                        ·
                      </span>
                      <span className="tnum text-sm text-surface-muted">{clock}</span>
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Right — controls */}
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <IconActionButton
              label="Use my location"
              icon={<Icon name="locate" size={17} animated />}
              onClick={onLocate}
              disabled={locating}
              className="hidden lg:flex"
            />
            <UnitToggle units={units} onToggle={onToggleUnits} />
            <button
              type="button"
              onClick={onOpenPalette}
              aria-label="Search and commands"
              aria-keyshortcuts="Meta+K Control+K"
              className="glass-subtle focus-ring flex h-9 items-center gap-2 rounded-full px-3 text-sm text-surface-muted transition-all duration-200 hover:bg-[var(--surface-strong)] hover:text-surface"
            >
              <Icon name="search" size={16} />
              <span className="hidden xl:inline">Search</span>
              <kbd className="hidden rounded-md border border-[var(--surface-border)] bg-[var(--surface-subtle)] px-1.5 py-0.5 text-[10px] font-medium text-surface-faint xl:inline">
                ⌘K
              </kbd>
            </button>
            <IconActionButton
              label={aiOpen ? 'Close Ask AI' : 'Ask AI'}
              icon={<Icon name="sparkle" size={17} animated />}
              onClick={onToggleAi}
              active={aiOpen}
            />
            <IconActionButton
              label="Settings"
              icon={<Icon name="gear" size={17} />}
              onClick={onOpenSettings}
              className="hidden lg:flex"
            />
          </div>
        </div>
      </div>
    </header>
  );
}
