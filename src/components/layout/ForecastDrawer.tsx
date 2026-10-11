'use client';

import type { ReactNode } from 'react';
import { Drawer as DrawerPrimitive } from 'vaul';

/* ================================================================== */
/* ForecastDrawer — mobile sheet with snap points (peek / half / full) */
/* holding the hourly + daily + details. macOS dock-safe bottom pad.   */
/* Non-modal: the hero behind stays scrollable, the drawer is always   */
/* available (not dismissible) on the Today tab.                       */
/* ================================================================== */

export const DRAWER_SNAPS = [0.22, 0.58, 0.94] as const;
export type DrawerSnap = (typeof DRAWER_SNAPS)[number];

interface ForecastDrawerProps {
  /** Active snap point (controlled — allows ⌘K jump-to to open the drawer). */
  snapPoint: number;
  onSnapPointChange: (snap: number) => void;
  children: ReactNode;
}

export function ForecastDrawer({ snapPoint, onSnapPointChange, children }: ForecastDrawerProps) {
  const cycle = () => {
    const index = DRAWER_SNAPS.findIndex((s) => s >= snapPoint - 0.001);
    const next = DRAWER_SNAPS[(index + 1) % DRAWER_SNAPS.length];
    onSnapPointChange(next);
  };

  return (
    <DrawerPrimitive.Root
      open
      dismissible={false}
      modal={false}
      snapPoints={[...DRAWER_SNAPS]}
      activeSnapPoint={snapPoint}
      setActiveSnapPoint={(point) => {
        if (typeof point === 'number') onSnapPointChange(point);
      }}
    >
      <DrawerPrimitive.Portal>
        <DrawerPrimitive.Content
          className="glass-strong fixed inset-x-0 bottom-0 z-30 mx-auto flex h-[94dvh] w-full max-w-3xl flex-col rounded-t-3xl border-x-0 border-b-0 outline-none lg:hidden"
          style={{ boxShadow: '0 -12px 48px -12px rgb(7 19 20 / 0.5)' }}
        >
          <DrawerPrimitive.Title className="sr-only">Forecast details</DrawerPrimitive.Title>
          <DrawerPrimitive.Description className="sr-only">
            Hourly and 7-day forecast, air quality, conditions and AI advice. Drag or press the
            grabber to expand.
          </DrawerPrimitive.Description>

          {/* Grabber — click cycles snap points */}
          <button
            type="button"
            onClick={cycle}
            aria-label="Expand forecast details"
            className="focus-ring flex w-full shrink-0 cursor-grab items-center justify-center rounded-t-3xl py-3.5 active:cursor-grabbing"
          >
            <span
              aria-hidden="true"
              className="h-1.5 w-11 rounded-full bg-[var(--surface-border)] transition-colors"
            />
          </button>

          <div className="scroll-slim flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-[max(6.5rem,calc(env(safe-area-inset-bottom)+6.5rem))] pt-1">
            {children}
          </div>
        </DrawerPrimitive.Content>
      </DrawerPrimitive.Portal>
    </DrawerPrimitive.Root>
  );
}
