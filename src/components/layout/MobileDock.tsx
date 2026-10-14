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

type Severity = 'extreme' | 'severe' | 'moderate' | 'minor' | 'info';

interface MobileDockProps {
  active: DockTab;
  onChange: (tab: DockTab) => void;
  /** Active-alert count for the Today badge (0/undefined hides it). */
  alertCount?: number;
  /** Top alert severity — tints the badge (defaults to neutral warm). */
  alertSeverity?: Severity;
  className?: string;
}

/** Badge tones per severity — opaque pill, AA against any scene. */
const BADGE_TONES: Record<Severity, string> = {
  extreme: 'bg-[#c73e1d] text-[#ffe4d9]',
  severe: 'bg-[#b25a1e] text-[#ffe9d2]',
  moderate: 'bg-[#8a6d1d] text-[#fff3c4]',
  minor: 'bg-[#1d6e5a] text-[#c9f4e6]',
  info: 'bg-[#186b5c] text-[#c2f0e4]',
};

const ITEMS: Array<{ id: DockTab; label: string; icon: Parameters<typeof Icon>[0]['name'] }> = [
  { id: 'today', label: 'Today', icon: 'sun' },
  { id: 'map', label: 'Map', icon: 'map' },
  { id: 'ai', label: 'Ask AI', icon: 'sparkle' },
  { id: 'cities', label: 'Cities', icon: 'pin' },
  { id: 'settings', label: 'Settings', icon: 'gear' },
];

export function MobileDock({
  active,
  onChange,
  alertCount = 0,
  alertSeverity = 'moderate',
  className,
}: MobileDockProps) {
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
            // The Today badge only shows while the user is on ANOTHER tab —
            // on Today the alerts are on screen already (drawer), so a badge
            // there would be noise, not signal.
            const badge =
              item.id === 'today' && !isActive && alertCount > 0 ? alertCount : 0;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  // Subtle haptic tick on tap (Android/Chromium; no-op where
                  // unsupported). 4ms ≈ iOS tab-bar tap feel.
                  navigator.vibrate?.(4);
                  onChange(item.id);
                }}
                aria-current={isActive ? 'page' : undefined}
                aria-label={
                  item.id === 'today' && badge > 0
                    ? `Today — ${badge} active ${badge === 1 ? 'alert' : 'alerts'}`
                    : undefined
                }
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
                      ? 'dock-glow scale-110'
                      : 'opacity-70 group-hover:opacity-100',
                  )}
                />
                {badge > 0 && (
                  <span
                    aria-hidden="true"
                    className={cn(
                      'absolute right-2 top-1.5 z-10 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold leading-none tnum',
                      BADGE_TONES[alertSeverity],
                    )}
                  >
                    {badge > 9 ? '9+' : badge}
                  </span>
                )}
                <span
                  className={cn(
                    'relative text-[11px] font-medium leading-none transition-opacity duration-200',
                    isActive ? '' : 'opacity-70 group-hover:opacity-100',
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
