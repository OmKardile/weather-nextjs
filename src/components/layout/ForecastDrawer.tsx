'use client';

import type { ReactNode } from 'react';
import { Drawer as DrawerPrimitive } from 'vaul';
import { LiquidGlass } from '@/components/glass/LiquidGlass';

/* ================================================================== */
/* ForecastDrawer — mobile sheet (iOS 27).                              */
/*                                                                     */
/* The sheet itself is a flat Surface (content material) with large    */
/* concentric top radii; the grabber is a small Liquid Glass pill      */
/* (control material). Detents peek / half / full. Content bottom      */
/* padding ≥ dock height (64) + bottom offset (12) + breathing room   */
/* (24) so nothing is ever clipped or overlapped by the floating dock.*/
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
          className="surface-overlay fixed inset-x-0 bottom-0 z-30 mx-auto flex h-[94dvh] w-full max-w-3xl flex-col rounded-t-[28px] border-x-0 border-b-0 outline-none lg:hidden"
          style={{ boxShadow: '0 -16px 48px -12px rgb(4 16 16 / 0.55)' }}
        >
          <DrawerPrimitive.Title className="sr-only">Forecast details</DrawerPrimitive.Title>
          <DrawerPrimitive.Description className="sr-only">
            Hourly and 7-day forecast, air quality, conditions and AI advice. Drag or press the
            grabber to expand.
          </DrawerPrimitive.Description>

          {/* Grabber — Liquid Glass pill (control layer), cycles detents */}
          <button
            type="button"
            onClick={cycle}
            aria-label="Expand forecast details"
            className="focus-ring flex w-full shrink-0 cursor-grab items-center justify-center rounded-t-[28px] pb-1 pt-3 active:cursor-grabbing"
          >
            <LiquidGlass
              className="flex h-[22px] w-11 items-center justify-center rounded-full"
              press={false}
            >
              <span
                aria-hidden="true"
                className="h-[5px] w-7 rounded-full bg-white/70"
              />
            </LiquidGlass>
          </button>

          {/* Concentric radius: outer 28 − padding 12 = inner 16 on the
              scroll container's content well. Bottom padding keeps the
              floating dock (64 + 12 + 24) from ever covering content. */}
          <div className="scroll-slim flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom)+108px)] pt-2">
            {children}
          </div>
        </DrawerPrimitive.Content>
      </DrawerPrimitive.Portal>
    </DrawerPrimitive.Root>
  );
}
