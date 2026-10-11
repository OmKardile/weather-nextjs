'use client';

import { motion } from 'framer-motion';
import { Glass } from '@/components/glass/Glass';
import { Icon } from '@/components/icons/Icon';
import { springs } from '@/lib/motion';
import { cn } from '@/lib/utils';

/* ================================================================== */
/* MobileDock — floating glass nav (macOS dock feel).                  */
/* Today · Map · Ask AI · Cities · Settings. Icons magnify on pointer */
/* hover (desktop-width breakpoints); active tab gets a sliding       */
/* aurora pill. The Map tab opens the full-screen map overlay.        */
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
      className={cn('fixed inset-x-0 bottom-0 z-40 lg:hidden', className)}
    >
      {/* Legibility scrim behind the dock */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[rgb(7_19_20/0.5)] to-transparent"
      />
      <div className="relative mx-auto w-fit translate-y-0 pb-[max(0.85rem,env(safe-area-inset-bottom))]">
        <Glass level="overlay" className="flex items-center gap-0.5 rounded-full p-1.5">
          {ITEMS.map((item) => {
            const isActive = active === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onChange(item.id)}
                aria-current={isActive ? 'page' : undefined}
                className="focus-ring group relative flex h-11 min-w-[64px] flex-col items-center justify-center gap-0.5 rounded-full px-2 transition-transform duration-200 ease-[var(--ease-spring-bouncy)] hover:scale-110 active:scale-95 sm:min-w-[72px]"
              >
                {isActive && (
                  <motion.span
                    layoutId="dock-active-pill"
                    transition={springs.bouncy}
                    className="absolute inset-0 rounded-full bg-aurora-500/18 ring-1 ring-inset ring-aurora-500/35"
                    aria-hidden="true"
                  />
                )}
                <Icon
                  name={item.icon}
                  size={20}
                  animated
                  className={cn(
                    'relative transition-colors duration-200',
                    isActive ? 'text-aurora-400' : 'text-surface-muted group-hover:text-surface',
                  )}
                />
                <span
                  className={cn(
                    'relative text-[9px] font-semibold uppercase tracking-[0.08em] transition-colors duration-200',
                    isActive ? 'text-aurora-300' : 'text-surface-faint group-hover:text-surface-muted',
                  )}
                >
                  {item.label}
                </span>
              </button>
            );
          })}
        </Glass>
      </div>
    </nav>
  );
}
