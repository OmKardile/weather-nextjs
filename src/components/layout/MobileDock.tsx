'use client';

import { motion } from 'framer-motion';
import { LiquidGlass } from '@/components/glass/LiquidGlass';
import { Icon } from '@/components/icons/Icon';
import { springs } from '@/lib/motion';
import { cn } from '@/lib/utils';

/* ================================================================== */
/* MobileDock — floating Liquid Glass capsule (iOS 27 tab bar).        */
/*                                                                     */
/* bottom: max(12px, env(safe-area-inset-bottom)) · height 64 · 12px   */
/* side margins. Labels 11px sentence-case. The selected tab is an     */
/* inner lighter glass capsule that morphs between positions           */
/* (layoutId spring + brief scaleX stretch mid-travel).                */
/* ================================================================== */

export type DockTab = 'today' | 'map' | 'cities' | 'ai' | 'settings';

interface MobileDockProps {
  active: DockTab;
  onChange: (tab: DockTab) => void;
  className?: string;
}

const ITEMS: Array<{ id: DockTab; label: string; icon: Parameters<typeof Icon>[0]['name'] }> = [
  { id: 'today', label: 'Today', icon: 'sun' },
  { id: 'map', label: 'Map', icon: 'map' },
  { id: 'ai', label: 'Ask AI', icon: 'sparkle' },
  { id: 'cities', label: 'Cities', icon: 'pin' },
  { id: 'settings', label: 'Settings', icon: 'gear' },
];

export function MobileDock({ active, onChange, className }: MobileDockProps) {
  return (
    <nav
      aria-label="App sections"
      className={cn('pointer-events-none fixed inset-x-0 bottom-0 z-40 lg:hidden', className)}
    >
      {/* Content scrim — lives between the drawer/map content (z-30) and
          this dock (z-40) so scrolled content never fights the tab labels
          at Ultra-clear glass settings (iOS tab-bar behavior; tones match
          the .dock-scrim sky treatment in glass.css). */}
      <div className="dock-content-scrim absolute inset-x-0 bottom-0" aria-hidden="true" />
      <div
        className="pointer-events-auto mx-auto mb-[max(12px,env(safe-area-inset-bottom))] w-fit px-3"
      >
        {/* Refraction budget slot #1 — the dock is always glass. */}
        <LiquidGlass
          refract
          className="flex h-16 items-center gap-0.5 rounded-full px-1.5"
        >
          {ITEMS.map((item) => {
            const isActive = active === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onChange(item.id)}
                aria-current={isActive ? 'page' : undefined}
                className="focus-ring group relative flex h-14 min-w-[62px] flex-col items-center justify-center gap-0.5 rounded-full px-2 transition-transform duration-200 ease-[var(--ease-spring-bouncy)] active:scale-95 sm:min-w-[70px]"
              >
                {isActive && (
                  <motion.span
                    layoutId="dock-active-pill"
                    initial={false}
                    animate={{ scaleX: [1.08, 1] }}
                    transition={{
                      ...springs.bouncy,
                      scaleX: { duration: 0.26, ease: 'easeOut' },
                    }}
                    className="lg-selected absolute inset-0 rounded-full"
                    aria-hidden="true"
                  />
                )}
                <Icon
                  name={item.icon}
                  size={20}
                  animated
                  className={cn(
                    'relative transition-all duration-200 ease-[var(--ease-spring-bouncy)]',
                    isActive
                      ? 'scale-110 text-white drop-shadow-[0_0_10px_rgb(255_255_255/0.45)]'
                      : 'text-white/72 group-hover:text-white',
                  )}
                />
                <span
                  className={cn(
                    'relative text-[11px] font-medium leading-none transition-colors duration-200',
                    isActive ? 'text-white' : 'text-white/72 group-hover:text-white',
                  )}
                >
                  {item.label}
                </span>
              </button>
            );
          })}
        </LiquidGlass>
      </div>
    </nav>
  );
}
