'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { Logo } from '@/components/brand/Logo';
import { Icon } from '@/components/icons/Icon';
import { WeatherIcon } from '@/components/weather/WeatherIcon';
import { LiquidGlass } from '@/components/glass/LiquidGlass';
import { toggleAmbientSound } from '@/hooks/use-ambient-sound';
import { usePreferences } from '@/hooks/use-preferences';
import { formatLocalClock } from '@/lib/time';
import { springs } from '@/lib/motion';
import { formatTemp } from '@/lib/units';
import { conditionLabel } from '@/lib/wmo';
import type { City, Units, WeatherBundle } from '@/types/weather';
import { cn } from '@/lib/utils';

/* ================================================================== */
/* MenuBar — floating transparent top chrome (iOS 27).                 */
/*                                                                     */
/* NO solid bar: logo floats left, city + time center as plain white   */
/* text on the scene, and every control lives in ONE grouped           */
/* LiquidGlass capsule on the right (unit toggle + icon buttons,       */
/* 44px targets, 20px glyphs, full-opacity white). The capsule's       */
/* glass strengthens (lg-boosted) while content scrolls beneath it.    */
/* ================================================================== */

interface MenuBarProps {
  city: City | null;
  bundle: WeatherBundle | null;
  units: Units;
  scrolled: boolean;
  aiOpen: boolean;
  mapOpen: boolean;
  locating: boolean;
  onToggleUnits: () => void;
  onOpenPalette: () => void;
  onToggleAi: () => void;
  onToggleMap: () => void;
  onOpenSettings: () => void;
  onLocate: () => void;
}

const emptySubscribe = () => () => {};

/** True once hydrated on the client (server render sees false). */
function useHydrated(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}

function ClusterButton({
  label,
  onClick,
  active,
  disabled,
  children,
  className,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
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
        'focus-ring flex h-11 w-11 items-center justify-center rounded-full text-white transition-colors duration-200 disabled:opacity-60',
        active && 'bg-white/16',
        className,
      )}
    >
      {children}
    </button>
  );
}

export function MenuBar({
  city,
  bundle,
  units,
  scrolled,
  aiOpen,
  mapOpen,
  locating,
  onToggleUnits,
  onOpenPalette,
  onToggleAi,
  onToggleMap,
  onOpenSettings,
  onLocate,
}: MenuBarProps) {
  // Live local clock for the active city.
  const [tick, setTick] = useState(0);
  // Hydration gate — the persisted ambient preference differs from the
  // server default, so the pressed state only applies after mount.
  const hydrated = useHydrated();
  const ambientEnabled = usePreferences((state) => state.ambientSoundEnabled);
  useEffect(() => {
    const timer = window.setInterval(() => setTick((v) => v + 1), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  const clock = bundle ? formatLocalClock(bundle.utcOffsetSeconds) : '';

  const showCompact = scrolled && bundle != null;

  return (
    <header className="sticky top-0 z-40 shrink-0">
      <div className="mx-auto flex h-14 w-full items-center gap-2 px-3 sm:px-5 lg:h-[60px]">
        {/* Left — brand, floating free on the scene */}
        <Logo className="shrink-0 [&>span:last-child]:hidden sm:[&>span:last-child]:inline" />

        {/* Center — city + time (or compact weather when scrolled) */}
        <div className="relative flex h-full min-w-0 flex-1 items-center justify-center">
          <AnimatePresence mode="popLayout" initial={false}>
            {!city ? (
              <motion.p
                key="tagline"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={springs.snappy}
                className="text-on-scene-2 hidden truncate text-[15px] sm:block"
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
                className="text-on-scene flex min-w-0 items-center gap-2"
              >
                <WeatherIcon
                  condition={bundle.current.condition}
                  isDay={bundle.current.isDay}
                  size={24}
                />
                <span className="truncate text-[15px] font-semibold">{city.name}</span>
                <span className="tnum text-[15px] font-semibold">
                  {formatTemp(bundle.current.temperature, units)}
                </span>
                <span className="text-on-scene-2 hidden truncate text-[13px] sm:block">
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
                className="text-on-scene flex min-w-0 items-center gap-2"
              >
                <span className="truncate text-[15px] font-semibold">{city.name}</span>
                {clock && (
                  <>
                    <span aria-hidden="true" className="text-on-scene-3">
                      ·
                    </span>
                    <span className="text-on-scene-2 tnum text-[14px]">{clock}</span>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right — ONE grouped Liquid Glass capsule with every control */}
        <LiquidGlass
          refract
          className={cn(
            'flex shrink-0 items-center gap-0.5 rounded-full p-1 transition-shadow duration-300',
            scrolled && 'lg-boosted',
          )}
        >
          <ClusterButton
            label="Use my location"
            onClick={onLocate}
            disabled={locating}
            className="hidden lg:flex"
          >
            <Icon name="locate" size={20} animated />
          </ClusterButton>

          {/* Unit toggle — inner selected capsule (no separate glass) */}
          <div
            role="group"
            aria-label="Temperature units"
            className="flex h-11 items-center p-0.5"
          >
            {(['metric', 'imperial'] as const).map((option) => {
              const active = units === option;
              return (
                <button
                  key={option}
                  type="button"
                  aria-pressed={active}
                  onClick={active ? undefined : onToggleUnits}
                  className={cn(
                    'focus-ring tnum relative flex h-10 min-w-10 items-center justify-center rounded-full px-2 text-[13px] font-semibold transition-colors duration-200',
                    active ? 'text-white' : 'text-white/70 hover:text-white',
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="unit-toggle-pill"
                      initial={false}
                      animate={{ scaleX: [1.1, 1] }}
                      transition={{
                        ...springs.snappy,
                        scaleX: { duration: 0.24, ease: 'easeOut' },
                      }}
                      className="lg-selected absolute inset-0 rounded-full"
                      aria-hidden="true"
                    />
                  )}
                  <span className="relative">{option === 'metric' ? '°C' : '°F'}</span>
                </button>
              );
            })}
          </div>

          <ClusterButton
            label={ambientEnabled ? 'Mute ambient sound' : 'Play ambient sound'}
            onClick={toggleAmbientSound}
            active={hydrated && ambientEnabled}
            className="hidden sm:flex"
          >
            <Icon name="volume" size={20} />
          </ClusterButton>
          <ClusterButton label="Search and commands" onClick={onOpenPalette}>
            <Icon name="search" size={20} />
          </ClusterButton>
          <ClusterButton
            label={aiOpen ? 'Close Ask AI' : 'Ask AI'}
            onClick={onToggleAi}
            active={aiOpen}
          >
            <Icon name="sparkle" size={20} animated />
          </ClusterButton>
          <ClusterButton
            label={mapOpen ? 'Close map' : 'Open map'}
            onClick={onToggleMap}
            active={mapOpen}
          >
            <Icon name="map" size={20} animated />
          </ClusterButton>
          <ClusterButton label="Settings" onClick={onOpenSettings} className="hidden lg:flex">
            <Icon name="gear" size={20} />
          </ClusterButton>
        </LiquidGlass>
      </div>
    </header>
  );
}
